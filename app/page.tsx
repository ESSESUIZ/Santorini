import Link from 'next/link';
import { SiteNav } from '../components/SiteNav';

export default function Home() {
  return <main>
    <SiteNav />
    <section className="hero">
      <img className="hero-island" src="/santorini-island-hero.png" alt="Isla Santorini" />
      <div className="hero-mark"><img src="/santorini-mark.png" alt="" /></div>
      <p className="eyebrow hero-enter">URBAN ESSENTIALS · BUENOS AIRES</p>
      <h1>Vestirse es<br />marcar presencia.</h1>
      <p className="lead hero-enter">Colecciones seleccionadas. Stock real. Envíos a todo el país.</p>
      <div className="hero-actions"><Link className="button" href="/tienda">Ver colección <span>↗</span></Link><Link className="text-link" href="/cuenta">Iniciar sesión</Link></div>
    </section>
  </main>;
}
