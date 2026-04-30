import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { categoryNameKey, normalizeCategoryName } from '../lib/categoryName';
import { resolveProductSlug, shouldRefreshProductSlug } from '../lib/productSlug';

const router = Router();
const PRODUCT_DESCRIPTION_PLACEHOLDERS = new Set(['ไดร์ฟเพลงคุณภาพสูง']);

function normalizeDescription(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || PRODUCT_DESCRIPTION_PLACEHOLDERS.has(text)) return null;
  return text;
}

function withNormalizedCategory<T extends { category?: any }>(p: T): T {
  if (!p?.category?.name) return p;
  return {
    ...p,
    category: {
      ...p.category,
      name: normalizeCategoryName(p.category.name),
    },
  };
}

async function findOrCreateCategory(categoryName: unknown) {
  const name = normalizeCategoryName(
    typeof categoryName === 'string' && categoryName.trim() ? categoryName : 'Uncategorized',
  );
  const key = categoryNameKey(name);
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, slug: true },
  });
  const existing =
    categories.find(c => c.name === name) ||
    categories.find(c => categoryNameKey(c.name) === key && c.slug) ||
    categories.find(c => categoryNameKey(c.name) === key);

  if (existing) return existing;
  return prisma.category.create({
    data: { name },
    select: { id: true, name: true, slug: true },
  });
}

