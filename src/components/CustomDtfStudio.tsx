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
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CartItem,
  CustomDesignPlacement,
  DtfZonePrice,
  BulkDiscountRule,
  PrintingMethodOption,
  FabricOption,
  GarmentColorOption,
  Product,
} from '../types';
import { formatRupiah } from '../utils/format';
import { removeImageBackground } from '../utils/removeBackground';

interface CustomDtfStudioProps {
  products: Product[];
  fabrics: FabricOption[];
  garmentColors: GarmentColorOption[];
  dtfZones: DtfZonePrice[];
  bulkDiscounts: BulkDiscountRule[];
  printingMethods: PrintingMethodOption[];
  preselectedProduct?: Product | null;
  onAddCustomToCart: (item: CartItem) => void;
  onToast: (msg: string) => void;
}

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const GARMENT_COLOR_PREVIEWS: Record<string, string> = {
  hitam: '#171717', black: '#171717',
  putih: '#F4F1EA', white: '#F4F1EA', ivory: '#F4F1EA',
  merah: '#C62828', red: '#C62828',
  maroon: '#6B1F35', burgundy: '#6B1F35',
  navy: '#172B4D', 'biru navy': '#172B4D',
  biru: '#2563A6', blue: '#2563A6',
  'biru muda': '#83B7D9', 'light blue': '#83B7D9',
  hijau: '#34734B', green: '#34734B',
  sage: '#9BAF9A', 'sage green': '#9BAF9A',
  olive: '#687442', 'hijau army': '#596447', army: '#596447',
  kuning: '#E5C542', yellow: '#E5C542',
  orange: '#D97736', oranye: '#D97736',
  pink: '#D98AA5', 'merah muda': '#D98AA5',
  ungu: '#76539B', purple: '#76539B',
  abu: '#858585', 'abu-abu': '#858585', grey: '#858585', gray: '#858585',
  cream: '#D9CBB3', krem: '#D9CBB3',
  cokelat: '#80543A', brown: '#80543A',
};

type GarmentPreviewBounds = { centerX: number; centerY: number; widthPct: number; heightPct: number };

const DEFAULT_GARMENT_BOUNDS: GarmentPreviewBounds = { centerX: 50, centerY: 50, widthPct: 68, heightPct: 86 };

const measureGarmentPreviewBounds = (src: string): Promise<GarmentPreviewBounds> => new Promise((resolve) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return resolve(DEFAULT_GARMENT_BOUNDS);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (pixels[(y * canvas.width + x) * 4 + 3] > 28) {
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
        }
      }
      if (maxX < minX || maxY < minY) return resolve(DEFAULT_GARMENT_BOUNDS);
      const containerAspect = 4 / 4.2;
      const imageAspect = (image.naturalWidth || 1) / (image.naturalHeight || 1);
      const fitWidthPct = Math.min(1, imageAspect / containerAspect) * 100;
      const fitHeightPct = Math.min(1, containerAspect / imageAspect) * 100;
      const leftOffset = (100 - fitWidthPct) / 2;
      const topOffset = (100 - fitHeightPct) / 2;
      const left = leftOffset + (minX / canvas.width) * fitWidthPct;
      const right = leftOffset + ((maxX + 1) / canvas.width) * fitWidthPct;
      const top = topOffset + (minY / canvas.height) * fitHeightPct;
      const bottom = topOffset + ((maxY + 1) / canvas.height) * fitHeightPct;
      resolve({ centerX: (left + right) / 2, centerY: (top + bottom) / 2, widthPct: right - left, heightPct: bottom - top });
    } catch {
      resolve(DEFAULT_GARMENT_BOUNDS);
    }
  };
  image.onerror = () => resolve(DEFAULT_GARMENT_BOUNDS);
  image.src = src;
});

const GARMENT_WIDTH_CM_BY_SIZE: Record<string, number> = { S: 48, M: 50, L: 52, XL: 54, XXL: 56 };

