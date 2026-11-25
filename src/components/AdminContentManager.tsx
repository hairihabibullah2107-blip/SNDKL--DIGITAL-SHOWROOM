import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Row = Record<string, any>;
const money = (v: number) => new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0));
const slug = (v:string) => v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function AdminContentManager({onToast}:{onToast:(message:string)=>void}) {
  const [tab,setTab] = useState<'products'|'categories'|'materials'|'dtf'|'settings'>('products');
  const [products,setProducts] = useState<Row[]>([]);
  const [categories,setCategories] = useState<Row[]>([]);
  const [materials,setMaterials] = useState<Row[]>([]);
  const [prices,setPrices] = useState<Row[]>([]);
  const [settings,setSettings] = useState<Row[]>([]);
  const [busy,setBusy] = useState(false);

  const load = useCallback(async () => {
    const results = await Promise.all([
      supabase.from('showroom_products').select('id,name,slug,category_id,base_price,description,model,weight_description,is_published,is_featured,is_best_seller,stock_mode,available_colors,long_sleeve_price,size_surcharges,finishing_options,material_id').order('created_at',{ascending:false}),
      supabase.from('showroom_categories').select('id,name,slug,description,is_active,sort_order').order('sort_order'),
      supabase.from('showroom_materials').select('id,name,description,surcharge,is_active').order('name'),
      supabase.from('showroom_dtf_prices').select('id,size_code,label,width_cm,height_cm,price,is_active,sort_order').order('sort_order'),
      supabase.from('showroom_settings').select('key,value').order('key')
    ]);
    const failure=results.find(x=>x.error)?.error;
    if(failure) throw failure;
    setProducts(results[0].data||[]); setCategories(results[1].data||[]);
    setMaterials(results[2].data||[]); setPrices(results[3].data||[]); setSettings(results[4].data||[]);
  },[]);
  useEffect(()=>{void load().catch(e=>onToast(e.message||'Gagal memuat data.'));},[load,onToast]);
  useEffect(()=>{
    const ch=supabase.channel('admin-content-manager')
      .on('postgres_changes',{event:'*',schema:'public',table:'showroom_products'},()=>void load())
      .on('postgres_changes',{event:'*',schema:'public',table:'showroom_categories'},()=>void load())
      .on('postgres_changes',{event:'*',schema:'public',table:'showroom_materials'},()=>void load())
      .on('postgres_changes',{event:'*',schema:'public',table:'showroom_dtf_prices'},()=>void load())
      .on('postgres_changes',{event:'*',schema:'public',table:'showroom_settings'},()=>void load()).subscribe();
    return ()=>{void supabase.removeChannel(ch);};
  },[load]);
  const act=async(label:string,run:()=>Promise<{error:any}>)=>{
    setBusy(true); try{const r=await run();if(r.error)throw r.error;await load();onToast(label+' berhasil disimpan.');}
    catch(e){onToast(e instanceof Error?e.message:'Operasi gagal.');}finally{setBusy(false);}
  };
  const editProduct=(p:Row)=>void (async()=>{
    const name=prompt('Nama produk',p.name);if(name===null)return;
    const price=prompt('Harga dasar (Rupiah)',String(p.base_price));if(price===null)return;
    const description=prompt('Deskripsi',p.description||'');if(description===null)return;
    const model=prompt('Model / fit',p.model||'Regular Fit');if(model===null)return;
    const weight=prompt('Bahan / gramasi',p.weight_description||'');if(weight===null)return;
    const category=prompt('ID kategori (kosongkan untuk tidak mengubah)',p.category_id||'');if(category===null)return;
    await act('Produk',()=>supabase.from('showroom_products').update({name:name.trim(),base_price:Math.max(0,Number(price)||0),description,model,weight_description:weight,...(category.trim()?{category_id:category.trim()}:{}),updated_at:new Date().toISOString()}).eq('id',p.id));
  })();
  const removeProduct=(p:Row)=>{if(!confirm('Hapus produk '+p.name+'? Riwayat pesanan dilindungi oleh relasi database.'))return;void act('Hapus produk',()=>supabase.from('showroom_products').delete().eq('id',p.id));};
  const editSimple=(table:string,row:Row,fields:string[],label:string)=>void (async()=>{
    const patch:Row={updated_at:new Date().toISOString()};
    for(const field of fields){const v=prompt(field.replaceAll('_',' '),String(row[field]??''));if(v===null)return;patch[field]=['price','surcharge','width_cm','height_cm','sort_order'].includes(field)?Number(v):v;}
    await act(label,()=>supabase.from(table).update(patch).eq('id',row.id));
  })();
  const removeSimple=(table:string,row:Row,label:string)=>{if(!confirm('Hapus '+label+'?'))return;void act(label,()=>supabase.from(table).delete().eq('id',row.id));};
  const addSimple=(table:string,values:Row,label:string)=>void act(label,()=>supabase.from(table).insert(values));
  const saveSetting=(row:Row)=>void (async()=>{
    const raw=prompt('Ubah nilai JSON untuk '+row.key,JSON.stringify(row.value,null,2));if(raw===null)return;
    try{const value=JSON.parse(raw);await act('Pengaturan',()=>supabase.from('showroom_settings').update({value,updated_at:new Date().toISOString()}).eq('key',row.key));}
    catch{onToast('JSON tidak valid.');}
  })();
  const createProduct=()=>{const name=prompt('Nama produk baru');if(!name?.trim())return;const category=prompt('ID kategori tujuan (lihat daftar kategori di bawah)');if(!category)return;const price=Number(prompt('Harga dasar','85000')||0);void addSimple('showroom_products',{name:name.trim(),slug:slug(name)+'-'+Date.now().toString().slice(-5),category_id:category,base_price:Math.max(0,price),description:'',is_published:false,is_featured:false,stock_mode:'made_to_order',available_colors:['Hitam','Putih']},'Produk');};
  const createCategory=()=>{const name=prompt('Nama kategori');if(!name?.trim())return;void addSimple('showroom_categories',{name:name.trim(),slug:slug(name),is_active:true,sort_order:categories.length},'Kategori');};
  const createMaterial=()=>{const name=prompt('Nama bahan');if(!name?.trim())return;const surcharge=Number(prompt('Biaya tambahan per kaos','0')||0);void addSimple('showroom_materials',{name:name.trim(),description:'',surcharge:Math.max(0,surcharge),is_active:true},'Bahan');};
  const createDtf=()=>{const code=prompt('Kode ukuran, mis. A4');if(!code?.trim())return;const label=prompt('Nama opsi cetak',code);if(label===null)return;const width=Number(prompt('Lebar cm','21')||0);const height=Number(prompt('Tinggi cm','29.7')||0);const price=Number(prompt('Harga Rupiah','25000')||0);void addSimple('showroom_dtf_prices',{size_code:code.toUpperCase(),label,width_cm:width,height_cm:height,price,is_active:true,sort_order:prices.length},'Opsi DTF');};
  const toggle=(table:string,row:Row,field:string)=>void act('Status',()=>supabase.from(table).update({[field]:!row[field],updated_at:new Date().toISOString()}).eq('id',row.id));
  const tabs=[['products','Produk'],['categories','Kategori'],['materials','Bahan'],['dtf','Opsi DTF'],['settings','Pengaturan website']] as const;
  return <section className="space-y-4">
    <div><h2 className="text-xl font-bold">Manajemen konten & opsi</h2><p className="text-xs text-white/50">Tambah, edit, hapus, dan publikasikan data tanpa mengubah source code. Perubahan tersimpan di Supabase.</p></div>
    <nav className="flex flex-wrap gap-2">{tabs.map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={'rounded-lg px-3 py-2 text-xs '+(tab===id?'bg-[#FF4D00]':'bg-white/10')}>{label}</button>)}</nav>
    {tab==='products'&&<div className="space-y-3"><button disabled={busy} onClick={createProduct} className="bg-[#FF4D00] rounded-lg px-4 py-2 text-sm">+ Tambah produk</button><div className="grid md:grid-cols-2 gap-3">{products.map(p=><article key={p.id} className="rounded-xl border border-white/10 bg-[#121212] p-4 space-y-2"><div className="font-semibold">{p.name}</div><div className="text-xs text-white/50">{money(p.base_price)} · {p.is_published?'Terbit':'Draft'} · {p.model||'Model belum diatur'}</div><div className="flex flex-wrap gap-2"><button onClick={()=>editProduct(p)} className="border border-white/20 rounded px-3 py-2 text-xs">Edit</button><button onClick={()=>toggle('showroom_products',p,'is_published')} className="border border-white/20 rounded px-3 py-2 text-xs">{p.is_published?'Tarik':'Terbitkan'}</button><button onClick={()=>toggle('showroom_products',p,'is_featured')} className="border border-white/20 rounded px-3 py-2 text-xs">{p.is_featured?'Lepas unggulan':'Jadikan unggulan'}</button><button onClick={()=>removeProduct(p)} className="border border-red-500/40 text-red-300 rounded px-3 py-2 text-xs">Hapus</button></div></article>)}</div></div>}
    {tab==='categories'&&<div className="space-y-3"><button onClick={createCategory} className="bg-[#FF4D00] rounded-lg px-4 py-2 text-sm">+ Tambah kategori</button>{categories.map(c=><article key={c.id} className="rounded-xl border border-white/10 bg-[#121212] p-4 flex flex-wrap items-center justify-between gap-2"><div><b>{c.name}</b><div className="text-xs text-white/50">{c.slug} · {c.is_active?'Aktif':'Nonaktif'}</div></div><div className="flex gap-2"><button onClick={()=>editSimple('showroom_categories',c,['name','slug','description','sort_order'],'Kategori')} className="border border-white/20 rounded px-3 py-2 text-xs">Edit</button><button onClick={()=>toggle('showroom_categories',c,'is_active')} className="border border-white/20 rounded px-3 py-2 text-xs">{c.is_active?'Nonaktifkan':'Aktifkan'}</button><button onClick={()=>removeSimple('showroom_categories',c,'kategori')} className="border border-red-500/40 text-red-300 rounded px-3 py-2 text-xs">Hapus</button></div></article>)}</div>}
    {tab==='materials'&&<div className="space-y-3"><button onClick={createMaterial} className="bg-[#FF4D00] rounded-lg px-4 py-2 text-sm">+ Tambah bahan</button>{materials.map(m=><article key={m.id} className="rounded-xl border border-white/10 bg-[#121212] p-4 flex flex-wrap items-center justify-between gap-2"><div><b>{m.name}</b><div className="text-xs text-white/50">{m.description} · Tambahan {money(m.surcharge)}</div></div><div className="flex gap-2"><button onClick={()=>editSimple('showroom_materials',m,['name','description','surcharge'],'Bahan')} className="border border-white/20 rounded px-3 py-2 text-xs">Edit</button><button onClick={()=>toggle('showroom_materials',m,'is_active')} className="border border-white/20 rounded px-3 py-2 text-xs">{m.is_active?'Nonaktifkan':'Aktifkan'}</button><button onClick={()=>removeSimple('showroom_materials',m,'bahan')} className="border border-red-500/40 text-red-300 rounded px-3 py-2 text-xs">Hapus</button></div></article>)}</div>}
    {tab==='dtf'&&<div className="space-y-3"><button onClick={createDtf} className="bg-[#FF4D00] rounded-lg px-4 py-2 text-sm">+ Tambah opsi DTF</button>{prices.map(p=><article key={p.id} className="rounded-xl border border-white/10 bg-[#121212] p-4 flex flex-wrap items-center justify-between gap-2"><div><b>{p.label} ({p.size_code})</b><div className="text-xs text-white/50">{p.width_cm} × {p.height_cm} cm · {money(p.price)}</div></div><div className="flex gap-2"><button onClick={()=>editSimple('showroom_dtf_prices',p,['label','size_code','width_cm','height_cm','price','sort_order'],'Opsi DTF')} className="border border-white/20 rounded px-3 py-2 text-xs">Edit</button><button onClick={()=>toggle('showroom_dtf_prices',p,'is_active')} className="border border-white/20 rounded px-3 py-2 text-xs">{p.is_active?'Nonaktifkan':'Aktifkan'}</button><button onClick={()=>removeSimple('showroom_dtf_prices',p,'opsi DTF')} className="border border-red-500/40 text-red-300 rounded px-3 py-2 text-xs">Hapus</button></div></article>)}</div>}
    {tab==='settings'&&<div className="space-y-3">{settings.map(row=><article key={row.key} className="rounded-xl border border-white/10 bg-[#121212] p-4 flex items-center justify-between gap-3"><div><b className="capitalize">{row.key}</b><div className="text-xs text-white/50">{JSON.stringify(row.value)}</div></div><button onClick={()=>saveSetting(row)} className="bg-[#FF4D00] rounded px-3 py-2 text-xs">Edit nilai</button></article>)}</div>}
  </section>;
}
