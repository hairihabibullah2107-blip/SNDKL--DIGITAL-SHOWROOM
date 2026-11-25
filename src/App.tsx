import { ArrowRight, Bell, Bug, CheckCircle2, HelpCircle, Layers, Lock, Shield, Sparkles, Truck, X } from 'lucide-react';
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
  ShippingCourierConfig,
  UserProfile,
} from './types';

const HERO_IMAGE = `${import.meta.env.BASE_URL}src/assets/images/hero_sandikale_streetwear_1795511846725.jpg`;
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
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [activeSection, setActiveSection] = useState('hero');

  // Storefront data (filtered server-side to admin-permitted items only)
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fabrics, setFabrics] = useState<FabricOption[]>([]);
  const [garmentColors, setGarmentColors] = useState<GarmentColorOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [shippingOriginCity, setShippingOriginCity] = useState('');
  const [shippingCouriers, setShippingCouriers] = useState<ShippingCourierConfig[]>([]);
  const [adminWhatsapp, setAdminWhatsapp] = useState('6281234567890');
  const [dtfZones, setDtfZones] = useState<DtfZonePrice[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [emailOutbox, setEmailOutbox] = useState<EmailNotification[]>([]);

  // Auth tokens strictly kept in React memory
  const [customerUser, setCustomerUser] = useState<UserProfile | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);

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
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [adminConfigured, setAdminConfigured] = useState(true);
  const [adminSubmitting, setAdminSubmitting] = useState(false);
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
      setCategories(data.categories);
      setProducts(data.products);
      setFabrics(data.fabrics);
      setGarmentColors(data.garmentColors);
      setPaymentMethods(data.paymentMethods);
      setShippingOriginCity(data.shippingOriginCity);
      setShippingCouriers(data.shippingCouriers);
      setAdminWhatsapp(data.adminWhatsapp);
      setDtfZones(data.dtfZones);
      setReviews(data.reviews);
      setChatMessages(data.chatMessages);
      try { localStorage.setItem(CACHE_BOOTSTRAP_KEY, JSON.stringify(data)); } catch { /* optional offline cache */ }
    } catch (error) {
      console.error('Supabase showroom bootstrap failed:', error);
      showToast('Katalog belum dapat dimuat. Periksa koneksi database.');
      try {
        const cached = localStorage.getItem(CACHE_BOOTSTRAP_KEY);
        if (cached) {
          const data = JSON.parse(cached);
          setCategories(data.categories || []);
          setProducts(data.products || []);
          setFabrics(data.fabrics || []);
          setGarmentColors(data.garmentColors || []);
          setPaymentMethods(data.paymentMethods || []);
          setShippingOriginCity(data.shippingOriginCity || '');
          setShippingCouriers(data.shippingCouriers || []);
          setAdminWhatsapp(data.adminWhatsapp || '6282266412844');
          setDtfZones(data.dtfZones || []);
          setReviews(data.reviews || []);
        }
      } catch { /* ignore invalid cache */ }
    }
  }, [showToast]);

  useEffect(() => { void loadBootstrap(); }, [loadBootstrap]);

  useEffect(() => {
    const channel = supabase.channel('showroom-public-catalog')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_products' }, () => { void loadBootstrap(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_categories' }, () => { void loadBootstrap(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_dtf_prices' }, () => { void loadBootstrap(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
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
          unitPrice: product.price,
          estimatedDays: 2,
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
        if (!placements.length) throw new Error(`Desain DTF untuk ${item.name} belum diunggah.`);
        return {
          product_id: item.productId,
          quantity: item.quantity,
          garment_type: 'short',
          color: item.colorName,
          sizes: [{ size: item.size, quantity: item.quantity }],
          prints: await Promise.all(placements.map(async (placement) => ({
            position: ({ A6: 'Depan - Dada kiri', A5: 'Lengan kiri', A4: 'Depan - Tengah', A3: 'Belakang - Tengah' } as Record<string, string>)[placement.zoneId] || 'Depan - Tengah',
            size_code: placement.zoneId,
            ...await artworkForUpload(placement.artworkDataUrl, placement.artworkName || 'design.png'),
            transform: {
              x: 50 + placement.xOffset,
              y: 50 + placement.yOffset,
              width: 30 * placement.scale,
              scale: placement.scale,
              rotation: placement.rotation,
            },
          }))),
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
          address: [payload.shippingAddress, payload.shippingCity].filter(Boolean).join(', '),
          city: payload.shippingCity,
          notes: `Kurir: ${payload.shippingCourier}; metode pembayaran: ${payload.paymentLabel}`,
        },
        items,
        deposit_amount: 0,
      });
      const now = new Date().toISOString();
      const order = {
        id: data.order_number,
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
      showToast(error instanceof Error ? error.message : 'Pesanan gagal dikirim ke server.');
      return null;
    }
  };

  const handleConfirmPayment = async (orderId: string): Promise<Order | null> => {
    const order = recentOrders.find((entry) => entry.id === orderId);
    if (!order) return null;
    const simulated = { ...order, paymentStatus: 'paid' as const, updatedAt: new Date().toISOString() };
    setRecentOrders((prev) => prev.map((entry) => entry.id === orderId ? simulated : entry));
    showToast('Simulasi pembayaran tercatat di tampilan ini. Konfirmasi pembayaran sebenarnya tetap melalui admin SANDIKALE.');
    return simulated;
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
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        shippingAddress: '',
        shippingCity: '',
        shippingCourier: '',
        shippingEtaDays: 0,
        items: [],
        subtotal: 0,
        shippingCost: 0,
        discount: 0,
        total: 0,
        paymentMethod: 'qris',
        paymentLabel: 'Pembayaran manual',
        paymentReference: '',
        paymentStatus: 'pending',
        stage: statusMap[data.status] || 'Menunggu Pembayaran',
        trackingNumber: trackingCode,
        timeline: (data.history || []).map((event: any) => ({
          stage: statusMap[event.new_status] || 'Menunggu Pembayaran',
          timestamp: event.created_at,
          note: event.notes || '',
          completed: true,
        })),
        createdAt: data.created_at,
        updatedAt: data.created_at,
      } as Order;
      setRecentOrders((prev) => [order, ...prev.filter((entry) => entry.id !== order.id)]);
      return { order, emails: [] };
    } catch {
      return null;
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
    if (typeof Notification === 'undefined') {
      showToast('Notifikasi real-time aktif di dalam aplikasi.');
      return;
    }
    const perm = await Notification.requestPermission();
    showToast(
      perm === 'granted'
        ? 'Notifikasi push browser diaktifkan untuk promo & status produksi.'
        : 'Notifikasi in-app real-time tetap aktif.'
    );
  };

  const handleOpenAdminLock = async () => {
    window.history.pushState({}, '', '?view=admin');
    setIsAdminRoute(true);
  };

  const handleAdminLockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError('');
    setAdminSubmitting(true);
    try {
      const endpoint = adminConfigured ? '/api/admin/login' : '/api/admin/bootstrap';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: adminPasscode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminAuthError(data.error || 'Autentikasi admin gagal.');
        return;
      }
      setAdminConfigured(true);
      setAdminToken(data.token);
      setAdminPasscode('');
      setAdminModalOpen(false);
      try {
        window.history.pushState({}, '', '/admin');
      } catch {
        // ignore history error in restricted frame
      }
      setIsAdminRoute(true);
      showToast('Masuk ke Portal Admin SANDIKALE.');
    } catch {
      setAdminAuthError('Gagal terhubung ke server autentikasi.');
    } finally {
      setAdminSubmitting(false);
    }
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
            className="fixed top-5 right-4 z-50 max-w-sm px-4 py-3 rounded-lg bg-[#080808] dark:bg-white text-white dark:text-[#080808] shadow-xl border border-[#FF4D00]/40 flex items-center gap-2.5 text-xs font-medium"
          >
            <CheckCircle2 className="w-4 h-4 text-[#FF4D00] shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}
        <AdminDashboardSupabase onExitAdmin={exitAdminPortal} onToast={showToast} />
      </>
    );
  }

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F2] text-[#080808] dark:bg-[#080808] dark:text-white pb-14 md:pb-0">
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
        onDismissAnnouncement={() => setShowAnnouncement(false)}
      />

      {toastMsg && (
        <div
          role="status"
          className="fixed top-20 right-4 z-50 max-w-sm px-4 py-3 rounded-lg bg-[#080808] dark:bg-white text-white dark:text-[#080808] shadow-xl border border-[#FF4D00]/40 flex items-center gap-2.5 text-xs font-medium"
        >
          <CheckCircle2 className="w-4 h-4 text-[#FF4D00] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      <main className="flex-1">
        {/* HERO SECTION */}
        <section id="hero" className="relative min-h-[78vh] md:min-h-[84vh] flex items-end overflow-hidden bg-[#080808]">
          <img
            src={HERO_IMAGE}
            alt="Kampanye Streetwear SANDIKALE"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/55 to-black/25" />

          <div className="relative z-10 max-w-[1360px] w-full mx-auto px-4 md:px-6 py-12 md:py-20 space-y-6">
            <div className="max-w-3xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FF4D00]">
                SANDIKALE DIGITAL SHOWROOM &amp; DTF LAB
              </p>
              <h1
                className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold uppercase tracking-tight leading-[0.94] text-white"
                style={{ textWrap: 'balance' }}
              >
                OWN YOUR STREET. <span className="text-[#FF4D00]">PRINT YOUR IDENTITY.</span>
              </h1>
              <p className="text-sm md:text-base text-neutral-300 max-w-xl leading-relaxed">
                Kaos boxy heavyweight dan studio sablon DTF kustom dengan pratinjau langsung mengikuti potongan produk katalog, pilihan kain terkurasi, dan pelacakan produksi real-time.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => scrollToSection('studio')}
                className="h-12 px-7 rounded-md bg-[#FF4D00] hover:bg-[#e04400] text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Custom Your Style</span>
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('katalog')}
                className="h-12 px-7 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/25 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span>Shop Collection</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTutorialOpen(true)}
                className="h-12 px-5 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/25 text-xs font-semibold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-[#FF4D00]" />
                <span>Panduan Pengguna</span>
              </button>
            </div>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="h-10 bg-[#FF4D00] text-white overflow-hidden flex items-center border-y border-black/15">
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
          shippingOriginCity={shippingOriginCity}
          shippingCouriers={shippingCouriers}
          dtfZones={dtfZones}
          preselectedProduct={studioProduct}
          onAddCustomToCart={handleAddCustomToCart}
          onToast={showToast}
        />

        {/* BRAND STORY */}
        <section id="tentang" className="py-14 md:py-20 border-b border-black/10 dark:border-white/10">
          <div className="max-w-[1360px] mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 rounded-xl overflow-hidden bg-neutral-200 dark:bg-[#141414]">
              <img
                src="/src/assets/images/prod_cream_graphic_tee_1795511847871.jpg"
                alt="Detail hasil sablon DTF SANDIKALE"
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover min-h-[300px]"
              />
            </div>

            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF4D00]">
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
                  <Sparkles className="w-4 h-4 text-[#FF4D00]" />
                  <div className="text-sm font-bold">8-Pass White Ink</div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Warna solid di atas kain hitam pekat tanpa pecah.</p>
                </div>
                <div className="p-4 rounded-lg bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 space-y-1">
                  <Truck className="w-4 h-4 text-[#FF4D00]" />
                  <div className="text-sm font-bold">2–3 Hari Produksi</div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Estimasi transparan &amp; notifikasi email otomatis.</p>
                </div>
                <div className="p-4 rounded-lg bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 space-y-1">
                  <Shield className="w-4 h-4 text-[#FF4D00]" />
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
        />
      </main>

      <footer className="bg-white dark:bg-[#080808] border-t border-black/10 dark:border-white/10 py-10">
        <div className="max-w-[1360px] mx-auto px-4 md:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="font-display text-2xl font-extrabold uppercase tracking-wider">SANDIKALE</div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-1.5">
              <span>
                {shippingOriginCity ? `${shippingOriginCity} · ` : ''}SANDIKALE Digital Showroom &amp; DTF Custom Studio · Hak cipta © {new Date().getFullYear()}
              </span>
              <button
                type="button"
                onClick={handleOpenAdminLock}
                aria-label="Login Admin"
                title="Login Admin"
                className="inline-flex items-center justify-center p-1 rounded text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF4D00]"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              className="h-9 px-3.5 rounded-md border border-black/15 dark:border-white/15 hover:border-[#FF4D00] flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#FF4D00]" />
              <span>Panduan Pemula</span>
            </button>

            <button
              type="button"
              onClick={handleEnableBrowserPush}
              className="h-9 px-3.5 rounded-md border border-black/15 dark:border-white/15 hover:border-[#FF4D00] flex items-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#FF4D00]" />
              <span>Aktifkan Push Promo &amp; Status</span>
            </button>

            <button
              type="button"
              onClick={() => setBugOpen(true)}
              className="h-9 px-3.5 rounded-md border border-black/15 dark:border-white/15 hover:border-[#FF4D00] flex items-center gap-1.5 cursor-pointer"
            >
              <Bug className="w-3.5 h-3.5 text-[#FF4D00]" />
              <span>Laporkan Bug</span>
            </button>
          </div>
        </div>
      </footer>

      {adminModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Login Admin SANDIKALE"
        >
          <div className="w-full max-w-sm bg-white dark:bg-[#141414] border border-black/10 dark:border-white/15 rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Akses Terkunci</span>
                </div>
                <h3 className="font-display text-2xl font-bold uppercase tracking-tight">
                  {adminConfigured ? 'Login Admin SANDIKALE' : 'Buat Passcode Admin'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                aria-label="Tutup login admin"
                className="p-1.5 rounded-md text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {adminConfigured
                ? 'Masukkan passcode admin untuk membuka pengaturan ekspedisi, kain, warna, metode pembayaran, dan laporan.'
                : 'Tetapkan passcode admin pertama (minimal 6 karakter) untuk mengamankan dashboard.'}
            </p>

            {adminAuthError && (
              <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-500">
                {adminAuthError}
              </div>
            )}

            <form onSubmit={handleAdminLockSubmit} className="space-y-3">
              <input
                type="password"
                required
                minLength={6}
                autoFocus
                placeholder={adminConfigured ? 'Masukkan passcode admin...' : 'Buat passcode baru (min. 6 karakter)'}
                value={adminPasscode}
                onChange={(e) => setAdminPasscode(e.target.value)}
                className="w-full h-11 px-3.5 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
              />
              <button
                type="submit"
                disabled={adminSubmitting}
                className="w-full h-11 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] hover:bg-[#FF4D00] dark:hover:bg-[#FF4D00] dark:hover:text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-50"
              >
                {adminSubmitting ? 'Memverifikasi...' : adminConfigured ? 'Masuk Admin' : 'Simpan & Masuk'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ProductQuickViewModal
        product={quickViewProduct}
        reviews={reviews}
        shippingOriginCity={shippingOriginCity}
        shippingCouriers={shippingCouriers}
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
        shippingCouriers={shippingCouriers}
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
        onConfirmPayment={handleConfirmPayment}
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
