import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sendOrderConfirmationEmail } from '../services/emailService';

const router = Router();

const CARRIER_TRACKING_URLS: Record<string, string> = {
  Kerry: 'https://th.kerryexpress.com/en/track/?track=',
  Flash: 'https://www.flashexpress.co.th/tracking/?se=',
};

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
// Fetch a single order by ID. Accessible by the order owner or an ADMIN.
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id;
    const role = req.user?.role;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Only the owner or an admin can view the order
    if (order.userId !== userId && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build tracking URL if available
    const trackingUrl =
      order.carrier && order.trackingNumber
        ? (CARRIER_TRACKING_URLS[order.carrier] || '') + order.trackingNumber
        : null;

    return res.json({ ...order, trackingUrl });
  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ── GET /api/orders/my ────────────────────────────────────────────────────────
// List orders for the logged-in user.
router.get('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { product: { select: { name: true, imageUrl: true, price: true } } },
        },
      },
    });

    return res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── GET /api/orders ───────────────────────────────────────────────────────────
// List all orders. ADMIN only.
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        items: {
          include: { product: { select: { name: true } } },
        },
      },
    });

    return res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── PATCH /api/orders/:id/tracking ───────────────────────────────────────────
// Update tracking info. ADMIN only. Triggers shipping email to customer.
router.patch('/:id/tracking', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const id = req.params.id as string;
    const { trackingNumber, carrier } = req.body;

    if (!trackingNumber || !carrier) {
      return res.status(400).json({ error: 'trackingNumber and carrier are required' });
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        trackingNumber,
        carrier,
        status: 'SHIPPED',
      },
      include: {
        items: {
          include: { product: true },
        },
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    }) as any;

    // Generate tracking URL for response
    const trackingUrl =
      (CARRIER_TRACKING_URLS[carrier] || '') + trackingNumber;

    // Fire-and-forget email — don't block the response
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
      trackingNumber,
      carrier,
    }).catch((err) => console.error('[Email] Failed to send shipping email:', err));

    return res.json({ ...order, trackingUrl });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Order not found' });
    }
    console.error('Error updating tracking:', error);
    return res.status(500).json({ error: 'Failed to update tracking info' });
  }
});

// ── PATCH /api/orders/:id/status ─────────────────────────────────────────────
// Update order status. ADMIN only.
router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const id = req.params.id as string;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'PROCESSING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    return res.json(order);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Order not found' });
    }
    console.error('Error updating order status:', error);
    return res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;
