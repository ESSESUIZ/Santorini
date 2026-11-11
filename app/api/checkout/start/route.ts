import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { createClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

type CheckoutBody = {
  customer?: { name?: string; email?: string; phone?: string };
  items?: { variantId: string; quantity: number }[];
  paymentMethod?: 'bank_transfer' | 'cash';
};
type CreatedOrder = { order_id: string; order_number: string; total_ars: number };

export async function POST(request: Request) {
  let orderId: string | null = null;
  const admin = createAdminClient();
  try {
    const body = await request.json() as CheckoutBody;
    const customer = body.customer;
    const items = Array.isArray(body.items) ? body.items : [];
    const paymentMethod = body.paymentMethod === 'cash' ? 'cash' : 'bank_transfer';
    if (!customer?.name || !customer.email || !customer.phone || !items.length) return NextResponse.json({ message: 'Completá tus datos de contacto y el carrito.' }, { status: 400 });

    const whatsapp = process.env.BANK_TRANSFER_WHATSAPP?.replace(/\D/g, '');
    const alias = process.env.BANK_TRANSFER_ALIAS?.trim();
    if (!whatsapp || whatsapp.length < 10) return NextResponse.json({ code: 'WHATSAPP_NOT_CONFIGURED', message: 'La coordinación por WhatsApp todavía no está configurada.' }, { status: 503 });
    if (paymentMethod === 'bank_transfer' && !alias) return NextResponse.json({ code: 'TRANSFER_NOT_CONFIGURED', message: 'La transferencia todavía no está configurada. Elegí efectivo o contactanos por WhatsApp.' }, { status: 503 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: order, error } = await admin.rpc('create_checkout_order', {
      p_customer: { name: customer.name, email: customer.email, phone: customer.phone, address: { pickup: 'Recoleta' } },
      p_items: items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
      p_shipping: { service: 'Retiro en persona · Recoleta', cost: 0 },
      p_customer_id: user?.id ?? null,
      p_payment_provider: paymentMethod,
    });
    if (error) throw error;
    const created = order as CreatedOrder;
    orderId = created.order_id;
    const amount = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(created.total_ars));
    const text = paymentMethod === 'bank_transfer'
      ? `Hola, quiero enviar el comprobante de transferencia del pedido ${created.order_number}. Total: ${amount}.`
      : `Hola, quiero coordinar el pago en efectivo y el retiro en Recoleta del pedido ${created.order_number}. Total: ${amount}.`;
    return NextResponse.json({ orderNumber: created.order_number, total: created.total_ars, paymentMethod, pickup: 'Retiro en persona · Recoleta', transfer: paymentMethod === 'bank_transfer' ? { alias, accountHolder: process.env.BANK_TRANSFER_ACCOUNT_HOLDER?.trim() ?? '' } : null, whatsappUrl: `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}` });
  } catch (error) {
    if (orderId) await admin.rpc('release_checkout_order', { p_order_id: orderId });
    console.error('Manual checkout start error', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'No pudimos iniciar el pedido.' }, { status: 500 });
  }
}
