'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brand } from '../../../components/Brand';
import { money } from '../../../lib/catalog';
import { createClient } from '../../../lib/supabase/browser';

type OrderItem = { sku: string; name: string; color: string; size: string; quantity: number; unitPriceArs: number };
type AdminOrder = {
  id: string; orderNumber: string; createdAt: string; status: 'draft' | 'confirmed' | 'cancelled' | 'fulfilled'; paymentStatus: 'pending' | 'paid' | 'refunded'; paymentProvider: 'mercado_pago' | 'bank_transfer'; totalArs: number; shippingCostArs: number; shippingService: string | null;
  shippingAddress: { street?: string; number?: string; apartment?: string; city?: string; province?: string; postal_code?: string } | null;
  customer: { name?: string; email?: string; phone?: string }; items: OrderItem[];
};

const paymentNames = { mercado_pago: 'Mercado Pago', bank_transfer: 'Transferencia' } as const;
const paymentStates = { pending: 'Pendiente', paid: 'Pagado', refunded: 'Reintegrado' } as const;
const orderStates = { draft: 'En preparación', confirmed: 'Confirmado', fulfilled: 'Completado', cancelled: 'Cancelado' } as const;

function formatAddress(address: AdminOrder['shippingAddress']) {
  if (!address) return 'Dirección no disponible';
  return [address.street && `${address.street}${address.number ? ` ${address.number}` : ''}`, address.apartment, address.city, address.province, address.postal_code].filter(Boolean).join(' · ');
}

export default function AdminOrdersPage() {
  const [authorized, setAuthorized] = useState(false);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const router = useRouter();

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await createClient().rpc('get_admin_orders');
    if (error) { setNotice({ type: 'error', text: error.message.includes('Could not find') ? 'Falta aplicar la migración 012 en Supabase.' : error.message }); setLoading(false); return; }
    setOrders(Array.isArray(data) ? data as AdminOrder[] : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const verify = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/admin/login'); return; }
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!profile || profile.role !== 'admin') { router.replace('/'); return; }
        setAuthorized(true); await loadOrders();
      } catch { router.replace('/admin/login'); }
    };
    verify();
  }, [loadOrders, router]);

  const updateOrder = async (order: AdminOrder, action: 'transfer' | 'fulfill') => {
    if (action === 'transfer' && !window.confirm(`¿Confirmar que recibiste la transferencia del pedido ${order.orderNumber}?`)) return;
    setWorkingId(order.id); setNotice(null);
    const functionName = action === 'transfer' ? 'confirm_bank_transfer_order' : 'fulfill_paid_order';
    const { error } = await createClient().rpc(functionName, { p_order_id: order.id });
    if (error) setNotice({ type: 'error', text: error.message });
    else { setNotice({ type: 'success', text: action === 'transfer' ? `Transferencia de ${order.orderNumber} confirmada.` : `${order.orderNumber} marcado como completado.` }); await loadOrders(); }
    setWorkingId(null);
  };

  const visibleOrders = useMemo(() => orders.filter((order) => filter === 'all' || order.paymentStatus === filter), [filter, orders]);
  const pendingTransfers = orders.filter((order) => order.paymentProvider === 'bank_transfer' && order.paymentStatus === 'pending').length;
  const paidTotal = orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + Number(order.totalArs), 0);
  if (!authorized) return <main className="admin-loading">Verificando acceso operativo…</main>;

  return <main className="admin orders-admin"><nav><Brand /><span><Link href="/admin">Inventario</Link><strong>Pedidos</strong><Link href="/tienda">Ver tienda</Link></span></nav>
    <header className="admin-head orders-head"><div><p className="eyebrow">OPERACIÓN · PEDIDOS</p><h1>Ventas en<br />movimiento.</h1><p>Pagos, detalle de prendas y preparación de cada compra desde un solo lugar.</p></div><button className="secondary-button" onClick={loadOrders} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar pedidos'}</button></header>
    {notice && <div className={`admin-notice ${notice.type}`} role="status">{notice.text}<button onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button></div>}
    <section className="metrics order-metrics"><article><p>Pedidos recibidos</p><strong>{orders.length}</strong></article><article><p>Transferencias a revisar</p><strong>{pendingTransfers}</strong></article><article><p>Ventas cobradas</p><strong>{money(paidTotal)}</strong></article></section>
    <section className="orders-board"><div className="orders-board-head"><div><p className="eyebrow">LISTADO OPERATIVO</p><h2>Pedidos recientes</h2></div><div className="order-filters" aria-label="Filtrar pedidos"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Todos</button><button className={filter === 'pending' ? 'selected' : ''} onClick={() => setFilter('pending')}>Pendientes</button><button className={filter === 'paid' ? 'selected' : ''} onClick={() => setFilter('paid')}>Pagados</button></div></div>
      {loading ? <p className="orders-empty">Cargando pedidos…</p> : visibleOrders.length ? <div className="order-list">{visibleOrders.map((order) => <details className="order-card" key={order.id}><summary><div><span className="order-number">{order.orderNumber}</span><strong>{order.customer.name || 'Cliente sin nombre'}</strong><small>{new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}</small></div><div className="order-summary-status"><span className={`order-pill ${order.paymentStatus}`}>{paymentStates[order.paymentStatus]}</span><b>{money(Number(order.totalArs))}</b><span className="order-expand">+</span></div></summary><div className="order-card-body"><div className="order-detail-grid"><section><p className="eyebrow">CLIENTE</p><strong>{order.customer.name}</strong><a href={`mailto:${order.customer.email}`}>{order.customer.email}</a><a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a></section><section><p className="eyebrow">ENVÍO</p><strong>{order.shippingService || 'A coordinar'}</strong><span>{formatAddress(order.shippingAddress)}</span><small>{money(Number(order.shippingCostArs || 0))}</small></section><section><p className="eyebrow">PAGO</p><strong>{paymentNames[order.paymentProvider] ?? order.paymentProvider}</strong><span>{paymentStates[order.paymentStatus]}</span><small>{orderStates[order.status]}</small></section></div><section className="order-items"><p className="eyebrow">DETALLE DEL PEDIDO</p>{order.items.map((item) => <div key={`${item.sku}-${item.size}`}><span><strong>{item.name}</strong><small>{item.sku} · {item.color} · Talle {item.size} · x{item.quantity}</small></span><b>{money(Number(item.unitPriceArs) * item.quantity)}</b></div>)}</section><div className="order-card-footer"><div><span>Total del pedido</span><strong>{money(Number(order.totalArs))}</strong></div>{order.paymentProvider === 'bank_transfer' && order.paymentStatus === 'pending' && <button className="button" onClick={() => updateOrder(order, 'transfer')} disabled={workingId === order.id}>{workingId === order.id ? 'Confirmando…' : 'Confirmar transferencia'} <span>✓</span></button>}{order.paymentStatus === 'paid' && order.status === 'confirmed' && <button className="button" onClick={() => updateOrder(order, 'fulfill')} disabled={workingId === order.id}>{workingId === order.id ? 'Actualizando…' : 'Marcar como completado'} <span>✓</span></button>}</div></div></details>)}</div> : <p className="orders-empty">No hay pedidos para este filtro.</p>}
    </section>
  </main>;
}
