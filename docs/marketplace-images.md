# คลังรูปสินค้ากลาง (Shopee / Lazada / TikTok Shop / เว็บ)

รูปต้นฉบับอยู่บน NAS `Z:\รูป\รูปสินค้า\<NN>-<ชื่อสินค้า>\หลัก_01.jpg …`
แปลงเป็น JPG มาตรฐานเดียว → อัปขึ้น Cloudflare R2 → เสิร์ฟผ่าน `https://img.btmusicdrive.com`

**ไม่แตะ repo btmusicdrive และไม่กระทบความเร็วเว็บ** (คนละโดเมน คนละ storage)

---

## สเปกรูปที่ใช้

| | ค่าที่ตั้งไว้ |
|---|---|
| ฟอร์แมต | JPEG progressive, mozjpeg, chroma 4:4:4 |
| ขนาด | 1200 × 1200 (pad สีขาวถ้าไม่จัตุรัส) |
| คุณภาพ | q88 → ~200–300 KB/รูป |
| จำนวน | สูงสุด 9 รูป/สินค้า |

ผ่านเกณฑ์ทุกเจ้า — Shopee (แนะนำ 1024+, ≤10MB) · Lazada (330–5000px, ≤5MB, JPG) · TikTok Shop (ขั้นต่ำ 600, แนะนำ 800+, ≤5MB, ต้องมีอย่างน้อย 5 รูป)

---

## ตั้งค่า Cloudflare R2 (ทำครั้งเดียว)

1. Cloudflare Dashboard → **R2** → Create bucket ชื่อ `btmusicdrive-img` (location: APAC)
2. เข้า bucket → **Settings → Public access → Connect Custom Domain** → ใส่ `img.btmusicdrive.com`
   (โดเมน btmusicdrive.com ต้องอยู่ใน Cloudflare — Cloudflare จะสร้าง CNAME ให้อัตโนมัติ)
3. **R2 → Manage R2 API Tokens → Create API Token** → permission **Object Read & Write** → เลือก bucket นี้
4. คัดลอก `.env.r2.example` เป็น `.env.r2` แล้วใส่ Account ID / Access Key / Secret
5. `npm install` (ติดตั้ง `@aws-sdk/client-s3`)

> ค่าใช้จ่าย: R2 ฟรี 10 GB storage + **egress ฟรีไม่จำกัด** — รูปชุดนี้ ~120 MB จึงอยู่ในโควตาฟรี

---

## ใช้งาน

```bash
# 1) แปลงรูปจาก NAS → marketplace-images/  (ดูผลก่อนด้วย dry-run)
node scripts/build-marketplace-images.js
npm run mkt:build

# 2) อัปขึ้น R2  (ข้ามไฟล์ที่มีอยู่แล้วอัตโนมัติ)
node scripts/upload-r2.js
npm run mkt:upload
```

ได้ผลลัพธ์:

```
marketplace-images/
├── products/37/37-01.jpg … 37-19.jpg
├── catalog.json
└── catalog.csv          ← คอลัมน์ Image 1-9 พร้อม copy ลงเทมเพลต mass upload
```

URL ที่ได้: `https://img.btmusicdrive.com/products/37/37-01.jpg`

โฟลเดอร์ `marketplace-images/` และ `.env.r2` อยู่ใน `.gitignore` — ไม่เข้า repo

### ตัวเลือกเพิ่มเติม

```bash
--src "D:\path"     # เปลี่ยนโฟลเดอร์ต้นทาง
--size 1600         # เปลี่ยนขนาด (default 1200)
--quality 92        # เปลี่ยนคุณภาพ (default 88)
--max 5             # จำกัดจำนวนรูป/สินค้า
--force             # เขียนทับ/อัปทับของเดิม
```

---

## ไฟล์ลงสินค้าพร้อม SEO (Shopee / Lazada / TikTok Shop / เว็บ)

```bash
node scripts/generate-marketplace-listings.js   # dry-run ดูตัวอย่างก่อน
npm run mkt:listings                            # เขียน templates/marketplace-listings.xlsx
```

ได้ไฟล์ xlsx 4 ชีต — แต่ละชีตมีชื่อสินค้า SEO + รายละเอียด + Tags ตามสไตล์ของแพลตฟอร์มนั้น
(Shopee ≤120 ตัว keyword-dense · Lazada ≤255 อ่านง่าย+Highlights · TikTok hook-first+Hashtags · Website: SEO Title/Meta/H1)
พร้อมราคา/สต็อก/SKU/น้ำหนัก และลิงก์รูป R2 ครบ 9 ช่อง — เปิดแล้ว copy ลงเทมเพลต mass upload ของแต่ละเจ้าได้เลย
คอลัมน์ "หมายเหตุ" จะเตือนรายการที่รูปไม่ถึง 5 รูป (TikTok) หรือจับคู่ products.json ไม่ได้
ราคา/สต็อก/น้ำหนักแก้ที่ `CONFIG` หัวไฟล์สคริปต์ที่เดียว

## 🎛 Listing Studio — ลงสินค้าทีละชิ้นผ่านหน้าเว็บ (local)

```bash
npm run mkt:studio     # เปิด http://localhost:4777
```

เลือกสินค้าจากรายการ (มีรูป+ค้นหาได้) → เห็นรูปทั้ง 9 → กดปุ่มแพลตฟอร์ม → ได้ไฟล์ .xlsx ทันที:
- **Shopee** → `shopee-upload-<code>.xlsx` (เทมเพลตทางการ อัปโหลดได้เลย)
- **TikTok Shop** → `tiktok-upload-<code>.xlsx` (เทมเพลตทางการ อัปโหลดได้เลย)
- **Lazada** → `lazada-upload-<code>.xlsx` (ข้อมูลครบ 1 รายการ copy ลงเทมเพลต Lazada)

ต้องมี `marketplace-listings.xlsx` (จาก `npm run mkt:listings`) และเทมเพลตทางการของ Shopee/TikTok ใน Downloads
สร้างทีละชิ้นจาก CLI ได้เช่นกัน: `node scripts/fill-tiktok-template.js --apply --code 03`

## เพิ่มสินค้าใหม่

วางโฟลเดอร์ `<NN>-<ชื่อสินค้า>` ลง NAS แล้วรัน 2 คำสั่งเดิมซ้ำ — สคริปต์ข้ามของเก่าที่ไม่เปลี่ยน อัปเฉพาะไฟล์ใหม่

## ถ้าจะให้เว็บใช้รูปชุดนี้ด้วย

เว็บยังใช้ AVIF/WebP ใน `images/` ตามเดิม (เร็วกว่า JPG มาก) — R2 เป็นแหล่งกลางสำหรับ marketplace
ถ้าอนาคตอยากย้ายรูปเว็บไปอยู่ R2 ให้เพิ่ม variant `.avif`/`.webp` ในสคริปต์ build แล้วเปลี่ยน `imageUrl` ใน DB เป็น URL ของ `img.btmusicdrive.com`
