'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { initialProducts, money, Product } from '../../lib/catalog';
import { Brand } from '../../components/Brand';

export default function Shop() {
  const [products] = useState(initialProducts);
  const [category, setCategory] = useState('Todo');
  const [cart, setCart] = useState<Product[]>([]);
  const visible = useMemo(() => category === 'Todo' ? products : products.filter((item) => item.category === category), [category, products]);
  const total = cart.reduce((sum, product) => sum + product.price, 0);
  return <main className="storefront">
    <nav><Brand /><span><Link href="/admin">Operación</Link><strong>Bolsa {cart.length}</strong></span></nav>
    <header className="catalog-head"><p className="eyebrow">CATÁLOGO · DROP 01</p><h1>Lo esencial,<br />sin ruido.</h1><p>Disponibilidad de muestra hasta completar el recuento físico.</p><img src="/santorini-mark.png" alt="" /></header>
    <div className="filters" aria-label="Filtrar categoría">{['Todo', 'Hoodies', 'Remeras', 'Abrigos', 'Calzado'].map((item) => <button className={category === item ? 'selected' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
    <section className="products">{visible.map((product, index) => <article className="product" key={product.id}>
      <div className={`product-image tone-${index % 4}`}><span>{product.category}</span><img src="/santorini-mark.png" alt="" /><b>{product.name.split(' ').slice(0, 2).join(' ')}</b></div>
      <div className="product-info"><div><h2>{product.name}</h2><p>{product.color} · Talle {product.size}</p></div><strong>{product.price ? money(product.price) : 'Precio a confirmar'}</strong></div>
      <button disabled={product.stock === 0 || product.price === 0} className="add" onClick={() => setCart([...cart, product])}>{product.stock > 0 ? 'Agregar a la bolsa' : 'Sin stock confirmado'}</button>
    </article>)}</section>
    <aside className="cart"><p className="eyebrow">TU BOLSA</p><strong>{cart.length ? money(total) : 'Todavía no agregaste productos'}</strong><button disabled={!cart.length} className="button">Ir al checkout</button></aside>
  </main>;
}
