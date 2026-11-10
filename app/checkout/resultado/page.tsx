'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SiteNav } from '../../../components/SiteNav';
import { useCart } from '../../../components/CartProvider';

export default function CheckoutResultPage() {
  const { clear } = useCart();
  const [result, setResult] = useState({ state: 'pending', order: '' });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('estado') ?? 'pending';
    const order = params.get('pedido') ?? '';
    setResult({ state, order });
    if (state === 'success') clear();
  }, [clear]);
  const success = result.state === 'success';
  const failure = result.state === 'failure';
  return <main className="checkout-result"><SiteNav /><section>
    <p className="eyebrow">PEDIDO {result.order || 'SANTORINI'}</p><span className="result-mark">{success ? '✓' : failure ? '×' : '···'}</span>
    <h1>{success ? 'Pago recibido.' : failure ? 'El pago no se completó.' : 'Pago en proceso.'}</h1>
    <p>{success ? 'Mercado Pago nos avisará de forma segura y actualizaremos tu pedido. Te enviaremos las novedades al email ingresado.' : failure ? 'Tus prendas se liberarán automáticamente. Podés volver a la bolsa e intentarlo nuevamente.' : 'Estamos esperando la confirmación de Mercado Pago. No hace falta que vuelvas a pagar.'}</p>
    <div><Link className="button" href={failure ? '/checkout' : '/tienda'}>{failure ? 'Volver al checkout' : 'Seguir recorriendo'} <span>↗</span></Link>{!failure && <Link href="/cuenta">Ver mi cuenta</Link>}</div>
  </section></main>;
}
