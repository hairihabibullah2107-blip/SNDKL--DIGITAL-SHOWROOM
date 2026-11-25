# SANDIKALE Digital Showroom

Digital showroom SANDIKALE berbasis React + Vite, Supabase, dan GitHub Pages.

## Arsitektur

- **GitHub**: source code, version control, CI, dan static hosting melalui GitHub Pages.
- **Supabase**: PostgreSQL, Auth, Storage, Realtime, dan Edge Functions.
- **Tidak menggunakan** Express sebagai runtime produksi, Netlify, atau Render.
- Repository POS/kasir SANDIKALE terpisah dan tidak disentuh.

## Fitur yang terhubung

- Katalog produk, kategori, foto, pilihan bahan, warna, ukuran made-to-order.
- Custom DTF Studio dengan file desain disimpan di bucket privat.
- Checkout pesanan melalui Edge Function `showroom-public-api`.
- Kode tracking privat untuk melihat status pesanan.
- Konfirmasi pembayaran manual oleh admin.
- Dashboard staf melalui Supabase Auth dan `showroom_staff_profiles`.
- Kelola produk, foto produk, kategori, bahan dan surcharge, tarif DTF.
- Moderasi ulasan pelanggan.
- Pembuatan, pengarsipan, dan unduh PDF SPK per pesanan.
- Bantuan pelanggan dan konfirmasi desain melalui WhatsApp.

## Pengembangan lokal

1. Gunakan Node.js 22.
2. Jalankan `npm install`.
3. Jalankan `npm run dev`.
4. Jalankan `npm run lint` untuk pemeriksaan TypeScript.
5. Jalankan `npm run build` untuk menghasilkan folder `dist`.

Supabase URL dan publishable key berada di `src/lib/supabase.ts`. Publishable key memang digunakan di browser; jangan pernah memasukkan service-role key ke frontend atau repository.

## GitHub Pages

Workflow ada di `.github/workflows/deploy-pages.yml`. Untuk mengaktifkan publikasi pertama kali:

1. Buka **Settings → Pages** pada repository.
2. Di bagian **Build and deployment**, pilih **GitHub Actions** sebagai Source.
3. Push ke branch `sandikale-supabase-github-pages` untuk build dan deploy.
4. Setelah deploy berhasil, website tersedia di:
   `https://hairihabibullah2107-blip.github.io/SNDKL--DIGITAL-SHOWROOM/`

Workflow juga menjalankan pemeriksaan TypeScript dan build Vite pada pull request. Deploy hanya berjalan untuk push, bukan pull request.

## Admin

Buka `?view=admin` pada URL showroom dan masuk memakai akun Supabase Auth yang sudah terhubung ke `showroom_staff_profiles`. Hanya profil staf aktif dengan role yang diizinkan yang dapat membuka dashboard.

## Catatan operasional

- Pembayaran saat ini **manual** dan perlu diverifikasi admin; tidak ada payment gateway otomatis.
- Ongkir dikonfirmasi melalui WhatsApp admin.
- Pelanggan mengirim file desain asli melalui WhatsApp untuk revisi/konfirmasi akhir; file pratinjau DTF yang diunggah ke checkout tersimpan privat.
- Ulasan pelanggan baru tampil setelah disetujui admin.
- Migration `supabase/migrations/202611250001_showroom_reviews_materials.sql` mencatat tabel ulasan dan bahan awal yang digunakan showroom.
