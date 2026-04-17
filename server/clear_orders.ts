import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('เริ่มลบข้อมูลออเดอร์ทดลองทั้งหมด...');
  
  // ลบข้อมูล OrderItem สัมพันธ์กับออเดอร์ก่อน 
  const deletedItems = await prisma.orderItem.deleteMany({});
  console.log(`- ลบรายการสินค้าในออเดอร์ (OrderItem): ${deletedItems.count} รายการ`);

  // ลบข้อมูลออเดอร์ทั้งหมด
  const deletedOrders = await prisma.order.deleteMany({});
  console.log(`- ลบออเดอร์ (Order): ${deletedOrders.count} รายการ`);

  console.log('✅ ล้างประวัติออเดอร์ทดลองเสร็จสมบูรณ์ ฐานข้อมูลพร้อมสำหรับใช้งานจริง!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
