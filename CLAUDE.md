# CLAUDE.md — BT Music Drive

> คู่มือสำหรับ Claude Code อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง
> อัปเดตล่าสุด: 2026-07-25

## 0. วิธีทำงานและการตอบ

- อ่านเฉพาะไฟล์ที่จำเป็น — ถ้าต้องการ context เพิ่ม ให้ถามชื่อไฟล์ก่อน
- ห้ามสรุปยาว ห้ามทักทายหรือพูดนอกเรื่อง — ตอบเฉพาะสิ่งที่เกี่ยวกับ task
- แสดงเฉพาะ code diff หรือจุดที่แก้ (ห้ามพิมพ์โค้ดเต็มที่ไม่ได้แก้)
- จบงานสรุปสั้น ๆ ประโยคเดียวว่าแก้อะไรไป
- ถ้ามีการเปลี่ยนแปลงสำคัญที่ทำให้ทำงานง่ายขึ้น/เร็วขึ้น ให้บันทึกลง CLAUDE.md — ถ้าไม่สำคัญไม่ต้องลง

---

## 1. Project Overview

**btmusicdrive** — ร้านขายแฟลชไดร์ฟเพลง MP3 (e-commerce full-stack)
Frontend: vanilla HTML/JS/Tailwind · Backend: Express + TypeScript · Deploy: Vercel

```
btmusicdrive/
├── *.html                  # หน้าร้าน 24 หน้า (vanilla HTML) + blog/*.html
├── script.js               # Main frontend: auth, cart sync, product render, navbar, toast, wishlist
├── checkout.js             # Stripe init, payment toggle, promo, place order
├── components.js           # Shared: navbar, cart sidebar, auth modal, footer, chat widget, bottom nav
├── style.css               # Custom CSS variables + Tailwind supplements (BEM-lite)
├── tailwind.input.css      # Tailwind source → tailwind.min.css → app.min.css
├── *.min.js / app.min.css  # ไฟล์ที่ production ใช้จริง (generate จาก source)
├── products.json           # Static product data 1000+ รายการ (fallback + CDN cache)
├── categories.json         # Static category data 9 หมวด
├── images/                 # AVIF/WebP images served statically
├── scripts/                # Build/utility scripts (Node.js)
├── server/src/
│   ├── index.ts            # Express entry, middleware, route registration
│   ├── routes/             # 13 route files (รวม line.ts — LINE chatbot webhook)
│   ├── middleware/         # auth.ts (JWT + admin password), rateLimiter.ts (500 req/15min)
│   ├── lib/                # prisma.ts, categoryName, productSlug, meta-capi, tiktok-events, socialOg
│   └── services/           # emailService.ts (Nodemailer order confirmation)
├── server/prisma/schema.prisma
├── server/.env             # DO NOT COMMIT
└── vercel.json             # Routing /api/* → backend, cache headers, region sin1
```

**Frontend pages:** `index` (home), `shop`, `product`, `category`, `cart`, `checkout`,
`orders`, `profile`, `address`, `wishlist`, `track-order`, `shipping`, `admin`
(password-gated, >2000 บรรทัด), `404`, `blog` + หน้า static: `about`, `contact`, `faq`,
`terms`, `privacy`, `refund`, `returns`, `exchange`, `warranty`

## 2. Tech Stack

- **Frontend**: Vanilla HTML5 + ES6 (no framework/bundler by design) · Tailwind CSS v3 · Phosphor Icons (`ph ph-*`) · Google Fonts Kanit/Inter · Stripe.js v3 Payment Element · Google Identity Services
- **Backend**: Node.js TS · Express v5 · Prisma v6 + Neon PostgreSQL · JWT + bcrypt + google-auth-library · Stripe v22 (PaymentIntent) · Nodemailer (Gmail SMTP) · Multer · Helmet + rate-limit · Meta CAPI + TikTok Events + GA4
- **Deploy**: Vercel serverless, region sin1 · Shipping: Flash Express (manual tracking via admin)

