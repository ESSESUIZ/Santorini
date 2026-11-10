export function InstagramContact() {
  return <section className="instagram-contact" aria-labelledby="instagram-contact-title">
    <div className="instagram-contact-copy">
      <p className="eyebrow">CONTACTO DIRECTO · INSTAGRAM</p>
      <h2 id="instagram-contact-title">¿Buscás una<br /><em>pieza especial?</em></h2>
      <p>Consultá stock, medidas o disponibilidad directamente con el equipo de Santorini.</p>
      <a className="instagram-dm" href="https://ig.me/m/santorini_oficial1" target="_blank" rel="noreferrer">
        Escribir por Instagram <span aria-hidden="true">↗</span>
      </a>
      <a className="instagram-handle" href="https://www.instagram.com/santorini_oficial1/" target="_blank" rel="noreferrer">@santorini_oficial1</a>
    </div>
    <div className="instagram-contact-art" aria-hidden="true">
      <span>SANTORINI</span>
      <img src="/santorini-island-hero.png" alt="" width="720" height="720" loading="lazy" decoding="async" />
    </div>
  </section>;
}
