'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brand } from '../../../components/Brand';
import { money } from '../../../lib/catalog';
import { createClient } from '../../../lib/supabase/browser';

type OrderItem = {
  sku: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  unitPriceArs: number;
};

type AdminOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: 'draft' | 'confirmed' | 'cancelled' | 'fulfilled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentProvider: 'mercado_pago' | 'bank_transfer' | 'cash';
  totalArs: number;
  shippingCostArs: number;
  shippingService: string | null;
  customer: { name?: string; email?: string; phone?: string };
  items: OrderItem[];
};

const paymentNames = {
  mercado_pago: 'Mercado Pago',
  bank_transfer: 'Transferencia',
  cash: 'Efectivo',
} as const;

const paymentStates = {
  pending: 'Pendiente',
  paid: 'Pagado',
  refunded: 'Reintegrado',
} as const;

const orderStates = {
  draft: 'En preparación',
  confirmed: 'Confirmado',
  fulfilled: 'Completado',
  cancelled: 'Cancelado',
} as const;

export default function AdminOrdersPage() {
  const [authorized, setAuthorized] = useState(false);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'cancelled'>('all');
  const router = useRouter();

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await createClient().rpc('get_admin_orders');

    if (error) {
      setNotice({
        type: 'error',
        text: error.message.includes('Could not find')
          ? 'Falta aplicar la migración 012 en Supabase.'
          : error.message,
      });
      setLoading(false);
      return;
    }

    setOrders(Array.isArray(data) ? (data as AdminOrder[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const verify = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace('/admin/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          router.replace('/');
          return;
        }

        setAuthorized(true);
        await loadOrders();
      } catch {
        router.replace('/admin/login');
      }
    };

    verify();
  }, [loadOrders, router]);

  const updateOrder = async (order: AdminOrder, action: 'manual' | 'fulfill' | 'cancel') => {
    if (action === 'manual' && !window.confirm(`¿Confirmar que recibiste el pago del pedido ${order.orderNumber}?`)) return;
    if (action === 'cancel' && !window.confirm(`¿Cancelar ${order.orderNumber}? Se liberará el stock reservado.`)) return;

    setWorkingId(order.id);
    setNotice(null);

    if (action === 'manual') {
      const response = await fetch('/api/admin/orders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const result = (await response.json()) as {
        message?: string;
        email?: 'sent' | 'not_configured' | 'failed';
      };

      if (!response.ok) {
        setNotice({ type: 'error', text: result.message ?? 'No pudimos confirmar el pago.' });
      } else {
        const emailMessage = result.email === 'sent'
          ? ' Se envió el email al cliente.'
          : result.email === 'not_configured'
            ? ' El pago quedó confirmado; falta configurar el email transaccional.'
            : ' El pago quedó confirmado, pero el email no pudo enviarse.';
        setNotice({ type: 'success', text: `Pago de ${order.orderNumber} confirmado.${emailMessage}` });
        await loadOrders();
      }
    } else {
      const functionName = action === 'cancel' ? 'cancel_pending_order' : 'fulfill_paid_order';
      const { error } = await createClient().rpc(functionName, { p_order_id: order.id });

      if (error) {
        setNotice({
          type: 'error',
          text: error.message.includes('Could not find')
            ? 'Falta aplicar la migración 014 en Supabase.'
            : error.message,
        });
      } else {
        setNotice({
          type: 'success',
          text: action === 'cancel'
            ? `${order.orderNumber} fue cancelado y el stock se liberó.`
            : `${order.orderNumber} marcado como completado.`,
        });
        await loadOrders();
      }
    }

    setWorkingId(null);
  };

  const visibleOrders = useMemo(
    () => orders.filter((order) => filter === 'all' || (
      filter === 'cancelled'
        ? order.status === 'cancelled'
        : order.paymentStatus === filter
    )),
    [filter, orders],
  );
  const pendingPayments = orders.filter((order) => (
    ['bank_transfer', 'cash'].includes(order.paymentProvider)
    && order.paymentStatus === 'pending'
    && order.status !== 'cancelled'
  )).length;
  const paidTotal = orders
    .filter((order) => order.paymentStatus === 'paid')
    .reduce((sum, order) => sum + Number(order.totalArs), 0);
  const cancelledCount = orders.filter((order) => order.status === 'cancelled').length;

  if (!authorized) return <main className="admin-loading">Verificando acceso operativo…</main>;

  return (
    <main className="admin orders-admin">
      <nav>
        <Brand />
        <span>
          <Link href="/admin">Inventario</Link>
          <strong>Pedidos</strong>
          <Link href="/tienda">Ver tienda</Link>
        </span>
      </nav>

      <header className="admin-head orders-head">
        <div>
          <p className="eyebrow">OPERACIÓN · PEDIDOS</p>
          <h1>Ventas en<br />movimiento.</h1>
          <p>Pagos, detalle de prendas y preparación de cada compra desde un solo lugar.</p>
        </div>
        <button className="secondary-button" type="button" onClick={loadOrders} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar pedidos'}
        </button>
      </header>

      {notice && (
        <div className={`admin-notice ${notice.type}`} role="status">
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button>
        </div>
      )}

      <section className="metrics order-metrics">
        <article><p>Pedidos recibidos</p><strong>{orders.length}</strong></article>
        <article><p>Pagos a revisar</p><strong>{pendingPayments}</strong></article>
        <article><p>Ventas cobradas</p><strong>{money(paidTotal)}</strong></article>
        <article><p>Cancelados</p><strong>{cancelledCount}</strong></article>
      </section>

      <section className="orders-board">
        <div className="orders-board-head">
          <div>
            <p className="eyebrow">LISTADO OPERATIVO</p>
            <h2>Pedidos recientes</h2>
          </div>
          <div className="order-filters" aria-label="Filtrar pedidos">
            <button className={filter === 'all' ? 'selected' : ''} type="button" onClick={() => setFilter('all')}>Todos</button>
            <button className={filter === 'pending' ? 'selected' : ''} type="button" onClick={() => setFilter('pending')}>Pendientes</button>
            <button className={filter === 'paid' ? 'selected' : ''} type="button" onClick={() => setFilter('paid')}>Pagados</button>
            <button className={filter === 'cancelled' ? 'selected' : ''} type="button" onClick={() => setFilter('cancelled')}>Cancelados</button>
          </div>
        </div>

        {loading ? (
          <p className="orders-empty">Cargando pedidos…</p>
        ) : visibleOrders.length ? (
          <div className="order-list">
            {visibleOrders.map((order) => {
              const cancelled = order.status === 'cancelled';
              const statusClass = cancelled ? 'cancelled' : order.paymentStatus;
              const statusLabel = cancelled ? 'Cancelado' : paymentStates[order.paymentStatus];

              return (
                <details className="order-card" key={order.id}>
                  <summary>
                    <div>
                      <span className="order-number">{order.orderNumber}</span>
                      <strong>{order.customer.name || 'Cliente sin nombre'}</strong>
                      <small>{new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}</small>
                    </div>
                    <div className="order-summary-status">
                      <span className={`order-pill ${statusClass}`}>{statusLabel}</span>
                      <b>{money(Number(order.totalArs))}</b>
                      <span className="order-expand">+</span>
                    </div>
                  </summary>

                  <div className="order-card-body">
                    <div className="order-detail-grid">
                      <section>
                        <p className="eyebrow">CLIENTE</p>
                        <strong>{order.customer.name}</strong>
                        {order.customer.email && <a href={`mailto:${order.customer.email}`}>{order.customer.email}</a>}
                        {order.customer.phone && <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a>}
                      </section>
                      <section>
                        <p className="eyebrow">RETIRO</p>
                        <strong>{order.shippingService || 'A coordinar'}</strong>
                        <span>La dirección y horario se coordinan por WhatsApp.</span>
                        <small>{money(Number(order.shippingCostArs || 0))}</small>
                      </section>
                      <section>
                        <p className="eyebrow">PAGO</p>
                        <strong>{paymentNames[order.paymentProvider] ?? order.paymentProvider}</strong>
                        <span>{paymentStates[order.paymentStatus]}</span>
                        <small>{orderStates[order.status]}</small>
                      </section>
                    </div>

                    <section className="order-items">
                      <p className="eyebrow">DETALLE DEL PEDIDO</p>
                      {order.items.map((item) => (
                        <div key={`${item.sku}-${item.size}`}>
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.sku} · {item.color} · Talle {item.size} · x{item.quantity}</small>
                          </span>
                          <b>{money(Number(item.unitPriceArs) * item.quantity)}</b>
                        </div>
                      ))}
                    </section>

                    <div className="order-card-footer">
                      <div>
                        <span>Total del pedido</span>
                        <strong>{money(Number(order.totalArs))}</strong>
                      </div>
                      <div className="order-actions">
                        {!cancelled && ['bank_transfer', 'cash'].includes(order.paymentProvider) && order.paymentStatus === 'pending' && (
                          <button className="button" type="button" onClick={() => updateOrder(order, 'manual')} disabled={workingId === order.id}>
                            {workingId === order.id ? 'Confirmando…' : 'Confirmar pago'} <span>✓</span>
                          </button>
                        )}
                        {!cancelled && order.paymentStatus === 'paid' && order.status === 'confirmed' && (
                          <button className="button" type="button" onClick={() => updateOrder(order, 'fulfill')} disabled={workingId === order.id}>
                            {workingId === order.id ? 'Actualizando…' : 'Marcar como completado'} <span>✓</span>
                          </button>
                        )}
                        {!cancelled && order.paymentStatus === 'pending' && (
                          <button className="secondary-button danger-action" type="button" onClick={() => updateOrder(order, 'cancel')} disabled={workingId === order.id}>
                            {workingId === order.id ? 'Cancelando…' : 'Cancelar pedido'} <span>×</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <p className="orders-empty">No hay pedidos para este filtro.</p>
        )}
      </section>
    </main>
  );
}
