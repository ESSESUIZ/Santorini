import { NextResponse } from 'next/server';
import { buildOrderConfirmationEmail } from '../../../../../lib/emails/order-confirmation';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { createClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { orderId?: string };
    if (!body.orderId) return NextResponse.json({ message: 'Falta el pedido.' }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: 'No autorizado.' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ message: 'No autorizado.' }, { status: 403 });
    const { error: confirmError } = await supabase.rpc('confirm_manual_payment_order', { p_order_id: body.orderId });
    if (confirmError) throw confirmError;

    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin.from('orders').select('order_number, customer_name, customer_email, total_ars, order_items(quantity, unit_price_ars, product_variants!inner(sku, color, size, products!inner(name)))').eq('id', body.orderId).single();
    if (orderError || !order) throw orderError ?? new Error('No encontramos el pedido confirmado.');
    const email = buildOrderConfirmationEmail({ orderNumber: order.order_number, customerName: order.customer_name ?? '', totalArs: Number(order.total_ars), items: (order.order_items ?? []).map((item: any) => ({ sku: item.product_variants.sku, name: item.product_variants.products.name, color: item.product_variants.color, size: item.product_variants.size, quantity: item.quantity, unitPriceArs: Number(item.unit_price_ars) })) });
    const key = process.env.RESEND_API_KEY;
    const from = process.env.ORDER_EMAIL_FROM;
    if (!key || !from || !order.customer_email) return NextResponse.json({ email: 'not_configured' });
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [order.customer_email], subject: email.subject, html: email.html }) });
    if (!response.ok) { console.error('Transactional email error', response.status, (await response.text()).slice(0, 500)); return NextResponse.json({ email: 'failed' }); }
    return NextResponse.json({ email: 'sent' });
  } catch (error) {
    console.error('Manual payment confirmation error', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'No pudimos confirmar el pago.' }, { status: 500 });
  }
}
