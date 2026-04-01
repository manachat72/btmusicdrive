import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { sendOrderConfirmationEmail } from '../services/emailService';

const router = Router();

// ── Omise REST API (ไม่ใช้ SDK เพื่อความเสถียร) ─────────────────────────
const OMISE_SECRET_KEY = process.env.OMISE_SECRET_KEY || '';
const OMISE_API = 'https://api.omise.co';

async function omiseRequest(endpoint: string, body: Record<string, any>) {
  const auth = Buffer.from(OMISE_SECRET_KEY + ':').toString('base64');
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined && val !== null) params.append(key, String(val));
  }
  const resp = await fetch(`${OMISE_API}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return resp.json();
}

async function omiseGet(endpoint: string) {
  const auth = Buffer.from(OMISE_SECRET_KEY + ':').toString('base64');
  const resp = await fetch(`${OMISE_API}${endpoint}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return resp.json();
}

const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:5500';
const SERVER_URL = process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 5000}`;

const SHIPPING_COST_THB = 50;
const TAX_RATE = 0.08;

// ── Create Checkout Session ──────────────────────────────────────────────
router.post('/create-checkout-session', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { omiseToken, promoCode } = req.body;
    if (!omiseToken) return res.status(400).json({ error: 'Missing payment token' });

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } }
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity, 0
    );

    let discountAmount = 0;
    let validatedPromo: any = null;

    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: promoCode.trim().toUpperCase() },
      });
      if (promo && promo.isActive &&
          (!promo.expiresAt || promo.expiresAt > new Date()) &&
          (!promo.maxUses || promo.usedCount < promo.maxUses) &&
          (!promo.minOrder || subtotal >= promo.minOrder)) {
        validatedPromo = promo;
        if (promo.type === 'PERCENT') discountAmount = Math.min(subtotal * (promo.value / 100), subtotal);
        if (promo.type === 'FIXED')   discountAmount = Math.min(promo.value, subtotal);
        discountAmount = Math.round(discountAmount * 100) / 100;
      }
    }

    const discountedSubtotal = subtotal - discountAmount;
    const tax = Math.round(discountedSubtotal * TAX_RATE * 100) / 100;
    const totalAmount = Math.round((discountedSubtotal + SHIPPING_COST_THB + tax) * 100) / 100;

    const itemNames = cart.items.map(i => i.product.name).join(', ');
    const description = `btmusicdrive: ${itemNames}`.substring(0, 250);
    const invoiceNo = `BTM${Date.now()}${crypto.randomBytes(3).toString('hex')}`;

    // Build charge payload
    const chargeBody: Record<string, any> = {
      amount: Math.round(totalAmount * 100),
      currency: 'thb',
      description,
      return_uri: `${SERVER_URL}/api/payment/return?invoiceNo=${invoiceNo}`,
    };

    if (omiseToken.startsWith('tokn_') || omiseToken.startsWith('tok_')) {
      chargeBody.card = omiseToken;
    } else {
      chargeBody.source = omiseToken;
    }

    console.log('[Omise] Creating charge:', { invoiceNo, amount: chargeBody.amount, token: omiseToken.substring(0, 10) + '...' });

    const charge = await omiseRequest('/charges', chargeBody);

    if (charge.object === 'error') {
      console.error('[Omise] Charge error:', charge);
      return res.status(400).json({ error: charge.message || 'Payment failed' });
    }

    console.log('[Omise] Charge result:', { id: charge.id, status: charge.status, authorize_uri: charge.authorize_uri });

    // 3D Secure / redirect required
    if (charge.status === 'pending' && charge.authorize_uri) {
      await createProcessingOrder(userId, invoiceNo, charge.id, cart, validatedPromo, discountAmount, totalAmount);
      return res.json({ authorizeUri: charge.authorize_uri, invoiceNo });
    }

    // Instant success
    if (charge.status === 'successful') {
      const order = await completeOrder(userId, invoiceNo, charge.id, cart, validatedPromo, discountAmount, totalAmount);
      return res.json({ orderId: order.id, invoiceNo });
    }

    res.status(400).json({ error: charge.failure_message || 'Payment failed' });

  } catch (error: any) {
    console.error('Omise checkout error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ── Frontend Return ──────────────────────────────────────────────────────
router.get('/return', async (req: Request, res: Response) => {
  try {
    const { invoiceNo } = req.query;
    if (!invoiceNo) return res.redirect(`${CLIENT_URL}/checkout.html?status=cancelled`);

    const order = await prisma.order.findFirst({
      where: { stripeSessionId: String(invoiceNo) }
    });
    if (!order) return res.redirect(`${CLIENT_URL}/checkout.html?status=cancelled`);

    // Verify charge status via Omise REST API
    const charge = await omiseGet(`/charges/${order.paymentIntentId}`);

    if (charge.status === 'successful') {
      if (order.status !== 'PAID') {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'PAID' } });
      }
      return res.redirect(`${CLIENT_URL}/checkout.html?status=success&invoice_no=${encodeURIComponent(String(invoiceNo))}`);
    } else {
      return res.redirect(`${CLIENT_URL}/checkout.html?status=cancelled`);
    }
  } catch (error: any) {
    console.error('Omise return error:', error);
    return res.redirect(`${CLIENT_URL}/checkout.html?status=cancelled`);
  }
});


// ── Confirm Payment (called by frontend after redirect) ─────────────────────
router.post('/confirm', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { invoiceNo } = req.body;
    if (!invoiceNo) return res.status(400).json({ error: 'Missing invoiceNo' });

    const order = await prisma.order.findFirst({
      where: { stripeSessionId: String(invoiceNo), userId },
      include: { items: { include: { product: true } }, user: true },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // If already paid, just return
    if (order.status === 'PAID') {
      return res.json({ id: order.id, status: 'paid' });
    }

    // Check charge status via Omise
    if (order.paymentIntentId) {
      const charge = await omiseGet(`/charges/${order.paymentIntentId}`);
      if (charge.status === 'successful') {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'PAID' } });
        return res.json({ id: order.id, status: 'paid' });
      } else if (charge.status === 'pending') {
        return res.json({ id: order.id, status: 'pending' });
      }
    }

    return res.json({ id: order.id, status: order.status.toLowerCase() });
  } catch (error: any) {
    console.error('Confirm payment error:', error);
    return res.status(500).json({ error: 'Failed to confirm payment' });
  }
});


// ── Helper functions ────────────────────────────────────────────────────────
async function createProcessingOrder(userId: string, invoiceNo: string, chargeId: string, cart: any, promo: any, discountAmount: number, totalAmount: number) {
  const orderItems = cart.items.map((item: any) => ({
    productId: item.productId,
    quantity: item.quantity,
    priceAtTime: Number(item.product.price)
  }));

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId,
        totalAmount,
        status: 'PROCESSING',
        stripeSessionId: invoiceNo,
        paymentIntentId: chargeId,
        promoCode: promo?.code || null,
        discountAmount: discountAmount || 0,
        items: { create: orderItems },
      },
    });

    // Don't modify cart or stock yet until we confirm PAID

    return newOrder;
  });
  return order;
}

async function completeOrder(userId: string, invoiceNo: string, chargeId: string, cart: any, promo: any, discountAmount: number, totalAmount: number) {
  const orderItems = cart.items.map((item: any) => ({
    productId: item.productId,
    quantity: item.quantity,
    priceAtTime: Number(item.product.price)
  }));

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId,
        totalAmount,
        status: 'PAID',
        stripeSessionId: invoiceNo,
        paymentIntentId: chargeId,
        promoCode: promo?.code || null,
        discountAmount: discountAmount || 0,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } }, user: true }
    });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    if (promo) {
      await tx.promoCode.updateMany({
        where: { code: promo.code, isActive: true },
        data: { usedCount: { increment: 1 } },
      });
    }

    return newOrder;
  }) as any;

  // Send Email
  if (order.user) {
    sendOrderConfirmationEmail({
      orderId: order.id,
      customerEmail: order.user.email,
      customerName: order.user.name || '',
      items: order.items.map((i: any) => ({
        name: i.product.name,
        quantity: i.quantity,
        priceAtTime: Number(i.priceAtTime),
      })),
      totalAmount: Number(order.totalAmount),
    }).catch((err: any) => console.error('[Email] Confirmation skip:', err));
  }

  return order;
}

export default router;
