import { ChevronLeft, ChevronRight, Heart, MessageCircle, ShoppingBag, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Product, ProductReview } from '../types';
import { formatDateTime, formatRupiah } from '../utils/format';

interface ProductQuickViewModalProps {
  product: Product | null;
  reviews: ProductReview[];
  adminWhatsapp: string;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
  onClose: () => void;
  onAddToCart: (payload: {
    product: Product;
    colorName: string;
    colorHex: string;
    size: string;
    quantity: number;
  }) => void;
  onSubmitReview: (payload: { productId: string; authorName: string; rating: number; comment: string }) => Promise<void>;
  onOpenCustomStudio: (product: Product) => void;
}

export function ProductQuickViewModal({
  product,
  reviews,
  adminWhatsapp,
  isWishlisted,
  onToggleWishlist,
  onClose,
  onAddToCart,
  onSubmitReview,
  onOpenCustomStudio,
}: ProductQuickViewModalProps) {
  const [imageIdx, setImageIdx] = useState(0);
  const [selectedColorIdx, setSelectedColorIdx] = useState(-1);
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);

  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    setImageIdx(0);
    setSelectedColorIdx(-1);
    setSelectedSize('');
    setQuantity(1);
  }, [product?.id]);


  if (!product) return null;

  const activeColor = selectedColorIdx >= 0 ? product.colors[selectedColorIdx] : undefined;
  const galleryImages = product.images.length > 0 ? product.images : ['/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg'];
  const activeImage = activeColor?.image && imageIdx === 0 ? activeColor.image : galleryImages[imageIdx % galleryImages.length];
  const availableSizes = Object.entries(product.sizes);
  const selectedStock = selectedSize ? (product.sizes[selectedSize] ?? 0) : 0;
  const prodReviews = reviews.filter((r) => r.productId === product.id);

  const waMessage = encodeURIComponent(
    `Halo SANDIKALE, saya ingin menanyakan stok & detail produk ${product.name} (${product.sku})${activeColor ? ` warna ${activeColor.name}` : ''}${selectedSize ? ` ukuran ${selectedSize}` : ''}.`
  );

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || !reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      await onSubmitReview({
        productId: product.id,
        authorName: reviewName.trim(),
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewName('');
      setReviewComment('');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#121212] text-[#080808] dark:text-white rounded-t-2xl md:rounded-xl border border-black/10 dark:border-white/10">
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md px-5 py-3.5 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{product.categoryName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{product.sku}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail produk"
            className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 md:p-7 grid grid-cols-1 md:grid-cols-2 gap-7">
          {/* Left Gallery with swipe/navigation */}
          <div className="space-y-3">
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-neutral-100 dark:bg-[#171717]">
              <img
                src={activeImage}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
              {activeColor && activeImage && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundColor: activeColor.hex,
                    WebkitMaskImage: `url("${activeImage}")`,
                    maskImage: `url("${activeImage}")`,
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    mixBlendMode: 'multiply',
                  }}
                />
              )}
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setImageIdx((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)}
                    aria-label="Foto sebelumnya"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-[#FF4D00] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageIdx((prev) => (prev + 1) % galleryImages.length)}
                    aria-label="Foto berikutnya"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-[#FF4D00] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {galleryImages.map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => setImageIdx(idx)}
                  className={`w-20 aspect-[4/3] rounded-md overflow-hidden border-2 shrink-0 cursor-pointer ${
                    imageIdx === idx ? 'border-[#FF4D00]' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-contain mix-blend-multiply" />
                </button>
              ))}
            </div>
          </div>

          {/* Right Contiguous Purchase Module */}
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight uppercase">{product.name}</h2>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                <span>{product.fabricWeight}</span>
                <span aria-hidden="true">·</span>
                <span>{product.fit}</span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 text-[#FF4D00] font-semibold">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="tabular-nums">{product.rating}</span>
                  <span>({product.reviewCount})</span>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-2xl font-bold font-mono-tabular">{formatRupiah(product.price)}</span>
                {product.compareAtPrice && (
                  <span className="text-sm line-through text-neutral-400 font-mono-tabular">
                    {formatRupiah(product.compareAtPrice)}
                  </span>
                )}
              </div>
            </div>

            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{product.description}</p>

            {/* Color Switch (Admin-configured) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Warna:{' '}
                <span className="text-[#080808] dark:text-white">
                  {product.colors.length === 0
                    ? 'Menunggu konfigurasi warna dari Admin'
                    : activeColor?.name || 'Belum dipilih — silakan pilih warna'}
                </span>
              </div>
              {product.colors.length > 0 && (
                <div className="flex items-center gap-2.5">
                  {product.colors.map((c, idx) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        setSelectedColorIdx(idx);
                        setImageIdx(0);
                      }}
                      title={c.name}
                      aria-label={`Pilih warna ${c.name}`}
                      className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer ${
                        selectedColorIdx === idx ? 'border-[#FF4D00] scale-110' : 'border-black/20 dark:border-white/20'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Size Selector + Stock */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Ukuran
                </span>
                <span className="font-mono-tabular text-neutral-600 dark:text-neutral-300">
                  {selectedSize ? `Stok tersedia: ${selectedStock} pcs` : 'Pilih ukuran terlebih dahulu'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {availableSizes.map(([sz, stk]) => (
                  <button
                    key={sz}
                    type="button"
                    disabled={stk <= 0}
                    onClick={() => setSelectedSize(sz)}
                    className={`h-10 rounded-md text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-40 ${
                      selectedSize === sz
                        ? 'bg-[#080808] dark:bg-white text-white dark:text-[#080808] border-[#080808] dark:border-white'
                        : 'border-black/15 dark:border-white/15 hover:border-[#FF4D00]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-100 dark:bg-[#171717] flex items-start gap-2.5">
              <MessageCircle className="w-4 h-4 text-[#7A1F2B] shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-600 dark:text-neutral-300">Biaya pengiriman dan jadwal pengerjaan dibahas langsung dengan admin SANDIKALE melalui WhatsApp setelah detail pesanan dikonfirmasi.</p>
            </div>

            {/* Primary Actions */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center border border-black/15 dark:border-white/15 rounded-md h-11">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-full font-bold hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-9 text-center text-sm font-mono-tabular">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(Math.max(1, selectedStock), q + 1))}
                    className="w-9 h-full font-bold hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!activeColor || !selectedSize || selectedStock <= 0 || product.colors.length === 0}
                  onClick={() => {
                    if (!activeColor || !selectedSize) return;
                    onAddToCart({
                      product,
                      colorName: activeColor.name,
                      colorHex: activeColor.hex,
                      size: selectedSize,
                      quantity,
                    });
                    onClose();
                  }}
                  className="flex-1 h-11 px-5 rounded-md bg-[#FF4D00] hover:bg-[#e04400] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>
                    {product.colors.length === 0
                      ? 'Warna Belum Diisi Admin'
                      : !activeColor || !selectedSize
                      ? 'Pilih Warna & Ukuran'
                      : 'Tambah ke Tas'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleWishlist(product.id)}
                  aria-label="Simpan ke wishlist"
                  className={`w-11 h-11 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                    isWishlisted
                      ? 'border-[#FF4D00] text-[#FF4D00] bg-[#FF4D00]/10'
                      : 'border-black/15 dark:border-white/15 hover:border-[#FF4D00]'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {product.isCustomBase && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCustomStudio(product);
                    }}
                    className="h-10 rounded-md border border-black/15 dark:border-white/15 hover:border-[#FF4D00] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    Custom Sablon DTF
                  </button>
                )}
                <a
                  href={`https://wa.me/${(adminWhatsapp || '6281234567890').replace(/[^0-9]/g, '')}?text=${waMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`h-10 rounded-md border border-emerald-600/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/10 text-xs font-semibold flex items-center justify-center gap-1.5 ${
                    product.isCustomBase ? '' : 'col-span-2'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Tanya via WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Verified Reviews Section */}
        <div className="px-5 md:px-7 py-6 border-t border-black/10 dark:border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-display text-xl font-bold uppercase tracking-wide">
              Ulasan Pembeli ({prodReviews.length})
            </h3>
            {prodReviews.length === 0 ? (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Belum ada ulasan untuk produk ini. Jadilah yang pertama memberi ulasan.
              </p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {prodReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3 rounded-lg bg-neutral-50 dark:bg-[#171717] border border-black/5 dark:border-white/5 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{rev.authorName}</span>
                      <span className="text-[#FF4D00] font-mono-tabular">★ {rev.rating}.0</span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">{rev.comment}</p>
                    <div className="text-[11px] text-neutral-400">
                      {rev.verifiedPurchase ? 'Pembeli Terverifikasi' : 'Pelanggan'} · {formatDateTime(rev.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleReviewSubmit} className="space-y-3">
            <h4 className="font-display text-xl font-bold uppercase tracking-wide">Tulis Ulasan</h4>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Nama Anda"
                value={reviewName}
                onChange={(e) => setReviewName(e.target.value)}
                className="h-9 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#171717] border border-black/15 dark:border-white/15"
              />
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="h-9 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#171717] border border-black/15 dark:border-white/15"
              >
                <option value={5}>5 Bintang — Sempurna</option>
                <option value={4}>4 Bintang — Sangat Bagus</option>
                <option value={3}>3 Bintang — Cukup</option>
                <option value={2}>2 Bintang — Kurang</option>
                <option value={1}>1 Bintang — Buruk</option>
              </select>
            </div>
            <textarea
              required
              rows={2}
              placeholder="Bagaimana kualitas bahan kain dan sablon DTF-nya?"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="w-full p-3 rounded-md text-xs bg-neutral-50 dark:bg-[#171717] border border-black/15 dark:border-white/15"
            />
            <button
              type="submit"
              disabled={submittingReview}
              className="h-9 px-4 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] text-xs font-semibold uppercase tracking-wider hover:bg-[#FF4D00] dark:hover:bg-[#FF4D00] dark:hover:text-white transition-colors cursor-pointer"
            >
              {submittingReview ? 'Mengirim...' : 'Kirim Ulasan'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
