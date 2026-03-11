import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Admin user
  const adminEmail = 'admin@btmusicdrive.store';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('btmusicdrive-admin-2025', 10);
    await prisma.user.create({
      data: { email: adminEmail, passwordHash, name: 'btmusicdrive Admin', role: 'ADMIN' },
    });
    console.log(`Admin user created: ${adminEmail} / btmusicdrive-admin-2025`);
  } else {
    console.log('Admin user already exists, skipping.');
  }

  // 2. Categories
  const accessoriesCategory = await prisma.category.upsert({
    where: { name: 'Accessories' },
    update: {},
    create: { name: 'Accessories' },
  });

  const shoesCategory = await prisma.category.upsert({
    where: { name: 'Shoes' },
    update: {},
    create: { name: 'Shoes' },
  });

  const clothingCategory = await prisma.category.upsert({
    where: { name: 'Clothing' },
    update: {},
    create: { name: 'Clothing' },
  });

  console.log('Categories seeded.');

  // 3. Products (prices in Thai Baht ฿)
  const products = [
    {
      name: "Minimalist Leather Watch",
      price: 4590,
      categoryId: accessoriesCategory.id,
      imageUrl: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      description: "A sleek, minimalist leather watch perfect for any occasion.",
      stock: 50,
    },
    {
      name: "Classic White Sneakers",
      price: 2990,
      categoryId: shoesCategory.id,
      imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      description: "Comfortable and stylish white sneakers.",
      stock: 100,
    },
    {
      name: "Cotton Essentials T-Shirt",
      price: 590,
      categoryId: clothingCategory.id,
      imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      description: "Premium cotton t-shirt for everyday wear.",
      stock: 200,
    },
    {
      name: "Premium Denim Jacket",
      price: 3990,
      categoryId: clothingCategory.id,
      imageUrl: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      description: "High-quality denim jacket with a classic fit.",
      stock: 30,
    },
    {
      name: "Canvas Weekend Bag",
      price: 1890,
      categoryId: accessoriesCategory.id,
      imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      description: "Durable canvas bag for weekend getaways.",
      stock: 45,
    },
    {
      name: "Polarized Sunglasses",
      price: 1290,
      categoryId: accessoriesCategory.id,
      imageUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      description: "Stylish polarized sunglasses with UV protection.",
      stock: 80,
    },
    {
      name: "Wool Blend Coat",
      price: 6990,
      categoryId: clothingCategory.id,
      imageUrl: "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      description: "Warm and elegant wool blend coat.",
      stock: 20,
    },
    {
      name: "Leather Crossbody Bag",
      price: 3290,
      categoryId: accessoriesCategory.id,
      imageUrl: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      description: "Compact and stylish leather crossbody bag.",
      stock: 60,
    }
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  console.log('Products seeded (prices in THB).');
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
