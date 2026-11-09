create type public.staff_role as enum ('admin', 'sales', 'warehouse', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.staff_role not null default 'viewer',
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'sales', 'warehouse')
  );
$$;

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

create policy "Users read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "Staff read business data" on public.products
  for select to authenticated using ((select public.is_staff()));
create policy "Staff manage products" on public.products
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff read variants" on public.product_variants
  for select to authenticated using ((select public.is_staff()));
create policy "Staff manage variants" on public.product_variants
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff manage locations" on public.inventory_locations
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff read movements" on public.inventory_movements
  for select to authenticated using ((select public.is_staff()));
create policy "Staff manage orders" on public.orders
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff manage order items" on public.order_items
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create or replace function public.get_public_catalog()
returns table (
  variant_id uuid,
  sku text,
  name text,
  category text,
  color text,
  size text,
  price_ars numeric,
  available_stock integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id,
    v.sku,
    p.name,
    p.category,
    v.color,
    v.size,
    v.price_ars,
    coalesce(sum(m.quantity), 0)::integer as available_stock
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join public.inventory_movements m on m.variant_id = v.id
  where p.status = 'active' and p.web_status = 'published'
  group by v.id, v.sku, p.name, p.category, v.color, v.size, v.price_ars
  having coalesce(sum(m.quantity), 0) > 0
  order by p.category, p.name, v.color, v.size;
$$;

revoke execute on function public.get_public_catalog() from public;
grant execute on function public.get_public_catalog() to anon, authenticated;

create or replace function public.adjust_inventory(
  p_variant_id uuid,
  p_location_id uuid,
  p_quantity integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare movement_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Unauthorized inventory adjustment';
  end if;
  if p_quantity = 0 then
    raise exception 'Quantity cannot be zero';
  end if;
  insert into public.inventory_movements (
    variant_id, location_id, movement_type, quantity, note, created_by
  ) values (
    p_variant_id, p_location_id, 'initial_count', p_quantity, p_note, auth.uid()
  ) returning id into movement_id;
  return movement_id;
end;
$$;

revoke execute on function public.adjust_inventory(uuid, uuid, integer, text) from public, anon;
grant execute on function public.adjust_inventory(uuid, uuid, integer, text) to authenticated;

-- After creating the first Auth user, make that user an admin once in SQL Editor:
-- insert into public.profiles (id, role, display_name)
-- values ('AUTH_USER_UUID', 'admin', 'Nombre')
-- on conflict (id) do update set role = excluded.role, display_name = excluded.display_name;
