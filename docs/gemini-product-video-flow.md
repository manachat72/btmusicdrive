# Flow: สั่ง Gemini สร้างวิดีโอรีวิวสินค้า (9:16, 10 วิ, พูดไทย) ผ่าน Browser pane ของ Claude

> ทำครั้งแรก 2026-10-12 กับ `BT-DM-M5-041` (บทสวดมนต์) — ใช้ซ้ำกับสินค้าอื่นได้โดยเปลี่ยน SKU / รูป / บทพูด

## สิ่งที่ต้องมี

- Browser pane ของ Claude ล็อกอิน Google ที่ใช้ Gemini ได้ (มีเมนู "สร้างวิดีโอ")
- รูปสินค้าอยู่ในเครื่องที่ `images/products/<slug>/<slug>-1.webp`

## ขั้นตอน

1. **หาสินค้า** — Grep SKU ใน `products.json` → ได้ `slug`, `name`, `images[0]` (รูปแรก = รูปปกพื้นขาว)
   แล้ว Read `images/products/<slug>/<slug>-1.webp` ดูให้แน่ใจว่าเป็นรูปพื้นขาวจริง
2. **เปิด Gemini** — `preview_start {url: "https://gemini.google.com"}`
3. **ส่งรูปเข้าหน้า Gemini** (ดู "ทำไมต้องอ้อม" ด้านล่าง)
   - รัน relay ชั่วคราว (background): `node relay.js images/products/<slug>/<slug>-1.webp`
   - `navigate` ไป `http://127.0.0.1:4788/` → หน้า relay redirect ไป `https://gemini.google.com/app#btimg=<base64>`
   - รัน JS ในหน้า Gemini: อ่าน `location.hash` → `atob` → `window.__btFile = new File([...], '<slug>-1.webp', {type:'image/webp'})` แล้ว `history.replaceState` ล้าง hash
4. **เปิดโหมดวิดีโอ** — กดปุ่ม "อัปโหลดและเครื่องมือ" (+) → "สร้างวิดีโอ" (ครั้งแรกมี dialog แนะนำ กด "ลองใช้")
5. **แนบรูป** — รัน JS: focus `.ql-editor[contenteditable]` แล้ว dispatch `ClipboardEvent('paste')` ที่มี `DataTransfer` ใส่ `window.__btFile` → เห็น thumbnail ในช่องพิมพ์
6. **ตั้งสัดส่วน** — กด dropdown สัดส่วนภาพ (ขวาล่างของช่องพิมพ์) → "แนวตั้ง (9:16)"
7. **ใส่ prompt** — `document.execCommand('insertText', false, prompt)` บน editor ที่ focus อยู่
   (action `type` ของ browser tool พิมพ์ไทยยาว ๆ ไม่ติด)
8. **กดส่ง** แล้วรอ ~1 นาที → วิดีโอขึ้นในแชท
9. **ปิด relay** (TaskStop) — ตัวสคริปต์ปิดตัวเองใน 10 นาทีอยู่แล้ว
10. **ตรวจงาน** — เปิดฟังเองว่าพูดไทยชัด และตัวหนังสือ/โลโก้บนปกไม่เพี้ยน
11. **บันทึกวิดีโอ** — กดปุ่ม "ดาวน์โหลดวิดีโอ" บนตัววิดีโอ (`find "ดาวน์โหลดวิดีโอ"` แล้วคลิก ref) → แอปเด้งหน้าต่าง Save ให้ **user เลือกโฟลเดอร์เอง** (ที่เก็บ: `\\DXP2800-98FA\song\vdo` = `Z:\vdo`) ได้ไฟล์ `gemini_generated_video_<id>.mp4` 720×1280
    - ไฟล์จะไม่ไปโผล่ใน Downloads เอง — กดครั้งเดียวแล้วรอ user เซฟ ไม่ต้องหาทางดึงไฟล์ออกจากหน้าเว็บ (CSP บล็อก form POST ไป localhost และลิงก์วิดีโอต้องใช้ cookie ล็อกอิน)

## relay.js (วางใน scratchpad ไม่ต้อง commit)

```js
// ส่งรูปในเครื่องเข้าแท็บ Gemini ผ่าน URL hash (hash ไม่ถูกส่งออกจากเบราว์เซอร์)
const http = require('http');
const fs = require('fs');
const b64 = fs.readFileSync(process.argv[2]).toString('base64');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<script>location.replace('https://gemini.google.com/app#btimg=${b64}')</script>`);
}).listen(4788, '127.0.0.1', () => console.log('relay on 4788'));
setTimeout(() => process.exit(0), 10 * 60 * 1000);
```

## ทำไมต้องอ้อม (วิธีที่ลองแล้วไม่ได้)

| วิธี | ผล |
|---|---|
| `fetch()` / `<img>` รูปจาก `img.btmusicdrive.com` ในหน้า Gemini | CSP ของ Gemini บล็อก |
| ก๊อปรูปลง clipboard (PowerShell) แล้วกด Ctrl+V ผ่าน browser tool | ไม่วาง (คีย์จำลองไม่ดึง clipboard ของระบบ) |
| `navigator.clipboard.read()` | Read permission denied |
| ปุ่ม "ไฟล์" | เปิด dialog ของ Windows ซึ่ง browser tool คุมไม่ได้ |

## Prompt template

```
สร้างวิดีโอรีวิวสินค้าแนวตั้ง 9:16 ความยาว 10 วินาที จากรูปสินค้าที่แนบ (<คำอธิบายสินค้าสั้น ๆ> แบรนด์ BT Music Drive ในแพ็กพลาสติกใส พื้นหลังสีขาว) ให้ตัวสินค้า แพ็กเกจ โลโก้ และตัวหนังสือบนปกเหมือนรูปต้นฉบับทุกประการ ห้ามเปลี่ยนหรือเขียนข้อความใหม่ ภาพ: มือผู้หญิงไทยหยิบแพ็กสินค้าขึ้นมาโชว์หน้ากล้องบนโต๊ะสีขาวสะอาด แสงนุ่มอบอุ่น กล้องค่อย ๆ ซูมเข้าหาสินค้า แล้วตัดไปช็อตเสียบ USB เข้ากับลำโพงและในรถ บรรยากาศ<โทนตามแนวเพลง> สไตล์รีวิว UGC สมจริง เสียงพูด: ผู้หญิงไทยน้ำเสียงนุ่มนวลเป็นกันเอง พูดภาษาไทยชัดเจนว่า "<บทพูด ~25–30 คำ>" มีดนตรีบรรเลงเบา ๆ คลอ ไม่มีซับไตเติล ไม่มีข้อความเพิ่มบนจอ
```

- เขียนเป็นย่อหน้าเดียว ไม่ขึ้นบรรทัดใหม่
- บทพูดไม่เอ่ยราคา (ราคาบนปกสูงกว่าราคาเว็บโดยเจตนา)

### ตัวอย่างที่ใช้จริง — BT-DM-M5-041

- คำอธิบายสินค้า: `USB แฟลชไดรฟ์ MP3 บทสวดมนต์`
- โทน: `สงบ ผ่อนคลาย เป็นมงคล`
- บทพูด: `แฟลชไดรฟ์บทสวดมนต์ทำนองดนตรีจาก BT Music Drive รวมคาถามงคลไว้ครบ เสียบฟังได้ทันทีทั้งในรถและลำโพง ฟังแล้วใจสงบ เสริมสิริมงคลทุกวันค่ะ`
