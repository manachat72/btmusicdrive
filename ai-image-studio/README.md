# BT AI Image Studio

เครื่องมือภายใน (โฟลเดอร์แยก ไม่เกี่ยวกับหน้าร้าน) — สร้างภาพสินค้าจากรูปพื้นหลังขาวด้วย Gemini AI (prompt ถูกล็อค) + ตั้งชื่อสินค้า 2 เวอร์ชัน

## วิธีใช้

1. เปิด Live Server ที่ root ของโปรเจกต์ btmusicdrive แล้วเข้า `/ai-image-studio/index.html` (ต้องเปิดผ่าน server เพื่อให้โหลด `products.json` และรูปใน `images/` ได้)
2. ใส่ OpenAI API Key (สร้างที่ platform.openai.com → API Keys) — เก็บใน localStorage เครื่องเดียว
3. ค้นหา/เลือกสินค้า หรืออัปโหลดรูปพื้นหลังขาวเอง
4. เลือกฉาก 1 ใน 4 (สตูดิโอ / ในรถ / โต๊ะไม้ / แบนเนอร์) — prompt ล็อคไว้ แก้ไม่ได้ ดูได้อย่างเดียว
5. กดสร้างภาพ → ดาวน์โหลด PNG
6. กดตั้งชื่อสินค้า → ได้ 2 คอลัมน์:
   - **ถูกกฎ** — ลง Shopee/Lazada/TikTok ได้ (ไม่มีชื่อศิลปิน/คำต้องห้าม ≤120 ตัวอักษร)
   - **ผิดกฎ** — มีชื่อศิลปินเพื่อ SEO ใช้เฉพาะเว็บ btmusicdrive.com เท่านั้น ห้ามลง marketplace

## Model ที่ใช้ (OpenAI)

- ภาพ: `gpt-image-1` ผ่าน `/v1/images/edits` (`input_fidelity: high` เพื่อรักษาปก/ตัวหนังสือบนสินค้า) — บัญชีต้องผ่าน organization verification จึงใช้ gpt-image-1 ได้
- ชื่อ + คำอธิบาย: `gpt-4o-mini` ผ่าน `/v1/chat/completions`

แก้ prompt/ฉาก: แก้ค่าคงที่ `LOCKED_BASE`, `SCENES`, `LOCKED_NAMING` ใน `index.html`
