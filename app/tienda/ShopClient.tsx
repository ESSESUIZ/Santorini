'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SiteNav } from '../../components/SiteNav';
import { InstagramContact } from '../../components/InstagramContact';
import { money, Product } from '../../lib/catalog';

export default function ShopClient({ initialProducts }: { initialProducts: Product[] }) {
  const [category, setCategory] = useState('Todo');
  const [size, setSize] = useState('Todos');
  const [sort, setSort] = useState<'featured' | 'price-asc' | 'price-desc' | 'size'>('featured');
  const groups = useMemo(() => Array.from(initialProducts.reduce((map, item) => {
    const key = `${item.name}|${item.color}`;
    const existing = map.get(key) ?? [];
    existing.push(item); map.set(key, existing); return map;
  }, new Map<string, Product[]>()).values()), [initialProducts]);
  const sizes = useMemo(() => Array.from(new Set(initialProducts.map((item) => item.size))).sort((a, b) => sizeOrder(a) - sizeOrder(b) || a.localeCompare(b)), [initialProducts]);
  const visible = useMemo(() => groups
    .filter((items) => category === 'Todo' || items[0].category === category)
    .map((items) => size === 'Todos' ? items : items.filter((item) => item.size === size))
    .filter((items) => items.length > 0)
    .sort((left, right) => {
      if (sort === 'price-asc') return left[0].price - right[0].price;
      if (sort === 'price-desc') return right[0].price - left[0].price;
      if (sort === 'size') return sizeOrder(left[0].size) - sizeOrder(right[0].size) || left[0].size.localeCompare(right[0].size);
      return 0;
    }), [category, groups, size, sort]);
  return <main className="storefront">
    <SiteNav />
    <header className="catalog-head"><p className="eyebrow">CATÁLOGO · DROP 01</p><h1>Lo esencial,<br />sin ruido.</h1><img className="catalog-island" src="/santorini-mark.png" alt="" width="1024" height="1024" loading="eager" decoding="async" /></header>
    <div className="catalog-controls"><div className="filters" aria-label="Filtrar categoría">{['Todo', 'Hoodies', 'Remeras', 'Abrigos', 'Calzado'].map((item) => <button className={category === item ? 'selected' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><div className="catalog-selects"><label>Talle<select value={size} onChange={(event) => setSize(event.target.value)}><option value="Todos">Todos</option>{sizes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Ordenar<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="featured">Recomendados</option><option value="price-desc">Mayor precio</option><option value="price-asc">Menor precio</option><option value="size">Por talle</option></select></label></div></div>
    <section className="products">{visible.map((variants, index) => { const product = variants[0]; const inStock = variants.filter((item) => item.stock > 0); return <article className="product" key={`${product.name}-${product.color}`}>
      <Link href={`/producto/${product.id}`} className={`product-image tone-${index % 4}${product.imageUrl ? ' has-photo' : ''}`}><span>{product.category}</span><img src={product.imageUrl ?? '/santorini-mark.png'} alt={product.imageUrl ? `${product.name} en color ${product.color}` : ''} width="900" height="1125" loading="lazy" decoding="async" /><b>{product.name.split(' ').slice(0, 3).join(' ')}</b></Link>
      <div className="product-info"><div><h2>{product.name}</h2><p>{product.color} · {inStock.length} talles disponibles</p></div><strong>{product.price ? money(product.price) : 'Precio a confirmar'}</strong></div>
      <Link className="add product-link" href={`/producto/${product.id}`}>{inStock.length ? 'Ver producto' : 'Consultar disponibilidad'}</Link>
    </article>; })}{visible.length === 0 && <p className="catalog-empty">No encontramos productos con esos filtros.</p>}</section>
    <InstagramContact />
  </main>;
}

function sizeOrder(value: string) {
  const normalized = value.trim().toUpperCase();
  const common = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const commonIndex = common.indexOf(normalized);
  if (commonIndex >= 0) return commonIndex;
  const numeric = Number(normalized.replace(',', '.'));
  return Number.isFinite(numeric) ? 100 + numeric : 1_000;
}
