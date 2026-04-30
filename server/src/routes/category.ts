import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// ── GET /api/categories ────────────────────────────────────────────────────
// Public — list all categories with product counts
router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    const result = categories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      productCount: c._count.products,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.json(result);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ── POST /api/categories ───────────────────────────────────────────────────
// Admin — create category
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { name, slug } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const trimmedName = name.trim();
    const existing = await prisma.category.findUnique({ where: { name: trimmedName } });
    if (existing) {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }
    const category = await prisma.category.create({
      data: {
        name: trimmedName,
        slug: slug ? String(slug).trim() : null,
      },
    });
    return res.status(201).json(category);
  } catch (error: any) {
    console.error('Error creating category:', error);
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Category name or slug already exists' });
    }
    return res.status(500).json({ error: 'Failed to create category' });
  }
});

// ── PATCH /api/categories/:id ──────────────────────────────────────────────
// Admin — update category name/slug
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const id = String(req.params.id);
    const { name, slug } = req.body;
    const data: { name?: string; slug?: string | null } = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (slug !== undefined) data.slug = slug ? String(slug).trim() : null;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const category = await prisma.category.update({ where: { id }, data });
    return res.json(category);
  } catch (error: any) {
    console.error('Error updating category:', error);
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Category not found' });
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Name or slug already in use' });
    return res.status(500).json({ error: 'Failed to update category' });
  }
});

// ── DELETE /api/categories/:id ─────────────────────────────────────────────
// Admin — delete category (only if no products linked)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const id = String(req.params.id);
    const cat = await prisma.category.findFirst({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    if (cat._count.products > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${cat._count.products} products still linked. Move them first.`,
      });
    }
    await prisma.category.delete({ where: { id } });
    return res.json({ message: 'Category deleted', id });
  } catch (error) {
    console.error('Error deleting category:', error);
    return res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
