# AGENTS.md — BT Music Drive

> คู่มือสำหรับ Codex อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง
> อัปเดตล่าสุด: 2026-04-17

---

## 1. Project Overview

**btmusicdrive** — ร้านขายแฟลชไดร์ฟเพลง MP3 เป็น e-commerce แบบ full-stack
Frontend เป็น vanilla HTML/JS/Tailwind, Backend เป็น Express + TypeScript บน Vercel

```
btmusicdrive/
├── *.html              # หน้าต่างๆ ของร้าน (vanilla HTML)
├── script.js           # Main frontend logic
├── checkout.js         # Checkout + Stripe payment flow
├── components.js       # Shared navbar, cart sidebar, auth modal, footer
├── style.css           # Custom CSS variables + Tailwind supplements
├── products.json       # Static product fallback data
├── categories.json     # Static category fallback data
├── images/             # Product/UI images (served statically)
├── server/             # Express backend
│   ├── src/
│   │   ├── index.ts          # Express app entry, middleware, route registration
│   │   ├── routes/           # API route handlers
│   │   ├── middleware/auth.ts # JWT authentication middleware
│   │   └── lib/prisma.ts     # Prisma client singleton
│   ├── prisma/schema.prisma  # Database schema
│   └── .env                  # Environment variables (DO NOT COMMIT)
└── vercel.json         # Vercel deployment config
```

---

## 2. Tech Stack

### Frontend
| Layer | Technology |
|-------|-----------|
| HTML | Vanilla HTML5 (no framework) |
| Styling | **Tailwind CSS v3** via CDN (`cdn.tailwindcss.com`) |
| Icons | **Phosphor Icons** via `@phosphor-icons/web` (unpkg) |
| Fonts | Google Fonts — **Kanit** (primary), **Inter** (secondary) |
| JS | Vanilla ES6+ (no bundler, no TypeScript on frontend) |
| Payment | **Stripe.js v3** via CDN + Stripe Payment Element |
| Auth (OAuth) | Google Identity Services SDK |

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (TypeScript, compiled by Vercel) |
| Framework | **Express.js** |
| ORM | **Prisma** with PostgreSQL |
| Database | **Neon** (serverless PostgreSQL) |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Payment | **Stripe** (PaymentIntent flow) |
| Shipping | Flash Express (manual tracking via admin panel) |
| Email | Nodemailer via Gmail SMTP |
| Image Upload | Multer (local disk) |
| Deploy | **Vercel** (serverless functions) |

### Brand Colors (Tailwind config)
```js
primary: '#8B7355'   // Bronze (amber-brown)
secondary: '#0F172A' // Dark slate (navbar/footer bg)
```

---

## 3. ไฟล์ทั้งหมดและหน้าที่

### Frontend Pages
| File | หน้าที่ |
|------|---------|
| `index.html` | Home — hero, flash sale countdown, categories, trending products |
| `shop.html` | Product listing with filters |
| `product.html` | Product detail page |
| `category.html` | Category browse page |
| `cart.html` | Cart page (desktop full view) |
| `checkout.html` | Checkout — address form, Stripe card / COD payment |
| `orders.html` | User order history |
| `profile.html` | User profile edit |
| `address.html` | Saved addresses management |
| `wishlist.html` | User wishlist |
| `track-order.html` | Track parcel by order ID or phone (Flash Express tracking link) |
| `shipping.html` | Shipping info page — features, timeline, delivery time table, FAQ |
| `about.html` | About page |
| `contact.html` | Contact page |
| `faq.html` | FAQ page |
| `terms.html` | Terms & conditions |
| `privacy.html` | Privacy policy |
| `refund.html` | Refund policy |
| `returns.html` | Returns policy |
| `exchange.html` | Exchange policy |
| `warranty.html` | Warranty policy |
| `admin.html` | Admin dashboard (password-gated) |

### Frontend JS
| File | หน้าที่ |
|------|---------|
| `script.js` | Auth, cart sync, product fetch/render, navbar, toast, wishlist |
| `checkout.js` | Stripe init, payment method toggle, promo validation, place order |
| `components.js` | Exports navbar HTML, cart sidebar HTML, auth modal HTML, footer HTML |

### Backend Routes (`server/src/routes/`)
| File | Prefix | หน้าที่ |
|------|--------|---------|
| `auth.ts` | `/api/auth` | register, login, Google OAuth, `/me` |
| `products.ts` | `/api/products` | CRUD สินค้า, list, detail |
| `cart.ts` | `/api/cart` | cart item CRUD, sync |
| `orders.ts` | `/api/orders` | สร้าง/ดู orders, status update, stats |
| `payment.ts` | `/api/payment` | Stripe create-payment-intent, confirm-order, cod-order, webhook |
| `promo.ts` | `/api/promo` | validate, CRUD promo codes |
| `users.ts` | `/api/users` | profile update, admin user list |
| `menus.ts` | `/api/menus` | nav menu CRUD + reorder |
| `images.ts` | `/api/images` | multer image upload/delete/list |

