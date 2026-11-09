import { Product, initialProducts } from './catalog';
import { createClient } from './supabase/server';

type CatalogRow = { variant_id: string; sku: string; name: string; category: string; color: string; size: string; price_ars: number; available_stock: number };

export async function getPublicCatalog(): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_public_catalog');
    if (error || !data?.length) return initialProducts;
    return (data as CatalogRow[]).map((item) => ({ id: item.sku, variantId: item.variant_id, name: item.name, category: item.category, color: item.color, size: item.size, price: Number(item.price_ars), stock: item.available_stock }));
  } catch { return initialProducts; }
}
