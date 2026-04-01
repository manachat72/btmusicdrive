import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// ── POST /api/promo/validate ──────────────────────────────────────────────
// Validate and apply a promo code. Called before checkout.
router.post('/validate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { code, subtotal } = req.body;

    if (!code || !subtotal) {
      return res.status(400).json({ error: 'code and subtotal are required' });
    }

    // Find promo code
    const promo = await prisma.promoCode.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!promo) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    // Validate promo code
    if (!promo.isActive) {
      return res.status(400).json({ error: 'Promo code is inactive' });
    }

    if (promo.expiresAt && promo.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Promo code has expired' });
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ error: 'Promo code usage limit exceeded' });
    }

    if (promo.minOrder && subtotal < promo.minOrder) {
      return res.status(400).json({ 
        error: `Minimum order amount is ฿${promo.minOrder}` 
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.type === 'PERCENT') {
      discountAmount = Math.min(subtotal * (promo.value / 100), subtotal);
    } else if (promo.type === 'FIXED') {
      discountAmount = Math.min(promo.value, subtotal);
    }
    discountAmount = Math.round(discountAmount * 100) / 100;

    res.json({
      code: promo.code,
      type: promo.type,
      value: promo.value,
      description: promo.description,
      discountAmount,
      minOrder: promo.minOrder,
      expiresAt: promo.expiresAt,
    });
  } catch (error) {
    console.error('Promo validation error:', error);
    res.status(500).json({ error: 'Failed to validate promo code' });
  }
});

// ── GET /api/promo ────────────────────────────────────────────────────────
// Admin only — list all promo codes
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const promos = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return res.json(promos);
  } catch (error) {
    console.error('Error fetching promos:', error);
    return res.status(500).json({ error: 'Failed to fetch promo codes' });
  }
});

// ── POST /api/promo ───────────────────────────────────────────────────────
// Admin only — create a promo code
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { code, type, value, description, minOrder, maxUses, expiresAt } = req.body;

    if (!code || !type || value == null) {
      return res.status(400).json({ error: 'code, type, and value are required' });
    }

    if (!['PERCENT', 'FIXED'].includes(type)) {
      return res.status(400).json({ error: 'type must be PERCENT or FIXED' });
    }

    if (typeof value !== 'number' || value <= 0) {
      return res.status(400).json({ error: 'value must be a positive number' });
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: code.trim().toUpperCase(),
        type,
        value,
        description: description || null,
        minOrder: minOrder || null,
        maxUses: maxUses || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return res.status(201).json(promo);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Promo code already exists' });
    }
    console.error('Error creating promo:', error);
    return res.status(500).json({ error: 'Failed to create promo code' });
  }
});

// ── PATCH /api/promo/:id ──────────────────────────────────────────────────
// Admin only — update a promo code
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { code, type, value, description, minOrder, maxUses, expiresAt, isActive } = req.body;

    const data: any = {};
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (type !== undefined) {
      if (!['PERCENT', 'FIXED'].includes(type)) {
        return res.status(400).json({ error: 'type must be PERCENT or FIXED' });
      }
      data.type = type;
    }
    if (value !== undefined) data.value = value;
    if (description !== undefined) data.description = description;
    if (minOrder !== undefined) data.minOrder = minOrder;
    if (maxUses !== undefined) data.maxUses = maxUses;
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) data.isActive = isActive;

    const promo = await prisma.promoCode.update({
      where: { id: req.params.id as string },
      data,
    });

    return res.json(promo);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Promo code not found' });
    }
    console.error('Error updating promo:', error);
    return res.status(500).json({ error: 'Failed to update promo code' });
  }
});

// ── DELETE /api/promo/:id ─────────────────────────────────────────────────
// Admin only — delete a promo code
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await prisma.promoCode.delete({ where: { id: req.params.id as string } });
    return res.json({ message: 'Promo code deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Promo code not found' });
    }
    console.error('Error deleting promo:', error);
    return res.status(500).json({ error: 'Failed to delete promo code' });
  }
});

// ── GET /api/promo/:code ──────────────────────────────────────────────────
// Get promo code details (public, no auth)
router.get('/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.trim().toUpperCase() },
      select: {
        code: true,
        type: true,
        value: true,
        description: true,
        minOrder: true,
        expiresAt: true,
        isActive: true,
      }
    });

    if (!promo) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    res.json(promo);
  } catch (error) {
    console.error('Error fetching promo:', error);
    res.status(500).json({ error: 'Failed to fetch promo code' });
  }
});

export default router;
