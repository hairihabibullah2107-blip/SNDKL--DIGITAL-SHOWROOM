import { Bug, ChevronLeft, ChevronRight, Compass, HelpCircle, Layers, LogOut, Mail, MessageCircle, PackageSearch, Send, ShoppingBag, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChatMessage, EmailNotification, Order, UserProfile } from '../types';
import { formatDateTime, formatRupiah } from '../utils/format';
import { supabase } from '../lib/supabase';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  user: UserProfile | null;
  token: string | null;
  onAuthSuccess: (user: UserProfile, token: string) => void;
  onLogout: () => void;
  onTrackOrder: (orderId: string) => void;
}

export function AccountModal({
  open,
  onClose,
  user,
  token,
  onAuthSuccess,
  onLogout,
  onTrackOrder,
}: AccountModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [emails, setEmails] = useState<EmailNotification[]>([]);

  useEffect(() => {
    if (open && token) {
      setOrders([]);
      setEmails([]);
    }
  }, [open, token]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim(), phone: phone.trim() } } });
      if (result.error) throw result.error;
      if (!result.data.session || !result.data.user) {
        setErrorMsg('Pendaftaran diterima. Periksa email untuk verifikasi, lalu masuk kembali.');
        return;
      }
      const authUser = result.data.user;
      onAuthSuccess({
        id: authUser.id,
        name: String(authUser.user_metadata?.full_name || name || email.split('@')[0]),
        email: authUser.email || email,
        phone: String(authUser.user_metadata?.phone || phone),
        role: 'customer',
        createdAt: authUser.created_at,
      }, result.data.session.access_token);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Gagal memproses akun.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Akun Pelanggan">
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto bg-white dark:bg-[#121212] text-[#080808] dark:text-white rounded-xl border border-black/10 dark:border-white/10 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-2xl font-bold uppercase">
            <User className="w-5 h-5 text-[#FF4D00]" />
            <span>{user ? 'Akun Pelanggan' : mode === 'login' ? 'Masuk Akun' : 'Daftar Pelanggan'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal akun"
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!user ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-[#1C1C1C]">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 h-8 rounded-md text-xs font-semibold cursor-pointer ${
                  mode === 'login' ? 'bg-white dark:bg-[#080808] shadow-sm' : 'text-neutral-500'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 h-8 rounded-md text-xs font-semibold cursor-pointer ${
                  mode === 'register' ? 'bg-white dark:bg-[#080808] shadow-sm' : 'text-neutral-500'
                }`}
              >
                Daftar Baru
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-500">{errorMsg}</div>
            )}

            {mode === 'register' && (
              <>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                />
                <input
                  type="tel"
                  placeholder="Nomor WhatsApp / HP"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
                />
              </>
            )}

            <input
              type="email"
              required
              placeholder="Alamat Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Kata Sandi (minimal 6 karakter)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
            />
            <button
              type="submit"
              className="w-full h-11 rounded-md bg-[#FF4D00] hover:bg-[#e04400] text-white text-xs font-bold uppercase tracking-widest cursor-pointer"
            >
              {mode === 'login' ? 'Masuk Sekarang' : 'Buat Akun'}
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="p-4 rounded-lg bg-neutral-50 dark:bg-[#1A1A1A] flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">{user.name}</div>
                <div className="text-xs text-neutral-500">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="h-8 px-3 rounded-md border border-black/15 dark:border-white/15 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Keluar
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="font-display text-lg font-bold uppercase">Riwayat Pesanan ({orders.length})</h4>
              {orders.length === 0 ? (
                <p className="text-xs text-neutral-500">Belum ada riwayat pesanan pada akun ini.</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-mono-tabular font-bold">{ord.id}</div>
                        <div className="text-neutral-500">{ord.stage}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="font-mono-tabular font-semibold">{formatRupiah(ord.total)}</div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onTrackOrder(ord.id);
                          }}
                          className="text-[#FF4D00] font-semibold cursor-pointer"
                        >
                          Lacak →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-display text-lg font-bold uppercase flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-[#FF4D00]" />
                <span>Notifikasi Email Produksi ({emails.length})</span>
              </h4>
              {emails.length === 0 ? (
                <p className="text-xs text-neutral-500">Belum ada email notifikasi.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {emails.map((e) => (
                    <div key={e.id} className="p-2.5 rounded bg-neutral-50 dark:bg-[#1A1A1A] text-xs space-y-0.5">
                      <div className="font-semibold">{e.subject}</div>
                      <div className="text-neutral-500">{e.body}</div>
                      <div className="text-[10px] font-mono-tabular text-neutral-400">{formatDateTime(e.sentAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface LiveChatWidgetProps {
  messages: ChatMessage[];
  userName?: string;
  onSendMessage: (text: string, name: string) => Promise<void>;
}

export function LiveChatWidget({ messages, userName, onSendMessage }: LiveChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [senderName, setSenderName] = useState(userName || 'Pengunjung');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onSendMessage(text.trim(), userName || senderName || 'Pelanggan');
    setText('');
  };

  return (
    <div className="fixed bottom-16 md:bottom-5 right-4 z-40">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka Live Chat Pelanggan"
          className="h-11 px-4 rounded-full bg-[#080808] dark:bg-white text-white dark:text-[#080808] hover:bg-[#FF4D00] dark:hover:bg-[#FF4D00] dark:hover:text-white shadow-lg border border-black/15 dark:border-white/15 flex items-center gap-2 text-xs font-semibold transition-colors cursor-pointer"
        >
          <MessageCircle className="w-4 h-4 text-[#FF4D00]" />
          <span>Live Chat</span>
        </button>
      ) : (
        <div className="w-80 sm:w-96 rounded-xl bg-white dark:bg-[#141414] border border-black/15 dark:border-white/15 shadow-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-[#080808] text-white flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">Dukungan Produksi SANDIKALE</div>
              <div className="text-[11px] text-neutral-400">Konsultasi ukuran &amp; file sablon DTF</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup Live Chat"
              className="p-1 hover:text-[#FF4D00] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="h-64 overflow-y-auto p-3 space-y-2 bg-neutral-50 dark:bg-[#0D0D0D]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-2.5 rounded-lg text-xs max-w-[85%] ${
                  m.senderRole === 'customer'
                    ? 'ml-auto bg-[#FF4D00] text-white'
                    : 'bg-white dark:bg-[#1B1B1B] border border-black/10 dark:border-white/10'
                }`}
              >
                <div className="text-[10px] opacity-75 font-semibold mb-0.5">{m.senderName}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="p-2.5 border-t border-black/10 dark:border-white/10 space-y-2">
            {!userName && (
              <input
                type="text"
                placeholder="Nama Anda"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full h-8 px-2.5 rounded text-xs bg-neutral-50 dark:bg-[#1B1B1B] border border-black/10 dark:border-white/10"
              />
            )}
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Tulis pesan..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="flex-1 h-9 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1B1B1B] border border-black/15 dark:border-white/15"
              />
              <button
                type="submit"
                aria-label="Kirim pesan"
                className="w-9 h-9 rounded-md bg-[#FF4D00] text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
  userEmail?: string;
  onSubmitted: () => void;
}

export function BugReportModal({ open, onClose, userEmail, onSubmitted }: BugReportModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [email, setEmail] = useState(userEmail || '');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/bugs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporterEmail: email || userEmail || 'pelanggan@sandikale.id',
        title,
        description,
        severity,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      }),
    });
    if (res.ok) {
      setTitle('');
      setDescription('');
      onSubmitted();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Laporkan Bug">
      <div className="w-full max-w-md bg-white dark:bg-[#121212] text-[#080808] dark:text-white rounded-xl border border-black/10 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-2xl font-bold uppercase">
            <Bug className="w-5 h-5 text-[#FF4D00]" />
            <span>Laporkan Kendala / Bug</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email Anda (opsional)"
            value={email || userEmail || ''}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
          />
          <input
            type="text"
            required
            placeholder="Ringkasan kendala (mis: Gagal unggah PNG di Safari)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
            className="w-full h-10 px-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
          >
            <option value="low">Prioritas Rendah (Tampilan)</option>
            <option value="medium">Prioritas Sedang (Fitur Terhambat)</option>
            <option value="high">Prioritas Tinggi (Gagal Checkout/Upload)</option>
          </select>
          <textarea
            required
            rows={3}
            placeholder="Jelaskan langkah yang terjadi..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 rounded-md text-xs bg-neutral-50 dark:bg-[#1A1A1A] border border-black/15 dark:border-white/15"
          />
          <button
            type="submit"
            className="w-full h-10 rounded-md bg-[#FF4D00] text-white text-xs font-bold uppercase tracking-widest cursor-pointer"
          >
            Kirim Laporan Bug
          </button>
        </form>
      </div>
    </div>
  );
}

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateSection: (section: string) => void;
}

