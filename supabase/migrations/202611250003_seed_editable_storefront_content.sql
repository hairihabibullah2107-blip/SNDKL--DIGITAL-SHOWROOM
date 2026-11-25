-- Seed editable homepage content without overwriting existing admin settings.
insert into public.showroom_settings (key, value)
values (
  'storefront',
  '{"announcement":"Custom apparel & DTF printing · Made to order in Sesaot","hero_eyebrow":"SANDIKALE DIGITAL SHOWROOM & DTF LAB","hero_title":"OWN YOUR STREET.|PRINT YOUR IDENTITY.","hero_subtitle":"Kaos custom dan studio sablon DTF dengan pilihan bahan, visualisasi desain, serta pelacakan produksi dalam satu tempat.","primary_cta":"Custom Your Style","secondary_cta":"Shop Collection"}'::jsonb
)
on conflict (key) do nothing;

insert into public.showroom_settings (key, value)
values ('shipping', '{"origin_city":"Sesaot, Narmada, Lombok Barat","couriers":[]}'::jsonb)
on conflict (key) do nothing;
