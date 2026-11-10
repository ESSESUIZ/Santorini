-- Product management is restricted to administrators and uses soft deletion so
-- inventory, order and audit history remain intact.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.create_catalog_product(
  p_product jsonb,
  p_variant jsonb,
  p_initial_stock integer default 0,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_variant_id uuid;
  v_location_id uuid;
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede crear productos'; end if;
  if nullif(trim(p_product->>'name'), '') is null then raise exception 'El nombre es obligatorio'; end if;
  if nullif(trim(p_product->>'category'), '') is null then raise exception 'La categoría es obligatoria'; end if;
  if nullif(trim(p_variant->>'sku'), '') is null then raise exception 'El SKU es obligatorio'; end if;
  if nullif(trim(p_variant->>'color'), '') is null then raise exception 'El color es obligatorio'; end if;
  if nullif(trim(p_variant->>'size'), '') is null then raise exception 'El talle es obligatorio'; end if;
  if coalesce((p_variant->>'price_ars')::numeric, 0) < 0 then raise exception 'El precio no puede ser negativo'; end if;
  if p_initial_stock < 0 then raise exception 'El stock inicial no puede ser negativo'; end if;

  insert into public.products (name, category, brand, description, status, web_status)
  values (
    trim(p_product->>'name'), trim(p_product->>'category'), nullif(trim(p_product->>'brand'), ''),
    nullif(trim(p_product->>'description'), ''), coalesce(nullif(p_product->>'status', ''), 'active'),
    coalesce(nullif(p_product->>'web_status', ''), 'draft')
  ) returning id into v_product_id;

  insert into public.product_variants (
    product_id, sku, color, size, price_ars, price_usd, cost_usd,
    shipping_weight_g, shipping_length_cm, shipping_width_cm, shipping_height_cm
  ) values (
    v_product_id, upper(trim(p_variant->>'sku')), trim(p_variant->>'color'), trim(p_variant->>'size'),
    coalesce((p_variant->>'price_ars')::numeric, 0), nullif(p_variant->>'price_usd', '')::numeric,
    nullif(p_variant->>'cost_usd', '')::numeric, coalesce(nullif(p_variant->>'shipping_weight_g', '')::integer, 800),
    coalesce(nullif(p_variant->>'shipping_length_cm', '')::numeric, 35),
    coalesce(nullif(p_variant->>'shipping_width_cm', '')::numeric, 28),
    coalesce(nullif(p_variant->>'shipping_height_cm', '')::numeric, 8)
  ) returning id into v_variant_id;

  if p_initial_stock > 0 then
    v_location_id := p_location_id;
    if v_location_id is null then
      select id into v_location_id from public.inventory_locations where active order by name limit 1;
    end if;
    if v_location_id is null then raise exception 'No hay un depósito activo para registrar el stock inicial'; end if;
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, note, created_by)
    values (v_variant_id, v_location_id, 'initial_count', p_initial_stock, 'Alta de producto desde panel operativo', auth.uid());
  end if;

  return jsonb_build_object('product_id', v_product_id, 'variant_id', v_variant_id);
end;
$$;

create or replace function public.update_catalog_product(
  p_product_id uuid,
  p_variant_id uuid,
  p_product jsonb,
  p_variant jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede modificar productos'; end if;
  if nullif(trim(p_product->>'name'), '') is null then raise exception 'El nombre es obligatorio'; end if;
  if nullif(trim(p_variant->>'sku'), '') is null then raise exception 'El SKU es obligatorio'; end if;

  update public.products set
    name = trim(p_product->>'name'), category = trim(p_product->>'category'),
    brand = nullif(trim(p_product->>'brand'), ''), description = nullif(trim(p_product->>'description'), ''),
    status = coalesce(nullif(p_product->>'status', ''), status),
    web_status = coalesce(nullif(p_product->>'web_status', ''), web_status)
  where id = p_product_id;
  if not found then raise exception 'Producto inexistente'; end if;

  update public.product_variants set
    sku = upper(trim(p_variant->>'sku')), color = trim(p_variant->>'color'), size = trim(p_variant->>'size'),
    price_ars = coalesce((p_variant->>'price_ars')::numeric, 0),
    price_usd = nullif(p_variant->>'price_usd', '')::numeric,
    cost_usd = nullif(p_variant->>'cost_usd', '')::numeric,
    shipping_weight_g = coalesce(nullif(p_variant->>'shipping_weight_g', '')::integer, shipping_weight_g),
    shipping_length_cm = coalesce(nullif(p_variant->>'shipping_length_cm', '')::numeric, shipping_length_cm),
    shipping_width_cm = coalesce(nullif(p_variant->>'shipping_width_cm', '')::numeric, shipping_width_cm),
    shipping_height_cm = coalesce(nullif(p_variant->>'shipping_height_cm', '')::numeric, shipping_height_cm)
  where id = p_variant_id and product_id = p_product_id;
  if not found then raise exception 'Variante inexistente'; end if;
end;
$$;

create or replace function public.archive_catalog_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede dar de baja productos'; end if;
  update public.products set status = 'archived', web_status = 'draft' where id = p_product_id;
  if not found then raise exception 'Producto inexistente'; end if;
end;
$$;

revoke execute on function public.create_catalog_product(jsonb, jsonb, integer, uuid) from public;
revoke execute on function public.update_catalog_product(uuid, uuid, jsonb, jsonb) from public;
revoke execute on function public.archive_catalog_product(uuid) from public;
grant execute on function public.create_catalog_product(jsonb, jsonb, integer, uuid) to authenticated;
grant execute on function public.update_catalog_product(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.archive_catalog_product(uuid) to authenticated;
