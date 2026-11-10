'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initialProducts, money } from '../../lib/catalog';
import { Brand } from '../../components/Brand';
import { createClient } from '../../lib/supabase/browser';

export default function Admin() {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/admin/login'); return; }
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!profile || !['admin', 'sales', 'warehouse'].includes(profile.role)) { await supabase.auth.signOut(); router.replace('/admin/login'); return; }
        setAuthorized(true);
        const { data: locations } = await supabase.from('inventory_locations').select('id').eq('active', true).limit(1);
        const { data: variants, error } = await supabase.from('product_variants').select('id, sku, color, size, price_ars, products(name, category)');
        const { data: movements } = await supabase.from('inventory_movements').select('variant_id, quantity');
        if (error || !variants?.length || !locations?.[0]) return;
        const stock = new Map<string, number>();
        movements?.forEach((row) => stock.set(row.variant_id, (stock.get(row.variant_id) ?? 0) + row.quantity));
        setProducts(variants.map((row) => {
          const product = Array.isArray(row.products) ? row.products[0] : row.products;
          return { id: row.sku, variantId: row.id, name: product?.name ?? row.sku, category: product?.category ?? 'Otros', color: row.color, size: row.size, price: Number(row.price_ars), stock: stock.get(row.id) ?? 0 };
        }));
        setLocationId(locations[0].id); setMode('live');
      } catch { router.replace('/admin/login'); }
    };
    load();
  }, []);
  if (!authorized) return <main className="admin-loading">Verificando acceso operativo…</main>;
  const filtered = useMemo(() => products.filter((item) => `${item.name} ${item.color} ${item.id}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const setStock = async (id: string, change: number) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    if (mode === 'live' && product.variantId && locationId) {
      const { error } = await createClient().rpc('adjust_inventory', { p_variant_id: product.variantId, p_location_id: locationId, p_quantity: change, p_note: 'Ajuste desde backoffice' });
      if (error) return;
    }
    setProducts(products.map((item) => item.id === id ? { ...item, stock: Math.max(0, item.stock + change) } : item));
  };
  const units = products.reduce((sum, product) => sum + product.stock, 0);
  return <main className="admin">
    <nav><Brand /><span><Link href="/tienda">Ver tienda</Link><strong>Admin</strong></span></nav>
    <header className="admin-head"><div><p className="eyebrow">OPERACIÓN · {mode === 'live' ? 'SUPABASE CONECTADO' : 'MODO DEMO'}</p><h1>Inventario y ventas</h1><p>{mode === 'live' ? 'Los ajustes quedan registrados como movimientos de inventario.' : 'Iniciá sesión con un usuario de equipo para operar sobre Supabase.'}</p></div><Link className="button" href="/admin/login">Acceso equipo</Link></header>
    <section className="metrics"><article><p>Variantes normalizadas</p><strong>63</strong></article><article><p>Stock contado</p><strong>{units}</strong></article><article><p>Valor visible</p><strong>{money(products.filter((item) => item.stock > 0).reduce((sum, item) => sum + item.price * item.stock, 0))}</strong></article><article><p>Estado migración</p><strong>Recuento</strong></article></section>
    <section className="inventory"><div className="inventory-head"><div><p className="eyebrow">INVENTARIO</p><h2>Conteo inicial por variante</h2></div><input aria-label="Buscar producto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar SKU, producto o color" /></div>
      <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Producto</th><th>Color</th><th>Talle</th><th>Precio</th><th>Stock físico</th><th>Estado web</th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td>{product.id}</td><td>{product.name}</td><td>{product.color}</td><td>{product.size}</td><td>{money(product.price)}</td><td><div className="stock-control"><button onClick={() => setStock(product.id, -1)} aria-label={`Restar stock ${product.id}`}>−</button><output>{product.stock}</output><button onClick={() => setStock(product.id, 1)} aria-label={`Sumar stock ${product.id}`}>+</button></div></td><td><span className={product.stock ? 'pill live' : 'pill'}>{product.stock ? 'Publicable' : 'Borrador'}</span></td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