**Brand colors (Tailwind config — ห้ามเปลี่ยน):**
```js
primary: '#8B7355'   // Bronze — icon, badge, accent
secondary: '#0F172A' // Dark slate — navbar/footer bg
```
ปุ่ม CTA หลัก (เช่น "สั่งซื้อเลย") ใช้ gradient ทองสว่าง `from-amber-400 via-yellow-400 to-amber-500` — **ไม่ใช้ primary**

## 3. Build Workflow (สำคัญที่สุด — production ใช้ไฟล์ .min เท่านั้น)

แก้ไฟล์ frontend ใด ๆ (`*.html`, `style.css`, `tailwind.input.css`, `script.js`,
`components.js`, `checkout.js`, `products.json`, `categories.json`, `blog/*.html`,
หรือ `scripts/` ที่เกี่ยวกับหน้าเว็บ) ต้องปิดงานด้วยลำดับนี้เสมอ:

1. ถ้าแก้ JS (script.js / components.js / checkout.js) → minify ก่อน (ไม่มี build script สำหรับ JS):
   ```bash
   npx terser <file>.js -c -m -o <file>.min.js
   ```
2. รัน `npm run build` — ทำครบ: build:css, combine:css (→ app.min.css), inline:products,
   inline:categories, inline:product-jsonld, build:sitemap, hash:assets (bump `?v=` cache-busting)
3. commit + push (ดู §9 เรื่อง git) — หรือใช้ skill `/check-commit-push` ปิดงานให้ครบวงจร

ห้ามสลับหน้า production ไปโหลดไฟล์ source ตรง ๆ แทน `.min.js` โดยไม่แจ้ง user ก่อน

**Build scripts อื่นใน `scripts/`**: `optimize-images.js` (แปลง/บีบอัดรูป),
`sync-products-json.js` (DB → products.json), `push-images-to-db.js`

## 4. Conventions

```js
// API base (frontend)
const API_BASE = (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
  ? 'http://localhost:5000/api' : '/api';
```

- **Auth**: JWT ใน localStorage key `token`, user JSON ใน key `user` → header `Authorization: Bearer <token>` · admin ใช้ header `x-admin-password`
- **localStorage keys ห้ามเปลี่ยนชื่อ**: `token`, `user`, cart keys ใน script.js, `btChatPos` (ตำแหน่ง chat widget), `btmusicdrive_cookie_consent`
- **Error response**: `{ "error": "..." }` เสมอ · list: `{ data, total, page, limit }` · single: `{ message, ... }`
- **Status codes**: 200/201 ok · 400 validation · 401 no auth · 403 not admin · 404 · 409 duplicate · 500
- **Naming**: frontend camelCase + kebab-case HTML IDs · backend camelCase, Prisma models PascalCase · constants UPPER_SNAKE_CASE · CSS ใช้ Tailwind utilities, custom class ใน style.css เป็น BEM-lite
- **DB**: ทุก model ใช้ `uuid()` เป็น ID

## 5. API Endpoints

```
Auth      POST /api/auth/register|login|google · GET /api/auth/me [JWT]
Products  GET /api/products (?page&limit&category&search) · GET /:id · GET /slug/:slug
          POST/PATCH/DELETE [ADMIN]
Categories GET (list, /:id) · POST/PATCH/DELETE [ADMIN]
Cart      [JWT] GET / · POST /sync {items} · POST /items · PUT|DELETE /items/:productId · DELETE /
Orders    GET / [ADMIN ?page&limit&phone&status] · GET /my [JWT] · GET /stats [ADMIN]
          GET /:id [JWT/ADMIN] · PATCH /:id/status [ADMIN] · PATCH /:id/tracking [ADMIN]
Payment   [JWT] POST /create-payment-intent · /confirm-order · /cod-order
          POST /webhook ← Stripe (raw body — ดู §7)
Promo     POST /validate [JWT] · GET /:code public · GET/POST/PATCH/DELETE [ADMIN]
Other     GET /api/menus · /api/health · /api/health/email · /api/config/stripe (public)
          POST /api/images/upload [x-admin-password] · POST /api/contact (public)
          POST /api/analytics/event [JWT optional] · /api/line/* (LINE chatbot webhook)
```

