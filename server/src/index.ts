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
import userRoutes from './routes/user';
import menuRoutes from './routes/menu';
import imageRoutes from './routes/images';
import contactRoutes from './routes/contact';

dotenv.config();

// ── Validate required environment variables ──────────────────────────────────
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const app: Express = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500,https://btmusicdrive.com,https://www.btmusicdrive.com')
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
    if (!origin || allowedOrigins.includes(origin)) {
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
app.use('/api/users', userRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/contact', contactRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
app.get('/category/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../../category.html'));
});
app.get('/product/:slug', (req, res) => {
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
