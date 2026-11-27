export type OrderStage =
  | 'Menunggu Pembayaran'
  | 'Verifikasi Desain DTF'
  | 'Proses Cetak DTF'
  | 'Heat Press & QC'
  | 'Dikirim'
  | 'Siap Diambil'
  | 'Selesai';

export type GarmentSilhouette = 'boxy-tee' | 'regular-tee' | 'hoodie' | 'longsleeve';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  productCount: number;
}

export interface ProductColor {
  name: string;
  hex: string;
  image?: string;
}

export interface GarmentColorOption {
  id: string;
  name: string;
  hex: string;
  publishedByAdmin: boolean;
  mockups?: Array<{ garmentType: 'short' | 'long'; frontImage: string; backImage: string }>;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  silhouette: GarmentSilhouette;
  price: number;
  compareAtPrice?: number;
  fabricWeight: string;
  fit: string;
  description: string;
  images: string[];
  frontImage?: string;
  backImage?: string;
  colors: ProductColor[];
  sizes: Record<string, number>;
  isCustomBase: boolean;
  madeToOrder?: boolean;
  variantPrices?: Record<string, number>;
  sizeSurcharges?: Record<string, number>;
  longSleevePrice?: number;
  featured: boolean;
  rating: number;
  reviewCount: number;
}

export interface FabricOption {
  id: string;
  name: string;
  gsm: string;
  feel: string;
  breathability: string;
  priceModifier: number;
  productionDays: number;
  stockMeters: number;
  publishedByAdmin: boolean;
}

export type PaymentMethodId =
  | 'va_bca'
  | 'va_mandiri'
  | 'va_bni'
  | 'va_bri'
  | 'qris'
  | 'ewallet_gopay'
  | 'intl_card_wise';

export interface PrintingMethodOption { id: string; name: string; description: string; pricingType: string; basePrice: number }

export interface BulkDiscountRule { minQuantity: number; discountPercent: number }

export interface PaymentMethodConfig {
  id: PaymentMethodId;
  label: string;
  group: string;
  enabled: boolean;
}

export interface ShippingCourierConfig {
  id: string;
  name: string;
  serviceArea: string;
  etaLabel: string;
  etaDays: number;
  cost: number;
  enabled: boolean;
}

export interface DtfZonePrice {
  id: string;
  label: string;
  dimensionsCm: string;
  maxWidthCm: number;
  maxHeightCm: number;
  price: number;
  view: 'front' | 'back' | 'sleeve';
  box: { x: number; y: number; w: number; h: number };
}

export interface CustomDesignPlacement {
  zoneId: string;
  zoneLabel: string;
  artworkName: string;
  artworkDataUrl: string;
  originalDataUrl?: string;
  xOffset: number;
  yOffset: number;
  scale: number;
  rotation: number;
  removeWhiteBg: boolean;
  bgTolerance?: number;
  price: number;
}

export interface CartItem {
  id: string;
  type: 'catalog' | 'custom_dtf';
  productId: string;
  sku: string;
  name: string;
  image: string;
  colorName: string;
  colorHex: string;
  size: string;
  quantity: number;
  unitPrice: number;
  fabricName?: string;
  fabricId?: string;
  estimatedDays?: number;
  customModel?: string;
  customPlacements?: CustomDesignPlacement[];
}

export interface OrderTimelineEvent {
  stage: OrderStage;
  timestamp: string;
  note: string;
  completed: boolean;
}

export interface EmailNotification {
  id: string;
  orderId: string;
  toEmail: string;
  subject: string;
  body: string;
  stage: OrderStage;
  sentAt: string;
}

export interface OrderDesign {
  id: string;
  productName: string;
  approvalStatus: string;
  designVersion: number;
  designConfiguration: Record<string, unknown>;
  previewUrl: string | null;
}

export interface Order {
  id: string;
  spkNumber?: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingCourier: string;
  shippingEtaDays: number;
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethodId;
  paymentLabel: string;
  paymentReference: string;
  paymentStatus: 'pending' | 'paid';
  stage: OrderStage;
  trackingNumber: string;
  timeline: OrderTimelineEvent[];
  createdAt: string;
  updatedAt: string;
  designs?: OrderDesign[];
  designApprovalOpen?: boolean;
}

export interface ProductReview {
  id: string;
  productId: string;
  orderId?: string;
  authorName: string;
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'Blank Garment' | 'DTF Film & Ink' | 'Packaging';
  stock: number;
  minThreshold: number;
  unit: string;
  warehouse: string;
  lastSyncedAt: string;
}

export interface WebhookLogEntry {
  id: string;
  eventId: string;
  direction: 'inbound_supabase' | 'outbound_sync';
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'ORDER_DEDUCT';
  sku: string;
  itemName: string;
  previousStock: number;
  newStock: number;
  status: 'delivered' | 'retrying' | 'failed';
  attempt: number;
  maxAttempts: number;
  latencyMs: number;
  signatureVerified: boolean;
  errorMessage?: string;
  payloadPreview: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderRole: 'customer' | 'admin';
  senderName: string;
  text: string;
  createdAt: string;
}

export interface BugReport {
  id: string;
  reporterEmail: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  viewport: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin';
  createdAt: string;
}

export interface MonthlyRevenuePoint {
  month: string;
  revenue: number;
  orders: number;
  customDtfShare: number;
}
