import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Boxes,
  CheckCircle2,
  CreditCard,
  Download,
  Lock,
  MapPin,
  MessageSquare,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Truck,
  Upload,
  Webhook,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  BugReport,
  Category,
  ChatMessage,
  FabricOption,
  GarmentColorOption,
  GarmentSilhouette,
  InventoryItem,
  MonthlyRevenuePoint,
  Order,
  OrderStage,
  PaymentMethodConfig,
  Product,
  ShippingCourierConfig,
  WebhookLogEntry,
} from '../types';
import { exportMonthlyReportPdf, formatDateTime, formatRupiah } from '../utils/format';

interface AdminDashboardProps {
  adminToken: string | null;
  onAdminToken: (token: string | null) => void;
  chatMessages: ChatMessage[];
  onRefreshBootstrap: () => Promise<void>;
  onExitAdmin: () => void;
  onToast: (msg: string) => void;
}

interface AdminOverviewData {
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    paidOrdersCount: number;
    customOrdersCount: number;
    lowStockCount: number;
  };
  monthlyAnalytics: MonthlyRevenuePoint[];
  orders: Order[];
  inventory: InventoryItem[];
  webhookLogs: WebhookLogEntry[];
  bugReports: BugReport[];
  fabrics: FabricOption[];
  garmentColors: GarmentColorOption[];
  products: Product[];
  categories: Category[];
  paymentMethods: PaymentMethodConfig[];
  shippingOriginCity: string;
  shippingCouriers: ShippingCourierConfig[];
  adminWhatsapp: string;
  webhookSecretConfigured: boolean;
}

const STAGES: OrderStage[] = [
  'Menunggu Pembayaran',
  'Verifikasi Desain DTF',
  'Proses Cetak DTF',
  'Heat Press & QC',
  'Dikirim',
  'Selesai',
];

