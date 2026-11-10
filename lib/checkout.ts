import 'server-only';

import { createAdminClient } from './supabase/admin';
import type { PackageDimensions } from './shipping/correo-argentino';

type RequestedItem = { variantId: string; quantity: number };

export async function getPackageForItems(items: RequestedItem[]): Promise<PackageDimensions> {
  if (!items.length) throw new Error('El carrito está vacío.');
  const ids = [...new Set(items.map((item) => item.variantId))];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, shipping_weight_g, shipping_length_cm, shipping_width_cm, shipping_height_cm')
    .in('id', ids);

  if (error) throw error;
  if (!data || data.length !== ids.length) throw new Error('Hay un producto inválido en el carrito.');
  const byId = new Map(data.map((variant) => [variant.id, variant]));

  let weight = 0;
  let height = 0;
  let width = 0;
  let length = 0;
  for (const item of items) {
    const quantity = Math.max(1, Math.min(10, Math.trunc(item.quantity)));
    const variant = byId.get(item.variantId)!;
    weight += Number(variant.shipping_weight_g) * quantity;
    height += Number(variant.shipping_height_cm) * quantity;
    width = Math.max(width, Number(variant.shipping_width_cm));
    length = Math.max(length, Number(variant.shipping_length_cm));
  }

  return {
    weight: Math.max(1, Math.ceil(weight)),
    height: Math.max(1, Math.min(150, Math.ceil(height))),
    width: Math.max(1, Math.ceil(width)),
    length: Math.max(1, Math.ceil(length)),
  };
}
