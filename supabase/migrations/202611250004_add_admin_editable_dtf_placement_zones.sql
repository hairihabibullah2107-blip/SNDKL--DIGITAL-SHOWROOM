alter table public.showroom_dtf_prices
  add column if not exists placement_view text not null default 'front',
  add column if not exists box_x numeric not null default 25,
  add column if not exists box_y numeric not null default 22,
  add column if not exists box_w numeric not null default 50,
  add column if not exists box_h numeric not null default 50;

update public.showroom_dtf_prices
set placement_view = case when size_code='A3' then 'back' when size_code='A5' then 'sleeve' else 'front' end,
    box_x = case when size_code='A6' then 18 when size_code='A5' then 12 else 25 end,
    box_y = case when size_code='A5' then 38 else 22 end,
    box_w = case when size_code='A3' then 50 when size_code='A5' then 18 else 50 end,
    box_h = case when size_code='A3' then 52 when size_code='A5' then 18 else 50 end;

alter table public.showroom_dtf_prices
  drop constraint if exists showroom_dtf_prices_placement_view_check;
alter table public.showroom_dtf_prices
  add constraint showroom_dtf_prices_placement_view_check
  check (placement_view in ('front','back','sleeve'));
