type CartItem = { variantId: string; quantity: number };
type CheckoutCustomer = { name: string; email: string; phone: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attempts = new Map<string, { count: number; resetAt: number }>();

/** A lightweight process-local brake. Production should additionally use Vercel WAF/rate limiting. */
export function takeRateLimit(request: Request, scope: string, limit: number, windowMs: number) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const address = forwarded || request.headers.get('x-real-ip') || 'unknown';
  const key = `${scope}:${address}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export function readCheckoutBody(value: unknown): { customer: CheckoutCustomer; items: CartItem[]; paymentMethod: 'bank_transfer' | 'cash' } | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as { customer?: Record<string, unknown>; items?: unknown; paymentMethod?: unknown };
  const name = typeof body.customer?.name === 'string' ? body.customer.name.trim() : '';
  const customerEmail = typeof body.customer?.email === 'string' ? body.customer.email.trim().toLowerCase() : '';
  const phone = typeof body.customer?.phone === 'string' ? body.customer.phone.trim() : '';
  if (name.length < 2 || name.length > 100 || !email.test(customerEmail) || customerEmail.length > 254 || phone.replace(/\D/g, '').length < 8 || phone.length > 32) return null;
  const items = readItems(body.items);
  if (!items) return null;
  return { customer: { name, email: customerEmail, phone }, items, paymentMethod: body.paymentMethod === 'cash' ? 'cash' : 'bank_transfer' };
}

export function readItems(value: unknown): CartItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const ids = new Set<string>();
  const items: CartItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as { variantId?: unknown; quantity?: unknown };
    if (typeof item.variantId !== 'string' || !uuid.test(item.variantId) || !Number.isInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 10 || ids.has(item.variantId)) return null;
    ids.add(item.variantId);
    items.push({ variantId: item.variantId, quantity: item.quantity as number });
  }
  return items;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value);
}
