'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { initialProducts, money } from '../../lib/catalog';
import { Brand } from '../../components/Brand';

export default function Admin() {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => products.filter((item) => `${item.name} ${item.color} ${item.id}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const setStock = (id: string, amount: number) => setProducts(products.map((product) => product.id === id ? { ...product, stock: Math.max(0, amount) } : product));
  const units = products.reduce((sum, product) => sum + product.stock, 0);
  return <main className="admin">
    <nav><Brand /><span><Link href="/tienda">Ver tienda</Link><strong>Admin</strong></span></nav>
    <header className="admin-head"><div><p className="eyebrow">OPERACIÓN</p><h1>Inventario y ventas</h1><p>Panel local de MVP. La conexión con Supabase se activa al configurar las credenciales.</p></div><button className="button">Nueva venta</button></header>
    <section className="metrics"><article><p>Variantes normalizadas</p><strong>63</strong></article><article><p>Stock contado</p><strong>{units}</strong></article><article><p>Valor visible</p><strong>{money(products.filter((item) => item.stock > 0).reduce((sum, item) => sum + item.price * item.stock, 0))}</strong></article><article><p>Estado migración</p><strong>Recuento</strong></article></section>
    <section className="inventory"><div className="inventory-head"><div><p className="eyebrow">INVENTARIO</p><h2>Conteo inicial por variante</h2></div><input aria-label="Buscar producto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar SKU, producto o color" /></div>
      <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Producto</th><th>Color</th><th>Talle</th><th>Precio</th><th>Stock físico</th><th>Estado web</th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td>{product.id}</td><td>{product.name}</td><td>{product.color}</td><td>{product.size}</td><td>{money(product.price)}</td><td><div className="stock-control"><button onClick={() => setStock(product.id, product.stock - 1)} aria-label={`Restar stock ${product.id}`}>−</button><output>{product.stock}</output><button onClick={() => setStock(product.id, product.stock + 1)} aria-label={`Sumar stock ${product.id}`}>+</button></div></td><td><span className={product.stock ? 'pill live' : 'pill'}>{product.stock ? 'Publicable' : 'Borrador'}</span></td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
