import { jsPDF } from 'jspdf';
import type { MonthlyRevenuePoint, Order } from '../types';

export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function exportMonthlyReportPdf(params: {
  monthly: MonthlyRevenuePoint[];
  orders: Order[];
  totalRevenue: number;
  customOrdersCount: number;
}) {
  const doc = new jsPDF();
  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('SANDIKALE — LAPORAN PENJUALAN & PRODUKSI DTF', 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(255, 77, 0);
  doc.text(`Dicetak: ${formatDateTime(new Date().toISOString())}`, 14, 24);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(12);
  doc.text('Ringkasan Kinerja Bulan Berjalan', 14, 44);

  doc.setFontSize(10);
  doc.text(`Total Pendapatan Terverifikasi : ${formatRupiah(params.totalRevenue)}`, 14, 52);
  doc.text(`Total Pesanan Aktif & Selesai  : ${params.orders.length} pesanan`, 14, 58);
  doc.text(`Pesanan Custom DTF Studio      : ${params.customOrdersCount} pesanan`, 14, 64);

  doc.setFontSize(12);
  doc.text('Rekap Penjualan Bulanan', 14, 78);

  let y = 86;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Bulan', 14, y);
  doc.text('Total Pendapatan', 50, y);
  doc.text('Pesanan', 110, y);
  doc.text('Porsi Custom DTF', 145, y);
  doc.line(14, y + 2, 196, y + 2);

  y += 9;
  doc.setTextColor(20, 20, 20);
  for (const row of params.monthly) {
    doc.text(row.month, 14, y);
    doc.text(formatRupiah(row.revenue), 50, y);
    doc.text(`${row.orders} order`, 110, y);
    doc.text(`${row.customDtfShare}%`, 145, y);
    y += 7;
  }

  y += 8;
  doc.setFontSize(12);
  doc.text('Daftar Pesanan Terbaru', 14, y);
  y += 8;
  doc.setFontSize(9);

  for (const order of params.orders.slice(0, 12)) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(`${order.id}  |  ${order.customerName}  |  ${order.stage}  |  ${formatRupiah(order.total)}`, 14, y);
    y += 6.5;
  }

  doc.save(`SANDIKALE-Laporan-Penjualan-${new Date().toISOString().slice(0, 10)}.pdf`);
}
