'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../../../components/CartProvider';
import { money } from '../../../lib/catalog';
import type { ProductDetail } from '../../../lib/catalog-server';

export default function ProductDetailClient({ product }: { product: ProductDetail }) {
  const available = product.variants.filter((variant) => variant.stock > 0);
  const [selectedId, setSelectedId] = useState((available[0] ?? product.variants[0])?.variantId ?? '');
  const [guideOpen, setGuideOpen] = useState(false);
  const [feedback, setFeedback] = useState<'added' | 'limit' | null>(null);
  const { add, lines, syncStock } = useCart();
  const selected = useMemo(() => product.variants.find((variant) => variant.variantId === selectedId) ?? product.variants[0], [product.variants, selectedId]);
  const quantityInCart = selected?.variantId ? lines.find((line) => line.variantId === selected.variantId)?.quantity ?? 0 : 0;
  const stockLimitReached = Boolean(selected && selected.stock > 0 && quantityInCart >= selected.stock);
  const guideIsPdf = product.sizeGuideMimeType === 'application/pdf' || product.sizeGuideUrl?.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    product.variants.forEach((variant) => variant.variantId && syncStock(variant.variantId, variant.stock));
  }, [product.variants, syncStock]);

  const addSelected = () => {
    if (!selected?.variantId || selected.stock < 1 || stockLimitReached) {
      setFeedback('limit'); return;
    }
    add({ variantId: selected.variantId, sku: selected.id, name: product.name, color: selected.color, size: selected.size, price: selected.price, maxQuantity: selected.stock });
    setFeedback('added'); window.setTimeout(() => setFeedback(null), 2200);
  };

  return <>
    <div className="product-breadcrumb"><Link href="/tienda">Tienda</Link><span>/</span><span>{product.category}</span><span>/</span><strong>{product.name}</strong></div>
    <section className="product-detail">
      <div className={`product-gallery product-gallery-stack${product.images.length === 1 ? ' single-image' : ''}`}>
        {product.images.length ? product.images.map((image, index) => <img key={image} src={image} alt={`${product.name} en ${product.color}${product.images.length > 1 ? `, vista ${index + 1}` : ''}`} width="1200" height="1500" loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async" />) : <div className="product-placeholder"><img src="/santorini-island-hero.png" alt="" width="760" height="760" /><span>IMÁGENES PRÓXIMAMENTE</span></div>}
      </div>
      <div className="product-purchase">
        <p className="eyebrow">{product.brand}</p>
        <h1>{product.name}</h1>
        <p className="product-color">{product.color}</p>
        <strong className="product-price">{selected?.price ? money(selected.price) : 'Precio a confirmar'}</strong>
        <p className="product-description">{product.description}</p>
        <div className="size-heading"><strong>Talle</strong><button onClick={() => setGuideOpen(true)}>Guía de talles</button></div>
        <div className="size-options">{product.variants.map((variant) => <button key={variant.variantId ?? variant.id} disabled={variant.stock < 1} className={selectedId === variant.variantId ? 'selected' : ''} onClick={() => setSelectedId(variant.variantId ?? '')}>{variant.size}</button>)}</div>
        <p className="product-stock" aria-live="polite">{selected?.stock ? `${selected.stock} ${selected.stock === 1 ? 'unidad disponible' : 'unidades disponibles'}${quantityInCart ? ` · ${quantityInCart} en tu carrito` : ''}` : 'Sin stock disponible'}</p>
        <button className="button product-add" disabled={!selected || selected.stock < 1 || !selected.price || stockLimitReached} onClick={addSelected}>{stockLimitReached ? `Máximo disponible en carrito (${selected?.stock})` : feedback === 'added' ? 'Agregado al carrito ✓' : selected?.stock ? 'Agregar al carrito' : 'Sin stock disponible'}<span aria-hidden="true">↗</span></button>
        <ul className="product-benefits"><li>Stock sincronizado con el inventario.</li><li>Envíos a todo el país.</li><li>Cambios sujetos a disponibilidad.</li><li>Selección Santorini verificada.</li></ul>
        <details><summary>Envíos</summary><p>Calcularemos el costo y plazo según tu código postal durante el checkout.</p></details>
        <details><summary>Cambios y devoluciones</summary><p>La prenda debe conservar etiquetas y condiciones originales. El plazo se informará al confirmar la compra.</p></details>
      </div>
    </section>
    {guideOpen && <div className="size-modal" role="dialog" aria-modal="true" aria-labelledby="size-title"><div><button className="modal-close" aria-label="Cerrar guía" onClick={() => setGuideOpen(false)}>×</button><p className="eyebrow">{product.name.toUpperCase()}</p><h2 id="size-title">Guía de talles</h2>{product.sizeGuideUrl ? <div className={`size-guide-file${guideIsPdf ? ' is-document' : ''}`}>{guideIsPdf ? <iframe src={`${product.sizeGuideUrl}#view=FitH`} title={`Guía de talles de ${product.name}`} /> : <img src={product.sizeGuideUrl} alt={`Guía de talles de ${product.name}`} width="1200" height="1600" />}{guideIsPdf && <a href={product.sizeGuideUrl} target="_blank" rel="noreferrer">Abrir documento{product.sizeGuideFileName ? ` · ${product.sizeGuideFileName}` : ''} ↗</a>}</div> : <div className="size-guide-empty"><strong>Guía específica en preparación.</strong><p>Escribinos por Instagram y te ayudamos con las medidas de esta pieza.</p><a className="text-link" href="https://ig.me/m/santorini_oficial1" target="_blank" rel="noreferrer">Consultar por Instagram</a></div>}</div></div>}
  </>;
}
