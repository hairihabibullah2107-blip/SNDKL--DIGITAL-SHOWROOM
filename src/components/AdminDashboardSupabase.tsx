import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AdminContentManager } from './AdminContentManager';

type Profile = { id: string; full_name: string; email: string | null; role: string; is_active: boolean };
type OrderRow = {
  id: string; order_number: string; spk_number: string; status: string; production_status: string;
  payment_status: string; subtotal: number; discount: number; additional_cost: number; delivery_cost: number; total_amount: number; deposit_amount: number;
  created_at: string; estimated_completion: string | null; notes: string | null; shipping_method: 'pickup' | 'courier' | null; shipping_address: string | null; shipping_city: string | null; version: number; design_notes: string | null; production_notes: string | null; finishing_instructions: string | null;
  showroom_customers?: { name: string; whatsapp: string; address?: string | null; email?: string | null } | null;
  showroom_order_items?: Array<{ id: string; product_id: string | null; product_name_snapshot: string; quantity: number; subtotal: number; specification: Record<string, unknown>; showroom_order_variants?: Array<{ size: string; color: string; quantity: number }>; showroom_order_designs?: Array<{ id: string; original_storage_path: string | null; front_preview_path: string | null; back_preview_path: string | null; design_version: number; approval_status: string }> }>;
};
type ProductRow = { id: string; name: string; slug: string; base_price: number; is_published: boolean; is_featured: boolean; description: string | null };
type CategoryRow = { id: string; name: string; slug: string; is_active: boolean };
type MaterialRow = { id: string; name: string; description: string | null; surcharge: number; is_active: boolean };
type ReviewRow = { id: string; product_id: string; author_name: string; rating: number; comment: string; created_at: string; is_approved: boolean };
type PriceRow = { id: string; size_code: string; label: string; price: number; width_cm: number; height_cm: number; is_active: boolean };

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
const safeAdminQuery = async (query: PromiseLike<any>) => { try { return await query; } catch (error) { return { data: null, error }; } };

