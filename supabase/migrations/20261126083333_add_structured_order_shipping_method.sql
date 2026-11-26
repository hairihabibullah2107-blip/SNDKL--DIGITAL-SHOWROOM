alter table public.showroom_orders
  add column if not exists shipping_method text,
  add column if not exists shipping_address text,
  add column if not exists shipping_city text;

alter table public.showroom_orders
  drop constraint if exists showroom_orders_shipping_method_check;

alter table public.showroom_orders
  add constraint showroom_orders_shipping_method_check
  check (shipping_method is null or shipping_method = any (array['pickup','courier']::text[]));