---

## 4. API Endpoints ทั้งหมด

### Auth
```
POST /api/auth/register       { email, password, name }
POST /api/auth/login          { email, password }
POST /api/auth/google         { credential }  ← Google ID token
GET  /api/auth/me             [JWT required]
```

### Products
```
GET    /api/products           ?page=1&limit=50&category=&search=
GET    /api/products/:id
POST   /api/products           [ADMIN]
PATCH  /api/products/:id       [ADMIN]
DELETE /api/products/:id       [ADMIN]
```

### Cart
```
GET    /api/cart               [JWT]
POST   /api/cart/sync          [JWT] { items: [{productId, quantity}] }
POST   /api/cart/items         [JWT] { productId, quantity }
PUT    /api/cart/items/:productId [JWT] { quantity }
DELETE /api/cart/items/:productId [JWT]
DELETE /api/cart               [JWT]
```

### Orders
```
GET    /api/orders             [ADMIN] ?page=&limit=&phone=&status=
GET    /api/orders/my          [JWT]
GET    /api/orders/stats       [ADMIN] — dashboard analytics
GET    /api/orders/:id         [JWT/ADMIN]
PATCH  /api/orders/:id/status  [ADMIN] { status }
PATCH  /api/orders/:id/tracking [ADMIN] { trackingNumber, carrier }
```

### Payment (Stripe)
```
POST /api/payment/create-payment-intent  [JWT] { items, promoCode, shippingAddress, ... }
POST /api/payment/confirm-order          [JWT] { paymentIntentId, invoiceNo, ... }
POST /api/payment/cod-order              [JWT] { items, shippingAddress, ... }
POST /api/payment/webhook                ← Stripe webhook (raw body required)
```

### Promo
```
POST   /api/promo/validate     [JWT] { code, cartTotal }
GET    /api/promo              [ADMIN]
POST   /api/promo              [ADMIN]
PATCH  /api/promo/:id          [ADMIN]
DELETE /api/promo/:id          [ADMIN]
GET    /api/promo/:code        public
```

### Other
```
GET  /api/menus                public — active nav items
GET  /api/health               public — health check
POST /api/images/upload        [x-admin-password header]
```

---

## 5. Conventions

### API Base URL (Frontend)
```js
const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://localhost:5000/api'
  : '/api';
```

### Auth Pattern (Frontend)
- JWT stored in `localStorage` key: `token`
- User data stored in `localStorage` key: `user` (JSON)
- All authenticated requests: `Authorization: Bearer <token>` header
- Admin dashboard uses fallback password header: `x-admin-password: btmusicdrive-admin-2025`

### Error Response Format (Backend)
```json
// Error
{ "error": "message string" }

// Success list
{ "data": [...], "total": 10, "page": 1, "limit": 50 }

// Success single
{ "message": "...", "user": {...}, "token": "..." }
```

### HTTP Status Codes
- `200/201` — success
- `400` — bad request / validation error
- `401` — not authenticated
- `403` — forbidden (not admin)
- `404` — not found
- `409` — conflict (duplicate)
- `500` — internal server error

### Naming
- **Frontend JS**: camelCase functions/variables, kebab-case HTML IDs (`cart-btn`, `auth-modal`)
- **Backend TS**: camelCase, Prisma models = PascalCase
- **Constants**: UPPER_SNAKE_CASE (`API_BASE`, `SHIPPING_COST`)
- **CSS classes**: Tailwind utility classes only; custom classes in `style.css` use BEM-lite (`.hero-grainy`, `.glass-card`)

### Database IDs
- All Prisma models use `cuid()` as default ID (e.g., `cm4xyz...`)

---

## 6. Environment Variables

```bash
# Required
DATABASE_URL="postgresql://..."        # Neon PostgreSQL
JWT_SECRET="..."                       # JWT signing key (min 32 chars)

# Stripe Payment
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."                        # Gmail App Password

# URLs
FRONTEND_URL="https://btmusicdrive.vercel.app"
CLIENT_URL="http://localhost:3000"
SERVER_URL="https://btmusicdrive.vercel.app"

# Other
NODE_ENV="development"
PORT="5000"                            # local dev only
ADMIN_PASSWORD="btmusicdrive-admin-2025"
```

---

## 7. Prisma Schema (Models สรุป)

```
User       — id, email, passwordHash, googleId, name, phone, role(ADMIN|CUSTOMER)
Product    — id, name, price, originalPrice, stock, imageUrl, images[], specs(JSON), category
Category   — id, name, products[]
Cart       — id, userId(unique), items[]
CartItem   — id, cartId, productId, quantity | unique(cartId, productId)
Order      — id, userId, totalAmount, status(PENDING|PROCESSING|PAID|SHIPPED|DELIVERED|CANCELLED)
             paymentIntentId, trackingNumber, carrier, shippingAddress, promoCode, discountAmount
OrderItem  — id, orderId, productId, quantity, priceAtTime
MenuItem   — id, label, url, icon, sortOrder, isActive, parentId
PromoCode  — id, code(unique), type(PERCENT|FIXED), value, minOrder, maxUses, usedCount, expiresAt
```

