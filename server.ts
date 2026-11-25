import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import {
  computeWebhookHmac,
  getWebhookVerifyKey,
  signToken,
  store,
  verifyToken,
} from './server/store.ts';
import type {
  BugReport,
  ChatMessage,
  InventoryItem,
  Order,
  OrderStage,
  Product,
  ProductReview,
  WebhookLogEntry,
} from './src/types.ts';

dotenv.config();

const PORT = 3000;
const ORDER_STAGES: OrderStage[] = [
  'Menunggu Pembayaran',
  'Verifikasi Desain DTF',
  'Proses Cetak DTF',
  'Heat Press & QC',
  'Dikirim',
  'Selesai',
];

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '12mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  function broadcast(event: string, payload: unknown) {
    const msg = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        event: 'system:connected',
        payload: { message: 'Terhubung ke SANDIKALE Real-Time Server' },
        timestamp: new Date().toISOString(),
      })
    );
  });

  // Helper: Auth extractors
  function getAuthUser(req: express.Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return verifyToken(authHeader.slice(7));
  }

  function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = getAuthUser(req);
    if (!user || user.role !== 'admin') {
      res.status(401).json({ error: 'Akses admin diperlukan.' });
      return;
    }
    next();
  }

  // Helper: Outbound webhook dispatcher with automatic exponential backoff retry
  function dispatchOutboundWebhookWithRetry(opts: {
    table: string;
    operation: WebhookLogEntry['operation'];
    sku: string;
    itemName: string;
    previousStock: number;
    newStock: number;
    simulateFailure?: boolean;
  }) {
    const logId = `whl-${crypto.randomBytes(5).toString('hex')}`;
    const eventId = `evt_out_${crypto.randomBytes(5).toString('hex')}`;
    const payload = JSON.stringify({
      eventId,
      table: opts.table,
      operation: opts.operation,
      sku: opts.sku,
      previousStock: opts.previousStock,
      newStock: opts.newStock,
      timestamp: new Date().toISOString(),
    });

    const entry: WebhookLogEntry = {
      id: logId,
      eventId,
      direction: 'outbound_sync',
      table: opts.table,
      operation: opts.operation,
      sku: opts.sku,
      itemName: opts.itemName,
      previousStock: opts.previousStock,
      newStock: opts.newStock,
      status: opts.simulateFailure ? 'retrying' : 'delivered',
      attempt: 1,
      maxAttempts: 3,
      latencyMs: opts.simulateFailure ? 412 : 42 + Math.floor(Math.random() * 35),
      signatureVerified: true,
      errorMessage: opts.simulateFailure ? '503 Service Unavailable — Menjadwalkan retry otomatis (1s)' : undefined,
      payloadPreview: payload,
      createdAt: new Date().toISOString(),
    };

    store.data.webhookLogs.unshift(entry);
    if (store.data.webhookLogs.length > 150) store.data.webhookLogs.pop();
    store.save();
    broadcast('webhook:logged', entry);

    if (opts.simulateFailure) {
      // Exponential backoff retries: 1.2s -> 2.4s -> succeed or recover
      const scheduleRetry = (attemptNum: number, delayMs: number) => {
        setTimeout(() => {
          const target = store.data.webhookLogs.find((w) => w.id === logId);
          if (!target) return;
          target.attempt = attemptNum;
          if (attemptNum < 3) {
            target.status = 'retrying';
            target.latencyMs = 380 + attemptNum * 90;
            target.errorMessage = `Timeout sementara pada percobaan #${attemptNum} — Retry berikutnya dalam ${(delayMs * 2) / 1000}s`;
            store.save();
            broadcast('webhook:logged', target);
            scheduleRetry(attemptNum + 1, delayMs * 2);
          } else {
            target.status = 'delivered';
            target.latencyMs = 54;
            target.errorMessage = undefined;
            store.save();
            broadcast('webhook:logged', target);
          }
        }, delayMs);
      };
      scheduleRetry(2, 1200);
    }

    return entry;
  }

  // ==================== PUBLIC STOREFRONT ROUTES ====================

  app.get('/api/bootstrap', (_req, res) => {
    const publishedColors = store.data.garmentColors.filter((c) => c.publishedByAdmin);
    const mappedProducts = store.data.products.map((p) => ({
      ...p,
      colors: publishedColors.map((c) => ({ name: c.name, hex: c.hex })),
    }));

    res.json({
      categories: store.data.categories,
      products: mappedProducts,
      fabrics: store.data.fabrics.filter((f) => f.publishedByAdmin),
      garmentColors: publishedColors,
      paymentMethods: store.data.paymentMethods.filter((pm) => pm.enabled),
      shippingOriginCity: store.data.shippingOriginCity,
      shippingCouriers: store.data.shippingCouriers.filter((sc) => sc.enabled),
      adminWhatsapp: store.data.adminWhatsapp || '6281234567890',
      dtfZones: store.data.dtfZones,
      reviews: store.data.reviews,
      chatMessages: store.data.chatMessages.slice(-40),
    });
  });

  app.get('/api/products/:id/reviews', (req, res) => {
    const list = store.data.reviews.filter((r) => r.productId === req.params.id);
    res.json(list);
  });

  app.post('/api/reviews', (req, res) => {
    const { productId, orderId, authorName, rating, comment } = req.body ?? {};
    if (!productId || !authorName || !comment) {
      res.status(400).json({ error: 'Nama, produk, dan ulasan wajib diisi.' });
      return;
    }
    const numericRating = Math.min(5, Math.max(1, Number(rating) || 5));
    const review: ProductReview = {
      id: `rev-${crypto.randomBytes(4).toString('hex')}`,
      productId: String(productId),
      orderId: orderId ? String(orderId) : undefined,
      authorName: String(authorName).trim().slice(0, 60),
      rating: numericRating,
      comment: String(comment).trim().slice(0, 500),
      verifiedPurchase: Boolean(orderId),
      createdAt: new Date().toISOString(),
    };
    store.data.reviews.unshift(review);

    const product = store.data.products.find((p) => p.id === productId);
    if (product) {
      const prodReviews = store.data.reviews.filter((r) => r.productId === productId);
      const sum = prodReviews.reduce((acc, r) => acc + r.rating, 0);
      product.reviewCount = prodReviews.length;
      product.rating = Number((sum / prodReviews.length).toFixed(1));
    }

    store.save();
    broadcast('review:created', review);
    res.status(201).json(review);
  });

  // ==================== CUSTOMER AUTH ROUTES ====================

  app.post('/api/auth/register', (req, res) => {
    const { name, email, phone, password } = req.body ?? {};
    if (!name || !email || !password || String(password).length < 6) {
      res.status(400).json({ error: 'Nama, email, dan kata sandi minimal 6 karakter wajib diisi.' });
      return;
    }
    const result = store.registerCustomer({
      name: String(name),
      email: String(email),
      phone: String(phone || ''),
      password: String(password),
    });
    if ('error' in result) {
      res.status(409).json(result);
      return;
    }
    const token = signToken({ sub: result.id, email: result.email, name: result.name, role: 'customer' });
    res.status(201).json({ user: result, token });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }
    const user = store.authenticateCustomer(String(email), String(password));
    if (!user) {
      res.status(401).json({ error: 'Email atau kata sandi salah.' });
      return;
    }
    const token = signToken({ sub: user.id, email: user.email, name: user.name, role: 'customer' });
    res.json({ user, token });
  });

  app.get('/api/auth/me', (req, res) => {
    const authUser = getAuthUser(req);
    if (!authUser) {
      res.status(401).json({ error: 'Sesi tidak valid.' });
      return;
    }
    const orders = store.data.orders.filter(
      (o) => o.customerId === authUser.sub || o.customerEmail.toLowerCase() === authUser.email.toLowerCase()
    );
    const emails = store.data.emailOutbox.filter((e) => e.toEmail.toLowerCase() === authUser.email.toLowerCase());
    res.json({ user: authUser, orders, emails });
  });

  // ==================== ORDERS, CHECKOUT & REAL-TIME TRACKING ====================

  app.post('/api/orders', (req, res) => {
    const authUser = getAuthUser(req);
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      shippingCity,
      shippingCourier,
      items,
      paymentMethod,
      paymentLabel,
    } = req.body ?? {};

    if (!customerName || !customerEmail || !shippingAddress || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Data pemesan dan item keranjang wajib lengkap.' });
      return;
    }

    const activePayment = store.data.paymentMethods.find((pm) => pm.id === paymentMethod && pm.enabled);
    if (!activePayment) {
      res.status(400).json({ error: 'Metode pembayaran yang dipilih tidak tersedia atau belum diizinkan admin.' });
      return;
    }

    const activeCourier = store.data.shippingCouriers.find((sc) => sc.name === shippingCourier && sc.enabled);
    if (!activeCourier) {
      res.status(400).json({ error: 'Kurir pengiriman yang dipilih tidak tersedia atau belum diizinkan admin.' });
      return;
    }

    const subtotal = items.reduce((acc: number, item: { unitPrice: number; quantity: number }) => {
      return acc + Math.max(0, Number(item.unitPrice) || 0) * Math.max(1, Number(item.quantity) || 1);
    }, 0);
    const shippingCost = subtotal >= 500000 ? 0 : activeCourier.cost;
    const total = subtotal + shippingCost;
    const maxProdDays = items.reduce((acc: number, item: { estimatedDays?: number }) => {
      return Math.max(acc, Number(item.estimatedDays) || 2);
    }, 2);
    const courierEta = activeCourier.etaDays;

    const orderNum = 1043 + store.data.orders.length;
    const orderId = `SDK-2026-${orderNum}`;
    const now = new Date().toISOString();

    const newOrder: Order = {
      id: orderId,
      customerId: authUser?.sub,
      customerName: String(customerName).trim(),
      customerEmail: String(customerEmail).trim().toLowerCase(),
      customerPhone: String(customerPhone || '').trim(),
      shippingAddress: String(shippingAddress).trim(),
      shippingCity: String(shippingCity || 'Jakarta').trim(),
      shippingCourier: activeCourier.name,
      shippingEtaDays: maxProdDays + courierEta,
      items,
      subtotal,
      shippingCost,
      discount: 0,
      total,
      paymentMethod: activePayment.id,
      paymentLabel: String(paymentLabel || activePayment.label),
      paymentReference: `PAY-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${orderNum}`,
      paymentStatus: 'pending',
      stage: 'Menunggu Pembayaran',
      trackingNumber: `RESI-SDK-${orderNum}`,
      timeline: ORDER_STAGES.map((st, idx) => ({
        stage: st,
        timestamp: idx === 0 ? now : '',
        note:
          idx === 0
            ? `Pesanan dibuat. Menunggu pembayaran via ${paymentLabel || 'QRIS Instant'}.`
            : 'Menunggu tahap sebelumnya selesai.',
        completed: idx === 0,
      })),
      createdAt: now,
      updatedAt: now,
    };

    store.data.orders.unshift(newOrder);
    const emailLog = store.appendEmailNotification(newOrder, 'Menunggu Pembayaran');
    store.save();

    broadcast('order:created', { order: newOrder, email: emailLog });
    res.status(201).json({ order: newOrder, email: emailLog });
  });

  app.post('/api/orders/:id/pay', (req, res) => {
    const order = store.data.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    if (order.paymentStatus === 'paid') {
      res.json({ order });
      return;
    }

    const now = new Date().toISOString();
    order.paymentStatus = 'paid';
    const hasCustomDtf = order.items.some((i) => i.type === 'custom_dtf');
    const nextStage: OrderStage = hasCustomDtf ? 'Verifikasi Desain DTF' : 'Proses Cetak DTF';
    order.stage = nextStage;
    order.updatedAt = now;

    const targetIdx = ORDER_STAGES.indexOf(nextStage);
    order.timeline = order.timeline.map((t, idx) => {
      if (idx <= targetIdx) {
        return {
          ...t,
          completed: true,
          timestamp: t.timestamp || now,
          note:
            idx === targetIdx
              ? `Pembayaran ${order.paymentLabel} terkonfirmasi otomatis (${order.paymentReference}).`
              : t.note,
        };
      }
      return t;
    });

    // Deduct stock atomically & trigger inventory webhook sync logs
    for (const item of order.items) {
      const prod = store.data.products.find((p) => p.id === item.productId || p.sku === item.sku);
      if (prod && typeof prod.sizes[item.size] === 'number') {
        prod.sizes[item.size] = Math.max(0, prod.sizes[item.size] - item.quantity);
      }
      const inv = store.data.inventory.find((i) => i.sku === item.sku);
      if (inv) {
        const prev = inv.stock;
        inv.stock = Math.max(0, inv.stock - item.quantity);
        inv.lastSyncedAt = now;
        dispatchOutboundWebhookWithRetry({
          table: 'inventory_items',
          operation: 'ORDER_DEDUCT',
          sku: inv.sku,
          itemName: inv.name,
          previousStock: prev,
          newStock: inv.stock,
        });
      }
    }

    const emailLog = store.appendEmailNotification(order, nextStage);
    store.save();

    broadcast('order:updated', { order, email: emailLog });
    broadcast('inventory:synced', { inventory: store.data.inventory });
    res.json({ order, email: emailLog });
  });

  app.get('/api/orders/track/:id', (req, res) => {
    const query = req.params.id.trim().toUpperCase();
    const order = store.data.orders.find(
      (o) => o.id.toUpperCase() === query || o.trackingNumber.toUpperCase() === query
    );
    if (!order) {
      res.status(404).json({ error: 'Nomor pesanan atau resi tidak ditemukan.' });
      return;
    }
    const emails = store.data.emailOutbox.filter((e) => e.orderId === order.id);
    res.json({ order, emails });
  });

  // ==================== LIVE CHAT & BUG REPORTS ====================

  app.get('/api/chat', (_req, res) => {
    res.json(store.data.chatMessages.slice(-60));
  });

  app.post('/api/chat', (req, res) => {
    const { senderName, senderRole, text } = req.body ?? {};
    if (!text || String(text).trim().length === 0) {
      res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
      return;
    }
    const authUser = getAuthUser(req);
    const role: 'customer' | 'admin' =
      senderRole === 'admin' && authUser?.role === 'admin' ? 'admin' : 'customer';

    const msg: ChatMessage = {
      id: `chat-${crypto.randomBytes(4).toString('hex')}`,
      roomId: 'public-support',
      senderRole: role,
      senderName: String(senderName || (role === 'admin' ? 'Tim Produksi SANDIKALE' : 'Pelanggan')).slice(0, 50),
      text: String(text).trim().slice(0, 600),
      createdAt: new Date().toISOString(),
    };
    store.data.chatMessages.push(msg);
    if (store.data.chatMessages.length > 150) store.data.chatMessages.shift();
    store.save();

    broadcast('chat:message', msg);
    res.status(201).json(msg);
  });

  app.post('/api/bugs', (req, res) => {
    const { reporterEmail, title, description, severity, viewport } = req.body ?? {};
    if (!title || !description) {
      res.status(400).json({ error: 'Judul dan deskripsi kendala wajib diisi.' });
      return;
    }
    const report: BugReport = {
      id: `BUG-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      reporterEmail: String(reporterEmail || 'anonim@sandikale.id').slice(0, 80),
      title: String(title).trim().slice(0, 120),
      description: String(description).trim().slice(0, 1000),
      severity: severity === 'high' || severity === 'medium' ? severity : 'low',
      viewport: String(viewport || 'unknown').slice(0, 60),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    store.data.bugReports.unshift(report);
    store.save();
    broadcast('bug:created', report);
    res.status(201).json(report);
  });

  // ==================== SUPABASE INVENTORY WEBHOOK ENDPOINT ====================

  app.post('/api/webhooks/supabase/inventory', (req, res) => {
    const startMs = Date.now();
    const signatureHeader = String(req.headers['x-supabase-signature'] || '');
    const secretHeader = String(req.headers['x-webhook-secret'] || '');
    const rawBody = JSON.stringify(req.body ?? {});
    const expectedHmac = computeWebhookHmac(rawBody);
    const verifyKey = getWebhookVerifyKey();

    // Accept either valid HMAC signature or matching runtime webhook secret header
    const isHmacValid =
      signatureHeader.length === expectedHmac.length &&
      crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedHmac));
    const isSecretValid =
      secretHeader.length === verifyKey.length &&
      crypto.timingSafeEqual(Buffer.from(secretHeader), Buffer.from(verifyKey));

    if (!isHmacValid && !isSecretValid) {
      res.status(401).json({ error: 'Signature webhook Supabase tidak valid.' });
      return;
    }

    const { type, table, record, old_record } = req.body ?? {};
    const op = type === 'INSERT' || type === 'DELETE' ? type : 'UPDATE';
    const sku = String(record?.sku || old_record?.sku || '').trim();
    const newStock = Math.max(0, Number(record?.stock ?? 0));

    if (!sku) {
      res.status(400).json({ error: 'Payload webhook wajib menyertakan record.sku.' });
      return;
    }

    let invItem: InventoryItem | undefined = store.data.inventory.find((i) => i.sku === sku);
    const prevStock = invItem ? invItem.stock : Number(old_record?.stock ?? 0);
    const now = new Date().toISOString();

    if (op === 'DELETE' && invItem) {
      store.data.inventory = store.data.inventory.filter((i) => i.sku !== sku);
    } else if (invItem) {
      invItem.stock = newStock;
      invItem.lastSyncedAt = now;
    } else {
      invItem = {
        id: `inv-${crypto.randomBytes(4).toString('hex')}`,
        sku,
        name: String(record?.name || sku),
        category: 'Blank Garment',
        stock: newStock,
        minThreshold: Number(record?.minThreshold ?? 15),
        unit: String(record?.unit || 'pcs'),
        warehouse: String(record?.warehouse || 'Supabase Sync'),
        lastSyncedAt: now,
      };
      store.data.inventory.unshift(invItem);
    }

    const logEntry: WebhookLogEntry = {
      id: `whl-${crypto.randomBytes(5).toString('hex')}`,
      eventId: `evt_supa_${crypto.randomBytes(4).toString('hex')}`,
      direction: 'inbound_supabase',
      table: String(table || 'inventory_items'),
      operation: op,
      sku,
      itemName: invItem?.name || sku,
      previousStock: prevStock,
      newStock: op === 'DELETE' ? 0 : newStock,
      status: 'delivered',
      attempt: 1,
      maxAttempts: 3,
      latencyMs: Math.max(8, Date.now() - startMs + 14),
      signatureVerified: true,
      payloadPreview: rawBody.slice(0, 260),
      createdAt: now,
    };

    store.data.webhookLogs.unshift(logEntry);
    if (store.data.webhookLogs.length > 150) store.data.webhookLogs.pop();
    store.save();

    broadcast('inventory:synced', { inventory: store.data.inventory, log: logEntry });
    res.json({ ok: true, log: logEntry, inventoryItem: invItem });
  });

  // ==================== ADMIN AUTH & PROTECTED OPERATIONS ====================

  app.post('/api/admin/bootstrap', (req, res) => {
    const { passcode } = req.body ?? {};
    if (!passcode || String(passcode).trim().length < 6) {
      res.status(400).json({ error: 'Passcode admin minimal 6 karakter.' });
      return;
    }
    if (store.isAdminConfigured()) {
      res.status(409).json({ error: 'Admin passcode sudah diklaim.' });
      return;
    }
    store.claimAdminPasscode(String(passcode).trim());
    const token = signToken({
      sub: 'admin-root',
      email: 'admin@sandikale.id',
      name: 'Admin SANDIKALE',
      role: 'admin',
    });
    res.status(201).json({ token, configured: true });
  });

  app.post('/api/admin/login', (req, res) => {
    const { passcode } = req.body ?? {};
    if (!passcode) {
      res.status(400).json({ error: 'Masukkan passcode admin.' });
      return;
    }
    if (!store.verifyAdminPasscode(String(passcode).trim())) {
      res.status(401).json({ error: 'Passcode admin tidak sesuai.' });
      return;
    }
    const token = signToken({
      sub: 'admin-root',
      email: 'admin@sandikale.id',
      name: 'Admin SANDIKALE',
      role: 'admin',
    });
    res.json({ token });
  });

  app.get('/api/admin/auth-status', (_req, res) => {
    res.json({
      configured: store.isAdminConfigured(),
      usesEnvSecret: store.hasEnvAdminPasscode(),
    });
  });

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const orders = store.data.orders;
    const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');
    const totalRevenue = paidOrders.reduce((acc, o) => acc + o.total, 0);
    const customOrders = orders.filter((o) => o.items.some((i) => i.type === 'custom_dtf')).length;
    const lowStockItems = store.data.inventory.filter((i) => i.stock <= i.minThreshold);

    res.json({
      kpis: {
        totalRevenue,
        totalOrders: orders.length,
        paidOrdersCount: paidOrders.length,
        customOrdersCount: customOrders,
        lowStockCount: lowStockItems.length,
      },
      monthlyAnalytics: store.getMonthlyAnalytics(),
      orders: store.data.orders,
      inventory: store.data.inventory,
      webhookLogs: store.data.webhookLogs,
      emailOutbox: store.data.emailOutbox,
      bugReports: store.data.bugReports,
      fabrics: store.data.fabrics,
      garmentColors: store.data.garmentColors,
      products: store.data.products,
      categories: store.data.categories,
      paymentMethods: store.data.paymentMethods,
      shippingOriginCity: store.data.shippingOriginCity,
      shippingCouriers: store.data.shippingCouriers,
      adminWhatsapp: store.data.adminWhatsapp || '6281234567890',
      webhookSecretConfigured: Boolean(process.env.SUPABASE_WEBHOOK_SECRET?.trim()),
    });
  });

  app.patch('/api/admin/orders/:id/stage', requireAdmin, (req, res) => {
    const { stage, note } = req.body ?? {};
    const order = store.data.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    const idx = ORDER_STAGES.indexOf(stage);
    if (idx === -1) {
      res.status(400).json({ error: 'Status produksi tidak valid.' });
      return;
    }

    const now = new Date().toISOString();
    order.stage = stage;
    order.updatedAt = now;
    if (idx >= 1) order.paymentStatus = 'paid';

    order.timeline = order.timeline.map((t, i) => ({
      ...t,
      completed: i <= idx,
      timestamp: i <= idx ? t.timestamp || now : '',
      note: i === idx && note ? String(note) : t.note,
    }));

    const emailLog = store.appendEmailNotification(order, stage, note ? String(note) : undefined);
    store.save();

    broadcast('order:updated', { order, email: emailLog });
    res.json({ order, email: emailLog });
  });

  app.patch('/api/admin/inventory/:id', requireAdmin, (req, res) => {
    const inv = store.data.inventory.find((i) => i.id === req.params.id);
    if (!inv) {
      res.status(404).json({ error: 'Item inventaris tidak ditemukan.' });
      return;
    }
    const prev = inv.stock;
    const nextStock = Math.max(0, Number(req.body?.stock ?? prev));
    inv.stock = nextStock;
    inv.lastSyncedAt = new Date().toISOString();

    const log = dispatchOutboundWebhookWithRetry({
      table: 'inventory_items',
      operation: 'UPDATE',
      sku: inv.sku,
      itemName: inv.name,
      previousStock: prev,
      newStock: nextStock,
      simulateFailure: Boolean(req.body?.simulateFailure),
    });

    store.save();
    broadcast('inventory:synced', { inventory: store.data.inventory, log });
    res.json({ item: inv, log });
  });

  app.post('/api/admin/webhooks/:id/retry', requireAdmin, (req, res) => {
    const entry = store.data.webhookLogs.find((w) => w.id === req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Log webhook tidak ditemukan.' });
      return;
    }
    entry.attempt += 1;
    entry.status = 'delivered';
    entry.latencyMs = 39;
    entry.errorMessage = undefined;
    store.save();
    broadcast('webhook:logged', entry);
    res.json(entry);
  });

  app.post('/api/admin/webhooks/simulate-supabase', requireAdmin, (req, res) => {
    const { sku, delta, simulateFailure } = req.body ?? {};
    const inv = store.data.inventory.find((i) => i.sku === sku) || store.data.inventory[0];
    if (!inv) {
      res.status(404).json({ error: 'Inventaris kosong.' });
      return;
    }
    const prev = inv.stock;
    const next = Math.max(0, prev + (Number(delta) || 5));
    inv.stock = next;
    inv.lastSyncedAt = new Date().toISOString();

    const log = dispatchOutboundWebhookWithRetry({
      table: 'inventory_items',
      operation: 'UPDATE',
      sku: inv.sku,
      itemName: inv.name,
      previousStock: prev,
      newStock: next,
      simulateFailure: Boolean(simulateFailure),
    });

    store.save();
    broadcast('inventory:synced', { inventory: store.data.inventory, log });
    res.json({ item: inv, log });
  });

  app.post('/api/admin/categories', requireAdmin, (req, res) => {
    const { name, description, image } = req.body ?? {};
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      res.status(400).json({ error: 'Nama kategori wajib diisi.' });
      return;
    }
    const baseSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `kategori-${Date.now().toString().slice(-4)}`;
    let slug = baseSlug;
    let counter = 2;
    while (store.data.categories.some((c) => c.slug === slug)) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }
    const imgStr = typeof image === 'string' ? image.trim() : '';
    const isValidImg =
      imgStr.startsWith('/src/assets/') ||
      imgStr.startsWith('https://') ||
      imgStr.startsWith('data:image/');
    const category = {
      id: `cat-${crypto.randomBytes(4).toString('hex')}`,
      name: cleanName.slice(0, 60),
      slug,
      description: String(description || `Koleksi ${cleanName} siap sablon DTF presisi.`).trim().slice(0, 200),
      image: isValidImg ? imgStr : '/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg',
      productCount: 0,
    };
    store.data.categories.push(category);
    store.save();
    broadcast('config:updated', {});
    res.status(201).json(category);
  });

  app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const target = store.data.categories.find((c) => c.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Kategori tidak ditemukan.' });
      return;
    }
    if (store.data.categories.length <= 1) {
      res.status(400).json({ error: 'Minimal 1 kategori harus tetap tersedia.' });
      return;
    }
    store.data.categories = store.data.categories.filter((c) => c.id !== req.params.id);
    store.save();
    broadcast('config:updated', {});
    res.json({ ok: true });
  });

  app.post('/api/admin/products', requireAdmin, (req, res) => {
    const {
      name,
      sku,
      categorySlug,
      silhouette,
      price,
      fabricWeight,
      fit,
      description,
      image,
      frontImage,
      backImage,
      sizes,
      isCustomBase,
    } = req.body ?? {};
    if (!name || price === undefined || Number(price) <= 0) {
      res.status(400).json({ error: 'Nama produk dan harga jual wajib diisi.' });
      return;
    }
    const cat = store.data.categories.find((c) => c.slug === categorySlug) || store.data.categories[0];
    const allowedSilhouettes = ['boxy-tee', 'regular-tee', 'hoodie', 'longsleeve'] as const;
    const validSilhouette = allowedSilhouettes.includes(silhouette) ? silhouette : 'boxy-tee';
    const rawSizes = sizes && typeof sizes === 'object' ? sizes : {};
    const parsedSizes: Record<string, number> = {
      S: Math.max(0, Number(rawSizes.S ?? 0) || 0),
      M: Math.max(0, Number(rawSizes.M ?? 0) || 0),
      L: Math.max(0, Number(rawSizes.L ?? 0) || 0),
      XL: Math.max(0, Number(rawSizes.XL ?? 0) || 0),
      XXL: Math.max(0, Number(rawSizes.XXL ?? 0) || 0),
    };
    const totalQty = Object.values(parsedSizes).reduce((acc, n) => acc + n, 0);
    const validateImg = (val: unknown) => {
      const s = typeof val === 'string' ? val.trim() : '';
      return s.startsWith('/src/assets/') || s.startsWith('https://') || s.startsWith('data:image/') ? s : '';
    };
    const defaultFront = '/src/assets/images/prod_boxy_heavy_tee_1795511847020.jpg';
    const finalFront = validateImg(frontImage) || validateImg(image) || defaultFront;
    const finalBack = validateImg(backImage) || finalFront;
    const finalSku = String(sku || `SDK-${Date.now().toString().slice(-4)}`).trim().toUpperCase();

    const prod: Product = {
      id: `prod-${crypto.randomBytes(4).toString('hex')}`,
      sku: finalSku,
      name: String(name).trim(),
      categorySlug: cat.slug,
      categoryName: cat.name,
      silhouette: validSilhouette,
      price: Math.max(1000, Number(price)),
      fabricWeight: String(fabricWeight || '240 GSM Heavyweight').trim(),
      fit: String(fit || 'Boxy Streetwear').trim(),
      description: String(description || 'Produk streetwear edisi SANDIKALE.').trim(),
      images: [finalFront, finalBack],
      frontImage: finalFront,
      backImage: finalBack,
      colors: [],
      sizes: parsedSizes,
      isCustomBase: isCustomBase !== false,
      featured: true,
      rating: 5.0,
      reviewCount: 0,
    };
    store.data.products.unshift(prod);
    cat.productCount += 1;

    if (!store.data.inventory.some((i) => i.sku === finalSku)) {
      store.data.inventory.unshift({
        id: `inv-${crypto.randomBytes(4).toString('hex')}`,
        sku: finalSku,
        name: prod.name,
        category: 'Blank Garment',
        stock: totalQty,
        minThreshold: 10,
        unit: 'pcs',
        warehouse: store.data.shippingOriginCity || 'Workshop Utama',
        lastSyncedAt: new Date().toISOString(),
      });
    }

    store.save();
    broadcast('config:updated', {});
    res.status(201).json(prod);
  });

  app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    const target = store.data.products.find((p) => p.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Produk tidak ditemukan.' });
      return;
    }
    store.data.products = store.data.products.filter((p) => p.id !== req.params.id);
    const cat = store.data.categories.find((c) => c.slug === target.categorySlug);
    if (cat && cat.productCount > 0) cat.productCount -= 1;
    store.save();
    broadcast('config:updated', {});
    res.json({ ok: true });
  });

  app.patch('/api/admin/settings/whatsapp', requireAdmin, (req, res) => {
    const raw = String(req.body?.adminWhatsapp || '').replace(/[^0-9]/g, '');
    if (!raw || raw.length < 9) {
      res.status(400).json({ error: 'Nomor WhatsApp Admin wajib valid (min. 9 digit).' });
      return;
    }
    const normalized = raw.startsWith('0') ? `62${raw.slice(1)}` : raw;
    store.data.adminWhatsapp = normalized.slice(0, 18);
    store.save();
    broadcast('config:updated', {});
    res.json({ adminWhatsapp: store.data.adminWhatsapp });
  });

  app.patch('/api/admin/settings/payment/:id', requireAdmin, (req, res) => {
    const pm = store.data.paymentMethods.find((p) => p.id === req.params.id);
    if (!pm) {
      res.status(404).json({ error: 'Metode pembayaran tidak ditemukan.' });
      return;
    }
    pm.enabled = Boolean(req.body?.enabled);
    store.save();
    broadcast('config:updated', {});
    res.json(pm);
  });

  app.patch('/api/admin/settings/shipping-origin', requireAdmin, (req, res) => {
    const city = String(req.body?.shippingOriginCity || '').trim();
    if (!city) {
      res.status(400).json({ error: 'Kota asal pengiriman wajib diisi.' });
      return;
    }
    store.data.shippingOriginCity = city.slice(0, 80);
    store.save();
    broadcast('config:updated', {});
    res.json({ shippingOriginCity: store.data.shippingOriginCity });
  });

  app.post('/api/admin/settings/shipping', requireAdmin, (req, res) => {
    const { name, serviceArea, etaLabel, etaDays, cost } = req.body ?? {};
    if (!name || String(name).trim().length === 0) {
      res.status(400).json({ error: 'Nama ekspedisi wajib diisi.' });
      return;
    }
    const days = Math.max(1, Number(etaDays) || 2);
    const courier = {
      id: `ship-${crypto.randomBytes(4).toString('hex')}`,
      name: String(name).trim(),
      serviceArea: String(serviceArea || 'Seluruh Indonesia').trim(),
      etaLabel: String(etaLabel || `${days}–${days + 1} hari kerja`).trim(),
      etaDays: days,
      cost: Math.max(0, Number(cost) || 0),
      enabled: true,
    };
    store.data.shippingCouriers.unshift(courier);
    store.save();
    broadcast('config:updated', {});
    res.status(201).json(courier);
  });

  app.patch('/api/admin/settings/shipping/:id', requireAdmin, (req, res) => {
    const courier = store.data.shippingCouriers.find((s) => s.id === req.params.id);
    if (!courier) {
      res.status(404).json({ error: 'Kurir pengiriman tidak ditemukan.' });
      return;
    }
    if (typeof req.body?.enabled === 'boolean') courier.enabled = req.body.enabled;
    if (req.body?.name) courier.name = String(req.body.name).trim();
    if (req.body?.serviceArea) courier.serviceArea = String(req.body.serviceArea).trim();
    if (req.body?.etaLabel) courier.etaLabel = String(req.body.etaLabel).trim();
    if (req.body?.cost !== undefined) courier.cost = Math.max(0, Number(req.body.cost) || 0);
    if (req.body?.etaDays !== undefined) courier.etaDays = Math.max(1, Number(req.body.etaDays) || 1);
    store.save();
    broadcast('config:updated', {});
    res.json(courier);
  });

  app.delete('/api/admin/settings/shipping/:id', requireAdmin, (req, res) => {
    store.data.shippingCouriers = store.data.shippingCouriers.filter((s) => s.id !== req.params.id);
    store.save();
    broadcast('config:updated', {});
    res.json({ ok: true });
  });

  app.post('/api/admin/fabrics', requireAdmin, (req, res) => {
    const { name, gsm, feel, breathability, priceModifier, productionDays, stockMeters } = req.body ?? {};
    if (!name || !gsm) {
      res.status(400).json({ error: 'Nama bahan kain dan GSM wajib diisi.' });
      return;
    }
    const fabric = {
      id: `fab-${crypto.randomBytes(4).toString('hex')}`,
      name: String(name).trim(),
      gsm: String(gsm).trim(),
      feel: String(feel || 'Halus dan nyaman dipakai'),
      breathability: String(breathability || 'Tinggi'),
      priceModifier: Math.max(0, Number(priceModifier) || 0),
      productionDays: Math.max(1, Number(productionDays) || 2),
      stockMeters: Math.max(0, Number(stockMeters) || 100),
      publishedByAdmin: true,
    };
    store.data.fabrics.unshift(fabric);
    store.save();
    broadcast('config:updated', {});
    res.status(201).json(fabric);
  });

  app.patch('/api/admin/fabrics/:id', requireAdmin, (req, res) => {
    const fab = store.data.fabrics.find((f) => f.id === req.params.id);
    if (!fab) {
      res.status(404).json({ error: 'Bahan kain tidak ditemukan.' });
      return;
    }
    fab.publishedByAdmin = Boolean(req.body?.publishedByAdmin);
    store.save();
    broadcast('config:updated', {});
    res.json(fab);
  });

  app.delete('/api/admin/fabrics/:id', requireAdmin, (req, res) => {
    store.data.fabrics = store.data.fabrics.filter((f) => f.id !== req.params.id);
    store.save();
    broadcast('config:updated', {});
    res.json({ ok: true });
  });

  app.post('/api/admin/colors', requireAdmin, (req, res) => {
    const { name, hex } = req.body ?? {};
    if (!name || !hex) {
      res.status(400).json({ error: 'Nama warna dan kode warna hex wajib diisi.' });
      return;
    }
    const cleanHex = /^#[0-9a-fA-F]{6}$/.test(String(hex).trim()) ? String(hex).trim() : '#111111';
    const color = {
      id: `col-${crypto.randomBytes(4).toString('hex')}`,
      name: String(name).trim(),
      hex: cleanHex,
      publishedByAdmin: true,
    };
    store.data.garmentColors.unshift(color);
    store.save();
    broadcast('config:updated', {});
    res.status(201).json(color);
  });

  app.patch('/api/admin/colors/:id', requireAdmin, (req, res) => {
    const col = store.data.garmentColors.find((c) => c.id === req.params.id);
    if (!col) {
      res.status(404).json({ error: 'Warna kain tidak ditemukan.' });
      return;
    }
    col.publishedByAdmin = Boolean(req.body?.publishedByAdmin);
    store.save();
    broadcast('config:updated', {});
    res.json(col);
  });

  app.delete('/api/admin/colors/:id', requireAdmin, (req, res) => {
    store.data.garmentColors = store.data.garmentColors.filter((c) => c.id !== req.params.id);
    store.save();
    broadcast('config:updated', {});
    res.json({ ok: true });
  });

  app.patch('/api/admin/bugs/:id', requireAdmin, (req, res) => {
    const bug = store.data.bugReports.find((b) => b.id === req.params.id);
    if (!bug) {
      res.status(404).json({ error: 'Laporan bug tidak ditemukan.' });
      return;
    }
    bug.status = req.body?.status === 'resolved' ? 'resolved' : 'open';
    store.save();
    res.json(bug);
  });

  app.post('/api/admin/promo-push', requireAdmin, (req, res) => {
    const { title, message } = req.body ?? {};
    if (!title || !message) {
      res.status(400).json({ error: 'Judul dan pesan promo wajib diisi.' });
      return;
    }
    const payload = { title: String(title), message: String(message) };
    broadcast('promo:push', payload);
    res.json({ ok: true, ...payload });
  });

  // ==================== VITE DEV / PROD STATIC SERVING ====================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SANDIKALE server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
