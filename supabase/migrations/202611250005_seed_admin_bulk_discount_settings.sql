-- Seed admin-editable bulk discount rules without overwriting existing pricing configuration.
insert into public.showroom_settings (key, value)
values ('pricing', '{"bulk_discounts":[{"min_quantity":6,"discount_percent":6},{"min_quantity":12,"discount_percent":12}]}'::jsonb)
on conflict (key) do nothing;
