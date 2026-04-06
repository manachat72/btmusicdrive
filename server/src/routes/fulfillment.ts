import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getOrderStatus, createArrivalNotice, getInboundStatus } from '../services/flashFulfillmentService';

const router = Router();

const SECRET = process.env.FLASH_FULFILLMENT_SECRET || '';

// Flash Fulfillment status codes
const STATUS_MAP: Record<number, string> = {
  1001: 'PAID',       // อนุมัติ
  1005: 'PROCESSING', // รับพัสดุแล้ว
  1007: 'SHIPPED',    // กำลังจัดส่ง
  1009: 'DELIVERED',  // ส่งสำเร็จ
  1011: 'CANCELLED',  // ส่งคืน
};

// ── POST /api/fulfillment/webhook ─────────────────────────────────────────────
// Flash Fulfillment จะ POST มาที่นี่เมื่อสถานะ order เปลี่ยน
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Verify signature ถ้ามี SECRET
    if (SECRET && body.sign) {
      const { sign, ...params } = body;
      const filtered = Object.entries(params)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .sort(([a], [b]) => a.localeCompare(b));
      const stringA = filtered.map(([k, v]) => `${k}=${v}`).join('&');
      const expected = crypto
        .createHash('sha256')
        .update(`${stringA}&key=${SECRET}`)
        .digest('hex')
        .toUpperCase();
      if (sign !== expected) {
        console.warn('[Webhook] Invalid signature');
        return res.status(401).json({ code: 0, msg: 'invalid signature' });
      }
    }

    const { orderSn, deliverySn, expressSn, status } = body;
    if (!orderSn || !status) {
      return res.status(400).json({ code: 0, msg: 'missing fields' });
    }

    const statusCode = parseInt(status);
    const newStatus = STATUS_MAP[statusCode];

    if (!newStatus) {
      return res.json({ code: 1, msg: 'status ignored' });
    }

    // หา order จาก stripeSessionId (= orderSn ที่ส่งไป Flash)
    const order = await prisma.order.findFirst({
      where: { stripeSessionId: String(orderSn) },
    });

    if (!order) {
      console.warn('[Webhook] Order not found for orderSn:', orderSn);
      return res.json({ code: 1, msg: 'order not found' });
    }

    const updateData: any = { status: newStatus };
    if (expressSn && !order.trackingNumber) updateData.trackingNumber = expressSn;
    if (deliverySn && !order.trackingNumber) updateData.trackingNumber = deliverySn;
    if (statusCode >= 1007) updateData.carrier = 'Flash';

    await prisma.order.update({ where: { id: order.id }, data: updateData });

    console.log(`[Webhook] Order ${order.id} → ${newStatus} (Flash status: ${statusCode})`);
    return res.json({ code: 1, msg: 'success' });

  } catch (err: any) {
    console.error('[Webhook] Error:', err.message);
    return res.status(500).json({ code: 0, msg: 'server error' });
  }
});

// ── POST /api/fulfillment/sync/:orderId ───────────────────────────────────────
// Admin กด sync สถานะ order จาก Flash Fulfillment แบบ manual
router.post('/sync/:orderId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId as string },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.stripeSessionId) return res.status(400).json({ error: 'No orderSn (stripeSessionId) on this order' });

    const result = await getOrderStatus(order.stripeSessionId);
    if (!result) return res.status(502).json({ error: 'Flash Fulfillment unavailable' });

    const newStatus = result.latestStatus ? STATUS_MAP[result.latestStatus] : null;
    const updateData: any = {};
    if (newStatus) updateData.status = newStatus;
    if (result.expressSn && !order.trackingNumber) {
      updateData.trackingNumber = result.expressSn;
      updateData.carrier = 'Flash';
    }

    const updated = await prisma.order.update({ where: { id: order.id }, data: updateData });
    return res.json({ order: updated, flashStatus: result.latestStatus, newStatus });

  } catch (err: any) {
    console.error('[Sync] Error:', err.message);
    return res.status(500).json({ error: 'Failed to sync order status' });
  }
});

// ── POST /api/fulfillment/inbound ─────────────────────────────────────────────
// Admin แจ้งของเข้าคลัง Flash — ระบุสินค้าและจำนวนที่จะส่งไปโกดัง
router.post('/inbound', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { items, remark, type } = req.body;

    // items = [{ productId, quantity }]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    // ดึง sku ของแต่ละ product
    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i: any) => i.productId) } },
      select: { id: true, sku: true, price: true, name: true },
    });

    const skuMap = new Map(products.map((p) => [p.id, p]));
    const missing = items.filter((i: any) => !skuMap.get(i.productId)?.sku);
    if (missing.length > 0) {
      return res.status(400).json({
        error: `สินค้าต่อไปนี้ไม่มี SKU: ${missing.map((i: any) => i.productId).join(', ')}`,
      });
    }

    const orderSn = `IN-${Date.now()}`;
    const mappedItems = items.map((i: any) => {
      const p = skuMap.get(i.productId)!;
      return { sku: p.sku!, quantity: i.quantity, price: Number(p.price) };
    });

    const result = await createArrivalNotice({ orderSn, items: mappedItems, type, remark });

    return res.json({
      success: result.success,
      inboundSn: result.inboundSn,
      orderSn,
      message: result.message,
      items: mappedItems.map((i, idx) => ({
        ...i,
        name: products[idx]?.name,
      })),
    });
  } catch (err: any) {
    console.error('[Inbound] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create arrival notice' });
  }
});

// ── GET /api/fulfillment/inbound/:inboundSn ───────────────────────────────────
// Admin ดูสถานะ inbound จาก Flash Fulfillment
router.get('/inbound/:inboundSn', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await getInboundStatus(req.params.inboundSn as string);
    if (!result) return res.status(502).json({ error: 'Flash Fulfillment unavailable or inbound not found' });

    return res.json(result);
  } catch (err: any) {
    console.error('[Inbound Status] Error:', err.message);
    return res.status(500).json({ error: 'Failed to get inbound status' });
  }
});

export default router;
