---
name: site-seo-marketing
description: |
  ทำ SEO ครบวงจรสำหรับเว็บไซต์ร้านค้า btmusicdrive และอีคอมเมิร์ซทั่วไป — เรียกใช้สกิลนี้ทุกครั้งที่มีงานเกี่ยวกับ SEO เว็บ ไม่ว่าจะเป็น:
  - วิเคราะห์/ตรวจสอบ SEO เว็บ (audit, on-page, technical SEO)
  - หาคีย์เวิร์ดสินค้า / keyword research ภาษาไทย-อังกฤษ
  - วิเคราะห์คู่แข่งด้าน SEO (competitor analysis, gap analysis)
  - เขียน/ปรับ meta title, meta description, H1, product copy ให้ติด Google
  - วางกลยุทธ์ SEO, internal linking, schema markup, content roadmap
  - ทุกอย่างที่เกี่ยวกับการติดอันดับ Google / traffic ออร์แกนิก

  ทริกเกอร์เมื่อผู้ใช้พูดถึง: SEO, คีย์เวิร์ด, อันดับ Google, meta tag, title tag, ค้นหาบน Google, traffic เว็บ, คู่แข่งด้านการค้นหา, ปรับหน้าสินค้า, ติด Google, keyword research, on-page, audit เว็บ
---

# 🔎 SEO ครบวงจร — btmusicdrive

สกิลนี้ช่วยให้เว็บ btmusicdrive ติดอันดับ Google สำหรับคนที่ค้นหา USB เพลง, เพลงสำเร็จรูป, เพลงในรถ และคำเกี่ยวข้อง เพื่อเพิ่ม organic traffic อย่างยั่งยืน

อ่าน `references/btmusicdrive-context.md` ก่อนเริ่มงานทุกครั้งเพื่อทำความเข้าใจร้านและกฎ copyright-safe

---

## เลือกขั้นตอนตามงานที่ได้รับ

### 1. 🔍 SEO Audit — ตรวจสอบ on-page ทั้งเว็บ

ใช้เมื่อ: ผู้ใช้ขอตรวจ SEO / audit / หาปัญหา / ทำไมไม่ติดอันดับ

**ขั้นตอน:**
1. Fetch หน้าหลักและหน้าสินค้า 2–3 หน้าด้วย WebFetch
2. ตรวจสอบรายการต่อไปนี้ในแต่ละหน้า:

| จุดตรวจ | เกณฑ์ที่ดี |
|---------|-----------|
| `<title>` | มีคีย์เวิร์ดหลัก, 50–60 ตัวอักษร |
| `<meta description>` | มี, 150–160 ตัวอักษร, มี CTA |
| `<h1>` | มีเพียง 1 ตัว, มีคีย์เวิร์ด |
| โครงสร้าง H2/H3 | สมเหตุสมผล ไม่ข้าม level |
| Alt text รูปภาพ | มีครบทุกรูป |
| URL structure | สั้น กระชับ มีคีย์เวิร์ด ไม่มีตัวเลขสุ่ม |
| Internal links | มีลิงก์เชื่อมสินค้าที่เกี่ยวข้อง |
| Schema markup | มี Product / BreadcrumbList schema |
| Page speed | ไม่มี render-blocking scripts, รูปถูก compress |

3. สรุปเป็น Output ดังนี้:

```
## รายงาน SEO Audit — [URL]

### ✅ ทำได้ดีแล้ว
- ...

### ⚠️ ควรแก้ด่วน (ผลต่อ ranking มาก)
| ปัญหา | ที่พบ | วิธีแก้ |
|-------|-------|--------|

### 💡 ปรับปรุงระยะยาว
- ...

### SEO Score ประมาณการ: X/10
```

---

### 2. 🎯 Keyword Research — หาคีย์เวิร์ดสินค้า

ใช้เมื่อ: ผู้ใช้ขอหาคีย์เวิร์ด / ควรใช้คำอะไร / คนค้นหาอะไร

