import { CheckCircle2, Clock, Mail, Package, Search, Truck } from 'lucide-react';
import { useState } from 'react';
import type { EmailNotification, Order } from '../types';
import { formatDateTime, formatRupiah } from '../utils/format';

interface OrderTrackingSectionProps {
  recentOrders: Order[];
  emailOutbox: EmailNotification[];
  onTrackOrder: (orderId: string) => Promise<{ order: Order; emails: EmailNotification[] } | null>;
}

export function OrderTrackingSection({ recentOrders, emailOutbox, onTrackOrder }: OrderTrackingSectionProps) {
  const [query, setQuery] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(recentOrders[0] || null);
  const [orderEmails, setOrderEmails] = useState<EmailNotification[]>(
    emailOutbox.filter((e) => e.orderId === (recentOrders[0]?.id || ''))
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Keep synced with live WebSocket updates if trackedOrder matches
  const liveOrder = trackedOrder
    ? recentOrders.find((o) => o.id === trackedOrder.id) || trackedOrder
    : recentOrders[0] || null;

  const handleSearch = async (e?: React.FormEvent, overrideId?: string) => {
    if (e) e.preventDefault();
    const targetId = (overrideId || query).trim();
    if (!targetId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await onTrackOrder(targetId);
      if (res) {
        setTrackedOrder(res.order);
        setOrderEmails(res.emails);
        setQuery(targetId);
      } else {
        setErrorMsg(`Nomor pesanan "${targetId}" tidak ditemukan.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const activeEmails = liveOrder
    ? emailOutbox.filter((e) => e.orderId === liveOrder.id).length > 0
      ? emailOutbox.filter((e) => e.orderId === liveOrder.id)
      : orderEmails
    : [];

  return (
    <section id="lacak" className="py-14 md:py-20 border-b border-black/10 dark:border-white/10">
      <div className="max-w-[1360px] mx-auto px-4 md:px-6 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF4D00]">
              Real-Time Production &amp; Courier Sync
            </p>
            <h2 className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tight mt-1">
              Lacak Pesanan &amp; Produksi DTF
            </h2>
          </div>

          <form onSubmit={(e) => handleSearch(e)} className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Contoh: SDK-2026-1042"
                aria-label="Nomor pesanan atau resi"
                className="w-full h-10 pl-9 pr-3 rounded-md text-xs font-mono-tabular bg-white dark:bg-[#141414] border border-black/15 dark:border-white/15 focus:outline-none focus:border-[#FF4D00]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-5 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] hover:bg-[#FF4D00] dark:hover:bg-[#FF4D00] dark:hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
            >
              {loading ? 'Mencari...' : 'Lacak'}
            </button>
          </form>
        </div>

        {/* Quick Order Switchers */}
        {recentOrders.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-neutral-500 shrink-0">Pesanan tersedia:</span>
            {recentOrders.slice(0, 5).map((ord) => (
              <button
                key={ord.id}
                type="button"
                onClick={() => handleSearch(undefined, ord.id)}
                className={`h-8 px-3 rounded-md text-xs font-mono-tabular border whitespace-nowrap shrink-0 cursor-pointer ${
                  liveOrder?.id === ord.id
                    ? 'border-[#FF4D00] text-[#FF4D00] bg-[#FF4D00]/10'
                    : 'border-black/10 dark:border-white/10 bg-white dark:bg-[#141414]'
                }`}
              >
                {ord.id} · {ord.stage}
              </button>
            ))}
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
            {errorMsg}
          </div>
        )}

        {liveOrder && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Production & Delivery Timeline */}
            <div className="lg:col-span-7 bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 md:p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-black/10 dark:border-white/10">
                <div>
                  <div className="text-xs font-mono-tabular text-neutral-500">{liveOrder.id}</div>
                  <h3 className="font-display text-2xl font-bold uppercase mt-0.5">{liveOrder.stage}</h3>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    {liveOrder.customerName} · {liveOrder.shippingCity} ({liveOrder.shippingCourier})
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-xs text-neutral-500">Resi Pengiriman</div>
                  <div className="text-sm font-mono-tabular font-semibold">{liveOrder.trackingNumber}</div>
                  <div className="text-xs text-[#FF4D00] font-semibold">
                    Total {formatRupiah(liveOrder.total)} · {liveOrder.paymentStatus === 'paid' ? 'Lunas' : 'Menunggu Bayar'}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {liveOrder.timeline.map((step, idx) => (
                  <div key={step.stage} className="flex gap-3.5">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          step.completed
                            ? 'bg-[#FF4D00] text-white'
                            : 'bg-neutral-200 dark:bg-[#222] text-neutral-500'
                        }`}
                      >
                        {step.completed ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : idx === 4 ? (
                          <Truck className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                      </div>
                      {idx < liveOrder.timeline.length - 1 && (
                        <div
                          className={`w-px flex-1 my-1 ${
                            step.completed ? 'bg-[#FF4D00]' : 'bg-black/10 dark:bg-white/10'
                          }`}
                        />
                      )}
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`text-sm font-semibold ${step.completed ? '' : 'text-neutral-400'}`}>
                          {step.stage}
                        </span>
                        <span className="text-[11px] font-mono-tabular text-neutral-400">
                          {step.timestamp ? formatDateTime(step.timestamp) : 'Menunggu'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{step.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Items & Automated Email Notification History */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-3">
                <h4 className="font-display text-xl font-bold uppercase flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#FF4D00]" />
                  <span>Rincian Item Produksi</span>
                </h4>
                <div className="space-y-3">
                  {liveOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/5 dark:border-white/5"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-md object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{item.name}</div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {item.colorName} · Size {item.size} · {item.quantity} pcs
                        </div>
                        {item.fabricName && (
                          <div className="text-[11px] text-[#FF4D00] truncate">{item.fabricName}</div>
                        )}
                      </div>
                      <div className="text-xs font-mono-tabular font-semibold shrink-0">
                        {formatRupiah(item.unitPrice * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-3">
                <h4 className="font-display text-xl font-bold uppercase flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#FF4D00]" />
                  <span>Log Notifikasi Email Pelanggan</span>
                </h4>
                {activeEmails.length === 0 ? (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Notifikasi email otomatis akan tercatat di sini setiap kali status produksi diperbarui.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {activeEmails.map((eml) => (
                      <div
                        key={eml.id}
                        className="p-3 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] border border-black/5 dark:border-white/5 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-neutral-400">
                          <span className="truncate">{eml.toEmail}</span>
                          <span className="shrink-0">{formatDateTime(eml.sentAt)}</span>
                        </div>
                        <div className="text-xs font-semibold">{eml.subject}</div>
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">{eml.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
