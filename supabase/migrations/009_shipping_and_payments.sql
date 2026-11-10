-- Physical package defaults are editable per SKU. Values are conservative for folded apparel.
alter table public.product_variants add column if not exists shipping_weight_g integer not null default 800 check (shipping_weight_g > 0);
alter table public.product_variants add column if not exists shipping_length_cm numeric(8,2) not null default 35 check (shipping_length_cm > 0);
alter table public.product_variants add column if not exists shipping_width_cm numeric(8,2) not null default 28 check (shipping_width_cm > 0);
alter table public.product_variants add column if not exists shipping_height_cm numeric(8,2) not null default 8 check (shipping_height_cm > 0);

alter table public.orders add column if not exists shipping_provider text;
alter table public.orders add column if not exists shipping_service text;
alter table public.orders add column if not exists shipping_cost_ars numeric(12,2) not null default 0 check (shipping_cost_ars >= 0);
alter table public.orders add column if not exists shipping_postal_code text;
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists payment_preference_id text;
alter table public.orders add column if not exists payment_id text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists reservation_expires_at timestamptz;
create unique index if not exists orders_payment_id_unique on public.orders(payment_id) where payment_id is not null;

create or replace function public.release_checkout_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_location_id uuid;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.payment_status = 'paid' then return false; end if;
  if exists (select 1 from public.inventory_movements where reference_type = 'order_release' and reference_id = p_order_id) then return false; end if;

  select id into v_location_id from public.inventory_locations where active limit 1;
  for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id loop
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, reference_type, reference_id, note)
    values (v_item.variant_id, v_location_id, 'release', v_item.quantity, 'order_release', p_order_id, 'Liberación de reserva de checkout');
  end loop;
  update public.orders set status = 'cancelled' where id = p_order_id;
  return true;
end;
$$;

create or replace function public.release_expired_checkout_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  for v_order in
    select id from public.orders
    where status = 'draft' and payment_status = 'pending' and reservation_expires_at < now()
    for update skip locked
  loop
    if public.release_checkout_order(v_order.id) then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;

create or replace function public.create_checkout_order(
  p_customer jsonb,
  p_items jsonb,
  p_shipping jsonb,
  p_customer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_items_total numeric(12,2) := 0;
  v_shipping_cost numeric(12,2);
  v_item jsonb;
  v_variant public.product_variants%rowtype;
  v_quantity integer;
  v_stock integer;
  v_location_id uuid;
begin
  perform public.release_expired_checkout_reservations();
  if coalesce(p_customer ->> 'email', '') = '' then raise exception 'Email is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Order has no items'; end if;
  v_shipping_cost := coalesce((p_shipping ->> 'cost')::numeric, -1);
  if v_shipping_cost < 0 then raise exception 'Invalid shipping cost'; end if;
  select id into v_location_id from public.inventory_locations where active limit 1;
  if v_location_id is null then raise exception 'No active inventory location'; end if;

  v_order_number := 'SAN-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  insert into public.orders (
    order_number, customer_id, channel, status, payment_status, total_ars,
    customer_email, customer_name, customer_phone, shipping_address,
    shipping_provider, shipping_service, shipping_cost_ars, shipping_postal_code,
    payment_provider, reservation_expires_at
  ) values (
    v_order_number, p_customer_id, 'online', 'draft', 'pending', 0,
    lower(p_customer ->> 'email'), p_customer ->> 'name', p_customer ->> 'phone', p_customer -> 'address',
    'correo_argentino', p_shipping ->> 'service', v_shipping_cost, p_shipping ->> 'postal_code',
    'mercado_pago', now() + interval '30 minutes'
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := greatest(1, least(10, coalesce((v_item ->> 'quantity')::integer, 1)));
    select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
    if not found then raise exception 'Invalid product variant'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_variant.id::text, 0));
    select coalesce(sum(quantity), 0)::integer into v_stock from public.inventory_movements where variant_id = v_variant.id;
    if v_stock < v_quantity then raise exception 'Insufficient stock for %', v_variant.sku; end if;
    insert into public.order_items (order_id, variant_id, quantity, unit_price_ars)
    values (v_order_id, v_variant.id, v_quantity, v_variant.price_ars);
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, reference_type, reference_id, note)
    values (v_variant.id, v_location_id, 'reservation', -v_quantity, 'order_reservation', v_order_id, 'Reserva temporal de checkout');
    v_items_total := v_items_total + (v_variant.price_ars * v_quantity);
  end loop;

  update public.orders set total_ars = v_items_total + v_shipping_cost where id = v_order_id;
  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'items_total_ars', v_items_total,
    'shipping_cost_ars', v_shipping_cost,
    'total_ars', v_items_total + v_shipping_cost
  );
end;
$$;

create or replace function public.confirm_paid_order(p_order_id uuid, p_payment_id text, p_amount numeric)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_location_id uuid;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status = 'paid' then return v_order.payment_id = p_payment_id; end if;
  if v_order.status = 'cancelled' then raise exception 'Order reservation was released'; end if;
  if round(v_order.total_ars, 2) <> round(p_amount, 2) then raise exception 'Payment amount mismatch'; end if;

  select id into v_location_id from public.inventory_locations where active limit 1;
  for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id loop
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, reference_type, reference_id, note)
    values (v_item.variant_id, v_location_id, 'release', v_item.quantity, 'payment_conversion', p_order_id, 'Conversión de reserva a venta');
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, reference_type, reference_id, note)
    values (v_item.variant_id, v_location_id, 'sale', -v_item.quantity, 'order_sale', p_order_id, 'Venta online confirmada');
  end loop;
  update public.orders set status = 'confirmed', payment_status = 'paid', payment_id = p_payment_id, paid_at = now()
  where id = p_order_id;
  return true;
end;
$$;

create or replace function public.refund_paid_order(p_order_id uuid, p_payment_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_location_id uuid;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.payment_status = 'refunded' then return false; end if;
  if v_order.payment_status <> 'paid' or v_order.payment_id <> p_payment_id then raise exception 'Paid order mismatch'; end if;
  select id into v_location_id from public.inventory_locations where active limit 1;
  for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id loop
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, reference_type, reference_id, note)
    values (v_item.variant_id, v_location_id, 'return', v_item.quantity, 'order_refund', p_order_id, 'Stock devuelto por reintegro');
  end loop;
  update public.orders set status = 'cancelled', payment_status = 'refunded' where id = p_order_id;
  return true;
end;
$$;

revoke execute on function public.create_checkout_order(jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.confirm_paid_order(uuid, text, numeric) from public, anon, authenticated;
revoke execute on function public.release_checkout_order(uuid) from public, anon, authenticated;
revoke execute on function public.release_expired_checkout_reservations() from public, anon, authenticated;
revoke execute on function public.refund_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.create_checkout_order(jsonb, jsonb, jsonb, uuid) to service_role;
grant execute on function public.confirm_paid_order(uuid, text, numeric) to service_role;
grant execute on function public.release_checkout_order(uuid) to service_role;
grant execute on function public.release_expired_checkout_reservations() to service_role;
grant execute on function public.refund_paid_order(uuid, text) to service_role;
