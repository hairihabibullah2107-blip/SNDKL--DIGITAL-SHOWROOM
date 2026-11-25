import { Eye, Heart, MessageCircle, Search, ShoppingBag, SlidersHorizontal, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Category, Product } from '../types';
import { formatRupiah } from '../utils/format';

interface ProductCatalogProps {
  categories: Category[];
  products: Product[];
  adminWhatsapp: string;
  wishlistIds: string[];
  recentlyViewed: Product[];
  onToggleWishlist: (id: string) => void;
  onQuickView: (product: Product) => void;
  onQuickAdd: (payload: {
    product: Product;
    colorName: string;
    colorHex: string;
    size: string;
    quantity: number;
  }) => void;
  onOpenCustomStudio: (product: Product) => void;
}

export function ProductCatalog({
  categories,
  products,
  adminWhatsapp,
  wishlistIds,
  recentlyViewed,
  onToggleWishlist,
  onQuickView,
  onQuickAdd,
  onOpenCustomStudio,
}: ProductCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');
  const [onlyCustomBase, setOnlyCustomBase] = useState(false);
  const [cardColorSelection, setCardColorSelection] = useState<Record<string, number>>({});
  const [cardSizeSelection, setCardSizeSelection] = useState<Record<string, string>>({});

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.categorySlug === selectedCategory);
    }
    if (onlyCustomBase) {
      list = list.filter((p) => p.isCustomBase);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.fabricWeight.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (sortBy === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [products, selectedCategory, onlyCustomBase, searchQuery, sortBy]);

  return (
    <section id="katalog" className="py-14 md:py-20 border-b border-black/10 dark:border-white/10">
      <div className="max-w-[1360px] mx-auto px-4 md:px-6 space-y-12">
        {/* Category Editorial Grid */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF4D00]">Koleksi &amp; Siluet</p>
              <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight mt-1">
                Kategori Streetwear
              </h2>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md">
              Setiap potongan dirancang dengan gramasi kain terukur agar nyaman dipakai harian dan optimal untuk cetak DTF resolusi tinggi.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {categories.map((cat) => {
              const active = selectedCategory === cat.slug;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(active ? 'all' : cat.slug)}
                  className={`group text-left rounded-lg overflow-hidden border transition-all cursor-pointer ${
                    active
                      ? 'border-[#FF4D00] ring-1 ring-[#FF4D00]'
                      : 'border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30'
                  } bg-white dark:bg-[#141414]`}
                >
                  <div className="aspect-[4/3] overflow-hidden bg-neutral-100 dark:bg-[#171717]">
                    <img
                      src={cat.image}
                      alt={cat.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3.5 md:p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-xl font-bold uppercase tracking-wide truncate">{cat.name}</h3>
                      <span className="text-xs font-mono-tabular text-[#FF4D00] shrink-0">Eksplor →</span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">{cat.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Smart Product Filter Bar */}
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`h-9 px-3.5 rounded-md text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-[#080808] dark:bg-white text-white dark:text-[#080808]'
                    : 'bg-white dark:bg-[#171717] text-neutral-600 dark:text-neutral-300 border border-black/10 dark:border-white/10 hover:border-[#FF4D00]'
                }`}
              >
                Semua ({products.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.slug)}
                  className={`h-9 px-3.5 rounded-md text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    selectedCategory === c.slug
                      ? 'bg-[#080808] dark:bg-white text-white dark:text-[#080808]'
                      : 'bg-white dark:bg-[#171717] text-neutral-600 dark:text-neutral-300 border border-black/10 dark:border-white/10 hover:border-[#FF4D00]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kaos, hoodie, 240gsm..."
                  aria-label="Cari produk"
                  className="w-full h-9 pl-9 pr-3 rounded-md text-xs bg-white dark:bg-[#171717] border border-black/15 dark:border-white/15 focus:outline-none focus:border-[#FF4D00]"
                />
              </div>

              <button
                type="button"
                onClick={() => setOnlyCustomBase((v) => !v)}
                className={`h-9 px-3 rounded-md text-xs font-medium border flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  onlyCustomBase
                    ? 'border-[#FF4D00] text-[#FF4D00] bg-[#FF4D00]/10'
                    : 'border-black/15 dark:border-white/15 bg-white dark:bg-[#171717]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Siap Custom DTF</span>
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                aria-label="Urutkan produk"
                className="h-9 px-3 rounded-md text-xs font-medium bg-white dark:bg-[#171717] border border-black/15 dark:border-white/15"
              >
                <option value="featured">Unggulan</option>
                <option value="price-asc">Harga Terendah</option>
                <option value="price-desc">Harga Tertinggi</option>
                <option value="rating">Rating Tertinggi</option>
              </select>
            </div>
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-dashed border-black/15 dark:border-white/15 space-y-3">
              <p className="text-sm font-medium">Tidak ada produk yang cocok dengan filter pencarian.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                  setOnlyCustomBase(false);
                }}
                className="h-9 px-4 rounded-md bg-[#FF4D00] text-white text-xs font-semibold uppercase tracking-wider cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => {
                const activeColorIdx = cardColorSelection[product.id];
                const activeColor =
                  typeof activeColorIdx === 'number' ? product.colors[activeColorIdx] : undefined;
                const selectedSize = cardSizeSelection[product.id] || '';
                const primaryImage = activeColor?.image || product.images[0];
                const secondaryImage = product.images[1] || primaryImage;
                const totalStock = Object.values(product.sizes).reduce((a, b) => a + b, 0);
                const isWishlisted = wishlistIds.includes(product.id);
                const waText = encodeURIComponent(`Halo SANDIKALE, saya tertarik dengan ${product.name} (${product.sku}).`);

                return (
                  <article
                    key={product.id}
                    className="group rounded-lg overflow-hidden bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100 dark:bg-[#171717]">
                      <img
                        src={primaryImage}
                        alt={product.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                      />
                      <img
                        src={secondaryImage}
                        alt={`${product.name} tampak detail`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover absolute inset-0 opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                      />

                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleWishlist(product.id)}
                          aria-label={`Simpan ${product.name} ke wishlist`}
                          className={`w-9 h-9 rounded-md backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer ${
                            isWishlisted
                              ? 'bg-[#FF4D00] text-white'
                              : 'bg-black/60 text-white hover:bg-[#FF4D00]'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickView(product)}
                          aria-label={`Lihat cepat ${product.name}`}
                          className="w-9 h-9 rounded-md bg-black/60 text-white hover:bg-[#FF4D00] backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 md:p-5 flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span className="uppercase tracking-wider">{product.categoryName}</span>
                          <span className="flex items-center gap-1 font-mono-tabular">
                            <Star className="w-3 h-3 text-[#FF4D00] fill-current" />
                            {product.rating}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onQuickView(product)}
                          className="text-left font-semibold text-base hover:text-[#FF4D00] transition-colors cursor-pointer block"
                        >
                          {product.name}
                        </button>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span>{product.fabricWeight}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Stok {totalStock} pcs</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {/* On-card Color Switch (Admin-configured) */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-h-[20px]">
                            {product.colors.length > 0 ? (
                              product.colors.map((c, idx) => (
                                <button
                                  key={c.name}
                                  type="button"
                                  title={c.name}
                                  aria-label={`Pilih warna ${c.name}`}
                                  onClick={() => setCardColorSelection((prev) => ({ ...prev, [product.id]: idx }))}
                                  className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                                    activeColorIdx === idx
                                      ? 'border-[#FF4D00] ring-2 ring-[#FF4D00]/40 scale-110'
                                      : 'border-black/20 dark:border-white/25'
                                  }`}
                                  style={{ backgroundColor: c.hex }}
                                />
                              ))
                            ) : (
                              <span className="text-[11px] text-neutral-400">Warna belum diisi admin</span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-base font-bold font-mono-tabular">{formatRupiah(product.price)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={selectedSize}
                            onChange={(e) =>
                              setCardSizeSelection((prev) => ({ ...prev, [product.id]: e.target.value }))
                            }
                            aria-label={`Pilih ukuran ${product.name}`}
                            className="h-9 px-2 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15 flex-1"
                          >
                            <option value="">-- Pilih Ukuran --</option>
                            {Object.entries(product.sizes).map(([sz, stk]) => (
                              <option key={sz} value={sz} disabled={stk <= 0}>
                                {sz} ({stk} pcs)
                              </option>
                            ))}
                          </select>
                          <span className="text-[11px] text-neutral-400 truncate max-w-[110px]">
                            {activeColor ? activeColor.name : 'Pilih warna'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={product.colors.length === 0 || !activeColor || !selectedSize}
                            onClick={() => {
                              if (!activeColor || !selectedSize) return;
                              onQuickAdd({
                                product,
                                colorName: activeColor.name,
                                colorHex: activeColor.hex,
                                size: selectedSize,
                                quantity: 1,
                              });
                            }}
                            className="h-10 px-3 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] hover:bg-[#FF4D00] dark:hover:bg-[#FF4D00] dark:hover:text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>{activeColor && selectedSize ? `+ Tas (${selectedSize})` : 'Pilih Opsi'}</span>
                          </button>

                          {product.isCustomBase ? (
                            <button
                              type="button"
                              onClick={() => onOpenCustomStudio(product)}
                              className="h-10 px-3 rounded-md border border-black/15 dark:border-white/15 hover:border-[#FF4D00] hover:text-[#FF4D00] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Custom DTF
                            </button>
                          ) : (
                            <a
                              href={`https://wa.me/${(adminWhatsapp || '6281234567890').replace(/[^0-9]/g, '')}?text=${waText}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-10 px-3 rounded-md border border-black/15 dark:border-white/15 hover:border-emerald-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Recently Viewed Products Lightweight Strip */}
        {recentlyViewed.length > 0 && (
          <div className="pt-6 border-t border-black/10 dark:border-white/10 space-y-4">
            <h3 className="font-display text-2xl font-bold uppercase tracking-wide">Baru Saja Dilihat</h3>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recentlyViewed.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onQuickView(item)}
                  className="w-48 shrink-0 text-left rounded-lg overflow-hidden bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 hover:border-[#FF4D00] transition-colors cursor-pointer"
                >
                  <div className="aspect-[4/3] bg-neutral-100 dark:bg-[#171717]">
                    <img
                      src={item.images[0]}
                      alt={item.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2.5 space-y-0.5">
                    <div className="text-xs font-semibold truncate">{item.name}</div>
                    <div className="text-xs font-mono-tabular text-[#FF4D00]">{formatRupiah(item.price)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
