import express, { Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// ==========================================
// CART ROUTES
// ==========================================

// Get user's cart
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Create cart if it doesn't exist
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });
    }

    res.json(cart);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Sync local cart to database
router.post('/sync', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { items } = req.body; // Array of { productId, quantity }

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Items must be an array' });
      return;
    }

    // Get or create cart
    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    // Process each item in the sync request
    for (const item of items) {
      const { productId, quantity } = item;

      // Check if product exists
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) continue;

      // Upsert cart item
      await prisma.cartItem.upsert({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: productId
          }
        },
        update: {
          quantity: quantity
        },
        create: {
          cartId: cart.id,
          productId: productId,
          quantity: quantity
        }
      });
    }

    // Return updated cart
    const updatedCart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    res.json(updatedCart);
  } catch (error) {
    console.error('Error syncing cart:', error);
    res.status(500).json({ error: 'Failed to sync cart' });
  }
});

// Add item to cart
router.post('/items', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId, quantity = 1 } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!productId) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({ error: 'Quantity must be a positive integer' });
      return;
    }

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check stock availability
    if (product.stock < quantity) {
      res.status(400).json({ error: `Insufficient stock. Only ${product.stock} available.` });
      return;
    }

    // Get or create cart
    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    // Add or update item
    const cartItem = await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: productId
        }
      },
      update: {
        quantity: { increment: quantity }
      },
      create: {
        cartId: cart.id,
        productId: productId,
        quantity: quantity
      },
      include: {
        product: true
      }
    });

    res.status(201).json(cartItem);
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// Update item quantity
router.put('/items/:productId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({ error: 'Quantity must be at least 1' });
      return;
    }

    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    const cartItem = await prisma.cartItem.update({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: String(productId)
        }
      },
      data: { quantity },
      include: {
        product: true
      }
    });

    res.json(cartItem);
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
});

// Remove item from cart
router.delete('/items/:productId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    await prisma.cartItem.delete({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: String(productId)
        }
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ error: 'Failed to remove cart item' });
  }
});

// Clear cart
router.delete('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      res.status(204).send();
      return;
    }

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

// ==========================================
// ORDER ROUTES
// ==========================================

// Create an order from the current cart
router.post('/checkout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // 1. Get the user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    // 2. Calculate total and prepare order items
    let totalAmount = 0;
    const orderItems = cart.items.map((item: any) => {
      totalAmount += item.product.price * item.quantity;
      return {
        productId: item.productId,
        quantity: item.quantity,
        priceAtTime: item.product.price,
      };
    });

    // 3. Use a transaction to create the order and clear the cart
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: 'PENDING',
          items: {
            create: orderItems
          }
        },
        include: {
          items: true
        }
      });

      // Clear the cart
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id }
      });

      return newOrder;
    });

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

export default router;
