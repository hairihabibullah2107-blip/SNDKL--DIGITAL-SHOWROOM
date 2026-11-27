import { AlertCircle, CheckCircle2, CreditCard, MessageCircle, ShieldCheck, ShoppingBag, ShoppingCart, Trash2, Truck, X } from 'lucide-react';
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
  onTrackNewOrder: (orderId: string) => void;
}


async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
}
function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'desain';
}
async function buildCustomerSpkPdf(order: Order): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true });
  const width=doc.internal.pageSize.getWidth(), margin=12, right=width-margin;
  const designs=order.items.flatMap(item=>item.customPlacements||[]);
  const density=Math.min(1,26/Math.max(26,order.items.length*10+designs.length*5));
  const font=(n:number)=>Math.max(6,n*density);
  const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
  doc.setFillColor(8,8,8);doc.rect(0,0,width,27,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(19);doc.text('SANDIKALE',margin,12);
  doc.setTextColor(215,150,158);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('SURAT PERINTAH KERJA · CUSTOM APPAREL & DTF',margin,20);
  doc.setTextColor(20,20,20);doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('SPK PRODUKSI',margin,36);
  doc.setFontSize(8);doc.text(order.spkNumber||order.id,right,36,{align:'right'});
  const left=[['No. Pesanan',order.id],['Tanggal',new Date(order.createdAt).toLocaleString('id-ID')],['Customer',order.customerName],['WhatsApp',order.customerPhone]];
  const rightFields=[['Pengambilan',order.shippingCourier==='Ambil Sendiri di Store'?'Ambil di Store':'Diantar Kurir'],['Alamat',order.shippingCourier==='Ambil Sendiri di Store'?'Konfirmasi jadwal via WhatsApp':[order.shippingAddress,order.shippingCity].filter(Boolean).join(', ')],['Pembayaran',order.paymentLabel],['Status','Menunggu persetujuan admin']];
  let y=44;doc.setFontSize(font(7.5));
  for(let i=0;i<4;i++){doc.setFont('helvetica','bold');doc.text(left[i][0],margin,y);doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize(left[i][1]||'-',65),margin+25,y);doc.setFont('helvetica','bold');doc.text(rightFields[i][0],111,y);doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize(rightFields[i][1]||'-',76),136,y);y+=6;}
  y+=2;doc.setDrawColor(190,190,190);doc.line(margin,y,right,y);y+=6;doc.setFont('helvetica','bold');doc.setFontSize(font(9));doc.text('RINCIAN ITEM & SPESIFIKASI',margin,y);y+=6;
  for(const [i,item] of order.items.entries()){
    doc.setFillColor(242,242,242);doc.roundedRect(margin,y-4,right-margin,7,1,1,'F');doc.setTextColor(20,20,20);doc.setFont('helvetica','bold');doc.setFontSize(font(7.5));doc.text((i+1)+'. '+item.name.slice(0,66),margin+2,y);doc.setFont('helvetica','normal');doc.text(item.quantity+' pcs',right-2,y,{align:'right'});y+=6;
    doc.setFontSize(font(6.5));doc.text(doc.splitTextToSize('Warna: '+item.colorName+' · Ukuran: '+item.size+' · Bahan: '+(item.fabricName||'-')+' · Model: '+(item.customModel||'-'),right-margin-4),margin+2,y);y+=4;
    const placements=item.customPlacements||[];
    if(placements.length){for(const placement of placements){doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize('DTF: '+placement.zoneLabel+' · '+placement.artworkName,right-margin-25),margin+4,y);try{const data=placement.originalDataUrl||placement.artworkDataUrl;if(data&&y<260)doc.addImage(data,right-21,y-4,17,14,undefined,'FAST');}catch{/* retain design label */}y+=Math.max(5,Math.min(14,14*density));}}
    else{doc.setTextColor(100,100,100);doc.text('File desain asli wajib dikirim bersama SPK.',margin+4,y);doc.setTextColor(20,20,20);y+=5;}y+=1;
  }
  y+=2;doc.line(margin,y,right,y);y+=7;doc.setFont('helvetica','bold');doc.setFontSize(font(8));doc.text('TOTAL PERKIRAAN',margin,y);doc.text(money(order.total),right,y,{align:'right'});y+=7;doc.setFont('helvetica','normal');doc.setFontSize(font(6.5));
  doc.text(doc.splitTextToSize('SPK ini adalah ringkasan permintaan customer, belum menjadi persetujuan produksi. Admin SANDIKALE akan memeriksa spesifikasi, file desain, harga final, dan pembayaran melalui WhatsApp.',right-margin),margin,y);
  return new File([doc.output('blob')],safeFileName((order.spkNumber||order.id)+'-SPK.pdf'),{type:'application/pdf'});
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


  const resetAndClose = () => {
    if (createdOrder) {
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
            const cleanWa=(adminWhatsapp||'').replace(/[^0-9]/g,'');
            const isManualPayment=/manual|konfirmasi admin/i.test(createdOrder.paymentLabel);
            const needsPaymentProof=!isManualPayment&&/(qris|bank|transfer|va|virtual account)/i.test(createdOrder.paymentLabel+' '+createdOrder.paymentMethod);
            const waMessage=[
              'Halo Admin SANDIKALE, saya '+createdOrder.customerName+'.',
              'Pesanan: '+createdOrder.id+' · SPK: '+(createdOrder.spkNumber||createdOrder.id),
              'Pengambilan: '+(createdOrder.shippingCourier==='Ambil Sendiri di Store'?'Ambil sendiri di store':'Diantar kurir'),
              'Pembayaran: '+createdOrder.paymentLabel+' · Total: '+formatRupiah(createdOrder.total),
              'Saya lampirkan SPK PDF dan file desain untuk diperiksa.',
              needsPaymentProof?'Bukti transfer/QRIS saya lampirkan pada chat ini.':'Pembayaran dan persetujuan detail saya konfirmasi melalui WhatsApp.'
            ].join('\\n');
            const openWhatsApp=()=>{if(cleanWa)window.open('https://wa.me/'+cleanWa+'?text='+encodeURIComponent(waMessage),'_blank','noopener,noreferrer');};
            const shareOrderFiles=async()=>{
              try{
                const spk=await buildCustomerSpkPdf(createdOrder),designFiles:File[]=[];
                const placements=createdOrder.items.flatMap(item=>(item.customPlacements||[]).map(placement=>({placement})));
                for(const [index,entry] of placements.entries()){const source=entry.placement.originalDataUrl||entry.placement.artworkDataUrl;if(source)designFiles.push(await dataUrlToFile(source,safeFileName(entry.placement.artworkName||('desain-'+(index+1)+'.png'))));}
                const files=[spk,...designFiles];
                if(navigator.share&&navigator.canShare?.({files}))await navigator.share({title:'SPK SANDIKALE '+(createdOrder.spkNumber||createdOrder.id),text:waMessage,files});
                else{for(const file of files){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1500);}openWhatsApp();}
              }catch(error){if(error instanceof Error&&error.name==='AbortError')return;setErrorMsg('File belum dapat dibagikan otomatis. Unduh SPK dan file desain, lalu lampirkan di WhatsApp.');openWhatsApp();}
            };

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
                    <span>Kirim SPK & Desain ke Admin</span>
                  </div>
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    SPK PDF dan file desain wajib dikirim. {needsPaymentProof ? 'Lampirkan juga bukti transfer/QRIS.' : 'Pembayaran dan persetujuan dilakukan melalui WhatsApp admin.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void shareOrderFiles()}
                    className="w-full h-11 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Bagikan SPK + Desain via WhatsApp</span>
                  </button>
                </div>

                {createdOrder.paymentStatus === 'paid' ? (
                  <div className="p-4 rounded-xl bg-neutral-100 dark:bg-[#181818] border border-emerald-500/30 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Pembayaran Terverifikasi</span>
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
