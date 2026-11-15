-- Applies the least-privilege model used by the web UI: only admins operate stock,
-- catalog records, order data and uploaded assets.
drop policy if exists "Staff manage products" on public.products;
drop policy if exists "Staff read business data" on public.products;
drop policy if exists "Staff manage variants" on public.product_variants;
drop policy if exists "Staff read variants" on public.product_variants;
drop policy if exists "Staff manage locations" on public.inventory_locations;
drop policy if exists "Staff read movements" on public.inventory_movements;
drop policy if exists "Staff manage orders" on public.orders;
drop policy if exists "Staff manage order items" on public.order_items;
drop policy if exists "Staff manage product images" on public.product_images;
drop policy if exists "Staff can upload product images" on storage.objects;
drop policy if exists "Staff can update product images" on storage.objects;
drop policy if exists "Staff can delete product images" on storage.objects;
drop policy if exists "Staff can upload product size guides" on storage.objects;
drop policy if exists "Staff can update product size guides" on storage.objects;
drop policy if exists "Staff can delete product size guides" on storage.objects;

create policy "Admins manage products" on public.products for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins read products" on public.products for select to authenticated using ((select public.is_admin()));
create policy "Admins manage variants" on public.product_variants for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins read variants" on public.product_variants for select to authenticated using ((select public.is_admin()));
create policy "Admins manage locations" on public.inventory_locations for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins read movements" on public.inventory_movements for select to authenticated using ((select public.is_admin()));
create policy "Admins manage orders" on public.orders for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins manage order items" on public.order_items for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins manage product images" on public.product_images for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins can upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins can update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and (select public.is_admin())) with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins can delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins can upload product size guides" on storage.objects for insert to authenticated with check (bucket_id = 'product-size-guides' and (select public.is_admin()));
create policy "Admins can update product size guides" on storage.objects for update to authenticated using (bucket_id = 'product-size-guides' and (select public.is_admin())) with check (bucket_id = 'product-size-guides' and (select public.is_admin()));
create policy "Admins can delete product size guides" on storage.objects for delete to authenticated using (bucket_id = 'product-size-guides' and (select public.is_admin()));

create or replace function public.adjust_inventory(p_variant_id uuid, p_location_id uuid, p_quantity integer, p_note text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare movement_id uuid;
begin
  if not public.is_admin() then raise exception 'Unauthorized inventory adjustment'; end if;
  if p_quantity = 0 then raise exception 'Quantity cannot be zero'; end if;
  insert into public.inventory_movements (variant_id, location_id, movement_type, quantity, note, created_by)
  values (p_variant_id, p_location_id, 'adjustment', p_quantity, p_note, auth.uid()) returning id into movement_id;
  return movement_id;
end;
$$;
revoke execute on function public.adjust_inventory(uuid, uuid, integer, text) from public, anon;
grant execute on function public.adjust_inventory(uuid, uuid, integer, text) to authenticated;