**ขั้นตอน:**
1. อ่าน `references/thai-keywords.md` เพื่อโหลด keyword patterns สำหรับ USB เพลง
2. **ถ้ามี Ahrefs MCP:** ใช้ค้น search volume, keyword difficulty, SERP features จริง  
   → ต้อง authenticate ก่อน: แจ้งผู้ใช้ให้รัน `mcp__plugin_marketing_ahrefs__authenticate`
3. **ถ้าไม่มี Ahrefs:** WebSearch ค้น "USB เพลง", ดู Google Autocomplete, People Also Ask แล้วใช้ reasoning ประเมิน — ระบุว่า "ประมาณการ ไม่ใช่ข้อมูลจริง"
4. จัดกลุ่มคีย์เวิร์ด:
   - **Head keywords** — สำหรับหน้า Category / Homepage (ปริมาณสูง แข่งขันสูง)
   - **Long-tail keywords** — สำหรับหน้าสินค้าแต่ละชิ้น (เฉพาะเจาะจง แข่งขันน้อย)
   - **Transactional keywords** — สำหรับหน้า conversion ("ซื้อ...", "ราคา...", "ที่ไหนขาย...")

**Output:**
```
## คีย์เวิร์ดแนะนำ — [หมวดสินค้า]

### Head Keywords (หน้า Category/Home)
| คีย์เวิร์ด | Volume* | Difficulty | Intent |
|-----------|---------|------------|--------|

### Long-tail Keywords (หน้าสินค้า)
| คีย์เวิร์ด | เหมาะกับสินค้า | Intent |
|-----------|--------------|--------|

### Transactional Keywords (หน้า conversion)
| คีย์เวิร์ด | ใช้ที่ | หมายเหตุ |
|-----------|-------|---------|

*ถ้าไม่มี Ahrefs ระบุ "ประมาณการ"
```

---

### 3. 🏆 Competitor SEO Analysis — วิเคราะห์คู่แข่ง

ใช้เมื่อ: ผู้ใช้ขอดูคู่แข่ง / เขาทำ SEO ยังไง / เราสู้ได้ไหม

**ขั้นตอน:**
1. WebSearch คำว่า "USB เพลงสำเร็จรูป", "ซื้อ USB เพลง", "USB เพลงลูกทุ่ง" → จด domain top 5
2. Fetch หน้าหลัก + หน้าสินค้าของคู่แข่ง 2–3 ราย
3. เปรียบเทียบ: Title strategy, keywords ใน H1/H2, URL structure, ปริมาณ content, reviews, Schema
4. ระบุ "content gaps" ที่ btmusicdrive ทำได้ดีกว่าหรือยังขาด

**Output:**
```
## Competitor SEO Analysis

### คู่แข่งที่พบ
1. [domain] — rank for "..."

### เปรียบเทียบ
| ด้าน | btmusicdrive | คู่แข่ง A | คู่แข่ง B |
|------|------------|----------|----------|

### โอกาส (Gaps ที่เราชนะได้)
- ...

### Best Practices ที่ควรนำมาใช้
- ...
```

---

### 4. ✍️ เขียน SEO Copy — Meta / Title / Description สินค้า

ใช้เมื่อ: ผู้ใช้ขอเขียน/ปรับ meta, title, description / SEO copy สินค้า

**ขั้นตอน:**
1. รับข้อมูลสินค้า: ชื่อ, จำนวนเพลง, ราคา, จุดขาย
2. ดึงคีย์เวิร์ดที่เหมาะสม (จากขั้นตอน 2 หรือ references/)
3. เขียน 3 องค์ประกอบต่อสินค้า ตามกฎ copyright-safe เสมอ:
   - **SEO Title** (50–60 ตัวอักษร): คีย์เวิร์ดหลักนำหน้า + brand ท้าย
   - **Meta Description** (150–160 ตัวอักษร): คีย์เวิร์ด + benefit + CTA
   - **H1 / ชื่อในหน้าเว็บ**: เน้น benefit มากกว่า title tag
