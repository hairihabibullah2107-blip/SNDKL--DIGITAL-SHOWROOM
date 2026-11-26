alter table public.showroom_product_images
  add column if not exists view_key text not null default 'detail';
with ranked as (
  select id, row_number() over (partition by product_id order by is_primary desc, sort_order asc, created_at asc) as rn
  from public.showroom_product_images
)
update public.showroom_product_images i
set view_key = case when ranked.rn = 1 then 'front' when ranked.rn = 2 then 'back' else 'detail' end
from ranked where ranked.id = i.id;
alter table public.showroom_product_images
  drop constraint if exists showroom_product_images_view_key_check;
alter table public.showroom_product_images
  add constraint showroom_product_images_view_key_check check (view_key in ('front','back','detail'));
create unique index if not exists showroom_product_images_one_front_back
  on public.showroom_product_images(product_id, view_key)
  where view_key in ('front','back');
