-- Selling price in USD is independent from cost_usd and is used for operational visibility.
alter table public.product_variants
  add column if not exists price_usd numeric(12,2) check (price_usd >= 0);

-- The original workbook prices are expressed at ARS 1,550 per USD.
-- This one-time backfill preserves the source values for the initial catalog.
update public.product_variants
set price_usd = round(price_ars / 1550.0, 2)
where price_usd is null and price_ars > 0;

alter table public.import_variants
  add column if not exists price_usd numeric(12,2) check (price_usd >= 0);

-- Public delivery bucket; only staff users can write or remove its objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Staff can upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_staff()));

create policy "Staff can update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_staff()))
  with check (bucket_id = 'product-images' and (select public.is_staff()));

create policy "Staff can delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_staff()));

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  alt_text text,
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, sort_order)
);

alter table public.product_images enable row level security;

create policy "Public can read images of published products" on public.product_images
  for select using (exists (
    select 1 from public.products p
    where p.id = product_id and p.status = 'active' and p.web_status = 'published'
  ));

create policy "Staff manage product images" on public.product_images
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

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
    set name = excluded.name, category = excluded.category, brand = excluded.brand,
        status = excluded.status, web_status = excluded.web_status;
  get diagnostics products_written = row_count;

  insert into public.product_variants (product_id, sku, color, size, price_ars, price_usd, cost_usd)
  select distinct on (p.id, v.color, v.size) p.id, v.sku, v.color, v.size, v.price_ars,
         v.price_usd, v.cost_usd
  from public.import_variants v join public.products p on p.legacy_id = v.legacy_product_id
  order by p.id, v.color, v.size, v.sku
  on conflict (sku) do update set color = excluded.color, size = excluded.size,
    price_ars = excluded.price_ars, price_usd = excluded.price_usd, cost_usd = excluded.cost_usd;
  get diagnostics variants_written = row_count;

  insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, note, created_by)
  select v.id, l.id, 'initial_count', i.quantity_on_hand, 'Importación inicial desde staging', auth.uid()
  from public.import_inventory i join public.product_variants v on v.sku = i.sku
  join public.inventory_locations l on l.name = i.location_name
  where i.quantity_on_hand > 0 and not exists (
    select 1 from public.inventory_movements m where m.variant_id = v.id and m.location_id = l.id
      and m.note = 'Importación inicial desde staging'
  );
  get diagnostics stock_written = row_count;
  return jsonb_build_object('products_written', products_written, 'variants_written', variants_written, 'initial_stock_movements', stock_written);
end;
$$;
