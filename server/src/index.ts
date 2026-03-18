import express, { Express } from 'express';
import cors from 'cors';
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

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
