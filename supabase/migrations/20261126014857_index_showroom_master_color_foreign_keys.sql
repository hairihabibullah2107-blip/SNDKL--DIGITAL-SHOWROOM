create index if not exists showroom_product_colors_color_idx
  on public.showroom_product_colors(color_id);
create index if not exists showroom_product_variants_color_id_idx
  on public.showroom_product_variants(color_id);
