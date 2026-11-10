'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { SiteNav } from '../../components/SiteNav';
import { useCart } from '../../components/CartProvider';
import { money } from '../../lib/catalog';
import { createClient } from '../../lib/supabase/browser';

type CheckoutForm = { name: string; email: string; phone: string; street: string; number: string; apartment: string; city: string; province: string; postalCode: string };
const emptyForm: CheckoutForm = { name: '', email: '', phone: '', street: '', number: '', apartment: '', city: '', province: '', postalCode: '' };

export default function CheckoutPage() {
  const { lines, total, remove, clear } = useCart();
  const [form, setForm] = useState(emptyForm);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

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

  const change = (key: keyof CheckoutForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!lines.length) return;
    setBusy(true); setMessage('Registrando tu pedido…');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_public_order', {
      p_customer: { name: form.name, email: form.email, phone: form.phone, address: { street: form.street, number: form.number, apartment: form.apartment, city: form.city, province: form.province, postal_code: form.postalCode } },
      p_items: lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
    });
    if (error) setMessage(`No pudimos registrar el pedido: ${error.message}`);
    else { setOrderNumber(data.order_number); setMessage('Pedido registrado. El pago online se habilitará en el próximo incremento.'); clear(); }
    setBusy(false);
  };

  return <main className="checkout-page"><SiteNav /><div className="checkout-layout">
    <section className="checkout-form"><p className="eyebrow">CHECKOUT · {userId ? 'CUENTA IDENTIFICADA' : 'COMPRA COMO INVITADO'}</p><h1>Datos de<br />entrega.</h1>
      {orderNumber ? <div className="checkout-success"><span>Pedido recibido</span><strong>{orderNumber}</strong><p>{message}</p><Link className="button" href="/tienda">Volver a la tienda</Link></div> : <form onSubmit={submit}>
        <label>Nombre y apellido<input value={form.name} onChange={(event) => change('name', event.target.value)} required /></label>
        <div className="form-row"><label>Email<input type="email" value={form.email} onChange={(event) => change('email', event.target.value)} required /></label><label>Teléfono<input type="tel" value={form.phone} onChange={(event) => change('phone', event.target.value)} required /></label></div>
        <div className="form-row address-row"><label>Calle<input value={form.street} onChange={(event) => change('street', event.target.value)} required /></label><label>Número<input value={form.number} onChange={(event) => change('number', event.target.value)} required /></label><label>Piso / Depto<input value={form.apartment} onChange={(event) => change('apartment', event.target.value)} /></label></div>
        <div className="form-row"><label>Ciudad<input value={form.city} onChange={(event) => change('city', event.target.value)} required /></label><label>Provincia<input value={form.province} onChange={(event) => change('province', event.target.value)} required /></label><label>Código postal<input value={form.postalCode} onChange={(event) => change('postalCode', event.target.value)} required /></label></div>
        {!userId && <p className="checkout-hint">Podés completar la compra sin cuenta o <Link href="/cuenta">iniciar sesión</Link> para recuperar tus datos.</p>}
        <button className="button" disabled={busy || !lines.length}>{busy ? 'Procesando…' : 'Confirmar datos del pedido'} <span>↗</span></button>{message && <p className="checkout-message" role="status">{message}</p>}
      </form>}
    </section>
    <aside className="order-summary"><p className="eyebrow">TU PEDIDO</p>{lines.length ? lines.map((line) => <article key={line.variantId}><div><strong>{line.name}</strong><span>{line.color} · Talle {line.size} · Cant. {line.quantity}</span></div><div><b>{money(line.price * line.quantity)}</b><button onClick={() => remove(line.variantId)}>Quitar</button></div></article>) : <p>Tu bolsa está vacía.</p>}<div className="order-total"><span>Total productos</span><strong>{money(total)}</strong></div><small>El costo de envío y el medio de pago se confirmarán en el siguiente paso.</small></aside>
  </div></main>;
}
