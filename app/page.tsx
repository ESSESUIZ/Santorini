import Link from 'next/link';
import { SiteNav } from '../components/SiteNav';
import { InstagramContact } from '../components/InstagramContact';

export default function Home() {
  return <main className="home-page">
    <SiteNav />
    <div className="home-story">
      <div className="home-story-visual" aria-hidden="true"><img src="/santorini-island-hero.png" alt="" width="720" height="720" fetchPriority="high" /></div>
      <section className="hero">
        <p className="eyebrow hero-enter">URBAN ESSENTIALS · BUENOS AIRES</p>
        <h1>Vestirse es<br />marcar presencia.</h1>
        <p className="lead hero-enter">Colecciones seleccionadas. Stock real. Envíos a todo el país.</p>
        <div className="hero-actions"><Link className="button" href="/tienda">Ver colección <span aria-hidden="true">↗</span></Link><Link className="text-link" href="/cuenta">Iniciar sesión</Link></div>
      </section>
      <InstagramContact continuous />
    </div>
  </main>;
}
