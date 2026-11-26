alter table public.showroom_printing_methods
  drop constraint if exists showroom_printing_methods_pricing_type_check;

alter table public.showroom_printing_methods
  add constraint showroom_printing_methods_pricing_type_check
  check (pricing_type = any (array['fixed','per_piece','per_area','quote','per_unit']::text[]));

update public.showroom_printing_methods
set pricing_type = 'per_piece', updated_at = now()
where pricing_type = 'per_unit';
