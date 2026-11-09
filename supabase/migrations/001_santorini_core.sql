create type public.order_status as enum ('draft', 'confirmed', 'cancelled', 'fulfilled');
create type public.payment_status as enum ('pending', 'paid', 'refunded');
create type public.stock_movement_type as enum ('initial_count', 'purchase', 'sale', 'adjustment', 'return', 'reservation', 'release');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  brand text,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  web_status text not null default 'draft' check (web_status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  color text not null,
  size text not null,
  price_ars numeric(12,2) not null check (price_ars >= 0),
  cost_usd numeric(12,2),
  created_at timestamptz not null default now(),
  unique(product_id, color, size)
);

create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location_type text not null default 'warehouse',
  active boolean not null default true
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id),
  location_id uuid not null references public.inventory_locations(id),
  movement_type public.stock_movement_type not null,
  quantity integer not null check (quantity <> 0),
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references auth.users(id),
  channel text not null,
  status public.order_status not null default 'draft',
  payment_status public.payment_status not null default 'pending',
  total_ars numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  quantity integer not null check (quantity > 0),
  unit_price_ars numeric(12,2) not null check (unit_price_ars >= 0)
);

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Public can read published catalog" on public.products for select using (web_status = 'published');
create policy "Public can read variants of published catalog" on public.product_variants for select using (exists (select 1 from public.products p where p.id = product_id and p.web_status = 'published'));

-- Backoffice policies must be added with a role claim before production deployment.