---

## 8. Payment Flow (Stripe)

```
1. Frontend: POST /api/payment/create-payment-intent
   → returns { clientSecret, invoiceNo }

2. Frontend: stripe.elements({ clientSecret }) → mount PaymentElement
   → stripe.confirmPayment({ redirect: 'if_required' })

3. Frontend: POST /api/payment/confirm-order
   → verifies paymentIntent.status === 'succeeded'
   → creates Order in DB, clears cart, sends email

4. COD: POST /api/payment/cod-order
   → creates Order with status=PROCESSING (no Stripe)

5. Webhook: POST /api/payment/webhook (Stripe)
   → must be registered BEFORE express.json() middleware
   → uses express.raw({ type: 'application/json' })
   → updates order status to PAID on payment_intent.succeeded
```

---

## 9. สิ่งที่ยังไม่สมบูรณ์ (Known Placeholders)

| ที่ | ปัญหา |
|----|-------|
| `server/.env` | `GOOGLE_CLIENT_ID` และ `GOOGLE_CLIENT_SECRET` ยังว่างอยู่ — ปุ่ม Login ด้วย Google ใช้ไม่ได้ |
| `products.json` | 5 สินค้า (ลูกทุ่ง, หมอลำ, สากล, สตริง 90s, ลูกกรุง) ยังใช้รูป Unsplash placeholder |

---

## 10. กฎที่ Codex ต้องปฏิบัติตาม (DO / DON'T)

### ❌ ห้ามทำโดยเด็ดขาด
- **ห้าม overwrite หรือลบ** `products.json`, `categories.json` — เป็น fallback data สำคัญ
- **ห้าม commit** `.env` หรือไฟล์ที่มี credentials จริง
- **ห้ามเปลี่ยน** Tailwind color config (`primary: '#8B7355'`, `secondary: '#0F172A'`) — เป็น brand สี
- **ห้ามเพิ่ม** framework frontend (React, Vue, etc.) — project ใช้ vanilla JS โดยเจตนา
- **ห้ามสร้าง** duplicate route files ใน path ผิด (เช่น `server/server/src/...`)
- **ห้ามแก้** `server/prisma/schema.prisma` โดยไม่ run `prisma migrate` ด้วย
- **ห้ามเปลี่ยน** Stripe live keys ที่อยู่ใน `.env` — ใช้งานจริงอยู่
- **ห้าม push** ขึ้น git โดยไม่ให้ user ยืนยันก่อน

### ✅ ควรทำเสมอ
- อ่านไฟล์ก่อนแก้ไขทุกครั้ง (ใช้ Read tool ไม่ใช่ cat)
- ใช้ Tailwind classes ที่มีอยู่แล้ว — อย่าเขียน inline style ถ้าไม่จำเป็น
- ใช้ Phosphor Icons (`ph ph-*`) ไม่ใช่ FontAwesome หรือ library อื่น
- Error responses จาก backend ต้องเป็น `{ error: "..." }` เสมอ
- API routes ใหม่ต้องลงทะเบียนใน `server/src/index.ts`
- ถ้าแก้ Prisma schema ต้องบอก user ให้ run `npx prisma migrate dev` เองด้วย
- ตรวจสอบว่า `express.raw()` สำหรับ Stripe webhook ต้องอยู่ก่อน `express.json()` เสมอ

### ⚠️ ระวังเป็นพิเศษ
- `components.js` ถูก load ในทุกหน้า — แก้แล้วกระทบทั้งเว็บ ตรวจสอบให้ดีก่อน
- `admin.html` เป็น single-file ขนาดใหญ่ (>2000 บรรทัด) — ใช้ Edit แบบ targeted เท่านั้น
- `checkout.js` มี logic หลายส่วนที่ซับซ้อน — ระวังทำลาย address dropdown (TH_ADDRESS_DATA)
- `script.js` ใช้ localStorage เก็บ cart/token — ระวัง key names อย่าเปลี่ยน

---

## 11. Local Development

```bash
# Backend
cd server
npm install
cp .env.example .env   # แล้วใส่ค่าจริง
npx prisma generate
npx prisma migrate dev
npm run dev            # starts on :5000

# Frontend
# เปิด index.html ตรงๆ ใน browser หรือใช้ Live Server extension
# ไม่มี build step สำหรับ frontend
```

---

## 12. Deployment (Vercel)

- Frontend: static files ที่ root (`*.html`, `*.js`, `*.css`, `images/`)
- Backend: serverless function จาก `server/` directory
- `vercel.json` กำหนด routing ให้ `/api/*` ไปที่ backend
- Environment variables ต้องตั้งใน Vercel Dashboard ด้วย (ไม่ใช่แค่ `.env`)
- หลัง deploy ต้องเพิ่ม Stripe webhook URL: `https://btmusicdrive.vercel.app/api/payment/webhook`
