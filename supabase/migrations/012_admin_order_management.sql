-- Order operations are exposed only through security-definer functions that
-- assert the current authenticated user is an administrator.
create or replace function public.get_admin_orders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orders jsonb;
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede ver los pedidos'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'createdAt', o.created_at,
    'status', o.status,
    'paymentStatus', o.payment_status,
    'paymentProvider', coalesce(o.payment_provider, 'mercado_pago'),
    'paymentId', o.payment_id,
    'totalArs', o.total_ars,
    'shippingCostArs', o.shipping_cost_ars,
    'shippingService', o.shipping_service,
    'shippingAddress', o.shipping_address,
    'customer', jsonb_build_object('name', o.customer_name, 'email', o.customer_email, 'phone', o.customer_phone),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sku', v.sku,
        'name', p.name,
        'color', v.color,
        'size', v.size,
        'quantity', oi.quantity,
        'unitPriceArs', oi.unit_price_ars
      ) order by p.name, v.sku)
      from public.order_items oi
      join public.product_variants v on v.id = oi.variant_id
      join public.products p on p.id = v.product_id
      where oi.order_id = o.id
    ), '[]'::jsonb)
  ) order by o.created_at desc), '[]'::jsonb)
  into v_orders
  from public.orders o;

  return v_orders;
end;
$$;

create or replace function public.confirm_bank_transfer_order(p_order_id uuid)
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
  if not public.is_admin() then raise exception 'Solo un administrador puede confirmar transferencias'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if coalesce(v_order.payment_provider, '') <> 'bank_transfer' then raise exception 'Este pedido no fue iniciado por transferencia'; end if;
  if v_order.payment_status = 'paid' then return true; end if;
  if v_order.status = 'cancelled' then raise exception 'La reserva de este pedido fue liberada'; end if;

  select id into v_location_id from public.inventory_locations where active limit 1;
  if v_location_id is null then raise exception 'No hay una ubicación de inventario activa'; end if;
  for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id loop
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, reference_type, reference_id, note)
    values (v_item.variant_id, v_location_id, 'release', v_item.quantity, 'payment_conversion', p_order_id, 'Conversión de reserva a venta');
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, reference_type, reference_id, note)
    values (v_item.variant_id, v_location_id, 'sale', -v_item.quantity, 'order_sale', p_order_id, 'Venta online confirmada por transferencia');
  end loop;

  update public.orders
  set status = 'confirmed', payment_status = 'paid', payment_id = 'transfer-' || v_order.order_number, paid_at = now()
  where id = p_order_id;
  return true;
end;
$$;

create or replace function public.fulfill_paid_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede completar pedidos'; end if;
  update public.orders set status = 'fulfilled'
  where id = p_order_id and status = 'confirmed' and payment_status = 'paid';
  if not found then raise exception 'El pedido debe estar pagado y confirmado antes de completarlo'; end if;
  return true;
end;
$$;

revoke execute on function public.get_admin_orders() from public, anon;
revoke execute on function public.confirm_bank_transfer_order(uuid) from public, anon;
revoke execute on function public.fulfill_paid_order(uuid) from public, anon;
grant execute on function public.get_admin_orders() to authenticated;
grant execute on function public.confirm_bank_transfer_order(uuid) to authenticated;
grant execute on function public.fulfill_paid_order(uuid) to authenticated;
