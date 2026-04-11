import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Admin user
  const adminEmail = 'admin@btmusicdrive.store';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('nu3gtXBTlef6i4wmnqjjcw', 10);
    await prisma.user.create({
      data: { email: adminEmail, passwordHash, name: 'btmusicdrive Admin', role: 'ADMIN' },
    });
    console.log(`Admin user created: ${adminEmail}`);
  } else {
    console.log('Admin user already exists, skipping.');
  }

  // 2. Delete old placeholder products & categories
  await prisma.cartItem.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  console.log('Cleared old products & categories.');

  // 3. Categories (แนวเพลง)
  const catPheaChiwit = await prisma.category.create({ data: { name: 'เพื่อชีวิต' } });
  const catString = await prisma.category.create({ data: { name: 'เพลงสตริง' } });
  const catLukthung = await prisma.category.create({ data: { name: 'ลูกทุ่ง' } });
  const catMolam = await prisma.category.create({ data: { name: 'หมอลำ' } });
  const catInter = await prisma.category.create({ data: { name: 'เพลงสากล' } });
  const catLukkrung = await prisma.category.create({ data: { name: 'ลูกกรุง' } });

  console.log('Categories seeded.');

  // 4. Products (USB แฟลชไดรฟ์เพลง MP3)
  const products = [
    {
      name: "USB แฟลชไดรฟ์ MP3 เพลงเพื่อชีวิต คาราบาว 4GB รวม 325 เพลง ครบทุกอัลบั้ม",
      price: 199,
      originalPrice: 319,
      categoryId: catPheaChiwit.id,
      imageUrl: "images/carabao-usb.png",
      images: [
        "https://images.unsplash.com/photo-1524805444758-089113d48a6d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
      ],
      brand: "btmusicdrive",
      sku: "TC-LW-001",
      tags: ["USB", "MP3", "เพื่อชีวิต", "คาราบาว"],
      specs: { "แบรนด์": "btmusicdrive", "รูปแบบ": "USB แฟลชไดรฟ์ 2.0", "ไฟล์เพลง": "MP3 128 kbps", "จำนวนเพลง": "325 เพลง", "รองรับ": "เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพงบลูทูธ", "ความจุ": "2GB" },
      description: "USB แฟลชไดรฟ์ MP3 เพลงเพื่อชีวิต คาราบาว 2GB รวม 325 เพลง ครบทุกอัลบั้ม รวมเพลงคาราบาว MP3 ครบทุกอัลบั้ม ไฟล์ MP3 พร้อมใช้งาน เสียงชัด 128kbps ความจุ USB 2GB ของแท้ เสียบฟังในรถยนต์, ลำโพง, คอมฯ, ทีวี ได้เลย เหมาะเป็นของขวัญให้คนรักเพลงเพื่อชีวิต เพลงฮิตเช่น: เมดอินไทยแลนด์ / ทะเลใจ / บัวลอย / คนล่าฝัน ตรวจสอบไฟล์ก่อนจัดส่ง รับประกันสินค้า 100% หากมีปัญหาเปลี่ยนใหม่ทันที",
      stock: 50,
      tracklist: ["เมดอินไทยแลนด์","ทะเลใจ","บัวลอย","คนล่าฝัน","หนุ่มพเนจร","ตุ๊กตา","สัญญาหน้าฝน","วณิพก","เทพบุตรชาวไร่","รุ้ง","แม่จ๋า","น้ำใจงาม","เฉลิมพร","ม้าแก่","นายพลเค็ม","ผู้ปิดทองหลังพระ","คนทุกข์ทนได้","ตาสว่าง","ถ้าเดินเรื่อยเปื่อย","บัวขาว","กระบือลืมนา","คืนหนึ่ง","ทีเด็ด","ท.ทหารอดทน","ก่อ","ยาเสพติด","หนาว","ราชาเงินผ่อน","คนจนมีสิทธิ์","ปลาทูสีทอง"],
    },
    {
      name: "USB แฟลชไดร์ฟ - MP3 รวมเพลง 3 ช่าเพื่อชีวิต",
      price: 199,
      originalPrice: 239,
      categoryId: catPheaChiwit.id,
      imageUrl: "images/3cha.png",
      images: ["images/3cha (4).png", "images/3cha (3).png", "images/3cha (2).png"],
      brand: "btmusicdrive",
      sku: "SU-WS-002",
      tags: ["USB", "MP3", "เพื่อชีวิต", "3 ช่า"],
      specs: { "แบรนด์": "btmusicdrive", "รูปแบบ": "USB แฟลชไดรฟ์ 2.0", "ไฟล์เพลง": "MP3 128 kbps", "จำนวนเพลง": "192 เพลง", "รองรับ": "เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพงบลูทูธ", "ความจุ": "2GB" },
      description: "USB แฟลชไดร์ฟ MP3 รวมเพลง 3 ช่าเพื่อชีวิต 2GB รวม 192 เพลง ครบทุกอัลบั้ม ไฟล์ MP3 พร้อมใช้งาน เสียงชัด 128kbps เสียบฟังในรถยนต์, ลำโพง, คอมฯ, ทีวี ได้เลย รับประกันสินค้า 100% หากมีปัญหาเปลี่ยนใหม่ทันที",
      stock: 100,
      tracklist: ["ผู้ชนะสิบทิศ","รักคุณเข้าแล้ว","สาวนาสั่งแฟน","ตัดใจ","ดาวเรืองดาวโรย","สมศรี 500 วัตต์","ขอให้เหมือนเดิม","ลำเพลินลำเลย","กัดฟันสู้","เรื่องจริงผ่านจอ","พ่อหม้ายล่อเลื่อน","ฝากรัก","ไม้จิ้มฟัน","อโนทัย","ล้อมรัก","สาวเพชรบุรี","เทพธิดาผ้าซิ่น","เลือดกตัญญู","เมาไม่ขับ","วณิพก 3 ช่า"],
    },
    {
      name: "USB แฟลชไดรฟ์ MP3 รวมเพลงสตริงยุค 80s",
      price: 199,
      originalPrice: 319,
      categoryId: catString.id,
      imageUrl: "images/string 80_1.png",
      images: ["images/string 80_2.png", "images/string 80_3.png", "images/string 80_4.png", "images/string 80_5.png"],
      brand: "btmusicdrive",
      sku: "BC-TS-003",
      tags: ["USB", "MP3", "สตริง", "80s"],
      specs: { "แบรนด์": "btmusicdrive", "รูปแบบ": "USB แฟลชไดรฟ์ 2.0", "ไฟล์เพลง": "MP3 128 kbps", "จำนวนเพลง": "194 เพลง", "รองรับ": "เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพงบลูทูธ", "ความจุ": "2GB" },
      description: "USB แฟลชไดรฟ์ MP3 รวมเพลงสตริงยุค 80s 2GB รวม 194 เพลง ครบทุกอัลบั้ม ไฟล์ MP3 พร้อมใช้งาน เสียงชัด 128kbps เสียบฟังในรถยนต์, ลำโพง, คอมฯ, ทีวี ได้เลย รับประกันสินค้า 100%",
      stock: 200,
      tracklist: ["จดหมายฉบับสุดท้าย","อย่าเล่นกับอ้ายได้บ่","สายัณห์","กุหลาบเวียงพิงค์","ลืมไม่ลง","หนุ่มบาว สาวปาน","รักเธอทุกวัน","ก่อนฤดูฝน","ค่าน้ำนม","ดาว","แค่คุณ","สาวเสียงพิน","ฝากเพลงถึงเธอ","อย่าลืมฉัน","โอ้ละหนอ","รักข้ามขอบฟ้า","กว่าจะรู้","ความรักสีดำ","ทูนหัวของเอ็ง","ยิ่งรักยิ่งแค้น"],
    },
    {
      name: "USB แฟลชไดรฟ์ MP3 รวมเพลงลูกทุ่งฮิตตลอดกาล",
      price: 199,
      originalPrice: 319,
      categoryId: catLukthung.id,
      imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      images: [],
      brand: "btmusicdrive",
      sku: "BT-LT-004",
      tags: ["USB", "MP3", "ลูกทุ่ง", "ลูกทุ่งฮิต"],
      specs: { "แบรนด์": "btmusicdrive", "รูปแบบ": "USB แฟลชไดรฟ์ 2.0", "ไฟล์เพลง": "MP3 128 kbps", "จำนวนเพลง": "280 เพลง", "รองรับ": "เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพงบลูทูธ", "ความจุ": "2GB" },
      description: "USB แฟลชไดรฟ์ MP3 รวมเพลงลูกทุ่งฮิตตลอดกาล 2GB รวม 280 เพลง ครบทุกศิลปินดัง ไมค์ ภิรมย์พร พุ่มพวง ดวงจันทร์ ยอดรัก สลักใจ ไฟล์ MP3 พร้อมใช้งาน เสียงชัด 128kbps เสียบฟังในรถยนต์ ลำโพง คอมฯ ทีวี ได้เลย รับประกันสินค้า 100%",
      stock: 80,
      tracklist: ["ตำนานชีวิต","บุพเพเล่ห์รัก","ห่างไกล","ผู้หญิงหลายใจ","ใจสั่งมา","สไบนาง","ขวัญใจพี่หลวง","สาวนาข้าใหม่","คนมีเสน่ห์","ช้ำคือเรา","อย่าหยุดยั้ง","ลูกทุ่งคนยาก","กรรมลิขิต","คิดฮอดเสมอ","จำปาลาว","ดอกไม้ให้คุณ","เปลี่ยนผ่าน","ขอบใจจริงๆ","สาวทุ่งดอนมูล","น้ำตาล้นแก้ว"],
    },
    {
      name: "USB แฟลชไดรฟ์ MP3 รวมเพลงหมอลำซิ่ง มันส์ๆ",
      price: 199,
      originalPrice: 299,
      categoryId: catMolam.id,
      imageUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      images: [],
      brand: "btmusicdrive",
      sku: "BT-ML-005",
      tags: ["USB", "MP3", "หมอลำ", "หมอลำซิ่ง", "อีสาน"],
      specs: { "แบรนด์": "btmusicdrive", "รูปแบบ": "USB แฟลชไดรฟ์ 2.0", "ไฟล์เพลง": "MP3 128 kbps", "จำนวนเพลง": "250 เพลง", "รองรับ": "เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพงบลูทูธ", "ความจุ": "2GB" },
      description: "USB แฟลชไดรฟ์ MP3 รวมเพลงหมอลำซิ่งมันส์ๆ 2GB รวม 250 เพลง หมอลำยอดฮิต หมอลำเสียงอีสาน จังหวะมันส์ เปิดในรถ เปิดในงาน ไฟล์ MP3 เสียงชัด 128kbps พร้อมใช้งานทันที รับประกัน 100%",
      stock: 60,
      tracklist: ["ลำเต้ยหัวใจ","สะออนเมืองเลย","กัดฟันเอา","ลำเพลินบ้านทุ่ง","ผู้สาวขี้เหล้า","ซิ่งหมอลำ","แม่ฮ้างมหาเสน่ห์","มหาลัยวัวชน","ลำยาว","ส่าหัวใจ","ป้อจ่อยจำ","ลำนำเมืองอุดร","อีสานลำเพลิน","ลำเต้ยซิ่ง","คิดถึงอ้ายบ่","กลอนลำ","หมอลำตะลุมบอน","หล่าเอ้ย","สาวอีสานรอรัก","ลำเต้ยประยุกต์"],
    },
    {
      name: "USB แฟลชไดรฟ์ MP3 รวมเพลงสากลฮิต 90s-2000s",
      price: 249,
      originalPrice: 399,
      categoryId: catInter.id,
      imageUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      images: [],
      brand: "btmusicdrive",
      sku: "BT-IT-006",
      tags: ["USB", "MP3", "สากล", "90s", "2000s", "international"],
      specs: { "แบรนด์": "btmusicdrive", "รูปแบบ": "USB แฟลชไดรฟ์ 2.0", "ไฟล์เพลง": "MP3 128 kbps", "จำนวนเพลง": "300 เพลง", "รองรับ": "เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพงบลูทูธ", "ความจุ": "4GB" },
      description: "USB แฟลชไดรฟ์ MP3 รวมเพลงสากลฮิตยุค 90s-2000s 4GB รวม 300 เพลง Pop Rock R&B รวมศิลปินดัง Backstreet Boys, Westlife, Maroon 5 และอีกมากมาย ไฟล์ MP3 เสียงชัด 128kbps เสียบปุ๊บฟังปั๊บ รับประกัน 100%",
      stock: 40,
      tracklist: ["I Want It That Way","My Heart Will Go On","Yesterday","Hotel California","Careless Whisper","Take On Me","Nothing's Gonna Change My Love For You","Unchained Melody","Right Here Waiting","More Than Words","November Rain","Wonderwall","Creep","No Woman No Cry","Every Breath You Take","Hello","Always","I Don't Want to Miss a Thing","My Love","You Raise Me Up"],
    },
    {
      name: "USB แฟลชไดรฟ์ MP3 รวมเพลงสตริงยุค 90s",
      price: 199,
      originalPrice: 319,
      categoryId: catString.id,
      imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      images: [],
      brand: "btmusicdrive",
      sku: "BT-S9-007",
      tags: ["USB", "MP3", "สตริง", "90s", "ยุค 90"],
      specs: { "แบรนด์": "btmusicdrive", "รูปแบบ": "USB แฟลชไดรฟ์ 2.0", "ไฟล์เพลง": "MP3 128 kbps", "จำนวนเพลง": "310 เพลง", "รองรับ": "เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพงบลูทูธ", "ความจุ": "2GB" },
      description: "USB แฟลชไดรฟ์ MP3 รวมเพลงสตริงยุค 90s 2GB รวม 310 เพลง ครบทุกวง Clash, Potato, Bodyslam, AB Normal, ปาล์มมี่ และอีกมากมาย ไฟล์ MP3 เสียงชัด 128kbps เสียบปุ๊บฟังปั๊บ รับประกัน 100%",
      stock: 90,
      tracklist: ["ชู้","แอบจอง","ยาพิษ","กะลา","ทะเลสีดำ","อยากได้ยินว่ารักกัน","คราม","ลม","ก้อนหินก้อนนั้น","ทุกอย่าง","จันทร์","รักติดไซเรน","คืนจันทร์","อากาศ","ปลายทาง","กอดไม่ได้","ดาวกะพริบ","ที่รัก","ฝนตกไหม","เพื่อนรัก"],
    },
    {
      name: "USB แฟลชไดรฟ์ MP3 รวมเพลงลูกกรุงอมตะ",
      price: 199,
      originalPrice: 299,
      categoryId: catLukkrung.id,
      imageUrl: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
      images: [],
      brand: "btmusicdrive",
      sku: "BT-LK-008",
      tags: ["USB", "MP3", "ลูกกรุง", "อมตะ", "คลาสสิก"],
      specs: { "แบรนด์": "btmusicdrive", "รูปแบบ": "USB แฟลชไดรฟ์ 2.0", "ไฟล์เพลง": "MP3 128 kbps", "จำนวนเพลง": "200 เพลง", "รองรับ": "เครื่องเสียงรถยนต์ / คอมพิวเตอร์ / ลำโพงบลูทูธ", "ความจุ": "2GB" },
      description: "USB แฟลชไดรฟ์ MP3 รวมเพลงลูกกรุงอมตะ 2GB รวม 200 เพลง สุนทราภรณ์ ชรินทร์ นันทิดา สวลี รวมเพลงไพเราะคลาสสิกที่ไม่มีวันตาย ไฟล์ MP3 เสียงชัด 128kbps เสียบฟังในรถ ลำโพง คอมฯ รับประกัน 100%",
      stock: 35,
      tracklist: ["บัวขาว","จำเลยรัก","ลมหวน","ค่าน้ำนม","ดวงจันทร์วันเพ็ญ","ดาวจรัสแสง","กังหันลม","ลมรำเพย","ดาวประดับใจ","จันทร์เจ้าเอ๋ย","น้ำตาแสงไต้","สายชล","รักเอยรัก","เพลงรักข้ามเวลา","สุดหัวใจ","ความรักเหมือนยาขม","ดอกไม้กับผีเสื้อ","ลมเหนือ","สุดรักสุดห่วง","ตะวันรอน"],
    },
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  console.log('Products seeded (USB แฟลชไดรฟ์เพลง MP3).');
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
