import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// ── GET /api/menus ─────────────────────────────────────────────────────────
// Public — get all active menu items (for storefront navbar)
router.get('/', async (req: Request, res: Response) => {
  try {
    const menus = await prisma.menuItem.findMany({
      where: { isActive: true, parentId: null },
      include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    return res.json(menus);
  } catch (error) {
    console.error('Error fetching menus:', error);
    return res.status(500).json({ error: 'Failed to fetch menus' });
  }
});

// ── GET /api/menus/all ─────────────────────────────────────────────────────
// Admin — get ALL menu items (including inactive)
router.get('/all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const menus = await prisma.menuItem.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    return res.json(menus);
  } catch (error) {
    console.error('Error fetching all menus:', error);
    return res.status(500).json({ error: 'Failed to fetch menus' });
  }
});

// ── POST /api/menus ────────────────────────────────────────────────────────
// Admin — create menu item
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { label, url, icon, sortOrder, isActive, parentId } = req.body;

    if (!label || !url) {
      return res.status(400).json({ error: 'label and url are required' });
    }

    const menu = await prisma.menuItem.create({
      data: {
        label,
        url,
        icon: icon || null,
        sortOrder: parseInt(sortOrder) || 0,
        isActive: isActive !== false,
        parentId: parentId || null,
      },
    });

    return res.status(201).json(menu);
  } catch (error) {
    console.error('Error creating menu:', error);
    return res.status(500).json({ error: 'Failed to create menu' });
  }
});

// ── PATCH /api/menus/:id ───────────────────────────────────────────────────
// Admin — update menu item
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { label, url, icon, sortOrder, isActive, parentId } = req.body;
    const data: any = {};
    if (label !== undefined) data.label = label;
    if (url !== undefined) data.url = url;
    if (icon !== undefined) data.icon = icon || null;
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder) || 0;
    if (isActive !== undefined) data.isActive = isActive;
    if (parentId !== undefined) data.parentId = parentId || null;

    const menu = await prisma.menuItem.update({
      where: { id: req.params.id as string },
      data,
    });

    return res.json(menu);
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Menu not found' });
    console.error('Error updating menu:', error);
    return res.status(500).json({ error: 'Failed to update menu' });
  }
});

// ── DELETE /api/menus/:id ──────────────────────────────────────────────────
// Admin — delete menu item
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Delete children first
    await prisma.menuItem.deleteMany({ where: { parentId: req.params.id as string } });
    await prisma.menuItem.delete({ where: { id: req.params.id as string } });

    return res.json({ message: 'Menu deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Menu not found' });
    console.error('Error deleting menu:', error);
    return res.status(500).json({ error: 'Failed to delete menu' });
  }
});

// ── PUT /api/menus/reorder ─────────────────────────────────────────────────
// Admin — bulk reorder
router.put('/reorder', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { items } = req.body; // [{ id, sortOrder }]
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items array required' });
    }

    await Promise.all(
      items.map((item: { id: string; sortOrder: number }) =>
        prisma.menuItem.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
      )
    );

    return res.json({ message: 'Reordered' });
  } catch (error) {
    console.error('Error reordering menus:', error);
    return res.status(500).json({ error: 'Failed to reorder' });
  }
});

export default router;
