import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/order';
import paymentRoutes from './routes/payment';
import promoRoutes from './routes/promo';
import productRoutes from './routes/product';
import categoryRoutes from './routes/category';
import userRoutes from './routes/user';
import menuRoutes from './routes/menu';
import imageRoutes from './routes/images';
import contactRoutes from './routes/contact';
import analyticsRoutes from './routes/analytics';
import feedRoutes from './routes/feed';
import lineRoutes from './routes/line';
import { sendOrderConfirmationEmail } from './services/emailService';
import { isSocialBot, renderProductOgPage } from './lib/socialOg';
import { renderCategoryOgPage } from './lib/categoryOg';

dotenv.config();

// ── Validate required environment variables ──────────────────────────────────
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_PASSWORD'];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const app: Express = express();
app.set('trust proxy', 1); // Vercel / reverse proxy
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500,https://btmusicdrive.com,https://www.btmusicdrive.com,https://btmusicdrive.vercel.app')
  .split(',')
  .map((o) => o.trim());

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Managed by frontend CDN scripts
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    // Allow whitelisted origins + any Vercel preview/production deployment (*.vercel.app)
    if (!origin || allowedOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Password', 'x-admin-password'],
}));

// ── Global rate limiter (500 req / 15 min per IP) ───────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// Stripe webhook needs raw body — must be BEFORE express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
// LINE webhook needs raw body to verify the x-line-signature HMAC
app.use('/api/line/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static files from project root (HTML, CSS, JS, images)
app.use(express.static(path.join(__dirname, '../..')));
app.use('/images', express.static(path.join(__dirname, '../../images')));

app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/line', lineRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin-only SMTP test endpoint — sends a sample order confirmation
app.post('/api/health/email', async (req, res) => {
  const adminPassword = req.headers['x-admin-password'] as string | undefined;
  if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const to = (req.body?.to as string) || process.env.SMTP_USER;
  if (!to) {
    return res.status(400).json({ error: 'No recipient (set "to" in body or SMTP_USER in env)' });
  }

  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  if (!smtpConfigured) {
    return res.status(500).json({
      ok: false,
      smtpConfigured: false,
      error: 'SMTP_USER or SMTP_PASS missing in environment',
      env: {
        SMTP_HOST: process.env.SMTP_HOST || null,
        SMTP_PORT: process.env.SMTP_PORT || null,
        SMTP_USER: process.env.SMTP_USER ? 'set' : 'missing',
        SMTP_PASS: process.env.SMTP_PASS ? 'set' : 'missing',
      },
    });
  }

  const startedAt = Date.now();
  try {
    await sendOrderConfirmationEmail({
      orderId: `TEST${Date.now()}`,
      customerEmail: to,
      customerName: 'SMTP Test',
      items: [{ name: 'แฟลชไดร์ฟทดสอบ SMTP', quantity: 1, priceAtTime: 1 }],
      totalAmount: 1,
    });
    return res.json({
      ok: true,
      smtpConfigured: true,
      to,
      durationMs: Date.now() - startedAt,
      env: {
        SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
        SMTP_PORT: process.env.SMTP_PORT || '587',
        SMTP_USER: process.env.SMTP_USER,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      smtpConfigured: true,
      to,
      durationMs: Date.now() - startedAt,
      error: err?.message || String(err),
      code: err?.code,
      command: err?.command,
    });
  }
});

app.get('/api/config/stripe', (req, res) => {
  const publishableKey = process.env.STRIPE_PUBLIC_KEY || '';
  res.json({ publishableKey });
});

// Clean URL routing — mirrors vercel.json routing rules
const _pages = ['shop','cart','checkout','orders','profile','wishlist','address','track-order','shipping','about','contact','faq','terms','privacy','refund','returns','exchange','warranty','admin'];
_pages.forEach(p => {
  app.get(`/${p}`, (req, res) => res.sendFile(path.join(__dirname, `../../${p}.html`)));
});
app.get('/category/:slug', async (req, res) => {
  // Social/search crawler อาจไม่รัน JS — ต้องได้ title, canonical, OG และ ItemList/Breadcrumb
  // JSON-LD พร้อมรายการสินค้าจริงจาก server (เหมือนกับที่ทำให้ /product/:slug)
  if (isSocialBot(req.headers['user-agent'])) {
    try {
      const rendered = await renderCategoryOgPage(req.params.slug, res);
      if (rendered) return;
    } catch (err) {
      console.error('[categoryOg]', err);
    }
  }
  res.sendFile(path.join(__dirname, '../../category.html'));
});
app.get('/blog', (req, res) => {
  res.sendFile(path.join(__dirname, '../../blog.html'));
});
app.get('/blog/:slug', (req, res) => {
  const slug = String(req.params.slug);
  if (!/^[a-z0-9-]+$/i.test(slug)) return res.status(404).json({ error: 'Route not found' });
  res.sendFile(path.join(__dirname, `../../blog/${slug}.html`));
});

const legacyProductSlugRedirects: Record<string, string> = {
  'usb-flash-drive-mp3-sunarathip': 'usb-mp3-luk-krung-suntharaporn',
  'sku-036': 'usb-mp3-phuea-chiwit-carabao-4gb-325-songs',
};

app.get('/product/:slug', async (req, res) => {
  const nextSlug = legacyProductSlugRedirects[req.params.slug];
  if (nextSlug) return res.redirect(301, `/product/${nextSlug}`);

  // Social/search crawler อาจไม่รัน JS — ต้องได้ title, canonical, OG และ Product JSON-LD จาก server
  if (isSocialBot(req.headers['user-agent'])) {
    try {
      const rendered = await renderProductOgPage(req.params.slug, res);
      if (rendered) return;
    } catch (err) {
      console.error('[socialOg]', err);
    }
  }

  res.sendFile(path.join(__dirname, '../../product.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Only start listening when running locally (not on Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('🚀 Server is running on http://localhost:' + PORT);
    console.log('📡 API: http://localhost:' + PORT + '/api');
  });
}

export default app;
