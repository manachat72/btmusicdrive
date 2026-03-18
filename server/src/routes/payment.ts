import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { sendOrderConfirmationEmail } from '../services/emailService';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-02-25.clover', // Updated to match current Stripe typings
});

const SHIPPING_COST_THB = 50; // ฿50 flat shipping
const TAX_RATE = 0.08;

// Create Checkout Session
router.post('/create-checkout-session', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { promoCode } = req.body;

    // Get user's cart
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

    // ── Validate promo code ───────────────────────────────────────────────
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

    // ── Build Stripe line items ───────────────────────────────────────────
    const isPublicUrl = (url: string | null) => !!url && url.startsWith('https://');

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = cart.items.map(item => ({
      price_data: {
        currency: 'thb',
        product_data: {
          name: item.product.name,
          ...(isPublicUrl(item.product.imageUrl) && { images: [item.product.imageUrl as string] }),
          ...(item.product.description && { description: item.product.description }),
        },
        unit_amount: Math.round(Number(item.product.price) * 100),
      },
      quantity: item.quantity,
    }));

    const taxAmount  = Math.round(((subtotal - discountAmount) * TAX_RATE) * 100);
    const shippingAmount = Math.round(SHIPPING_COST_THB * 100);

    // Show discount line item
    if (discountAmount > 0) {
      lineItems.push({
        price_data: {
          currency: 'thb',
          product_data: {
            name: `Promo: ${validatedPromo.code} (${validatedPromo.type === 'PERCENT' ? `-${validatedPromo.value}%` : `-฿${validatedPromo.value}`})`,
          },
          unit_amount: -Math.round(discountAmount * 100),
        },
        quantity: 1,
      });
    }

    if (taxAmount > 0) {
      lineItems.push({
        price_data: { currency: 'thb', product_data: { name: 'Tax (8%)' }, unit_amount: taxAmount },
        quantity: 1,
      });
    }

    lineItems.push({
      price_data: { currency: 'thb', product_data: { name: 'Standard Shipping (฿50)' }, unit_amount: shippingAmount },
      quantity: 1,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'promptpay'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://127.0.0.1:5500'}/checkout.html?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${process.env.CLIENT_URL || 'http://127.0.0.1:5500'}/checkout.html?status=cancelled`,
      metadata: {
        userId,
        cartId: cart.id,
        promoCode: validatedPromo?.code || '',
        discountAmount: String(discountAmount),
      }
    });

    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe session creation error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Confirm payment and create DB order with status PROCESSING
router.post('/confirm', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    // Verify session with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Idempotency: if order for this session already exists, return it
    const existing = await prisma.order.findFirst({
      where: { stripeSessionId: sessionId },
      include: { items: { include: { product: true } }, user: { select: { id: true, email: true, name: true } } },
    });
    if (existing) return res.json(existing);

    // Get the cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty — cannot create order' });
    }

    let totalAmount = 0;
    const orderItems = cart.items.map((item: any) => {
      totalAmount += Number(item.product.price) * item.quantity;
      return { productId: item.productId, quantity: item.quantity, priceAtTime: Number(item.product.price) };
    });
    // Add shipping
    totalAmount += SHIPPING_COST_THB;

    // Create order + clear cart + redeem promo in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: 'PROCESSING',
          stripeSessionId: sessionId,
          promoCode: session.metadata?.promoCode || null,
          discountAmount: parseFloat(session.metadata?.discountAmount || '0'),
          items: { create: orderItems },
        },
        include: {
          items: { include: { product: true } },
          user: { select: { id: true, email: true, name: true } },
        },
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      // Redeem promo code (increment usedCount)
      if (session.metadata?.promoCode) {
        await tx.promoCode.updateMany({
          where: { code: session.metadata.promoCode, isActive: true },
          data: { usedCount: { increment: 1 } },
        });
      }

      return newOrder;
    }) as any;

    // Fire-and-forget confirmation email
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
    }).catch((err: any) => console.error('[Email] Confirmation email failed:', err));

    return res.status(201).json(order);
  } catch (error: any) {
    console.error('Payment confirm error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ── Stripe Webhook (production-safe) ──────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== 'paid') {
      return res.json({ received: true, note: 'payment not yet paid' });
    }

    const userId = session.metadata?.userId;
    const sessionId = session.id;

    if (!userId) {
      console.error('[Webhook] No userId in session metadata');
      return res.json({ received: true });
    }

    // Idempotency: skip if order already exists
    const existing = await prisma.order.findFirst({ where: { stripeSessionId: sessionId } });
    if (existing) {
      return res.json({ received: true, orderId: existing.id });
    }

    // Get user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      console.warn('[Webhook] Cart empty for user', userId);
      return res.json({ received: true });
    }

    let totalAmount = 0;
    const orderItems = cart.items.map((item: any) => {
      totalAmount += Number(item.product.price) * item.quantity;
      return { productId: item.productId, quantity: item.quantity, priceAtTime: Number(item.product.price) };
    });
    totalAmount += SHIPPING_COST_THB;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: 'PROCESSING',
          stripeSessionId: sessionId,
          promoCode: session.metadata?.promoCode || null,
          discountAmount: parseFloat(session.metadata?.discountAmount || '0'),
          items: { create: orderItems },
        },
        include: {
          items: { include: { product: true } },
          user: { select: { id: true, email: true, name: true } },
        },
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      if (session.metadata?.promoCode) {
        await tx.promoCode.updateMany({
          where: { code: session.metadata.promoCode, isActive: true },
          data: { usedCount: { increment: 1 } },
        });
      }
      return newOrder;
    }) as any;

    // Fire-and-forget confirmation email
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
    }).catch((err: any) => console.error('[Email] Webhook email failed:', err));

    console.log('[Webhook] Order created:', order.id);
    return res.json({ received: true, orderId: order.id });
  }

  res.json({ received: true });
});

export default router;
