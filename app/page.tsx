import Link from 'next/link';
import { Brand } from '../components/Brand';

export default function Home() {
  return <main>
    <nav><Brand /><span><Link href="/tienda">Tienda</Link><Link href="/admin">Operación</Link></span></nav>
    <section className="hero">
      <div className="hero-mark"><img src="/santorini-mark.png" alt="" /></div>
      <p className="eyebrow hero-enter">URBAN ESSENTIALS · BUENOS AIRES</p>
      <h1>Vestirse es<br />marcar presencia.</h1>
      <p className="lead hero-enter">Colecciones seleccionadas. Stock real. Envíos a todo el país.</p>
      <div className="hero-actions"><Link className="button" href="/tienda">Ver colección <span>↗</span></Link><Link className="text-link" href="/admin">Gestionar operación</Link></div>
    </section>
    <section className="feature-grid">
      <article><p className="eyebrow">01</p><h2>Catálogo vivo</h2><p>Cada talle y color tiene su propio SKU y disponibilidad.</p></article>
      <article><p className="eyebrow">02</p><h2>Compra simple</h2><p>Checkout preparado para Mercado Pago, retiro o envío.</p></article>
      <article><p className="eyebrow">03</p><h2>Operación clara</h2><p>El equipo administra stock y ventas desde un único panel.</p></article>
    </section>
  </main>;
}
