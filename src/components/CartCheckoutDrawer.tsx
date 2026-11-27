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
function escapeReceiptText(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}
function printCustomerReceipt(order: Order) {
  const popup = window.open('', '_blank', 'width=420,height=720');
  if (!popup) { window.alert('Izinkan pop-up untuk mencetak nota struk.'); return; }
  const itemRows = order.items.map((item) => '<div class="item"><b>' + escapeReceiptText(item.name) + '</b><div>' + escapeReceiptText(item.colorName) + ' · ' + escapeReceiptText(item.size) + ' · ' + item.quantity + ' pcs</div><div class="row"><span>' + item.quantity + ' × ' + formatRupiah(item.unitPrice) + '</span><b>' + formatRupiah(item.quantity * item.unitPrice) + '</b></div></div>').join('');
  const html = '<!doctype html><html lang="id"><meta charset="utf-8"><title>Nota Struk ' + escapeReceiptText(order.id) + '</title><style>body{font:12px Arial,sans-serif;color:#111;width:72mm;margin:0 auto;padding:4mm}h1{text-align:center;font-size:19px;letter-spacing:2px;margin:0}p{text-align:center;margin:4px 0}.line{border-top:1px dashed #555;margin:9px 0}.row{display:flex;justify-content:space-between;gap:8px;margin:4px 0}.item{margin:8px 0}.muted{font-size:10px;color:#555}.total{font-weight:bold;font-size:14px}.stamp{border:1px solid #9a2434;color:#9a2434;text-align:center;padding:7px;font-weight:bold;margin:10px 0}@media print{@page{size:80mm auto;margin:3mm}body{width:auto;padding:0}}</style><body><h1>SANDIKALE</h1><p>CUSTOM APPAREL · DTF STUDIO</p><p class="muted">NOTA STRUK PESANAN</p><div class="line"></div><div class="row"><span>No. Pesanan</span><b>' + escapeReceiptText(order.id) + '</b></div><div class="row"><span>Tanggal</span><span>' + escapeReceiptText(new Date(order.createdAt).toLocaleString('id-ID')) + '</span></div><div class="row"><span>Customer</span><span>' + escapeReceiptText(order.customerName) + '</span></div><div class="row"><span>Pengambilan</span><span>' + (order.shippingCourier === 'Ambil Sendiri di Store' ? 'Ambil di Store' : 'Kurir') + '</span></div><div class="line"></div>' + itemRows + '<div class="line"></div><div class="row total"><span>TOTAL</span><span>' + formatRupiah(order.total) + '</span></div><div class="stamp">' + (order.paymentStatus === 'paid' ? 'PEMBAYARAN TERVERIFIKASI' : 'MENUNGGU KONFIRMASI ADMIN') + '</div><p class="muted">Nota ini adalah ringkasan pesanan, bukan bukti pembayaran lunas.</p><p>Terima kasih · SANDIKALE</p><script>window.onload=()=>window.print()<\\/script></body></html>';
  popup.document.write(html);
  popup.document.close();
}

