import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { sendOrderConfirmationEmail } from '../services/emailService';
import { sendPurchaseEvent } from '../lib/meta-capi';

type StripeClient = InstanceType<typeof Stripe>;

const router = Router();

const SHIPPING_COST_THB = 50;
const FREE_SHIPPING_THRESHOLD = 200;
const TAX_RATE = 0.08;

// ── Stripe setup ────────────────────────────────────────────────────────────
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

let stripe: StripeClient | null = null;
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey);
}

// ── Helper: calculate order totals from cart ─────────────────────────────────
async function calculateOrderTotals(userId: string, promoCode?: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  // Validate stock
  for (const item of cart.items) {
    if (item.product.stock < item.quantity) {
      throw new Error(`สินค้า "${item.product.name}" มีในสต็อกเพียง ${item.product.stock} ชิ้น`);
    }
  }

  const subtotal = cart.items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  let discountAmount = 0;
  let validatedPromo: any = null;

  if (promoCode) {
    const promo = await prisma.promoCode.findUnique({
      where: { code: promoCode.trim().toUpperCase() },
    });
    if (
      promo &&
      promo.isActive &&
      (!promo.expiresAt || promo.expiresAt > new Date()) &&
      (!promo.maxUses || promo.usedCount < promo.maxUses) &&
      (!promo.minOrder || subtotal >= promo.minOrder)
    ) {
      validatedPromo = promo;
      if (promo.type === 'PERCENT')
        discountAmount = Math.min(subtotal * (promo.value / 100), subtotal);
      if (promo.type === 'FIXED')
        discountAmount = Math.min(promo.value, subtotal);
      discountAmount = Math.round(discountAmount * 100) / 100;
    }
  }

  const discountedSubtotal = subtotal - discountAmount;
  const tax = Math.round(discountedSubtotal * TAX_RATE * 100) / 100;
  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST_THB;
  const totalAmount = Math.round((discountedSubtotal + shippingCost + tax) * 100) / 100;

  return { cart, subtotal, discountAmount, validatedPromo, tax, totalAmount };
}

// ── Helper: create order in DB ───────────────────────────────────────────────
async function createOrderInDB(
  userId: string,
  cart: any,
  totalAmount: number,
  discountAmount: number,
  validatedPromo: any,
  shippingAddress: string,
  status: string,
  invoiceNo: string,
  paymentIntentId: string
) {
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
        status: status as any,
        stripeSessionId: invoiceNo,
        paymentIntentId,
        promoCode: validatedPromo?.code || null,
        discountAmount: discountAmount || 0,
        shippingAddress,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } }, user: true },
    });

    // Decrement stock
    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Clear cart
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    // Update promo usage
    if (validatedPromo) {
      await tx.promoCode.updateMany({
        where: { code: validatedPromo.code, isActive: true },
        data: { usedCount: { increment: 1 } },
      });
    }

    return newOrder;
  });

  return order;
}

