import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// ── GET /api/users ───────────────────────────────────────────────────────────
// Admin only — list all users with order count
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
