import { NextResponse } from 'next/server';
import { getPackageForItems } from '../../../../lib/checkout';
import { quoteCorreoArgentino, ShippingIntegrationError } from '../../../../lib/shipping/correo-argentino';
import { readItems, takeRateLimit } from '../../../../lib/security/request-guard';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!takeRateLimit(request, 'shipping', 20, 60_000)) return NextResponse.json({ message: 'Esperá un minuto antes de volver a cotizar.' }, { status: 429 });
  try {
    const body = await request.json() as { postalCode?: string; items?: { variantId: string; quantity: number }[] };
    const postalCode = body.postalCode?.trim() ?? '';
    const items = readItems(body.items);
    if (!/^[A-Z]?\d{4}[A-Z]{0,3}$/i.test(postalCode) || !items) return NextResponse.json({ message: 'Completá un código postal válido y el carrito.' }, { status: 400 });
    const dimensions = await getPackageForItems(items);
    const rates = await quoteCorreoArgentino(postalCode, dimensions, 'D');
    if (!rates.length) return NextResponse.json({ message: 'MiCorreo no devolvió opciones para ese código postal.' }, { status: 422 });
    return NextResponse.json({ rates });
  } catch (error) {
    if (error instanceof ShippingIntegrationError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.code === 'SHIPPING_NOT_CONFIGURED' ? 503 : 502 });
    }
    console.error('Shipping quote error', error);
    return NextResponse.json({ message: 'No pudimos calcular el envío.' }, { status: 500 });
  }
}
