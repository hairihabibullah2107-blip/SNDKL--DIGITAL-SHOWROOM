import {
  AlertCircle,
  Check,
  Eraser,
  Info,
  Layers,
  Move,
  Save,
  ShoppingCart,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
  CartItem,
  CustomDesignPlacement,
  DtfZonePrice,
  BulkDiscountRule,
  PrintingMethodOption,
  FabricOption,
  GarmentColorOption,
  Product,
  ShippingCourierConfig,
} from '../types';
import { formatRupiah } from '../utils/format';
import { removeImageBackground } from '../utils/removeBackground';

interface CustomDtfStudioProps {
  products: Product[];
  fabrics: FabricOption[];
  garmentColors: GarmentColorOption[];
  shippingOriginCity: string;
  shippingCouriers: ShippingCourierConfig[];
  dtfZones: DtfZonePrice[];
  bulkDiscounts: BulkDiscountRule[];
  printingMethods: PrintingMethodOption[];
  preselectedProduct?: Product | null;
  onAddCustomToCart: (item: CartItem) => void;
  onToast: (msg: string) => void;
}

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const SAMPLE_STAMPS = [
  {
    name: 'SANDIKALE MONO.svg',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="none"/><rect x="18" y="18" width="204" height="204" stroke="#7A1F2B" stroke-width="8" fill="none"/><text x="120" y="108" font-family="Arial Black, sans-serif" font-size="36" fill="#FFFFFF" text-anchor="middle">SANDI</text><text x="120" y="150" font-family="Arial Black, sans-serif" font-size="36" fill="#7A1F2B" text-anchor="middle">KALE</text><text x="120" y="185" font-family="monospace" font-size="14" fill="#FFFFFF" text-anchor="middle">STREETWEAR LAB</text></svg>`
      ),
  },
  {
    name: 'URBAN-GEO-01.svg',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><polygon points="120,20 220,190 20,190" fill="none" stroke="#FFFFFF" stroke-width="10"/><circle cx="120" cy="135" r="36" fill="#7A1F2B"/><rect x="88" y="202" width="64" height="12" fill="#FFFFFF"/></svg>`
      ),
  },
];

const DRAFT_STORAGE_KEY = 'sandikale_dtf_studio_draft_v3';
const DRAFT_DB_NAME = 'sandikale-studio-drafts';
const openDraftDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DRAFT_DB_NAME, 1);
  request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('drafts')) request.result.createObjectStore('drafts'); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const saveStudioDraft = async (key: string, value: unknown) => {
  const db = await openDraftDb();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
};
const loadStudioDraft = async <T,>(key: string): Promise<T | undefined> => {
  const db = await openDraftDb();
  const value = await new Promise<T | undefined>((resolve, reject) => { const req = db.transaction('drafts', 'readonly').objectStore('drafts').get(key); req.onsuccess = () => resolve(req.result as T | undefined); req.onerror = () => reject(req.error); });
  db.close(); return value;
};