// ── Create Payment Intent (Stripe) ──────────────────────────────────────────
router.post('/create-payment-intent', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { promoCode, shippingAddress, phone } = req.body;

    if (!shippingAddress || !phone) {
      return res.status(400).json({ error: 'ต้องระบุที่อยู่จัดส่งและเบอร์โทรศัพท์' });
    }

    const { totalAmount, discountAmount, validatedPromo } = await calculateOrderTotals(
      userId,
      promoCode
    );

    const invoiceNo = `BTM${Date.now()}${crypto.randomBytes(3).toString('hex')}`;

    // Create Stripe PaymentIntent (amount in satang = THB * 100)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100),
      currency: 'thb',
      metadata: {
        userId,
        invoiceNo,
        shippingAddress,
        phone,
        promoCode: validatedPromo?.code || '',
        discountAmount: String(discountAmount),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      invoiceNo,
      paymentIntentId: paymentIntent.id,
      totalAmount,
    });
  } catch (error: any) {
    console.error('Create PaymentIntent error:', error);
    if (error.message?.includes('สต็อก') || error.message?.includes('Cart is empty')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// ── Confirm Order (after Stripe payment succeeded on frontend) ──────────────
router.post('/confirm-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { paymentIntentId, invoiceNo } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Missing paymentIntentId' });
    }

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: `การชำระเงินไม่สำเร็จ (status: ${paymentIntent.status})` });
    }

    // Check if order already exists for this paymentIntent (idempotency)
    const existingOrder = await prisma.order.findUnique({
      where: { paymentIntentId },
    });
    if (existingOrder) {
      return res.json({
        orderId: existingOrder.id,
        invoiceNo: existingOrder.stripeSessionId,
        paymentMethod: 'card',
        message: 'Order already confirmed',
      });
    }

    const metadata = paymentIntent.metadata;
    const shippingAddress = metadata.shippingAddress || '';
    const promoCode = metadata.promoCode || undefined;
    const discountAmountFromMeta = parseFloat(metadata.discountAmount || '0');

    const { cart, totalAmount, discountAmount, validatedPromo } = await calculateOrderTotals(
      userId,
      promoCode
    );

    const order = (await createOrderInDB(
      userId,
      cart,
      totalAmount,
      discountAmount || discountAmountFromMeta,
      validatedPromo,
      shippingAddress,
      'PAID',
      invoiceNo || metadata.invoiceNo,
      paymentIntentId
    )) as any;

    // Send confirmation email (non-blocking)
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
        totalAmount,
      }).catch((err: any) => console.error('[Email] Confirmation skip:', err));
    }

    // Meta CAPI Purchase event (non-blocking)
    sendPurchaseEvent({
      orderId: order.id,
      totalAmount,
      contentIds: cart.map((i: any) => i.productId || i.id),
      numItems: cart.reduce((s: number, i: any) => s + (i.quantity || 1), 0),
      userData: {
        email: order.user?.email,
        phone: shippingAddress?.phone || phone,
        clientIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
        userAgent: req.headers['user-agent'],
      },
    }).catch(() => {});

    return res.json({
      orderId: order.id,
      invoiceNo: order.stripeSessionId,
      paymentMethod: 'card',
    });
  } catch (error: any) {
    console.error('Confirm order error:', error);
    if (error.message?.includes('สต็อก') || error.message?.includes('Cart is empty')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to confirm order' });
  }
});

// ── Stripe Webhook ──────────────────────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  if (!stripe || !stripeWebhookSecret) {
    return res.status(500).json({ error: 'Stripe webhook not configured' });
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: any;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as any;
      console.log(`[Webhook] PaymentIntent ${paymentIntent.id} succeeded`);

      // Update order status to PAID if order exists
      try {
        const order = await prisma.order.findUnique({
          where: { paymentIntentId: paymentIntent.id },
        });
        if (order && order.status !== 'PAID') {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'PAID' },
          });
          console.log(`[Webhook] Order ${order.id} updated to PAID`);
        }
      } catch (e) {
        console.error('[Webhook] Error updating order:', e);
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as any;
      console.error(
        `[Webhook] PaymentIntent ${paymentIntent.id} failed:`,
        paymentIntent.last_payment_error?.message
      );
      break;
    }

    default:
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// ── COD (Cash on Delivery) ─────────────────────────────────────────────────
router.post('/cod-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { shippingAddress, phone, promoCode } = req.body;

    if (!shippingAddress || !phone) {
      return res.status(400).json({ error: 'ต้องระบุที่อยู่จัดส่งและเบอร์โทรศัพท์' });
    }

    const { cart, totalAmount, discountAmount, validatedPromo } = await calculateOrderTotals(
      userId,
      promoCode
    );

    const invoiceNo = `BTM${Date.now()}${crypto.randomBytes(3).toString('hex')}`;

    const order = (await createOrderInDB(
      userId,
      cart,
      totalAmount,
      discountAmount,
      validatedPromo,
      shippingAddress,
      'PROCESSING',
      invoiceNo,
      `cod_${invoiceNo}`
    )) as any;

    // Send confirmation email (non-blocking)
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
        totalAmount,
      }).catch((err: any) => console.error('[Email] Confirmation skip:', err));
    }

    // Meta CAPI Purchase event (non-blocking)
    sendPurchaseEvent({
      orderId: order.id,
      totalAmount,
      contentIds: cart.map((i: any) => i.productId || i.id),
      numItems: cart.reduce((s: number, i: any) => s + (i.quantity || 1), 0),
      userData: {
        email: order.user?.email,
        phone: phone,
        clientIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
        userAgent: req.headers['user-agent'],
      },
    }).catch(() => {});

    return res.json({
      orderId: order.id,
      invoiceNo,
      declaredValue: totalAmount,
      paymentMethod: 'cod',
    });
  } catch (error: any) {
    console.error('COD order error:', error);
    if (error.message?.includes('สต็อก') || error.message?.includes('Cart is empty')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to process COD order' });
  }
});

export default router;
