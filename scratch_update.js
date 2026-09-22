const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'products.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const productId = 'f540116f-1fee-4663-99b4-2a78eab2ec5c';
const product = data.find(p => p.id === productId);

if (product) {
  product.name = 'แฟลชไดร์ฟเพลง MP3 รวมฮิตราชินีลูกทุ่ง พุ่มพวง ดวงจันทร์ 303 เพลง (4GB)';
  product.description = '<p>🎶 <strong>แฟลชไดร์ฟเพลง MP3 ราชินีลูกทุ่ง "พุ่มพวง ดวงจันทร์" โดย BT Music Drive</strong> 🎶</p><p>ย้อนรำลึกถึงน้ำเสียงอันเป็นอมตะ และบทเพลงในความทรงจำของราชินีลูกทุ่งอันดับหนึ่งตลอดกาล "พุ่มพวง ดวงจันทร์" แฟลชไดร์ฟคอลเลกชันพิเศษนี้รวบรวมเพลงฮิตไว้มากถึง <strong>303 เพลง</strong> (ความจุ 4GB) ให้คุณฟังเพลินทะลุอารมณ์ ด้วยคุณภาพเสียงคมชัดระดับมาสเตอร์แท้</p><h4><strong>✨ จุดเด่นของ BT Music Drive (ทำไมต้องเลือกเรา?)</strong></h4><ul><li><strong>🚗 ฟังในรถ / เสียบปุ๊บ ฟังปั๊บ (Plug & Play):</strong> ใช้งานง่ายสุดๆ เพียงเสียบเข้ากับพอร์ต USB ก็เล่นเพลงได้ทันที ไม่ต้องใช้เน็ต ไม่ต้องเสียค่าสตรีมมิ่งรายเดือน</li><li><strong>💻 รองรับทุกอุปกรณ์:</strong> ใช้งานได้หลากหลาย ไม่ว่าจะเป็น เครื่องเสียงรถยนต์, ลำโพงบลูทูธ, สมาร์ททีวี หรือคอมพิวเตอร์</li><li><strong>📂 จัดหมวดหมู่ชัดเจน:</strong> เพลงถูกจัดเรียงอย่างเป็นระเบียบ ค้นหาเพลงโปรดง่ายดาย ฟังต่อเนื่องไม่มีสะดุด</li><li><strong>🛡️ ดีไซน์สวยงาม ทนทาน พกพาสะดวก:</strong> แฟลชไดร์ฟคุณภาพสูง โอนถ่ายข้อมูลรวดเร็ว ทนทาน พร้อมลุยไปกับคุณได้ทุกที่</li></ul><h4><strong>🎁 ไอเดียของขวัญสุดประทับใจ</strong></h4><p>เหมาะอย่างยิ่งสำหรับเป็นของขวัญให้ผู้ใหญ่ คุณพ่อ คุณแม่ หรือแฟนเพลงลูกทุ่ง ซื้อครั้งเดียว ฟังได้ตลอดกาล!</p>';
  product.tags = ["แฟลชไดร์ฟเพลง", "USB เพลงลูกทุ่ง", "รวมเพลงพุ่มพวง", "พุ่มพวง ดวงจันทร์", "ราชินีลูกทุ่ง", "แฟลชไดร์ฟเพลงในรถ", "ฟังเพลง MP3 ไม่ใช้เน็ต", "รวมเพลง 303 เพลง", "BT Music Drive"];

  // Replace slug if it has the banned "ruam-phleng-ruam-phleng" duplication
  product.slug = product.slug.replace('ruam-phleng-ruam-phleng', 'ruam-hit');

  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log('Successfully updated products.json');
} else {
  console.error('Product not found!');
}