API route ใหม่ต้องลงทะเบียนใน `server/src/index.ts` เสมอ

## 6. Prisma Models (สรุป)

```
User       — id, email, passwordHash, googleId, name, phone, birthday, gender, role(ADMIN|CUSTOMER)
Product    — id, name, description, price, originalPrice, stock, imageUrl, images[],
             brand, sku, slug(unique), tags[], tracklist[], specs(JSON), isActive, categoryId
Category   — id, name(unique), slug(unique), products[]
Cart       — id, userId(unique), items[] · CartItem — cartId+productId unique, quantity
Order      — id, userId, totalAmount, status(PENDING|PROCESSING|PAID|SHIPPED|DELIVERED|CANCELLED),
             paymentIntentId(unique), stripeSessionId(unique), trackingNumber, carrier,
             shippingAddress(JSON), promoCode, discountAmount [indexes: userId, status]
OrderItem  — orderId, productId, quantity, priceAtTime
MenuItem   — label, url, icon, sortOrder, isActive, parentId
PromoCode  — code(unique), type(PERCENT|FIXED), value, minOrder, maxUses, usedCount, expiresAt, isActive
```

Migrations ตามลำดับ: `init` → `add_user_profile_fields` → `add_order_indexes` → `add_product_is_active` → `add_slug_fields`

**แก้ schema.prisma ต้อง run `prisma migrate` ด้วยเสมอ** และบอก user ให้ run `npx prisma migrate dev` เอง

## 7. Payment Flow (Stripe)

```
1. POST /create-payment-intent → { clientSecret, invoiceNo }
2. stripe.elements({clientSecret}) → PaymentElement → confirmPayment({redirect:'if_required'})
3. POST /confirm-order → verify succeeded → create Order, clear cart, send email
4. COD: POST /cod-order → Order status=PROCESSING (ไม่ผ่าน Stripe)
5. Webhook /api/payment/webhook → set PAID on payment_intent.succeeded
   ⚠ ต้อง register ก่อน express.json() และใช้ express.raw({type:'application/json'})
```

## 8. Environment Variables

```bash
# Required (server ไม่ start ถ้าขาด)
DATABASE_URL="postgresql://..."   # Neon
JWT_SECRET="..."                  # min 32 chars
ADMIN_PASSWORD="..."              # ไม่มี fallback
# Stripe (live keys — ห้ามเปลี่ยน)
STRIPE_SECRET_KEY="sk_live_..." / STRIPE_WEBHOOK_SECRET="whsec_..."
# Google
GOOGLE_CLIENT_ID="46644504211-02mjffk321u1h5hbh1r5e5j5in30od93.apps.googleusercontent.com"
GA4_PROPERTY_ID="533617757"       # GOOGLE_CLIENT_SECRET ไม่จำเป็น (ID-token flow)
# Email: SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER/SMTP_PASS (Gmail App Password)
# URLs: FRONTEND_URL, CLIENT_URL, ALLOWED_ORIGINS="https://btmusicdrive.com,https://btmusicdrive.vercel.app"
# Other: NODE_ENV, PORT=5000 (local เท่านั้น)
```

- env จริงอยู่ `server/.env` (local ใช้ `server/.env.local` สำหรับ DATABASE_URL)
- **ต้องตั้งใน Vercel Dashboard ด้วย** ไม่ใช่แค่ไฟล์ .env
- Meta CAPI / TikTok: โค้ดพร้อมแล้ว แต่ต้องตั้ง Pixel ID / Access Token ใน env

## 9. กฎ DO / DON'T

