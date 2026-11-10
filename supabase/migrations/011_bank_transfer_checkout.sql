-- Adds a payment-method argument so checkout reservations can distinguish
-- Mercado Pago from a pending manual bank transfer.
create or replace function public.create_checkout_order(
  p_customer jsonb,
  p_items jsonb,
  p_shipping jsonb,
  p_customer_id uuid default null,
  p_payment_provider text default 'mercado_pago'
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
  v_reservation_interval interval;
begin
  perform public.release_expired_checkout_reservations();
  if coalesce(p_customer ->> 'email', '') = '' then raise exception 'Email is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Order has no items'; end if;
  if p_payment_provider not in ('mercado_pago', 'bank_transfer') then raise exception 'Invalid payment provider'; end if;
  v_shipping_cost := coalesce((p_shipping ->> 'cost')::numeric, -1);
  if v_shipping_cost < 0 then raise exception 'Invalid shipping cost'; end if;
  select id into v_location_id from public.inventory_locations where active limit 1;
  if v_location_id is null then raise exception 'No active inventory location'; end if;

  v_reservation_interval := case when p_payment_provider = 'bank_transfer' then interval '2 hours' else interval '30 minutes' end;
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
    p_payment_provider, now() + v_reservation_interval
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

revoke execute on function public.create_checkout_order(jsonb, jsonb, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.create_checkout_order(jsonb, jsonb, jsonb, uuid, text) to service_role;
