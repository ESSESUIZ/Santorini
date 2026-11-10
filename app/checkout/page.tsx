'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { SiteNav } from '../../components/SiteNav';
import { useCart } from '../../components/CartProvider';
import { money } from '../../lib/catalog';
import { createClient } from '../../lib/supabase/browser';

type CheckoutForm = { name: string; email: string; phone: string; street: string; number: string; apartment: string; city: string; province: string; postalCode: string };
type ShippingRate = { id: string; name: string; price: number; estimatedDays?: string };
type PaymentMethod = 'mercado_pago' | 'bank_transfer';
type TransferInstructions = { orderNumber: string; total: number; alias: string; accountHolder: string; whatsappUrl: string };
const emptyForm: CheckoutForm = { name: '', email: '', phone: '', street: '', number: '', apartment: '', city: '', province: '', postalCode: '' };

export default function CheckoutPage() {
  const { lines, total, remove, clear } = useCart();
  const [form, setForm] = useState(emptyForm);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [message, setMessage] = useState('');
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [shippingRateId, setShippingRateId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mercado_pago');
  const [transfer, setTransfer] = useState<TransferInstructions | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const [{ data: profile }, { data: address }] = await Promise.all([
        supabase.from('customer_profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
        supabase.from('customer_addresses').select('*').eq('customer_id', user.id).eq('is_default', true).maybeSingle(),
      ]);
      setForm({ name: address?.recipient_name ?? profile?.full_name ?? '', email: user.email ?? '', phone: address?.phone ?? profile?.phone ?? '', street: address?.street ?? '', number: address?.street_number ?? '', apartment: address?.apartment ?? '', city: address?.city ?? '', province: address?.province ?? '', postalCode: address?.postal_code ?? '' });
    };
    load();
  }, []);

  const selectedRate = rates.find((rate) => rate.id === shippingRateId);
  const grandTotal = total + (selectedRate?.price ?? 0);
  const change = (key: keyof CheckoutForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'postalCode') { setRates([]); setShippingRateId(''); }
  };

  const quote = async () => {
    if (!form.postalCode || !lines.length) return;
    setQuoting(true); setMessage('Consultando tarifas de Correo Argentino…');
    try {
      const response = await fetch('/api/shipping/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postalCode: form.postalCode, items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })) }),
      });
      const payload = await response.json() as { rates?: ShippingRate[]; message?: string };
      if (!response.ok) throw new Error(payload.message ?? 'No pudimos calcular el envío.');
      setRates(payload.rates ?? []);
      setShippingRateId(payload.rates?.[0]?.id ?? '');
      setMessage('Elegí la opción de envío y continuá al pago seguro.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No pudimos calcular el envío.'); }
    finally { setQuoting(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!lines.length || !shippingRateId) { setMessage('Primero calculá y elegí el envío.'); return; }
    setBusy(true); setMessage(paymentMethod === 'mercado_pago' ? 'Reservando tus prendas e iniciando el pago seguro…' : 'Reservando tus prendas y preparando los datos de transferencia…');
    try {
      const response = await fetch('/api/checkout/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: form.name, email: form.email, phone: form.phone, address: { street: form.street, number: form.number, apartment: form.apartment, city: form.city, province: form.province, postal_code: form.postalCode } },
          items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
          shippingRateId,
          paymentMethod,
        }),
      });
      const payload = await response.json() as { checkoutUrl?: string; message?: string; paymentMethod?: PaymentMethod; orderNumber?: string; total?: number; transfer?: { alias: string; accountHolder: string; whatsappUrl: string } };
      if (!response.ok) throw new Error(payload.message ?? 'No pudimos iniciar el pago.');
      if (payload.paymentMethod === 'bank_transfer' && payload.transfer && payload.orderNumber && typeof payload.total === 'number') {
        clear();
        setTransfer({ orderNumber: payload.orderNumber, total: payload.total, ...payload.transfer });
        setMessage('');
        setBusy(false);
        return;
      }
      if (!payload.checkoutUrl) throw new Error(payload.message ?? 'No pudimos iniciar el pago.');
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos iniciar el pago.');
      setBusy(false);
    }
  };

  return <main className="checkout-page"><SiteNav /><div className="checkout-layout">
    <section className="checkout-form"><p className="eyebrow">CHECKOUT · {userId ? 'CUENTA IDENTIFICADA' : 'COMPRA COMO INVITADO'}</p><h1>Datos de<br />entrega.</h1>
      {transfer ? <section className="transfer-confirmation" aria-live="polite"><p className="eyebrow">PEDIDO {transfer.orderNumber}</p><h2>Transferencia<br />iniciada.</h2><p>Transferí <strong>{money(transfer.total)}</strong> al alias indicado. Tu stock queda reservado por dos horas mientras nos enviás el comprobante.</p><div className="transfer-alias"><span>ALIAS</span><strong>{transfer.alias}</strong>{transfer.accountHolder && <small>{transfer.accountHolder}</small>}<button type="button" onClick={() => { navigator.clipboard?.writeText(transfer.alias); setCopied(true); }}>{copied ? 'Alias copiado' : 'Copiar alias'}</button></div><a className="button transfer-whatsapp" href={transfer.whatsappUrl} target="_blank" rel="noreferrer">Enviar comprobante por WhatsApp <span>↗</span></a><p className="checkout-hint">La confirmación final se realiza una vez verificado el comprobante.</p></section> : <form onSubmit={submit}>
        <label>Nombre y apellido<input name="name" autoComplete="name" value={form.name} onChange={(event) => change('name', event.target.value)} required /></label>
        <div className="form-row"><label>Email<input name="email" type="email" autoComplete="email" spellCheck={false} value={form.email} onChange={(event) => change('email', event.target.value)} required /></label><label>Teléfono<input name="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => change('phone', event.target.value)} required /></label></div>
        <div className="form-row address-row"><label>Calle<input name="street" autoComplete="address-line1" value={form.street} onChange={(event) => change('street', event.target.value)} required /></label><label>Número<input name="street-number" inputMode="numeric" autoComplete="off" value={form.number} onChange={(event) => change('number', event.target.value)} required /></label><label>Piso / Depto<input name="apartment" autoComplete="address-line2" value={form.apartment} onChange={(event) => change('apartment', event.target.value)} /></label></div>
        <div className="form-row"><label>Ciudad<input name="city" autoComplete="address-level2" value={form.city} onChange={(event) => change('city', event.target.value)} required /></label><label>Provincia<input name="province" autoComplete="address-level1" value={form.province} onChange={(event) => change('province', event.target.value)} required /></label><label>Código postal / CPA<input name="postal-code" autoComplete="postal-code" spellCheck={false} value={form.postalCode} onChange={(event) => change('postalCode', event.target.value)} required /></label></div>
        <div className="shipping-calculator"><div><span>Envío a domicilio</span><small>Ingresá tu código postal para consultar el costo disponible.</small></div><button type="button" className="shipping-quote-button" onClick={quote} disabled={quoting || !form.postalCode || !lines.length}>{quoting ? 'Calculando…' : rates.length ? 'Recalcular' : 'Calcular envío'}</button></div>
        {rates.length > 0 && <fieldset className="shipping-rates"><legend>Opciones disponibles</legend>{rates.map((rate) => <label key={rate.id} className={shippingRateId === rate.id ? 'selected' : ''}><input type="radio" name="shipping" checked={shippingRateId === rate.id} onChange={() => setShippingRateId(rate.id)} /><span><strong>{rate.name}</strong><small>{rate.estimatedDays ?? 'Entrega a domicilio'}</small></span><b>{money(rate.price)}</b></label>)}</fieldset>}
        <fieldset className="payment-methods"><legend>Elegí cómo pagar</legend><label className={paymentMethod === 'mercado_pago' ? 'selected' : ''}><input type="radio" name="payment-method" checked={paymentMethod === 'mercado_pago'} onChange={() => setPaymentMethod('mercado_pago')} /><span><strong>Mercado Pago</strong><small>Te redirigimos para completar el pago de forma segura.</small></span><b>↗</b></label><label className={paymentMethod === 'bank_transfer' ? 'selected' : ''}><input type="radio" name="payment-method" checked={paymentMethod === 'bank_transfer'} onChange={() => setPaymentMethod('bank_transfer')} /><span><strong>Transferencia bancaria</strong><small>Al iniciar el pedido te mostramos el alias para transferir y enviar el comprobante.</small></span><b>→</b></label></fieldset>
        {!userId && <p className="checkout-hint">Podés comprar sin cuenta o <Link href="/cuenta">iniciar sesión</Link> para recuperar tus datos.</p>}
        <button className="button checkout-pay" disabled={busy || !lines.length || !shippingRateId}>{busy ? 'Preparando pedido…' : paymentMethod === 'mercado_pago' ? `Pagar con Mercado Pago · ${money(grandTotal)}` : `Iniciar transferencia · ${money(grandTotal)}`} <span>↗</span></button>
        {message && <p className="checkout-message" role="status">{message}</p>}
      </form>}
    </section>
    <aside className="order-summary"><p className="eyebrow">{transfer ? 'PEDIDO RESERVADO' : 'TU CARRITO'}</p>{lines.length ? lines.map((line) => <article key={line.variantId}><div><strong>{line.name}</strong><span>{line.color} · Talle {line.size} · Cant. {line.quantity}</span></div><div><b>{money(line.price * line.quantity)}</b><button onClick={() => remove(line.variantId)}>Quitar</button></div></article>) : <p>{transfer ? `Pedido ${transfer.orderNumber}` : 'Tu carrito está vacío.'}</p>}<div className="summary-line"><span>Productos</span><strong>{money(total)}</strong></div><div className="summary-line"><span>Envío</span><strong>{selectedRate ? money(selectedRate.price) : 'A calcular'}</strong></div><div className="order-total"><span>Total</span><strong>{transfer ? money(transfer.total) : money(grandTotal)}</strong></div><small>{paymentMethod === 'bank_transfer' ? 'La reserva por transferencia dura dos horas y se confirma al verificar el comprobante.' : 'Tu stock se reserva durante 30 minutos al continuar. El pago se procesa en Mercado Pago.'}</small></aside>
  </div></main>;
}
