import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sendOrderConfirmationEmail } from '../services/emailService';

const router = Router();

const CARRIER_TRACKING_URLS: Record<string, string> = {
  Kerry: 'https://th.kerryexpress.com/en/track/?track=',
  Flash: 'https://www.flashexpress.co.th/tracking/?se=',
};

// ── GET /api/orders/stats ─────────────────────────────────────────────────────
// Dashboard stats — ADMIN only
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const PAID_STATUSES: import('@prisma/client').OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

    const [
      revenueThis, revenueLast,
      ordersThis, ordersLast,
      pendingCount,
      topProducts,
      recentOrders,
      lowStock,
      newCustomersThis, newCustomersLast,
    ] = await Promise.all([
      // รายได้เดือนนี้
      prisma.order.aggregate({
        where: { status: { in: PAID_STATUSES }, createdAt: { gte: startOfMonth } },
        _sum: { totalAmount: true },
      }),
      // รายได้เดือนที่แล้ว
      prisma.order.aggregate({
        where: { status: { in: PAID_STATUSES }, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { totalAmount: true },
      }),
      // order เดือนนี้
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      // order เดือนที่แล้ว
      prisma.order.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      // order รอดำเนินการ
      prisma.order.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      // สินค้าขายดี top 5
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      // order ล่าสุด 5 รายการ
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true, email: true } } },
      }),
      // สต็อกใกล้หมด (< 10)
      prisma.product.findMany({
        where: { stock: { lt: 10 } },
        select: { id: true, name: true, stock: true, imageUrl: true },
        orderBy: { stock: 'asc' },
        take: 5,
      }),
      // ลูกค้าใหม่เดือนนี้
      prisma.user.count({ where: { createdAt: { gte: startOfMonth }, role: 'CUSTOMER' } }),
      // ลูกค้าใหม่เดือนที่แล้ว
      prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, role: 'CUSTOMER' } }),
    ]);

    // ดึงชื่อสินค้าขายดี
    const topProductIds = topProducts.map(p => p.productId);
    const topProductDetails = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, imageUrl: true, price: true },
    });
    const topProductMap = new Map(topProductDetails.map(p => [p.id, p]));

    const revenueThisVal = Number(revenueThis._sum?.totalAmount || 0);
    const revenueLastVal = Number(revenueLast._sum?.totalAmount || 0);
    const revenueChange = revenueLastVal > 0 ? ((revenueThisVal - revenueLastVal) / revenueLastVal) * 100 : 0;
    const ordersChange = ordersLast > 0 ? ((ordersThis - ordersLast) / ordersLast) * 100 : 0;
    const avgOrder = ordersThis > 0 ? revenueThisVal / ordersThis : 0;
    const avgOrderLast = ordersLast > 0 ? revenueLastVal / ordersLast : 0;
    const avgChange = avgOrderLast > 0 ? ((avgOrder - avgOrderLast) / avgOrderLast) * 100 : 0;
    const customersChange = newCustomersLast > 0 ? ((newCustomersThis - newCustomersLast) / newCustomersLast) * 100 : 0;

    return res.json({
      revenue: { current: revenueThisVal, change: revenueChange },
      orders: { current: ordersThis, change: ordersChange, pending: pendingCount },
      avgOrder: { current: avgOrder, change: avgChange },
      customers: { current: newCustomersThis, change: customersChange },
      topProducts: topProducts.map(p => ({
        ...topProductMap.get(p.productId),
        totalSold: p._sum.quantity,
      })),
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        customerName: (o.user as any)?.name || (o.user as any)?.email || '-',
        totalAmount: Number(o.totalAmount),
        status: o.status,
        createdAt: o.createdAt,
      })),
      lowStock,
      month: `${now.toLocaleString('th-TH', { month: 'long' })} ${now.getFullYear() + 543}`,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET /api/orders/my ────────────────────────────────────────────────────────
// List orders for the logged-in user.
// IMPORTANT: Must be defined BEFORE /:id to avoid being matched as an ID.
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

// ── GET /api/orders ───────────────────────────────────────────────────────────
// List all orders (ADMIN only). Supports ?phone= for customer self-lookup.
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const phoneQuery = req.query.phone as string | undefined;

    // Allow any authenticated user to search orders by their own phone number
    if (phoneQuery) {
      const normalizedPhone = phoneQuery.replace(/[-\s]/g, '');
      const user = await prisma.user.findFirst({
        where: { phone: { contains: normalizedPhone } }
      });

      if (!user) return res.json([]);

      // Customers can only see their own orders; admins can see any
      if (role !== 'ADMIN' && user.id !== userId) {
        return res.json([]);
      }

      const orders = await prisma.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: { product: { select: { name: true, imageUrl: true, price: true } } },
          },
        },
      });
      return res.json(orders);
    }

    if (role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true } },
          items: {
            include: { product: { select: { name: true } } },
          },
        },
      }),
      prisma.order.count(),
    ]);

    return res.json({ data: orders, total, page, limit, totalPages: Math.ceil(total / limit) });
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
