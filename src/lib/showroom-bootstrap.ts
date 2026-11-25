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
  const [categoryResult, productResult, materialResult, variantResult, imageResult, dtfResult, reviewResult] =
    await Promise.all([
      supabase.from('showroom_categories').select('id,name,slug,description,image_path,sort_order,is_active').eq('is_active', true).order('sort_order'),
      supabase.from('showroom_products').select('id,category_id,name,slug,description,base_price,long_sleeve_price,model,weight_description,is_featured,is_best_seller,is_published,stock_mode,available_colors,size_surcharges,material_id,showroom_materials(name,description,surcharge)').eq('is_published', true).order('created_at', { ascending: false }),
      supabase.from('showroom_materials').select('id,name,description,surcharge,is_active').eq('is_active', true),
      supabase.from('showroom_product_variants').select('id,product_id,color,size,sku,price_adjustment,stock_quantity,is_available').eq('is_available', true),
      supabase.from('showroom_product_images').select('id,product_id,storage_path,alt_text,sort_order,is_primary').order('sort_order'),
      supabase.from('showroom_dtf_prices').select('id,size_code,label,width_cm,height_cm,price,is_active,sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('showroom_product_reviews').select('id,product_id,author_name,rating,comment,verified_purchase,created_at').eq('is_approved', true).order('created_at', { ascending: false }),
    ]);

  for (const result of [categoryResult, productResult, materialResult, variantResult, imageResult, dtfResult, reviewResult]) {
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
      const match = productVariants.find((v) => v.color.toLowerCase() === name.toLowerCase());
      return { name, hex: '#777777', image: match ? undefined : undefined };
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
      const key = name.toLowerCase();
      if (!colorMap.has(key)) colorMap.set(key, { id: key, name, hex: '#777777', publishedByAdmin: true });
    }
  }

  const dtfZones: DtfZonePrice[] = dtfPrices.map((row) => ({
    id: row.size_code,
    label: row.label,
    dimensionsCm: `${row.width_cm} × ${row.height_cm} cm`,
    maxWidthCm: asNumber(row.width_cm),
    maxHeightCm: asNumber(row.height_cm),
    price: asNumber(row.price),
    view: row.size_code === 'A3' ? 'back' : row.size_code === 'A5' ? 'sleeve' : 'front',
    box: row.size_code === 'A6' ? { x: 18, y: 24, w: 22, h: 22 } : row.size_code === 'A5' ? { x: 12, y: 38, w: 18, h: 18 } : row.size_code === 'A3' ? { x: 25, y: 20, w: 50, h: 52 } : { x: 25, y: 22, w: 50, h: 50 },
  }));

  const payment: PaymentMethodConfig[] = [{
    id: 'qris',
    label: 'Pembayaran manual — konfirmasi admin',
    group: 'Manual',
    enabled: true,
  }];
  const shipping: ShippingCourierConfig[] = [{
    id: 'confirm-shipping',
    name: 'Konfirmasi ongkir via WhatsApp',
    serviceArea: 'Indonesia',
    etaLabel: 'Dikonfirmasi admin',
    etaDays: 0,
    cost: 0,
    enabled: true,
  }];

  return {
    categories,
    products,
    fabrics,
    garmentColors: [...colorMap.values()],
    paymentMethods: payment,
    shippingOriginCity: 'Sesaot, Narmada, Lombok Barat',
    shippingCouriers: shipping,
    adminWhatsapp: '6282266412844',
    dtfZones,
    reviews,
    chatMessages: [],
  };
}
