'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initialProducts, money, moneyUsd, Product } from '../../lib/catalog';
import { Brand } from '../../components/Brand';
import { createClient } from '../../lib/supabase/browser';

type EditorValues = {
  name: string; category: string; brand: string; description: string;
  sku: string; color: string; size: string; priceArs: string; priceUsd: string; costUsd: string;
  status: 'active' | 'archived'; webStatus: 'draft' | 'published'; initialStock: string;
  shippingWeightG: string; shippingLengthCm: string; shippingWidthCm: string; shippingHeightCm: string;
};

const blankEditor: EditorValues = {
  name: '', category: '', brand: '', description: '', sku: '', color: '', size: '', priceArs: '', priceUsd: '', costUsd: '',
  status: 'active', webStatus: 'draft', initialStock: '0', shippingWeightG: '800', shippingLengthCm: '35', shippingWidthCm: '28', shippingHeightCm: '8',
};

function valuesFromProduct(product: Product): EditorValues {
  return {
    name: product.name, category: product.category, brand: product.brand ?? '', description: product.description ?? '', sku: product.id,
    color: product.color, size: product.size, priceArs: String(product.price), priceUsd: product.priceUsd == null ? '' : String(product.priceUsd),
    costUsd: product.costUsd == null ? '' : String(product.costUsd), status: product.status ?? 'active', webStatus: product.webStatus ?? 'draft', initialStock: '0',
    shippingWeightG: String(product.shippingWeightG ?? 800), shippingLengthCm: String(product.shippingLengthCm ?? 35),
    shippingWidthCm: String(product.shippingWidthCm ?? 28), shippingHeightCm: String(product.shippingHeightCm ?? 8),
  };
}

