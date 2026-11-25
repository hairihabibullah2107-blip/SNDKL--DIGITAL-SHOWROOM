-- SANDIKALE showroom: customer reviews and initial material options.
-- Safe to re-run; no existing showroom orders or POS tables are modified.

create table if not exists public.showroom_product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.showroom_products(id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 2 and 100),
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 5 and 1200),
  verified_purchase boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists showroom_product_reviews_product_created_idx
  on public.showroom_product_reviews(product_id, created_at desc);

alter table public.showroom_product_reviews enable row level security;
grant select, insert on public.showroom_product_reviews to anon, authenticated;
grant update, delete on public.showroom_product_reviews to authenticated;

drop policy if exists showroom_public_approved_reviews_read on public.showroom_product_reviews;
create policy showroom_public_approved_reviews_read on public.showroom_product_reviews
  for select to anon, authenticated using (is_approved = true);

drop policy if exists showroom_public_review_submit on public.showroom_product_reviews;
create policy showroom_public_review_submit on public.showroom_product_reviews
  for insert to anon, authenticated with check (
    char_length(btrim(author_name)) between 2 and 100
    and rating between 1 and 5
    and char_length(btrim(comment)) between 5 and 1200
    and exists (
      select 1 from public.showroom_products p
      where p.id = product_id and p.is_published = true
    )
  );

drop policy if exists showroom_admin_reviews_manage on public.showroom_product_reviews;
create policy showroom_admin_reviews_manage on public.showroom_product_reviews
  for all to authenticated
  using (private.showroom_has_any_role(array['owner','admin']))
  with check (private.showroom_has_any_role(array['owner','admin']));

insert into public.showroom_materials (name, description, surcharge, is_active)
select v.name, v.description, 0, true
from (values
  ('Cotton Combed 24s', 'Bahan cotton combed 24s untuk kaos custom.'),
  ('Cotton Combed 30s', 'Bahan cotton combed 30s untuk kaos custom.')
) as v(name, description)
where not exists (
  select 1 from public.showroom_materials m where lower(m.name) = lower(v.name)
);

update public.showroom_products
set material_id = (
  select id from public.showroom_materials
  where name = 'Cotton Combed 24s'
  limit 1
), updated_at = now()
where slug = 'kaos-polos-24s' and material_id is null;
