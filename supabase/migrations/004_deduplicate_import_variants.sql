create or replace function public.apply_catalog_import()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare products_written integer := 0;
declare variants_written integer := 0;
declare stock_written integer := 0;
begin
  if not public.is_staff() then raise exception 'Unauthorized import'; end if;
  insert into public.products (legacy_id, name, category, brand, status, web_status)
  select legacy_id, name, category, nullif(brand, ''), coalesce(status, 'active'), coalesce(web_status, 'draft')
  from public.import_products
  on conflict (legacy_id) where legacy_id is not null do update
    set name = excluded.name, category = excluded.category, brand = excluded.brand, status = excluded.status, web_status = excluded.web_status;
  get diagnostics products_written = row_count;
  insert into public.product_variants (product_id, sku, color, size, price_ars, cost_usd)
  select distinct on (p.id, v.color, v.size) p.id, v.sku, v.color, v.size, v.price_ars, v.cost_usd
  from public.import_variants v join public.products p on p.legacy_id = v.legacy_product_id
  order by p.id, v.color, v.size, v.sku
  on conflict (sku) do update set color = excluded.color, size = excluded.size, price_ars = excluded.price_ars, cost_usd = excluded.cost_usd;
  get diagnostics variants_written = row_count;
  insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, note, created_by)
  select v.id, l.id, 'initial_count', i.quantity_on_hand, 'Importación inicial desde staging', auth.uid()
  from public.import_inventory i join public.product_variants v on v.sku = i.sku join public.inventory_locations l on l.name = i.location_name
  where i.quantity_on_hand > 0 and not exists (select 1 from public.inventory_movements m where m.variant_id = v.id and m.location_id = l.id and m.note = 'Importación inicial desde staging');
  get diagnostics stock_written = row_count;
  return jsonb_build_object('products_written', products_written, 'variants_written', variants_written, 'initial_stock_movements', stock_written);
end;
$$;