### Git
- **Push ได้เลยไม่ต้องถาม** — user อนุญาต auto commit + push ขึ้น main แล้ว (allowlist `Bash(git push:*)` ใน `.claude/settings.local.json`) แต่ต้อง**รายงานทุกครั้ง**ว่า commit/push อะไร
- ห้าม force push · ห้าม commit `.env` หรือไฟล์ credential จริง
- ใช้ skill `/check-commit-push` เมื่อ user ถาม "commit แล้วยัง / มีอะไรค้างไหม / ปิดงาน"

### ❌ ห้ามโดยเด็ดขาด
- ห้าม overwrite/ลบ `products.json`, `categories.json` — fallback data สำคัญ
- ห้ามเปลี่ยน Tailwind brand colors (§2) และ Stripe live keys
- ห้ามเพิ่ม frontend framework (React, Vue ฯลฯ) — vanilla JS โดยเจตนา
- ห้ามสร้าง duplicate route files ใน path ผิด (เช่น `server/server/src/...`)
- ห้ามใส่ hardcoded secret/password/key ใน source หรือในไฟล์ `.claude/settings*.json` (ไฟล์พวกนี้อยู่ใน git) — ใช้ env vars เสมอ

### ✅ ต้องทำเสมอ
- อ่านไฟล์ก่อนแก้ทุกครั้ง (Read tool ไม่ใช่ cat)
- ใช้ Tailwind classes ที่มีอยู่ อย่าเขียน inline style ถ้าไม่จำเป็น · icon ใช้ Phosphor เท่านั้น
- ปิดงาน frontend ตาม Build Workflow §3
- ทุก API route ที่รับ input ต้อง validate type + sanitize · Prisma parameterized เท่านั้น ห้าม string interpolation ใน SQL
- body limit `1mb` และ rate limit 500 req/15min — อย่าเพิ่ม

### 🔍 SEO + Performance (แจ้ง user ก่อนถ้าเสี่ยง)
- ห้ามเพิ่ม third-party script/font/widget/tracker/animation library ที่ทำให้ช้าลง โดยไม่แจ้งก่อน
- ห้ามลบ/ทำเสีย structured data, meta tags, canonical, OG, favicon, sitemap, robots โดยไม่แจ้งก่อน
- ห้ามทำให้ LCP/CLS แย่ลง (ภาพใหญ่เกิน, layout shift, render-blocking script) โดยไม่แจ้งก่อน
- ภาพนอก above-the-fold ใช้ `loading="lazy"` · รักษา heading structure, internal links, alt text

### ⚠️ ระวังเป็นพิเศษ
- `components.js` โหลดทุกหน้า — แก้แล้วกระทบทั้งเว็บ
- `admin.html` ไฟล์เดียว >2000 บรรทัด — ใช้ Edit แบบ targeted เท่านั้น
- `checkout.js` ซับซ้อน — ระวังทำลาย address dropdown (TH_ADDRESS_DATA)
- localStorage key names ห้ามเปลี่ยน (ดู §4)

## 10. Local Dev + Deployment

```bash
# Backend:  cd server && npm install && npx prisma generate && npx prisma migrate dev && npm run dev  (:5000)
# Frontend: เปิด index.html ตรง ๆ หรือ Live Server — ปิดงานด้วย npm run build (§3)
```

- Vercel: static files ที่ root + serverless จาก `server/src/index.ts` · routing ใน `vercel.json`
- Cache: `.min.*` + `images/` immutable 1 ปี · `.html` no-cache · `products/categories.json` 1h + SWR 1d
- Stripe webhook URL: `https://btmusicdrive.vercel.app/api/payment/webhook`

## 11. Notes เฉพาะเรื่อง