// Append ?v=<updatedAt timestamp> to image URLs so browsers refetch when admin
// updates a product, but still cache aggressively when nothing changed.
function bustUrl(url: string | null | undefined, v: number): string | null | undefined {
  if (!url) return url;
  if (/^(data:|blob:)/i.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${v}`;
}
function withImageVersion<T extends { imageUrl?: string | null; images?: any; updatedAt?: Date | string | null }>(p: T): T {
  if (!p || !p.updatedAt) return p;
  const v = new Date(p.updatedAt as any).getTime();
  if (!v) return p;
  const out: any = { ...p };
  if (p.imageUrl) out.imageUrl = bustUrl(p.imageUrl, v);
  if (Array.isArray(p.images)) out.images = p.images.map((u: any) => typeof u === 'string' ? bustUrl(u, v) : u);
  return out;
}

// ── GET /api/products ────────────────────────────────────────────────────────
// Public — list all products (used by storefront + admin)
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;
    // admin=1 returns all including hidden; storefront only gets active
    const isAdmin = req.query.admin === '1';
    const where = isAdmin ? {} : { isActive: true };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const normalizedProducts = products.map(withNormalizedCategory);
    const data = isAdmin ? normalizedProducts : normalizedProducts.map(withImageVersion);
    if (!isAdmin) {
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    }
    return res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ── GET /api/products/slug/:slug ─────────────────────────────────────────────
// Public — find product by slug (for clean URLs like /product/001-flashdrive-lukthung)
router.get('/slug/:slug', async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug as string },
      include: { category: { select: { name: true, slug: true } } },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.json(withImageVersion(withNormalizedCategory(product)));
  } catch (error) {
    console.error('Error fetching product by slug:', error);
    return res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ── GET /api/products/:id ────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id as string },
      include: { category: { select: { name: true, slug: true } } },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.json(withImageVersion(withNormalizedCategory(product)));
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

    const { name, price, originalPrice, categoryName, stock, imageUrl, images, brand, sku, slug, tags, tracklist, specs, description } = req.body;

    if (!name || price == null) {
      return res.status(400).json({ error: 'name and price are required' });
    }

    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock) || 0;
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }
    if (parsedStock < 0) {
      return res.status(400).json({ error: 'stock cannot be negative' });
    }

    // Find or create category, collapsing visually duplicate Thai spellings.
    const category = await findOrCreateCategory(categoryName);
    const productSlug = await resolveProductSlug(slug, name, sku);

    const product = await prisma.product.create({
      data: {
        name,
        price: parsedPrice,
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        stock: parsedStock,
        imageUrl: imageUrl || null,
        images: Array.isArray(images) ? images : [],
        brand: brand || null,
        sku: sku || null,
        slug: productSlug,
        tags: Array.isArray(tags) ? tags : [],
        tracklist: Array.isArray(tracklist) ? tracklist : [],
        specs: specs || null,
        description: normalizeDescription(description),
        categoryId: category.id,
      },
      include: { category: { select: { name: true, slug: true } } },
    });

    return res.status(201).json(product);
  } catch (error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
      return res.status(409).json({ error: 'Slug already exists, please use a different slug' });
    }
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

    const { name, price, originalPrice, categoryName, stock, imageUrl, images, brand, sku, slug, tags, tracklist, specs, description, isActive } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, name: true, sku: true, slug: true },
    });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (price !== undefined) data.price = parseFloat(price);
    if (originalPrice !== undefined) data.originalPrice = originalPrice ? parseFloat(originalPrice) : null;
    if (stock !== undefined) data.stock = parseInt(stock) || 0;
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (images !== undefined) data.images = Array.isArray(images) ? images : [];
    if (brand !== undefined) data.brand = brand || null;
    if (sku !== undefined) data.sku = sku || null;
    if (slug !== undefined) {
      data.slug = await resolveProductSlug(
        slug,
        name !== undefined ? name : existingProduct.name,
        sku !== undefined ? sku : existingProduct.sku,
        existingProduct.id,
      );
    } else if (shouldRefreshProductSlug(existingProduct.slug)) {
      data.slug = await resolveProductSlug(
        existingProduct.slug,
        name !== undefined ? name : existingProduct.name,
        sku !== undefined ? sku : existingProduct.sku,
        existingProduct.id,
      );
    }
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags : [];
    if (tracklist !== undefined) data.tracklist = Array.isArray(tracklist) ? tracklist : [];
    if (specs !== undefined) data.specs = specs || null;
    if (description !== undefined) data.description = normalizeDescription(description);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (categoryName !== undefined) {
      const category = await findOrCreateCategory(categoryName);
      data.categoryId = category.id;
    }

    const product = await prisma.product.update({
      where: { id: req.params.id as string },
      data,
      include: { category: { select: { name: true, slug: true } } },
    });

    return res.json(product);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
      return res.status(409).json({ error: 'Slug already exists, please use a different slug' });
    }
    console.error('Error updating product:', error);
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

// ── POST /api/products/bulk-import ──────────────────────────────────────────
// Admin only — create multiple products from XLSX export
router.post('/bulk-import', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'products array is required and must not be empty' });
    }
    if (products.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 products per import' });
    }

    const results: { index: number; name: string; status: 'created' | 'error'; error?: string }[] = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      try {
        if (!p.name || p.price == null) {
          results.push({ index: i, name: p.name || `Row ${i + 1}`, status: 'error', error: 'name and price are required' });
          continue;
        }

        const parsedPrice = parseFloat(p.price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
          results.push({ index: i, name: p.name, status: 'error', error: 'price must be a positive number' });
          continue;
        }

        const parsedStock = parseInt(p.stock) || 0;
        const catName = p.categoryName || p.category || 'Uncategorized';

        const category = await findOrCreateCategory(catName);
        const productSlug = await resolveProductSlug(p.slug, p.name, p.sku);

        const tags = typeof p.tags === 'string'
          ? p.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
          : (Array.isArray(p.tags) ? p.tags : []);

        const tracklist = typeof p.tracklist === 'string'
          ? p.tracklist.split('\n').map((t: string) => t.trim()).filter(Boolean)
          : (Array.isArray(p.tracklist) ? p.tracklist : []);

        let specs: any = null;
        if (typeof p.specs === 'string' && p.specs.trim()) {
          specs = {};
          p.specs.split('\n').forEach((line: string) => {
            const [k, ...rest] = line.split('=');
            if (k && rest.length) specs[k.trim()] = rest.join('=').trim();
          });
        } else if (p.specs && typeof p.specs === 'object') {
          specs = p.specs;
        }

        await prisma.product.create({
          data: {
            name: String(p.name),
            price: parsedPrice,
            originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : null,
            stock: parsedStock,
            imageUrl: p.imageUrl || null,
            images: Array.isArray(p.images) ? p.images : [],
            brand: p.brand || null,
            sku: p.sku || null,
            slug: productSlug,
            tags,
            tracklist,
            specs,
            description: normalizeDescription(p.description),
            categoryId: category.id,
          },
        });

        results.push({ index: i, name: p.name, status: 'created' });
      } catch (err: any) {
        results.push({ index: i, name: p.name || `Row ${i + 1}`, status: 'error', error: err.message });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const errors  = results.filter(r => r.status === 'error').length;

    return res.status(201).json({ created, errors, results });
  } catch (error) {
    console.error('Error bulk importing products:', error);
    return res.status(500).json({ error: 'Failed to bulk import products' });
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
