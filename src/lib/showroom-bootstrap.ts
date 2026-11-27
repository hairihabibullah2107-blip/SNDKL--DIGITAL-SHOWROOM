import { supabase, storagePublicUrl } from './supabase';
import type {
  Category,
  DtfZonePrice,
  FabricOption,
  GarmentColorOption,
  PaymentMethodConfig,
  BulkDiscountRule,
  Product,
  ProductColor,
  PrintingMethodOption,
} from '../types';

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const safeQuery = async <T,>(query: PromiseLike<T>): Promise<T> => {
  try { return await query; }
  catch (error) { return { data: null, error } as T; }
};

export async function loadShowroomBootstrap() {
  const [categoryResult, productResult, materialResult, variantResult, colorResult, productColorResult, imageResult, dtfResult, reviewResult, settingsResult, printingMethodResult] =
    await Promise.all([
      safeQuery(supabase.from('showroom_categories').select('id,name,slug,description,image_path,sort_order,is_active').eq('is_active', true).order('sort_order')),
      safeQuery(supabase.from('showroom_products').select('id,category_id,name,slug,description,base_price,long_sleeve_price,model,weight_description,is_featured,is_best_seller,is_published,stock_mode,available_colors,size_surcharges,material_id,showroom_materials(name,description,surcharge)').eq('is_published', true).order('created_at', { ascending: false })),
      safeQuery(supabase.from('showroom_materials').select('id,name,description,surcharge,is_active').eq('is_active', true)),
      safeQuery(supabase.from('showroom_product_variants').select('id,product_id,color,size,sku,price_adjustment,stock_quantity,is_available').eq('is_available', true)),
      safeQuery(supabase.from('showroom_colors').select('id,name,hex,is_active').eq('is_active', true).order('sort_order')),
      safeQuery(supabase.from('showroom_product_colors').select('id,product_id,color_id,sort_order,is_active,showroom_colors(id,name,hex,is_active)').eq('is_active', true).order('sort_order')),
      safeQuery(supabase.from('showroom_product_images').select('id,product_id,storage_path,alt_text,sort_order,is_primary,view_key').order('is_primary', { ascending: false }).order('sort_order')),
      safeQuery(supabase.from('showroom_dtf_prices').select('id,size_code,label,width_cm,height_cm,price,is_active,sort_order,placement_view,box_x,box_y,box_w,box_h').eq('is_active', true).order('sort_order')),
      safeQuery(supabase.from('showroom_product_reviews').select('id,product_id,author_name,rating,comment,verified_purchase,created_at').eq('is_approved', true).order('created_at', { ascending: false })),
      safeQuery(supabase.from('showroom_settings').select('key,value')),
      safeQuery(supabase.from('showroom_printing_methods').select('id,name,description,pricing_type,base_price').eq('is_active', true).order('name')),
    ]);

  if (productResult.error) throw productResult.error;
  // Retry the DTF lookup with core columns if optional placement metadata is unavailable.
  let resolvedDtfResult: any = dtfResult;
  if (dtfResult.error || !(dtfResult.data || []).length) {
    resolvedDtfResult = await safeQuery(
      supabase.from('showroom_dtf_prices')
        .select('id,size_code,label,width_cm,height_cm,price,is_active,sort_order,placement_view')
        .eq('is_active', true).order('sort_order')
    );
  }
  const optionalFailures = [
    ['categories', categoryResult], ['materials', materialResult], ['variants', variantResult],
    ['master colors', colorResult], ['product colors', productColorResult], ['product photos', imageResult],
    ['DTF prices', resolvedDtfResult], ['reviews', reviewResult], ['site settings', settingsResult],
['printing methods', printingMethodResult],
  ].filter(([, result]) => Boolean((result as { error?: unknown }).error)).map(([name]) => name);
  if (optionalFailures.length) console.warn('SANDIKALE showroom loaded with optional data unavailable:', optionalFailures.join(', '));

  const categoriesRaw = categoryResult.data ?? [];
  const productsRaw = productResult.data ?? [];
  const materials = materialResult.data ?? [];
  const variants = variantResult.data ?? [];
  const masterColors = colorResult.data ?? [];
  const productColorLinks = productColorResult.data ?? [];
  const images = imageResult.data ?? [];
  const dtfPrices = resolvedDtfResult.data ?? [];
  const reviews = (reviewResult.data ?? []).map((row) => ({ id: row.id, productId: row.product_id, authorName: row.author_name, rating: row.rating, comment: row.comment, verifiedPurchase: row.verified_purchase, createdAt: row.created_at }));

  const categories: Category[] = categoriesRaw.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? '',
    image: storagePublicUrl(row.image_path),
    productCount: productsRaw.filter((p) => p.category_id === row.id).length,
  }));

  const products: Product[] = productsRaw.map((row) => {
    const productVariants = variants.filter((v) => v.product_id === row.id);
    const productImages = images.filter((v) => v.product_id === row.id);
    const productReviews = reviews.filter((review) => review.productId === row.id);
    const colorMapForProduct = new Map<string, ProductColor>();
    for (const link of productColorLinks.filter((item) => item.product_id === row.id)) {
      const color = Array.isArray(link.showroom_colors) ? link.showroom_colors[0] : link.showroom_colors;
      if (color?.name) colorMapForProduct.set(String(color.id), { name: color.name, hex: color.hex || '#777777' });
    }
    // Compatibility fallback for legacy variants while existing records are migrated.
    if (colorMapForProduct.size === 0) {
      for (const entry of Array.isArray(row.available_colors) ? row.available_colors : []) {
        const name = typeof entry === 'string' ? entry : String((entry as { name?: string })?.name ?? 'Default');
        const hex = typeof entry === 'object' && entry !== null && 'hex' in entry ? String((entry as { hex?: string }).hex || '#777777') : '#777777';
        colorMapForProduct.set(name.toLowerCase(), { name, hex });
      }
    }
    if (!productColorLinks.some((item) => item.product_id === row.id)) {
      for (const variant of productVariants) {
        const key = variant.color.toLowerCase();
        if (![...colorMapForProduct.values()].some((color) => color.name.toLowerCase() === key)) colorMapForProduct.set(key, { name: variant.color, hex: '#777777' });
      }
    }
    const colors: ProductColor[] = [...colorMapForProduct.values()];
    const variantPrices: Record<string, number> = {};
    for (const variant of productVariants) variantPrices[`${variant.color.toLowerCase()}::${variant.size}`] = asNumber(variant.price_adjustment);
    const category = categoriesRaw.find((c) => c.id === row.category_id);
    const sizes: Record<string, number> = {};
    for (const variant of productVariants) {
      sizes[variant.size] = (sizes[variant.size] ?? 0) + asNumber(variant.stock_quantity);
    }
    if (!Object.keys(sizes).length) for (const size of ['S', 'M', 'L', 'XL', 'XXL']) sizes[size] = 0;
    // Product photos are canonical assets shared by catalog and DTF studio.
    const frontPhoto = productImages.find((photo) => photo.view_key === 'front') || productImages[0];
    const backPhoto = productImages.find((photo) => photo.view_key === 'back');
    const sleevePhoto = productImages.find((photo) => photo.view_key === 'sleeve');
    const detailPhotos = productImages.filter((photo) => photo.view_key === 'detail');
    const frontImage = frontPhoto ? storagePublicUrl(frontPhoto.storage_path) : '';
    const backImage = backPhoto ? storagePublicUrl(backPhoto.storage_path) : '';
    const sleeveImage = sleevePhoto ? storagePublicUrl(sleevePhoto.storage_path) : '';
    // Keep front/back at indices 0/1 for legacy consumers; expose sleeve as a named view and gallery image.
    const photoUrls = [frontImage, backImage, ...detailPhotos.map((photo) => storagePublicUrl(photo.storage_path)), sleeveImage].filter(Boolean);
    const material = Array.isArray(row.showroom_materials) ? row.showroom_materials[0] : row.showroom_materials;
    const price = asNumber(row.base_price);
    const modelName = String(row.model || '').toLowerCase();
    const productName = String(row.name || '').toLowerCase();
    const isLongSleeve = modelName.includes('long') || productName.includes('lengan panjang') || productName.includes('long sleeve') || productName.includes('longsleeve');
    const silhouette = modelName.includes('hood') || productName.includes('hoodie') ? 'hoodie' : modelName.includes('boxy') || productName.includes('boxy') ? 'boxy-tee' : isLongSleeve ? 'longsleeve' : 'regular-tee';
    return {
      id: row.id,
      sku: productVariants.find((v) => v.sku)?.sku ?? row.slug.toUpperCase().replace(/-/g, '-'),
      name: row.name,
      categorySlug: category?.slug ?? 'custom-apparel',
      categoryName: category?.name ?? 'Custom Apparel',
      silhouette,
      price,
      compareAtPrice: undefined,
      fabricWeight: row.weight_description ?? material?.name ?? 'Custom Apparel',
      fit: row.model ?? 'Regular Fit',
      description: row.description ?? '',
      images: photoUrls,
      frontImage,
      backImage,
      sleeveImage,
      colors,
      sizes,
      isCustomBase: true,
      madeToOrder: row.stock_mode === 'made_to_order',
      variantPrices,
      sizeSurcharges: row.size_surcharges && typeof row.size_surcharges === 'object' ? row.size_surcharges as Record<string, number> : {},
      longSleevePrice: undefined,
      featured: Boolean(row.is_featured || row.is_best_seller),
      rating: productReviews.length ? productReviews.reduce((sum, review) => sum + Number(review.rating), 0) / productReviews.length : 0,
      reviewCount: productReviews.length,
    };
  });

  const fabrics: FabricOption[] = materials.map((row) => ({
    id: row.id,
    name: row.name,
    gsm: '',
    feel: row.description ?? '',
    breathability: '',
    priceModifier: asNumber(row.surcharge),
    productionDays: 0,
    stockMeters: 0,
    publishedByAdmin: true,
  }));

  const colorMap = new Map<string, GarmentColorOption>();
  for (const color of masterColors) {
    colorMap.set(String(color.id), { id: String(color.id), name: color.name, hex: color.hex || '#777777', publishedByAdmin: true });
  }


  const printingMethods: PrintingMethodOption[] = (printingMethodResult.data || []).map((row) => ({ id: row.id, name: row.name, description: row.description || '', pricingType: row.pricing_type, basePrice: asNumber(row.base_price) }));

  const dtfZones: DtfZonePrice[] = dtfPrices.map((row: any) => ({
    id: row.size_code,
    label: row.label,
    dimensionsCm: `${row.width_cm} × ${row.height_cm} cm`,
    maxWidthCm: asNumber(row.width_cm),
    maxHeightCm: asNumber(row.height_cm),
    price: asNumber(row.price),
    view: row.placement_view,
    box: { x: asNumber(row.box_x, 25), y: asNumber(row.box_y, 22), w: asNumber(row.box_w, 50), h: asNumber(row.box_h, 50) },
  }));

  const settings = Object.fromEntries((settingsResult.data || []).map((row) => [row.key, row.value || {}])) as Record<string, Record<string, unknown>>;
  const paymentSetting = settings.payment || {};
  const paymentRows = Array.isArray(paymentSetting.methods) ? paymentSetting.methods as Array<Record<string, unknown>> : [];
  const payment: PaymentMethodConfig[] = paymentRows.length ? paymentRows.map((row) => ({
    id: String(row.id || 'qris') as PaymentMethodConfig['id'], label: String(row.label || 'Pembayaran manual'),
    group: String(row.group || 'Manual'), enabled: row.enabled !== false,
    accountName: String(row.accountName || ''), accountNumber: String(row.accountNumber || ''),
    instructions: String(row.instructions || ''),
    qrImageUrl: String(row.qrImageUrl || ''),
  })) : [{ id: 'qris', label: 'Pembayaran manual — konfirmasi admin', group: 'Manual', enabled: true }];

  const whatsapp = settings.whatsapp || {};
  const storefront = settings.storefront || {};
  const brand = settings.brand || {};
  const instagram = settings.instagram || {};
  const pricing = settings.pricing || {};
  const visuals = settings.visuals || {};
  const galleryRows = Array.isArray(visuals.gallery) ? visuals.gallery as Array<Record<string, unknown>> : [];
  const theme = settings.theme || {};
  const heroImagePath = String(storefront.hero_image_path || '');
  const bulkDiscountRows = Array.isArray(pricing.bulk_discounts) ? pricing.bulk_discounts as Array<Record<string, unknown>> : [];
  const bulkDiscounts: BulkDiscountRule[] = bulkDiscountRows.map((row) => ({ minQuantity: Math.max(1, asNumber(row.min_quantity, 1)), discountPercent: Math.max(0, Math.min(100, asNumber(row.discount_percent))) }));

  return {
    bulkDiscounts,
    printingMethods,
    siteContent: {
      brandName: String(brand.name || 'SANDIKALE'),
      brandTagline: String(brand.tagline || 'Design & Productions'),
      instagramUrl: String(instagram.url || 'https://instagram.com/_sandikale'),
      instagramHandle: String(instagram.handle || '@_sandikale'),
      storeAddress: String(storefront.store_address || 'Dusun Penangke, Desa Sesaot, Narmada, Lombok Barat, NTB'),
      announcement: String(storefront.announcement || 'SANDIKALE · Custom Apparel, Sablon DTF & Produksi Satuan di Sesaot'),
      heroEyebrow: String(storefront.hero_eyebrow || 'SANDIKALE · CUSTOM APPAREL & DTF STUDIO'),
      heroTitle: String(storefront.hero_title || 'CUSTOM APPAREL.|DIBUAT SESUAI IDENTITASMU.'),
      heroSubtitle: String(storefront.hero_subtitle || 'Dari pilihan kaos, konsultasi desain, hingga sablon DTF satuan dan produksi apparel—semua dimulai dari SANDIKALE.'),
      primaryCta: String(storefront.primary_cta || 'Mulai Custom'),
      secondaryCta: String(storefront.secondary_cta || 'Jelajahi Katalog'),
      heroImage: heroImagePath ? storagePublicUrl(heroImagePath) : '',
      brandDetailImage: visuals.brand_detail_image_path ? storagePublicUrl(String(visuals.brand_detail_image_path)) : '',
      theme: { accent: String(theme.accent || '#7A1F2B'), background: String(theme.background || '#080808'), surface: String(theme.surface || '#171717'), text: String(theme.text || '#ffffff'), muted: String(theme.muted || '#a3a3a3') },
      gallery: galleryRows.map((item) => ({ image: storagePublicUrl(String(item.path || '')), caption: String(item.caption || ''), alt: String(item.alt || 'SANDIKALE gallery') })).filter((item) => item.image),
    },
    categories,
    products,
    fabrics,
    garmentColors: [...colorMap.values()],
    paymentMethods: payment,
    adminWhatsapp: String(whatsapp.number || '6282266412844'),
    dtfZones,
    reviews,
    chatMessages: [],
  };
}
