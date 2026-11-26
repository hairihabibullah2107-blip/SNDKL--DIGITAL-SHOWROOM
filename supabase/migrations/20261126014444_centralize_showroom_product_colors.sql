create table if not exists public.showroom_colors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hex text not null default '#777777' check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists showroom_colors_name_lower_uidx on public.showroom_colors (lower(name));
create table if not exists public.showroom_product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.showroom_products(id) on delete cascade,
  color_id uuid not null references public.showroom_colors(id) on delete restrict,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, color_id)
);
create index if not exists showroom_product_colors_product_idx on public.showroom_product_colors(product_id, sort_order);
alter table public.showroom_colors enable row level security;
alter table public.showroom_product_colors enable row level security;
drop policy if exists showroom_colors_admin_manage on public.showroom_colors;
create policy showroom_colors_admin_manage on public.showroom_colors
for all to authenticated
using (private.showroom_has_any_role(array['owner','admin']))
with check (private.showroom_has_any_role(array['owner','admin']));
drop policy if exists showroom_colors_public_read on public.showroom_colors;
create policy showroom_colors_public_read on public.showroom_colors
for select to anon, authenticated using (is_active = true);
drop policy if exists showroom_product_colors_admin_manage on public.showroom_product_colors;
create policy showroom_product_colors_admin_manage on public.showroom_product_colors
for all to authenticated
using (private.showroom_has_any_role(array['owner','admin']))
with check (private.showroom_has_any_role(array['owner','admin']));
drop policy if exists showroom_product_colors_public_read on public.showroom_product_colors;
create policy showroom_product_colors_public_read on public.showroom_product_colors
for select to anon, authenticated
using (is_active = true and exists (
  select 1 from public.showroom_products p
  where p.id = showroom_product_colors.product_id and p.is_published = true
));
grant select on public.showroom_colors, public.showroom_product_colors to anon, authenticated;
grant insert, update, delete on public.showroom_colors, public.showroom_product_colors to authenticated;
insert into public.showroom_colors (name, hex, sort_order)
select distinct c.name,
       case lower(c.name) when 'hitam' then '#111111' when 'putih' then '#F5F5F5' when 'maroon' then '#7A1F2B' else '#777777' end,
       row_number() over (order by c.name)
from public.showroom_products p
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(p.available_colors) = 'array' then p.available_colors else '[]'::jsonb end
) as c(name)
on conflict (lower(name)) do nothing;
insert into public.showroom_product_colors (product_id, color_id, sort_order)
select p.id, c.id, row_number() over (partition by p.id order by c.name)
from public.showroom_products p
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(p.available_colors) = 'array' then p.available_colors else '[]'::jsonb end
) as old_color(name)
join public.showroom_colors c on lower(c.name) = lower(old_color.name)
on conflict (product_id, color_id) do nothing;
