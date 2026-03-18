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
