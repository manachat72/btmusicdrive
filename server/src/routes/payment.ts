import { Router, Response } from 'express';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { sendOrderConfirmationEmail } from '../services/emailService';

const router = Router();

const SHIPPING_COST_THB = 50;
const TAX_RATE = 0.08;

// ── COD (Cash on Delivery) ─────────────────────────────────────────────────────────────
router.post('/cod-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { shippingAddress, phone, promoCode } = req.body;

    if (!shippingAddress || !phone) {
      return res.status(400).json({ error: 'ต้องระบุที่อยู่จัดส่งและเบอร์โทรศัพท์' });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } }
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Validate stock
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          error: `สินค้า "${item.product.name}" มีในสต็อกเพียง ${item.product.stock} ชิ้น`,
        });
      }
    }

    const subtotal = cart.items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);

    let discountAmount = 0;
    let validatedPromo: any = null;

    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCode.trim().toUpperCase() } });
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

    const invoiceNo = `BTM${Date.now()}${crypto.randomBytes(3).toString('hex')}`;

    // declaredValue = totalAmount (มูลค่าสินค้าที่แจ้งสำหรับจัดส่ง)
    const declaredValue = totalAmount;

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
          paymentIntentId: `cod_${invoiceNo}`,
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
    }) as any;

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

    return res.json({
      orderId: order.id,
      invoiceNo,
      declaredValue,
      paymentMethod: 'cod',
    });

  } catch (error: any) {
    console.error('COD order error:', error);
    return res.status(500).json({ error: 'Failed to process COD order' });
  }
});

export default router;
