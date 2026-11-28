import {
  Compass,
  RefreshCw,
  Layers,
  Menu,
  Moon,
  PackageSearch,
  ShoppingBag,
  Sun,
  WifiOff,
  X,
} from 'lucide-react';
import { useState } from 'react';
import sandikaleLogo from '../assets/sandikale-logo.svg';

interface NavbarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  isOnline: boolean;
  showAnnouncement: boolean;
  announcementText: string;
  brandName: string;
  onDismissAnnouncement: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function Navbar({
  activeSection,
  onNavigate,
  cartCount,
  onOpenCart,
  darkMode,
  onToggleDark,
  isOnline,
  showAnnouncement,
  announcementText,
  brandName,
  onDismissAnnouncement,
  onRefresh,
  isRefreshing,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'katalog', label: 'Katalog' },
    { id: 'studio', label: 'Custom DTF' },
    { id: 'lacak', label: 'Lacak' },
    { id: 'tentang', label: 'Tentang' },
  ];

  const handleNav = (id: string) => {
    setMobileMenuOpen(false);
    onNavigate(id);
  };

  return (
    <>
      <div data-site-sticky-header className="sticky top-0 z-40 bg-white dark:bg-[#080808]">
        {showAnnouncement && (
          <div className="h-8 bg-[#7A1F2B] text-white px-4 flex items-center justify-between text-xs font-medium">
            <span className="truncate mx-auto">
              {announcementText}
            </span>
            <button
              type="button"
              onClick={onDismissAnnouncement}
              aria-label="Tutup pengumuman"
              className="shrink-0 p-1 hover:opacity-80 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!isOnline && (
          <div className="h-7 bg-amber-600 text-white px-4 flex items-center justify-center gap-2 text-xs font-medium">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>Mode Offline Aktif — Perubahan &amp; desain custom disimpan lokal dan otomatis tersinkron saat online.</span>
          </div>
        )}

        {/* Strict 3-Zone Top Bar */}
        <header className="h-14 md:h-16 bg-white/95 dark:bg-[#080808]/95 backdrop-blur-md border-b border-black/10 dark:border-white/10">
          <div className="max-w-[1360px] mx-auto h-full px-4 md:px-6 flex items-center justify-between gap-8">
            {/* Zone 1: Brand Wordmark */}
            <button
              type="button"
              onClick={() => handleNav('hero')}
              className="font-display text-2xl md:text-3xl font-extrabold tracking-wider uppercase text-[#080808] dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="flex items-center gap-2.5"><img src={sandikaleLogo} alt="Logo SANDIKALE" className="h-10 md:h-12 w-auto object-contain" /><span>{brandName}</span></span>
            </button>

            {/* Zone 2: 5 Clean Single-Line Nav Links */}
            <nav className="hidden md:flex items-center gap-7 text-xs font-semibold uppercase tracking-widest text-neutral-600 dark:text-neutral-300">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNav(link.id)}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                    activeSection === link.id
                      ? 'border-[#7A1F2B] text-[#080808] dark:text-white'
                      : 'border-transparent hover:text-[#080808] dark:hover:text-white'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* Zone 3: Primary Action Cluster */}
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={onRefresh} aria-label="Muat ulang katalog dan tampilan" title="Muat ulang katalog" disabled={isRefreshing} className="w-9 h-9 flex items-center justify-center rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /></button>

              <button
                type="button"
                onClick={onToggleDark}
                aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
                className="w-9 h-9 flex items-center justify-center rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onOpenCart}
                className="h-9 px-4 rounded-md bg-[#080808] dark:bg-white text-white dark:text-[#080808] hover:bg-[#7A1F2B] dark:hover:bg-[#7A1F2B] dark:hover:text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="tabular-nums">Tas ({cartCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu navigasi"
                className="md:hidden w-10 h-10 flex items-center justify-center rounded-md text-[#080808] dark:text-white cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-[#111111] border-b border-black/10 dark:border-white/10 px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNav(link.id)}
                className="w-full text-left py-2.5 px-3 rounded-md text-sm font-semibold uppercase tracking-wider text-[#080808] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between"
              >
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation (56px height, respects <= 15% mobile sticky cap) */}
      <nav
        aria-label="Navigasi Cepat Ponsel"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-white/95 dark:bg-[#080808]/95 backdrop-blur-md border-t border-black/10 dark:border-white/10 grid grid-cols-4"
      >
        <button
          type="button"
          onClick={() => handleNav('katalog')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeSection === 'katalog' ? 'text-[#7A1F2B]' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Katalog</span>
        </button>
        <button
          type="button"
          onClick={() => handleNav('studio')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeSection === 'studio' ? 'text-[#7A1F2B]' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Studio</span>
        </button>
        <button
          type="button"
          onClick={() => handleNav('lacak')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeSection === 'lacak' ? 'text-[#7A1F2B]' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          <PackageSearch className="w-4 h-4" />
          <span>Lacak</span>
        </button>
        <button
          type="button"
          onClick={onOpenCart}
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400"
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="tabular-nums">Tas ({cartCount})</span>
        </button>
      </nav>
    </>
  );
}
