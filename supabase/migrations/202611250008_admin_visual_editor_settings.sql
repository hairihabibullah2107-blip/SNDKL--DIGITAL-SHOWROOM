drop policy if exists showroom_settings_public_read on public.showroom_settings;
create policy showroom_settings_public_read
on public.showroom_settings
for select
to anon, authenticated
using (key in ('brand','instagram','payment','whatsapp','shipping','storefront','pricing','theme','visuals'));

insert into public.showroom_settings (key, value)
values
  ('theme', '{"accent":"#ff4d00","background":"#080808","surface":"#171717","text":"#ffffff","muted":"#a3a3a3"}'::jsonb),
  ('visuals', '{"gallery":[]}'::jsonb)
on conflict (key) do nothing;