4. ตรวจ copyright-safe ทุกชิ้น (ดูกฎด้านล่าง) ก่อนส่ง

**Output (ต่อ 1 สินค้า):**
```
### [ชื่อสินค้า]

**SEO Title (XX ตัว):**
USB เพลงฮิต 500 เพลง ฟังในรถไม่ต้องเน็ต | btmusicdrive

**Meta Description (XXX ตัว):**
USB เพลงพร้อมฟัง 500 เพลง เสียงดี ใช้ได้ในรถ คอม เครื่องเสียง ไม่ต้องต่ออินเทอร์เน็ต สั่งได้วันนี้ ส่งไว

**H1 / ชื่อในหน้าเว็บ:**
USB เพลงพร้อมฟัง 500 เพลงเพราะ — ฟังได้ทุกที่ ไม่ต้องเน็ต
```

---

### 5. 🗺️ SEO Roadmap — วางกลยุทธ์ภาพรวม

ใช้เมื่อ: ผู้ใช้ขอวางแผน SEO / ทำยังไงให้ติดอันดับ / ต้องทำอะไรบ้าง

แบ่งเป็น 3 ระยะ:

**ระยะสั้น (1–4 สัปดาห์) — Quick wins:**
- แก้ missing meta title/description
- ใส่ alt text รูปภาพที่ขาด
- แก้ H1 ให้มีคีย์เวิร์ด
- เพิ่ม internal links ระหว่างสินค้าที่เกี่ยวข้อง

**ระยะกลาง (1–3 เดือน) — Content & Structure:**
- สร้าง category pages ที่ target head keywords
- เพิ่ม long-form content / FAQ ในหน้าสินค้า
- ใส่ Product Schema + BreadcrumbList Schema
- ปรับ URL structure ให้มีคีย์เวิร์ด

**ระยะยาว (3–6 เดือน+) — Authority:**
- Link building (guest posts, directory listings)
- Core Web Vitals optimization
- สร้าง content hub (บทความ + สินค้า เชื่อมกัน)

---

## เครื่องมือที่ใช้

| เครื่องมือ | ใช้เมื่อ | หมายเหตุ |
|-----------|---------|---------|
| **Ahrefs MCP** | Search volume จริง, keyword difficulty, backlinks | ต้อง authenticate ก่อน |
| **WebSearch** | หาคู่แข่ง, ดู SERP, Google Autocomplete | พร้อมใช้งาน |
| **WebFetch** | Fetch HTML เพื่อ audit on-page | พร้อมใช้งาน |
| **Claude reasoning** | Fallback เมื่อไม่มี Ahrefs, วิเคราะห์ pattern | พร้อมใช้งาน |

ถ้า Ahrefs ยังไม่ได้ authenticate ให้แจ้งผู้ใช้ แต่ทำงานต่อด้วย WebSearch + reasoning ได้เลย ไม่ต้องหยุดรอ

---

## กฎ Copyright-Safe (บังคับทุกชิ้น)

- ❌ ห้ามระบุ: ชื่อศิลปิน, วง, ค่ายเพลง, ชื่อเพลงที่มีลิขสิทธิ์
- ❌ ห้ามเคลม: "ลิขสิทธิ์ถูกต้อง", "original", "ฟรีตลอดชีพ"
- ✅ ใช้คำกลาง: "เพลงฮิต", "เพลงเพราะ", "เพลงดัง", "เพลงในตำนาน", "เพลงแนวลูกทุ่ง"
- ✅ เน้น benefit: "ฟังได้ไม่ต้องเน็ต", "ใช้ได้ทุกเครื่อง", "เพลงเยอะคุ้มค่า"

---

## Reference Files

- `references/thai-keywords.md` — keyword patterns ภาษาไทยสำหรับ USB เพลง (โหลดเมื่อทำ keyword research)
- `references/btmusicdrive-context.md` — ข้อมูลร้าน, สินค้า, กลุ่มเป้าหมาย (โหลดก่อนเขียน copy ทุกครั้ง)
