import { supabase, storagePublicUrl } from './supabase';
import type {
  Category,
  DtfZonePrice,
  FabricOption,
  GarmentColorOption,
  PaymentMethodConfig,
  Product,
  ProductColor,
  ShippingCourierConfig,
} from '../types';

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function loadShowroomBootstrap() {
  const [categoryResult, productResult, materialResult, variantResult, imageResult, dtfResult, reviewResult, settingsResult, mockupResult] =
    await Promise.all([
      supabase.from('showroom_categories').select('id,name,slug,description,image_path,sort_order,is_active').eq('is_active', true).order('sort_order'),
      supabase.from('showroom_products').select('id,category_id,name,slug,description,base_price,long_sleeve_price,model,weight_description,is_featured,is_best_seller,is_published,stock_mode,available_colors,size_surcharges,material_id,showroom_materials(name,description,surcharge)').eq('is_published', true).order('created_at', { ascending: false }),
      supabase.from('showroom_materials').select('id,name,description,surcharge,is_active').eq('is_active', true),
      supabase.from('showroom_product_variants').select('id,product_id,color,size,sku,price_adjustment,stock_quantity,is_available').eq('is_available', true),
      supabase.from('showroom_product_images').select('id,product_id,storage_path,alt_text,sort_order,is_primary').order('is_primary', { ascending: false }).order('sort_order'),
      supabase.from('showroom_dtf_prices').select('id,size_code,label,width_cm,height_cm,price,is_active,sort_order,placement_view,box_x,box_y,box_w,box_h').eq('is_active', true).order('sort_order'),
      supabase.from('showroom_product_reviews').select('id,product_id,author_name,rating,comment,verified_purchase,created_at').eq('is_approved', true).order('created_at', { ascending: false }),
      supabase.from('showroom_settings').select('key,value'),
      supabase.from('showroom_garment_mockups').select('garment_type,color_name,color_hex,front_storage_path,back_storage_path').eq('is_active', true),
    ]);

  for (const result of [categoryResult, productResult, materialResult, variantResult, imageResult, dtfResult, reviewResult, settingsResult, mockupResult]) {
    if (result.error) throw result.error;
  }

  const categoriesRaw = categoryResult.data ?? [];
  const productsRaw = productResult.data ?? [];
  const materials = materialResult.data ?? [];
  const variants = variantResult.data ?? [];
  const images = imageResult.data ?? [];
  const dtfPrices = dtfResult.data ?? [];
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
    const colorNames = Array.isArray(row.available_colors) ? row.available_colors : [];
    const colors: ProductColor[] = colorNames.map((entry) => {
      const name = typeof entry === 'string' ? entry : String((entry as { name?: string })?.name ?? 'Default');
      const hex = typeof entry === 'object' && entry !== null && 'hex' in entry ? String((entry as { hex?: string }).hex || '#777777') : '#777777';
      return { name, hex };
    });
    const category = categoriesRaw.find((c) => c.id === row.category_id);
    const sizes: Record<string, number> = {};
    for (const variant of productVariants) {
      sizes[variant.size] = (sizes[variant.size] ?? 0) + asNumber(variant.stock_quantity);
    }
    if (!Object.keys(sizes).length) for (const size of ['S', 'M', 'L', 'XL', 'XXL']) sizes[size] = 0;
    const photoUrls = productImages.map((photo) => storagePublicUrl(photo.storage_path)).filter(Boolean);
    const material = Array.isArray(row.showroom_materials) ? row.showroom_materials[0] : row.showroom_materials;
    const price = asNumber(row.base_price);
    const modelName = String(row.model || '').toLowerCase();
    const silhouette = modelName.includes('hood') ? 'hoodie' : modelName.includes('boxy') ? 'boxy-tee' : modelName.includes('long') ? 'longsleeve' : 'regular-tee';
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
      frontImage: photoUrls[0],
      backImage: photoUrls[1],
      colors,
      sizes,
      isCustomBase: true,
      madeToOrder: row.stock_mode === 'made_to_order',
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
  for (const product of productsRaw) {
    for (const value of Array.isArray(product.available_colors) ? product.available_colors : []) {
      const name = typeof value === 'string' ? value : String((value as { name?: string })?.name ?? 'Default');
      const hex = typeof value === 'object' && value !== null && 'hex' in value ? String((value as { hex?: string }).hex || '#777777') : '#777777';
      const key = name.toLowerCase();
      if (!colorMap.has(key)) colorMap.set(key, { id: key, name, hex, publishedByAdmin: true });
    }
  }

  for (const mockup of mockupResult.data || []) {
    const key = String(mockup.color_name).toLowerCase();
    const existing: GarmentColorOption = colorMap.get(key) || { id: key, name: mockup.color_name, hex: mockup.color_hex || '#777777', publishedByAdmin: true };
    const mockups = [...(existing.mockups || []).filter((item) => item.garmentType !== mockup.garment_type), {
      garmentType: mockup.garment_type as 'short' | 'long',
      frontImage: storagePublicUrl(mockup.front_storage_path),
      backImage: storagePublicUrl(mockup.back_storage_path),
    }];
    colorMap.set(key, { ...existing, hex: mockup.color_hex || existing.hex, mockups });
  }

  const dtfZones: DtfZonePrice[] = dtfPrices.map((row) => ({
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
  const shippingSetting = settings.shipping || {};
  const paymentRows = Array.isArray(paymentSetting.methods) ? paymentSetting.methods as Array<Record<string, unknown>> : [];
  const shippingRows = Array.isArray(shippingSetting.couriers) ? shippingSetting.couriers as Array<Record<string, unknown>> : [];
  const payment: PaymentMethodConfig[] = paymentRows.length ? paymentRows.map((row) => ({
    id: String(row.id || 'qris') as PaymentMethodConfig['id'], label: String(row.label || 'Pembayaran manual'),
    group: String(row.group || 'Manual'), enabled: row.enabled !== false,
  })) : [{ id: 'qris', label: 'Pembayaran manual — konfirmasi admin', group: 'Manual', enabled: true }];
  const shipping: ShippingCourierConfig[] = shippingRows.length ? shippingRows.map((row) => ({
    id: String(row.id || 'manual'), name: String(row.name || 'Konfirmasi via WhatsApp'),
    serviceArea: String(row.serviceArea || 'Indonesia'), etaLabel: String(row.etaLabel || 'Dikonfirmasi admin'),
    etaDays: asNumber(row.etaDays), cost: asNumber(row.cost), enabled: row.enabled !== false,
  })) : [{ id: 'confirm-shipping', name: 'Konfirmasi ongkir via WhatsApp', serviceArea: 'Indonesia', etaLabel: 'Dikonfirmasi admin', etaDays: 0, cost: 0, enabled: true }];
  const whatsapp = settings.whatsapp || {};
  const storefront = settings.storefront || {};
  const brand = settings.brand || {};
  const instagram = settings.instagram || {};

  return {
    siteContent: {
      brandName: String(brand.name || 'SANDIKALE'),
      brandTagline: String(brand.tagline || 'Design & Productions'),
      instagramUrl: String(instagram.url || 'https://instagram.com/_sandikale'),
      instagramHandle: String(instagram.handle || '@_sandikale'),
      storeAddress: String(storefront.store_address || 'Dusun Penangke, Desa Sesaot, Narmada, Lombok Barat, NTB'),
      announcement: String(storefront.announcement || 'Custom apparel & DTF printing · Made to order in Sesaot'),
      heroEyebrow: String(storefront.hero_eyebrow || 'SANDIKALE DIGITAL SHOWROOM & DTF LAB'),
      heroTitle: String(storefront.hero_title || 'OWN YOUR STREET. PRINT YOUR IDENTITY.'),
      heroSubtitle: String(storefront.hero_subtitle || 'Kaos custom dan studio sablon DTF dengan pilihan bahan, visualisasi desain, serta pelacakan produksi dalam satu tempat.'),
      primaryCta: String(storefront.primary_cta || 'Custom Your Style'),
      secondaryCta: String(storefront.secondary_cta || 'Shop Collection'),
    },
    categories,
    products,
    fabrics,
    garmentColors: [...colorMap.values()],
    paymentMethods: payment,
    shippingOriginCity: String(shippingSetting.origin_city || 'Sesaot, Narmada, Lombok Barat'),
    shippingCouriers: shipping,
    adminWhatsapp: String(whatsapp.number || '6282266412844'),
    dtfZones,
    reviews,
    chatMessages: [],
  };
}
