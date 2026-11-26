alter table public.showroom_product_variants
  add column if not exists color_id uuid references public.showroom_colors(id) on delete set null;
update public.showroom_product_variants v
set color_id = pc.color_id
from public.showroom_product_colors pc
join public.showroom_colors c on c.id = pc.color_id
where pc.product_id = v.product_id
  and lower(c.name) = lower(v.color)
  and v.color_id is null;
create or replace function private.sync_showroom_variant_color()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  resolved_name text;
begin
  if new.color_id is null and new.color is not null then
    select pc.color_id into new.color_id
    from public.showroom_product_colors pc
    join public.showroom_colors c on c.id = pc.color_id
    where pc.product_id = new.product_id
      and pc.is_active = true
      and lower(c.name) = lower(new.color)
    order by pc.sort_order
    limit 1;
  end if;
  if new.color_id is not null then
    select c.name into resolved_name
    from public.showroom_product_colors pc
    join public.showroom_colors c on c.id = pc.color_id
    where pc.product_id = new.product_id
      and pc.color_id = new.color_id
      and pc.is_active = true
      and c.is_active = true;
    if resolved_name is null then
      raise exception 'Warna belum dihubungkan ke produk ini.';
    end if;
    new.color := resolved_name;
  end if;
  return new;
end;
$$;
drop trigger if exists showroom_variant_sync_color on public.showroom_product_variants;
create trigger showroom_variant_sync_color
before insert or update of product_id, color, color_id
on public.showroom_product_variants
for each row execute function private.sync_showroom_variant_color();