async function getVerifiedPaymentTotal(orderId: string): Promise<number> {
  const { data, error } = await supabase.from('showroom_payments').select('amount').eq('order_id', orderId).eq('payment_status', 'verified');
  if (error) throw error;
  return (data || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

async function imageBlobToJpegDataUrl(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tidak dapat memproses gambar acuan.');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.88);
}
const STATUS: Record<string, { status: string; production: string }> = {
  'Menunggu Pembayaran': { status: 'waiting_payment', production: 'new' },
  'Verifikasi Desain DTF': { status: 'waiting_design_review', production: 'design_confirmation' },
  'Kirim Desain ke Pelanggan': { status: 'waiting_customer_approval', production: 'design_confirmation' },
  'Revisi Diminta': { status: 'revision_requested', production: 'design_confirmation' },
  'Proses Cetak DTF': { status: 'in_production', production: 'printing' },
  'Heat Press & QC': { status: 'quality_control', production: 'quality_control' },
  'Dikirim': { status: 'shipped', production: 'shipped' },
  'Siap Diserahkan': { status: 'ready', production: 'ready_for_pickup' },
  'Selesai': { status: 'completed', production: 'completed' },
};

function MaterialEditor({ material, onSave }: { material: MaterialRow; onSave: (material: MaterialRow, surcharge: number) => void }) {
  const [value, setValue] = useState(String(material.surcharge));
  return <div className="bg-[#121212] border border-white/10 rounded-xl p-4 flex items-center gap-3"><div className="flex-1"><div className="font-semibold">{material.name}</div><div className="text-xs text-white/50">{material.description || 'Bahan aktif'}</div></div><input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} className="w-32 bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" /><button onClick={() => onSave(material, Math.max(0, Number(value) || 0))} className="bg-[#7A1F2B] rounded-lg px-3 py-2 text-xs font-semibold">Simpan</button></div>;
}

export function AdminDashboardSupabase({ onExitAdmin, onToast }: { onExitAdmin: () => void; onToast: (message: string) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('hairihabibullah2107@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'orders' | 'catalog' | 'production' | 'website'>('orders');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [materialName, setMaterialName] = useState('');
  const [materialSurcharge, setMaterialSurcharge] = useState('0');
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
    setRefreshing(true);
    try {
    const canManageCatalog = profile && ['owner','admin'].includes(profile.role);
    const [o, p, c, d, r, m] = await Promise.all([
      supabase.from('showroom_orders').select('id,order_number,spk_number,status,production_status,payment_status,subtotal,discount,additional_cost,delivery_cost,total_amount,deposit_amount,created_at,estimated_completion,notes,shipping_method,shipping_address,shipping_city,version,design_notes,production_notes,finishing_instructions,showroom_customers(name,whatsapp,address,email),showroom_order_items(id,product_id,product_name_snapshot,quantity,subtotal,specification,showroom_order_variants(size,color,quantity),showroom_order_designs(id,original_storage_path,front_preview_path,back_preview_path,design_version,approval_status))').order('created_at', { ascending: false }).limit(100),
      canManageCatalog ? supabase.from('showroom_products').select('id,name,slug,base_price,is_published,is_featured,description').order('created_at', { ascending: false }) : Promise.resolve({data:[],error:null}),
      canManageCatalog ? supabase.from('showroom_categories').select('id,name,slug,is_active').order('sort_order') : Promise.resolve({data:[],error:null}),
      canManageCatalog ? supabase.from('showroom_dtf_prices').select('id,size_code,label,price,width_cm,height_cm,is_active').order('sort_order') : Promise.resolve({data:[],error:null}),
      canManageCatalog ? supabase.from('showroom_product_reviews').select('id,product_id,author_name,rating,comment,created_at,is_approved').order('created_at', { ascending: false }).limit(100) : Promise.resolve({data:[],error:null}),
      canManageCatalog ? supabase.from('showroom_materials').select('id,name,description,surcharge,is_active').order('name') : Promise.resolve({data:[],error:null}),
    ].map(safeAdminQuery));
    const failed = [['pesanan',o],['produk',p],['kategori',c],['harga DTF',d],['ulasan',r],['bahan',m]].filter(([,result])=>Boolean((result as {error?:unknown}).error)).map(([name])=>name);
    if (failed.length) onToast('Sebagian data dashboard belum termuat: '+failed.join(', ')+'. Periksa koneksi atau sesi admin, lalu muat ulang.');
    setOrders((o.data || []) as unknown as OrderRow[]);
    setProducts((p.data || []) as ProductRow[]);
    setCategories((c.data || []) as CategoryRow[]);
    setPrices((d.data || []) as PriceRow[]);
    setReviews((r.data || []) as ReviewRow[]);
    setMaterials((m.data || []) as MaterialRow[]);
    } finally { setRefreshing(false); }
  }, [onToast, profile?.role]);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null);
        setOrders([]);
        setProducts([]);
        setError('Sesi admin berakhir. Silakan masuk kembali untuk melanjutkan.');
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        window.setTimeout(() => { void verifySession(); }, 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [verifySession]);
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

  const paidRevenue = orders.filter((order) => order.payment_status === 'paid').reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const pendingPayments = orders.filter((order) => order.payment_status !== 'paid').length;
  const activeProduction = orders.filter((order) => !['completed','cancelled','Selesai'].includes(order.status)).length;
  const exportOrdersCsv = () => {
    const header = ['Nomor Pesanan','Nomor SPK','Tanggal','Pelanggan','WhatsApp','Pengiriman','Alamat Pengiriman','Status','Pembayaran','Total','DP'];
    const rows = orders.map((order) => [order.order_number,order.spk_number,new Date(order.created_at).toLocaleString('id-ID'),order.showroom_customers?.name || '',order.showroom_customers?.whatsapp || '',order.shipping_method==='pickup'?'Ambil sendiri':order.shipping_method==='courier'?'Diantar kurir':'Belum dicatat',[order.shipping_address,order.shipping_city].filter(Boolean).join(', '),order.status,order.payment_status,order.total_amount,order.deposit_amount]);
    const csv = [header,...rows].map((row) => row.map((value) => '"' + String(value ?? '').replace(/"/g,'""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8;'}));
    const link = document.createElement('a'); link.href=url; link.download='SANDIKALE-laporan-pesanan.csv'; link.click(); URL.revokeObjectURL(url);
  };

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
      const { error: historyError } = await supabase.from('showroom_order_status_history').insert({
        order_id: order.id, previous_status: order.status, new_status: next.status, changed_by: profile.id,
        notes: `Status diperbarui dari dashboard oleh ${profile.full_name}.`,
      });
      await load();
      if (historyError) {
        onToast(`Status pesanan ${order.order_number} sudah berubah, tetapi riwayat status gagal disimpan: ${historyError.message}`);
        return;
      }
      onToast(`Status pesanan ${order.order_number} diperbarui.`);
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

  const addMaterial = async (event: React.FormEvent) => {
    event.preventDefault(); if (!materialName.trim()) return;
    const { error: e } = await supabase.from('showroom_materials').insert({ name: materialName.trim(), description: materialName.trim(), surcharge: Math.max(0, Number(materialSurcharge) || 0), is_active: true });
    if (e) { onToast(e.message); return; } setMaterialName(''); setMaterialSurcharge('0'); await load(); onToast('Bahan berhasil ditambahkan.');
  };
  const saveMaterial = async (material: MaterialRow, surcharge: number) => {
    const { error: e } = await supabase.from('showroom_materials').update({ surcharge, updated_at: new Date().toISOString() }).eq('id', material.id);
    if (e) { onToast(e.message); return; } await load(); onToast('Biaya tambahan bahan disimpan.');
  };

  const moderateReview = async (review: ReviewRow, approved: boolean) => {
    const result = approved
      ? await supabase.from('showroom_product_reviews').update({ is_approved: true }).eq('id', review.id)
      : await supabase.from('showroom_product_reviews').delete().eq('id', review.id);
    if (result.error) { onToast(result.error.message); return; }
    await load(); onToast(approved ? 'Ulasan diterbitkan.' : 'Ulasan ditolak dan dihapus.');
  };

  const generateSpk = async (order: OrderRow) => {
    if(!profile)return;setBusy(true);
    try{
      const {jsPDF}=await import('jspdf'),doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
      const customer=order.showroom_customers,paid=await getVerifiedPaymentTotal(order.id),w=doc.internal.pageSize.getWidth(),m=10,r=w-m,items=order.showroom_order_items||[];
      doc.setFillColor(8,8,8);doc.rect(0,0,w,23,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('SANDIKALE',m,11);doc.setTextColor(215,150,158);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('SURAT PERINTAH KERJA · CUSTOM APPAREL & DTF',m,18);
      doc.setTextColor(20,20,20);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('SPK PRODUKSI',m,31);doc.setFontSize(7);doc.text(order.spk_number,r,31,{align:'right'});
      const fields:Array<[string,string]>=[['Pesanan',order.order_number],['Customer',customer?.name||'-'],['WhatsApp',customer?.whatsapp||'-'],['Tanggal',new Date(order.created_at).toLocaleString('id-ID')],['Pengambilan',order.shipping_method==='pickup'?'Ambil di store':'Diantar kurir'],['Alamat',order.shipping_method==='courier'?[order.shipping_address,order.shipping_city].filter(Boolean).join(', '):'Konfirmasi jadwal via WhatsApp']];
      let y=38;doc.setFontSize(7);for(let i=0;i<fields.length;i+=2){doc.setFont('helvetica','bold');doc.text(fields[i][0],m,y);doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize(fields[i][1]||'-',66),m+20,y);if(fields[i+1]){doc.setFont('helvetica','bold');doc.text(fields[i+1][0],110,y);doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize(fields[i+1][1]||'-',78),130,y);}y+=6;}
      y+=2;doc.setDrawColor(190,190,190);doc.line(m,y,r,y);y+=5;doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('RINCIAN ITEM & SPESIFIKASI',m,y);y+=5;
      const room=272-y,rowHeight=Math.max(7,Math.min(14,room/Math.max(1,items.length))),fs=items.length>8?5.5:6.5;
      for(const [i,item] of items.entries()){if(y>270)break;const spec=item.specification||{},sizes=(item.showroom_order_variants||[]).map(v=>v.size+'×'+v.quantity).join(', ')||'-',prints=Array.isArray(spec.dtf_prints)?(spec.dtf_prints as Array<{position?:string;size_label?:string}>).map(p=>(p.position||'DTF')+(p.size_label?' '+p.size_label:'')).join(', '):String(spec.placement||'Tanpa cetak');doc.setFont('helvetica','bold');doc.setFontSize(fs);doc.text((i+1)+'. '+String(item.product_name_snapshot).slice(0,65),m,y);doc.setFont('helvetica','normal');doc.text(String(item.quantity)+' pcs · '+money(Number(item.subtotal)),r,y,{align:'right'});doc.setFontSize(Math.max(5,fs-.5));doc.text(doc.splitTextToSize('Warna: '+String(spec.color||item.showroom_order_variants?.[0]?.color||'-')+' · Ukuran: '+sizes+' · DTF: '+prints,r-m-2).slice(0,2),m+2,y+3);doc.setTextColor(105,105,105);doc.text((item.showroom_order_designs||[]).length+' file desain tercatat',m+2,y+6);doc.setTextColor(20,20,20);y+=rowHeight;}
      y=Math.max(y+2,235);y=Math.min(y,273);doc.line(m,y,r,y);y+=6;doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text('TOTAL: '+money(Number(order.total_amount)),m,y);doc.text('DIBAYAR: '+money(paid),r,y,{align:'right'});y+=5;doc.text('SISA: '+money(Math.max(0,Number(order.total_amount)-paid)),m,y);y+=6;doc.setFont('helvetica','normal');doc.setFontSize(6);const notes='Desain: '+(order.design_notes||'-')+' | Produksi: '+(order.production_notes||order.notes||'-')+' | Finishing: '+(order.finishing_instructions||'-');doc.text(doc.splitTextToSize(notes,r-m).slice(0,2),m,y);
      y=286;doc.line(m,y,85,y);doc.line(125,y,r,y);doc.setFontSize(6);doc.text('Pelanggan',m+25,290);doc.text('SANDIKALE',145,290);
      const blob=doc.output('blob'),bytes=await blob.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),hash=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
      const count=await supabase.from('showroom_spk_documents').select('id',{count:'exact',head:true}).eq('order_id',order.id).eq('document_type','admin_confirmed');if(count.error)throw count.error;
      const revision=(count.count||0)+1,storagePath='orders/'+order.order_number+'/'+order.spk_number+'-admin-r'+revision+'.pdf',upload=await supabase.storage.from('showroom-spk-documents').upload(storagePath,blob,{contentType:'application/pdf',upsert:false});if(upload.error)throw upload.error;
      const previousResult=await supabase.from('showroom_spk_documents').select('id').eq('order_id',order.id).eq('document_type','admin_confirmed').eq('document_status','active');if(previousResult.error)throw previousResult.error;const previous=previousResult.data||[];
      if(previous.length){const supersede=await supabase.from('showroom_spk_documents').update({document_status:'superseded'}).in('id',previous.map(row=>row.id));if(supersede.error)throw supersede.error;}
      const archived=await supabase.from('showroom_spk_documents').insert({order_id:order.id,spk_number:order.spk_number,document_type:'admin_confirmed',revision_number:revision,storage_path:storagePath,document_status:'active',created_by:profile.id,order_version:order.version||1,snapshot:{order,customer,items,generated_by:profile.full_name},content_sha256:hash,supersedes_document_id:previous[0]?.id||null});if(archived.error)throw archived.error;
      doc.save(order.spk_number+'.pdf');onToast('SPK '+order.spk_number+' dibuat satu lembar dan diarsipkan.');
    }catch(e){onToast(e instanceof Error?e.message:'Gagal membuat SPK.');}finally{setBusy(false);}
  };

  const openReceiptDesk = (order: OrderRow) => {
    const url = new URL('receipt.html', window.location.href);
    url.searchParams.set('order', order.order_number);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const markPaid = async (order: OrderRow) => {
    if (!profile || !['owner','admin'].includes(profile.role) || !window.confirm(`Konfirmasi bahwa pembayaran pesanan ${order.order_number} sudah diterima?`)) return;
    setBusy(true);
    try {
      const paymentQuery = await supabase.from('showroom_payments')
        .select('id,amount,payment_status')
        .eq('order_id', order.id);
      if (paymentQuery.error) throw paymentQuery.error;
      const paymentRows = paymentQuery.data || [];
      const pendingRows = paymentRows.filter((row) => ['pending', 'waiting_verification'].includes(row.payment_status));
      const pendingTotal = pendingRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const verifiedTotal = paymentRows.filter((row) => row.payment_status === 'verified')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);
      if (pendingRows.length) {
        const verifyResult = await supabase.from('showroom_payments')
          .update({ payment_status: 'verified', verified_by: profile.id, paid_at: new Date().toISOString() })
          .in('id', pendingRows.map((row) => row.id));
        if (verifyResult.error) throw verifyResult.error;
      }
      const remainingToRecord = Math.max(0, Number(order.total_amount || 0) - verifiedTotal - pendingTotal);
      if (remainingToRecord > 0) {
        const methodMatch = String(order.notes || '').match(/Metode pembayaran:\s*([^;]+)/i);
        const paymentInsert = await supabase.from('showroom_payments').insert({
          order_id: order.id,
          amount: remainingToRecord,
          payment_method: methodMatch?.[1]?.trim() || 'manual',
          payment_status: 'verified',
          verified_by: profile.id,
          paid_at: new Date().toISOString(),
          notes: paymentRows.length ? 'Pelunasan dikonfirmasi admin.' : 'Pembayaran penuh dikonfirmasi admin.',
        });
        if (paymentInsert.error) throw paymentInsert.error;
      }
      const nextOrderStatus = order.status === 'waiting_payment' ? 'waiting_design_review' : order.status;
      const { error: updateError } = await supabase.from('showroom_orders').update({
        payment_status: 'paid', status: nextOrderStatus, updated_at: new Date().toISOString(), updated_by: profile.id,
      }).eq('id', order.id);
      if (updateError) throw updateError;
      const { error: historyError } = await supabase.from('showroom_order_status_history').insert({
        order_id: order.id, previous_status: order.status, new_status: nextOrderStatus,
        changed_by: profile.id, notes: 'Pembayaran dikonfirmasi admin.',
      });
      await load();
      if (historyError) {
        onToast('Pembayaran sudah tercatat, tetapi riwayat status gagal disimpan: ' + historyError.message);
        return;
      }
      onToast('Pembayaran pesanan dikonfirmasi dan dicatat pada riwayat pembayaran.');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Pembayaran gagal dikonfirmasi.');
    } finally {
      setBusy(false);
    }
  };

  const deleteReview = async (review: ReviewRow) => {
    if (!window.confirm('Hapus ulasan dari ' + review.author_name + '?')) return;
    const { error: deleteError } = await supabase.from('showroom_product_reviews').delete().eq('id', review.id);
    if (deleteError) { onToast(deleteError.message); return; }
    await load(); onToast('Ulasan dihapus.');
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
        <div className="text-xs tracking-[.3em] uppercase text-[#7A1F2B]">SANDIKALE · CONTROL ROOM</div>
        <h1 className="text-3xl font-bold">Admin Showroom</h1>
        <p className="text-sm text-white/60">Masuk menggunakan akun staf Supabase yang sudah terdaftar.</p>
        <label className="block text-xs space-y-2">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg bg-black border border-white/15 px-3 py-3 text-sm" autoComplete="username" /></label>
        <label className="block text-xs space-y-2">Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg bg-black border border-white/15 px-3 py-3 text-sm" autoComplete="current-password" /></label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-[#7A1F2B] text-white font-bold py-3 disabled:opacity-50">{busy ? 'Memeriksa…' : 'Masuk'}</button>
        <button type="button" onClick={onExitAdmin} className="w-full text-sm text-white/60 py-2">Kembali ke showroom</button>
      </form>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#080808] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div><div className="text-xs tracking-[.3em] uppercase text-[#7A1F2B]">SANDIKALE · CONTROL ROOM</div><h1 className="text-2xl md:text-3xl font-bold mt-1">Dashboard Showroom</h1><p className="text-xs text-white/50 mt-1">{profile.full_name} · {profile.role}</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => void load().catch((e) => onToast(e.message || "Gagal memuat ulang data."))} disabled={refreshing} className="border border-white/15 rounded-lg px-4 py-2 text-sm disabled:opacity-50">{refreshing ? "Memuat…" : "Muat ulang"}</button><button onClick={signOut} className="bg-white text-black rounded-lg px-4 py-2 text-sm font-semibold">Keluar</button></div>
        </header>
        <nav className="flex flex-wrap gap-2">{(['orders','catalog','production','website'] as const).filter((key) => ['owner','admin'].includes(profile.role) || (key === 'orders' && ['staff','production'].includes(profile.role))).map((key) => <button key={key} onClick={() => setTab(key)} className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === key ? 'bg-[#7A1F2B] text-white' : 'bg-white/5 text-white/65 hover:bg-white/10'}`}>{({orders:'Pesanan',catalog:'Katalog',production:'Produksi',website:'Website & Ulasan'} as Record<string,string>)[key]}</button>)}</nav>
        <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[{label:'Total pesanan',value:orders.length,detail:'100 pesanan terbaru'},{label:'Pendapatan terbayar',value:money(paidRevenue),detail:'Pembayaran terverifikasi'},{label:'Menunggu pembayaran',value:pendingPayments,detail:'Perlu tindak lanjut'},{label:'Dalam proses',value:activeProduction,detail:'Pesanan belum selesai'}].map((item)=><article key={item.label} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.07] to-transparent p-4"><p className="text-xs text-white/45">{item.label}</p><p className="text-xl md:text-2xl font-bold mt-2">{item.value}</p><p className="text-[10px] text-white/35 mt-1">{item.detail}</p></article>)}
        </section>
        {(['owner','admin'].includes(profile.role) && (tab === 'catalog' || tab === 'production' || tab === 'website')) && <AdminContentManager key={tab} initialWorkspace={tab} allowedWorkspaces={['catalog','production','website']} onToast={onToast} />}
        {tab === 'website' && <section className="space-y-3 mt-6"><h2 className="text-xl font-bold">Moderasi ulasan ({reviews.length})</h2>{reviews.map((r) => <article key={r.id} className="bg-[#121212] border border-white/10 rounded-xl p-4 space-y-2"><div className="flex justify-between gap-3"><strong>{r.author_name} · {'★'.repeat(r.rating)}</strong><span className="text-xs text-white/50">{r.is_approved ? 'Terbit' : 'Menunggu'}</span></div><p className="text-sm text-white/75">{r.comment}</p><div className="flex gap-2"><button onClick={() => void moderateReview(r, true)} className="bg-[#7A1F2B] rounded px-3 py-2 text-xs">Terbitkan</button><button onClick={() => void moderateReview(r, false)} className="border border-white/15 rounded px-3 py-2 text-xs">Tolak</button><button onClick={() => void deleteReview(r)} className="border border-red-500/30 text-red-300 rounded px-3 py-2 text-xs">Hapus</button></div></article>)}</section>}
        {tab === 'orders' && <section className="space-y-4"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-bold">Pesanan masuk ({orders.length})</h2><div className="flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor / nama / WhatsApp" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" /><button onClick={exportOrdersCsv} className="rounded-lg border border-white/15 px-3 py-2 text-xs whitespace-nowrap">Export CSV</button></div></div>
          {visibleOrders.map((order) => <article key={order.id} className="bg-[#121212] border border-white/10 rounded-xl p-4 md:p-5 space-y-3"><div className="flex flex-wrap justify-between gap-3"><div><div className="font-bold">{order.order_number}</div><div className="text-xs text-white/50">{order.spk_number} · {new Date(order.created_at).toLocaleString('id-ID')}</div></div><div className="text-right"><div className="font-bold">{money(Number(order.total_amount))}</div><div className="text-xs text-white/50">DP {money(Number(order.deposit_amount))} · {order.payment_status}</div></div></div><div className="text-sm">{order.showroom_customers?.name || 'Pelanggan'} · {order.showroom_customers?.whatsapp || '—'}</div><div className="text-xs text-white/60">Pengiriman: {order.shipping_method==='pickup'?'Ambil sendiri di store':order.shipping_method==='courier'?'Diantar kurir':'Belum tercatat'}{order.shipping_method==='courier'&&[order.shipping_address,order.shipping_city].filter(Boolean).length?' · '+[order.shipping_address,order.shipping_city].filter(Boolean).join(', '):''}</div><div className="text-xs text-white/60">{(order.showroom_order_items || []).map((item) => `${item.product_name_snapshot} × ${item.quantity}`).join(' · ')}</div><div className="flex flex-wrap items-center gap-3"><span className="text-xs text-white/50">Status: {order.status}</span><button disabled={busy || !['owner','admin'].includes(profile.role)} onClick={() => openReceiptDesk(order)} className="border border-[#7A1F2B]/60 text-[#D58B95] rounded-lg px-3 py-2 text-xs">Cetak Nota Struk</button><button disabled={busy || !['owner','admin'].includes(profile.role)} onClick={() => void generateSpk(order)} className="border border-white/15 rounded-lg px-3 py-2 text-xs">Buat SPK PDF</button>{order.payment_status !== 'paid' && <button disabled={!['owner','admin'].includes(profile.role)} onClick={() => void markPaid(order)} className="bg-emerald-700 rounded-lg px-3 py-2 text-xs">Konfirmasi pembayaran</button>}<select disabled={busy || !['owner','admin','staff'].includes(profile.role)} defaultValue="" onChange={(e) => { if (e.target.value) void updateStage(order, e.target.value); }} className="bg-black border border-white/15 rounded-lg px-3 py-2 text-sm"><option value="">Ubah status produksi…</option>{Object.keys(STATUS).map((s) => <option key={s} value={s}>{s}</option>)}</select><a className="text-xs text-[#A33A48]" href={`https://wa.me/${order.showroom_customers?.whatsapp || ''}`} target="_blank" rel="noreferrer">Hubungi pelanggan via WhatsApp</a></div></article>)}
          {!visibleOrders.length && <p className="text-sm text-white/50">Belum ada pesanan yang cocok.</p>}</section>}

      </div>
    </main>
  );
}
