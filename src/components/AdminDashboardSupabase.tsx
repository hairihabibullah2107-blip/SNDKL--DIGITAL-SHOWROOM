import { useCallback, useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';

type Profile = { id: string; full_name: string; email: string | null; role: string; is_active: boolean };
type OrderRow = {
  id: string; order_number: string; spk_number: string; status: string; production_status: string;
  payment_status: string; subtotal: number; total_amount: number; deposit_amount: number;
  created_at: string; estimated_completion: string | null; notes: string | null; version: number; design_notes: string | null; production_notes: string | null; finishing_instructions: string | null;
  showroom_customers?: { name: string; whatsapp: string; address?: string | null; email?: string | null } | null;
  showroom_order_items?: Array<{ id: string; product_name_snapshot: string; quantity: number; subtotal: number; specification: Record<string, unknown> }>;
};
type ProductRow = { id: string; name: string; slug: string; base_price: number; is_published: boolean; is_featured: boolean; description: string | null };
type CategoryRow = { id: string; name: string; slug: string; is_active: boolean };
type ReviewRow = { id: string; product_id: string; author_name: string; rating: number; comment: string; created_at: string; is_approved: boolean };
type PriceRow = { id: string; size_code: string; label: string; price: number; width_cm: number; height_cm: number; is_active: boolean };

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
const STATUS: Record<string, { status: string; production: string }> = {
  'Menunggu Pembayaran': { status: 'waiting_payment', production: 'new' },
  'Verifikasi Desain DTF': { status: 'waiting_design_review', production: 'design_confirmation' },
  'Proses Cetak DTF': { status: 'in_production', production: 'printing' },
  'Heat Press & QC': { status: 'quality_control', production: 'quality_control' },
  'Siap Diserahkan': { status: 'ready', production: 'ready_for_pickup' },
  'Selesai': { status: 'completed', production: 'completed' },
};

export function AdminDashboardSupabase({ onExitAdmin, onToast }: { onExitAdmin: () => void; onToast: (message: string) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('hairihabibullah2107@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'orders' | 'products' | 'categories' | 'pricing' | 'reviews'>('orders');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('85000');
  const [productCategory, setProductCategory] = useState('');
  const [productImage, setProductImage] = useState<File | null>(null);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const [o, p, c, d, r] = await Promise.all([
      supabase.from('showroom_orders').select('id,order_number,spk_number,status,production_status,payment_status,subtotal,total_amount,deposit_amount,created_at,estimated_completion,notes,version,design_notes,production_notes,finishing_instructions,showroom_customers(name,whatsapp,address,email),showroom_order_items(id,product_name_snapshot,quantity,subtotal,specification)').order('created_at', { ascending: false }).limit(100),
      supabase.from('showroom_products').select('id,name,slug,base_price,is_published,is_featured,description').order('created_at', { ascending: false }),
      supabase.from('showroom_categories').select('id,name,slug,is_active').order('sort_order'),
      supabase.from('showroom_dtf_prices').select('id,size_code,label,price,width_cm,height_cm,is_active').order('sort_order'),
      supabase.from('showroom_product_reviews').select('id,product_id,author_name,rating,comment,created_at,is_approved').order('created_at', { ascending: false }).limit(100),
    ]);
    const failure = [o.error, p.error, c.error, d.error, r.error].find(Boolean);
    if (failure) throw failure;
    setOrders((o.data || []) as unknown as OrderRow[]);
    setProducts((p.data || []) as ProductRow[]);
    setCategories((c.data || []) as CategoryRow[]);
    setPrices((d.data || []) as PriceRow[]);
    setReviews((r.data || []) as ReviewRow[]);
  }, []);

  const verifySession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setProfile(null); return; }
    const { data: staff, error: staffError } = await supabase.from('showroom_staff_profiles')
      .select('id,full_name,email,role,is_active').eq('auth_user_id', data.session.user.id).maybeSingle();
    if (staffError || !staff || !staff.is_active || !['owner', 'admin', 'staff', 'production'].includes(staff.role)) {
      await supabase.auth.signOut();
      setProfile(null);
      setError('Akun ini tidak memiliki akses staf showroom.');
      return;
    }
    setProfile(staff as Profile);
  }, []);

  useEffect(() => { void verifySession(); }, [verifySession]);
  useEffect(() => {
    if (!profile) return;
    void load().catch((e) => onToast(e.message || 'Gagal memuat data admin.'));
    const channel = supabase.channel('showroom-admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_orders' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'showroom_products' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile, load, onToast]);

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? orders.filter((o) => [o.order_number, o.spk_number, o.showroom_customers?.name, o.showroom_customers?.whatsapp].some((v) => String(v || '').toLowerCase().includes(q))) : orders;
  }, [orders, search]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      await verifySession();
      setPassword('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Login gagal.'); }
    finally { setBusy(false); }
  };

  const signOut = async () => { await supabase.auth.signOut(); setProfile(null); onToast('Anda telah keluar dari admin.'); };

  const updateStage = async (order: OrderRow, label: string) => {
    const next = STATUS[label];
    if (!next || !profile) return;
    setBusy(true);
    try {
      const { error: updateError } = await supabase.from('showroom_orders').update({
        status: next.status, production_status: next.production, updated_at: new Date().toISOString(),
        updated_by: profile.id,
      }).eq('id', order.id);
      if (updateError) throw updateError;
      await supabase.from('showroom_order_status_history').insert({
        order_id: order.id, previous_status: order.status, new_status: next.status, changed_by: profile.id,
        notes: `Status diperbarui dari dashboard oleh ${profile.full_name}.`,
      });
      await load(); onToast(`Status pesanan ${order.order_number} diperbarui.`);
    } catch (e) { onToast(e instanceof Error ? e.message : 'Gagal memperbarui status.'); }
    finally { setBusy(false); }
  };

  const addCategory = async (event: React.FormEvent) => {
    event.preventDefault(); if (!categoryName.trim()) return;
    const slug = categoryName.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error: e } = await supabase.from('showroom_categories').insert({ name: categoryName.trim(), slug, is_active: true });
    if (e) { onToast(e.message); return; }
    setCategoryName(''); await load(); onToast('Kategori berhasil ditambahkan.');
  };

  const addProduct = async (event: React.FormEvent) => {
    event.preventDefault(); if (!productName.trim() || !productCategory) return;
    const slug = productName.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const category = categories.find((c) => c.id === productCategory);
    const { data: created, error: e } = await supabase.from('showroom_products').insert({
      category_id: productCategory, name: productName.trim(), slug: `${slug}-${Date.now().toString().slice(-5)}`,
      description: 'Produk baru SANDIKALE', base_price: Math.max(0, Number(productPrice) || 0),
      is_published: false, is_featured: false, stock_mode: 'made_to_order', available_colors: ['Hitam', 'Putih'],
    }).select('id').single();
    if (e || !created) { onToast(e?.message || 'Produk gagal dibuat.'); return; }
    if (productImage) {
      const safeName = productImage.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
      const storagePath = `products/${created.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('showroom-product-images').upload(storagePath, productImage, { contentType: productImage.type, upsert: false });
      if (uploadError) { onToast(`Produk tersimpan sebagai draft, tetapi foto gagal diunggah: ${uploadError.message}`); }
      else {
        const { error: imageError } = await supabase.from('showroom_product_images').insert({ product_id: created.id, storage_path: storagePath, alt_text: productName.trim(), is_primary: true, sort_order: 0 });
        if (imageError) onToast(`Produk tersimpan, tetapi data foto gagal dicatat: ${imageError.message}`);
      }
    }
    setProductName(''); setProductImage(null); await load(); onToast(`Produk ditambahkan ke kategori ${category?.name || ''} sebagai draft.`);
  };

  const toggleProduct = async (product: ProductRow) => {
    const { error: e } = await supabase.from('showroom_products').update({ is_published: !product.is_published, updated_at: new Date().toISOString() }).eq('id', product.id);
    if (e) { onToast(e.message); return; } await load();
  };

  const moderateReview = async (review: ReviewRow, approved: boolean) => {
    const { error: e } = await supabase.from('showroom_product_reviews').update({ is_approved: approved }).eq('id', review.id);
    if (e) { onToast(e.message); return; } await load(); onToast(approved ? 'Ulasan diterbitkan.' : 'Ulasan ditolak.');
  };

  const generateSpk = async (order: OrderRow) => {
    if (!profile) return;
    setBusy(true);
    try {
      const doc = new jsPDF();
      doc.setFillColor(8, 8, 8); doc.rect(0, 0, 210, 34, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(21); doc.text('SANDIKALE', 14, 15);
      doc.setFontSize(10); doc.setTextColor(255, 77, 0); doc.text('SURAT PERINTAH KERJA · CUSTOM APPAREL & DTF', 14, 25);
      doc.setTextColor(20, 20, 20); doc.setFontSize(13); doc.text('INFORMASI PESANAN', 14, 48);
      doc.setFontSize(10);
      const customer = order.showroom_customers;
      const rows = [
        ['Nomor SPK', order.spk_number], ['Nomor Pesanan', order.order_number],
        ['Tanggal', new Date(order.created_at).toLocaleString('id-ID')],
        ['Pelanggan', customer?.name || '-'], ['WhatsApp', customer?.whatsapp || '-'],
        ['Alamat', customer?.address || '-'], ['Status', order.status],
      ];
      let y = 58;
      for (const [label, value] of rows) { doc.setFont(undefined, 'bold'); doc.text(label, 14, y); doc.setFont(undefined, 'normal'); doc.text(String(value).slice(0, 95), 62, y); y += 7; }
      y += 6; doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text('RINCIAN PRODUK', 14, y); y += 8;
      doc.setFontSize(9); doc.text('Produk', 14, y); doc.text('Qty', 130, y); doc.text('Subtotal', 150, y); doc.line(14, y + 2, 196, y + 2); y += 9;
      for (const item of order.showroom_order_items || []) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFont(undefined, 'normal'); doc.text(String(item.product_name_snapshot).slice(0, 60), 14, y);
        doc.text(String(item.quantity), 130, y); doc.text(money(Number(item.subtotal)), 150, y); y += 7;
      }
      y += 8; doc.setFontSize(10); doc.setFont(undefined, 'bold');
      doc.text(`Subtotal: ${money(Number(order.subtotal))}`, 14, y); y += 7;
      doc.text(`DP: ${money(Number(order.deposit_amount))}`, 14, y); y += 7;
      doc.text(`Sisa: ${money(Math.max(0, Number(order.total_amount) - Number(order.deposit_amount)))}`, 14, y); y += 12;
      doc.setFont(undefined, 'normal'); doc.text('Catatan desain:', 14, y); y += 6; doc.text(doc.splitTextToSize(order.design_notes || '-', 180), 14, y); y += 14;
      doc.text('Catatan produksi:', 14, y); y += 6; doc.text(doc.splitTextToSize(order.production_notes || order.notes || '-', 180), 14, y); y += 14;
      doc.text('Instruksi finishing:', 14, y); y += 6; doc.text(doc.splitTextToSize(order.finishing_instructions || '-', 180), 14, y); y += 18;
      doc.line(14, y, 90, y); doc.line(120, y, 196, y); y += 5;
      doc.setFontSize(9); doc.text('Pelanggan', 38, y); doc.text('SANDIKALE', 148, y);
      const blob = doc.output('blob');
      const bytes = await blob.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest)).map((v) => v.toString(16).padStart(2, '0')).join('');
      const { count } = await supabase.from('showroom_spk_documents').select('id', { count: 'exact', head: true }).eq('order_id', order.id).eq('document_type', 'admin_confirmed');
      const revision = (count || 0) + 1;
      const storagePath = `orders/${order.order_number}/${order.spk_number}-admin-r${revision}.pdf`;
      const { error: uploadError } = await supabase.storage.from('showroom-spk-documents').upload(storagePath, blob, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;
      const { data: previous } = await supabase.from('showroom_spk_documents').select('id').eq('order_id', order.id).eq('document_type', 'admin_confirmed').eq('document_status', 'active');
      if (previous?.length) await supabase.from('showroom_spk_documents').update({ document_status: 'superseded' }).in('id', previous.map((row) => row.id));
      const snapshot = { order, customer, items: order.showroom_order_items || [], generated_by: profile.full_name };
      const { error: insertError } = await supabase.from('showroom_spk_documents').insert({
        order_id: order.id, spk_number: order.spk_number, document_type: 'admin_confirmed',
        revision_number: revision, storage_path: storagePath, document_status: 'active',
        created_by: profile.id, order_version: order.version || 1, snapshot, content_sha256: hash,
        supersedes_document_id: previous?.[0]?.id || null,
      });
      if (insertError) throw insertError;
      doc.save(`${order.spk_number}.pdf`);
      onToast(`SPK ${order.spk_number} dibuat dan diarsipkan.`);
    } catch (e) { onToast(e instanceof Error ? e.message : 'Gagal membuat SPK.'); }
    finally { setBusy(false); }
  };

  const markPaid = async (order: OrderRow) => {
    if (!profile || !window.confirm(`Konfirmasi bahwa pembayaran pesanan ${order.order_number} sudah diterima?`)) return;
    const { error: updateError } = await supabase.from('showroom_orders').update({ payment_status: 'paid', status: 'waiting_design_review', updated_at: new Date().toISOString(), updated_by: profile.id }).eq('id', order.id);
    if (updateError) { onToast(updateError.message); return; }
    await supabase.from('showroom_payments').update({ payment_status: 'verified', verified_by: profile.id, paid_at: new Date().toISOString() }).eq('order_id', order.id).eq('payment_status', 'waiting_verification');
    await supabase.from('showroom_order_status_history').insert({ order_id: order.id, previous_status: order.status, new_status: 'waiting_design_review', changed_by: profile.id, notes: 'Pembayaran dikonfirmasi admin.' });
    await load(); onToast('Pembayaran pesanan dikonfirmasi.');
  };

  const savePrice = async (price: PriceRow) => {
    const next = Number(priceDraft[price.id]);
    if (!Number.isFinite(next) || next < 0) { onToast('Harga DTF tidak valid.'); return; }
    const { error: e } = await supabase.from('showroom_dtf_prices').update({ price: next, updated_at: new Date().toISOString() }).eq('id', price.id);
    if (e) { onToast(e.message); return; }
    setPriceDraft((prev) => ({ ...prev, [price.id]: '' })); await load(); onToast(`Tarif ${price.size_code} disimpan.`);
  };

  if (!profile) return (
    <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center p-5">
      <form onSubmit={signIn} className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl p-7 space-y-5">
        <div className="text-xs tracking-[.3em] uppercase text-[#FF4D00]">SANDIKALE · CONTROL ROOM</div>
        <h1 className="text-3xl font-bold">Admin Showroom</h1>
        <p className="text-sm text-white/60">Masuk menggunakan akun staf Supabase yang sudah terdaftar.</p>
        <label className="block text-xs space-y-2">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg bg-black border border-white/15 px-3 py-3 text-sm" autoComplete="username" /></label>
        <label className="block text-xs space-y-2">Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg bg-black border border-white/15 px-3 py-3 text-sm" autoComplete="current-password" /></label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-[#FF4D00] text-white font-bold py-3 disabled:opacity-50">{busy ? 'Memeriksa…' : 'Masuk'}</button>
        <button type="button" onClick={onExitAdmin} className="w-full text-sm text-white/60 py-2">Kembali ke showroom</button>
      </form>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#080808] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div><div className="text-xs tracking-[.3em] uppercase text-[#FF4D00]">SANDIKALE · CONTROL ROOM</div><h1 className="text-2xl md:text-3xl font-bold mt-1">Dashboard Showroom</h1><p className="text-xs text-white/50 mt-1">{profile.full_name} · {profile.role}</p></div>
          <div className="flex gap-2"><button onClick={() => void load()} className="border border-white/15 rounded-lg px-4 py-2 text-sm">Muat ulang</button><button onClick={signOut} className="bg-white text-black rounded-lg px-4 py-2 text-sm font-semibold">Keluar</button></div>
        </header>
        <nav className="flex flex-wrap gap-2">{(['orders','products','categories','pricing','reviews'] as const).map((key) => <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-lg text-sm capitalize ${tab === key ? 'bg-[#FF4D00] text-white' : 'bg-white/5 text-white/65'}`}>{({orders:'Pesanan',products:'Produk',categories:'Kategori',pricing:'Harga DTF',reviews:'Ulasan'} as Record<string,string>)[key]}</button>)}</nav>
        {tab === 'reviews' && <section className="space-y-3"><h2 className="text-xl font-bold">Moderasi ulasan ({reviews.length})</h2>{reviews.map((r) => <article key={r.id} className="bg-[#121212] border border-white/10 rounded-xl p-4 space-y-2"><div className="flex justify-between gap-3"><strong>{r.author_name} · {'★'.repeat(r.rating)}</strong><span className="text-xs text-white/50">{r.is_approved ? 'Terbit' : 'Menunggu'}</span></div><p className="text-sm text-white/75">{r.comment}</p><div className="flex gap-2"><button onClick={() => void moderateReview(r, true)} className="bg-[#FF4D00] rounded px-3 py-2 text-xs">Terbitkan</button><button onClick={() => void moderateReview(r, false)} className="border border-white/15 rounded px-3 py-2 text-xs">Tolak</button></div></article>)}</section>}
        {tab === 'orders' && <section className="space-y-4"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-bold">Pesanan masuk ({orders.length})</h2><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor / nama / WhatsApp" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" /></div>
          {visibleOrders.map((order) => <article key={order.id} className="bg-[#121212] border border-white/10 rounded-xl p-4 md:p-5 space-y-3"><div className="flex flex-wrap justify-between gap-3"><div><div className="font-bold">{order.order_number}</div><div className="text-xs text-white/50">{order.spk_number} · {new Date(order.created_at).toLocaleString('id-ID')}</div></div><div className="text-right"><div className="font-bold">{money(Number(order.total_amount))}</div><div className="text-xs text-white/50">DP {money(Number(order.deposit_amount))} · {order.payment_status}</div></div></div><div className="text-sm">{order.showroom_customers?.name || 'Pelanggan'} · {order.showroom_customers?.whatsapp || '—'}</div><div className="text-xs text-white/60">{(order.showroom_order_items || []).map((item) => `${item.product_name_snapshot} × ${item.quantity}`).join(' · ')}</div><div className="flex flex-wrap items-center gap-3"><span className="text-xs text-white/50">Status: {order.status}</span><button disabled={busy} onClick={() => void generateSpk(order)} className="border border-white/15 rounded-lg px-3 py-2 text-xs">Buat SPK PDF</button>{order.payment_status !== 'paid' && <button onClick={() => void markPaid(order)} className="bg-emerald-700 rounded-lg px-3 py-2 text-xs">Konfirmasi pembayaran</button>}<select disabled={busy || !['owner','admin','staff'].includes(profile.role)} defaultValue="" onChange={(e) => { if (e.target.value) void updateStage(order, e.target.value); }} className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"><option value="">Ubah status produksi…</option>{Object.keys(STATUS).map((s) => <option key={s} value={s}>{s}</option>)}</select><a className="text-xs text-[#FF6A32]" href={`https://wa.me/${order.showroom_customers?.whatsapp || ''}`} target="_blank" rel="noreferrer">Hubungi pelanggan via WhatsApp</a></div></article>)}
          {!visibleOrders.length && <p className="text-sm text-white/50">Belum ada pesanan yang cocok.</p>}</section>}
        {tab === 'products' && <section className="space-y-4"><h2 className="text-xl font-bold">Katalog produk</h2><form onSubmit={addProduct} className="grid md:grid-cols-4 gap-2 bg-[#121212] border border-white/10 rounded-xl p-4"><input required value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Nama produk" className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" /><input required type="number" min="0" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="Harga" className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" /><select required value={productCategory} onChange={(e) => setProductCategory(e.target.value)} className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm"><option value="">Pilih kategori</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><label className="text-xs text-white/60 flex items-center gap-2"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setProductImage(e.target.files?.[0] || null)} /> Foto produk</label><button className="bg-[#FF4D00] rounded-lg py-2 text-sm font-semibold">Tambah draft</button></form><div className="grid md:grid-cols-2 gap-3">{products.map((p) => <article key={p.id} className="bg-[#121212] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3"><div><div className="font-semibold">{p.name}</div><div className="text-xs text-white/50">{money(Number(p.base_price))} · {p.is_published ? 'Terbit' : 'Draft'}</div></div><button onClick={() => void toggleProduct(p)} className="text-xs border border-white/15 rounded-lg px-3 py-2">{p.is_published ? 'Tarik' : 'Terbitkan'}</button></article>)}</div></section>}
        {tab === 'categories' && <section className="space-y-4"><h2 className="text-xl font-bold">Kategori katalog</h2><form onSubmit={addCategory} className="flex flex-wrap gap-2"><input required value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Nama kategori baru" className="flex-1 min-w-52 bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-sm" /><button className="bg-[#FF4D00] rounded-lg px-5 py-2 text-sm font-semibold">Tambah kategori</button></form><div className="grid md:grid-cols-3 gap-3">{categories.map((c) => <div key={c.id} className="bg-[#121212] border border-white/10 rounded-xl p-4"><div className="font-semibold">{c.name}</div><div className="text-xs text-white/50">{c.slug} · {c.is_active ? 'Aktif' : 'Nonaktif'}</div></div>)}</div></section>}
        {tab === 'pricing' && <section className="space-y-4"><h2 className="text-xl font-bold">Tarif cetak DTF</h2><div className="grid md:grid-cols-2 gap-3">{prices.map((p) => <div key={p.id} className="bg-[#121212] border border-white/10 rounded-xl p-4 flex items-center gap-3"><div className="flex-1"><div className="font-semibold">{p.label}</div><div className="text-xs text-white/50">{p.width_cm} × {p.height_cm} cm</div></div><input type="number" min="0" value={priceDraft[p.id] ?? String(p.price)} onChange={(e) => setPriceDraft((prev) => ({ ...prev, [p.id]: e.target.value }))} className="w-32 bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" /><button onClick={() => void savePrice(p)} className="bg-[#FF4D00] rounded-lg px-3 py-2 text-xs font-semibold">Simpan</button></div>)}</div></section>}
      </div>
    </main>
  );
}
