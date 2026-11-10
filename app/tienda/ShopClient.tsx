'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SiteNav } from '../../components/SiteNav';
import { money, Product } from '../../lib/catalog';

export default function ShopClient({ initialProducts }: { initialProducts: Product[] }) {
  const [category, setCategory] = useState('Todo');
  const groups = useMemo(() => Array.from(initialProducts.reduce((map, item) => {
    const key = `${item.name}|${item.color}`;
    const existing = map.get(key) ?? [];
    existing.push(item); map.set(key, existing); return map;
  }, new Map<string, Product[]>()).values()), [initialProducts]);
  const visible = useMemo(() => category === 'Todo' ? groups : groups.filter((items) => items[0].category === category), [category, groups]);
  return <main className="storefront">
    <SiteNav />
    <header className="catalog-head"><p className="eyebrow">CATÁLOGO · DROP 01</p><h1>Lo esencial,<br />sin ruido.</h1><p>{initialProducts.some((item) => item.variantId) ? 'Stock sincronizado con el inventario de Santorini.' : 'Disponibilidad de muestra hasta completar el recuento físico.'}</p><img src="/santorini-mark.png" alt="" /></header>
    <div className="filters" aria-label="Filtrar categoría">{['Todo', 'Hoodies', 'Remeras', 'Abrigos', 'Calzado'].map((item) => <button className={category === item ? 'selected' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
    <section className="products">{visible.map((variants, index) => { const product = variants[0]; const inStock = variants.filter((item) => item.stock > 0); return <article className="product" key={`${product.name}-${product.color}`}>
      <Link href={`/producto/${product.id}`} className={`product-image tone-${index % 4}${product.imageUrl ? ' has-photo' : ''}`}><span>{product.category}</span><img src={product.imageUrl ?? '/santorini-mark.png'} alt={product.imageUrl ? `${product.name} en color ${product.color}` : ''} /><b>{product.name.split(' ').slice(0, 3).join(' ')}</b></Link>
      <div className="product-info"><div><h2>{product.name}</h2><p>{product.color} · {inStock.length} talles disponibles</p></div><strong>{product.price ? money(product.price) : 'Precio a confirmar'}</strong></div>
      <Link className="add product-link" href={`/producto/${product.id}`}>{inStock.length ? 'Ver producto' : 'Consultar disponibilidad'}</Link>
    </article>; })}</section>
  </main>;
}
