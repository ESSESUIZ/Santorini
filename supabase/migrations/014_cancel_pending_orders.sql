create or replace function public.cancel_pending_order(p_order_id uuid)
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
  if not public.is_admin() then raise exception 'Solo un administrador puede cancelar pedidos'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if v_order.status = 'cancelled' then return true; end if;
  if v_order.payment_status = 'paid' then raise exception 'Un pedido pagado no puede cancelarse desde este panel'; end if;
  if exists (select 1 from public.inventory_movements where reference_type = 'order_release' and reference_id = p_order_id) then return false; end if;

  select id into v_location_id from public.inventory_locations where active limit 1;
  if v_location_id is null then raise exception 'No hay una ubicación de inventario activa'; end if;
  for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id loop
    insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, reference_type, reference_id, note)
    values (v_item.variant_id, v_location_id, 'release', v_item.quantity, 'order_release', p_order_id, 'Liberación por cancelación administrativa');
  end loop;
  update public.orders set status = 'cancelled' where id = p_order_id;
  return true;
end;
$$;

revoke execute on function public.cancel_pending_order(uuid) from public, anon;
grant execute on function public.cancel_pending_order(uuid) to authenticated;
