import { ArrowRight, Bell, Bug, CheckCircle2, HelpCircle, Instagram, Layers, Lock, Shield, Sparkles, Truck, X } from 'lucide-react';
import heroImage from './assets/images/hero_sandikale_streetwear_1795511846725.jpg';
import brandDetailImage from './assets/images/prod_cream_graphic_tee_1795511847871.jpg';
import sandikaleLogo from './assets/sandikale-logo.svg';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminDashboardSupabase } from './components/AdminDashboardSupabase';
import { CartCheckoutDrawer } from './components/CartCheckoutDrawer';
import { CustomDtfStudio } from './components/CustomDtfStudio';
import { Navbar } from './components/Navbar';
import { OrderTrackingSection } from './components/OrderTrackingSection';
import { ProductCatalog } from './components/ProductCatalog';
import { ProductQuickViewModal } from './components/ProductQuickViewModal';
import { AccountModal, BugReportModal, LiveChatWidget, TutorialModal } from './components/SupportModals';
import { invokeShowroom, artworkForUpload, supabase } from './lib/supabase';
import { loadShowroomBootstrap } from './lib/showroom-bootstrap';
import type {
  CartItem,
  Category,
  BulkDiscountRule,
  PrintingMethodOption,
  ChatMessage,
  DtfZonePrice,
  EmailNotification,
  FabricOption,
  GarmentColorOption,
  Order,
  PaymentMethodConfig,
  PaymentMethodId,
  Product,
  ProductReview,
  UserProfile,
} from './types';

