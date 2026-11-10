'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { money } from '../lib/catalog';
import { createClient } from '../lib/supabase/browser';

type ProfileForm = { fullName: string; phone: string; street: string; number: string; apartment: string; city: string; province: string; postalCode: string };
type Order = { id: string; order_number: string; status: string; payment_status: string; total_ars: number; created_at: string };
const empty: ProfileForm = { fullName: '', phone: '', street: '', number: '', apartment: '', city: '', province: '', postalCode: '' };

export function AccountDashboard({ userId, email, onSignOut }: { userId: string; email: string; onSignOut: () => void }) {
  const [form, setForm] = useState(empty);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [{ data: profile }, { data: address }, { data: orderRows }] = await Promise.all([
        supabase.from('customer_profiles').select('full_name, phone').eq('id', userId).maybeSingle(),
        supabase.from('customer_addresses').select('*').eq('customer_id', userId).eq('is_default', true).maybeSingle(),
        supabase.from('orders').select('id, order_number, status, payment_status, total_ars, created_at').eq('customer_id', userId).order('created_at', { ascending: false }),
      ]);
      setForm({ fullName: profile?.full_name ?? '', phone: address?.phone ?? profile?.phone ?? '', street: address?.street ?? '', number: address?.street_number ?? '', apartment: address?.apartment ?? '', city: address?.city ?? '', province: address?.province ?? '', postalCode: address?.postal_code ?? '' });
      setOrders(orderRows ?? []);
    };
    load();
  }, [userId]);

  const change = (key: keyof ProfileForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault(); setMessage('Guardando…');
    const supabase = createClient();
    const { error: profileError } = await supabase.from('customer_profiles').update({ full_name: form.fullName, phone: form.phone, updated_at: new Date().toISOString() }).eq('id', userId);
    const { data: existing } = await supabase.from('customer_addresses').select('id').eq('customer_id', userId).eq('is_default', true).maybeSingle();
    const address = { customer_id: userId, label: 'Principal', recipient_name: form.fullName, phone: form.phone, street: form.street, street_number: form.number, apartment: form.apartment || null, city: form.city, province: form.province, postal_code: form.postalCode, is_default: true, updated_at: new Date().toISOString() };
    const { error: addressError } = existing ? await supabase.from('customer_addresses').update(address).eq('id', existing.id) : await supabase.from('customer_addresses').insert(address);
    setMessage(profileError || addressError ? 'No pudimos guardar todos los datos. Revisá la migración 008.' : 'Tus datos quedaron guardados.');
  };

  return <div className="account-dashboard">
    <div className="account-welcome"><div><p className="eyebrow">MI CUENTA</p><h1>Qué bueno<br />verte.</h1><p>{email}</p></div><div className="account-actions"><Link className="button" href="/tienda">Ir a la tienda <span>↗</span></Link><button className="text-button" onClick={onSignOut}>Cerrar sesión</button></div></div>
    <div className="account-columns"><form className="profile-form" onSubmit={save}><div><p className="eyebrow">DATOS Y ENTREGA</p><h2>Dirección principal</h2></div><label>Nombre y apellido<input value={form.fullName} onChange={(event) => change('fullName', event.target.value)} required /></label><label>Teléfono<input value={form.phone} onChange={(event) => change('phone', event.target.value)} /></label><div className="form-row"><label>Calle<input value={form.street} onChange={(event) => change('street', event.target.value)} required /></label><label>Número<input value={form.number} onChange={(event) => change('number', event.target.value)} required /></label></div><div className="form-row"><label>Ciudad<input value={form.city} onChange={(event) => change('city', event.target.value)} required /></label><label>Provincia<input value={form.province} onChange={(event) => change('province', event.target.value)} required /></label></div><div className="form-row"><label>Piso / Depto<input value={form.apartment} onChange={(event) => change('apartment', event.target.value)} /></label><label>Código postal<input value={form.postalCode} onChange={(event) => change('postalCode', event.target.value)} required /></label></div><button className="button">Guardar datos</button>{message && <p className="account-message" role="status">{message}</p>}</form>
      <section className="order-history"><p className="eyebrow">HISTORIAL</p><h2>Mis pedidos</h2>{orders.length ? orders.map((order) => <article key={order.id}><div><strong>{order.order_number}</strong><span>{new Intl.DateTimeFormat('es-AR').format(new Date(order.created_at))}</span></div><div><b>{money(Number(order.total_ars))}</b><span>{order.payment_status === 'paid' ? 'Pagado' : 'Pago pendiente'}</span></div></article>) : <div className="empty-orders"><p>Todavía no tenés pedidos asociados a esta cuenta.</p><Link href="/tienda">Explorar la colección</Link></div>}</section>
    </div>
  </div>;
}
