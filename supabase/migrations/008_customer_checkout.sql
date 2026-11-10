create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Principal',
  recipient_name text not null,
  phone text,
  street text not null,
  street_number text not null,
  apartment text,
  city text not null,
  province text not null,
  postal_code text not null,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Images can be attached to the variant SKU so galleries remain color-specific.
alter table public.product_images add column if not exists variant_id uuid references public.product_variants(id) on delete cascade;
alter table public.product_images drop constraint if exists product_images_product_id_sort_order_key;
create unique index if not exists product_images_variant_sort_unique
  on public.product_images (variant_id, sort_order) where variant_id is not null;
create unique index if not exists product_images_product_default_sort_unique
  on public.product_images (product_id, sort_order) where variant_id is null;

alter table public.customer_addresses enable row level security;

create policy "Customers manage own addresses" on public.customer_addresses
  for all to authenticated
  using ((select auth.uid()) = customer_id)
  with check ((select auth.uid()) = customer_id);

alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists shipping_address jsonb;

create policy "Customers read own orders" on public.orders
  for select to authenticated using ((select auth.uid()) = customer_id);

create policy "Customers read own order items" on public.order_items
  for select to authenticated using (exists (
    select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())
  ));

create or replace function public.create_public_order(p_customer jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_variant public.product_variants%rowtype;
  v_quantity integer;
  v_stock integer;
begin
  if coalesce(p_customer ->> 'email', '') = '' then raise exception 'Email is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Order has no items'; end if;

  v_order_number := 'SAN-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  insert into public.orders (order_number, customer_id, channel, status, payment_status, total_ars, customer_email, customer_name, customer_phone, shipping_address)
  values (v_order_number, auth.uid(), 'online', 'draft', 'pending', 0, lower(p_customer ->> 'email'), p_customer ->> 'name', p_customer ->> 'phone', p_customer -> 'address')
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(1, least(10, coalesce((v_item ->> 'quantity')::integer, 1)));
    select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
    if not found then raise exception 'Invalid product variant'; end if;
    select coalesce(sum(quantity), 0)::integer into v_stock from public.inventory_movements where variant_id = v_variant.id;
    if v_stock < v_quantity then raise exception 'Insufficient stock for %', v_variant.sku; end if;
    insert into public.order_items (order_id, variant_id, quantity, unit_price_ars)
    values (v_order_id, v_variant.id, v_quantity, v_variant.price_ars);
    v_total := v_total + (v_variant.price_ars * v_quantity);
  end loop;

  update public.orders set total_ars = v_total where id = v_order_id;
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'total_ars', v_total, 'payment_status', 'pending');
exception when others then
  if v_order_id is not null then delete from public.orders where id = v_order_id; end if;
  raise;
end;
$$;

revoke execute on function public.create_public_order(jsonb, jsonb) from public;
grant execute on function public.create_public_order(jsonb, jsonb) to anon, authenticated;
