/**
 * seed-new-products.mjs
 * Import 8 new products (SKU-055, 059, 064, 068, 077, 084, 093, 098) into Neon DB
 * Run: node server/scripts/seed-new-products.mjs
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');

// โหลด env
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const prisma = new PrismaClient();

const NEW_PRODUCTS = [
  {
    id:            'sku-055-usb-mp3-bodyslam',
    name:          'USB แฟลชไดรฟ์ MP3 รวมทุกเพลง Bodyslam ครบทุกอัลบั้ม',
    slug:          'usb-mp3-bodyslam',
    price:         279,
    originalPrice: 399,
    description:   'USB แฟลชไดรฟ์ MP3 รวมทุกเพลง Bodyslam ครบทุกอัลบั้ม เสียงชัด 128kbps เสียบฟังได้ทันทีในรถยนต์ ลำโพง คอมพิวเตอร์ รับประกันสินค้า 100%',
    imageUrl:      '/images/products/usb-mp3-bodyslam/usb-mp3-bodyslam-1.jpg',
    images:        [1,2,3,4].map(i => `/images/products/usb-mp3-bodyslam/usb-mp3-bodyslam-${i}.webp`),
    sku:           'SKU-055',
    categoryId:    '94703150-5b4b-4344-80cf-baadcdc0d0b2', // เพลงสตริง
    tags:          ['USB','MP3','Bodyslam','บอดี้สแลม','สตริง','ร็อค'],
    specs:         { ความจุ:'1GB', รองรับ:'เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพง', รูปแบบ:'USB แฟลชไดรฟ์ 2.0', แบรนด์:'btmusicdrive', ไฟล์เพลง:'MP3 128kbps' },
  },
  {
    id:            'sku-059-usb-mp3-sai-string',
    name:          'USB แฟลชไดรฟ์ MP3 รวมเพลงฮิตสายสตริงมาแรง ครบทุกเพลงโปรด',
    slug:          'usb-mp3-ruam-hit-sai-string',
    price:         279,
    originalPrice: 399,
    description:   'USB แฟลชไดรฟ์ MP3 รวมเพลงฮิตสายสตริงมาแรง ครบทุกเพลงโปรด เสียงชัด 128kbps เสียบฟังได้ทันทีในรถยนต์ ลำโพง คอมพิวเตอร์ รับประกันสินค้า 100%',
    imageUrl:      '/images/products/usb-mp3-ruam-hit-sai-string/usb-mp3-ruam-hit-sai-string-1.jpg',
    images:        [1,2,3,4].map(i => `/images/products/usb-mp3-ruam-hit-sai-string/usb-mp3-ruam-hit-sai-string-${i}.jpg`),
    sku:           'SKU-059',
    categoryId:    '94703150-5b4b-4344-80cf-baadcdc0d0b2', // เพลงสตริง
    tags:          ['USB','MP3','สตริง','รวมเพลงฮิต','สายสตริง'],
    specs:         { ความจุ:'1GB', รองรับ:'เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพง', รูปแบบ:'USB แฟลชไดรฟ์ 2.0', แบรนด์:'btmusicdrive', ไฟล์เพลง:'MP3 128kbps' },
  },
  {
    id:            'sku-064-usb-mp3-dance',
    name:          'USB แฟลชไดรฟ์ MP3 รวมเพลงแดนซ์มันส์ EDM Remix สนุกตลอดเวลา',
    slug:          'usb-mp3-dance',
    price:         279,
    originalPrice: 399,
    description:   'USB แฟลชไดรฟ์ MP3 รวมเพลงแดนซ์มันส์ EDM Remix สนุกตลอดเวลา เสียงชัด 128kbps เสียบฟังได้ทันทีในรถยนต์ ลำโพง คอมพิวเตอร์ รับประกันสินค้า 100%',
    imageUrl:      '/images/products/usb-mp3-dance/usb-mp3-dance-1.jpg',
    images:        [1,2,3,4].map(i => `/images/products/usb-mp3-dance/usb-mp3-dance-${i}.jpg`),
    sku:           'SKU-064',
    categoryId:    '544a4ff7-a25d-4a38-8b74-59b67ba9efa8', // แดนซ์
    tags:          ['USB','MP3','แดนซ์','EDM','Remix','Dance'],
    specs:         { ความจุ:'1GB', รองรับ:'เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพง', รูปแบบ:'USB แฟลชไดรฟ์ 2.0', แบรนด์:'btmusicdrive', ไฟล์เพลง:'MP3 128kbps' },
  },
  {
    id:            'sku-068-usb-mp3-yuk-90',
    name:          'USB แฟลชไดรฟ์ MP3 รวมเพลงสตริงยุค 90 เพลงเพราะตลอดกาล',
    slug:          'usb-mp3-phleng-yuk-90',
    price:         279,
    originalPrice: 399,
    description:   'USB แฟลชไดรฟ์ MP3 รวมเพลงสตริงยุค 90 เพลงเพราะตลอดกาล เสียงชัด 128kbps เสียบฟังได้ทันทีในรถยนต์ ลำโพง คอมพิวเตอร์ รับประกันสินค้า 100%',
    imageUrl:      '/images/products/usb-mp3-phleng-yuk-90/usb-mp3-phleng-yuk-90-1.jpg',
    images:        [1,2,3,4].map(i => `/images/products/usb-mp3-phleng-yuk-90/usb-mp3-phleng-yuk-90-${i}.jpg`),
    sku:           'SKU-068',
    categoryId:    '94703150-5b4b-4344-80cf-baadcdc0d0b2', // เพลงสตริง
    tags:          ['USB','MP3','สตริง','ยุค 90','90s'],
    specs:         { ความจุ:'1GB', รองรับ:'เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพง', รูปแบบ:'USB แฟลชไดรฟ์ 2.0', แบรนด์:'btmusicdrive', ไฟล์เพลง:'MP3 128kbps' },
  },
  {
    id:            'sku-077-usb-mp3-sakol',
    name:          'USB แฟลชไดรฟ์ MP3 รวมเพลงสากล ฟังเพลินทุกที่ทุกเวลา',
    slug:          'usb-mp3-sakol-sku-077',
    price:         279,
    originalPrice: 399,
    description:   'USB แฟลชไดรฟ์ MP3 รวมเพลงสากลเพราะๆ ฟังเพลินทุกที่ทุกเวลา เสียงชัด 128kbps เสียบฟังได้ทันทีในรถยนต์ ลำโพง คอมพิวเตอร์ รับประกัน 100%',
    imageUrl:      '/images/products/usb-mp3-sakol-sku-077/usb-mp3-sakol-sku-077-1.jpg',
    images:        [1,2,3,4].map(i => `/images/products/usb-mp3-sakol-sku-077/usb-mp3-sakol-sku-077-${i}.jpg`),
    sku:           'SKU-077',
    categoryId:    '498cf176-187c-4f40-b7e6-bad12e999212', // เพลงสากล
    tags:          ['USB','MP3','สากล','Pop','Rock'],
    specs:         { ความจุ:'1GB', รองรับ:'เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพง', รูปแบบ:'USB แฟลชไดรฟ์ 2.0', แบรนด์:'btmusicdrive', ไฟล์เพลง:'MP3 128kbps' },
  },
  {
    id:            'sku-084-usb-mp3-phleng-sakol',
    name:          'USB แฟลชไดรฟ์ MP3 รวมเพลงสากลเพราะๆ ฟังสบาย Pop Rock R&B',
    slug:          'usb-mp3-ruam-phleng-sakol',
    price:         279,
    originalPrice: 399,
    description:   'USB แฟลชไดรฟ์ MP3 รวมเพลงสากลเพราะๆ ฟังสบาย Pop Rock R&B เสียงชัด 128kbps เสียบฟังได้ทันทีในรถยนต์ ลำโพง คอมพิวเตอร์ รับประกันสินค้า 100%',
    imageUrl:      '/images/products/usb-mp3-ruam-phleng-sakol/usb-mp3-ruam-phleng-sakol-1.jpg',
    images:        [1,2,3,4].map(i => `/images/products/usb-mp3-ruam-phleng-sakol/usb-mp3-ruam-phleng-sakol-${i}.jpg`),
    sku:           'SKU-084',
    categoryId:    '498cf176-187c-4f40-b7e6-bad12e999212', // เพลงสากล
    tags:          ['USB','MP3','สากล','Pop','Rock','R&B'],
    specs:         { ความจุ:'1GB', รองรับ:'เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพง', รูปแบบ:'USB แฟลชไดรฟ์ 2.0', แบรนด์:'btmusicdrive', ไฟล์เพลง:'MP3 128kbps' },
  },
  {
    id:            'sku-093-usb-mp3-aoi-damkan',
    name:          'USB แฟลชไดรฟ์ MP3 อ๋อย ดำกาฬ ชุดแรก-ปัจจุบัน 2530-2566 ครบทุกอัลบั้ม',
    slug:          'usb-mp3-aoi-damkan',
    price:         279,
    originalPrice: 399,
    description:   'USB แฟลชไดรฟ์ MP3 รวมเพลง อ๋อย ดำกาฬ ครบทุกอัลบั้มตั้งแต่ชุดแรกจนถึงปัจจุบัน 2530-2566 เสียงชัด 128kbps เสียบฟังได้ทันทีในรถยนต์ ลำโพง คอมพิวเตอร์ รับประกันสินค้า 100%',
    imageUrl:      '/images/products/usb-mp3-aoi-damkan/usb-mp3-aoi-damkan-1.jpg',
    images:        [1,2,3,4].map(i => `/images/products/usb-mp3-aoi-damkan/usb-mp3-aoi-damkan-${i}.jpg`),
    sku:           'SKU-093',
    categoryId:    'cd841ef3-c7f6-48d8-81f7-6069eaf2b63a', // เพื่อชีวิต
    tags:          ['USB','MP3','อ๋อย ดำกาฬ','เพื่อชีวิต','ลูกทุ่ง'],
    specs:         { ความจุ:'2GB', รองรับ:'เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพง', รูปแบบ:'USB แฟลชไดรฟ์ 2.0', แบรนด์:'btmusicdrive', ไฟล์เพลง:'MP3 128kbps' },
  },
  {
    id:            'sku-098-usb-mp3-hit-yuk-90',
    name:          'USB แฟลชไดรฟ์ MP3 รวมฮิตยุค 90 คิด(ถึง)ถึง เพลงเพราะจากยุคทอง',
    slug:          'usb-mp3-hit-yuk-90-khit-thueng',
    price:         319,
    originalPrice: 499,
    description:   'USB แฟลชไดรฟ์ MP3 รวมฮิตยุค 90 คิด(ถึง)ถึง เพลงเพราะจากยุคทอง เสียงชัด 128kbps เสียบฟังได้ทันทีในรถยนต์ ลำโพง คอมพิวเตอร์ รับประกันสินค้า 100%',
    imageUrl:      '/images/products/usb-mp3-hit-yuk-90-khit-thueng/usb-mp3-hit-yuk-90-khit-thueng-1.jpg',
    images:        [1,2,3,4].map(i => `/images/products/usb-mp3-hit-yuk-90-khit-thueng/usb-mp3-hit-yuk-90-khit-thueng-${i}.jpg`),
    sku:           'SKU-098',
    categoryId:    '94703150-5b4b-4344-80cf-baadcdc0d0b2', // เพลงสตริง
    tags:          ['USB','MP3','สตริง','ยุค 90','90s','คิดถึง'],
    specs:         { ความจุ:'2GB', รองรับ:'เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพง', รูปแบบ:'USB แฟลชไดรฟ์ 2.0', แบรนด์:'btmusicdrive', ไฟล์เพลง:'MP3 128kbps' },
  },
];

(async () => {
  try {
    let created = 0, updated = 0;

    for (const p of NEW_PRODUCTS) {
      const result = await prisma.product.upsert({
        where:  { slug: p.slug },
        update: {
          name:          p.name,
          imageUrl:      p.imageUrl,
          images:        p.images,
          price:         p.price,
          originalPrice: p.originalPrice,
          description:   p.description,
          tags:          p.tags,
          specs:         p.specs,
          sku:           p.sku,
          categoryId:    p.categoryId,
        },
        create: {
          id:            p.id,
          name:          p.name,
          slug:          p.slug,
          price:         p.price,
          originalPrice: p.originalPrice,
          description:   p.description,
          imageUrl:      p.imageUrl,
          images:        p.images,
          brand:         'btmusicdrive',
          sku:           p.sku,
          stock:         100,
          tags:          p.tags,
          tracklist:     [],
          specs:         p.specs,
          categoryId:    p.categoryId,
        },
      });

      const isNew = result.id === p.id;
      if (isNew) { created++; console.log(`  [NEW]    ${p.sku} ${p.slug}`); }
      else        { updated++; console.log(`  [UPDATE] ${p.sku} ${p.slug}`); }
    }

    console.log(`\nเสร็จ: สร้างใหม่ ${created} | อัปเดต ${updated}`);

    // sync products.json จาก DB ใหม่
    const all = await prisma.product.findMany({
      orderBy: { createdAt: 'asc' },
      include: { category: { select: { id: true, name: true } } },
    });
    const shaped = all.map(p => ({
      id: p.id, name: p.name, slug: p.slug,
      price: p.price, originalPrice: p.originalPrice,
      description: p.description, imageUrl: p.imageUrl,
      images: p.images || [], brand: p.brand,
      sku: p.sku, stock: p.stock,
      tags: p.tags || [], tracklist: p.tracklist || [],
      specs: p.specs || {}, categoryId: p.categoryId,
      category: p.category ? { id: p.category.id, name: p.category.name } : null,
    }));

    import('fs').then(({ writeFileSync }) => {
      import('path').then(({ join, dirname }) => {
        import('url').then(({ fileURLToPath }) => {
          const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'products.json');
          writeFileSync(out, JSON.stringify(shaped, null, 2) + '\n', 'utf8');
          console.log(`products.json อัปเดตแล้ว (${shaped.length} สินค้า)`);
        });
      });
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
})();
