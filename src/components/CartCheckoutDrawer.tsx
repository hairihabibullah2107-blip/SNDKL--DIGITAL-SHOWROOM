import { AlertCircle, CheckCircle2, CreditCard, Info, MessageCircle, ShieldCheck, ShoppingBag, ShoppingCart, Trash2, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  CartItem,
  Order,
  PaymentMethodConfig,
  PaymentMethodId,
  UserProfile,
} from '../types';
import { formatRupiah } from '../utils/format';

interface CartCheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  paymentMethods: PaymentMethodConfig[];
  adminWhatsapp: string;
  user: UserProfile | null;
  isOnline: boolean;
  onUpdateQty: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onCreateOrder: (payload: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: string;
    shippingCity: string;
    shippingCourier: string;
    items: CartItem[];
    paymentMethod: PaymentMethodId;
    paymentLabel: string;
  }) => Promise<Order | null>;
  onConfirmPayment: (orderId: string) => Promise<Order | null>;
  onTrackNewOrder: (orderId: string) => void;
}

export function CartCheckoutDrawer({
  open,
  onClose,
  items,
  paymentMethods,
  adminWhatsapp,
  user,
  isOnline,
  onUpdateQty,
  onRemoveItem,
  onCreateOrder,
  onConfirmPayment,
  onTrackNewOrder,
}: CartCheckoutDrawerProps) {
  const [step, setStep] = useState<'cart' | 'checkout' | 'payment'>('cart');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingCourier, setShippingCourier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (paymentMethod && !paymentMethods.some((p) => p.id === paymentMethod)) {
      setPaymentMethod('');
    }
  }, [paymentMethods, paymentMethod]);

  if (!open) return null;

  const selectedPayment = paymentMethod
    ? paymentMethods.find((p) => p.id === paymentMethod) || null
    : null;

  const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  const shippingCost = 0;
  const total = subtotal + shippingCost;
  const isPickup = shippingCourier === 'Ambil Sendiri di Store';
  const canSubmitCheckout = Boolean(shippingCourier && selectedPayment && (isPickup || (shippingCity.trim() && shippingAddress.trim())));

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!isOnline) {
      setErrorMsg('Anda sedang offline. Keranjang tetap tersimpan aman dan siap checkout saat terhubung internet.');
      return;
    }
    if (!selectedPayment || !shippingCourier) {
      setErrorMsg('Pilih metode pengambilan/pengiriman dan metode pembayaran terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    try {
      const order = await onCreateOrder({
        customerName: customerName || user?.name || 'Pelanggan',
        customerEmail: customerEmail || user?.email || 'pelanggan@sandikale.id',
        customerPhone: customerPhone || user?.phone || '081200000000',
        shippingAddress: isPickup ? 'Ambil sendiri di Store SANDIKALE' : shippingAddress,
        shippingCity: isPickup ? 'Ambil di Store' : shippingCity,
        shippingCourier,
        items,
        paymentMethod: selectedPayment.id,
        paymentLabel: selectedPayment.label,
      });
      if (order) {
        setCreatedOrder(order);
        setStep('payment');
      } else {
        setErrorMsg('Pesanan ditolak. Pastikan metode pembayaran dan pengiriman masih aktif.');
      }
    } catch {
      setErrorMsg('Gagal memproses pesanan. Periksa koneksi Anda.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayNow = async () => {
    if (!createdOrder) return;
    setSubmitting(true);
    try {
      const paid = await onConfirmPayment(createdOrder.id);
      if (paid) {
        setCreatedOrder(paid);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    if (createdOrder?.paymentStatus === 'paid') {
      setStep('cart');
      setCreatedOrder(null);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end" role="dialog" aria-modal="true" aria-label="Tas Belanja">
      <div className="w-full max-w-md h-full bg-white dark:bg-[#121212] text-[#080808] dark:text-white border-l border-black/10 dark:border-white/10 flex flex-col">
        <div className="h-14 px-5 border-b border-black/10 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
            <ShoppingCart className="w-4 h-4 text-[#7A1F2B]" />
            <span>
              {step === 'cart' ? `Tas Belanja (${items.length})` : step === 'checkout' ? 'Pengiriman & Checkout' : 'Kirim Desain & Konfirmasi'}
            </span>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Tutup tas belanja"
            className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className="py-20 text-center space-y-2 text-neutral-500">
                  <ShoppingBag className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-sm font-medium">Tas belanja Anda masih kosong.</p>
                  <p className="text-xs">Pilih produk streetwear atau buat desain sablon DTF kustom Anda.</p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-neutral-50 dark:bg-[#181818] border border-black/10 dark:border-white/10 flex gap-3"
                  >
                    <img
                      src={item.customPlacements?.[0]?.artworkDataUrl || item.image}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-md object-cover bg-neutral-900 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold truncate">{item.name}</h4>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          aria-label="Hapus item"
                          className="text-neutral-400 hover:text-red-500 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {item.colorName} · Size {item.size}
                        {item.fabricName ? ` · ${item.fabricName}` : ''}
                      </div>
                      {item.customPlacements && (
                        <div className="text-[11px] text-[#7A1F2B]">
                          DTF {item.customPlacements.length} posisi ({item.customPlacements.map((p) => p.zoneLabel).join(', ')})
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center border border-black/15 dark:border-white/15 rounded h-7">
                          <button type="button" onClick={() => onUpdateQty(item.id, -1)} className="w-6 h-full text-xs cursor-pointer">
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-mono-tabular">{item.quantity}</span>
                          <button type="button" onClick={() => onUpdateQty(item.id, 1)} className="w-6 h-full text-xs cursor-pointer">
                            +
                          </button>
                        </div>
                        <span className="text-xs font-mono-tabular font-bold">
                          {formatRupiah(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {step === 'checkout' && (
            <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4">
              <p className="text-[11px] text-neutral-500">Isi data singkat, pilih pengambilan, lalu buat pesanan.</p>
              {errorMsg && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-500">
                  {errorMsg}
                </div>
              )}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Data Penerima</div>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap"
                  value={customerName || user?.name || ''}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#181818] border border-black/15 dark:border-white/15"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    required
                    placeholder="Email (notifikasi)"
                    value={customerEmail || user?.email || ''}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#181818] border border-black/15 dark:border-white/15"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="No. WhatsApp / HP"
                    value={customerPhone || user?.phone || ''}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#181818] border border-black/15 dark:border-white/15"
                  />
                </div>
                {shippingCourier === 'Diantar Kurir' && <>
                  <textarea required rows={2} placeholder="Alamat lengkap tujuan pengantaran" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} className="w-full p-3 rounded-md text-xs bg-neutral-50 dark:bg-[#181818] border border-black/15 dark:border-white/15" />
                  <input type="text" required placeholder="Kecamatan / Kota / Kabupaten" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#181818] border border-black/15 dark:border-white/15" />
                </>}
              </div>

              <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-[#7A1F2B]" /><span>Metode Pengambilan / Pengiriman</span></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[{value:'Ambil Sendiri di Store',detail:'Pesanan diambil langsung di SANDIKALE.'},{value:'Diantar Kurir',detail:'Biaya dan waktu antar dibahas melalui WhatsApp.'}].map((option) => <label key={option.value} className={`p-3 rounded-lg border cursor-pointer ${shippingCourier===option.value?'border-[#7A1F2B] bg-[#7A1F2B]/10':'border-black/10 dark:border-white/10'}`}>
                    <span className="flex items-center gap-2 text-xs font-semibold"><input type="radio" name="shippingMethod" checked={shippingCourier===option.value} onChange={()=>setShippingCourier(option.value)} className="accent-[#7A1F2B]" />{option.value}</span>
                    <span className="block pl-5 pt-1 text-[11px] text-neutral-500">{option.detail}</span>
                  </label>)}
                </div>
                {isPickup && <p className="text-[11px] text-neutral-500">Lokasi dan waktu pengambilan akan dikonfirmasi admin melalui WhatsApp.</p>}
              </div>

              {/* Admin-permitted Payment Methods ONLY */}
              <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#7A1F2B]" />
                  <span>Metode Pembayaran (Diizinkan Admin)</span>
                </div>
                {paymentMethods.length === 0 ? (
                  <div className="p-3 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 text-xs flex items-start gap-2 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Belum ada metode pembayaran yang diaktifkan oleh Admin.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {paymentMethods.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-2.5 rounded-md border text-xs cursor-pointer ${
                          paymentMethod === opt.id
                            ? 'border-[#7A1F2B] bg-[#7A1F2B]/10 font-semibold'
                            : 'border-black/10 dark:border-white/10'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === opt.id}
                            onChange={() => setPaymentMethod(opt.id)}
                            className="accent-[#7A1F2B]"
                          />
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-neutral-400">{opt.group}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </form>
          )}

          {step === 'payment' && createdOrder && (() => {
            const cleanWa = (adminWhatsapp || '6281234567890').replace(/[^0-9]/g, '') || '6281234567890';
            const itemLines = createdOrder.items
              .map((it, idx) => {
                const zones = it.customPlacements?.length
                  ? ` | Sablon DTF: ${it.customPlacements.map((p) => `${p.zoneLabel} (${p.artworkName})`).join(', ')}`
                  : '';
                return `${idx + 1}. ${it.name} (${it.colorName}, Size ${it.size}, Qty ${it.quantity}${it.fabricName ? `, ${it.fabricName}` : ''})${zones}`;
              })
              .join('\n');
            const waText = encodeURIComponent([
              'Halo Admin SANDIKALE,',
              '',
              'Saya membuat pesanan website:',
              '- No. Pesanan: ' + createdOrder.id,
              '- Kode Tracking: ' + createdOrder.trackingNumber,
              '- Nama: ' + createdOrder.customerName,
              '- Pengambilan: ' + createdOrder.shippingCourier,
              createdOrder.shippingCourier === 'Ambil Sendiri di Store'
                ? 'Saya akan mengambil pesanan langsung di store. Mohon konfirmasi jika sudah siap.'
                : 'Alamat: ' + createdOrder.shippingAddress + ', ' + createdOrder.shippingCity + '\nMohon konfirmasi biaya dan waktu pengiriman.',
              '- Pembayaran: ' + createdOrder.paymentLabel + ' (manual)',
              '- Total: ' + formatRupiah(createdOrder.total),
              '',
              'Detail Produk:',
              itemLines,
              '',
              'File desain asli saya lampirkan bila diperlukan. Terima kasih!'
            ].join('\n'));
            );
            const waUrl = `https://wa.me/${cleanWa}?text=${waText}`;

            return (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-neutral-100 dark:bg-[#181818] border border-black/10 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Nomor Pesanan</span>
                    <span className="font-mono-tabular font-bold">{createdOrder.id}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Kode Tracking</span>
                    <span className="font-mono-tabular">{createdOrder.paymentReference}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Pengambilan / Pengiriman</span>
                    <span>{createdOrder.shippingCourier} · {createdOrder.paymentLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-black/10 dark:border-white/10">
                    <span>Total produk</span>
                    <span className="font-mono-tabular text-[#7A1F2B]">{formatRupiah(createdOrder.total)}</span>
                  </div>
                </div>

                {/* Mandatory Public Simulation Notice + WhatsApp Design File Submission CTA */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/35 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                    <MessageCircle className="w-5 h-5 shrink-0" />
                    <span>Kirim File Desain ke WhatsApp Admin</span>
                  </div>
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    Pesanan tersimpan. Admin akan memeriksa detail dan mengonfirmasi pembayaran manual melalui WhatsApp. Pengambilan sendiri tidak menggunakan kurir.
                  </p>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-11 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Kirim File Desain via WhatsApp Admin</span>
                  </a>
                </div>

                {createdOrder.paymentStatus === 'paid' ? (
                  <div className="p-4 rounded-xl bg-neutral-100 dark:bg-[#181818] border border-emerald-500/30 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Pesanan Tercatat</span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      Pesanan tersimpan dan menunggu verifikasi pembayaran manual oleh admin. Status: <strong>{createdOrder.stage}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const oid = createdOrder.trackingNumber;
                        setStep('cart');
                        setCreatedOrder(null);
                        onClose();
                        onTrackNewOrder(oid);
                      }}
                      className="w-full h-10 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                    >
                      Lihat Status Pesanan
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-2 border-t border-black/10 dark:border-white/10">
                    <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                      <ShieldCheck className="w-4 h-4 text-[#7A1F2B] shrink-0" />
                      <span>Menunggu verifikasi pembayaran manual. Pesanan belum lunas sampai admin mengonfirmasi.</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {step !== 'payment' && items.length > 0 && (
          <div className="p-5 border-t border-black/10 dark:border-white/10 bg-white dark:bg-[#121212] space-y-3 shrink-0">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-neutral-500">
                <span>Subtotal</span>
                <span className="font-mono-tabular">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> {shippingCourier === 'Ambil Sendiri di Store' ? 'Pengambilan' : 'Pengiriman'}</span><span className="font-mono-tabular text-[11px]">{shippingCourier === 'Ambil Sendiri di Store' ? 'Ambil di Store · Rp0' : 'Konfirmasi via WhatsApp'}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-black/10 dark:border-white/10">
                <span>Total</span>
                <span className="font-mono-tabular text-[#7A1F2B]">{formatRupiah(total)}</span>
              </div>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full h-11 rounded-md bg-[#7A1F2B] hover:bg-[#641923] text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
              >
                Lanjut ke Checkout
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="h-11 px-4 rounded-md border border-black/15 dark:border-white/15 text-xs font-semibold cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={submitting || !canSubmitCheckout}
                  className="flex-1 h-11 rounded-md bg-[#7A1F2B] hover:bg-[#e04400] text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-45"
                >
                  {submitting ? 'Memproses...' : 'Buat Invoice Pembayaran'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
