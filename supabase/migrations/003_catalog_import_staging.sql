alter table public.products add column if not exists legacy_id text;
create unique index if not exists products_legacy_id_unique on public.products(legacy_id) where legacy_id is not null;

create table public.import_products (
  legacy_id text primary key,
  name text not null,
  category text not null,
  brand text,
  status text default 'active',
  web_status text default 'draft'
);

create table public.import_variants (
  sku text primary key,
  legacy_product_id text not null,
  color text not null,
  size text not null,
  price_ars numeric(12,2) not null,
  cost_usd numeric(12,2)
);

create table public.import_inventory (
  sku text primary key,
  location_name text not null,
  quantity_on_hand integer not null check (quantity_on_hand >= 0)
);

alter table public.import_products enable row level security;
alter table public.import_variants enable row level security;
alter table public.import_inventory enable row level security;

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

  insert into public.product_variants (product_id, sku, color, size, price_ars, cost_usd)
  select p.id, v.sku, v.color, v.size, v.price_ars, v.cost_usd
  from public.import_variants v
  join public.products p on p.legacy_id = v.legacy_product_id
  on conflict (sku) do update set color = excluded.color, size = excluded.size,
    price_ars = excluded.price_ars, cost_usd = excluded.cost_usd;
  get diagnostics variants_written = row_count;

  insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, note, created_by)
  select v.id, l.id, 'initial_count', i.quantity_on_hand, 'Importación inicial desde staging', auth.uid()
  from public.import_inventory i
  join public.product_variants v on v.sku = i.sku
  join public.inventory_locations l on l.name = i.location_name
  where i.quantity_on_hand > 0
    and not exists (
      select 1 from public.inventory_movements m
      where m.variant_id = v.id and m.location_id = l.id
        and m.note = 'Importación inicial desde staging'
    );
  get diagnostics stock_written = row_count;

  return jsonb_build_object('products_written', products_written, 'variants_written', variants_written, 'initial_stock_movements', stock_written);
end;
$$;

revoke all on table public.import_products, public.import_variants, public.import_inventory from anon, authenticated;
revoke execute on function public.apply_catalog_import() from public, anon;
grant execute on function public.apply_catalog_import() to authenticated;
