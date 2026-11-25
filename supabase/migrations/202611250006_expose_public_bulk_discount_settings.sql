drop policy if exists showroom_settings_public_read on public.showroom_settings;
create policy showroom_settings_public_read
on public.showroom_settings
for select
to anon, authenticated
using (key in ('brand','instagram','payment','whatsapp','shipping','storefront','pricing'));