const TUTORIAL_STEPS = [
  {
    title: '1. Pilih Produk & Opsi di Katalog',
    subtitle: 'Semua pilihan warna dan ukuran dimulai dari keadaan kosong',
    description:
      'Jelajahi koleksi Boxy Tee, Regular Tee, Hoodie, dan Longsleeve. Klik bulatan warna yang Anda inginkan lalu pilih ukuran (S–XXL) sebelum menekan Tambah ke Tas.',
    tips: 'Gunakan tombol Lihat Cepat (ikon mata) untuk memeriksa stok per ukuran, estimasi pengiriman, dan ulasan pembeli.',
    targetSection: 'katalog',
    ctaLabel: 'Lihat Katalog Produk',
    Icon: Compass,
  },
  {
    title: '2. Desain Kaos di Custom DTF Studio',
    subtitle: 'Unggah gambar — background dihapus otomatis ala Canva',
    description:
      'Pilih produk dari katalog untuk melihat mockup Depan & Belakang, tentukan bahan kain & warna, lalu pilih zona sablon. Ukuran cetak otomatis menyesuaikan opsi yang dipilih—cukup geser posisinya di kanvas.',
    tips: 'Saat gambar diunggah, background langsung dibuat transparan ala Canva. Anda dapat menggeser sensitivitas pembersihan jika diperlukan.',
    targetSection: 'studio',
    ctaLabel: 'Buka Custom DTF Studio',
    Icon: Layers,
  },
  {
    title: '3. Checkout & Kirim File Desain ke WA Admin',
    subtitle: 'Website berfungsi sebagai gambaran publik sebelum revisi final',
    description:
      'Buka ikon Tas, isi data penerima, pilih ekspedisi & metode yang tersedia. Setelah checkout, klik tombol Kirim ke WhatsApp Admin agar file desain asli Anda bisa direvisi dan dikonfirmasi sebelum cetak.',
    tips: 'Pesanan di atas Rp 500.000 otomatis mendapatkan gratis ongkir!',
    targetSection: 'katalog',
    ctaLabel: 'Mulai Belanja Sekarang',
    Icon: ShoppingBag,
  },
  {
    title: '4. Lacak Produksi Real-Time & Live Chat',
    subtitle: 'Pantau 6 tahap cetak DTF hingga barang tiba',
    description:
      'Masukkan nomor pesanan (misal: SDK-2026-1042) pada bagian Lacak Pesanan untuk melihat progres verifikasi desain, cetak DTF, heat press QC, hingga nomor resi pengiriman.',
    tips: 'Butuh bantuan desain atau stok? Klik tombol Live Chat di pojok kanan bawah untuk terhubung langsung dengan tim produksi.',
    targetSection: 'lacak',
    ctaLabel: 'Coba Lacak Pesanan',
    Icon: PackageSearch,
  },
];

