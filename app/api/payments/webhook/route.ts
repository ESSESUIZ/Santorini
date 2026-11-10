import { InvalidWebhookSignatureError, WebhookSignatureValidator } from 'mercadopago';
import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/admin';

export const runtime = 'nodejs';

type MercadoPagoPayment = {
  id: number;
  status: string;
  external_reference?: string;
  transaction_amount: number;
};

export async function POST(request: Request) {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!accessToken || !webhookSecret) return NextResponse.json({ message: 'Payment integration not configured.' }, { status: 503 });

  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({})) as { data?: { id?: string | number }; type?: string };
    const dataId = url.searchParams.get('data.id') ?? body.data?.id?.toString() ?? null;
    if (!dataId) return NextResponse.json({ received: true });

    WebhookSignatureValidator.validate({
      xSignature: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'),
      dataId,
      secret: webhookSecret,
      toleranceSeconds: 300,
    });

    if (body.type && body.type !== 'payment') return NextResponse.json({ received: true });
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!paymentResponse.ok) throw new Error(`No se pudo consultar el pago (${paymentResponse.status}).`);
    const payment = await paymentResponse.json() as MercadoPagoPayment;
    if (!payment.external_reference) return NextResponse.json({ received: true });

    const admin = createAdminClient();
    if (payment.status === 'approved') {
      const { error } = await admin.rpc('confirm_paid_order', {
        p_order_id: payment.external_reference,
        p_payment_id: payment.id.toString(),
        p_amount: payment.transaction_amount,
      });
      if (error) throw error;
    } else if (payment.status === 'cancelled') {
      const { error } = await admin.rpc('release_checkout_order', { p_order_id: payment.external_reference });
      if (error) throw error;
    } else if (['refunded', 'charged_back'].includes(payment.status)) {
      const { error } = await admin.rpc('refund_paid_order', { p_order_id: payment.external_reference, p_payment_id: payment.id.toString() });
      if (error) throw error;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      console.warn('Invalid Mercado Pago webhook signature', error.reason, error.requestId);
      return NextResponse.json({ message: 'Invalid signature.' }, { status: 401 });
    }
    console.error('Mercado Pago webhook error', error);
    return NextResponse.json({ message: 'Webhook processing failed.' }, { status: 500 });
  }
}
