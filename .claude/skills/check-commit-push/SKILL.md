---
name: check-commit-push
description: ตรวจสอบและปิดงาน git ของ repo btmusicdrive ให้ครบวงจร — เช็คไฟล์ค้างที่ยังไม่ commit, commit ที่ยังไม่ push, และไฟล์ minified (.min.js / app.min.css) ที่เก่ากว่า source (แปลว่าลืม build) แล้วจัดการให้เสร็จ (build → commit → push) พร้อมรายงานสรุป ใช้ทุกครั้งที่ผู้ใช้ถามทำนอง "commit แล้วยัง", "push แล้วยัง", "ขึ้น git หรือยัง", "เช็ค git", "ตรวจ commit", "งานขึ้นเว็บ/deploy หรือยัง", "มีอะไรค้างไหม" หรือเมื่อจบงานแก้ไขไฟล์ frontend/backend แล้วต้องการปิดงานให้เรียบร้อย — แม้ผู้ใช้ไม่ได้พูดคำว่า git ตรง ๆ ก็ตาม
---

# ตรวจสอบ commit + push (btmusicdrive)

เป้าหมาย: จบการทำงานทุกครั้ง repo ต้องอยู่ในสภาพ "สะอาดและขึ้น origin/main ครบ" —
ไม่มีไฟล์ค้าง, ไม่มี commit ที่ยังไม่ push, และไฟล์ minified ต้องใหม่กว่า source เสมอ
(เพราะหน้าเว็บ production ใช้ไฟล์ `.min.*` ถ้า source ใหม่กว่า แปลว่าสิ่งที่แก้ยังไม่ขึ้นเว็บจริง)

**เรื่องสิทธิ์ push:** CLAUDE.md ข้อ 10 เขียนว่าห้าม push โดยไม่ยืนยัน แต่ผู้ใช้ได้อนุญาต
auto push แล้วภายหลัง — หลักฐานคือ `Bash(git push:*)` ใน allowlist ของ
`.claude/settings.local.json` ดังนั้น skill นี้จัดการ commit + push ให้เลยโดยไม่ต้องถาม
แต่ต้อง**รายงานทุกครั้ง**ว่าทำอะไรไปบ้าง (เงื่อนไขของการอนุญาต)

## ขั้นตอน

### 1. เช็คสถานะ git

```powershell
git status -sb
git log --oneline -5
```

- บรรทัดแรกของ `status -sb` บอก ahead/behind เช่น `## main...origin/main [ahead 2]`
- ถ้ามีไฟล์ค้าง → ไปข้อ 2 ก่อน commit
- ถ้า tree สะอาดและไม่ ahead → รายงานว่าเรียบร้อยแล้ว จบงาน

### 2. เช็ค build ค้าง (source ใหม่กว่า minified)

เทียบเวลาแก้ไขตามคู่นี้ — ถ้า source ใหม่กว่าไฟล์ขวา แปลว่าลืม build:

| Source | Minified |
|--------|----------|
| `script.js` | `script.min.js` |
| `components.js` | `components.min.js` |
| `checkout.js` | `checkout.min.js` |
| `style.css`, `tailwind.input.css` | `app.min.css` |

```powershell
$pairs = @(@('script.js','script.min.js'),@('components.js','components.min.js'),@('checkout.js','checkout.min.js'),@('style.css','app.min.css'),@('tailwind.input.css','app.min.css'))
foreach ($p in $pairs) { if ((Get-Item $p[0]).LastWriteTime -gt (Get-Item $p[1]).LastWriteTime) { Write-Output "STALE: $($p[0]) ใหม่กว่า $($p[1])" } }
```

ถ้าเจอ STALE:
- ไฟล์ JS → minify ก่อน: `npx terser <file>.js -c -m -o <file>.min.js`
- แล้วรัน `npm run build` หนึ่งครั้ง (ครอบคลุม CSS, inline data, sitemap, และ bump version query ให้ทั้งหมด)

### 3. Commit

- **ห้าม commit `.env` หรือไฟล์ credential เด็ดขาด** — ดูรายชื่อไฟล์จาก `git status` ก่อน `git add`
  ถ้าเจอไฟล์แปลกปลอม (.env, ไฟล์ key, ไฟล์ส่วนตัวนอกโปรเจกต์) ให้ข้ามและแจ้งผู้ใช้
- ข้อความ commit ใช้รูปแบบ conventional (`feat:`, `fix:`, `perf:`, `docs:` ฯลฯ)
  สรุปจากเนื้อหา diff จริง ไม่ใช่เดา และปิดท้ายด้วยบรรทัด Co-Authored-By ตามมาตรฐานของ session

```powershell
git add -A
git commit -m "<ข้อความ>"
```

### 4. Push + ยืนยันผล

```powershell
git push
git status -sb
```

`status -sb` รอบสุดท้ายต้องได้ `## main...origin/main` เฉย ๆ (ไม่มี ahead, ไม่มีไฟล์ค้าง)
ถ้า push ล้มเหลว (เช่น มี commit ใหม่บน origin) ให้ `git pull --rebase` แล้ว push ใหม่ —
ห้าม force push

## การรายงาน

สรุปสั้น ๆ เป็นภาษาไทยตามที่เกิดขึ้นจริง:

- เรียบร้อยอยู่แล้ว: "commit + push ครบแล้ว ไม่มีอะไรค้าง (ล่าสุด `<hash>` — <หัวข้อ commit>)"
- มีการจัดการ: บอกว่าเจออะไรค้าง, build อะไรไปบ้าง, commit hash ใหม่, push แล้ว
- มีปัญหา: บอกตรง ๆ ว่าติดอะไร (เช่น push ไม่ผ่าน, เจอไฟล์น่าสงสัยที่ไม่กล้า add)
