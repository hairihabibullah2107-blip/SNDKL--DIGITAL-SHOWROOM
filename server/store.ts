import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  BugReport,
  Category,
  ChatMessage,
  DtfZonePrice,
  EmailNotification,
  FabricOption,
  GarmentColorOption,
  InventoryItem,
  MonthlyRevenuePoint,
  Order,
  OrderStage,
  PaymentMethodConfig,
  Product,
  ProductReview,
  ShippingCourierConfig,
  UserProfile,
  WebhookLogEntry,
} from '../src/types.ts';

interface StoredUser extends UserProfile {
  passwordHash: string;
}

interface DatabaseSchema {
  adminPasswordHash: string | null;
  categories: Category[];
  products: Product[];
  fabrics: FabricOption[];
  garmentColors: GarmentColorOption[];
  paymentMethods: PaymentMethodConfig[];
  shippingOriginCity: string;
  adminWhatsapp: string;
  shippingCouriers: ShippingCourierConfig[];
  dtfZones: DtfZonePrice[];
  orders: Order[];
  reviews: ProductReview[];
  inventory: InventoryItem[];
  webhookLogs: WebhookLogEntry[];
  emailOutbox: EmailNotification[];
  chatMessages: ChatMessage[];
  bugReports: BugReport[];
  users: StoredUser[];
  baselineMonthly: MonthlyRevenuePoint[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_PATH = path.resolve(DATA_DIR, 'sandikale-db.json');

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const RUNTIME_WEBHOOK_SANDBOX_KEY =
  process.env.SUPABASE_WEBHOOK_SECRET && process.env.SUPABASE_WEBHOOK_SECRET.trim().length > 0
    ? process.env.SUPABASE_WEBHOOK_SECRET.trim()
    : crypto.randomBytes(24).toString('hex');

export function getWebhookVerifyKey(): string {
  return process.env.SUPABASE_WEBHOOK_SECRET?.trim() || RUNTIME_WEBHOOK_SANDBOX_KEY;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function signToken(payload: { sub: string; email: string; name: string; role: 'customer' | 'admin' }): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const body = Buffer.from(JSON.stringify({ ...payload, exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(
  token: string
): { sub: string; email: string; name: string; role: 'customer' | 'admin'; exp: number } | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function computeWebhookHmac(payloadJson: string): string {
  return crypto.createHmac('sha256', getWebhookVerifyKey()).update(payloadJson).digest('hex');
}

function defaultPaymentMethods(): PaymentMethodConfig[] {
  return [
    { id: 'qris', label: 'QRIS Instant (Semua E-Wallet & Bank)', group: 'Instan', enabled: false },
    { id: 'va_bca', label: 'BCA Virtual Account', group: 'Multibank VA', enabled: false },
    { id: 'va_mandiri', label: 'Mandiri Virtual Account', group: 'Multibank VA', enabled: false },
    { id: 'va_bni', label: 'BNI Virtual Account', group: 'Multibank VA', enabled: false },
    { id: 'va_bri', label: 'BRI Virtual Account', group: 'Multibank VA', enabled: false },
    { id: 'ewallet_gopay', label: 'GoPay / OVO / DANA', group: 'Digital', enabled: false },
    { id: 'intl_card_wise', label: 'Kartu Kredit Global / Wise Transfer', group: 'Global', enabled: false },
  ];
}

function defaultShippingCouriers(): ShippingCourierConfig[] {
  return [
    {
      id: 'jne-reg',
      name: 'JNE Reguler / Express',
      serviceArea: 'Seluruh Indonesia',
      etaLabel: '2–4 hari kerja',
      etaDays: 3,
      cost: 22000,
      enabled: false,
    },
    {
      id: 'jnt-exp',
      name: 'J&T Express',
      serviceArea: 'Seluruh Indonesia',
      etaLabel: '2–4 hari kerja',
      etaDays: 3,
      cost: 20000,
      enabled: false,
    },
    {
      id: 'sicepat-best',
      name: 'SiCepat / AnterAja',
      serviceArea: 'Nasional',
      etaLabel: '2–3 hari kerja',
      etaDays: 2,
      cost: 24000,
      enabled: false,
    },
    {
      id: 'cargo-kobra',
      name: 'Kargo / Indah Logistik',
      serviceArea: 'Partai Besar & Luar Pulau',
      etaLabel: '4–7 hari kerja',
      etaDays: 5,
      cost: 45000,
      enabled: false,
    },
  ];
}

function createInitialDb(): DatabaseSchema {
  const now = new Date().toISOString();
  const categories: Category[] = [
    {
      id: 'cat-boxy',
      name: 'Boxy Heavy Tee',
      slug: 'boxy-tee',
      description: 'Siluet drop-shoulder 240gsm dengan kerah rib tebal anti-melar.',
      image: '/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg',
      productCount: 2,
    },
    {
      id: 'cat-hoodie',
      name: 'Oversized Hoodie',
      slug: 'hoodie',
      description: 'Fleece heavyweight 330gsm berstruktur kokoh untuk layering urban.',
      image: '/src/assets/images/prod_oversized_hoodie_1795511847099.jpg',
      productCount: 1,
    },
    {
      id: 'cat-acid',
      name: 'Acid Wash Series',
      slug: 'acid-wash',
      description: 'Proses enzyme & stone-wash autentik dengan karakter vintage charcoal.',
      image: '/src/assets/images/prod_acid_wash_tee_1795511848578.jpg',
      productCount: 1,
    },
    {
      id: 'cat-graphic',
      name: 'DTF Edition',
      slug: 'dtf-edition',
      description: 'Koleksi grafis DTF high-density tinta putih 8-pass anti-pecah.',
      image: '/src/assets/images/prod_cream_graphic_tee_1795511847871.jpg',
      productCount: 1,
    },
  ];

  const products: Product[] = [
    {
      id: 'prod-01',
      sku: 'SDK-BXY-BLK-240',
      name: 'Sandikale Boxy Heavyweight 240G',
      categorySlug: 'boxy-tee',
      categoryName: 'Boxy Heavy Tee',
      silhouette: 'boxy-tee',
      price: 189000,
      compareAtPrice: 229000,
      fabricWeight: '240 GSM US Cotton',
      fit: 'Boxy Drop-Shoulder',
      description:
        'Kaos boxy andalan Sandikale dengan struktur jatuh tegas dan kerah rib 2.8cm, ideal untuk sablon DTF presisi tinggi maupun dipakai polos.',
      images: [
        '/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg',
        '/src/assets/images/prod_acid_wash_tee_1795511848578.jpg',
      ],
      colors: [],
      sizes: { S: 18, M: 34, L: 29, XL: 21, XXL: 11 },
      isCustomBase: true,
      featured: true,
      rating: 4.9,
      reviewCount: 42,
    },
    {
      id: 'prod-02',
      sku: 'SDK-HD-CHR-330',
      name: 'Brutalist Fleece Hoodie 330G',
      categorySlug: 'hoodie',
      categoryName: 'Oversized Hoodie',
      silhouette: 'hoodie',
      price: 429000,
      compareAtPrice: 489000,
      fabricWeight: '330 GSM Cotton Fleece',
      fit: 'Oversized Cropped',
      description:
        'Hoodie fleece katun 330gsm tanpa resleting dengan double-layered hood yang tegak berdiri. Siap dikustomisasi dengan sablon DTF.',
      images: [
        '/src/assets/images/prod_oversized_hoodie_1795511847099.jpg',
        '/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg',
      ],
      colors: [],
      sizes: { S: 8, M: 15, L: 19, XL: 14, XXL: 6 },
      isCustomBase: true,
      featured: true,
      rating: 4.9,
      reviewCount: 28,
    },
    {
      id: 'prod-03',
      sku: 'SDK-ACD-SLT-220',
      name: 'Mineral Acid Wash Tee 220G',
      categorySlug: 'acid-wash',
      categoryName: 'Acid Wash Series',
      silhouette: 'boxy-tee',
      price: 219000,
      fabricWeight: '220 GSM Enzyme Washed',
      fit: 'Relaxed Street',
      description:
        'Pewarnaan reaktif dengan pencucian mineral menghasilkan gradasi slate abu-abu unik di setiap helainya.',
      images: [
        '/src/assets/images/prod_acid_wash_tee_1795511848578.jpg',
        '/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg',
      ],
      colors: [],
      sizes: { S: 12, M: 22, L: 25, XL: 16, XXL: 9 },
      isCustomBase: true,
      featured: true,
      rating: 4.8,
      reviewCount: 19,
    },
    {
      id: 'prod-04',
      sku: 'SDK-DTF-GEO-240',
      name: 'Urban Geometry DTF Edition',
      categorySlug: 'dtf-edition',
      categoryName: 'DTF Edition',
      silhouette: 'boxy-tee',
      price: 249000,
      compareAtPrice: 285000,
      fabricWeight: '240 GSM Combed Heavy',
      fit: 'Boxy Drop-Shoulder',
      description:
        'Edisi siap pakai dengan cetak DTF punggung A3+ tinta Jepang matte finish. Daya lekat tinggi pada suhu press 165°C.',
      images: [
        '/src/assets/images/prod_cream_graphic_tee_1795511847871.jpg',
        '/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg',
      ],
      colors: [],
      sizes: { S: 10, M: 17, L: 21, XL: 13, XXL: 5 },
      isCustomBase: false,
      featured: true,
      rating: 5.0,
      reviewCount: 31,
    },
    {
      id: 'prod-05',
      sku: 'SDK-CMB-BLK-185',
      name: 'Studio Essential Combed 24s',
      categorySlug: 'boxy-tee',
      categoryName: 'Boxy Heavy Tee',
      silhouette: 'regular-tee',
      price: 135000,
      fabricWeight: '185 GSM Combed 24s',
      fit: 'Modern Regular',
      description:
        'Blank kaos harian untuk komunitas, brand merchandise, dan produksi DTF cepat.',
      images: [
        '/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg',
        '/src/assets/images/prod_cream_graphic_tee_1795511847871.jpg',
      ],
      colors: [],
      sizes: { S: 45, M: 68, L: 72, XL: 40, XXL: 22 },
      isCustomBase: true,
      featured: false,
      rating: 4.8,
      reviewCount: 54,
    },
  ];

  const dtfZones: DtfZonePrice[] = [
    {
      id: 'front-chest',
      label: 'Depan Dada (Logo)',
      dimensionsCm: '10 × 10 cm',
      maxWidthCm: 10,
      maxHeightCm: 10,
      price: 20000,
      view: 'front',
      box: { x: 56, y: 27, w: 18, h: 16 },
    },
    {
      id: 'front-a4',
      label: 'Depan Tengah A4',
      dimensionsCm: '21 × 29 cm',
      maxWidthCm: 21,
      maxHeightCm: 29,
      price: 38000,
      view: 'front',
      box: { x: 33, y: 26, w: 34, h: 38 },
    },
    {
      id: 'front-a3',
      label: 'Depan Full A3',
      dimensionsCm: '29 × 42 cm',
      maxWidthCm: 29,
      maxHeightCm: 42,
      price: 55000,
      view: 'front',
      box: { x: 29, y: 24, w: 42, h: 50 },
    },
    {
      id: 'back-a3plus',
      label: 'Punggung Besar A3+',
      dimensionsCm: '32 × 45 cm',
      maxWidthCm: 32,
      maxHeightCm: 45,
      price: 65000,
      view: 'back',
      box: { x: 28, y: 21, w: 44, h: 54 },
    },
    {
      id: 'sleeve-left',
      label: 'Lengan Kiri',
      dimensionsCm: '8 × 8 cm',
      maxWidthCm: 8,
      maxHeightCm: 8,
      price: 15000,
      view: 'sleeve',
      box: { x: 16, y: 31, w: 15, h: 15 },
    },
    {
      id: 'sleeve-right',
      label: 'Lengan Kanan',
      dimensionsCm: '8 × 8 cm',
      maxWidthCm: 8,
      maxHeightCm: 8,
      price: 15000,
      view: 'sleeve',
      box: { x: 69, y: 31, w: 15, h: 15 },
    },
  ];

  const inventory: InventoryItem[] = [
    {
      id: 'inv-1',
      sku: 'SDK-BXY-BLK-240',
      name: 'Blank Boxy Heavyweight 240G (Jet Black)',
      category: 'Blank Garment',
      stock: 113,
      minThreshold: 25,
      unit: 'pcs',
      warehouse: 'Bandung Studio A',
      lastSyncedAt: now,
    },
    {
      id: 'inv-2',
      sku: 'SDK-HD-CHR-330',
      name: 'Blank Brutalist Fleece 330G (Charcoal)',
      category: 'Blank Garment',
      stock: 62,
      minThreshold: 15,
      unit: 'pcs',
      warehouse: 'Bandung Studio A',
      lastSyncedAt: now,
    },
    {
      id: 'inv-3',
      sku: 'SDK-ACD-SLT-220',
      name: 'Blank Mineral Acid Wash 220G (Slate)',
      category: 'Blank Garment',
      stock: 84,
      minThreshold: 20,
      unit: 'pcs',
      warehouse: 'Bandung Studio B',
      lastSyncedAt: now,
    },
    {
      id: 'inv-4',
      sku: 'SDK-CMB-BLK-185',
      name: 'Blank Essential Combed 24s',
      category: 'Blank Garment',
      stock: 247,
      minThreshold: 40,
      unit: 'pcs',
      warehouse: 'Bandung Studio A',
      lastSyncedAt: now,
    },
    {
      id: 'inv-5',
      sku: 'DTF-FILM-60CM',
      name: 'PET Film Cold Peel Roll 60cm × 100m',
      category: 'DTF Film & Ink',
      stock: 19,
      minThreshold: 5,
      unit: 'roll',
      warehouse: 'Print Lab DTF',
      lastSyncedAt: now,
    },
    {
      id: 'inv-6',
      sku: 'DTF-INK-WHT-1L',
      name: 'Tinta DTF High-Opacity White 1000ml',
      category: 'DTF Film & Ink',
      stock: 14,
      minThreshold: 4,
      unit: 'botol',
      warehouse: 'Print Lab DTF',
      lastSyncedAt: now,
    },
  ];

  const orders: Order[] = [
    {
      id: 'SDK-2026-1042',
      customerName: 'Raka Pratama',
      customerEmail: 'raka.pratama@example.com',
      customerPhone: '081298765432',
      shippingAddress: 'Jl. Dago Pakar Barat No. 18',
      shippingCity: 'Bandung',
      shippingCourier: 'JNE Express',
      shippingEtaDays: 2,
      items: [
        {
          id: 'item-1042',
          type: 'custom_dtf',
          productId: 'prod-01',
          sku: 'SDK-BXY-BLK-240',
          name: 'Custom DTF Boxy Heavyweight 240G',
          image: '/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg',
          colorName: 'Jet Black',
          colorHex: '#080808',
          size: 'L',
          quantity: 2,
          unitPrice: 244000,
          fabricName: 'Heavyweight US Cotton (240 GSM)',
          estimatedDays: 3,
          customModel: 'Sandikale Boxy Heavyweight 240G',
        },
      ],
      subtotal: 488000,
      shippingCost: 18000,
      discount: 0,
      total: 506000,
      paymentMethod: 'qris',
      paymentLabel: 'QRIS Instant',
      paymentReference: 'QRIS-SDK-884120',
      paymentStatus: 'paid',
      stage: 'Proses Cetak DTF',
      trackingNumber: 'JNE-SDK-9902184',
      timeline: [
        { stage: 'Menunggu Pembayaran', timestamp: '2026-11-23T09:10:00Z', note: 'Invoice dibuat otomatis.', completed: true },
        { stage: 'Verifikasi Desain DTF', timestamp: '2026-11-23T09:15:00Z', note: 'Pembayaran QRIS terverifikasi. File artwork 300 DPI lolos pra-cetak.', completed: true },
        { stage: 'Proses Cetak DTF', timestamp: '2026-11-23T14:30:00Z', note: 'Film PET sedang dicetak 8-pass dengan lapisan tinta putih.', completed: true },
        { stage: 'Heat Press & QC', timestamp: '', note: 'Menunggu curing 165°C dan inspeksi jahitan.', completed: false },
        { stage: 'Dikirim', timestamp: '', note: 'Siap diserahkan ke kurir.', completed: false },
        { stage: 'Selesai', timestamp: '', note: 'Pesanan tiba di alamat tujuan.', completed: false },
      ],
      createdAt: '2026-11-23T09:10:00Z',
      updatedAt: '2026-11-23T14:30:00Z',
    },
    {
      id: 'SDK-2026-1039',
      customerName: 'Nadia Kusuma',
      customerEmail: 'nadia.kusuma@example.com',
      customerPhone: '081355443322',
      shippingAddress: 'Jl. Kemang Raya No. 45',
      shippingCity: 'Jakarta Selatan',
      shippingCourier: 'SiCepat BEST',
      shippingEtaDays: 1,
      items: [
        {
          id: 'item-1039',
          type: 'catalog',
          productId: 'prod-04',
          sku: 'SDK-DTF-GEO-240',
          name: 'Urban Geometry DTF Edition',
          image: '/src/assets/images/prod_cream_graphic_tee_1795511847871.jpg',
          colorName: 'Bone Cream',
          colorHex: '#EAE6DF',
          size: 'M',
          quantity: 1,
          unitPrice: 249000,
        },
      ],
      subtotal: 249000,
      shippingCost: 15000,
      discount: 0,
      total: 264000,
      paymentMethod: 'va_bca',
      paymentLabel: 'BCA Virtual Account',
      paymentReference: 'VA-BCA-3901039',
      paymentStatus: 'paid',
      stage: 'Selesai',
      trackingNumber: 'SCP-SDK-771204',
      timeline: [
        { stage: 'Menunggu Pembayaran', timestamp: '2026-11-18T10:00:00Z', note: 'Invoice VA BCA terbit.', completed: true },
        { stage: 'Verifikasi Desain DTF', timestamp: '2026-11-18T10:12:00Z', note: 'Pembayaran diterima otomatis.', completed: true },
        { stage: 'Proses Cetak DTF', timestamp: '2026-11-18T13:00:00Z', note: 'Selesai cetak.', completed: true },
        { stage: 'Heat Press & QC', timestamp: '2026-11-18T16:40:00Z', note: 'Lolos QC ketahanan tarik.', completed: true },
        { stage: 'Dikirim', timestamp: '2026-11-19T08:30:00Z', note: 'Paket berangkat via SiCepat BEST.', completed: true },
        { stage: 'Selesai', timestamp: '2026-11-20T14:20:00Z', note: 'Diterima oleh Nadia Kusuma.', completed: true },
      ],
      createdAt: '2026-11-18T10:00:00Z',
      updatedAt: '2026-11-20T14:20:00Z',
    },
  ];

  const reviews: ProductReview[] = [
    {
      id: 'rev-1',
      productId: 'prod-01',
      orderId: 'SDK-2026-1039',
      authorName: 'Dimas Aditya',
      rating: 5,
      comment: 'Kain 240gsm-nya jatuh banget di badan, hasil sablon DTF custom saya tajam dan tidak kaku.',
      verifiedPurchase: true,
      createdAt: '2026-11-21T08:15:00Z',
    },
    {
      id: 'rev-2',
      productId: 'prod-04',
      orderId: 'SDK-2026-1039',
      authorName: 'Nadia Kusuma',
      rating: 5,
      comment: 'Detail warna oranye dan hitamnya pekat, pengiriman cepat ke Jakarta Selatan.',
      verifiedPurchase: true,
      createdAt: '2026-11-20T16:00:00Z',
    },
  ];

  const webhookLogs: WebhookLogEntry[] = [
    {
      id: 'whl-1',
      eventId: 'evt_supa_9081a',
      direction: 'inbound_supabase',
      table: 'inventory_items',
      operation: 'UPDATE',
      sku: 'SDK-BXY-BLK-240',
      itemName: 'Blank Boxy Heavyweight 240G (Jet Black)',
      previousStock: 115,
      newStock: 113,
      status: 'delivered',
      attempt: 1,
      maxAttempts: 3,
      latencyMs: 38,
      signatureVerified: true,
      payloadPreview: '{"type":"UPDATE","table":"inventory_items","record":{"sku":"SDK-BXY-BLK-240","stock":113}}',
      createdAt: '2026-11-23T09:15:02Z',
    },
  ];

  const emailOutbox: EmailNotification[] = [
    {
      id: 'eml-1',
      orderId: 'SDK-2026-1042',
      toEmail: 'raka.pratama@example.com',
      subject: '[SANDIKALE] Pesanan SDK-2026-1042 Masuk Proses Cetak DTF',
      body: 'Halo Raka Pratama, desain DTF kustom Anda telah lolos verifikasi 300 DPI dan sedang masuk antrean mesin cetak DTF.',
      stage: 'Proses Cetak DTF',
      sentAt: '2026-11-23T14:30:05Z',
    },
  ];

  const chatMessages: ChatMessage[] = [
    {
      id: 'chat-1',
      roomId: 'public-support',
      senderRole: 'admin',
      senderName: 'Tim Produksi SANDIKALE',
      text: 'Halo! Ada yang bisa kami bantu soal ukuran boxy tee atau resolusi file desain DTF Anda?',
      createdAt: now,
    },
  ];

  const baselineMonthly: MonthlyRevenuePoint[] = [
    { month: 'Jun', revenue: 18400000, orders: 64, customDtfShare: 58 },
    { month: 'Jul', revenue: 22900000, orders: 79, customDtfShare: 62 },
    { month: 'Agu', revenue: 26150000, orders: 91, customDtfShare: 66 },
    { month: 'Sep', revenue: 31800000, orders: 108, customDtfShare: 71 },
    { month: 'Okt', revenue: 38450000, orders: 132, customDtfShare: 74 },
  ];

  // Note: Fabrics, garmentColors, paymentMethods (enabled: false), and shippingCouriers (enabled: false)
  // are intentionally NOT exposed/published until filled/permitted by Admin!
  return {
    adminPasswordHash: null,
    categories,
    products,
    fabrics: [],
    garmentColors: [],
    paymentMethods: defaultPaymentMethods(),
    shippingOriginCity: 'Kota Produksi SANDIKALE',
    adminWhatsapp: '6281234567890',
    shippingCouriers: defaultShippingCouriers(),
    dtfZones,
    orders,
    reviews,
    inventory,
    webhookLogs,
    emailOutbox,
    chatMessages,
    bugReports: [],
    users: [],
    baselineMonthly,
  };
}

class Store {
  private db: DatabaseSchema;

  constructor() {
    this.db = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && Array.isArray(parsed.products)) {
          // Ensure newly added arrays exist on older persisted DB files
          if (!Array.isArray(parsed.garmentColors)) parsed.garmentColors = [];
          if (!Array.isArray(parsed.paymentMethods)) parsed.paymentMethods = defaultPaymentMethods();
          if (!parsed.shippingOriginCity) parsed.shippingOriginCity = 'Kota Produksi SANDIKALE';
          if (!parsed.adminWhatsapp) parsed.adminWhatsapp = '6281234567890';
          if (!Array.isArray(parsed.shippingCouriers)) {
            parsed.shippingCouriers = defaultShippingCouriers();
          } else {
            parsed.shippingCouriers = parsed.shippingCouriers.map((c) => ({
              ...c,
              serviceArea: c.serviceArea || 'Seluruh Indonesia',
            }));
          }
          parsed.products = parsed.products.map((p) => ({
            ...p,
            frontImage: p.frontImage || p.images?.[0] || '/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg',
            backImage: p.backImage || p.images?.[1] || p.images?.[0] || '/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg',
            silhouette:
              p.silhouette ||
              (p.categorySlug === 'hoodie' ? 'hoodie' : p.sku.includes('CMB') ? 'regular-tee' : 'boxy-tee'),
          }));
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to load DB, creating fresh store:', err);
    }
    const fresh = createInitialDb();
    this.persist(fresh);
    return fresh;
  }

  private persist(data: DatabaseSchema = this.db): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpPath = path.resolve(DATA_DIR, 'sandikale-db.tmp.json');
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmpPath, DB_PATH);
    } catch (err) {
      console.error('Persist error:', err);
    }
  }

  save(): void {
    this.persist(this.db);
  }

  get data(): DatabaseSchema {
    return this.db;
  }

  isAdminConfigured(): boolean {
    const envCode = process.env.ADMIN_PASSCODE?.trim();
    return Boolean((envCode && envCode.length > 0) || this.db.adminPasswordHash);
  }

  hasEnvAdminPasscode(): boolean {
    return Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
  }

  verifyAdminPasscode(passcode: string): boolean {
    const envCode = process.env.ADMIN_PASSCODE?.trim();
    if (envCode && envCode.length > 0) {
      const a = Buffer.from(passcode);
      const b = Buffer.from(envCode);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    }
    if (this.db.adminPasswordHash) {
      return verifyPassword(passcode, this.db.adminPasswordHash);
    }
    return false;
  }

  claimAdminPasscode(passcode: string): boolean {
    if (this.isAdminConfigured()) return false;
    this.db.adminPasswordHash = hashPassword(passcode);
    this.save();
    return true;
  }

  registerCustomer(input: { name: string; email: string; phone: string; password: string }): UserProfile | { error: string } {
    const cleanEmail = input.email.trim().toLowerCase();
    if (this.db.users.some((u) => u.email === cleanEmail)) {
      return { error: 'Email sudah terdaftar.' };
    }
    const user: StoredUser = {
      id: `usr-${crypto.randomBytes(6).toString('hex')}`,
      name: input.name.trim(),
      email: cleanEmail,
      phone: input.phone.trim(),
      role: 'customer',
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    this.db.users.push(user);
    this.save();
    const { passwordHash: _ph, ...safeUser } = user;
    return safeUser;
  }

  authenticateCustomer(email: string, password: string): UserProfile | null {
    const cleanEmail = email.trim().toLowerCase();
    const found = this.db.users.find((u) => u.email === cleanEmail);
    if (!found) return null;
    if (!verifyPassword(password, found.passwordHash)) return null;
    const { passwordHash: _ph, ...safeUser } = found;
    return safeUser;
  }

  getMonthlyAnalytics(): MonthlyRevenuePoint[] {
    const novOrders = this.db.orders.filter((o) => o.paymentStatus === 'paid');
    const novRevenue = novOrders.reduce((acc, o) => acc + o.total, 0);
    const customCount = novOrders.filter((o) => o.items.some((i) => i.type === 'custom_dtf')).length;
    const share = novOrders.length > 0 ? Math.round((customCount / novOrders.length) * 100) : 76;
    return [
      ...this.db.baselineMonthly,
      {
        month: 'Nov',
        revenue: 39200000 + novRevenue,
        orders: 128 + novOrders.length,
        customDtfShare: share,
      },
    ];
  }

  appendEmailNotification(order: Order, stage: OrderStage, customNote?: string): EmailNotification {
    const noteMap: Record<OrderStage, string> = {
      'Menunggu Pembayaran': `Menunggu konfirmasi pembayaran sebesar Rp ${order.total.toLocaleString('id-ID')} melalui ${order.paymentLabel}.`,
      'Verifikasi Desain DTF': 'Pembayaran diterima. Tim Pra-Cetak sedang memeriksa resolusi dan dimensi file DTF Anda.',
      'Proses Cetak DTF': 'Desain lolos kurasi dan sedang masuk mesin cetak DTF 8-pass.',
      'Heat Press & QC': 'Sablon sedang dipress pada suhu 165°C dan melewati inspeksi kualitas akhir.',
      Dikirim: `Paket telah diserahkan ke ${order.shippingCourier} dengan nomor resi ${order.trackingNumber}.`,
      Selesai: 'Pesanan telah diterima. Terima kasih telah berkarya bersama SANDIKALE!',
    };
    const email: EmailNotification = {
      id: `eml-${crypto.randomBytes(4).toString('hex')}`,
      orderId: order.id,
      toEmail: order.customerEmail,
      subject: `[SANDIKALE] Status Pesanan ${order.id}: ${stage}`,
      body: `Halo ${order.customerName}, ${customNote || noteMap[stage]}`,
      stage,
      sentAt: new Date().toISOString(),
    };
    this.db.emailOutbox.unshift(email);
    if (this.db.emailOutbox.length > 100) this.db.emailOutbox.pop();
    return email;
  }
}

export const store = new Store();
