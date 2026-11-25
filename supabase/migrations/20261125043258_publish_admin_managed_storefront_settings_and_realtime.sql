-- Keep only public storefront configuration readable by anonymous visitors.
grant select on public.showroom_settings to anon, authenticated;
drop policy if exists showroom_settings_public_read on public.showroom_settings;
create policy showroom_settings_public_read
on public.showroom_settings
for select
to anon, authenticated
using (key in ('brand','instagram','payment','whatsapp','shipping','storefront'));

-- Publish catalog and public storefront configuration changes to Supabase Realtime.
alter publication supabase_realtime add table
  public.showroom_products,
  public.showroom_categories,
  public.showroom_materials,
  public.showroom_dtf_prices,
  public.showroom_settings,
  public.showroom_product_images,
  public.showroom_product_variants;
