import { NextResponse } from 'next/server';
import { getPackageForItems } from '../../../../lib/checkout';
import { quoteCorreoArgentino, ShippingIntegrationError } from '../../../../lib/shipping/correo-argentino';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { createClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

type CheckoutBody = {
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: { street?: string; number?: string; apartment?: string; city?: string; province?: string; postal_code?: string };
  };
  items?: { variantId: string; quantity: number }[];
  shippingRateId?: string;
};

type CreatedOrder = { order_id: string; order_number: string; total_ars: number };

export async function POST(request: Request) {
  let orderId: string | null = null;
  const admin = createAdminClient();

  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken || accessToken.trim().length < 20 || /^(x+|\.{3}|todo|pendiente)$/i.test(accessToken.trim())) {
      return NextResponse.json({ code: 'PAYMENT_NOT_CONFIGURED', message: 'Mercado Pago todavía no está configurado. Agregá el Access Token en Vercel y volvé a desplegar.' }, { status: 503 });
    }

    const body = await request.json() as CheckoutBody;
    const customer = body.customer;
    const items = Array.isArray(body.items) ? body.items : [];
    const postalCode = customer?.address?.postal_code?.trim() ?? '';
    if (!customer?.name || !customer.email || !customer.phone || !customer.address?.street || !customer.address.number || !customer.address.city || !customer.address.province || !postalCode || !items.length || !body.shippingRateId) {
      return NextResponse.json({ message: 'Completá los datos, la bolsa y una opción de envío.' }, { status: 400 });
    }

    const dimensions = await getPackageForItems(items);
    const rates = await quoteCorreoArgentino(postalCode, dimensions, 'D');
    const selectedRate = rates.find((rate) => rate.id === body.shippingRateId);
    if (!selectedRate) return NextResponse.json({ message: 'La tarifa de envío cambió. Volvé a calcularla.' }, { status: 409 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: order, error: orderError } = await admin.rpc('create_checkout_order', {
      p_customer: customer,
      p_items: items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
      p_shipping: { service: selectedRate.name, cost: selectedRate.price, postal_code: postalCode },
      p_customer_id: user?.id ?? null,
    });
    if (orderError) throw orderError;
    const created = order as CreatedOrder;
    orderId = created.order_id;

    const { data: orderItems, error: itemError } = await admin
      .from('order_items')
      .select('quantity, unit_price_ars, product_variants!inner(sku, products!inner(name))')
      .eq('order_id', orderId);
    if (itemError) throw itemError;

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const preferenceResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: (orderItems ?? []).map((item) => {
          const variant = item.product_variants as unknown as { sku: string; products: { name: string } };
          return { id: variant.sku, title: variant.products.name, quantity: item.quantity, currency_id: 'ARS', unit_price: Number(item.unit_price_ars) };
        }),
        shipments: { cost: selectedRate.price, mode: 'not_specified' },
        payer: { name: customer.name, email: customer.email, phone: { number: customer.phone } },
        external_reference: orderId,
        metadata: { order_id: orderId, order_number: created.order_number },
        notification_url: `${siteUrl}/api/payments/webhook`,
        back_urls: {
          success: `${siteUrl}/checkout/resultado?estado=success&pedido=${encodeURIComponent(created.order_number)}`,
          pending: `${siteUrl}/checkout/resultado?estado=pending&pedido=${encodeURIComponent(created.order_number)}`,
          failure: `${siteUrl}/checkout/resultado?estado=failure&pedido=${encodeURIComponent(created.order_number)}`,
        },
        auto_return: 'approved',
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }),
      cache: 'no-store',
    });

    if (!preferenceResponse.ok) {
      const detail = await preferenceResponse.text();
      console.error('Mercado Pago preference error', preferenceResponse.status, detail.slice(0, 800));
      throw new Error(`Mercado Pago rechazó la preferencia (${preferenceResponse.status}).`);
    }
    const preference = await preferenceResponse.json() as { id: string; init_point?: string; sandbox_init_point?: string };
    const paymentEnvironment = process.env.MERCADO_PAGO_ENVIRONMENT === 'test' ? 'test' : 'production';
    const checkoutUrl = paymentEnvironment === 'test'
      ? preference.sandbox_init_point ?? preference.init_point
      : preference.init_point;
    if (!checkoutUrl) throw new Error('Mercado Pago no devolvió una URL de pago.');
    const { error: updateError } = await admin.from('orders').update({ payment_preference_id: preference.id }).eq('id', orderId);
    if (updateError) throw updateError;

    return NextResponse.json({ checkoutUrl, orderNumber: created.order_number });
  } catch (error) {
    if (orderId) await admin.rpc('release_checkout_order', { p_order_id: orderId });
    if (error instanceof ShippingIntegrationError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.code === 'SHIPPING_NOT_CONFIGURED' ? 503 : 502 });
    }
    console.error('Checkout start error', error);
    const message = error instanceof Error ? error.message : 'No pudimos iniciar el pago.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