export default function Admin() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [editor, setEditor] = useState<EditorValues | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  const loadCatalog = useCallback(async () => {
    const supabase = createClient();
    const { data: locations } = await supabase.from('inventory_locations').select('id').eq('active', true).limit(1);
    const fullSelect = 'id, product_id, sku, color, size, price_ars, price_usd, cost_usd, shipping_weight_g, shipping_length_cm, shipping_width_cm, shipping_height_cm, products(name, category, brand, description, status, web_status)';
    let response: { data: any[] | null; error: any } = await supabase.from('product_variants').select(fullSelect).order('sku');
    if (response.error) response = await supabase.from('product_variants').select('id, product_id, sku, color, size, price_ars, price_usd, cost_usd, products(name, category, brand, description, status, web_status)').order('sku');
    if (response.error) response = await supabase.from('product_variants').select('id, product_id, sku, color, size, price_ars, products(name, category)').order('sku');
    const { data: variants, error } = response;
    const { data: movements } = await supabase.from('inventory_movements').select('variant_id, quantity');
    if (error || !variants?.length) return;
    const stock = new Map<string, number>();
    movements?.forEach((row) => stock.set(row.variant_id, (stock.get(row.variant_id) ?? 0) + row.quantity));
    setProducts(variants.map((row: any) => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      return {
        id: row.sku, productId: row.product_id, variantId: row.id, name: product?.name ?? row.sku, category: product?.category ?? 'Otros',
        brand: product?.brand ?? '', description: product?.description ?? '', color: row.color, size: row.size, price: Number(row.price_ars),
        priceUsd: row.price_usd == null ? undefined : Number(row.price_usd), costUsd: row.cost_usd == null ? undefined : Number(row.cost_usd),
        stock: stock.get(row.id) ?? 0, status: product?.status ?? 'active', webStatus: product?.web_status ?? 'draft',
        shippingWeightG: row.shipping_weight_g, shippingLengthCm: row.shipping_length_cm, shippingWidthCm: row.shipping_width_cm, shippingHeightCm: row.shipping_height_cm,
      } as Product;
    }));
    setLocationId(locations?.[0]?.id ?? null);
    setMode('live');
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/admin/login'); return; }
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!profile || profile.role !== 'admin') { router.replace('/'); return; }
        setAuthorized(true); await loadCatalog();
      } catch { router.replace('/admin/login'); }
    };
    load();
  }, [loadCatalog, router]);

  const filtered = useMemo(() => products.filter((item) => `${item.name} ${item.color} ${item.id}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const units = products.reduce((sum, product) => sum + product.stock, 0);

  if (!authorized) return <main className="admin-loading">Verificando acceso operativo…</main>;

  const setStock = async (id: string, changeAmount: number) => {
    const product = products.find((item) => item.id === id);
    if (!product || (changeAmount < 0 && product.stock <= 0)) return;
    if (mode === 'live' && product.variantId && locationId) {
      const { error } = await createClient().rpc('adjust_inventory', { p_variant_id: product.variantId, p_location_id: locationId, p_quantity: changeAmount, p_note: 'Ajuste desde backoffice' });
      if (error) { setNotice({ type: 'error', text: error.message }); return; }
    }
    setProducts((current) => current.map((item) => item.id === id ? { ...item, stock: Math.max(0, item.stock + changeAmount) } : item));
    setNotice({ type: 'success', text: `Stock de ${id} actualizado.` });
  };

  const openCreate = () => { setEditing(null); setEditor(blankEditor); setNotice(null); };
  const openEdit = (product: Product) => { setEditing(product); setEditor(valuesFromProduct(product)); setNotice(null); };
  const closeEditor = () => { if (!saving) { setEditor(null); setEditing(null); } };
  const change = (field: keyof EditorValues, value: string) => setEditor((current) => current ? { ...current, [field]: value } : current);

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setSaving(true); setNotice(null);
    const productPayload = { name: editor.name, category: editor.category, brand: editor.brand, description: editor.description, status: editor.status, web_status: editor.webStatus };
    const variantPayload = { sku: editor.sku, color: editor.color, size: editor.size, price_ars: editor.priceArs, price_usd: editor.priceUsd, cost_usd: editor.costUsd, shipping_weight_g: editor.shippingWeightG, shipping_length_cm: editor.shippingLengthCm, shipping_width_cm: editor.shippingWidthCm, shipping_height_cm: editor.shippingHeightCm };
    const supabase = createClient();
    const result = editing
      ? await supabase.rpc('update_catalog_product', { p_product_id: editing.productId, p_variant_id: editing.variantId, p_product: productPayload, p_variant: variantPayload })
      : await supabase.rpc('create_catalog_product', { p_product: productPayload, p_variant: variantPayload, p_initial_stock: Number(editor.initialStock || 0), p_location_id: locationId });
    setSaving(false);
    if (result.error) { setNotice({ type: 'error', text: result.error.message.includes('Could not find') ? 'Falta aplicar la migración 010 en Supabase.' : result.error.message }); return; }
    await loadCatalog(); setEditor(null); setEditing(null);
    setNotice({ type: 'success', text: editing ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.' });
  };

  const archiveProduct = async (product: Product) => {
    if (!product.productId || !window.confirm(`¿Dar de baja ${product.name}? Dejará de verse en la tienda, pero se conservará su historial.`)) return;
    const { error } = await createClient().rpc('archive_catalog_product', { p_product_id: product.productId });
    if (error) { setNotice({ type: 'error', text: error.message.includes('Could not find') ? 'Falta aplicar la migración 010 en Supabase.' : error.message }); return; }
    await loadCatalog(); setNotice({ type: 'success', text: `${product.id} fue dado de baja sin borrar su historial.` });
  };

  return <main className="admin">
    <nav><Brand /><span><Link href="/tienda">Ver tienda</Link><strong>Admin</strong></span></nav>
    <header className="admin-head"><div><p className="eyebrow">OPERACIÓN · {mode === 'live' ? 'SUPABASE CONECTADO' : 'MODO DEMO'}</p><h1>Catálogo e inventario</h1><p>Altas, modificaciones, bajas lógicas y stock desde un único panel.</p></div><button className="button" onClick={openCreate}>Nuevo producto <span>＋</span></button></header>
    {notice && <div className={`admin-notice ${notice.type}`} role="status">{notice.text}<button onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button></div>}
    <section className="metrics"><article><p>Variantes normalizadas</p><strong>{products.length}</strong></article><article><p>Stock contado</p><strong>{units}</strong></article><article><p>Valor visible</p><strong>{money(products.filter((item) => item.stock > 0).reduce((sum, item) => sum + item.price * item.stock, 0))}</strong></article><article><p>Productos publicados</p><strong>{products.filter((item) => item.status === 'active' && item.webStatus === 'published').length}</strong></article></section>
    <section className="inventory"><div className="inventory-head"><div><p className="eyebrow">CATÁLOGO OPERATIVO</p><h2>Productos y variantes</h2></div><input aria-label="Buscar producto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar SKU, producto o color" /></div>
      <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Producto</th><th>Color</th><th>Talle</th><th>ARS</th><th>USD</th><th>Stock</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id} className={product.status === 'archived' ? 'archived-row' : ''}><td><strong>{product.id}</strong></td><td>{product.name}</td><td>{product.color}</td><td>{product.size}</td><td>{money(product.price)}</td><td>{product.priceUsd == null ? '—' : moneyUsd(product.priceUsd)}</td><td><div className="stock-control"><button onClick={() => setStock(product.id, -1)} disabled={product.stock <= 0} aria-label={`Restar stock ${product.id}`}>−</button><output>{product.stock}</output><button onClick={() => setStock(product.id, 1)} aria-label={`Sumar stock ${product.id}`}>+</button></div></td><td><span className={product.status === 'active' && product.webStatus === 'published' ? 'pill live' : 'pill'}>{product.status === 'archived' ? 'Baja' : product.webStatus === 'published' ? 'Publicado' : 'Borrador'}</span></td><td><div className="row-actions"><button onClick={() => openEdit(product)}>Editar</button>{product.status !== 'archived' && <button className="danger-action" onClick={() => archiveProduct(product)}>Dar de baja</button>}</div></td></tr>)}</tbody></table></div>
    </section>
    {editor && <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}><section className="product-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <div className="editor-title"><div><p className="eyebrow">{editing ? `EDITAR · ${editing.id}` : 'ALTA DE PRODUCTO'}</p><h2 id="editor-title">{editing ? 'Modificar producto' : 'Nuevo producto'}</h2><p>{editing ? 'Los datos generales se comparten entre las variantes del producto.' : 'Completá los datos que recibirá la base normalizada.'}</p></div><button className="editor-close" onClick={closeEditor} aria-label="Cerrar">×</button></div>
      <form onSubmit={saveProduct}>
        <fieldset><legend>Información del producto</legend><div className="editor-grid"><label className="span-2">Nombre<input required value={editor.name} onChange={(e) => change('name', e.target.value)} /></label><label>Categoría<input required value={editor.category} onChange={(e) => change('category', e.target.value)} /></label><label>Marca<input value={editor.brand} onChange={(e) => change('brand', e.target.value)} /></label><label className="span-2">Descripción<textarea rows={4} value={editor.description} onChange={(e) => change('description', e.target.value)} /></label><label>Estado operativo<select value={editor.status} onChange={(e) => change('status', e.target.value)}><option value="active">Activo</option><option value="archived">Baja</option></select></label><label>Estado web<select value={editor.webStatus} onChange={(e) => change('webStatus', e.target.value)}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label></div></fieldset>
        <fieldset><legend>Variante y precio</legend><div className="editor-grid"><label>SKU<input required pattern="SAN-[0-9]{4}" placeholder="SAN-0059" value={editor.sku} onChange={(e) => change('sku', e.target.value.toUpperCase())} /></label><label>Color<input required value={editor.color} onChange={(e) => change('color', e.target.value)} /></label><label>Talle<input required value={editor.size} onChange={(e) => change('size', e.target.value)} /></label><label>Precio ARS<input required min="0" step="0.01" type="number" value={editor.priceArs} onChange={(e) => change('priceArs', e.target.value)} /></label><label>Precio USD<input min="0" step="0.01" type="number" value={editor.priceUsd} onChange={(e) => change('priceUsd', e.target.value)} /></label><label>Costo USD<input min="0" step="0.01" type="number" value={editor.costUsd} onChange={(e) => change('costUsd', e.target.value)} /></label>{!editing && <label>Stock inicial<input min="0" step="1" type="number" value={editor.initialStock} onChange={(e) => change('initialStock', e.target.value)} /></label>}</div></fieldset>
        <fieldset><legend>Datos para envío</legend><div className="editor-grid shipping-grid"><label>Peso (g)<input required min="1" type="number" value={editor.shippingWeightG} onChange={(e) => change('shippingWeightG', e.target.value)} /></label><label>Largo (cm)<input required min="1" step="0.1" type="number" value={editor.shippingLengthCm} onChange={(e) => change('shippingLengthCm', e.target.value)} /></label><label>Ancho (cm)<input required min="1" step="0.1" type="number" value={editor.shippingWidthCm} onChange={(e) => change('shippingWidthCm', e.target.value)} /></label><label>Alto (cm)<input required min="1" step="0.1" type="number" value={editor.shippingHeightCm} onChange={(e) => change('shippingHeightCm', e.target.value)} /></label></div></fieldset>
        <div className="editor-footer"><button type="button" className="secondary-button" onClick={closeEditor}>Cancelar</button><button className="button" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear producto'} <span>→</span></button></div>
      </form>
    </section></div>}
  </main>;
}
