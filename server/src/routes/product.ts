import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// ── GET /api/products ────────────────────────────────────────────────────────
// Public — list all products (used by storefront + admin)
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        include: { category: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count(),
    ]);

    return res.json({ data: products, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ── GET /api/products/:id ────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id as string },
      include: { category: { select: { name: true } } },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ── POST /api/products ───────────────────────────────────────────────────────
// Admin only — create a product
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, price, originalPrice, categoryName, stock, imageUrl, images, brand, sku, tags, specs, description } = req.body;

    if (!name || price == null) {
      return res.status(400).json({ error: 'name and price are required' });
    }

    // Find or create category
    let category = await prisma.category.findUnique({ where: { name: categoryName || 'Uncategorized' } });
    if (!category) {
      category = await prisma.category.create({ data: { name: categoryName || 'Uncategorized' } });
    }

    const product = await prisma.product.create({
      data: {
        name,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        stock: parseInt(stock) || 0,
        imageUrl: imageUrl || null,
        images: Array.isArray(images) ? images : [],
        brand: brand || null,
        sku: sku || null,
        tags: Array.isArray(tags) ? tags : [],
        specs: specs || null,
        description: description || null,
        categoryId: category.id,
      },
      include: { category: { select: { name: true } } },
    });

    return res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({ error: 'Failed to create product' });
  }
});

// ── PATCH /api/products/:id ──────────────────────────────────────────────────
// Admin only — update a product
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, price, originalPrice, categoryName, stock, imageUrl, images, brand, sku, tags, specs, description } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (price !== undefined) data.price = parseFloat(price);
    if (originalPrice !== undefined) data.originalPrice = originalPrice ? parseFloat(originalPrice) : null;
    if (stock !== undefined) data.stock = parseInt(stock) || 0;
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (images !== undefined) data.images = Array.isArray(images) ? images : [];
    if (brand !== undefined) data.brand = brand || null;
    if (sku !== undefined) data.sku = sku || null;
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags : [];
    if (specs !== undefined) data.specs = specs || null;
    if (description !== undefined) data.description = description || null;

    if (categoryName !== undefined) {
      let category = await prisma.category.findUnique({ where: { name: categoryName || 'Uncategorized' } });
      if (!category) {
        category = await prisma.category.create({ data: { name: categoryName || 'Uncategorized' } });
      }
      data.categoryId = category.id;
    }

    const product = await prisma.product.update({
      where: { id: req.params.id as string },
      data,
      include: { category: { select: { name: true } } },
    });

    return res.json(product);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    console.error('Error updating product:', error);
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

// ── DELETE /api/products/:id ─────────────────────────────────────────────────
// Admin only
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await prisma.product.delete({ where: { id: req.params.id as string } });
    return res.json({ message: 'Product deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    console.error('Error deleting product:', error);
    return res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