- **Blog** (2026-07-14): `blog.html` + `blog/*.html` — clean URL `/blog/:slug` ผ่าน vercel.json; เพิ่มบทความ = วางไฟล์แล้ว `npm run build` (sitemap/tailwind/hash รวม blog อัตโนมัติ)
- **Social OG ฝั่ง server**: social bot UA ที่เข้า `/product/:slug` ถูก route ไป `server/src/lib/socialOg.ts` render OG จาก DB (FB/LINE ไม่รัน JS) — Googlebot ได้ static ปกติ
- **OG image กลาง**: `images/og-cover.jpg` (1200×630) — FB ไม่รองรับ webp/avif **ห้ามเปลี่ยนกลับ**
- **Chat widget** (2026-07-25): `#bt-chat-widget` ใน components.js ลากย้ายได้ (pointer events, threshold 8px แยกแตะ/ลาก) — ตำแหน่งเก็บ localStorage `btChatPos` `{r,b}` px จากขวา/ล่าง · ห้ามลบ `touch-action:none` บนปุ่ม ไม่งั้นลากบนมือถือไม่ได้
- **Product Studio** (2026-08-18): `npm run mkt:studio` → http://localhost:4777 — ลงสินค้าใหม่ / แก้ไขสินค้าเดิม / QR ครบในที่เดียว
  - ไฟล์: `scripts/listing-studio.js` (server) + `scripts/lib/studio-page.js` (HTML/CSS) + `scripts/lib/studio-client.js` (client JS แยกไฟล์ — **ห้ามยัด client JS กลับเข้า template literal** จะต้อง escape `${}` ทุกจุด)
  - SEO engine `scripts/lib/seo.js` — สร้างชื่อ/รายละเอียด/meta/tags/slug + ดึงชื่อศิลปินจาก tracklist ทำ long-tail keyword + validate ความยาว/ซ้ำ · **155 ตัวแรกของ description = meta description จริง** (inline-product-jsonld ตัดตรงนั้น)
  - slug ไทย→โรมัน `scripts/lib/product-slug.js` — อ่านตารางจาก `server/src/lib/productSlug.ts` ตอน runtime **ห้ามก๊อปตารางมาไว้ 2 ที่**
  - **จัดการรูปในหน้าแก้ไข** (2026-09-03): ลากสลับลำดับ · × ลบ · ⭐ ตั้งรูปปก · ลากไฟล์มาวางเพื่ออัป แล้วกด "บันทึกรูป" ครั้งเดียว — `/api/add-images` รับ `keep[]` = index ต้นฉบับที่เก็บไว้ตามลำดับใหม่ (client อ่าน index จากเลขท้ายชื่อไฟล์ `<slug>-3.webp` ไม่ใช่ตำแหน่งในลิสต์ เพราะลำดับใน DB สลับได้โดยชื่อไฟล์ไม่เปลี่ยน)
    - **ลบรูปแล้วต้อง prune ทุกที่** ไม่งั้นรอบหน้า `fetchOriginals` ดึงของค้างกลับมา: R2 `originals/` + `products/<code>/` (`r2.deleteKeys`), รูปกลางในเครื่อง, และ `หลัก_NN` ส่วนเกินบน NAS
  - **เรียงรูป = natural sort ชื่อเต็ม** `webImg.byNaturalName` (Intl.Collator `'en'`, numeric) ตรงกับที่เห็นใน Explorer — **ห้ามกลับไปเรียงด้วยเลขท้ายชื่อไฟล์อย่างเดียว** โฟลเดอร์ที่ชื่อไฟล์ปนกัน (`หลัก_02.jpg` + `watermarked_img_1849171711.jpg`) จะได้ลำดับมั่วจนรูปปกผิดใบ · ใช้ตัวเดียวกันทั้ง `web-images` / `product-images` / `build-marketplace-images` / `backfill-originals`
  - **รูป 3 ชั้น** (`scripts/lib/product-images.js`): ต้นฉบับ → R2 `originals/<NN>-<slug>/` (ไฟล์ดิบ) + NAS ถ้าไดรฟ์ต่อ · รูปกลาง 1200×1200 → R2 `products/<NN>/` = **ลิงก์ที่ xlsx ทุกแพลตฟอร์มใช้ ห้ามเปลี่ยนขนาด/ชื่อไฟล์** · รูปเว็บ ≤800 webp+avif → `images/products/<slug>/`
  - ทำงานได้แม้ NAS ไม่ได้ต่อ (อัปโหลดรูปผ่านหน้าเว็บ → ต้นฉบับขึ้น R2 อย่างเดียว)
  - `npm run mkt:originals -- --apply` = backfill ต้นฉบับเก่าจาก NAS ขึ้น R2 (รันตอน NAS ต่ออยู่)
  - studio **commit + push ให้อัตโนมัติ** — ลำดับสำคัญ: rename/สร้างรูป → build → push → ค่อยเขียน DB (DB ชี้มาก่อนไฟล์ขึ้น = รูป 404)
  - **QR รายชื่อเพลงอัตโนมัติ** (2026-08-31): ลงสินค้าใหม่ที่มี tracklist → studio สร้างหน้ารายชื่อเพลงบน R2 `docs/tracklist-<code>.html` + QR `qr/qr-tracklist-<code> <ชื่อสินค้า>.png` + ลงคลัง QR ให้เอง ไม่ต้องรันมือ · โค้ดกลาง `scripts/lib/tracklist-qr.js` ใช้ร่วมกับ `npm run mkt:qr-all` (ทำย้อนหลังครบทุกตัว / `--code NN` ทีละตัว) — URL ผูกกับ code เท่านั้น รันซ้ำได้ QR ที่พิมพ์ไปแล้วไม่เสีย
  - ⚠ `marketplace-images/` `templates/` `qr/` อยู่ใน .gitignore — ห้ามใส่ใน `git add` ของ studio จะล้ม

