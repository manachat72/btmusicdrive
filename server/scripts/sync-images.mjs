import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Map: DB product id → { imageUrl, images[] }
// เฉพาะที่แม็ปได้ชัดจากชื่อสินค้า (confident matches)
const updates = [
  {
    id: '681e3e84-9875-48b4-92b1-f6e843ff8f8d',
    label: 'คาราบาว 4GB (placeholder)',
    imageUrl: '/images/USB Flash Drive Mp3 Songs for Life Carabao.webp',
    images: [
      '/images/USB Flash Drive Mp3 Songs for Life Carabao.webp',
      '/images/USB Flash Drive Mp3 Songs for Life Carabao (2).webp',
    ],
  },
  {
    id: '0dacbca3-2e6b-48fa-b6c1-31c4386aaf8a',
    label: 'เสียงสตอ สำเนียงใต้แท้ (dup)',
    imageUrl: "/images/Authentic Southern Thai Accent (Siang Sataw) - MP3 USB Drive.webp",
    images: [
      "/images/Authentic Southern Thai Accent (Siang Sataw) - MP3 USB Drive.webp",
      "/images/Authentic Southern Thai Accent (Siang Sataw) - MP3 USB Drive (2).webp",
      "/images/Authentic Southern Thai Accent (Siang Sataw) - MP3 USB Drive (3).webp",
      "/images/Authentic Southern Thai Accent (Siang Sataw) - MP3 USB Drive (4).webp",
    ],
  },
  {
    id: 'a2646e9f-99af-4f18-8856-251064cdd035',
    label: 'รวมเพลงใต้ - สำเนียงดนตรีใต้',
    imageUrl: '/images/USB_MP3_Southern_Memories_Original.webp',
    images: [
      '/images/USB_MP3_Southern_Memories_Original.webp',
      '/images/USB_MP3_Southern_Memories_Original (2).webp',
      '/images/USB_MP3_Southern_Memories_Original (3).webp',
      '/images/USB_MP3_Southern_Memories_Original (4).webp',
    ],
  },
  {
    id: '586c892b-9474-4bc4-8184-0e00cde55b3a',
    label: 'เพลงใต้ฮิต',
    imageUrl: '/images/USB_MP3_Southern_Memories_Original.webp',
    images: [
      '/images/USB_MP3_Southern_Memories_Original.webp',
      '/images/USB_MP3_Southern_Memories_Original (2).webp',
    ],
  },
  {
    id: 'd56940ff-484c-41b5-bb49-2241a8e98524',
    label: 'ลูกทุ่งอินดี้',
    imageUrl: '/images/USB Flash Drive Mp3 Includes Country Hits, Indie Music.webp',
    images: [
      '/images/USB Flash Drive Mp3 Includes Country Hits, Indie Music.webp',
      '/images/USB Flash Drive Mp3 Includes Country Hits, Indie Music (2).webp',
      '/images/USB Flash Drive Mp3 Includes Country Hits, Indie Music (4).webp',
    ],
  },
  {
    id: '6e31297b-2394-4aa9-ab80-1a8f0abed9eb',
    label: 'ลูกทุ่งร่วมสมัย ฮิตติดเทรนด์',
    imageUrl: '/images/USB Flash Drive Mp3 Includes Country Hits, Indie Music.webp',
    images: [
      '/images/USB Flash Drive Mp3 Includes Country Hits, Indie Music.webp',
      '/images/USB Flash Drive Mp3 Includes Country Hits, Indie Music111.webp',
    ],
  },
  {
    id: 'd43de62d-c693-4a52-ae8e-8d16cd8f00fc',
    label: 'CD รวมเพลงยุค 90',
    imageUrl: '/images/usb-flash-drive-mp3-90s-greatest-hits.webp',
    images: [
      '/images/usb-flash-drive-mp3-90s-greatest-hits.webp',
      '/images/usb-flash-drive-mp3-90s-greatest-hits (2).webp',
      '/images/usb-flash-drive-mp3-90s-greatest-hits (3).webp',
      '/images/usb-flash-drive-mp3-90s-greatest-hits (4).webp',
    ],
  },
  {
    id: '55488a22-c60c-413e-b569-e65ec59ceb46',
    label: 'เพลงเก่าคลาสสิก 90s',
    imageUrl: '/images/usb-flash-drive-mp3-90s-greatest-hits.webp',
    images: [
      '/images/usb-flash-drive-mp3-90s-greatest-hits.webp',
      '/images/usb-flash-drive-mp3-90s-greatest-hits (2).webp',
    ],
  },
  {
    id: '4a1593be-a141-4bd6-804e-8c3f6c908472',
    label: '3 ช่าเพื่อชีวิต ฮิตไม่มีวันลืม',
    imageUrl: '/images/USB_MP3_3Cha_PeuaChiwit_Cover.webp',
    images: [
      '/images/USB_MP3_3Cha_PeuaChiwit_Cover.webp',
      '/images/USB_MP3_3Cha_PeuaChiwit_Cover (2).webp',
      '/images/USB_MP3_3Cha_PeuaChiwit_Cover (3).webp',
    ],
  },
  {
    id: 'b43f787a-5684-4fe4-8f0b-19c938811fbc',
    label: 'ลูกกรุง เสียงเพลงอมตะ',
    imageUrl: '/images/USB Flash Drive Mp3 Su Narathip.webp',
    images: [
      '/images/USB Flash Drive Mp3 Su Narathip.webp',
      '/images/USB Flash Drive Mp3 Su Narathip (2).webp',
      '/images/USB Flash Drive Mp3 Su Narathip (3).webp',
    ],
  },
  {
    id: '85deef4f-810d-4c83-981a-5332cb87a5ba',
    label: 'สตริงยุค 80',
    imageUrl: "/images/USB Flash Drive Mp3 Includes 80's Era String Music – Classic Songs of Memories.webp",
    images: [
      "/images/USB Flash Drive Mp3 Includes 80's Era String Music – Classic Songs of Memories.webp",
      "/images/USB Flash Drive Mp3 Includes 80's Era String Music – Classic Songs of Memories (2).webp",
      "/images/USB Flash Drive Mp3 Includes 80's Era String Music.webp",
    ],
  },
  {
    id: '4b075bde-9cb4-47c5-83d0-55c45994b835',
    label: 'รวมเพลงเพื่อชีวิต (generic)',
    imageUrl: '/images/USB_MP3_3Cha_PeuaChiwit_Cover.webp',
    images: [
      '/images/USB_MP3_3Cha_PeuaChiwit_Cover.webp',
      '/images/USB_MP3_3Cha_PeuaChiwit_Cover (2).webp',
    ],
  },
];

console.log(`Updating ${updates.length} products...\n`);

for (const u of updates) {
  try {
    const before = await prisma.product.findUnique({
      where: { id: u.id },
      select: { name: true, imageUrl: true },
    });
    if (!before) {
      console.log(`SKIP [${u.id}] not found`);
      continue;
    }
    await prisma.product.update({
      where: { id: u.id },
      data: { imageUrl: u.imageUrl, images: u.images },
    });
    console.log(`OK   [${u.label}]`);
    console.log(`     ${before.imageUrl}`);
    console.log(`  -> ${u.imageUrl}\n`);
  } catch (err) {
    console.error(`FAIL [${u.id}]`, err.message);
  }
}

await prisma.$disconnect();
console.log('Done.');
