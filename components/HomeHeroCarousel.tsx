'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';

const slides = [
  { id: 'santorini', label: 'Identidad Santorini', kind: 'brand' as const },
  {
    id: 'nba',
    label: 'Essentials Fear of God x NBA',
    kind: 'campaign' as const,
    src: '/essentials-nba-promo.png',
    alt: 'Conjunto gris Essentials Fear of God x NBA sobre fondo de estudio',
    mobileTitle: 'Essentials x NBA',
    mobileCopy: 'Una selección pensada para vestir todos los días.',
  },
  {
    id: 'season-25',
    label: 'Temporada 25 Essentials',
    kind: 'campaign' as const,
    src: '/essentials-season-25.png',
    alt: 'Conjunto beige Essentials de la campaña Temporada 25',
    mobileTitle: 'Temporada 25',
    mobileCopy: 'Nuevos esenciales. La misma presencia.',
  },
];

const slideMotion = {
  enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? '7%' : '-7%' }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? '-5%' : '5%' }),
};

export function HomeHeroCarousel() {
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [[active, direction], setActive] = useState([0, 1]);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const reduceMotion = mounted && Boolean(prefersReducedMotion);

  useEffect(() => setMounted(true), []);

  const goTo = useCallback((next: number, forcedDirection?: number) => {
    const normalized = (next + slides.length) % slides.length;
    setActive(([current]) => [normalized, forcedDirection ?? (normalized > current ? 1 : -1)]);
  }, []);

  const advance = useCallback((step: number) => {
    setActive(([current]) => [(current + step + slides.length) % slides.length, step]);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (reduceMotion || interactionPaused || userPaused || pageHidden) return;
    const timer = window.setInterval(() => advance(1), 6500);
    return () => window.clearInterval(timer);
  }, [advance, interactionPaused, pageHidden, reduceMotion, userPaused]);

  const slide = slides[active];
  const transition = reduceMotion
    ? { duration: 0.18 }
    : { type: 'spring' as const, stiffness: 230, damping: 30, mass: 0.9 };

  return <section
    className="home-carousel"
    role="region"
    aria-roledescription="carrusel"
    aria-label="Campañas destacadas de Santorini"
    onMouseEnter={() => setInteractionPaused(true)}
    onMouseLeave={() => setInteractionPaused(false)}
    onFocusCapture={() => setInteractionPaused(true)}
    onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false);
    }}
    onKeyDown={(event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); advance(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); advance(1); }
    }}
  >
    <p className="sr-only" aria-live="polite">Diapositiva {active + 1} de {slides.length}: {slide.label}</p>
    <div className="home-carousel-viewport">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.article
          className={`home-carousel-slide ${slide.kind === 'brand' ? 'home-carousel-brand' : 'home-carousel-campaign'}`}
          key={slide.id}
          custom={direction}
          variants={slideMotion}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
          drag={reduceMotion ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            if (info.offset.x < -70 || info.velocity.x < -520) advance(1);
            if (info.offset.x > 70 || info.velocity.x > 520) advance(-1);
          }}
        >
          {slide.kind === 'brand' ? <>
            <div className="home-carousel-brand-copy">
              <p className="eyebrow">URBAN ESSENTIALS · BUENOS AIRES</p>
              <h1>Vestirse es<br />marcar presencia.</h1>
              <p className="lead">Colecciones seleccionadas. Stock real. Envíos a todo el país.</p>
              <div className="hero-actions">
                <Link className="button" href="/tienda">Ver colección <span aria-hidden="true">↗</span></Link>
                <Link className="text-link" href="/cuenta">Iniciar sesión</Link>
              </div>
            </div>
            <div className="home-carousel-brand-visual" aria-hidden="true">
              <motion.div
                className="home-carousel-island"
                animate={reduceMotion ? undefined : { y: [0, -13, -5, 0], rotate: [-0.7, 0.65, 0.15, -0.7] }}
                transition={{ duration: 6.8, ease: 'easeInOut', repeat: Infinity }}
              >
                <Image src="/santorini-island-clean.png" alt="" width={1024} height={1024} priority sizes="(max-width: 850px) 82vw, 46vw" />
                <span>Santorini</span>
              </motion.div>
            </div>
          </> : <>
            <Image className="home-campaign-image" src={slide.src} alt={slide.alt} fill priority={active === 1} sizes="100vw" />
            <div className="home-campaign-mobile-copy">
              <span>{slide.id === 'nba' ? 'Drop NBA' : 'Nueva colección'}</span>
              <h2>{slide.mobileTitle}</h2>
              <p>{slide.mobileCopy}</p>
              <Link className="button" href="/tienda">Ver colección <span aria-hidden="true">↗</span></Link>
            </div>
          </>}
        </motion.article>
      </AnimatePresence>
    </div>

    <div className="home-carousel-controls" aria-label="Controles del carrusel">
      <button type="button" className="home-carousel-arrow" onClick={() => advance(-1)} aria-label="Ver campaña anterior">←</button>
      <div className="home-carousel-dots">
        {slides.map((item, index) => <button
          type="button"
          key={item.id}
          className={index === active ? 'is-active' : ''}
          aria-current={index === active ? 'true' : undefined}
          aria-label={`Ir a la diapositiva ${index + 1}: ${item.label}`}
          onClick={() => goTo(index)}
        ><span /></button>)}
      </div>
      <button type="button" className="home-carousel-arrow" onClick={() => advance(1)} aria-label="Ver campaña siguiente">→</button>
      {!reduceMotion && <button
        type="button"
        className="home-carousel-pause"
        onClick={() => setUserPaused((value) => !value)}
        aria-label={userPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
      ><span className="home-carousel-pause-icon" aria-hidden="true">{userPaused ? '▶' : 'Ⅱ'}</span><span className="home-carousel-pause-label">{userPaused ? 'Reanudar' : 'Pausar'}</span></button>}
    </div>
  </section>;
}