export function CustomDtfStudio({
  products,
  fabrics,
  garmentColors,
  dtfZones,
  bulkDiscounts,
  printingMethods,
  preselectedProduct,
  onAddCustomToCart,
  onToast,
}: CustomDtfStudioProps) {
  const customBaseProducts = products.filter((p) => p.isCustomBase);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [fabricId, setFabricId] = useState<string>('');
  const [colorId, setColorId] = useState<string>('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [removingBg, setRemovingBg] = useState(false);

  const [activeView, setActiveView] = useState<'front' | 'back' | 'sleeve'>('front');
  const [placements, setPlacements] = useState<CustomDesignPlacement[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  useEffect(() => { loadStudioDraft(DRAFT_STORAGE_KEY).then((draft) => setHasSavedDraft(Boolean(draft))).catch(() => setHasSavedDraft(false)); }, []);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    if (preselectedProduct && preselectedProduct.isCustomBase) {
      setSelectedProductId(preselectedProduct.id);
      return;
    }
    if (!selectedProductId && customBaseProducts.length > 0) {
      setSelectedProductId(customBaseProducts[0].id);
    }
  }, [preselectedProduct, selectedProductId, customBaseProducts]);

  useEffect(() => {
    if (fabricId && !fabrics.some((f) => f.id === fabricId)) {
      setFabricId('');
    }
  }, [fabrics, fabricId]);

  useEffect(() => {
    if (colorId && !garmentColors.some((c) => c.id === colorId)) {
      setColorId('');
    }
  }, [garmentColors, colorId]);

  const selectedProduct = selectedProductId
    ? customBaseProducts.find((p) => p.id === selectedProductId) || null
    : null;
  const activeSilhouette = selectedProduct?.silhouette || 'boxy-tee';
  const selectedFabric = fabricId ? fabrics.find((f) => f.id === fabricId) || null : null;
  const selectedColor = colorId ? garmentColors.find((c) => c.id === colorId) || null : null;
  const activeColorHex = selectedColor?.hex || '#27272A';
  const activePlacement = placements.find((p) => p.zoneId === selectedZoneId) || null;

  const isStudioReady = Boolean(selectedProduct && selectedFabric && selectedColor && size && placements.length > 0);

  const dtfTotalPerShirt = placements.reduce((sum, p) => sum + p.price, 0);
  const baseGarmentPrice = activeSilhouette === 'longsleeve' ? (selectedProduct?.longSleevePrice ?? selectedProduct?.price ?? 0) : (selectedProduct?.price || 0);
  const selectedVariantAdjustment = selectedProduct?.variantPrices?.[`${selectedColor?.name.toLowerCase() || ''}::${size}`] || 0;
  const selectedSizeSurcharge = selectedProduct?.sizeSurcharges?.[size] || 0;
  const rawUnitPrice = baseGarmentPrice + (selectedFabric?.priceModifier || 0) + dtfTotalPerShirt + selectedVariantAdjustment + selectedSizeSurcharge;
  const activeBulkDiscount = [...bulkDiscounts].sort((a,b)=>b.minQuantity-a.minQuantity).find((rule)=>quantity>=rule.minQuantity);
  const bulkDiscountRate = Math.max(0,Math.min(100,activeBulkDiscount?.discountPercent||0))/100;
  const unitPrice = Math.round(rawUnitPrice * (1 - bulkDiscountRate));
  const totalEstimate = unitPrice * quantity;

  const getAutoScaleForZone = (zoneId: string) => {
    if (zoneId === 'front-pocket' || zoneId === 'sleeve-label') return 0.92;
    if (zoneId === 'front-a4') return 0.9;
    return 0.95;
  };

  const handleSelectZone = (zone: DtfZonePrice) => {
    setActiveView(zone.view);
    setSelectedZoneId(zone.id);
    const exists = placements.find((p) => p.zoneId === zone.id);
    if (!exists) {
      setPlacements((prev) => [
        ...prev,
        {
          zoneId: zone.id,
          zoneLabel: zone.label,
          artworkName: SAMPLE_STAMPS[1].name,
          artworkDataUrl: SAMPLE_STAMPS[1].dataUrl,
          originalDataUrl: SAMPLE_STAMPS[1].dataUrl,
          xOffset: 0,
          yOffset: 0,
          scale: getAutoScaleForZone(zone.id),
          rotation: 0,
          removeWhiteBg: true,
          bgTolerance: 38,
          price: zone.price,
        },
      ]);
    }
  };

  const handleRemoveZone = (zoneId: string) => {
    setPlacements((prev) => {
      const next = prev.filter((p) => p.zoneId !== zoneId);
      if (selectedZoneId === zoneId && next.length > 0) {
        setSelectedZoneId(next[0].zoneId);
      }
      return next;
    });
  };

  const processArtworkBg = async (
    originalUrl: string,
    enableRemoveBg: boolean,
    tolerance: number
  ): Promise<string> => {
    if (!enableRemoveBg) return originalUrl;
    try {
      setRemovingBg(true);
      return await removeImageBackground(originalUrl, { tolerance, feather: 14 });
    } catch {
      return originalUrl;
    } finally {
      setRemovingBg(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      onToast('Ukuran file maksimal 5MB agar pratinjau tetap ringan.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const originalUrl = String(reader.result || '');
      if (!originalUrl) return;
      const targetZone = dtfZones.find((z) => z.id === selectedZoneId) || dtfZones[0];
      const existing = placements.find((p) => p.zoneId === targetZone.id);
      const shouldRemove = existing ? existing.removeWhiteBg : true;
      const tol = existing?.bgTolerance ?? 38;
      const processedUrl = await processArtworkBg(originalUrl, shouldRemove, tol);

      setPlacements((prev) => {
        const idx = prev.findIndex((p) => p.zoneId === targetZone.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            artworkName: file.name,
            originalDataUrl: originalUrl,
            artworkDataUrl: processedUrl,
            removeWhiteBg: shouldRemove,
            bgTolerance: tol,
          };
          return updated;
        }
        return [
          ...prev,
          {
            zoneId: targetZone.id,
            zoneLabel: targetZone.label,
            artworkName: file.name,
            originalDataUrl: originalUrl,
            artworkDataUrl: processedUrl,
            xOffset: 0,
            yOffset: 0,
            scale: getAutoScaleForZone(targetZone.id),
            rotation: 0,
            removeWhiteBg: shouldRemove,
            bgTolerance: tol,
            price: targetZone.price,
          },
        ];
      });
      onToast(
        shouldRemove
          ? `Desain "${file.name}" diunggah & background dihapus otomatis.`
          : `Desain "${file.name}" siap dipratinjau pada zona ${targetZone.label}.`
      );
    };
    reader.readAsDataURL(file);
  };

  const updateActivePlacement = (patch: Partial<CustomDesignPlacement>) => {
    if (!activePlacement) return;
    setPlacements((prev) => prev.map((p) => (p.zoneId === activePlacement.zoneId ? { ...p, ...patch } : p)));
  };

  const handleToggleAutoBgRemove = async (checked: boolean) => {
    if (!activePlacement) return;
    const baseSrc = activePlacement.originalDataUrl || activePlacement.artworkDataUrl;
    const tol = activePlacement.bgTolerance ?? 38;
    const nextUrl = await processArtworkBg(baseSrc, checked, tol);
    updateActivePlacement({
      removeWhiteBg: checked,
      originalDataUrl: baseSrc,
      artworkDataUrl: nextUrl,
    });
  };

  const handleToleranceChange = async (nextTol: number) => {
    if (!activePlacement) return;
    const baseSrc = activePlacement.originalDataUrl || activePlacement.artworkDataUrl;
    updateActivePlacement({ bgTolerance: nextTol });
    if (activePlacement.removeWhiteBg) {
      const nextUrl = await processArtworkBg(baseSrc, true, nextTol);
      updateActivePlacement({ bgTolerance: nextTol, artworkDataUrl: nextUrl });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!activePlacement) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: activePlacement.xOffset,
      origY: activePlacement.yOffset,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !canvasRef.current || !activePlacement) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dxPct = ((e.clientX - draggingRef.current.startX) / rect.width) * 100;
    const dyPct = ((e.clientY - draggingRef.current.startY) / rect.height) * 100;
    const clampedX = Math.max(-22, Math.min(22, Math.round(draggingRef.current.origX + dxPct)));
    const clampedY = Math.max(-22, Math.min(22, Math.round(draggingRef.current.origY + dyPct)));
    updateActivePlacement({ xOffset: clampedX, yOffset: clampedY });
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
  };

  const handleSaveDraft = async () => {
    try {
      await saveStudioDraft(DRAFT_STORAGE_KEY, { selectedProductId, fabricId, colorId, size, quantity, placements, savedAt: new Date().toISOString() });
      setHasSavedDraft(true);
      onToast('Draf desain dan file artwork tersimpan di perangkat ini.');
    } catch { onToast('Penyimpanan draf gagal. Periksa ruang penyimpanan browser.'); }
  };

  const handleLoadDraft = async () => {
    try {
      const draft = await loadStudioDraft<{selectedProductId?:string;fabricId?:string;colorId?:string;size?:string;quantity?:number;placements?:CustomDesignPlacement[]}>(DRAFT_STORAGE_KEY);
      if (!draft) { onToast('Belum ada draf tersimpan.'); return; }
      if (draft.selectedProductId) setSelectedProductId(draft.selectedProductId);
      if (draft.fabricId) setFabricId(draft.fabricId);
      if (draft.colorId) setColorId(draft.colorId);
      if (draft.size) setSize(draft.size);
      if (draft.quantity) setQuantity(draft.quantity);
      if (Array.isArray(draft.placements)) { setPlacements(draft.placements); setSelectedZoneId(draft.placements[0]?.zoneId || ''); }
      onToast('Draf tersimpan berhasil dimuat.');
    } catch { onToast('Gagal memuat draf dari penyimpanan browser.'); }
  };

  const handleOrderCustom = () => {
    if (!selectedProduct) {
      onToast('Pilih model baju dari katalog terlebih dahulu.');
      return;
    }
    if (!selectedFabric || !selectedColor) {
      onToast('Pilih bahan kain dan warna baju terlebih dahulu.');
      return;
    }
    if (!size) {
      onToast('Pilih ukuran baju (S / M / L / XL / XXL) terlebih dahulu.');
      return;
    }
    if (placements.length === 0) {
      onToast('Pilih minimal 1 zona sablon DTF & unggah desain terlebih dahulu.');
      return;
    }
    onAddCustomToCart({
      id: `custom-${Date.now()}`,
      type: 'custom_dtf',
      productId: selectedProduct.id,
      sku: selectedProduct.sku,
      name: `Custom DTF ${selectedProduct.name}`,
      image: selectedProduct.images[0],
      colorName: selectedColor.name,
      colorHex: selectedColor.hex,
      size,
      quantity,
      unitPrice,
      fabricName: selectedFabric.name,
      fabricId: selectedFabric.id,
      customModel: `${activeSilhouette} ${selectedProduct.name}`,
      customPlacements: placements.map(({ originalDataUrl: _orig, ...rest }) => rest),
    });
  };

  const visiblePlacements = placements.filter((p) => {
    const z = dtfZones.find((dz) => dz.id === p.zoneId);
    return z?.view === activeView;
  });

  const activeZoneMeta = dtfZones.find((z) => z.id === selectedZoneId);
  const mockupType = activeSilhouette === 'longsleeve' ? 'long' : 'short';
  const selectedMockup = selectedColor?.mockups?.find((item) => item.garmentType === mockupType);

  return (
    <section id="studio" className="py-14 md:py-20 bg-neutral-100/70 dark:bg-[#0E0E0E] border-b border-black/10 dark:border-white/10">
      <div className="max-w-[1360px] mx-auto px-4 md:px-6 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7A1F2B]">
              Direct-To-Film Configurator
            </p>
            <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight mt-1">
              Custom DTF Studio
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
            <span>Hapus Background Otomatis Ala Canva</span>
            <span aria-hidden="true">·</span>
            <span>Mockup Foto Depan &amp; Belakang</span>
            <span aria-hidden="true">·</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#7A1F2B]" />
          <span>
            <strong>Simulasi Gambaran Publik:</strong> Studio ini berfungsi sebagai pratinjau penempatan &amp; gambaran estimasi biaya. Anda cukup <strong>menggeser posisi desain</strong> (ukuran cetak otomatis mengikuti zona yang dipilih). File desain asli dikirimkan ke <strong>WhatsApp Admin saat checkout</strong> untuk proses revisi dan konfirmasi cetak.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Live Interactive Garment Mockup Canvas */}
          <div className="lg:col-span-6 bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-4 md:p-6 space-y-4 lg:sticky lg:top-24">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-[#1E1E1E]">
                {(['front', 'back', 'sleeve'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setActiveView(view)}
                    className={`h-8 px-3 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                      activeView === view
                        ? 'bg-[#080808] dark:bg-white text-white dark:text-[#080808]'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-[#080808] dark:hover:text-white'
                    }`}
                  >
                    {view === 'front' ? 'Depan' : view === 'back' ? 'Belakang' : 'Lengan'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {hasSavedDraft && (
                  <button
                    type="button"
                    onClick={handleLoadDraft}
                    className="h-8 px-3 rounded-md border border-black/15 dark:border-white/15 hover:border-[#7A1F2B] text-xs font-medium cursor-pointer"
                  >
                    Muat Draf
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="h-8 px-3 rounded-md border border-black/15 dark:border-white/15 hover:border-[#7A1F2B] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Draf</span>
                </button>
              </div>
            </div>

            {selectedProduct ? (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-neutral-100 dark:bg-[#1B1B1B] text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={
                      activeView === 'back'
                        ? selectedMockup?.backImage || selectedProduct.backImage || selectedProduct.images[1] || selectedProduct.images[0]
                        : selectedMockup?.frontImage || selectedProduct.frontImage || selectedProduct.images[0]
                    }
                    alt={selectedProduct.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold truncate">{selectedProduct.name}</div>
                    <div className="text-[11px] text-neutral-500">
                      Foto Mockup: {activeView === 'front' ? 'Tampak Depan' : activeView === 'back' ? 'Tampak Belakang' : 'Lengan'} · {selectedProduct.sku}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono-tabular text-[#7A1F2B] shrink-0 uppercase">
                  {activeSilhouette}
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg border border-dashed border-black/15 dark:border-white/15 text-xs text-neutral-500 dark:text-neutral-400">
                Belum ada model baju dipilih. Pilih produk dari katalog di sebelah kanan untuk menampilkan foto mockup Depan &amp; Belakang.
              </div>
            )}

            <div
              ref={canvasRef}
              className="relative aspect-[4/4.2] w-full rounded-lg overflow-hidden bg-gradient-to-b from-neutral-200 to-neutral-300 dark:from-[#1A1A1A] dark:to-[#101010] border border-black/10 dark:border-white/10 flex items-center justify-center select-none touch-none"
            >
              {selectedProduct && (activeView !== 'sleeve' || Boolean(selectedProduct.images[2])) ? (
                <>
                  <img
                    src={
                      activeView === 'sleeve'
                        ? selectedProduct.images[2]
                        : activeView === 'back'
                          ? selectedProduct.backImage || selectedProduct.images[1] || selectedProduct.images[0]
                          : selectedProduct.frontImage || selectedProduct.images[0]
                    }
                    alt={`${selectedProduct.name} ${activeView === 'sleeve' ? 'model lengan panjang' : activeView === 'back' ? 'tampak belakang' : 'tampak depan'}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain pointer-events-none"
                  />
                  {selectedColor && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/75 text-white text-[11px] font-medium flex items-center gap-1.5 backdrop-blur-sm">
                      <span
                        className="w-3 h-3 rounded-full border border-white/40"
                        style={{ backgroundColor: selectedColor.hex }}
                      />
                      <span>Warna: {selectedColor.name}</span>
                    </div>
                  )}
                </>
              ) : (
                <svg viewBox="0 0 400 420" className="w-[88%] h-[88%] drop-shadow-xl" aria-label="Pratinjau Mockup Baju Katalog">
                  <defs>
                    <linearGradient id="fabricShade" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.24" />
                    </linearGradient>
                  </defs>

                  {activeSilhouette === 'hoodie' ? (
                    <g>
                      <path
                        d="M132,74 C150,24 250,24 268,74 L348,118 L374,244 L322,256 L300,175 L300,378 L100,378 L100,175 L78,256 L26,244 L52,118 Z"
                        fill={activeColorHex}
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="2"
                      />
                      <path
                        d="M132,74 C150,24 250,24 268,74 L348,118 L374,244 L322,256 L300,175 L300,378 L100,378 L100,175 L78,256 L26,244 L52,118 Z"
                        fill="url(#fabricShade)"
                      />
                      {activeView === 'front' && (
                        <>
                          <path d="M138,76 Q200,115 262,76" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                          <path d="M135,285 L265,285 L278,348 L122,348 Z" fill="rgba(0,0,0,0.14)" stroke="rgba(255,255,255,0.12)" />
                        </>
                      )}
                    </g>
                  ) : activeSilhouette === 'longsleeve' ? (
                    <g>
                      <path
                        d="M145,58 Q200,82 255,58 L345,98 L378,278 L334,288 L302,162 L302,382 L98,382 L98,162 L66,288 L22,278 L55,98 Z"
                        fill={activeColorHex}
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="2"
                      />
                      <path
                        d="M145,58 Q200,82 255,58 L345,98 L378,278 L334,288 L302,162 L302,382 L98,382 L98,162 L66,288 L22,278 L55,98 Z"
                        fill="url(#fabricShade)"
                      />
                    </g>
                  ) : activeSilhouette === 'regular-tee' ? (
                    <g>
                      <path
                        d="M152,58 Q200,86 248,58 L318,86 L340,162 L292,178 L282,138 L282,382 L118,382 L118,138 L108,178 L60,162 L82,86 Z"
                        fill={activeColorHex}
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="2"
                      />
                      <path
                        d="M152,58 Q200,86 248,58 L318,86 L340,162 L292,178 L282,138 L282,382 L118,382 L118,138 L108,178 L60,162 L82,86 Z"
                        fill="url(#fabricShade)"
                      />
                      <path
                        d={activeView === 'back' ? 'M152,58 Q200,72 248,58' : 'M152,58 Q200,92 248,58'}
                        fill="none"
                        stroke="rgba(255,255,255,0.22)"
                        strokeWidth="5"
                      />
                    </g>
                  ) : (
                    <g>
                      <path
                        d="M142,56 Q200,88 258,56 L354,96 L376,196 L312,212 L302,158 L304,376 L96,376 L98,158 L88,212 L24,196 L46,96 Z"
                        fill={activeColorHex}
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="2"
                      />
                      <path
                        d="M142,56 Q200,88 258,56 L354,96 L376,196 L312,212 L302,158 L304,376 L96,376 L98,158 L88,212 L24,196 L46,96 Z"
                        fill="url(#fabricShade)"
                      />
                      <path
                        d={activeView === 'back' ? 'M142,56 Q200,72 258,56' : 'M142,56 Q200,96 258,56'}
                        fill="none"
                        stroke="rgba(255,255,255,0.24)"
                        strokeWidth="7"
                      />
                    </g>
                  )}
                </svg>
              )}

              {visiblePlacements.map((pl) => {
                const zMeta = dtfZones.find((z) => z.id === pl.zoneId);
                if (!zMeta) return null;
                const isSelected = pl.zoneId === selectedZoneId;
                const autoScale = getAutoScaleForZone(pl.zoneId);
                return (
                  <div
                    key={pl.zoneId}
                    onClick={() => setSelectedZoneId(pl.zoneId)}
                    style={{
                      left: `${zMeta.box.x}%`,
                      top: `${zMeta.box.y}%`,
                      width: `${zMeta.box.w}%`,
                      height: `${zMeta.box.h}%`,
                    }}
                    className={`absolute flex items-center justify-center border ${
                      isSelected ? 'border-dashed border-[#7A1F2B] bg-[#7A1F2B]/5' : 'border-dashed border-white/35'
                    }`}
                  >
                    <div
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      style={{
                        transform: `translate(${pl.xOffset}%, ${pl.yOffset}%) scale(${autoScale})`,
                      }}
                      className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                    >
                      <img
                        src={pl.artworkDataUrl}
                        alt={pl.artworkName}
                        draggable={false}
                        className="max-w-full max-h-full object-contain pointer-events-none drop-shadow"
                      />
                    </div>
                  </div>
                );
              })}

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono-tabular px-3 py-1.5 rounded-md bg-black/75 text-white">
                <span className="flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-[#7A1F2B]" />
                  {removingBg ? 'Menghapus background otomatis...' : 'Geser posisi desain di area garis oranye'}
                </span>
                <span className="truncate max-w-[160px]">
                  {activeZoneMeta ? `Auto ${activeZoneMeta.dimensionsCm}` : selectedProduct?.fit || 'Custom'}
                </span>
              </div>
            </div>

            {activePlacement && (
              <div className="p-3.5 rounded-lg bg-neutral-100 dark:bg-[#1C1C1C] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold truncate">
                    Layer Aktif: <span className="text-[#7A1F2B]">{activePlacement.zoneLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateActivePlacement({ xOffset: 0, yOffset: 0 })}
                    className="text-xs text-neutral-500 hover:text-[#7A1F2B] cursor-pointer shrink-0"
                  >
                    Reset Posisi Geser
                  </button>
                </div>

                <div className="p-2.5 rounded-md bg-white/70 dark:bg-[#141414] border border-black/10 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold">Ukuran Cetak Otomatis Sesuai Opsi</div>
                    <div className="text-[11px] text-neutral-500">
                      Proporsi menyesuaikan zona {activeZoneMeta?.label} — cukup geser posisi di kanvas.
                    </div>
                  </div>
                  <span className="font-mono-tabular font-bold text-[#7A1F2B] shrink-0">
                    {activeZoneMeta?.dimensionsCm}
                  </span>
                </div>

                {/* Canva-style Automatic Background Removal Panel */}
                <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded border border-black/15 dark:border-white/15 shrink-0 flex items-center justify-center p-1"
                        style={{
                          backgroundImage:
                            'linear-gradient(45deg, #d4d4d8 25%, transparent 25%), linear-gradient(-45deg, #d4d4d8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d4d4d8 75%), linear-gradient(-45deg, transparent 75%, #d4d4d8 75%)',
                          backgroundSize: '10px 10px',
                          backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                        }}
                      >
                        <img
                          src={activePlacement.artworkDataUrl}
                          alt="Hasil PNG transparan"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activePlacement.removeWhiteBg}
                          onChange={(e) => handleToggleAutoBgRemove(e.target.checked)}
                          className="accent-[#7A1F2B]"
                        />
                        <Eraser className="w-3.5 h-3.5 text-[#7A1F2B] shrink-0" />
                        <span>Hapus Background Otomatis Ala Canva (PNG)</span>
                      </label>
                    </div>
                    <span className="text-[11px] font-mono-tabular text-emerald-600 dark:text-emerald-400 shrink-0">
                      {activePlacement.removeWhiteBg ? 'Transparan' : 'Asli'}
                    </span>
                  </div>

                  {activePlacement.removeWhiteBg && (
                    <label className="block space-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                      <div className="flex justify-between">
                        <span>Sensitivitas Pembersihan Background</span>
                        <span className="font-mono-tabular">{activePlacement.bgTolerance ?? 38}</span>
                      </div>
                      <input
                        type="range"
                        min={15}
                        max={85}
                        step={2}
                        value={activePlacement.bgTolerance ?? 38}
                        onChange={(e) => handleToleranceChange(Number(e.target.value))}
                        className="w-full accent-[#7A1F2B]"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Catalog Garment Selector + Admin-Configured Material & Colors */}
          <div className="lg:col-span-6 space-y-5">
            <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
              <h3 className="font-display text-2xl font-bold uppercase tracking-wide">
                1. Pilih Baju dari Katalog &amp; Material Kain
              </h3>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Bentuk Baju Sesuai Katalog
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {customBaseProducts.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => setSelectedProductId(prod.id)}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex items-center gap-3 ${
                        selectedProduct?.id === prod.id
                          ? 'border-[#7A1F2B] bg-[#7A1F2B]/10'
                          : 'border-black/10 dark:border-white/10 hover:border-[#7A1F2B]/50'
                      }`}
                    >
                      <img
                        src={prod.images[0]}
                        alt={prod.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{prod.name}</div>
                        <div className="text-[11px] text-neutral-500 truncate">{prod.fit}</div>
                        <div className="text-[11px] font-mono-tabular text-[#7A1F2B]">
                          {formatRupiah(prod.price)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Pilih Bahan Kain (Dikelola Admin)
                </div>
                {fabrics.length === 0 ? (
                  <div className="p-3.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 text-xs flex items-start gap-2 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Material kain belum diisi dan dipublikasikan oleh Admin.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {fabrics.map((fab) => (
                      <button
                        key={fab.id}
                        type="button"
                        onClick={() => setFabricId(fab.id)}
                        className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                          fabricId === fab.id
                            ? 'border-[#7A1F2B] bg-[#7A1F2B]/10'
                            : 'border-black/10 dark:border-white/10 hover:border-[#7A1F2B]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold">{fab.name}</span>
                          <span className="text-[11px] font-mono-tabular text-[#7A1F2B]">{fab.gsm}</span>
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">{fab.feel}</div>
                        <div className="text-[11px] font-mono-tabular mt-1">
                          {fab.priceModifier > 0 ? `+${formatRupiah(fab.priceModifier)}` : 'Termasuk'} · Produksi {fab.productionDays} hari
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Warna: <span className="text-[#080808] dark:text-white">{selectedColor?.name || 'Belum tersedia'}</span>
                  </div>
                  {garmentColors.length === 0 ? (
                    <div className="p-2.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 text-[11px] text-amber-700 dark:text-amber-300">
                      Pilihan warna belum diisi oleh Admin.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {garmentColors.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setColorId(c.id)}
                          title={c.name}
                          aria-label={`Pilih warna ${c.name}`}
                          className={`w-8 h-8 rounded-full border-2 cursor-pointer flex items-center justify-center ${
                            colorId === c.id ? 'border-[#7A1F2B] scale-110' : 'border-black/20 dark:border-white/20'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {colorId === c.id && <Check className="w-3.5 h-3.5 text-[#7A1F2B]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Ukuran
                  </div>
                  <div className="flex items-center gap-1.5">
                    {SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`flex-1 h-9 rounded-md text-xs font-semibold border cursor-pointer ${
                          size === s
                            ? 'bg-[#080808] dark:bg-white text-white dark:text-[#080808] border-[#080808] dark:border-white'
                            : 'border-black/15 dark:border-white/15'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold uppercase tracking-wide">
                  2. Zona Sablon &amp; Unggah Desain DTF
                </h3>
                <span className="text-xs font-mono-tabular text-neutral-500">{placements.length} Zona Aktif</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {printingMethods.length>0&&<div className="mb-4 rounded-xl border border-black/10 dark:border-white/10 p-3 space-y-2"><div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Teknik produksi tersedia</div><div className="flex flex-wrap gap-2">{printingMethods.map(method=><span key={method.id} title={method.description} className="rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-[11px]">{method.name}<span className="ml-1.5 text-neutral-400">{method.pricingType==='quote'?'· Penawaran admin':'· Tersedia'}</span></span>)}</div><p className="text-[10px] text-neutral-500">Pemesanan online saat ini menghitung tarif DTF. Teknik lain dapat dikonsultasikan dengan admin.</p></div>}
                {dtfZones.map((zone) => {
                  const isAdded = placements.some((p) => p.zoneId === zone.id);
                  const isFocused = selectedZoneId === zone.id;
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => handleSelectZone(zone)}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        isFocused
                          ? 'border-[#7A1F2B] bg-[#7A1F2B]/10'
                          : isAdded
                          ? 'border-emerald-500/60 bg-emerald-500/5'
                          : 'border-black/10 dark:border-white/10 hover:border-[#7A1F2B]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-xs font-semibold">
                        <span className="truncate">{zone.label}</span>
                        {isAdded && <Layers className="w-3.5 h-3.5 text-[#7A1F2B] shrink-0" />}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {zone.dimensionsCm} · {formatRupiah(zone.price)}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 rounded-lg border border-dashed border-black/20 dark:border-white/20 bg-neutral-50 dark:bg-[#1A1A1A] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold">
                      Unggah Artwork untuk:{' '}
                      <span className="text-[#7A1F2B]">
                        {activeZoneMeta?.label || 'Pilih zona sablon di atas terlebih dahulu'}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Background dihapus otomatis ke PNG transparan saat diunggah (PNG/JPG/SVG maks 5MB)
                    </div>
                  </div>
                  <label className="h-9 px-4 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] hover:bg-[#7A1F2B] dark:hover:bg-[#7A1F2B] dark:hover:text-white text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer shrink-0 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Unggah Desain</span>
                    <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                  <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#7A1F2B]" /> Contoh grafis cepat:
                  </span>
                  {SAMPLE_STAMPS.map((st) => (
                    <button
                      key={st.name}
                      type="button"
                      onClick={() => {
                        const targetZone = dtfZones.find((z) => z.id === selectedZoneId) || dtfZones[0];
                        if (!targetZone) return;
                        setSelectedZoneId(targetZone.id);
                        setActiveView(targetZone.view);
                        setPlacements((prev) => {
                          const exists = prev.some((p) => p.zoneId === targetZone.id);
                          if (exists) {
                            return prev.map((p) =>
                              p.zoneId === targetZone.id
                                ? { ...p, artworkName: st.name, originalDataUrl: st.dataUrl, artworkDataUrl: st.dataUrl }
                                : p
                            );
                          }
                          return [
                            ...prev,
                            {
                              zoneId: targetZone.id,
                              zoneLabel: targetZone.label,
                              artworkName: st.name,
                              artworkDataUrl: st.dataUrl,
                              originalDataUrl: st.dataUrl,
                              xOffset: 0,
                              yOffset: 0,
                              scale: getAutoScaleForZone(targetZone.id),
                              rotation: 0,
                              removeWhiteBg: true,
                              bgTolerance: 38,
                              price: targetZone.price,
                            },
                          ];
                        });
                      }}
                      className="text-[11px] px-2.5 py-1 rounded border border-black/15 dark:border-white/15 hover:border-[#7A1F2B] cursor-pointer"
                    >
                      {st.name.replace('.svg', '')}
                    </button>
                  ))}
                </div>
              </div>

              {placements.length > 0 && (
                <div className="space-y-2">
                  {placements.map((pl) => (
                    <div
                      key={pl.zoneId}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-neutral-50 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const z = dtfZones.find((dz) => dz.id === pl.zoneId);
                          if (z) setActiveView(z.view);
                          setSelectedZoneId(pl.zoneId);
                        }}
                        className="flex items-center gap-2.5 text-left truncate cursor-pointer"
                      >
                        <img src={pl.artworkDataUrl} alt="" className="w-7 h-7 rounded bg-neutral-800 object-contain p-0.5 shrink-0" />
                        <div className="truncate">
                          <div className="font-semibold truncate">{pl.zoneLabel}</div>
                          <div className="text-[11px] text-neutral-500 truncate">{pl.artworkName}</div>
                        </div>
                      </button>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono-tabular">{formatRupiah(pl.price)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveZone(pl.zoneId)}
                          aria-label={`Hapus zona ${pl.zoneLabel}`}
                          className="text-neutral-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Qty:</span>
                  <div className="flex items-center border border-black/15 dark:border-white/15 rounded-md h-9">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-8 h-full font-bold hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      aria-label="Jumlah pesanan"
                      className="w-12 text-center text-xs font-mono-tabular bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-8 h-full font-bold hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  {bulkDiscountRate > 0 && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Diskon Grosir {bulkDiscountRate * 100}%
                    </span>
                  )}
                </div>


              </div>

              <div className="space-y-1.5 text-xs pt-2 border-t border-black/10 dark:border-white/10">
                <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
                  <span>{selectedProduct?.name || 'Baju belum dipilih'} + {selectedFabric?.name || 'Kain belum dipilih'}</span>
                  <span className="font-mono-tabular">{formatRupiah(baseGarmentPrice + (selectedFabric?.priceModifier || 0))}</span>
                </div>
                <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
                  <span>Total Biaya Sablon DTF ({placements.length} posisi)</span>
                  <span className="font-mono-tabular">{formatRupiah(dtfTotalPerShirt)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-black/10 dark:border-white/10">
                  <span>
                    Total Harga ({quantity} pcs)
                  </span>
                  <span className="text-lg font-mono-tabular text-[#7A1F2B]">{formatRupiah(totalEstimate)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={!isStudioReady}
                onClick={handleOrderCustom}
                className="w-full h-12 rounded-md bg-[#7A1F2B] hover:bg-[#e04400] text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-45"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>
                  {fabrics.length === 0 || garmentColors.length === 0
                    ? 'Lengkapi Kain & Warna di Admin Terlebih Dahulu'
                    : !selectedProduct
                    ? 'Pilih Model Baju Terlebih Dahulu'
                    : !selectedFabric || !selectedColor || !size
                    ? 'Pilih Kain, Warna & Ukuran'
                    : placements.length === 0
                    ? 'Pilih Zona Sablon & Unggah Desain'
                    : 'Masukkan Custom DTF ke Tas'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
