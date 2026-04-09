import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { sendOrderConfirmationEmail } from '../services/emailService';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-06-30.basil',
});

const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:5500';

const SHIPPING_COST_THB = 50;
const TAX_RATE = 0.08;

// ── Create PaymentIntent ─────────────────────────────────────────────────────
router.post('/create-payment-intent', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { promoCode } = req.body;

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Validate stock availability
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          error: `สินค้า "${item.product.name}" มีสต็อกไม่เพียงพอ เหลือแค่ ${item.product.stock} ชิ้น`,
        });
      }
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
      if (
        promo && promo.isActive &&
        (!promo.expiresAt || promo.expiresAt > new Date()) &&
        (!promo.maxUses || promo.usedCount < promo.maxUses) &&
        (!promo.minOrder || subtotal >= promo.minOrder)
      ) {
        validatedPromo = promo;
        if (promo.type === 'PERCENT') discountAmount = Math.min(subtotal * (promo.value / 100), subtotal);
        if (promo.type === 'FIXED')   discountAmount = Math.min(promo.value, subtotal);
        discountAmount = Math.round(discountAmount * 100) / 100;
      }
    }

    const discountedSubtotal = subtotal - discountAmount;
    const tax = Math.round(discountedSubtotal * TAX_RATE * 100) / 100;
    const totalAmount = Math.round((discountedSubtotal + SHIPPING_COST_THB + tax) * 100) / 100;

    const invoiceNo = `BTM${Date.now()}${crypto.randomBytes(3).toString('hex')}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // in satang (smallest unit)
      currency: 'thb',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId,
        invoiceNo,
        promoCode: validatedPromo?.code || '',
        discountAmount: String(discountAmount),
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      invoiceNo,
      totalAmount,
    });

  } catch (error: any) {
    console.error('[Stripe] create-payment-intent error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ── Confirm Order (called by frontend after Stripe payment succeeds) ──────────
router.post('/confirm-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { paymentIntentId, invoiceNo, shippingAddress, phone } = req.body;
    if (!paymentIntentId || !invoiceNo) {
      return res.status(400).json({ error: 'Missing paymentIntentId or invoiceNo' });
    }

    // Idempotency: if order already exists, return it
    const existing = await prisma.order.findFirst({
      where: { stripeSessionId: invoiceNo, userId },
    });
    if (existing) {
      return res.json({ orderId: existing.id, status: existing.status.toLowerCase() });
    }

    // Verify with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty or already processed' });
    }

    // Validate stock again before committing
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          error: `สินค้า "${item.product.name}" มีสต็อกไม่เพียงพอ`,
        });
      }
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity, 0
    );

    const promoCode = paymentIntent.metadata?.promoCode || '';
    const discountAmount = parseFloat(paymentIntent.metadata?.discountAmount || '0');

    let validatedPromo: any = null;
    if (promoCode) {
      validatedPromo = await prisma.promoCode.findUnique({ where: { code: promoCode } });
    }

    const discountedSubtotal = subtotal - discountAmount;
    const tax = Math.round(discountedSubtotal * TAX_RATE * 100) / 100;
    const totalAmount = Math.round((discountedSubtotal + SHIPPING_COST_THB + tax) * 100) / 100;

    const orderItems = cart.items.map((item: any) => ({
      productId: item.productId,
      quantity: item.quantity,
      priceAtTime: Number(item.product.price),
    }));

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: 'PAID',
          stripeSessionId: invoiceNo,
          paymentIntentId,
          promoCode: validatedPromo?.code || null,
          discountAmount: discountAmount || 0,
          shippingAddress: shippingAddress || null,
          items: { create: orderItems },
        },
        include: { items: { include: { product: true } }, user: true },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      if (validatedPromo) {
        await tx.promoCode.updateMany({
          where: { code: validatedPromo.code, isActive: true },
          data: { usedCount: { increment: 1 } },
        });
      }

      return newOrder;
    }) as any;

    // Send confirmation email
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

    return res.json({ orderId: order.id, status: 'paid' });

  } catch (error: any) {
    console.error('[Stripe] confirm-order error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ── Cash on Delivery Order ───────────────────────────────────────────────────
router.post('/cod-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { promoCode, shippingAddress, phone } = req.body;

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          error: `สินค้า "${item.product.name}" มีสต็อกไม่เพียงพอ เหลือแค่ ${item.product.stock} ชิ้น`,
        });
      }
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
      if (
        promo && promo.isActive &&
        (!promo.expiresAt || promo.expiresAt > new Date()) &&
        (!promo.maxUses || promo.usedCount < promo.maxUses) &&
        (!promo.minOrder || subtotal >= promo.minOrder)
      ) {
        validatedPromo = promo;
        if (promo.type === 'PERCENT') discountAmount = Math.min(subtotal * (promo.value / 100), subtotal);
        if (promo.type === 'FIXED')   discountAmount = Math.min(promo.value, subtotal);
        discountAmount = Math.round(discountAmount * 100) / 100;
      }
    }

    const discountedSubtotal = subtotal - discountAmount;
    const tax = Math.round(discountedSubtotal * TAX_RATE * 100) / 100;
    const totalAmount = Math.round((discountedSubtotal + SHIPPING_COST_THB + tax) * 100) / 100;

    const invoiceNo = `BTM${Date.now()}${crypto.randomBytes(3).toString('hex')}`;
    const orderItems = cart.items.map((item: any) => ({
      productId: item.productId,
      quantity: item.quantity,
      priceAtTime: Number(item.product.price),
    }));

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: 'PROCESSING',
          stripeSessionId: invoiceNo,
          paymentIntentId: 'COD',
          promoCode: validatedPromo?.code || null,
          discountAmount: discountAmount || 0,
          shippingAddress: shippingAddress || null,
          items: { create: orderItems },
        },
        include: { items: { include: { product: true } }, user: true },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      if (validatedPromo) {
        await tx.promoCode.updateMany({
          where: { code: validatedPromo.code, isActive: true },
          data: { usedCount: { increment: 1 } },
        });
      }

      return newOrder;
    }) as any;

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
      }).catch((err: any) => console.error('[Email] COD Confirmation skip:', err));
    }

    return res.json({ orderId: order.id, invoiceNo, status: 'processing' });

  } catch (error: any) {
    console.error('[COD] cod-order error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ── Stripe Webhook ───────────────────────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    return res.status(400).json({ error: 'Missing webhook secret or signature' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const invoiceNo = paymentIntent.metadata?.invoiceNo;
    if (invoiceNo) {
      await prisma.order.updateMany({
        where: { stripeSessionId: invoiceNo, status: { not: 'PAID' } },
        data: { status: 'PAID', paymentIntentId: paymentIntent.id },
      });
    }
  }

  return res.json({ received: true });
});

export default router;