- **SEO artist research** (2026-08-20): agent `seo-artist-research` (`.claude/agents/`) วิจัยคีย์เวิร์ดรายศิลปินแล้วเก็บลง `scripts/data/artists.json`
  - **agent คืนแค่วัตถุดิบ** (`type/genre/aliases/keywords/hook/notes`) — **ห้ามให้มันเขียนชื่อสินค้า/description/meta/slug เอง** เพราะ `buildSeo()` คุมความยาว meta 155 ตัว + slug + validate อยู่
  - `unknown:true` = ไม่รู้จัก → `getArtist()` คืน null → ตกกลับ rule-based เดิม (แต่ยังนับว่า "วิจัยแล้ว" จะได้ไม่ยิงซ้ำ)
  - cache key = ชื่อที่พิมพ์ผ่าน `normalizeKey()` (ตัดช่องว่าง + lowercase) ใน `scripts/lib/artists.js`
  - ผลกระทบต่อ `buildSeo()`: เติม tags long-tail (ต่อท้าย BASE_KW เพดานขยับ 12→14), ช่วยเดาแนวเพลงเมื่อ regex เดาไม่ออก, ใส่ hook ศิลปินใน description **หลัง** 155 ตัวแรก, คืน `artistsMissing[]` ให้ studio เตือน
  - คำสั่ง: `npm run seo:artists` (ดูชื่อที่ยังไม่วิจัย) · `seo:artists:prompt` (ได้ข้อความไปสั่ง agent) · `seo:artists:save <file.json>` · `seo:artists:stats` · `seo:artists:test` (smoke test ว่าไม่พังของเดิม)

## 12. Agent skills

- **Issue tracker**: GitHub Issues ของ `manachat72/btmusicdrive` ผ่าน `gh` CLI — ดู `docs/agents/issue-tracker.md`
- **Triage labels**: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` — ดู `docs/agents/triage-labels.md`
- **Domain docs**: single-context — `CONTEXT.md` + `docs/adr/` ที่ root (ยังไม่มี ให้ proceed silently) — ดู `docs/agents/domain.md`
- **check-commit-push**: `.claude/skills/check-commit-push/` — ปิดงาน git ครบวงจร (เช็ค build ค้าง → commit → push → รายงาน)
