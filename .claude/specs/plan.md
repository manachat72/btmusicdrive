# btmusicdrive — Spec-Driven Workflow Plan

> อ่านก่อนเริ่มงานทุกครั้ง เพื่อป้องกัน context rot และให้ AI ทำงานในทิศทางเดียวกัน
> อัปเดตทุกครั้งที่มีการตัดสินใจสำคัญหรือเปลี่ยน scope

---

## Project Identity

| Item | Value |
|------|-------|
| Project | btmusicdrive |
| Owner | Chatchai Baoui |
| Brand | BUYTHRRM |
| Domain | btmusicdrive.com / btmusicdrive.vercel.app |
| Purpose | E-commerce store for curated MP3 music USB flash drives |
| Stack | Vanilla HTML/JS/Tailwind + Express/TypeScript/Prisma/Neon + Vercel |

---

## How to Use This File

1. **Before starting any task** — read this file + `CLAUDE.md` to orient yourself.
2. **When completing a task** — update the "Completed Work" section with a one-line summary.
3. **When discovering a new constraint** — add it to "Constraints & Decisions".
4. **When task scope changes** — update "Active Work" immediately.

This prevents context rot: future AI sessions can pick up exactly where the last left off.

---

## Active Work

_No active task. Add a line here when starting work:_
```
- [ ] [task description] — started [date]
```

---

## Completed Work Log

| Date | Change | Files Touched |
|------|--------|---------------|
| 2026-05-08 | Synced CLAUDE.md with AGENTS.md (added sections 10 build rule, 11 frontend dev, 13 SEO guardrails, 14 security) | `CLAUDE.md` |
| 2026-05-08 | Security fix: removed hardcoded ADMIN_PASSWORD fallback from auth middleware | `server/src/middleware/auth.ts`, `server/src/index.ts` |
| 2026-05-08 | Created spec-driven workflow plan | `.claude/specs/plan.md` |

---

## Constraints & Decisions

### Non-negotiable (do not override)
- Brand colors: `primary: '#8B7355'` (bronze), `secondary: '#0F172A'` (dark slate) — Tailwind config
- Frontend stack: vanilla HTML/JS/Tailwind only — no React, Vue, or build frameworks
- `products.json` and `categories.json` must never be overwritten — they are static fallback data
- Stripe webhook handler (`express.raw()`) must stay before `express.json()` in `server/src/index.ts`
- Never `git push` without explicit user confirmation

### Known Gaps / TODOs
- Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) not configured — login with Google disabled
- Some products still use Unsplash placeholder images
- No automated test suite — `npm test` is a no-op stub

### Build rule (critical)
Any change to `*.html`, `style.css`, `tailwind.input.css`, `script.js`, `components.js`,
`products.json`, `categories.json`, or files in `scripts/` **requires** running `npm run build`
at project root before closing the task. This regenerates minified assets and bumps cache-busting hashes.

---

## Standard Workflows

### Frontend change
1. Edit source file(s)
2. `npm run build` (project root)
3. Verify minified output is regenerated
4. Note change in Completed Work Log above

### Backend change
1. Edit `server/src/...`
2. `cd server && npm run build` (TypeScript compile check)
3. Test locally: `npm run dev`
4. Note any Prisma schema changes → remind user to run `npx prisma migrate dev`

### New API route
1. Create `server/src/routes/<name>.ts`
2. Register in `server/src/index.ts`: `app.use('/api/<name>', <name>Routes)`
3. Document in CLAUDE.md section 4 (API Endpoints)

### Security checklist (before closing any task)
- [ ] No hardcoded secrets, passwords, or tokens in source files
- [ ] All new API routes validate and sanitize inputs
- [ ] Admin-only routes protected by `authenticateToken` + role check
- [ ] No `.env` files or credential files staged for commit

---

## Environment Quick Reference

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `DATABASE_URL` | Neon PostgreSQL | Yes (server exits without it) |
| `JWT_SECRET` | JWT signing | Yes (server exits without it) |
| `ADMIN_PASSWORD` | Admin dashboard fallback auth | Yes (server exits without it) |
| `STRIPE_SECRET_KEY` | Stripe payments | Yes (payment routes fail) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | Yes (webhook fails) |
| `GOOGLE_CLIENT_ID` | Google OAuth | No (Google login disabled) |
| `SMTP_USER` / `SMTP_PASS` | Order confirmation emails | No (emails silently skip) |