export function TutorialModal({ open, onClose, onNavigateSection }: TutorialModalProps) {
  const [stepIdx, setStepIdx] = useState(0);

  if (!open) return null;

  const current = TUTORIAL_STEPS[stepIdx];
  const StepIcon = current.Icon;
  const isLast = stepIdx === TUTORIAL_STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Panduan Pengunjung Baru SANDIKALE"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#141414] text-[#080808] dark:text-white rounded-xl border border-black/10 dark:border-white/15 overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#FF4D00]">
            <HelpCircle className="w-4 h-4" />
            <span>Panduan Pengunjung Baru ({stepIdx + 1}/{TUTORIAL_STEPS.length})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan"
            className="p-1.5 rounded-md text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Progress steps bar */}
          <div className="grid grid-cols-4 gap-1.5">
            {TUTORIAL_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStepIdx(i)}
                aria-label={`Langkah ${i + 1}`}
                className={`h-1.5 rounded-full transition-colors cursor-pointer ${
                  i <= stepIdx ? 'bg-[#FF4D00]' : 'bg-black/10 dark:bg-white/15'
                }`}
              />
            ))}
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#FF4D00]/12 border border-[#FF4D00]/30 flex items-center justify-center text-[#FF4D00] shrink-0">
              <StepIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tight">{current.title}</h3>
              <p className="text-xs font-medium text-[#FF4D00]">{current.subtitle}</p>
            </div>
          </div>

          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">{current.description}</p>

          <div className="p-3.5 rounded-lg bg-neutral-100 dark:bg-[#1C1C1C] border border-black/5 dark:border-white/5 text-xs text-neutral-600 dark:text-neutral-300">
            <strong className="text-[#080808] dark:text-white">Tips: </strong>
            {current.tips}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateSection(current.targetSection);
              }}
              className="text-xs font-semibold text-[#FF4D00] hover:underline cursor-pointer"
            >
              {current.ctaLabel} →
            </button>

            <div className="flex items-center gap-2">
              {stepIdx > 0 ? (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                  className="h-9 px-3 rounded-md border border-black/15 dark:border-white/15 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Kembali</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-3 rounded-md text-xs text-neutral-500 hover:text-[#080808] dark:hover:text-white cursor-pointer"
                >
                  Lewati
                </button>
              )}

              {!isLast ? (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1))}
                  className="h-9 px-4 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] hover:bg-[#FF4D00] dark:hover:bg-[#FF4D00] dark:hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Lanjut</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-md bg-[#FF4D00] hover:bg-[#e04400] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Mulai Jelajahi
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

