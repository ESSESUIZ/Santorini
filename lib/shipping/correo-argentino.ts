import 'server-only';

export type PackageDimensions = {
  weight: number;
  height: number;
  width: number;
  length: number;
};

export type ShippingRate = {
  id: string;
  name: string;
  deliveryType: 'D' | 'S';
  price: number;
  estimatedDays?: string;
};

export class ShippingIntegrationError extends Error {
  constructor(public code: 'SHIPPING_NOT_CONFIGURED' | 'SHIPPING_PROVIDER_ERROR', message: string) {
    super(message);
  }
}

const baseUrls = {
  test: 'https://apitest.correoargentino.com.ar/micorreo/v1',
  production: 'https://api.correoargentino.com.ar/micorreo/v1',
};

let tokenCache: { value: string; expiresAt: number } | null = null;

function configuration() {
  const user = process.env.CORREO_ARGENTINO_USER;
  const password = process.env.CORREO_ARGENTINO_PASSWORD;
  const customerId = process.env.CORREO_ARGENTINO_CUSTOMER_ID;
  const originPostalCode = process.env.CORREO_ARGENTINO_ORIGIN_POSTAL_CODE;
  const environment = process.env.CORREO_ARGENTINO_ENVIRONMENT === 'production' ? 'production' : 'test';

  if (!user || !password || !customerId || !originPostalCode) {
    throw new ShippingIntegrationError('SHIPPING_NOT_CONFIGURED', 'Faltan las credenciales de MiCorreo o el código postal de origen.');
  }

  return { user, password, customerId, originPostalCode: normalizePostalCode(originPostalCode), baseUrl: baseUrls[environment] };
}

export function normalizePostalCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function getToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;
  const config = configuration();
  const response = await fetch(`${config.baseUrl}/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${config.user}:${config.password}`).toString('base64')}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ShippingIntegrationError('SHIPPING_PROVIDER_ERROR', `MiCorreo rechazó la autenticación (${response.status}).`);
  }

  const payload = await response.json() as { token?: string; access_token?: string; expires_in?: number };
  const token = payload.token ?? payload.access_token;
  if (!token) throw new ShippingIntegrationError('SHIPPING_PROVIDER_ERROR', 'MiCorreo no devolvió un token válido.');
  tokenCache = { value: token, expiresAt: Date.now() + Math.max(60, (payload.expires_in ?? 3300) - 60) * 1000 };
  return token;
}

type RawRate = Record<string, unknown>;

function numberFrom(rate: RawRate, keys: string[]) {
  for (const key of keys) {
    const value = Number(rate[key]);
    if (Number.isFinite(value)) return value;
  }
  return NaN;
}

function stringFrom(rate: RawRate, keys: string[]) {
  for (const key of keys) {
    const value = rate[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
}

export async function quoteCorreoArgentino(destinationPostalCode: string, dimensions: PackageDimensions, deliveryType: 'D' | 'S' = 'D') {
  const config = configuration();
  const postalCode = normalizePostalCode(destinationPostalCode);
  if (postalCode.length < 4) throw new ShippingIntegrationError('SHIPPING_PROVIDER_ERROR', 'Ingresá un código postal válido.');

  const token = await getToken();
  const response = await fetch(`${config.baseUrl}/rates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: config.customerId,
      postalCodeOrigin: config.originPostalCode,
      postalCodeDestination: postalCode,
      deliveredType: deliveryType,
      dimensions,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('MiCorreo rates error', response.status, detail.slice(0, 500));
    throw new ShippingIntegrationError('SHIPPING_PROVIDER_ERROR', `No pudimos cotizar el envío (${response.status}).`);
  }

  const payload = await response.json() as unknown;
  const candidates = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray((payload as { rates?: unknown[] }).rates))
      ? (payload as { rates: unknown[] }).rates
      : [payload];

  return candidates.flatMap((entry, index): ShippingRate[] => {
    if (!entry || typeof entry !== 'object') return [];
    const rate = entry as RawRate;
    const price = numberFrom(rate, ['price', 'rate', 'amount', 'totalPrice', 'total']);
    if (!Number.isFinite(price) || price < 0) return [];
    const name = stringFrom(rate, ['productName', 'serviceName', 'name', 'product']) ?? `Envío MiCorreo ${index + 1}`;
    const min = stringFrom(rate, ['deliveryTimeMin', 'estimatedDeliveryMin', 'minDays']);
    const max = stringFrom(rate, ['deliveryTimeMax', 'estimatedDeliveryMax', 'maxDays']);
    return [{
      id: `${deliveryType}-${stringFrom(rate, ['productType', 'serviceType', 'id', 'code']) ?? index}`,
      name,
      deliveryType,
      price,
      estimatedDays: min && max ? `${min}–${max} días hábiles` : stringFrom(rate, ['deliveryTime', 'estimatedDays']),
    }];
  });
}
