import Link from 'next/link';
import { SiteNav } from '../components/SiteNav';
import { InstagramContact } from '../components/InstagramContact';

export default function Home() {
  return <main className="home-page">
    <SiteNav />
    <div className="home-story">
      <div className="home-story-visual" aria-hidden="true"><div className="home-island-motion"><img src="/santorini-island-clean.png" alt="" width="1024" height="1024" fetchPriority="high" /><span className="home-island-word">Santorini</span></div></div>
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