const HERO_IMAGE = heroImage;
const CACHE_BOOTSTRAP_KEY = 'sandikale_offline_bootstrap_v2';
const CACHE_CART_KEY = 'sandikale_cart_v1';
const CACHE_WISHLIST_KEY = 'sandikale_wishlist_v1';
const TUTORIAL_SEEN_KEY = 'sandikale_tutorial_seen_v1';

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(
    () => typeof window !== 'undefined' && (window.location.pathname.endsWith('/admin') || new URLSearchParams(window.location.search).get('view') === 'admin')
  );
  const [darkMode, setDarkMode] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [siteContent, setSiteContent] = useState({
    brandName: 'SANDIKALE',
    brandTagline: 'Design & Productions',
    instagramUrl: 'https://instagram.com/_sandikale',
    instagramHandle: '@_sandikale',
    storeAddress: 'Dusun Penangke, Desa Sesaot, Narmada, Lombok Barat, NTB',
    announcement: 'SANDIKALE · CUSTOM APPAREL · SABLON DTF SATUAN · PRODUKSI SESUAI PESANAN',
    heroEyebrow: 'SANDIKALE / CUSTOM APPAREL & DTF STUDIO',
    heroTitle: 'CUSTOM APPAREL.|IDENTITAS DALAM SETIAP DETAIL.',
    heroSubtitle: 'SANDIKALE melayani custom kaos satuan, sablon DTF, dan produksi apparel sesuai kebutuhan. Pilih produk, tentukan warna, unggah desain, lalu konsultasikan detail pesanan bersama admin kami.',
    primaryCta: 'Mulai Custom',
    secondaryCta: 'Jelajahi Katalog',
    heroImage: '',
    brandDetailImage: '',
    theme: { accent: '#7A1F2B', background: '#080808', surface: '#171717', text: '#ffffff', muted: '#a3a3a3' },
    gallery: [] as Array<{image:string;caption:string;alt:string}>,
  });

  const [activeSection, setActiveSection] = useState('hero');

  // Storefront data (filtered server-side to admin-permitted items only)
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fabrics, setFabrics] = useState<FabricOption[]>([]);
  const [garmentColors, setGarmentColors] = useState<GarmentColorOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [adminWhatsapp, setAdminWhatsapp] = useState('6282266412844');
  const [dtfZones, setDtfZones] = useState<DtfZonePrice[]>([]);
  const [bulkDiscounts, setBulkDiscounts] = useState<BulkDiscountRule[]>([{minQuantity:6,discountPercent:6},{minQuantity:12,discountPercent:12}]);
  const [printingMethods, setPrintingMethods] = useState<PrintingMethodOption[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [emailOutbox, setEmailOutbox] = useState<EmailNotification[]>([]);

  // Auth tokens strictly kept in React memory
  const [customerUser, setCustomerUser] = useState<UserProfile | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CACHE_CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CACHE_WISHLIST_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [studioProduct, setStudioProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const applySession = (session: any) => {
      if (!alive) return;
      if (!session) { setCustomerToken(null); setCustomerUser(null); return; }
      setCustomerToken(session.access_token);
      setCustomerUser({
        id: session.user.id,
        name: String(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Pelanggan'),
        email: session.user.email || '',
        phone: String(session.user.user_metadata?.phone || ''),
        role: 'customer',
        createdAt: session.user.created_at,
      });
    };
    void supabase.auth.getSession().then(({ data }) => applySession(data.session as typeof data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => applySession(session as typeof session));
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    try {
      if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) {
        const t = window.setTimeout(() => setTutorialOpen(true), 600);
        return () => window.clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, [isAdminRoute]);

  const handleCloseTutorial = () => {
    setTutorialOpen(false);
    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    } catch {
      // ignore
    }
  };

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 4500);
  }, []);

  const triggerPushBanner = useCallback(
    (title: string, body: string) => {
      showToast(`${title}: ${body}`);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(title, { body });
        } catch {
          // ignore
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    const onPopState = () => {
      setIsAdminRoute(window.location.pathname.endsWith('/admin') || new URLSearchParams(window.location.search).get('view') === 'admin');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(CACHE_CART_KEY, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(CACHE_WISHLIST_KEY, JSON.stringify(wishlistIds));
    } catch {
      // ignore
    }
  }, [wishlistIds]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Koneksi kembali online — data disinkronkan.');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Mode offline aktif — keranjang dan draf studio tetap tersimpan.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  const loadBootstrap = useCallback(async () => {
    try {
      const data = await loadShowroomBootstrap();
      setSiteContent(data.siteContent);
      setCategories(data.categories);
      setProducts(data.products);
      setFabrics(data.fabrics);
      setGarmentColors(data.garmentColors);
      setPaymentMethods(data.paymentMethods);
      setAdminWhatsapp(data.adminWhatsapp);
      setDtfZones(data.dtfZones);
      setBulkDiscounts(data.bulkDiscounts || []);
      setPrintingMethods(data.printingMethods || []);
      setReviews(data.reviews);
      setChatMessages(data.chatMessages);
      try { localStorage.setItem(CACHE_BOOTSTRAP_KEY, JSON.stringify(data)); } catch { /* optional offline cache */ }
      return true;
    } catch (error) {
      console.error('Supabase showroom bootstrap failed:', error);
      showToast('Katalog belum dapat dimuat. Periksa koneksi database.');
      try {
        const cached = localStorage.getItem(CACHE_BOOTSTRAP_KEY);
        if (cached) {
          const data = JSON.parse(cached);
          setSiteContent(data.siteContent || siteContent);
          setCategories(data.categories || []);
          setProducts(data.products || []);
          setFabrics(data.fabrics || []);
          setGarmentColors(data.garmentColors || []);
          setPaymentMethods(data.paymentMethods || []);
          setAdminWhatsapp(data.adminWhatsapp || '6282266412844');
          setDtfZones(data.dtfZones || []);
          setBulkDiscounts(data.bulkDiscounts || []);
          setPrintingMethods(data.printingMethods || []);
          setReviews(data.reviews || []);
        }
      } catch { /* ignore invalid cache */ }
      return false;
    } finally {
      setIsInitialLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void loadBootstrap(); }, [loadBootstrap]);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        window.setTimeout(() => { void loadBootstrap(); }, 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadBootstrap]);
  useEffect(() => { setHeroImageFailed(false); }, [siteContent.heroImage]);
  const refreshShowroom = useCallback(async () => {
    setIsRefreshing(true);
    try { const loaded = await loadBootstrap(); showToast(loaded ? 'Data katalog dan tampilan SANDIKALE berhasil dimuat ulang.' : 'Koneksi database gagal. Tampilan sementara menggunakan data tersimpan di perangkat.'); }
    finally { setIsRefreshing(false); }
  }, [loadBootstrap, showToast]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void loadBootstrap(); }, 400);
    };
    const channel = supabase.channel('showroom-public-catalog')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_products' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_categories' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_dtf_prices' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_settings' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_materials' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_product_images' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_product_variants' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_colors' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_product_colors' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_printing_methods' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_garment_mockups' }, scheduleRefresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadBootstrap]);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleOpenQuickView = (product: Product) => {
    setQuickViewProduct(product);
    setRecentlyViewed((prev) => [product, ...prev.filter((p) => p.id !== product.id)].slice(0, 6));
  };

  const handleToggleWishlist = (productId: string) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(productId);
      showToast(exists ? 'Dihapus dari wishlist.' : 'Disimpan ke wishlist.');
      return exists ? prev.filter((id) => id !== productId) : [...prev, productId];
    });
  };

  const handleAddCatalogToCart = (payload: {
    product: Product;
    colorName: string;
    colorHex: string;
    size: string;
    quantity: number;
  }) => {
    const { product, colorName, colorHex, size, quantity } = payload;
    const sizeSurcharge = product.sizeSurcharges?.[size] || 0;
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.type === 'catalog' && i.productId === product.id && i.colorName === colorName && i.size === size
      );
      if (existing) {
        return prev.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [
        ...prev,
        {
          id: `${product.id}-${colorName}-${size}-${Date.now()}`,
          type: 'catalog',
          productId: product.id,
          sku: product.sku,
          name: product.name,
          image: product.images[0],
          colorName,
          colorHex,
          size,
          quantity,
          unitPrice: product.price + sizeSurcharge,
        },
      ];
    });
    showToast(`${product.name} (${size}) ditambahkan ke tas.`);
    setCartOpen(true);
  };

  const handleAddCustomToCart = (item: CartItem) => {
    setCart((prev) => [...prev, item]);
    showToast(`Desain Custom DTF (${item.customPlacements?.length || 1} zona) ditambahkan ke tas.`);
    setCartOpen(true);
  };

  const handleCreateOrder = async (payload: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: string;
    shippingCity: string;
    shippingCourier: string;
    items: CartItem[];
    paymentMethod: PaymentMethodId;
    paymentLabel: string;
  }): Promise<Order | null> => {
    try {
      const items = await Promise.all(payload.items.map(async (item) => {
        const placements = item.customPlacements || [];
        return {
          product_id: item.productId,
          bulk_discount_eligible: item.type === 'custom_dtf',
          allow_color_request: true,
          material_id: item.fabricId,
          quantity: item.quantity,
          garment_type: /long|lengan panjang/i.test(item.customModel || item.name) ? 'long' : 'short',
          color: item.colorName,
          sizes: [{ size: item.size, quantity: item.quantity }],
          prints: await Promise.all(placements.map(async (placement) => {
            const zone = dtfZones.find((entry) => entry.id === placement.zoneId);
            const legacyPosition = ({ A6: 'Depan - Dada kiri', A5: 'Lengan kiri', A4: 'Depan - Tengah', A3: 'Belakang - Tengah' } as Record<string, string>)[placement.zoneId];
            const position = zone?.view === 'sleeve' ? 'Lengan kiri' : zone?.view === 'back' ? 'Belakang - Tengah' : /logo/i.test(zone?.id || zone?.label || '') ? 'Depan - Dada kiri' : zone?.view === 'front' ? 'Depan - Tengah' : legacyPosition || 'Depan - Tengah';
            return {
            position,
            size_code: placement.zoneId,
            ...await artworkForUpload(placement.artworkDataUrl, placement.artworkName || 'design.png'),
            transform: {
              x: 50 + placement.xOffset,
              y: 50 + placement.yOffset,
              width: zone?.maxWidthCm || 12,
              scale: placement.scale,
              rotation: placement.rotation,
            },
            };
          })),
        };
      }));
      const data = await invokeShowroom<{
        order_number: string; spk_number: string; tracking_code: string; total_amount: number;
        deposit_amount: number; remaining_amount: number; customer_name: string;
      }>({
        action: 'create_order',
        customer: {
          name: payload.customerName,
          email: payload.customerEmail,
          phone: payload.customerPhone,
          address: payload.shippingCourier === 'Diantar Kurir' ? [payload.shippingAddress, payload.shippingCity].filter(Boolean).join(', ') : '',
          city: payload.shippingCourier === 'Diantar Kurir' ? payload.shippingCity : '',
          notes: `Metode pembayaran: ${payload.paymentLabel}; Pengambilan: ${payload.shippingCourier}. ${payload.shippingCourier === 'Ambil Sendiri di Store' ? 'Tidak menggunakan kurir dan tidak ada biaya pengiriman.' : 'Alamat dan biaya pengiriman dikonfirmasi admin melalui WhatsApp.'}`,
        },
        shipping: {
          method: payload.shippingCourier === 'Ambil Sendiri di Store' ? 'pickup' : 'courier',
          address: payload.shippingAddress,
          city: payload.shippingCity,
        },
        items,
        payment_label: payload.paymentLabel,
        deposit_amount: 0,
      });
      const now = new Date().toISOString();
      const order = {
        id: data.order_number,
        spkNumber: data.spk_number,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        customerPhone: payload.customerPhone,
        shippingAddress: payload.shippingAddress,
        shippingCity: payload.shippingCity,
        shippingCourier: payload.shippingCourier,
        shippingEtaDays: 0,
        items: payload.items,
        subtotal: data.total_amount,
        shippingCost: 0,
        discount: 0,
        total: data.total_amount,
        paymentMethod: payload.paymentMethod,
        paymentLabel: payload.paymentLabel,
        paymentReference: data.tracking_code,
        paymentStatus: 'pending' as const,
        stage: 'Menunggu Pembayaran' as const,
        trackingNumber: data.tracking_code,
        timeline: [{ stage: 'Menunggu Pembayaran' as const, timestamp: now, note: 'Pesanan diterima dan menunggu konfirmasi admin.', completed: true }],
        createdAt: now,
        updatedAt: now,
      } as Order;
      setRecentOrders((prev) => [order, ...prev]);
      setCart([]);
      showToast(`Pesanan ${data.order_number} berhasil dikirim. Simpan kode tracking untuk memantau pesanan.`);
      return order;
    } catch (error) {
      // Let checkout display the actual API validation message instead of masking it
      // as a generic payment/shipping configuration failure.
      throw error instanceof Error ? error : new Error('Pesanan gagal dikirim ke server.');
    }
  };

  const handleTrackOrder = async (trackingCode: string) => {
    try {
      const data = await invokeShowroom<Record<string, any>>({ action: 'track_order', tracking_code: trackingCode });
      const statusMap: Record<string, Order['stage']> = {
        customer_submitted: 'Menunggu Pembayaran',
        waiting_admin_confirmation: 'Menunggu Pembayaran',
        waiting_payment: 'Menunggu Pembayaran',
        waiting_design_review: 'Verifikasi Desain DTF',
        revision_requested: 'Verifikasi Desain DTF',
        waiting_customer_approval: 'Verifikasi Desain DTF',
        approved: 'Verifikasi Desain DTF',
        in_production: 'Proses Cetak DTF',
        printing: 'Proses Cetak DTF',
        production: 'Heat Press & QC',
        quality_control: 'Heat Press & QC',
        ready: 'Dikirim',
        shipped: 'Dikirim',
        completed: 'Selesai',
      };
      const order = {
        id: data.order_number,
        spkNumber: data.spk_number || data.order_number,
        customerName: data.showroom_customers?.name || '',
        customerEmail: data.showroom_customers?.email || '',
        customerPhone: data.showroom_customers?.whatsapp || '',
        shippingAddress: data.shipping_method === 'pickup' ? '' : data.shipping_address || data.showroom_customers?.address || '',
        shippingCity: data.shipping_city || '',
        shippingCourier: data.shipping_method === 'pickup' ? 'Ambil Sendiri di Store' : data.shipping_method === 'courier' ? 'Diantar Kurir' : 'Konfirmasi melalui WhatsApp',
        shippingEtaDays: 0,
        items: (data.items || []).map((item: any) => {
          const variants = item.showroom_order_variants || [];
          const spec = item.specification || {};
          const quantity = Number(item.quantity || 0);
          return {
            id: item.id, type: Array.isArray(spec.dtf_prints) && spec.dtf_prints.length ? 'custom_dtf' : 'catalog',
            productId: item.product_id, sku: String(item.product_id || '').slice(0, 8),
            name: item.product_name_snapshot, image: HERO_IMAGE,
            colorName: variants[0]?.color || spec.color || '-', colorHex: '#777777',
            size: variants.map((variant: any) => variant.size + '×' + variant.quantity).join(', '),
            quantity, unitPrice: quantity ? Number(item.subtotal || 0) / quantity : 0,
            fabricName: item.material_snapshot || undefined,
          };
        }),
        subtotal: Number(data.subtotal || 0),
        shippingCost: 0,
        discount: 0,
        total: Number(data.total_amount || 0),
        paymentMethod: 'qris',
        paymentLabel: 'Pembayaran manual',
        paymentReference: '',
        paymentStatus: data.payment_status === 'paid' ? 'paid' : 'pending',
        stage: data.shipping_method === 'pickup' && ['ready', 'shipped'].includes(data.status) ? 'Siap Diambil' : statusMap[data.status] || 'Menunggu Pembayaran',
        trackingNumber: trackingCode,
        timeline: (data.history || []).map((event: any) => ({
          stage: data.shipping_method === 'pickup' && ['ready', 'shipped'].includes(event.new_status) ? 'Siap Diambil' : statusMap[event.new_status] || 'Menunggu Pembayaran',
          timestamp: event.created_at,
          note: event.notes || '',
          completed: true,
        })),
        createdAt: data.created_at,
        updatedAt: data.created_at,
        designs: (data.designs || []).map((design: any) => ({
          id: design.id,
          productName: design.product_name,
          approvalStatus: design.approval_status,
          designVersion: Number(design.design_version || 1),
          designConfiguration: design.design_configuration || {},
          previewUrl: design.preview_url || null,
        })),
        designApprovalOpen: data.status === 'waiting_customer_approval',
      } as Order;
      setRecentOrders((prev) => [order, ...prev.filter((entry) => entry.id !== order.id)]);
      return { order, emails: [] };
    } catch {
      return null;
    }
  };

  const handleDesignDecision = async (trackingCode: string, designId: string, decision: 'approved' | 'revision_requested', notes: string): Promise<boolean> => {
    try {
      await invokeShowroom({ action: 'design_decision', tracking_code: trackingCode, design_id: designId, decision, notes });
      showToast(decision === 'approved' ? 'Desain disetujui. Terima kasih.' : 'Permintaan revisi dikirim ke SANDIKALE.');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Keputusan desain gagal dikirim.');
      return false;
    }
  };

  const handleSubmitReview = async (payload: {
    productId: string;
    authorName: string;
    rating: number;
    comment: string;
  }) => {
    const { error } = await supabase.from('showroom_product_reviews').insert({
      product_id: payload.productId,
      author_name: payload.authorName.trim(),
      rating: payload.rating,
      comment: payload.comment.trim(),
    });
    if (error) showToast(error.message);
    else showToast('Ulasan terkirim dan menunggu moderasi admin.');
  };

  const handleSendChat = async (text: string, senderName: string) => {
    const message = ['Halo Admin SANDIKALE, saya ' + senderName + '.', '', text].join(String.fromCharCode(10));
    const url = `https://wa.me/${adminWhatsapp}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleEnableBrowserPush = async () => {
    showToast('Notifikasi otomatis belum diaktifkan. Gunakan kode tracking untuk memantau status pesanan.');
  };

  const handleOpenAdminLock = async () => {
    window.history.pushState({}, '', '?view=admin');
    setIsAdminRoute(true);
  };


  const exitAdminPortal = () => {
    try {
      window.history.pushState({}, '', window.location.pathname);
    } catch {
      // ignore history error in restricted frame
    }
    setIsAdminRoute(false);
    loadBootstrap();
  };

  // Private Admin Route — never exposed in public storefront DOM
  if (isAdminRoute) {
    return (
      <>
        {toastMsg && (
          <div
            role="status"
            className="fixed top-5 right-4 z-50 max-w-sm px-4 py-3 rounded-lg bg-[#080808] dark:bg-white text-white dark:text-[#080808] shadow-xl border border-[#7A1F2B]/40 flex items-center gap-2.5 text-xs font-medium"
          >
            <CheckCircle2 className="w-4 h-4 text-[#7A1F2B] shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}
        <AdminDashboardSupabase onExitAdmin={exitAdminPortal} onToast={showToast} />
      </>
    );
  }

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F2] text-[#080808] dark:bg-[#080808] dark:text-white pb-14 md:pb-0" style={{ "--brand-accent": siteContent.theme.accent || "#7A1F2B", "--site-background": siteContent.theme.background, "--site-surface": siteContent.theme.surface, "--site-text": siteContent.theme.text, "--site-muted": siteContent.theme.muted, backgroundColor: siteContent.theme.background, color: siteContent.theme.text } as React.CSSProperties}>
      <Navbar
        activeSection={activeSection}
        onNavigate={scrollToSection}
        cartCount={cartCount}
        wishlistCount={wishlistIds.length}
        onOpenCart={() => setCartOpen(true)}
        onOpenAccount={() => setAccountOpen(true)}
        user={customerUser}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        isOnline={isOnline}
        showAnnouncement={showAnnouncement}
        onRefresh={refreshShowroom}
        isRefreshing={isRefreshing}
        announcementText={siteContent.announcement}
        brandName={siteContent.brandName}
        onDismissAnnouncement={() => setShowAnnouncement(false)}
      />

      {toastMsg && (
        <div
          role="status"
          className="fixed top-20 right-4 z-50 max-w-sm px-4 py-3 rounded-lg bg-[#080808] dark:bg-white text-white dark:text-[#080808] shadow-xl border border-[#7A1F2B]/40 flex items-center gap-2.5 text-xs font-medium"
        >
          <CheckCircle2 className="w-4 h-4 text-[#7A1F2B] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {isInitialLoading && !isAdminRoute && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#080808] text-white"><div className="flex flex-col items-center gap-4"><span className="h-10 w-10 rounded-full border-2 border-white/15 border-t-[#7A1F2B] animate-spin"/><span className="text-xs font-bold uppercase tracking-[.25em]">SANDIKALE · Memuat showroom</span><span className="text-[11px] text-white/45">Menyiapkan katalog dan studio DTF</span></div></div>}

      <main className="flex-1">
        {/* HERO SECTION */}
        <section id="hero" className="relative min-h-[78vh] md:min-h-[84vh] flex items-end overflow-hidden bg-[#080808]">
          <img
            src={siteContent.heroImage && !heroImageFailed ? siteContent.heroImage : HERO_IMAGE}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={() => setHeroImageFailed(true)}
            alt="Kampanye Streetwear SANDIKALE"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/55 to-black/25" />

          <div className="relative z-10 max-w-[1360px] w-full mx-auto px-4 md:px-6 py-12 md:py-20 space-y-6">
            <div className="max-w-3xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{color:'var(--brand-accent)'}}>
                {siteContent.heroEyebrow}
              </p>
              <h1
                className="font-panchang text-5xl sm:text-6xl md:text-7xl lg:text-8xl uppercase tracking-tight leading-[0.94] text-white"
                style={{ textWrap: 'balance' }}
              >
                {siteContent.heroTitle.split('|')[0]} <span style={{color:'var(--brand-accent)'}}>{siteContent.heroTitle.split('|')[1] || ''}</span>
              </h1>
              <p className="hidden sm:block text-sm md:text-base text-neutral-300 max-w-xl leading-relaxed">
                <span className="hero-subtitle-marquee">{siteContent.heroSubtitle}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => scrollToSection('studio')}
                className="h-12 px-7 rounded-md text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer" style={{backgroundColor:'var(--brand-accent)'}}
              >
                <Layers className="w-4 h-4" />
                <span>{siteContent.primaryCta}</span>
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('katalog')}
                className="h-12 px-7 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/25 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span>{siteContent.secondaryCta}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTutorialOpen(true)}
                className="hidden sm:flex h-12 px-5 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/25 text-xs font-semibold uppercase tracking-widest items-center gap-2 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-[#7A1F2B]" />
                <span>Panduan Pengguna</span>
              </button>
            </div>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="h-10 text-white overflow-hidden flex items-center border-y border-black/15" style={{backgroundColor:'var(--brand-accent)'}}>
          <div className="marquee-track text-xs font-bold uppercase tracking-[0.2em]">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center gap-8 pr-8 whitespace-nowrap">
                <span>HEAVYWEIGHT 240GSM US COTTON</span>
                <span aria-hidden="true">·</span>
                <span>DTF HIGH-DENSITY 8-PASS WHITE INK</span>
                <span aria-hidden="true">·</span>
                <span>PRATINJAU MOCKUP SESUAI KATALOG</span>
                <span aria-hidden="true">·</span>
                <span>PELACAKAN PRODUKSI REAL-TIME</span>
                <span aria-hidden="true">·</span>
                <span>KAIN &amp; WARNA TERKURASI STUDIO</span>
                <span aria-hidden="true">·</span>
              </div>
            ))}
          </div>
        </div>

        {siteContent.gallery.length > 0 && <section id="galeri" className="py-12 md:py-16 border-b border-black/10 dark:border-white/10"><div className="max-w-[1360px] mx-auto px-4 md:px-6 space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{color:'var(--brand-accent)'}}>SANDIKALE VISUAL JOURNAL</p><h2 className="font-display text-3xl md:text-5xl font-bold uppercase mt-2">Gallery / Campaigns</h2></div><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{siteContent.gallery.map((item,index)=><figure key={item.image} className="overflow-hidden rounded-xl bg-neutral-200 dark:bg-[#171717]"><img src={item.image} alt={item.alt} loading="lazy" className="w-full aspect-[4/5] object-cover"/>{item.caption&&<figcaption className="p-3 text-xs text-neutral-600 dark:text-neutral-300">{item.caption}</figcaption>}</figure>)}</div></div></section>}

        {/* PRODUCT CATALOG */}
        <ProductCatalog
          categories={categories}
          products={products}
          adminWhatsapp={adminWhatsapp}
          wishlistIds={wishlistIds}
          recentlyViewed={recentlyViewed}
          onToggleWishlist={handleToggleWishlist}
          onQuickView={handleOpenQuickView}
          onQuickAdd={handleAddCatalogToCart}
          onOpenCustomStudio={(prod) => {
            setStudioProduct(prod);
            scrollToSection('studio');
          }}
        />

        {/* CUSTOM DTF STUDIO */}
        <CustomDtfStudio
          products={products}
          fabrics={fabrics}
          garmentColors={garmentColors}
          dtfZones={dtfZones}
          bulkDiscounts={bulkDiscounts}
          printingMethods={printingMethods}
          preselectedProduct={studioProduct}
          onAddCustomToCart={handleAddCustomToCart}
          onToast={showToast}
        />

        {/* BRAND STORY */}
        <section id="tentang" className="py-14 md:py-20 border-b border-black/10 dark:border-white/10">
          <div className="max-w-[1360px] mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 rounded-xl overflow-hidden bg-neutral-200 dark:bg-[#141414]">
              <img
                src={siteContent.brandDetailImage || brandDetailImage}
                alt="Detail hasil sablon DTF SANDIKALE"
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover min-h-[300px]" onError={(e) => { e.currentTarget.src = HERO_IMAGE; }}
              />
            </div>

            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7A1F2B]">
                  Industrial Streetwear Craft
                </p>
                <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight mt-1">
                  Standar Studio DTF &amp; Konstruksi Kain
                </h2>
              </div>

              <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Setiap kaos dan hoodie SANDIKALE melewati proses pra-penyusutan (pre-shrunk), pencetakan DTF tinta pigmen Jepang dengan lapisan underbase putih 8-pass, serta heat-press terkalibrasi 165°C agar grafis tetap elastis dan tajam melewati puluhan pencucian.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-lg bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 space-y-1">
                  <Sparkles className="w-4 h-4 text-[#7A1F2B]" />
                  <div className="text-sm font-bold">8-Pass White Ink</div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Warna solid di atas kain hitam pekat tanpa pecah.</p>
                </div>
                <div className="p-4 rounded-lg bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 space-y-1">
                  <Truck className="w-4 h-4 text-[#7A1F2B]" />
                  <div className="text-sm font-bold">Konfirmasi via WhatsApp</div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Waktu pengerjaan dan pengiriman dibahas langsung bersama admin.</p>
                </div>
                <div className="p-4 rounded-lg bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 space-y-1">
                  <Shield className="w-4 h-4 text-[#7A1F2B]" />
                  <div className="text-sm font-bold">QC Garansi Tukar</div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Pemeriksaan jahitan dan ketahanan press sebelum kirim.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* REAL-TIME ORDER TRACKING */}
        <OrderTrackingSection
          recentOrders={recentOrders}
          emailOutbox={emailOutbox}
          onTrackOrder={handleTrackOrder}
          onDesignDecision={handleDesignDecision}
          adminWhatsapp={adminWhatsapp}
        />
      </main>

      <footer className="bg-white dark:bg-[#080808] border-t border-black/10 dark:border-white/10 py-10">
        <div className="max-w-[1360px] mx-auto px-4 md:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3"><img src={sandikaleLogo} alt="Logo SANDIKALE" className="h-14 w-auto object-contain" /><div><div className="font-display text-2xl font-extrabold uppercase tracking-wider">{siteContent.brandName}</div><p className="text-[11px] text-neutral-500 dark:text-neutral-400">{siteContent.brandTagline}</p></div></div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-1.5">
              <span>
                {siteContent.storeAddress} · {siteContent.brandName} {siteContent.brandTagline} · Hak cipta © {new Date().getFullYear()}
              </span>
              <button
                type="button"
                onClick={handleOpenAdminLock}
                aria-label="Login Admin"
                title="Login Admin"
                className="inline-flex items-center justify-center p-1 rounded text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#7A1F2B]"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <a href={siteContent.instagramUrl} target="_blank" rel="noreferrer" className="h-9 px-3.5 rounded-md border border-black/15 dark:border-white/15 hover:border-[#7A1F2B] flex items-center gap-1.5">
              <Instagram className="w-3.5 h-3.5 text-[#7A1F2B]"/><span>{siteContent.instagramHandle}</span>
            </a>
            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              className="h-9 px-3.5 rounded-md border border-black/15 dark:border-white/15 hover:border-[#7A1F2B] flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#7A1F2B]" />
              <span>Panduan Pemula</span>
            </button>

            <button
              type="button"
              onClick={handleEnableBrowserPush}
              className="h-9 px-3.5 rounded-md border border-black/15 dark:border-white/15 hover:border-[#7A1F2B] flex items-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#7A1F2B]" />
              <span>Notifikasi Browser</span>
            </button>

            <button
              type="button"
              onClick={() => setBugOpen(true)}
              className="h-9 px-3.5 rounded-md border border-black/15 dark:border-white/15 hover:border-[#7A1F2B] flex items-center gap-1.5 cursor-pointer"
            >
              <Bug className="w-3.5 h-3.5 text-[#7A1F2B]" />
              <span>Laporkan Bug</span>
            </button>
          </div>
        </div>
      </footer>


      <ProductQuickViewModal
        product={quickViewProduct}
        reviews={reviews}
        adminWhatsapp={adminWhatsapp}
        isWishlisted={quickViewProduct ? wishlistIds.includes(quickViewProduct.id) : false}
        onToggleWishlist={handleToggleWishlist}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={handleAddCatalogToCart}
        onSubmitReview={handleSubmitReview}
        onOpenCustomStudio={(prod) => {
          setStudioProduct(prod);
          scrollToSection('studio');
        }}
      />

      <CartCheckoutDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        paymentMethods={paymentMethods}
        adminWhatsapp={adminWhatsapp}
        user={customerUser}
        isOnline={isOnline}
        onUpdateQty={(id, delta) =>
          setCart((prev) =>
            prev
              .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
              .filter((i) => i.quantity > 0)
          )
        }
        onRemoveItem={(id) => setCart((prev) => prev.filter((i) => i.id !== id))}
        onCreateOrder={handleCreateOrder}
        onTrackNewOrder={(oid) => {
          handleTrackOrder(oid);
          scrollToSection('lacak');
        }}
      />

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        user={customerUser}
        token={customerToken}
        onAuthSuccess={(u, tok) => {
          setCustomerUser(u);
          setCustomerToken(tok);
          showToast(`Selamat datang kembali, ${u.name}!`);
        }}
        onLogout={() => {
          void supabase.auth.signOut();
          setCustomerUser(null);
          setCustomerToken(null);
          showToast('Anda telah keluar dari akun.');
        }}
        onTrackOrder={(oid) => {
          handleTrackOrder(oid);
          scrollToSection('lacak');
        }}
      />

      <BugReportModal
        open={bugOpen}
        onClose={() => setBugOpen(false)}
        userEmail={customerUser?.email}
        onSubmitted={() => showToast('Laporan bug diterima. Tim teknis kami akan meninjaunya.')}
      />

      <TutorialModal
        open={tutorialOpen}
        onClose={handleCloseTutorial}
        onNavigateSection={scrollToSection}
      />

      <LiveChatWidget
        messages={chatMessages}
        userName={customerUser?.name}
        onSendMessage={handleSendChat}
      />
    </div>
  );
}
