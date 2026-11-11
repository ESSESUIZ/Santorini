-- Santorini currently sells through a single pickup point and manual payments.
create or replace function public.create_checkout_order(
  p_customer jsonb,
  p_items jsonb,
  p_shipping jsonb,
  p_customer_id uuid default null,
  p_payment_provider text default 'bank_transfer'
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
  if p_payment_provider not in ('bank_transfer', 'cash') then raise exception 'Invalid payment provider'; end if;
  v_shipping_cost := coalesce((p_shipping ->> 'cost')::numeric, 0);
  if v_shipping_cost < 0 then raise exception 'Invalid shipping cost'; end if;
  select id into v_location_id from public.inventory_locations where active limit 1;
  if v_location_id is null then raise exception 'No active inventory location'; end if;

  v_order_number := 'SAN-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  insert into public.orders (order_number, customer_id, channel, status, payment_status, total_ars, customer_email, customer_name, customer_phone, shipping_address, shipping_provider, shipping_service, shipping_cost_ars, shipping_postal_code, payment_provider, reservation_expires_at)
  values (v_order_number, p_customer_id, 'online', 'draft', 'pending', 0, lower(p_customer ->> 'email'), p_customer ->> 'name', p_customer ->> 'phone', p_customer -> 'address', 'pickup', p_shipping ->> 'service', v_shipping_cost, null, p_payment_provider, now() + interval '2 hours')
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := greatest(1, least(10, coalesce((v_item ->> 'quantity')::integer, 1)));
    select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
    if not found then raise exception 'Invalid product variant'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_variant.id::text, 0));
    select coalesce(sum(quantity), 0)::integer into v_stock from public.inventory_movements where variant_id = v_variant.id;
    if v_stock < v_quantity then raise exception 'Insufficient stock for %', v_variant.sku; end if;
    insert into public.order_items (order_id, variant_id, quantity, unit_price_ars) values (v_order_id, v_variant.id, v_quantity, v_variant.price_ars);
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, reference_type, reference_id, note) values (v_variant.id, v_location_id, 'reservation', -v_quantity, 'order_reservation', v_order_id, 'Reserva temporal de checkout');
    v_items_total := v_items_total + (v_variant.price_ars * v_quantity);
  end loop;

  update public.orders set total_ars = v_items_total + v_shipping_cost where id = v_order_id;
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'items_total_ars', v_items_total, 'shipping_cost_ars', v_shipping_cost, 'total_ars', v_items_total + v_shipping_cost);
end;
$$;

create or replace function public.confirm_manual_payment_order(p_order_id uuid)
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
  if not public.is_admin() then raise exception 'Solo un administrador puede confirmar pagos'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if coalesce(v_order.payment_provider, '') not in ('bank_transfer', 'cash') then raise exception 'Este pedido no usa un pago manual'; end if;
  if v_order.payment_status = 'paid' then return true; end if;
  if v_order.status = 'cancelled' then raise exception 'La reserva de este pedido fue liberada'; end if;
  select id into v_location_id from public.inventory_locations where active limit 1;
  if v_location_id is null then raise exception 'No hay una ubicación de inventario activa'; end if;
  for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id loop
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, reference_type, reference_id, note) values (v_item.variant_id, v_location_id, 'release', v_item.quantity, 'payment_conversion', p_order_id, 'Conversión de reserva a venta');
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, reference_type, reference_id, note) values (v_item.variant_id, v_location_id, 'sale', -v_item.quantity, 'order_sale', p_order_id, 'Venta online confirmada manualmente');
  end loop;
  update public.orders set status = 'confirmed', payment_status = 'paid', payment_id = 'manual-' || v_order.order_number, paid_at = now() where id = p_order_id;
  return true;
end;
$$;

revoke execute on function public.confirm_manual_payment_order(uuid) from public, anon;
grant execute on function public.confirm_manual_payment_order(uuid) to authenticated;
