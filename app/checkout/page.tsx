'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { SiteNav } from '../../components/SiteNav';
import { useCart } from '../../components/CartProvider';
import { money } from '../../lib/catalog';
import { createClient } from '../../lib/supabase/browser';

type CheckoutForm = { name: string; email: string; phone: string };
type PaymentMethod = 'bank_transfer' | 'cash';
type ManualOrder = { orderNumber: string; total: number; paymentMethod: PaymentMethod; pickup: string; transfer: { alias: string; accountHolder: string } | null; whatsappUrl: string };
const emptyForm: CheckoutForm = { name: '', email: '', phone: '' };

export default function CheckoutPage() {
  const { lines, total, remove, clear } = useCart();
  const [form, setForm] = useState(emptyForm);
  const [userId, setUserId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [order, setOrder] = useState<ManualOrder | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase.from('customer_profiles').select('full_name, phone').eq('id', user.id).maybeSingle();
      setForm({ name: profile?.full_name ?? '', email: user.email ?? '', phone: profile?.phone ?? '' });
    };
    load();
  }, []);

  const change = (key: keyof CheckoutForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!lines.length) { setMessage('Tu carrito está vacío.'); return; }
    setBusy(true); setMessage('Reservando tus prendas y preparando la coordinación…');
    try {
      const response = await fetch('/api/checkout/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: form, items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })), paymentMethod }) });
      const payload = await response.json() as ManualOrder & { message?: string };
      if (!response.ok || !payload.orderNumber) throw new Error(payload.message ?? 'No pudimos iniciar el pedido.');
      setOrder(payload); clear(); setMessage(''); setBusy(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No pudimos iniciar el pedido.'); setBusy(false); }
  };

  const transfer = order?.transfer;
  return <main className="checkout-page"><SiteNav /><div className="checkout-layout">
    <section className="checkout-form">{order ? <section className="manual-order-result" aria-live="polite"><p className="eyebrow">PEDIDO {order.orderNumber}</p><span className="result-mark">✓</span><h1>{order.paymentMethod === 'bank_transfer' ? 'Pedido<br />iniciado.' : 'Retiro<br />coordinado.'}</h1><p>{order.paymentMethod === 'bank_transfer' ? 'Transferí el total al alias indicado y enviá el comprobante. Confirmaremos el pago y coordinaremos tu retiro por WhatsApp.' : 'Coordiná por WhatsApp el pago en efectivo y el horario de retiro en Recoleta.'}</p><div className="pickup-confirmation"><strong>Retiro en persona · Recoleta</strong><span>La dirección y el horario se confirman por WhatsApp.</span></div>{transfer && <div className="transfer-alias"><span>ALIAS</span><strong>{transfer.alias}</strong>{transfer.accountHolder && <small>{transfer.accountHolder}</small>}<button type="button" onClick={() => { navigator.clipboard?.writeText(transfer.alias); setCopied(true); }}>{copied ? 'Alias copiado' : 'Copiar alias'}</button></div>}<a className="button transfer-whatsapp" href={order.whatsappUrl} target="_blank" rel="noreferrer">{order.paymentMethod === 'bank_transfer' ? 'Enviar comprobante por WhatsApp' : 'Coordinar por WhatsApp'} <span>↗</span></a><Link className="text-link" href="/tienda">Seguir recorriendo</Link></section> : <><p className="eyebrow">CHECKOUT · {userId ? 'CUENTA IDENTIFICADA' : 'COMPRA COMO INVITADO'}</p><h1>Retiro en<br />Recoleta.</h1><form onSubmit={submit}><label>Nombre y apellido<input name="name" autoComplete="name" value={form.name} onChange={(event) => change('name', event.target.value)} required /></label><div className="form-row"><label>Email<input name="email" type="email" autoComplete="email" spellCheck={false} value={form.email} onChange={(event) => change('email', event.target.value)} required /></label><label>Teléfono<input name="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => change('phone', event.target.value)} required /></label></div><fieldset className="pickup-method"><legend>Forma de entrega</legend><label className="selected"><input type="radio" checked readOnly /><span><strong>Retiro en persona · Recoleta</strong><small>Sin costo de envío. Una vez iniciado el pedido coordinamos el horario y la dirección exacta por WhatsApp.</small></span><b>✓</b></label></fieldset><fieldset className="payment-methods"><legend>Elegí cómo pagar</legend><label className={paymentMethod === 'bank_transfer' ? 'selected' : ''}><input type="radio" name="payment-method" checked={paymentMethod === 'bank_transfer'} onChange={() => setPaymentMethod('bank_transfer')} /><span><strong>Transferencia bancaria</strong><small>Te mostramos el alias al iniciar el pedido. Luego enviás el comprobante por WhatsApp.</small></span><b>→</b></label><label className={paymentMethod === 'cash' ? 'selected' : ''}><input type="radio" name="payment-method" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} /><span><strong>Pago en efectivo</strong><small>Coordinás el pago y el retiro en persona por WhatsApp.</small></span><b>→</b></label></fieldset>{!userId && <p className="checkout-hint">Podés comprar sin cuenta o <Link href="/cuenta">iniciar sesión</Link> para recuperar tus datos.</p>}<button className="button checkout-pay" disabled={busy || !lines.length}>{busy ? 'Preparando pedido…' : paymentMethod === 'bank_transfer' ? `Iniciar transferencia · ${money(total)}` : `Coordinar pago en efectivo · ${money(total)}`} <span>↗</span></button>{message && <p className="checkout-message" role="status">{message}</p>}</form></>}</section>
    <aside className="order-summary"><p className="eyebrow">{order ? 'PEDIDO INICIADO' : 'TU CARRITO'}</p>{order ? <><article><div><strong>{order.orderNumber}</strong><span>Retiro en persona · Recoleta</span></div><div><b>{money(order.total)}</b></div></article><div className="order-total"><span>Total</span><strong>{money(order.total)}</strong></div><small>El equipo confirmará el pago y la coordinación del retiro por WhatsApp.</small></> : <>{lines.length ? lines.map((line) => <article key={line.variantId}><div><strong>{line.name}</strong><span>{line.color} · Talle {line.size} · Cant. {line.quantity}</span></div><div><b>{money(line.price * line.quantity)}</b><button onClick={() => remove(line.variantId)}>Quitar</button></div></article>) : <p>Tu carrito está vacío.</p>}<div className="summary-line"><span>Productos</span><strong>{money(total)}</strong></div><div className="summary-line"><span>Retiro en Recoleta</span><strong>Sin cargo</strong></div><div className="order-total"><span>Total</span><strong>{money(total)}</strong></div><small>Las prendas quedan reservadas durante dos horas al iniciar el pedido.</small></>}</aside>
  </div></main>;
}
