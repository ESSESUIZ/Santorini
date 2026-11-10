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
  if not public.is_staff() then raise exception 'Unauthorized inventory adjustment'; end if;
  if p_quantity = 0 then raise exception 'Quantity cannot be zero'; end if;
  insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, note, created_by)
  values (p_variant_id, p_location_id, 'adjustment', p_quantity, p_note, auth.uid())
  returning id into movement_id;
  return movement_id;
end;
$$;
