import { Product, initialProducts } from './catalog';
import { createClient } from './supabase/server';

type CatalogRow = { variant_id: string; sku: string; name: string; category: string; color: string; size: string; price_ars: number; available_stock: number };

export type ProductDetail = {
  productId?: string;
  name: string;
  category: string;
  brand: string;
  description: string;
  color: string;
  images: string[];
  sizeGuideUrl?: string;
  sizeGuideMimeType?: string;
  sizeGuideFileName?: string;
  variants: Product[];
};

export async function getPublicCatalog(): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_public_catalog');
    if (error || !data?.length) return initialProducts;
    const rows = data as CatalogRow[];
    const { data: images } = await supabase.from('product_images').select('variant_id, storage_path').in('variant_id', rows.map((item) => item.variant_id)).order('sort_order');
    const imageByVariant = new Map<string, string>();
    images?.forEach((image) => {
      if (image.variant_id && !imageByVariant.has(image.variant_id)) imageByVariant.set(image.variant_id, supabase.storage.from('product-images').getPublicUrl(image.storage_path).data.publicUrl);
    });
    return rows.map((item) => ({ id: item.sku, variantId: item.variant_id, name: item.name, category: item.category, color: item.color, size: item.size, price: Number(item.price_ars), stock: item.available_stock, imageUrl: imageByVariant.get(item.variant_id) }));
  } catch { return initialProducts; }
}

export async function getProductBySku(sku: string): Promise<ProductDetail | null> {
  try {
    const supabase = await createClient();
    const { data: selected, error } = await supabase.from('product_variants')
      .select('id, product_id, sku, color, size, price_ars, products!inner(name, category, brand, description)')
      .eq('sku', sku).single();
    if (error || !selected) throw error;
    const product = Array.isArray(selected.products) ? selected.products[0] : selected.products;
    const { data: variants } = await supabase.from('product_variants')
      .select('id, sku, color, size, price_ars')
      .eq('product_id', selected.product_id).eq('color', selected.color).order('size');
    const { data: publicCatalog } = await supabase.rpc('get_public_catalog');
    const stock = new Map<string, number>((publicCatalog ?? []).map((row: CatalogRow) => [row.variant_id, row.available_stock]));
    const imageQuery = supabase.from('product_images').select('storage_path').eq('product_id', selected.product_id).order('sort_order');
    const { data: imageRows } = await imageQuery.or(`variant_id.is.null,variant_id.eq.${selected.id}`);
    const images = Array.from(new Set((imageRows ?? []).map((row) => supabase.storage.from('product-images').getPublicUrl(row.storage_path).data.publicUrl)));
    const { data: sizeGuide } = await supabase
      .from('products')
      .select('size_guide_storage_path, size_guide_mime_type, size_guide_file_name')
      .eq('id', selected.product_id)
      .maybeSingle();
    const sizeGuideUrl = sizeGuide?.size_guide_storage_path
      ? supabase.storage.from('product-size-guides').getPublicUrl(sizeGuide.size_guide_storage_path).data.publicUrl
      : undefined;
    return {
      productId: selected.product_id,
      name: product?.name ?? sku,
      category: product?.category ?? 'Otros',
      brand: product?.brand ?? 'Santorini Selection',
      description: product?.description ?? 'Una pieza seleccionada por Santorini por su diseño, materialidad y presencia urbana.',
      color: selected.color,
      images,
      sizeGuideUrl,
      sizeGuideMimeType: sizeGuide?.size_guide_mime_type ?? undefined,
      sizeGuideFileName: sizeGuide?.size_guide_file_name ?? undefined,
      variants: (variants ?? []).map((variant) => ({ id: variant.sku, variantId: variant.id, name: product?.name ?? sku, category: product?.category ?? 'Otros', color: variant.color, size: variant.size, price: Number(variant.price_ars), stock: stock.get(variant.id) ?? 0 })),
    };
  } catch {
    const selected = initialProducts.find((item) => item.id === sku);
    if (!selected) return null;
    return { name: selected.name, category: selected.category, brand: 'Santorini Selection', description: 'Una pieza seleccionada por Santorini por su diseño, materialidad y presencia urbana.', color: selected.color, images: [], variants: initialProducts.filter((item) => item.name === selected.name && item.color === selected.color) };
  }
}