function resolveGarmentColorPreview(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) return normalized;
  return GARMENT_COLOR_PREVIEWS[normalized] || null;
}

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
  const [requestedColor, setRequestedColor] = useState('');
  const [jerseyReference, setJerseyReference] = useState<{ name: string; dataUrl: string } | null>(null);
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [removingBg, setRemovingBg] = useState(false);
  const [mockupImageFailed, setMockupImageFailed] = useState(false);
  const [mockupHasTransparency, setMockupHasTransparency] = useState(false);
  const [mockupImageSrc, setMockupImageSrc] = useState('');
  const [garmentBounds, setGarmentBounds] = useState<GarmentPreviewBounds>(DEFAULT_GARMENT_BOUNDS);

  const [activeView, setActiveView] = useState<'front' | 'back' | 'sleeve'>('front');
  const [placements, setPlacements] = useState<CustomDesignPlacement[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [showFloatingPreview, setShowFloatingPreview] = useState(false);
  useEffect(() => { loadStudioDraft(DRAFT_STORAGE_KEY).then((draft) => setHasSavedDraft(Boolean(draft))).catch(() => setHasSavedDraft(false)); }, []);
  useEffect(() => {
    let frameId: number | null = null;
    const updatePreviewVisibility = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        const section = document.getElementById('studio');
        if (!section) return;
        const bounds = section.getBoundingClientRect();
        const visible = bounds.top < 72 && bounds.bottom > 140 && window.innerWidth < 1024;
        setShowFloatingPreview((current) => current === visible ? current : visible);
      });
    };
    updatePreviewVisibility();
    window.addEventListener('scroll', updatePreviewVisibility, { passive: true });
    window.addEventListener('resize', updatePreviewVisibility, { passive: true });
    return () => {
      window.removeEventListener('scroll', updatePreviewVisibility);
      window.removeEventListener('resize', updatePreviewVisibility);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ zoneId: string; startX: number; startY: number; origX: number; origY: number; canvasWidth: number; canvasHeight: number } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragRef = useRef<{ zoneId: string; x: number; y: number } | null>(null);

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

  const selectedProduct = selectedProductId
    ? customBaseProducts.find((p) => p.id === selectedProductId) || null
    : null;
  const isJerseyProduct = Boolean(selectedProduct && /jersey/i.test([selectedProduct.categorySlug, selectedProduct.categoryName, selectedProduct.name].join(' ')));
  const previewColorHex = resolveGarmentColorPreview(requestedColor);
  const selectedColor = isJerseyProduct ? { name: 'Sesuai referensi jersey', hex: '#777777' } : requestedColor.trim() ? { name: requestedColor.trim(), hex: previewColorHex || '#777777' } : null;
  const activeSilhouette = selectedProduct?.silhouette || 'boxy-tee';
  const referenceGarmentWidthCm = GARMENT_WIDTH_CM_BY_SIZE[size] || 50;
  const getZonePreviewWidth = (zone: DtfZonePrice) =>
    Math.min(garmentBounds.widthPct * 0.96, Math.max(2, garmentBounds.widthPct * (zone.maxWidthCm / referenceGarmentWidthCm)));
  const selectedFabric = fabricId ? fabrics.find((f) => f.id === fabricId) || null : null;
  const activePlacement = placements.find((p) => p.zoneId === selectedZoneId) || null;

  const isStudioReady = Boolean(selectedProduct && selectedFabric && size && (isJerseyProduct ? jerseyReference : selectedColor && placements.length > 0));

  const dtfTotalPerShirt = isJerseyProduct ? 0 : placements.reduce((sum, p) => sum + p.price, 0);
  const currentProductImage = !selectedProduct ? '' : activeView === 'sleeve'
    ? selectedProduct.sleeveImage || selectedProduct.frontImage || selectedProduct.images[0]
    : activeView === 'back'
      ? selectedProduct.backImage || selectedProduct.frontImage || selectedProduct.images[0]
      : selectedProduct.frontImage || selectedProduct.images[0];
  useEffect(() => {
    let cancelled = false;
    setMockupImageFailed(false);
    setMockupHasTransparency(false);
    setMockupImageSrc('');
    setGarmentBounds(DEFAULT_GARMENT_BOUNDS);
    if (!currentProductImage) return () => { cancelled = true; };

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = async () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(96, image.naturalWidth || 96);
        canvas.height = Math.min(96, image.naturalHeight || 96);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas preview unavailable');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let transparentPixels = 0;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] < 245) transparentPixels++;
        }
        const alreadyTransparent = transparentPixels > pixels.length / 4 * 0.015;
        if (alreadyTransparent) {
          setMockupImageSrc(currentProductImage);
          setMockupHasTransparency(true);
          const bounds = await measureGarmentPreviewBounds(currentProductImage);
          if (!cancelled) setGarmentBounds(bounds);
          return;
        }

        // Remove the flat studio backdrop, then measure the visible shirt silhouette.
        const isolated = await removeImageBackground(currentProductImage, { tolerance: 28, feather: 20 });
        const bounds = await measureGarmentPreviewBounds(isolated);
        if (!cancelled) {
          setMockupImageSrc(isolated);
          setMockupHasTransparency(true);
          setGarmentBounds(bounds);
        }
      } catch {
        if (!cancelled) {
          setMockupImageSrc(currentProductImage);
          setMockupHasTransparency(false);
          setGarmentBounds(DEFAULT_GARMENT_BOUNDS);
        }
      }
    };
    image.onerror = () => {
      if (!cancelled) setMockupImageFailed(true);
    };
    image.src = currentProductImage;
    return () => { cancelled = true; };
  }, [selectedProductId, activeView, currentProductImage]);
  const baseGarmentPrice = selectedProduct?.price || 0;
  const selectedSizeSurcharge = selectedProduct?.sizeSurcharges?.[size] || 0;
  const selectedVariantKey = !isJerseyProduct && selectedColor && size ? selectedColor.name.toLowerCase() + '::' + size : '';
  const selectedVariantAdjustment = selectedVariantKey
    ? Math.max(0, Number(selectedProduct?.variantPrices?.[selectedVariantKey] || 0))
    : 0;
  const lowestFabricModifier = fabrics.length ? Math.min(...fabrics.map((fabric) => fabric.priceModifier)) : 0;
  const selectedFabricAdjustment = Math.max(0, (selectedFabric?.priceModifier || 0) - lowestFabricModifier);
  const rawUnitPrice = baseGarmentPrice + selectedFabricAdjustment + dtfTotalPerShirt + selectedSizeSurcharge + selectedVariantAdjustment;
  const activeBulkDiscount = [...bulkDiscounts].sort((a,b)=>b.minQuantity-a.minQuantity).find((rule)=>quantity>=rule.minQuantity);
  const bulkDiscountRate = Math.max(0,Math.min(100,activeBulkDiscount?.discountPercent||0))/100;
  const unitPrice = Math.round(rawUnitPrice * (1 - bulkDiscountRate));

  const getAutoScaleForZone = (_zoneId: string) => 1;

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
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      onToast('Format desain harus PNG, JPG, SVG, atau WEBP.');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onToast('Ukuran file maksimal 5MB agar pratinjau tetap ringan.');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      onToast('File desain gagal dibaca. Coba simpan ulang gambar lalu unggah kembali.');
      input.value = '';
    };
    reader.onload = async () => {
      const originalUrl = String(reader.result || '');
      if (!originalUrl) {
        onToast('File desain kosong atau tidak dapat dibaca.');
        input.value = '';
        return;
      }
      const targetZone = dtfZones.find((z) => z.id === selectedZoneId) || dtfZones[0];
      if (!targetZone) {
        onToast('Pilihan ukuran DTF belum tersedia. Admin perlu mengaktifkan ukuran cetak terlebih dahulu.');
        input.value = '';
        return;
      }
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
      input.value = '';
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

  const handlePointerDown = (e: React.PointerEvent, placement: CustomDesignPlacement) => {
    if (!canvasRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedZoneId(placement.zoneId);
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    draggingRef.current = {
      zoneId: placement.zoneId,
      startX: e.clientX,
      startY: e.clientY,
      origX: placement.xOffset,
      origY: placement.yOffset,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
    };
  };

  const commitPendingDrag = () => {
    const pending = pendingDragRef.current;
    pendingDragRef.current = null;
    if (!pending) return;
    setPlacements((prev) => prev.map((placement) => placement.zoneId === pending.zoneId
      ? (placement.xOffset === pending.x && placement.yOffset === pending.y ? placement : { ...placement, xOffset: pending.x, yOffset: pending.y })
      : placement));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = draggingRef.current;
    if (!drag) return;
    const dxPct = ((e.clientX - drag.startX) / drag.canvasWidth) * 100;
    const dyPct = ((e.clientY - drag.startY) / drag.canvasHeight) * 100;
    const nextX = Math.max(-50, Math.min(50, Math.round(drag.origX + dxPct)));
    const nextY = Math.max(-50, Math.min(50, Math.round(drag.origY + dyPct)));
    pendingDragRef.current = { zoneId: drag.zoneId, x: nextX, y: nextY };
    // Coalesce high-frequency pointer events to at most one React update per rendered frame.
    if (dragFrameRef.current === null) {
      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        commitPendingDrag();
      });
    }
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    commitPendingDrag();
  };

  const handleSaveDraft = async () => {
    try {
      await saveStudioDraft(DRAFT_STORAGE_KEY, { selectedProductId, fabricId, requestedColor, size, quantity, placements, savedAt: new Date().toISOString() });
      setHasSavedDraft(true);
      onToast('Draf desain dan file artwork tersimpan di perangkat ini.');
    } catch { onToast('Penyimpanan draf gagal. Periksa ruang penyimpanan browser.'); }
  };

  const handleLoadDraft = async () => {
    try {
      const draft = await loadStudioDraft<{selectedProductId?:string;fabricId?:string;requestedColor?:string;colorId?:string;size?:string;quantity?:number;placements?:CustomDesignPlacement[]}>(DRAFT_STORAGE_KEY);
      if (!draft) { onToast('Belum ada draf tersimpan.'); return; }
      if (draft.selectedProductId) setSelectedProductId(draft.selectedProductId);
      if (draft.fabricId) setFabricId(draft.fabricId);
      if (draft.requestedColor) setRequestedColor(draft.requestedColor);
      if (draft.size) setSize(draft.size);
      if (draft.quantity) setQuantity(draft.quantity);
      if (Array.isArray(draft.placements)) { setPlacements(draft.placements); setSelectedZoneId(draft.placements[0]?.zoneId || ''); }
      onToast('Draf tersimpan berhasil dimuat.');
    } catch { onToast('Gagal memuat draf dari penyimpanan browser.'); }
  };

  const buildExactStudioSnapshot = async (view: 'front' | 'back' | 'sleeve'): Promise<string | undefined> => {
    if (!selectedProduct) return undefined;
    const source = view === 'front'
      ? selectedProduct.frontImage || selectedProduct.images[0]
      : view === 'back'
        ? selectedProduct.backImage || selectedProduct.frontImage || selectedProduct.images[1] || selectedProduct.images[0]
        : selectedProduct.sleeveImage || selectedProduct.frontImage || selectedProduct.images[0];
    if (!source) return undefined;
    try {
      const loadImage = async (src: string) => {
        const image = new Image(); image.crossOrigin = 'anonymous'; image.src = src; await image.decode(); return image;
      };
      let image = await loadImage(source);
      const probe = document.createElement('canvas'); probe.width = Math.min(96, image.naturalWidth || 96); probe.height = Math.min(96, image.naturalHeight || 96);
      const probeCtx = probe.getContext('2d', { willReadFrequently: true }); if (!probeCtx) return undefined;
      probeCtx.drawImage(image, 0, 0, probe.width, probe.height);
      const pixels = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
      let transparentPixels = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 245) transparentPixels++;
      let hasTransparency = transparentPixels > pixels.length / 4 * 0.015;
      if (!hasTransparency) {
        try { image = await loadImage(await removeImageBackground(source, { tolerance: 28, feather: 20 })); hasTransparency = true; }
        catch { /* Keep the original exactly as the live studio does when isolation fails. */ }
      }
      const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1260;
      const ctx = canvas.getContext('2d'); if (!ctx) return undefined;
      const inset = 36, fit = Math.min((canvas.width - inset * 2) / image.naturalWidth, (canvas.height - inset * 2) / image.naturalHeight);
      const drawW = image.naturalWidth * fit, drawH = image.naturalHeight * fit;
      ctx.drawImage(image, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
      if (hasTransparency && previewColorHex) {
        // source-atop confines the tint to the garment's alpha; transparent canvas stays transparent.
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 0.84;
        ctx.fillStyle = previewColorHex; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
      }
      const imageAspect = image.naturalWidth / image.naturalHeight, containerAspect = 4 / 4.2;
      const fitWidthPct = Math.min(1, imageAspect / containerAspect) * 100, fitHeightPct = Math.min(1, containerAspect / imageAspect) * 100;
      const leftOffset = (100 - fitWidthPct) / 2, topOffset = (100 - fitHeightPct) / 2;
      const boundsCanvas = document.createElement('canvas'); boundsCanvas.width = 128; boundsCanvas.height = 128;
      const boundsCtx = boundsCanvas.getContext('2d', { willReadFrequently: true }); if (!boundsCtx) return undefined;
      boundsCtx.drawImage(image, 0, 0, 128, 128);
      const alpha = boundsCtx.getImageData(0, 0, 128, 128).data;
      let minX = 128, minY = 128, maxX = -1, maxY = -1;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (alpha[(y * 128 + x) * 4 + 3] > 28) {
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      if (maxX < minX || maxY < minY) return undefined;
      const bounds = {
        centerX: leftOffset + ((minX + maxX + 1) / 256) * fitWidthPct,
        centerY: topOffset + ((minY + maxY + 1) / 256) * fitHeightPct,
        widthPct: ((maxX - minX + 1) / 128) * fitWidthPct,
      };
      const refWidth = GARMENT_WIDTH_CM_BY_SIZE[size] || 50;
      for (const placement of placements) {
        const zone = dtfZones.find((entry) => entry.id === placement.zoneId);
        if (!zone || zone.view !== view) continue;
        const art = await loadImage(placement.artworkDataUrl);
        const baseWidth = Math.min(bounds.widthPct * 0.96, Math.max(2, bounds.widthPct * (zone.maxWidthCm / refWidth)));
        const boxW = (baseWidth * placement.scale / 100) * canvas.width, boxH = boxW * zone.maxHeightCm / zone.maxWidthCm;
        const centerX = ((bounds.centerX + placement.xOffset) / 100) * canvas.width;
        const centerY = ((bounds.centerY + placement.yOffset) / 100) * canvas.height;
        const artFit = Math.min(boxW / art.naturalWidth, boxH / art.naturalHeight);
        const artW = art.naturalWidth * artFit, artH = art.naturalHeight * artFit;
        ctx.save(); ctx.translate(centerX, centerY); ctx.rotate((placement.rotation || 0) * Math.PI / 180);
        ctx.drawImage(art, -artW / 2, -artH / 2, artW, artH); ctx.restore();
      }
      return canvas.toDataURL('image/png');
    } catch (error) { console.error('Exact SPK preview capture failed:', view, error); return undefined; }
  };

  const handleOrderCustom = async () => {
    if (!selectedProduct) {
      onToast('Pilih model baju dari katalog terlebih dahulu.');
      return;
    }
    if (!selectedFabric) { onToast('Pilih jenis bahan terlebih dahulu.'); return; }
    if (isJerseyProduct && !jerseyReference) { onToast('Unggah contoh atau desain jersey terlebih dahulu.'); return; }
    if (!isJerseyProduct && !selectedColor) { onToast('Pilih warna baju terlebih dahulu.'); return; }
    if (!size) {
      onToast('Pilih ukuran baju (S / M / L / XL / XXL) terlebih dahulu.');
      return;
    }
    if (!isJerseyProduct && placements.length === 0) { onToast('Pilih minimal 1 zona sablon DTF & unggah desain terlebih dahulu.'); return; }
    const previewSnapshots = isJerseyProduct ? undefined : {
      front: await buildExactStudioSnapshot('front'),
      back: await buildExactStudioSnapshot('back'),
      sleeve: placements.some((placement) => dtfZones.find((zone) => zone.id === placement.zoneId)?.view === 'sleeve') ? await buildExactStudioSnapshot('sleeve') : undefined,
    };
    onAddCustomToCart({
      id: `custom-${Date.now()}`,
      previewSnapshots,
      type: 'custom_dtf',
      productId: selectedProduct.id,
      sku: selectedProduct.sku,
      name: `Custom DTF ${selectedProduct.name}`,
      image: selectedProduct.frontImage || selectedProduct.images[0],
      colorName: isJerseyProduct ? 'Sesuai referensi jersey' : selectedColor!.name,
      colorHex: isJerseyProduct ? '#777777' : selectedColor!.hex,
      jerseyReferenceImage: isJerseyProduct ? jerseyReference?.dataUrl : undefined,
      jerseyReferenceName: isJerseyProduct ? jerseyReference?.name : undefined,
      backImage: selectedProduct.backImage || selectedProduct.images[1] || selectedProduct.images[0],
      sleeveImage: selectedProduct.sleeveImage || undefined,
      size,
      quantity,
      unitPrice,
      fabricName: selectedFabric.name,
      fabricId: selectedFabric.id,
      customModel: `${activeSilhouette} ${selectedProduct.name}`,
      customPlacements: isJerseyProduct ? [] : placements.map(({ originalDataUrl: _orig, ...rest }) => rest),
    });
  };

  const visiblePlacements = placements.filter((p) => {
    const z = dtfZones.find((dz) => dz.id === p.zoneId);
    return z?.view === activeView;
  });

  const activeZoneMeta = dtfZones.find((z) => z.id === selectedZoneId);
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
            <strong>Mulai dengan 4 langkah sederhana:</strong> pilih produk, tentukan bahan/warna/ukuran, pilih posisi sablon, lalu unggah desain. Pratinjau menggunakan <strong>foto produk dari katalog</strong>. Harga akhir dan detail produksi dibahas langsung dengan Admin melalui WhatsApp.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Live Interactive Garment Mockup Canvas */}
          <div className="lg:col-span-6 bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-4 md:p-6 space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="flex items-center justify-between gap-2">
              {!isJerseyProduct && <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-[#1E1E1E]">
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
              </div>}

              <div className="flex items-center gap-2">
                {!isJerseyProduct && hasSavedDraft && (
                  <button
                    type="button"
                    onClick={handleLoadDraft}
                    className="h-8 px-3 rounded-md border border-black/15 dark:border-white/15 hover:border-[#7A1F2B] text-xs font-medium cursor-pointer"
                  >
                    Muat Draf
                  </button>
                )}
                {!isJerseyProduct && <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="h-8 px-3 rounded-md border border-black/15 dark:border-white/15 hover:border-[#7A1F2B] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Draf</span>
                </button>}
              </div>
            </div>

            {selectedProduct ? (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-neutral-100 dark:bg-[#1B1B1B] text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={
                      activeView === 'sleeve'
                        ? selectedProduct.sleeveImage || selectedProduct.frontImage || selectedProduct.images[0]
                        : activeView === 'back'
                          ? selectedProduct.backImage || selectedProduct.images[1] || selectedProduct.images[0]
                          : selectedProduct.frontImage || selectedProduct.images[0]
                    }
                    alt={selectedProduct.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold truncate">{selectedProduct.name}</div>
                    <div className="text-[11px] text-neutral-500">
                      Foto katalog: {activeView === 'front' ? 'Tampak Depan' : activeView === 'back' ? 'Tampak Belakang' : 'Tampak Lengan'} · {selectedProduct.sku}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono-tabular text-[#7A1F2B] shrink-0 uppercase">
                  {selectedColor?.name || 'Pilih warna'}
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg border border-dashed border-black/15 dark:border-white/15 text-xs text-neutral-500 dark:text-neutral-400">
                Belum ada model baju dipilih. Pilih produk dari katalog di sebelah kanan untuk menampilkan foto mockup Depan &amp; Belakang.
              </div>
            )}

            <div
              ref={canvasRef}
              id="studio-preview-canvas"
              className="relative aspect-[4/4.2] w-full rounded-lg overflow-hidden bg-gradient-to-b from-neutral-200 to-neutral-300 dark:from-[#1A1A1A] dark:to-[#101010] border border-black/10 dark:border-white/10 flex items-center justify-center select-none touch-none"
            >
              {selectedProduct && currentProductImage && !mockupImageFailed ? (
                <>
                  <img
                    decoding="async"
                    key={mockupImageSrc || currentProductImage}
                    src={mockupImageSrc || currentProductImage}
                    alt={`${selectedProduct.name} ${activeView === 'sleeve' ? 'tampak lengan' : activeView === 'back' ? 'tampak belakang' : 'tampak depan'}`}
                    referrerPolicy="no-referrer"
                    onError={() => setMockupImageFailed(true)}
                    className="absolute inset-0 w-full h-full object-contain p-3 pointer-events-none" style={{ filter: "drop-shadow(0 18px 20px rgba(0,0,0,.28)) drop-shadow(0 4px 7px rgba(0,0,0,.18))" }}
                  />
                  {!isJerseyProduct && selectedColor && previewColorHex && mockupHasTransparency && (
                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{
                      backgroundColor: selectedColor.hex,
                      opacity: 0.84,
                      WebkitMaskImage: 'url("' + (mockupImageSrc || currentProductImage) + '")',
                      maskImage: 'url("' + (mockupImageSrc || currentProductImage) + '")',
                      WebkitMaskSize: 'contain', maskSize: 'contain',
                      WebkitMaskPosition: 'center', maskPosition: 'center',
                      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                      mixBlendMode: 'multiply',
                    }} />
                  )}
                  {!isJerseyProduct && selectedColor && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/75 text-white text-[11px] font-medium flex items-center gap-1.5 backdrop-blur-sm">
                      {previewColorHex && <span className="w-3 h-3 rounded-full border border-white/40" style={{ backgroundColor: previewColorHex }} />}
                      <span>Warna pesanan: {selectedColor.name}{!previewColorHex ? ' · pratinjau warna belum tersedia' : ''}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="relative z-10 mx-5 max-w-sm rounded-2xl border border-dashed border-white/25 bg-black/55 p-6 text-center text-white backdrop-blur-sm">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                    <Info className="h-6 w-6 text-[#7A1F2B]" />
                  </div>
                  <p className="text-sm font-bold">{selectedProduct ? 'Foto produk belum tersedia' : 'Pilih produk dari katalog'}</p>
                  <p className="mt-2 text-xs leading-relaxed text-white/65">
                    {selectedProduct
                      ? 'Admin perlu mengunggah foto produk untuk tampak ini melalui Manajemen Konten → Foto Produk.'
                      : 'Pilih salah satu produk pada langkah pertama. Foto asli produk akan tampil di area pratinjau ini.'}
                  </p>
                </div>
              )}

              {visiblePlacements.map((pl) => {
                const zMeta = dtfZones.find((z) => z.id === pl.zoneId);
                if (!zMeta) return null;
                const isSelected = pl.zoneId === selectedZoneId;
                const baseWidth = getZonePreviewWidth(zMeta);
                return (
                  <div
                    key={pl.zoneId}
                    onClick={() => setSelectedZoneId(pl.zoneId)}
                    onPointerDown={(e) => handlePointerDown(e, pl)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={{
                      left: `${garmentBounds.centerX + pl.xOffset}%`,
                      top: `${garmentBounds.centerY + pl.yOffset}%`,
                      width: `${baseWidth * pl.scale}%`,
                      aspectRatio: `${zMeta.maxWidthCm} / ${zMeta.maxHeightCm}`,
                      transform: 'translate(-50%, -50%)',
                      touchAction: 'none',
                      zIndex: isSelected ? 30 : 20,
                    }}
                    className={`absolute flex items-center justify-center cursor-grab active:cursor-grabbing ${isSelected ? 'outline outline-1 outline-dashed outline-[#7A1F2B] bg-[#7A1F2B]/5' : 'outline outline-1 outline-dashed outline-white/30'}`}
                  >
                    <img
                      src={pl.artworkDataUrl}
                      alt={pl.artworkName}
                      draggable={false}
                      className="w-full h-full object-contain pointer-events-none drop-shadow"
                      style={{ transform: `rotate(${pl.rotation}deg)` }}
                    />
                  </div>
                );
              })}

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono-tabular px-3 py-1.5 rounded-md bg-black/75 text-white">
                <span className="flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-[#7A1F2B]" />
                  {removingBg ? 'Menghapus background otomatis...' : 'Geser posisi desain pada foto produk'}
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
              <div className="space-y-1"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#7A1F2B]">Langkah 1 dari 4</p><h3 className="font-display text-2xl font-bold uppercase tracking-wide">Pilih produk &amp; bahan</h3><p className="text-xs text-neutral-500">Pilih foto produk yang ingin kamu custom. Foto ini akan menjadi dasar pratinjau desain.</p></div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Pilih foto produk dari katalog</div>
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
                        <div className="text-[11px] text-[#7A1F2B]">Warna dikonfirmasi admin</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Langkah 2 · Pilih bahan kain
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
                          {fab.priceModifier - Math.min(...fabrics.map((entry) => entry.priceModifier)) > 0 ? `+${formatRupiah(fab.priceModifier - Math.min(...fabrics.map((entry) => entry.priceModifier)))}` : 'Harga dasar bahan'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-black/10 dark:border-white/10">
                {isJerseyProduct ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Upload contoh / desain jersey</div>
                    <label className="flex min-h-12 items-center gap-3 rounded-md border border-dashed border-[#7A1F2B]/50 bg-[#7A1F2B]/5 px-3 py-3 text-xs cursor-pointer hover:bg-[#7A1F2B]/10">
                      <Upload className="h-4 w-4 shrink-0 text-[#7A1F2B]" /><span className="min-w-0 flex-1">{jerseyReference ? jerseyReference.name : 'Pilih foto atau desain jersey dari perangkat'}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const input=event.currentTarget; const file=input.files?.[0]; if(!file)return; if(!['image/png','image/jpeg','image/webp'].includes(file.type)){onToast('Referensi jersey harus berupa PNG, JPG, atau WEBP.');input.value='';return;} if(file.size>8*1024*1024){onToast('Ukuran file referensi maksimal 8MB.');input.value='';return;} const reader=new FileReader(); reader.onerror=()=>onToast('File referensi gagal dibaca. Coba unggah kembali.'); reader.onload=()=>{const dataUrl=String(reader.result||'');if(dataUrl){setJerseyReference({name:file.name,dataUrl});onToast('Referensi jersey berhasil ditambahkan.');}input.value='';};reader.readAsDataURL(file); }} />
                    </label>
                    {jerseyReference && <div className="flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 p-2"><img src={jerseyReference.dataUrl} alt="Referensi jersey" className="h-16 w-16 rounded object-contain bg-neutral-100 dark:bg-black/30"/><div className="min-w-0 flex-1"><div className="text-xs font-semibold">Referensi terpasang</div><div className="truncate text-[11px] text-neutral-500">{jerseyReference.name}</div></div><button type="button" onClick={()=>setJerseyReference(null)} className="text-xs text-red-600">Hapus</button></div>}
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Admin menggunakan gambar ini sebagai acuan warna, motif, panel, dan detail jersey. Format PNG/JPG/WEBP, maksimal 8MB.</p>
                  </div>
                ) : (
                  <div className="space-y-2"><div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Warna yang diinginkan</div><input type="text" value={requestedColor} onChange={(e) => setRequestedColor(e.target.value)} maxLength={60} placeholder="Contoh: hitam, navy, maroon, sage..." className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#181818] border border-black/15 dark:border-white/15"/><p className="text-[11px] text-neutral-500 dark:text-neutral-400">Tulis warna sesuai keinginan. Admin akan mengecek stok dan mengonfirmasi melalui WhatsApp. Warna khusus di bawah 6 pcs perlu persetujuan admin.</p></div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Langkah 2 · Pilih ukuran
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

            {!isJerseyProduct && <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#7A1F2B]">Langkah 3 dari 4</p><h3 className="font-display text-2xl font-bold uppercase tracking-wide">
                  3. Pilih posisi &amp; unggah desain DTF
                </h3></div>
                <span className="text-xs font-mono-tabular text-neutral-500">{placements.length} Zona Aktif</span>
              </div>

              <div className="space-y-3">
                <section className="rounded-xl border border-[#7A1F2B]/20 bg-[#7A1F2B]/5 p-3 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B]">Teknik cetak tersedia</div>
                  {printingMethods.length ? (
                    <div className="flex flex-wrap gap-2">
                      {printingMethods.map((method) => (
                        <span key={method.id} title={method.description} className="rounded-full border border-black/10 dark:border-white/15 bg-white/70 dark:bg-black/20 px-3 py-1.5 text-[11px] font-semibold">
                          {method.name} · {method.pricingType === 'quote' ? 'Konsultasi admin' : 'Tersedia'}
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-xs text-neutral-500">Teknik cetak belum diaktifkan. Hubungi admin SANDIKALE.</p>}
                  <p className="text-[10px] text-neutral-500">Konfirmasi teknik dan estimasi pengerjaan dilakukan melalui WhatsApp.</p>
                </section>
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Pilih ukuran dan posisi sablon DTF</div>
                {dtfZones.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-amber-500/40 p-4 text-xs text-amber-700 dark:text-amber-300">Pilihan ukuran DTF belum tersedia. Admin perlu mengaktifkan ukuran cetak pada pengaturan DTF.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {dtfZones.map((zone) => {
                      const isAdded = placements.some((placement) => placement.zoneId === zone.id);
                      const isFocused = selectedZoneId === zone.id;
                      return (
                        <button key={zone.id} type="button" onClick={() => handleSelectZone(zone)}
                          className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${isFocused ? 'border-[#7A1F2B] bg-[#7A1F2B]/10' : isAdded ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-black/10 dark:border-white/10 hover:border-[#7A1F2B]/40'}`}>
                          <div className="flex items-center justify-between gap-1 text-xs font-semibold">
                            <span className="truncate">{zone.label}</span>
                            {isAdded && <Layers className="w-3.5 h-3.5 text-[#7A1F2B] shrink-0" />}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-neutral-500 dark:text-neutral-400 mt-0.5">{zone.dimensionsCm} · {formatRupiah(zone.price)}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
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
            </div>}

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

              <div className="rounded-xl border border-[#7A1F2B]/25 bg-[#7A1F2B]/5 p-4 space-y-1.5"><p className="text-xs font-bold uppercase tracking-wider text-[#7A1F2B]">Periksa pesanan</p><p className="text-sm font-semibold">{selectedProduct?.name || 'Produk belum dipilih'}</p><p className="text-xs text-neutral-500">{isJerseyProduct ? (jerseyReference ? 'Referensi: ' + jerseyReference.name : 'Referensi jersey belum diunggah') : (selectedColor?.name || 'Warna belum diisi')} · {selectedFabric?.name || 'Bahan belum dipilih'} · {size || 'Ukuran belum dipilih'} · {quantity} pcs{!isJerseyProduct ? ' · ' + placements.length + ' posisi desain' : ''}</p><div className="flex items-center justify-between pt-2 border-t border-[#7A1F2B]/15 text-xs"><span>Harga per kaos</span><strong>{formatRupiah(unitPrice)}</strong></div><div className="flex items-center justify-between text-sm"><span className="font-semibold">Subtotal estimasi</span><strong className="font-mono-tabular text-[#7A1F2B]">{formatRupiah(unitPrice * quantity)}</strong></div><p className="text-[11px] text-neutral-500">Estimasi berdasarkan bahan dan ukuran DTF terpilih. Ketersediaan warna, harga final, dan waktu produksi dikonfirmasi admin melalui WhatsApp.</p></div>

              <button
                type="button"
                disabled={!isStudioReady}
                onClick={handleOrderCustom}
                className="w-full h-12 rounded-md bg-[#7A1F2B] hover:bg-[#651925] text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-45"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>
                  {fabrics.length === 0
                    ? 'Pilihan bahan belum tersedia'
                    : !selectedProduct
                    ? 'Pilih Model Baju Terlebih Dahulu'
                    : !selectedFabric || !selectedColor || !size
                    ? 'Pilih Bahan, Isi Warna & Ukuran'
                    : placements.length === 0
                    ? 'Pilih Zona Sablon & Unggah Desain'
                    : 'Masukkan Custom DTF ke Tas'}
                </span>
              </button>
            </div>
          </div>
        </div>
        {showFloatingPreview && selectedProduct && currentProductImage && (
          <div className="fixed top-[76px] right-3 z-[90] lg:hidden w-[112px] rounded-xl border border-black/15 dark:border-white/20 bg-white/95 dark:bg-[#141414]/95 shadow-2xl p-1.5 pointer-events-none">
            <div className="relative aspect-[4/4.2] overflow-hidden rounded-lg bg-neutral-200 dark:bg-[#101010]">
              <img src={mockupImageSrc || currentProductImage} alt="Preview baju custom" className="absolute inset-0 w-full h-full object-contain p-1" />
              {visiblePlacements.map((placement) => {
                const zone = dtfZones.find((item) => item.id === placement.zoneId);
                if (!zone) return null;
                const width = getZonePreviewWidth(zone);
                return <div key={placement.zoneId} className="absolute flex items-center justify-center" style={{ left: `${garmentBounds.centerX + placement.xOffset}%`, top: `${garmentBounds.centerY + placement.yOffset}%`, width: `${width * placement.scale}%`, aspectRatio: `${zone.maxWidthCm} / ${zone.maxHeightCm}`, transform: 'translate(-50%, -50%)' }}>
                  <img src={placement.artworkDataUrl} alt="" className="w-full h-full object-contain" style={{ transform: `rotate(${placement.rotation}deg)` }} />
                </div>;
              })}
            </div>
            <div className="pt-1 text-[9px] text-center font-semibold text-neutral-700 dark:text-neutral-200 truncate">PREVIEW · {activeView === 'front' ? 'DEPAN' : activeView === 'back' ? 'BELAKANG' : 'LENGAN'}</div>
          </div>
        )}
      </div>
    </section>
  );
}