export function AdminDashboard({
  adminToken,
  onAdminToken,
  chatMessages,
  onRefreshBootstrap,
  onExitAdmin,
  onToast,
}: AdminDashboardProps) {
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [configuredState, setConfiguredState] = useState(true);
  const [tab, setTab] = useState<'analytics' | 'orders' | 'inventory' | 'config' | 'support'>('config');
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(false);

  // Category Creation form
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImageDataUrl, setCatImageDataUrl] = useState('');
  const [catImageName, setCatImageName] = useState('');

  // Upload & Add Product form (kosong sebelum diisi + foto depan & belakang untuk mockup DTF)
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodWeight, setProdWeight] = useState('');
  const [prodFit, setProdFit] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodCategorySlug, setProdCategorySlug] = useState('');
  const [prodSilhouette, setProdSilhouette] = useState<GarmentSilhouette | ''>('');
  const [prodFrontImageDataUrl, setProdFrontImageDataUrl] = useState('');
  const [prodFrontImageName, setProdFrontImageName] = useState('');
  const [prodBackImageDataUrl, setProdBackImageDataUrl] = useState('');
  const [prodBackImageName, setProdBackImageName] = useState('');
  const [prodIsCustomBase, setProdIsCustomBase] = useState(true);
  const [prodQty, setProdQty] = useState<Record<string, string>>({ S: '', M: '', L: '', XL: '', XXL: '' });

  // Add Fabric form
  const [fabName, setFabName] = useState('');
  const [fabGsm, setFabGsm] = useState('');
  const [fabFeel, setFabFeel] = useState('');
  const [fabPriceMod, setFabPriceMod] = useState('');
  const [fabDays, setFabDays] = useState('');

  // Add Color form
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#111111');

  // Shipping Origin, WhatsApp Admin & Custom Expedition forms
  const [originCityInput, setOriginCityInput] = useState('');
  const [whatsappInput, setWhatsappInput] = useState('');
  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierArea, setNewCourierArea] = useState('');
  const [newCourierEtaDays, setNewCourierEtaDays] = useState('');
  const [newCourierCost, setNewCourierCost] = useState('');
  const [editingCourierId, setEditingCourierId] = useState<string | null>(null);
  const [editCourierCost, setEditCourierCost] = useState('');
  const [editCourierEtaDays, setEditCourierEtaDays] = useState('');
  const [editCourierArea, setEditCourierArea] = useState('');

  // Promo Push form
  const [promoTitle, setPromoTitle] = useState('');
  const [promoMsg, setPromoMsg] = useState('');

  // Admin Chat reply
  const [chatReply, setChatReply] = useState('');

  // Webhook simulator SKU
  const [simSku, setSimSku] = useState('SDK-BXY-BLK-240');

  useEffect(() => {
    fetch('/api/admin/auth-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setConfiguredState(Boolean(data.configured));
      })
      .catch(() => {});
  }, []);

  const fetchOverview = async (tok: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.status === 401) {
        onAdminToken(null);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as AdminOverviewData;
        setOverview(data);
        setOriginCityInput((prev) => (prev ? prev : data.shippingOriginCity || ''));
        setWhatsappInput((prev) => (prev ? prev : data.adminWhatsapp || ''));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetchOverview(adminToken);
      const timer = setInterval(() => fetchOverview(adminToken), 5000);
      return () => clearInterval(timer);
    }
  }, [adminToken]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = configuredState ? '/api/admin/login' : '/api/admin/bootstrap';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || 'Autentikasi gagal.');
      return;
    }
    setConfiguredState(true);
    onAdminToken(data.token);
    setPasscode('');
    onToast('Masuk ke Portal Admin SANDIKALE.');
  };

  const handleStageUpdate = async (orderId: string, stage: OrderStage) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/orders/${orderId}/stage`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ stage }),
    });
    if (res.ok) {
      onToast(`Status ${orderId} diperbarui ke "${stage}" & email terkirim.`);
      fetchOverview(adminToken);
    }
  };

  const handleAdjustStock = async (item: InventoryItem, delta: number) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/inventory/${item.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ stock: Math.max(0, item.stock + delta) }),
    });
    if (res.ok) {
      onToast(`Stok ${item.sku} disinkronkan & dicatat ke log webhook.`);
      fetchOverview(adminToken);
    }
  };

  const handleSimulateWebhook = async (simulateFailure: boolean) => {
    if (!adminToken) return;
    const res = await fetch('/api/admin/webhooks/simulate-supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ sku: simSku, delta: 10, simulateFailure }),
    });
    if (res.ok) {
      onToast(
        simulateFailure
          ? 'Simulasi kegagalan webhook dipicu — pantau auto-retry eksponensial pada log.'
          : 'Webhook Supabase berhasil disinkronkan secara real-time.'
      );
      fetchOverview(adminToken);
    }
  };

  const handleManualRetry = async (logId: string) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/webhooks/${logId}/retry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      onToast('Webhook berhasil dikirim ulang.');
      fetchOverview(adminToken);
    }
  };

  const handleTogglePayment = async (pm: PaymentMethodConfig) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/settings/payment/${pm.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ enabled: !pm.enabled }),
    });
    if (res.ok) {
      onToast(`${pm.label} ${!pm.enabled ? 'diizinkan' : 'disembunyikan'} untuk pelanggan.`);
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    }
  };

  const handleToggleShipping = async (sc: ShippingCourierConfig) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/settings/shipping/${sc.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ enabled: !sc.enabled }),
    });
    if (res.ok) {
      onToast(`Kurir ${sc.name} ${!sc.enabled ? 'diizinkan' : 'disembunyikan'} untuk pelanggan.`);
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    }
  };

  const handleSaveOriginCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !originCityInput.trim()) return;
    const res = await fetch('/api/admin/settings/shipping-origin', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ shippingOriginCity: originCityInput.trim() }),
    });
    if (res.ok) {
      onToast(`Kota asal pengiriman diperbarui ke ${originCityInput.trim()}.`);
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    }
  };

  const handleSaveWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !whatsappInput.trim()) return;
    const res = await fetch('/api/admin/settings/whatsapp', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ adminWhatsapp: whatsappInput.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setWhatsappInput(data.adminWhatsapp || whatsappInput.trim());
      onToast(`Nomor WhatsApp Admin diperbarui ke +${data.adminWhatsapp}.`);
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    } else {
      onToast(data.error || 'Nomor WhatsApp tidak valid.');
    }
  };

  const handleAddCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !newCourierName.trim()) return;
    const days = Math.max(1, Number(newCourierEtaDays) || 2);
    const res = await fetch('/api/admin/settings/shipping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: newCourierName.trim(),
        serviceArea: newCourierArea.trim() || 'Seluruh Indonesia',
        etaDays: days,
        etaLabel: `${days}–${days + 1} hari kerja`,
        cost: Math.max(0, Number(newCourierCost) || 0),
      }),
    });
    if (res.ok) {
      setNewCourierName('');
      onToast('Ekspedisi baru ditambahkan & diaktifkan untuk checkout.');
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    }
  };

  const startEditCourier = (sc: ShippingCourierConfig) => {
    setEditingCourierId(sc.id);
    setEditCourierCost(String(sc.cost));
    setEditCourierEtaDays(String(sc.etaDays));
    setEditCourierArea(sc.serviceArea || 'Seluruh Indonesia');
  };

  const handleSaveCourierEdit = async (courierId: string) => {
    if (!adminToken) return;
    const days = Math.max(1, Number(editCourierEtaDays) || 2);
    const res = await fetch(`/api/admin/settings/shipping/${courierId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        cost: Math.max(0, Number(editCourierCost) || 0),
        etaDays: days,
        etaLabel: `${days}–${days + 1} hari kerja`,
        serviceArea: editCourierArea.trim() || 'Seluruh Indonesia',
      }),
    });
    if (res.ok) {
      setEditingCourierId(null);
      onToast('Tarif & estimasi ekspedisi berhasil diperbarui.');
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    }
  };

  const handleDeleteCourier = async (id: string) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/settings/shipping/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      onToast('Ekspedisi dihapus dari daftar.');
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    }
  };

  const handleAddFabric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !fabName.trim()) return;
    const res = await fetch('/api/admin/fabrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: fabName,
        gsm: fabGsm,
        feel: fabFeel,
        priceModifier: Number(fabPriceMod) || 0,
        productionDays: Number(fabDays) || 2,
      }),
    });
    if (res.ok) {
      setFabName('');
      onToast('Material kain baru ditambahkan & dipublikasikan ke Custom Studio.');
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    }
  };

  const handleToggleFabric = async (fab: FabricOption) => {
    if (!adminToken) return;
    await fetch(`/api/admin/fabrics/${fab.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ publishedByAdmin: !fab.publishedByAdmin }),
    });
    fetchOverview(adminToken);
    await onRefreshBootstrap();
  };

  const handleDeleteFabric = async (id: string) => {
    if (!adminToken) return;
    await fetch(`/api/admin/fabrics/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    fetchOverview(adminToken);
    await onRefreshBootstrap();
  };

  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !colorName.trim()) return;
    const res = await fetch('/api/admin/colors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: colorName, hex: colorHex }),
    });
    if (res.ok) {
      setColorName('');
      onToast('Warna kain baru ditambahkan & tampil untuk pelanggan.');
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    }
  };

  const handleToggleColor = async (col: GarmentColorOption) => {
    if (!adminToken) return;
    await fetch(`/api/admin/colors/${col.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ publishedByAdmin: !col.publishedByAdmin }),
    });
    fetchOverview(adminToken);
    await onRefreshBootstrap();
  };

  const handleDeleteColor = async (id: string) => {
    if (!adminToken) return;
    await fetch(`/api/admin/colors/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    fetchOverview(adminToken);
    await onRefreshBootstrap();
  };

  const handleCategoryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      onToast('Ukuran foto kategori maksimal 4MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl) {
        setCatImageDataUrl(dataUrl);
        setCatImageName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !catName.trim()) {
      onToast('Nama kategori wajib diisi.');
      return;
    }
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: catName.trim(),
        description: catDesc.trim(),
        image: catImageDataUrl,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setCatName('');
      setCatDesc('');
      setCatImageDataUrl('');
      setCatImageName('');
      onToast(`Kategori "${data.name}" berhasil ditambahkan ke katalog.`);
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    } else {
      onToast(data.error || 'Gagal menambahkan kategori.');
    }
  };

  const handleDeleteCategory = async (catId: string, catLabel: string) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/categories/${catId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      onToast(`Kategori "${catLabel}" dihapus.`);
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    } else {
      onToast(data.error || 'Gagal menghapus kategori.');
    }
  };

  const handleProductSideUpload = (side: 'front' | 'back') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      onToast('Ukuran foto produk maksimal 4MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl) {
        if (side === 'front') {
          setProdFrontImageDataUrl(dataUrl);
          setProdFrontImageName(file.name);
        } else {
          setProdBackImageDataUrl(dataUrl);
          setProdBackImageName(file.name);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !prodName.trim() || !prodPrice || !prodSilhouette || !prodCategorySlug) {
      onToast('Lengkapi nama, harga, kategori, dan bentuk produk terlebih dahulu.');
      return;
    }
    const sizesPayload: Record<string, number> = {
      S: Math.max(0, Number(prodQty.S) || 0),
      M: Math.max(0, Number(prodQty.M) || 0),
      L: Math.max(0, Number(prodQty.L) || 0),
      XL: Math.max(0, Number(prodQty.XL) || 0),
      XXL: Math.max(0, Number(prodQty.XXL) || 0),
    };
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: prodName.trim(),
        sku: prodSku.trim(),
        silhouette: prodSilhouette,
        price: Number(prodPrice),
        fabricWeight: prodWeight.trim(),
        fit: prodFit.trim(),
        description: prodDesc.trim(),
        categorySlug: prodCategorySlug,
        frontImage: prodFrontImageDataUrl,
        backImage: prodBackImageDataUrl,
        sizes: sizesPayload,
        isCustomBase: prodIsCustomBase,
      }),
    });
    if (res.ok) {
      setProdName('');
      setProdSku('');
      setProdPrice('');
      setProdWeight('');
      setProdFit('');
      setProdDesc('');
      setProdCategorySlug('');
      setProdSilhouette('');
      setProdFrontImageDataUrl('');
      setProdFrontImageName('');
      setProdBackImageDataUrl('');
      setProdBackImageName('');
      setProdQty({ S: '', M: '', L: '', XL: '', XXL: '' });
      onToast('Produk (foto depan & belakang) berhasil diunggah ke katalog & Custom DTF Studio.');
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    } else {
      const err = await res.json().catch(() => ({}));
      onToast(err.error || 'Gagal mengunggah produk.');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      onToast('Produk dihapus dari katalog.');
      fetchOverview(adminToken);
      await onRefreshBootstrap();
    }
  };

  const handleSendPromoPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !promoTitle.trim() || !promoMsg.trim()) return;
    const res = await fetch('/api/admin/promo-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ title: promoTitle, message: promoMsg }),
    });
    if (res.ok) {
      setPromoTitle('');
      setPromoMsg('');
      onToast('Notifikasi push promo disiarkan ke seluruh pengguna aktif.');
    }
  };

  const handleAdminChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !chatReply.trim()) return;
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ senderRole: 'admin', senderName: 'Admin Produksi SANDIKALE', text: chatReply }),
    });
    if (res.ok) {
      setChatReply('');
    }
  };

  const handleResolveBug = async (bugId: string) => {
    if (!adminToken) return;
    await fetch(`/api/admin/bugs/${bugId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'resolved' }),
    });
    fetchOverview(adminToken);
  };

  if (!adminToken) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F2F2F2] dark:bg-[#080808] p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-6 md:p-8 space-y-5">
          <button
            type="button"
            onClick={onExitAdmin}
            className="text-xs text-neutral-500 hover:text-[#FF4D00] flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Storefront</span>
          </button>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#FF4D00]">
              <Lock className="w-3.5 h-3.5" />
              <span>Portal Khusus Admin</span>
            </div>
            <h1 className="font-display text-3xl font-bold uppercase">
              {configuredState ? 'Verifikasi Admin SANDIKALE' : 'Setup Passcode Admin Pertama'}
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {configuredState
                ? 'Halaman ini tertutup dan terenkripsi. Hanya admin terverifikasi yang dapat mengelola kain, warna, metode pembayaran, pengiriman, dan produksi.'
                : 'Tetapkan passcode admin baru (min. 6 karakter) untuk mengunci akses dashboard operasional.'}
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-500">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <input
              type="password"
              required
              minLength={6}
              placeholder={configuredState ? 'Masukkan passcode admin' : 'Buat passcode admin (min. 6 karakter)'}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full h-11 px-3.5 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
            />
            <button
              type="submit"
              className="w-full h-11 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] hover:bg-[#FF4D00] dark:hover:bg-[#FF4D00] dark:hover:text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
            >
              {configuredState ? 'Buka Dashboard Admin' : 'Simpan Passcode & Masuk'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const maxRev = overview ? Math.max(...overview.monthlyAnalytics.map((m) => m.revenue), 1) : 1;

  return (
    <main className="min-h-screen py-10 md:py-14 bg-[#F2F2F2] dark:bg-[#0B0B0B] text-[#080808] dark:text-white">
      <div className="max-w-[1360px] mx-auto px-4 md:px-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={onExitAdmin}
              className="text-xs text-neutral-500 hover:text-[#FF4D00] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Storefront</span>
            </button>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF4D00]">
              Private Operations Console
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight">
              Dashboard Admin SANDIKALE
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {overview && (
              <button
                type="button"
                onClick={() =>
                  exportMonthlyReportPdf({
                    monthly: overview.monthlyAnalytics,
                    orders: overview.orders,
                    totalRevenue: overview.kpis.totalRevenue,
                    customOrdersCount: overview.kpis.customOrdersCount,
                  })
                }
                className="h-9 px-4 rounded-md bg-[#FF4D00] hover:bg-[#e04400] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Laporan PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onAdminToken(null)}
              className="h-9 px-3.5 rounded-md border border-black/15 dark:border-white/15 text-xs font-semibold cursor-pointer"
            >
              Kunci &amp; Keluar
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-black/10 dark:border-white/10">
          {[
            { id: 'config', label: 'Kain, Warna, Bayar & Kurir', icon: Boxes },
            { id: 'analytics', label: 'Analitik & Penjualan', icon: BarChart3 },
            { id: 'orders', label: 'Pesanan & Produksi DTF', icon: Activity },
            { id: 'inventory', label: 'Inventaris & Webhook Sync', icon: Webhook },
            { id: 'support', label: 'Live Chat & Laporan Bug', icon: MessageSquare },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`h-10 px-4 rounded-t-md text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  tab === item.id
                    ? 'border-[#FF4D00] text-[#FF4D00] bg-white dark:bg-[#141414]'
                    : 'border-transparent text-neutral-500 hover:text-[#080808] dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {loading && !overview ? (
          <div className="py-12 text-center text-xs text-neutral-500">Memuat data operasional real-time...</div>
        ) : (
          overview && (
            <>
              {/* TAB: KAIN, WARNA, PEMBAYARAN, KURIR & PRODUK */}
              {tab === 'config' && (
                <div className="space-y-6">
                  {/* Payment & Shipping Permissions */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-3">
                      <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#FF4D00]" />
                        <span>Izin Metode Pembayaran</span>
                      </h2>
                      <p className="text-xs text-neutral-500">
                        Hanya metode yang diaktifkan di sini yang muncul pada halaman checkout pelanggan.
                      </p>
                      <div className="space-y-2">
                        {overview.paymentMethods.map((pm) => (
                          <div
                            key={pm.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 text-xs"
                          >
                            <div>
                              <div className="font-semibold">{pm.label}</div>
                              <div className="text-[11px] text-neutral-400">{pm.group}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleTogglePayment(pm)}
                              className={`h-8 px-3 rounded-md font-semibold cursor-pointer ${
                                pm.enabled
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-neutral-200 dark:bg-[#262626] text-neutral-600 dark:text-neutral-300'
                              }`}
                            >
                              {pm.enabled ? 'Diizinkan' : 'Tersembunyi'}
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Admin WhatsApp Routing for Checkout Design Submission */}
                      <form
                        onSubmit={handleSaveWhatsapp}
                        className="mt-3 p-3.5 rounded-lg bg-emerald-500/5 border border-emerald-500/25 space-y-2"
                      >
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" />
                          <span>Nomor WhatsApp Admin (Penerima File Desain &amp; Revisi)</span>
                        </label>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          Setiap pelanggan selesai checkout, website mengarahkan pelanggan mengirim file desain asli ke nomor WA ini untuk revisi dan konfirmasi pesanan.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            required
                            placeholder="Mis: 6281234567890 atau 081234567890"
                            value={whatsappInput}
                            onChange={(e) => setWhatsappInput(e.target.value)}
                            className="flex-1 h-9 px-3 rounded-md text-xs font-mono-tabular bg-white dark:bg-[#111] border border-black/15 dark:border-white/15"
                          />
                          <button
                            type="submit"
                            className="h-9 px-3.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer transition-colors"
                          >
                            Simpan WA
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
                      <div>
                        <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-2">
                          <Truck className="w-4 h-4 text-[#FF4D00]" />
                          <span>Ekspedisi &amp; Lokasi Pengiriman</span>
                        </h2>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Atur kota asal workshop (non-Jabodetabek), tambah ekspedisi lokal/kargo, ubah tarif ongkir, atau sembunyikan kurir tertentu.
                        </p>
                      </div>

                      {/* Kota Asal Pengiriman */}
                      <form
                        onSubmit={handleSaveOriginCity}
                        className="p-3 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 space-y-2"
                      >
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#FF4D00]" />
                          <span>Kota Asal Pengiriman Perusahaan</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Mis: Surabaya, Solo, Yogyakarta, Makassar"
                            value={originCityInput}
                            onChange={(e) => setOriginCityInput(e.target.value)}
                            className="flex-1 h-9 px-3 rounded-md text-xs bg-white dark:bg-[#111] border border-black/15 dark:border-white/15"
                          />
                          <button
                            type="submit"
                            className="h-9 px-3.5 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] hover:bg-[#FF4D00] dark:hover:bg-[#FF4D00] dark:hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                          >
                            Simpan Kota
                          </button>
                        </div>
                      </form>

                      {/* Tambah Ekspedisi Baru */}
                      <form
                        onSubmit={handleAddCourier}
                        className="p-3 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 space-y-2.5"
                      >
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                            Tambah Ekspedisi Baru
                          </div>
                          <p className="text-[11px] text-neutral-400">
                            Isi nama layanan ekspedisi, estimasi lama pengiriman (hari), dan tarif ongkos kirim (Rp).
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="space-y-1 text-[11px] text-neutral-500">
                            <span>Nama Ekspedisi *</span>
                            <input
                              type="text"
                              required
                              placeholder="Mis: JNE Cargo / Lion Parcel"
                              value={newCourierName}
                              onChange={(e) => setNewCourierName(e.target.value)}
                              className="w-full h-9 px-3 rounded-md text-xs text-[#080808] dark:text-white bg-white dark:bg-[#111] border border-black/15 dark:border-white/15"
                            />
                          </label>
                          <label className="space-y-1 text-[11px] text-neutral-500">
                            <span>Jangkauan Wilayah</span>
                            <input
                              type="text"
                              placeholder="Mis: Seluruh Indonesia / Luar Jawa"
                              value={newCourierArea}
                              onChange={(e) => setNewCourierArea(e.target.value)}
                              className="w-full h-9 px-3 rounded-md text-xs text-[#080808] dark:text-white bg-white dark:bg-[#111] border border-black/15 dark:border-white/15"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <label className="space-y-1 text-[11px] text-neutral-500">
                            <span>Estimasi (Hari) *</span>
                            <input
                              type="number"
                              min={1}
                              required
                              placeholder="Mis: 3"
                              value={newCourierEtaDays}
                              onChange={(e) => setNewCourierEtaDays(e.target.value)}
                              className="w-full h-9 px-3 rounded-md text-xs text-[#080808] dark:text-white bg-white dark:bg-[#111] border border-black/15 dark:border-white/15"
                            />
                          </label>
                          <label className="space-y-1 text-[11px] text-neutral-500">
                            <span>Tarif Ongkir (Rp) *</span>
                            <input
                              type="number"
                              min={0}
                              required
                              placeholder="Mis: 22000"
                              value={newCourierCost}
                              onChange={(e) => setNewCourierCost(e.target.value)}
                              className="w-full h-9 px-3 rounded-md text-xs text-[#080808] dark:text-white bg-white dark:bg-[#111] border border-black/15 dark:border-white/15"
                            />
                          </label>
                          <button
                            type="submit"
                            className="h-9 px-3 rounded-md bg-[#FF4D00] hover:bg-[#e04400] text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Tambah
                          </button>
                        </div>
                      </form>

                      {/* Daftar Ekspedisi */}
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {overview.shippingCouriers.map((sc) => {
                          const isEditing = editingCourierId === sc.id;
                          return (
                            <div
                              key={sc.id}
                              className="p-2.5 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 text-xs space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{sc.name}</div>
                                  <div className="text-[11px] font-mono-tabular text-neutral-400">
                                    {sc.serviceArea || 'Seluruh Indonesia'} · {sc.etaLabel} · {formatRupiah(sc.cost)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isEditing ? setEditingCourierId(null) : startEditCourier(sc)
                                    }
                                    aria-label={`Ubah tarif ${sc.name}`}
                                    className="h-8 px-2 rounded-md border border-black/15 dark:border-white/15 hover:border-[#FF4D00] text-neutral-500 hover:text-[#FF4D00] cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleShipping(sc)}
                                    className={`h-8 px-2.5 rounded-md font-semibold cursor-pointer ${
                                      sc.enabled
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-neutral-200 dark:bg-[#262626] text-neutral-600 dark:text-neutral-300'
                                    }`}
                                  >
                                    {sc.enabled ? 'Diizinkan' : 'Tersembunyi'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCourier(sc.id)}
                                    aria-label={`Hapus ekspedisi ${sc.name}`}
                                    className="p-1.5 text-neutral-400 hover:text-red-500 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {isEditing && (
                                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                                  <input
                                    type="text"
                                    value={editCourierArea}
                                    onChange={(e) => setEditCourierArea(e.target.value)}
                                    placeholder="Area"
                                    className="col-span-2 h-8 px-2 rounded text-[11px] bg-white dark:bg-[#111] border border-black/15 dark:border-white/15"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    value={editCourierEtaDays}
                                    onChange={(e) => setEditCourierEtaDays(e.target.value)}
                                    placeholder="Hari"
                                    className="h-8 px-2 rounded text-[11px] bg-white dark:bg-[#111] border border-black/15 dark:border-white/15"
                                  />
                                  <div className="flex gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      value={editCourierCost}
                                      onChange={(e) => setEditCourierCost(e.target.value)}
                                      placeholder="Ongkir"
                                      className="w-full h-8 px-2 rounded text-[11px] bg-white dark:bg-[#111] border border-black/15 dark:border-white/15"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveCourierEdit(sc.id)}
                                      className="h-8 px-2.5 rounded bg-[#FF4D00] text-white text-[11px] font-semibold shrink-0 cursor-pointer"
                                    >
                                      OK
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Admin-Filled Fabrics & Colors */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Fabrics */}
                    <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
                      <div>
                        <h2 className="font-display text-2xl font-bold uppercase">Material Kain Custom DTF</h2>
                        <p className="text-xs text-neutral-500">
                          Isi daftar kain di bawah agar pelanggan dapat memilihnya di Custom Studio.
                        </p>
                      </div>

                      <form onSubmit={handleAddFabric} className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="space-y-1 text-[11px] text-neutral-500">
                            <span>Nama Kain *</span>
                            <input
                              type="text"
                              required
                              placeholder="Mis: Heavyweight US Cotton"
                              value={fabName}
                              onChange={(e) => setFabName(e.target.value)}
                              className="w-full h-9 px-3 rounded-md text-xs text-[#080808] dark:text-white bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                            />
                          </label>
                          <label className="space-y-1 text-[11px] text-neutral-500">
                            <span>Ketebalan / Gramasi *</span>
                            <input
                              type="text"
                              required
                              placeholder="Mis: 240 GSM"
                              value={fabGsm}
                              onChange={(e) => setFabGsm(e.target.value)}
                              className="w-full h-9 px-3 rounded-md text-xs text-[#080808] dark:text-white bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                            />
                          </label>
                        </div>
                        <label className="block space-y-1 text-[11px] text-neutral-500">
                          <span>Karakteristik / Keterangan Bahan</span>
                          <input
                            type="text"
                            placeholder="Mis: Tebal, jatuh tegas & adem dipakai harian"
                            value={fabFeel}
                            onChange={(e) => setFabFeel(e.target.value)}
                            className="w-full h-9 px-3 rounded-md text-xs text-[#080808] dark:text-white bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="space-y-1 text-[11px] text-neutral-500">
                            <span>Tambahan Harga Kain (Rp)</span>
                            <input
                              type="number"
                              min={0}
                              placeholder="Isi 0 jika gratis, mis: 15000"
                              value={fabPriceMod}
                              onChange={(e) => setFabPriceMod(e.target.value)}
                              className="w-full h-9 px-3 rounded-md text-xs text-[#080808] dark:text-white bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                            />
                          </label>
                          <label className="space-y-1 text-[11px] text-neutral-500">
                            <span>Estimasi Produksi (Hari)</span>
                            <input
                              type="number"
                              min={1}
                              required
                              placeholder="Mis: 2"
                              value={fabDays}
                              onChange={(e) => setFabDays(e.target.value)}
                              className="w-full h-9 px-3 rounded-md text-xs text-[#080808] dark:text-white bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                            />
                          </label>
                        </div>
                        <button
                          type="submit"
                          className="h-9 px-4 rounded-md bg-[#FF4D00] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah &amp; Tampilkan Kain
                        </button>
                      </form>

                      <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                        {overview.fabrics.length === 0 ? (
                          <p className="text-xs text-neutral-500">Belum ada material kain yang diisi admin.</p>
                        ) : (
                          overview.fabrics.map((fab) => (
                            <div
                              key={fab.id}
                              className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 text-xs"
                            >
                              <div>
                                <div className="font-bold">
                                  {fab.name} <span className="text-[#FF4D00]">({fab.gsm})</span>
                                </div>
                                <div className="text-[11px] text-neutral-500">
                                  +{formatRupiah(fab.priceModifier)} · {fab.productionDays} hari
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleFabric(fab)}
                                  className={`h-7 px-2.5 rounded text-[11px] font-semibold cursor-pointer ${
                                    fab.publishedByAdmin
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-neutral-200 dark:bg-[#262626]'
                                  }`}
                                >
                                  {fab.publishedByAdmin ? 'Tampil' : 'Draft'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFabric(fab.id)}
                                  aria-label="Hapus kain"
                                  className="p-1.5 text-neutral-400 hover:text-red-500 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Colors */}
                    <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
                      <div>
                        <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-2">
                          <Palette className="w-4 h-4 text-[#FF4D00]" />
                          <span>Pilihan Warna Baju</span>
                        </h2>
                        <p className="text-xs text-neutral-500">
                          Isi warna kain di sini agar tersedia pada katalog produk dan Custom DTF Studio.
                        </p>
                      </div>

                      <form onSubmit={handleAddColor} className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Nama Warna (mis: Jet Black)"
                          value={colorName}
                          onChange={(e) => setColorName(e.target.value)}
                          className="flex-1 min-w-[160px] h-9 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                        />
                        <input
                          type="color"
                          value={colorHex}
                          onChange={(e) => setColorHex(e.target.value)}
                          aria-label="Pilih warna hex"
                          className="w-10 h-9 rounded border border-black/15 dark:border-white/15 bg-transparent cursor-pointer"
                        />
                        <button
                          type="submit"
                          className="h-9 px-4 rounded-md bg-[#FF4D00] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Warna
                        </button>
                      </form>

                      <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                        {overview.garmentColors.length === 0 ? (
                          <p className="text-xs text-neutral-500">Belum ada warna yang diisi admin.</p>
                        ) : (
                          overview.garmentColors.map((col) => (
                            <div
                              key={col.id}
                              className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className="w-5 h-5 rounded-full border border-black/20 dark:border-white/20"
                                  style={{ backgroundColor: col.hex }}
                                />
                                <span className="font-bold">{col.name}</span>
                                <span className="font-mono-tabular text-[11px] text-neutral-400">{col.hex}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleColor(col)}
                                  className={`h-7 px-2.5 rounded text-[11px] font-semibold cursor-pointer ${
                                    col.publishedByAdmin
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-neutral-200 dark:bg-[#262626]'
                                  }`}
                                >
                                  {col.publishedByAdmin ? 'Tampil' : 'Draft'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteColor(col.id)}
                                  aria-label="Hapus warna"
                                  className="p-1.5 text-neutral-400 hover:text-red-500 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pembuatan Nama Kategori Produk */}
                  <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
                    <div>
                      <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-2">
                        <Plus className="w-4 h-4 text-[#FF4D00]" />
                        <span>Pembuatan Nama Kategori Produk</span>
                      </h2>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Buat nama kategori baru (misal: Kaos Anak, Jersey Olahraga, Workwear, Jaket Coach) agar muncul di katalog depan &amp; pilihan saat upload produk.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      <form onSubmit={handleAddCategory} className="lg:col-span-6 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <label className="space-y-1 text-xs">
                            <span className="font-semibold">Nama Kategori *</span>
                            <input
                              type="text"
                              required
                              placeholder="Mis: Workshirt / Kaos Polo"
                              value={catName}
                              onChange={(e) => setCatName(e.target.value)}
                              className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                            />
                          </label>
                          <label className="space-y-1 text-xs">
                            <span className="font-semibold">Deskripsi Singkat</span>
                            <input
                              type="text"
                              placeholder="Mis: Potongan boxy rapi siap sablon DTF"
                              value={catDesc}
                              onChange={(e) => setCatDesc(e.target.value)}
                              className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                            />
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-dashed border-black/15 dark:border-white/15">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {catImageDataUrl ? (
                              <img src={catImageDataUrl} alt="Preview kategori" className="w-10 h-10 rounded object-cover shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-neutral-200 dark:bg-[#252525] flex items-center justify-center text-[10px] text-neutral-500 shrink-0">
                                Cover
                              </div>
                            )}
                            <span className="text-[11px] text-neutral-500 truncate">
                              {catImageName || 'Foto sampul kategori (opsional)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="h-8 px-3 rounded-md border border-black/15 dark:border-white/15 hover:border-[#FF4D00] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Foto</span>
                              <input type="file" accept="image/*" onChange={handleCategoryImageUpload} className="hidden" />
                            </label>
                            <button
                              type="submit"
                              className="h-8 px-4 rounded-md bg-[#FF4D00] hover:bg-[#e04400] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Buat Kategori
                            </button>
                          </div>
                        </div>
                      </form>

                      <div className="lg:col-span-6 space-y-2 max-h-44 overflow-y-auto pr-1">
                        {overview.categories.map((cat) => (
                          <div
                            key={cat.id}
                            className="flex items-center justify-between gap-2.5 p-2.5 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img src={cat.image} alt={cat.name} className="w-9 h-9 rounded object-cover shrink-0" />
                              <div className="min-w-0">
                                <div className="font-bold truncate">{cat.name}</div>
                                <div className="text-[11px] text-neutral-500 truncate">
                                  /{cat.slug} · {cat.description}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              aria-label={`Hapus kategori ${cat.name}`}
                              className="p-1.5 text-neutral-400 hover:text-red-500 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Upload Produk Katalog & Push Promo */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <form
                      onSubmit={handleAddProduct}
                      className="lg:col-span-7 bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4"
                    >
                      <div>
                        <h3 className="font-display text-2xl font-bold uppercase flex items-center gap-2">
                          <Upload className="w-4 h-4 text-[#FF4D00]" />
                          <span>Upload &amp; Tambah Produk Katalog (Depan &amp; Belakang)</span>
                        </h3>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Unggah foto produk tampak depan dan tampak belakang. Kedua foto ini otomatis menjadi mockup langsung di Custom DTF Studio.
                        </p>
                      </div>

                      {/* Foto Produk Depan & Belakang Upload */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-dashed border-black/20 dark:border-white/20 flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {prodFrontImageDataUrl ? (
                              <img
                                src={prodFrontImageDataUrl}
                                alt="Preview Depan"
                                className="w-12 h-12 rounded-md object-cover border border-black/10 dark:border-white/10 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-md bg-neutral-200 dark:bg-[#252525] flex items-center justify-center text-[10px] text-neutral-500 text-center leading-tight shrink-0">
                                Tampak Depan
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">Foto Depan *</div>
                              <p className="text-[10px] text-neutral-500 truncate">
                                {prodFrontImageName || 'Mockup sisi depan DTF'}
                              </p>
                            </div>
                          </div>
                          <label className="h-8 px-2.5 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] hover:bg-[#FF4D00] dark:hover:bg-[#FF4D00] dark:hover:text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors">
                            <Upload className="w-3 h-3" />
                            <span>Depan</span>
                            <input type="file" accept="image/*" onChange={handleProductSideUpload('front')} className="hidden" />
                          </label>
                        </div>

                        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-dashed border-black/20 dark:border-white/20 flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {prodBackImageDataUrl ? (
                              <img
                                src={prodBackImageDataUrl}
                                alt="Preview Belakang"
                                className="w-12 h-12 rounded-md object-cover border border-black/10 dark:border-white/10 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-md bg-neutral-200 dark:bg-[#252525] flex items-center justify-center text-[10px] text-neutral-500 text-center leading-tight shrink-0">
                                Tampak Belakang
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">Foto Belakang</div>
                              <p className="text-[10px] text-neutral-500 truncate">
                                {prodBackImageName || 'Mockup sisi belakang DTF'}
                              </p>
                            </div>
                          </div>
                          <label className="h-8 px-2.5 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] hover:bg-[#FF4D00] dark:hover:bg-[#FF4D00] dark:hover:text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors">
                            <Upload className="w-3 h-3" />
                            <span>Belakang</span>
                            <input type="file" accept="image/*" onChange={handleProductSideUpload('back')} className="hidden" />
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="space-y-1 text-xs">
                          <span className="font-semibold">Nama Produk *</span>
                          <input
                            type="text"
                            required
                            placeholder="Mis: Sandikale Heavy Boxy Tee V2"
                            value={prodName}
                            onChange={(e) => setProdName(e.target.value)}
                            className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                          />
                          <span className="block text-[10px] text-neutral-400">Nama tampil di katalog &amp; invoice.</span>
                        </label>

                        <label className="space-y-1 text-xs">
                          <span className="font-semibold">Harga Jual Satuan (Rp) *</span>
                          <input
                            type="number"
                            min={1000}
                            required
                            placeholder="Isi angka tanpa titik, mis: 195000"
                            value={prodPrice}
                            onChange={(e) => setProdPrice(e.target.value)}
                            className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                          />
                          <span className="block text-[10px] text-neutral-400">Harga dasar kaos/hoodie sebelum sablon DTF.</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="space-y-1 text-xs">
                          <span className="font-semibold">Kategori Katalog *</span>
                          <select
                            required
                            value={prodCategorySlug}
                            onChange={(e) => setProdCategorySlug(e.target.value)}
                            className="w-full h-10 px-2.5 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                          >
                            <option value="">-- Pilih Kategori --</option>
                            {overview.categories.map((c) => (
                              <option key={c.id} value={c.slug}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-1 text-xs">
                          <span className="font-semibold">Bentuk Baju (Mockup DTF) *</span>
                          <select
                            required
                            value={prodSilhouette}
                            onChange={(e) => setProdSilhouette(e.target.value as GarmentSilhouette | '')}
                            className="w-full h-10 px-2.5 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                          >
                            <option value="">-- Pilih Bentuk --</option>
                            <option value="boxy-tee">Boxy Tee</option>
                            <option value="regular-tee">Regular Tee</option>
                            <option value="hoodie">Hoodie</option>
                            <option value="longsleeve">Longsleeve</option>
                          </select>
                        </label>

                        <label className="space-y-1 text-xs">
                          <span className="font-semibold">Kode SKU (Opsional)</span>
                          <input
                            type="text"
                            placeholder="Mis: SDK-BXY-002"
                            value={prodSku}
                            onChange={(e) => setProdSku(e.target.value)}
                            className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="space-y-1 text-xs">
                          <span className="font-semibold">Spesifikasi Bahan Kain</span>
                          <input
                            type="text"
                            placeholder="Mis: 240 GSM Heavyweight US Cotton"
                            value={prodWeight}
                            onChange={(e) => setProdWeight(e.target.value)}
                            className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                          />
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="font-semibold">Model Potongan (Fit)</span>
                          <input
                            type="text"
                            placeholder="Mis: Boxy Oversized Drop-Shoulder"
                            value={prodFit}
                            onChange={(e) => setProdFit(e.target.value)}
                            className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                          />
                        </label>
                      </div>

                      {/* Qty / Stok per Ukuran */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold">
                          Qty / Stok Awal per Ukuran (pcs)
                        </div>
                        <p className="text-[11px] text-neutral-500">
                          Isi jumlah stok awal tiap ukuran dalam pcs (isi 0 atau kosongkan jika ukuran belum tersedia).
                        </p>
                        <div className="grid grid-cols-5 gap-2">
                          {(['S', 'M', 'L', 'XL', 'XXL'] as const).map((sz) => (
                            <label key={sz} className="space-y-1 text-[11px]">
                              <span className="font-mono-tabular font-semibold block text-center">Qty {sz}</span>
                              <input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={prodQty[sz]}
                                onChange={(e) => setProdQty((prev) => ({ ...prev, [sz]: e.target.value }))}
                                className="w-full h-9 px-2 text-center rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15 font-mono-tabular"
                              />
                            </label>
                          ))}
                        </div>
                      </div>

                      <label className="block space-y-1 text-xs">
                        <span className="font-semibold">Deskripsi Produk</span>
                        <textarea
                          rows={2}
                          placeholder="Jelaskan detail jahitan, ketebalan kain, dan area cetak DTF..."
                          value={prodDesc}
                          onChange={(e) => setProdDesc(e.target.value)}
                          className="w-full p-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                        />
                      </label>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={prodIsCustomBase}
                            onChange={(e) => setProdIsCustomBase(e.target.checked)}
                            className="accent-[#FF4D00]"
                          />
                          <span>Tampilkan juga sebagai opsi baju di Custom DTF Studio</span>
                        </label>
                        <button
                          type="submit"
                          className="h-10 px-5 rounded-md bg-[#FF4D00] hover:bg-[#e04400] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Upload &amp; Simpan Produk
                        </button>
                      </div>

                      {/* Daftar Produk Katalog Saat Ini */}
                      <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Produk Katalog Aktif ({overview.products.length})
                        </div>
                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                          {overview.products.map((p) => {
                            const totalStk = Object.values(p.sizes).reduce((a, b) => a + b, 0);
                            return (
                              <div
                                key={p.id}
                                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 text-xs"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <img
                                    src={p.images[0]}
                                    alt={p.name}
                                    className="w-9 h-9 rounded object-cover shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-semibold truncate">{p.name}</div>
                                    <div className="text-[11px] font-mono-tabular text-neutral-500">
                                      {formatRupiah(p.price)} · Total Qty: {totalStk} pcs · {p.silhouette}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(p.id)}
                                  aria-label={`Hapus produk ${p.name}`}
                                  className="p-1.5 text-neutral-400 hover:text-red-500 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </form>

                    <form
                      onSubmit={handleSendPromoPush}
                      className="lg:col-span-5 bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-3 h-fit"
                    >
                      <h3 className="font-display text-2xl font-bold uppercase">Kirim Notifikasi Push Promo</h3>
                      <p className="text-xs text-neutral-500">
                        Siarkan pengumuman promo atau rilis koleksi baru secara real-time ke browser pelanggan.
                      </p>
                      <input
                        type="text"
                        required
                        placeholder="Judul Promo (mis: Diskon 15% Custom DTF Komunitas)"
                        value={promoTitle}
                        onChange={(e) => setPromoTitle(e.target.value)}
                        className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                      />
                      <textarea
                        required
                        rows={2}
                        placeholder="Isi pesan notifikasi push..."
                        value={promoMsg}
                        onChange={(e) => setPromoMsg(e.target.value)}
                        className="w-full p-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                      />
                      <button
                        type="submit"
                        className="h-10 px-5 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Siarkan Push Promo
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB: ANALYTICS */}
              {tab === 'analytics' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10">
                      <div className="text-xs text-neutral-500">Pendapatan Terverifikasi</div>
                      <div className="text-2xl font-bold font-mono-tabular mt-1 text-[#FF4D00]">
                        {formatRupiah(overview.kpis.totalRevenue)}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10">
                      <div className="text-xs text-neutral-500">Total Pesanan Aktif</div>
                      <div className="text-2xl font-bold font-mono-tabular mt-1">{overview.kpis.totalOrders}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10">
                      <div className="text-xs text-neutral-500">Pesanan Custom DTF</div>
                      <div className="text-2xl font-bold font-mono-tabular mt-1">{overview.kpis.customOrdersCount}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10">
                      <div className="text-xs text-neutral-500">Stok Mendekati Minimum</div>
                      <div className="text-2xl font-bold font-mono-tabular mt-1">{overview.kpis.lowStockCount} SKU</div>
                    </div>
                  </div>

                  <div className="p-5 md:p-6 rounded-xl bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 space-y-5">
                    <div>
                      <h3 className="font-display text-2xl font-bold uppercase">Laporan Penjualan Bulanan</h3>
                      <p className="text-xs text-neutral-500">
                        Akumulasi pendapatan &amp; kontribusi pesanan sablon DTF kustom (6 bulan terakhir)
                      </p>
                    </div>

                    <div className="grid grid-cols-6 gap-3 items-end h-52 pt-4">
                      {overview.monthlyAnalytics.map((pt) => {
                        const pct = Math.max(12, Math.round((pt.revenue / maxRev) * 100));
                        return (
                          <div key={pt.month} className="flex flex-col items-center gap-2 h-full justify-end">
                            <div className="text-[11px] font-mono-tabular text-neutral-500 truncate max-w-full">
                              {(pt.revenue / 1000000).toFixed(1)}Jt
                            </div>
                            <div className="w-full max-w-[54px] bg-neutral-100 dark:bg-[#1E1E1E] rounded-t-md h-36 flex items-end overflow-hidden">
                              <div
                                style={{ height: `${pct}%` }}
                                className="w-full bg-[#FF4D00] rounded-t-md transition-all duration-300"
                              />
                            </div>
                            <div className="text-xs font-semibold">{pt.month}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="overflow-x-auto pt-2 border-t border-black/10 dark:border-white/10">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-neutral-500 border-b border-black/10 dark:border-white/10">
                            <th className="py-2">Bulan</th>
                            <th className="py-2 text-right">Pendapatan</th>
                            <th className="py-2 text-right">Jumlah Order</th>
                            <th className="py-2 text-right">Porsi Custom DTF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.monthlyAnalytics.map((pt) => (
                            <tr key={pt.month} className="border-b border-black/5 dark:border-white/5">
                              <td className="py-2 font-semibold">{pt.month}</td>
                              <td className="py-2 text-right font-mono-tabular">{formatRupiah(pt.revenue)}</td>
                              <td className="py-2 text-right font-mono-tabular">{pt.orders}</td>
                              <td className="py-2 text-right font-mono-tabular text-[#FF4D00]">{pt.customDtfShare}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: ORDERS & DTF PRODUCTION */}
              {tab === 'orders' && (
                <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
                  <h3 className="font-display text-2xl font-bold uppercase">Antrean Pesanan &amp; Produksi DTF</h3>
                  <div className="space-y-3">
                    {overview.orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-4 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono-tabular font-bold text-[#FF4D00]">{ord.id}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold">{ord.customerName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-neutral-500">{ord.customerEmail}</span>
                          </div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-300">
                            {ord.items.map((i) => `${i.quantity}x ${i.name} (${i.size})`).join(', ')}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-neutral-400">
                            {formatRupiah(ord.total)} · {ord.paymentLabel} ({ord.paymentStatus === 'paid' ? 'Lunas' : 'Pending'})
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-xs text-neutral-500">Status:</label>
                          <select
                            value={ord.stage}
                            onChange={(e) => handleStageUpdate(ord.id, e.target.value as OrderStage)}
                            aria-label={`Ubah status pesanan ${ord.id}`}
                            className="h-9 px-3 rounded-md text-xs font-semibold bg-white dark:bg-[#111] border border-black/15 dark:border-white/15"
                          >
                            {STAGES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: INVENTORY & SUPABASE WEBHOOK SYNC */}
              {tab === 'inventory' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
                    <div>
                      <h3 className="font-display text-2xl font-bold uppercase">Manajemen Inventaris Otomatis</h3>
                      <p className="text-xs text-neutral-500">
                        Setiap perubahan stok memicu sinkronisasi webhook dan tercatat pada log aktivitas real-time.
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-neutral-500 border-b border-black/10 dark:border-white/10">
                            <th className="py-2.5">SKU</th>
                            <th className="py-2.5">Material / Produk</th>
                            <th className="py-2.5">Kategori</th>
                            <th className="py-2.5 text-right">Stok</th>
                            <th className="py-2.5 text-right">Min.</th>
                            <th className="py-2.5 text-right">Aksi Cepat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.inventory.map((inv) => {
                            const isLow = inv.stock <= inv.minThreshold;
                            return (
                              <tr key={inv.id} className="border-b border-black/5 dark:border-white/5">
                                <td className="py-2.5 font-mono-tabular font-semibold">{inv.sku}</td>
                                <td className="py-2.5">{inv.name}</td>
                                <td className="py-2.5 text-neutral-500">{inv.category}</td>
                                <td className={`py-2.5 text-right font-mono-tabular font-bold ${isLow ? 'text-red-500' : ''}`}>
                                  {inv.stock} {inv.unit}
                                </td>
                                <td className="py-2.5 text-right font-mono-tabular text-neutral-400">{inv.minThreshold}</td>
                                <td className="py-2.5 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustStock(inv, -5)}
                                      className="h-7 px-2 rounded border border-black/15 dark:border-white/15 hover:border-[#FF4D00] font-mono-tabular cursor-pointer"
                                    >
                                      -5
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustStock(inv, 10)}
                                      className="h-7 px-2 rounded border border-black/15 dark:border-white/15 hover:border-[#FF4D00] font-mono-tabular cursor-pointer"
                                    >
                                      +10
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
                      <h4 className="font-display text-xl font-bold uppercase flex items-center gap-2">
                        <Webhook className="w-4 h-4 text-[#FF4D00]" />
                        <span>Skema API Webhook Supabase</span>
                      </h4>
                      <div className="p-3 rounded-lg bg-[#0B0B0B] text-neutral-200 font-mono-tabular text-[11px] space-y-2 overflow-x-auto">
                        <div className="text-[#FF4D00]">POST /api/webhooks/supabase/inventory</div>
                        <div>Headers: x-supabase-signature (HMAC-SHA256)</div>
                        <pre className="text-neutral-300 leading-relaxed">{`{
  "type": "UPDATE",
  "table": "inventory_items",
  "record": {
    "sku": "${simSku}",
    "stock": 120
  }
}`}</pre>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                        <label className="block text-xs font-semibold">Uji Webhook &amp; Mekanisme Auto-Retry</label>
                        <select
                          value={simSku}
                          onChange={(e) => setSimSku(e.target.value)}
                          className="w-full h-9 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                        >
                          {overview.inventory.map((i) => (
                            <option key={i.id} value={i.sku}>
                              {i.sku} — {i.name}
                            </option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleSimulateWebhook(false)}
                            className="h-9 px-3 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] text-xs font-semibold cursor-pointer"
                          >
                            Simulasi Sync Sukses
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSimulateWebhook(true)}
                            className="h-9 px-3 rounded-md border border-[#FF4D00] text-[#FF4D00] hover:bg-[#FF4D00]/10 text-xs font-semibold cursor-pointer"
                          >
                            Uji Gagal + Auto-Retry
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-7 bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-display text-xl font-bold uppercase">Log Aktivitas Webhook Real-Time</h4>
                        <span className="text-xs font-mono-tabular text-neutral-500">
                          {overview.webhookLogs.length} peristiwa tercatat
                        </span>
                      </div>

                      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                        {overview.webhookLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-3 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 space-y-1.5 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 font-mono-tabular">
                                {log.status === 'delivered' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                )}
                                <span className="font-bold">{log.operation}</span>
                                <span>{log.sku}</span>
                                <span className="text-neutral-400">
                                  ({log.previousStock} → {log.newStock})
                                </span>
                              </div>

                              <div className="flex items-center gap-2 font-mono-tabular text-[11px]">
                                <span
                                  className={
                                    log.status === 'delivered'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                  }
                                >
                                  {log.status === 'delivered'
                                    ? `Terkirim (${log.latencyMs}ms)`
                                    : `Retry ${log.attempt}/${log.maxAttempts}`}
                                </span>
                                {log.status !== 'delivered' && (
                                  <button
                                    type="button"
                                    onClick={() => handleManualRetry(log.id)}
                                    className="px-2 py-0.5 rounded bg-[#FF4D00] text-white flex items-center gap-1 cursor-pointer"
                                  >
                                    <RefreshCw className="w-3 h-3" /> Retry
                                  </button>
                                )}
                              </div>
                            </div>

                            {log.errorMessage && (
                              <div className="text-[11px] text-amber-600 dark:text-amber-400">{log.errorMessage}</div>
                            )}

                            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono-tabular">
                              <span className="truncate max-w-md">{log.payloadPreview}</span>
                              <span className="shrink-0">{formatDateTime(log.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: LIVE CHAT & BUG REPORTS */}
              {tab === 'support' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
                    <h3 className="font-display text-2xl font-bold uppercase">Live Chat Pelanggan</h3>
                    <div className="h-64 overflow-y-auto space-y-2 p-3 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A]">
                      {chatMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`p-2.5 rounded-lg text-xs max-w-[85%] ${
                            m.senderRole === 'admin'
                              ? 'ml-auto bg-[#FF4D00] text-white'
                              : 'bg-white dark:bg-[#222] border border-black/10 dark:border-white/10'
                          }`}
                        >
                          <div className="font-semibold text-[10px] opacity-80">{m.senderName}</div>
                          <div>{m.text}</div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleAdminChatSend} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Balas pelanggan secara real-time..."
                        value={chatReply}
                        onChange={(e) => setChatReply(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                      />
                      <button
                        type="submit"
                        className="h-10 px-4 rounded-md bg-[#FF4D00] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> Kirim
                      </button>
                    </form>
                  </div>

                  <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
                    <h3 className="font-display text-2xl font-bold uppercase">Laporan Bug Pengguna</h3>
                    {overview.bugReports.length === 0 ? (
                      <p className="text-xs text-neutral-500">Belum ada laporan bug masuk.</p>
                    ) : (
                      <div className="space-y-2.5 max-h-72 overflow-y-auto">
                        {overview.bugReports.map((bug) => (
                          <div
                            key={bug.id}
                            className="p-3 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold">{bug.title}</span>
                              <span className="font-mono-tabular text-[11px] text-[#FF4D00]">{bug.status}</span>
                            </div>
                            <p className="text-neutral-600 dark:text-neutral-300">{bug.description}</p>
                            <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-400">
                              <span>{bug.reporterEmail} · {bug.viewport}</span>
                              {bug.status === 'open' && (
                                <button
                                  type="button"
                                  onClick={() => handleResolveBug(bug.id)}
                                  className="text-emerald-500 font-semibold cursor-pointer"
                                >
                                  Tandai Selesai
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )
        )}
      </div>
    </main>
  );
}
