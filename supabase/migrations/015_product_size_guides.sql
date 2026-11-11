-- A guide belongs to the product (not a color/size variant), so every variant
-- of the same garment exposes the same reference to the customer.
alter table public.products
  add column if not exists size_guide_storage_path text,
  add column if not exists size_guide_mime_type text,
  add column if not exists size_guide_file_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-size-guides',
  'product-size-guides',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Staff can upload product size guides" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-size-guides' and (select public.is_staff()));

create policy "Staff can update product size guides" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-size-guides' and (select public.is_staff()))
  with check (bucket_id = 'product-size-guides' and (select public.is_staff()));

create policy "Staff can delete product size guides" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-size-guides' and (select public.is_staff()));