async function imageToPngDataUrl(source?: string): Promise<string | null> {
  if (!source) return null;
  try {
    const image = new Image(); image.crossOrigin = 'anonymous'; image.src = source; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1100;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    ctx.drawImage(image, (canvas.width-w)/2, (canvas.height-h)/2, w, h);
    return canvas.toDataURL('image/png');
  } catch { return null; }
}
async function makeSpkMockup(item: CartItem, side: 'front' | 'back'): Promise<string | null> {
  const base = await imageToPngDataUrl(side === 'front' ? item.image : (item.backImage || item.image));
  if (!base) return null;
  try {
    const image = new Image(); image.src = base; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1100;
    const ctx = canvas.getContext('2d'); if (!ctx) return base;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const relevant = (item.customPlacements || []).filter((p) => {
      const id = p.zoneId.toLowerCase(), label = p.zoneLabel.toLowerCase();
      const isBack = id.includes('a3') || id.includes('back') || label.includes('belakang') || label.includes('punggung');
      return side === 'back' ? isBack : !isBack;
    });
    for (const placement of relevant) {
      try {
        const art = new Image(); art.src = placement.artworkDataUrl; await art.decode();
        const isLogo = /logo|ornamen|pocket|saku/i.test(placement.zoneId + ' ' + placement.zoneLabel);
        const ratio = Math.min(1, Math.max(0.1, placement.scale || 1));
        const widthCm = /a3/i.test(placement.zoneId) ? 28 : /a4/i.test(placement.zoneId) ? 21 : /logo/i.test(placement.zoneId) ? 12 : 10;
        const width = Math.min(540, (widthCm / 40) * 620 * ratio);
        const height = width * art.naturalHeight / art.naturalWidth;
        const xBase = isLogo ? 405 : 450, yBase = isLogo ? 350 : side === 'back' ? 410 : 430;
        const x = xBase - width / 2 + (placement.xOffset || 0) * 4;
        const y = yBase - height / 2 + (placement.yOffset || 0) * 4;
        ctx.save(); ctx.translate(x + width/2, y + height/2); ctx.rotate((placement.rotation || 0) * Math.PI / 180);
        ctx.drawImage(art, -width/2, -height/2, width, height); ctx.restore();
      } catch { /* keep base mockup if artwork preview cannot be decoded */ }
    }
    return canvas.toDataURL('image/png');
  } catch { return base; }
}
function downloadGeneratedFile(file: File) {
  const url = URL.createObjectURL(file), link = document.createElement('a');
  link.href = url; link.download = file.name; link.style.display = 'none';
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
async function buildCustomerSpkPdf(order: Order): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const W = 210, m = 10, R = 200, items = order.items || [];
  const first = items[0], qty = items.reduce((sum, item) => sum + item.quantity, 0);
  const sizes = items.map((item) => item.size + ':' + item.quantity).join(', ');
  const colors = Array.from(new Set(items.map((item) => item.colorName))).join(', ');
  const materials = Array.from(new Set(items.map((item) => item.fabricName || '-'))).join(', ');
  const models = Array.from(new Set(items.map((item) => item.customModel || item.name))).join(', ');
  const date = new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const money = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
  doc.setDrawColor(20,20,20); doc.setLineWidth(1.1); doc.rect(1.5,1.5,207,294);
  doc.setTextColor(10,10,10); doc.setFont('helvetica','bold'); doc.setFontSize(25); doc.text('SANDIKALE', W/2,17,{align:'center'});
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.text('D E S I G N   &   P R O D U C T I O N S',W/2,24,{align:'center'});
  doc.setLineWidth(0.45); doc.rect(m,31,190,29);
  const colW=190/3,rowH=29/3;
  for(let i=1;i<3;i++) doc.line(m+colW*i,31,m+colW*i,60);
  for(let i=1;i<3;i++) doc.line(m,31+rowH*i,R,31+rowH*i);
  const cells=[
    [['BRAND',order.customerName||'CUSTOMER'],['COLOR',colors||'-'],['SIZE',sizes||'-']],
    [['MODEL',models],['DESIGNER','SANDIKALE'],['SABLON','DTF']],
    [['MATERIAL',materials],['DATE',date],['QTY',qty+' PCS']]
  ];
  cells.forEach((row,ri)=>row.forEach((cell,ci)=>{
    const x=m+ci*colW+2,y=31+ri*rowH+3.6;
    doc.setFont('helvetica','bold');doc.setFontSize(6.6);doc.text(cell[0],x,y);
    doc.setFont('helvetica','normal');doc.setFontSize(6.3);
    doc.text(doc.splitTextToSize(String(cell[1]||'-'),colW-17).slice(0,2),x+17,y);
  }));
  const imgY=65,imgH=143,imgW=87;
  const front=first?await makeSpkMockup(first,'front'):null, back=first?await makeSpkMockup(first,'back'):null;
  doc.setDrawColor(225,225,225);doc.setLineWidth(0.2);
  if(front) doc.addImage(front,'PNG',14,imgY,imgW,imgH,undefined,'FAST');
  else {doc.rect(14,imgY,imgW,imgH);doc.setFontSize(8);doc.text('MOCKUP DEPAN',57.5,imgY+70,{align:'center'});}
  if(back) doc.addImage(back,'PNG',109,imgY,imgW,imgH,undefined,'FAST');
  else {doc.rect(109,imgY,imgW,imgH);doc.setFontSize(8);doc.text('MOCKUP BELAKANG',152.5,imgY+70,{align:'center'});}
  doc.setDrawColor(20,20,20);doc.setLineWidth(0.35);doc.line(m,213,R,213);
  doc.setFont('helvetica','bold');doc.setFontSize(7.4);doc.text('KETERANGAN SABLON',m,218);doc.text('CATATAN PRODUKSI',105,218);
  doc.setFont('helvetica','normal');doc.setFontSize(6.7);
  const printLines=items.flatMap((item,index)=>(item.customPlacements||[]).map((p,pi)=>(index+1)+'.'+(pi+1)+' '+p.zoneLabel+' - '+p.zoneId+' ('+p.artworkName+')'));
  doc.text(doc.splitTextToSize(printLines.length?printLines.join('\n'):'1. Desain DTF sesuai file lampiran customer',88).slice(0,6),m,224);
  const production='Press 160°C selama 15 detik, kupas dingin (Cold Peel).\nPacking plastik klip.\n\nNo. SPK '+(order.spkNumber||order.id)+'\nPenerima order: Admin SANDIKALE\nEstimasi selesai: konfirmasi admin via WhatsApp';
  doc.text(doc.splitTextToSize(production,88).slice(0,7),105,224);
  doc.setDrawColor(170,170,170);doc.setLineWidth(0.25);doc.line(m,271,R,271);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('_sandikale',70,282);doc.text('+62 822-6641-2844',125,282);
  doc.setFontSize(6);doc.setTextColor(100,100,100);doc.text('SPK otomatis dari SANDIKALE Digital Showroom · Harga dan stok menunggu konfirmasi admin',W/2,289,{align:'center'});
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
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);

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
        try {
          const spkFile = await buildCustomerSpkPdf(order);
          downloadGeneratedFile(spkFile);
        } catch (pdfError) {
          console.error('Automatic SPK download failed:', pdfError);
          setErrorMsg('Pesanan berhasil dibuat, tetapi SPK belum terunduh. Gunakan tombol Unduh SPK di halaman konfirmasi.');
        }
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
            const waMessage = [
              'Halo Admin SANDIKALE, konfirmasi pesanan '+createdOrder.id+'.',
              'SPK dan file desain saya lampirkan.'+(needsPaymentProof?' Bukti transfer/QRIS juga terlampir.':''),
              isManualPayment?'Mohon konfirmasi detail dan pembayaran melalui WhatsApp.':'Mohon periksa kelengkapan pesanan saya.'
            ].join('\\n');
            const openWhatsApp=()=>{if(cleanWa)window.open('https://wa.me/'+cleanWa+'?text='+encodeURIComponent(waMessage),'_blank','noopener,noreferrer');};
            const shareOrderFiles=async()=>{
              if(needsPaymentProof&&!paymentProofFile){setErrorMsg('Unggah bukti transfer atau QRIS terlebih dahulu.');return;}
              try{
                const spk=await buildCustomerSpkPdf(createdOrder),designFiles:File[]=[];
                const placements=createdOrder.items.flatMap(item=>(item.customPlacements||[]).map(placement=>({placement})));
                for(const [index,entry] of placements.entries()){const source=entry.placement.originalDataUrl||entry.placement.artworkDataUrl;if(source)designFiles.push(await dataUrlToFile(source,safeFileName(entry.placement.artworkName||('desain-'+(index+1)+'.png'))));}
                const files=[spk,...designFiles,...(paymentProofFile?[paymentProofFile]:[])];
                if(navigator.share&&navigator.canShare?.({files}))await navigator.share({title:'Pesanan SANDIKALE '+createdOrder.id,text:waMessage,files});
                else{for(const file of files){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1500);}openWhatsApp();}
              }catch(error){if(error instanceof Error&&error.name==='AbortError')return;setErrorMsg('File belum dapat dibagikan otomatis. Unduh lampiran, lalu kirim bersama pesan WhatsApp.');openWhatsApp();}
            };

            return (
              <div className="space-y-4">
                <button type="button" onClick={() => printCustomerReceipt(createdOrder)} className="w-full h-10 rounded-md border border-black/15 dark:border-white/15 text-xs font-semibold uppercase tracking-wider">Cetak Nota Struk</button>
                <button type="button" onClick={async () => { try { downloadGeneratedFile(await buildCustomerSpkPdf(createdOrder)); } catch { setErrorMsg('SPK belum dapat dibuat. Muat ulang halaman dan coba lagi.'); } }} className="w-full h-10 rounded-md bg-[#7A1F2B] text-white text-xs font-semibold uppercase tracking-wider">Unduh SPK PDF (1 Lembar A4)</button>
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

                {/* Customer order handoff: SPK, design files and optional payment proof */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/35 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                    <MessageCircle className="w-5 h-5 shrink-0" />
                    <span>Kirim SPK & Desain ke Admin</span>
                  </div>
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    Wajib kirim SPK dan file desain. {needsPaymentProof ? 'Bukti transfer/QRIS juga wajib dilampirkan.' : 'Pembayaran disepakati langsung dengan admin melalui WhatsApp.'}
                  </p>
                  {needsPaymentProof && <label className="block space-y-1 text-xs text-neutral-600 dark:text-neutral-300">Bukti pembayaran <input type="file" accept="image/*,application/pdf" onChange={(event) => setPaymentProofFile(event.target.files?.[0] || null)} className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-neutral-200 file:px-3 file:py-2 dark:file:bg-neutral-700" />{paymentProofFile && <span className="block text-emerald-600">{paymentProofFile.name}</span>}</label>}
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
                  {submitting ? 'Memproses...' : 'Buat Pesanan'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
