# วิดีโอ #5 "เพลงที่ไม่มีวันเก่า" — Shot Plan + AI Prompts
สินค้า: USB MP3 คาราบาว ครบทุกอัลบั้ม (4GB) · 199฿ · 325 เพลง
สเปค: 9:16 · 1080×1920 · 30fps · 30 วินาที · TikTok / Reels / Shorts

---

## กฎเหล็กของงานนี้

**AI ห้ามเจนแพ็กเกจสินค้าเด็ดขาด** — คลิปเดิม (0519.mp4) พังตรงนี้ AI แต่งกล่องขึ้นมาใหม่
เขียนว่า "Carabao flash dive collion" ซึ่งไม่มีอยู่จริง ของจริงเป็นภาษาไทย "คาราบาว ครบทุกอัลบั้ม"

วิธีแก้: **แบ่งช็อตเป็น 2 กลุ่ม**
- ช็อตอารมณ์ (S1,S2,S4,S5) → AI เจนได้เต็มที่ เพราะ**ไม่มีสินค้าและไม่มีตัวหนังสือในเฟรม** = ไม่มีอะไรให้ AI เขียนผิด
- ช็อตสินค้า (S3,S6) → ใช้ **รูปจริง** `images/products/usb-mp3-carabao-4gb/usb-mp3-carabao-4gb-1.webp`
  ทำเป็น image-to-video (Runway) หรือ Ken Burns ใน CapCut

ทุก prompt ต้องมี negative prompt นี้เสมอ:
```
Negative: text, letters, words, typography, labels, packaging, product box,
logos, brand names, album covers, signage, watermark, subtitles
```

---

## Shot 1 — HOOK (0:00–0:03)

**AI · ไม่มีสินค้า**

> Extreme close-up, black and white, slow motion 120fps look. Weathered fingers of an
> older man press down on the strings of an old acoustic guitar. Fine dust particles
> float through a single hard shaft of window light. Shallow depth of field, only the
> strings and fingertips in focus. Static camera, no movement. High contrast monochrome,
> heavy film grain, 1980s documentary photography feel.
> Duration: 3s. Aspect ratio: 9:16.
> Audio: single soft guitar string pluck with long natural reverb tail, room tone, no music.

**Text overlay:** `บางเพลง ฟังกี่รอบก็ยังขนลุก` (fade in วิที่ 1.2)

---

## Shot 2 — TRANSITION ยุคเก่า (0:03–0:07)

**AI · ไม่มีสินค้า**

> Medium close-up on a worn wooden table. A hand picks up an old plastic audio cassette
> tape with a completely blank unlabeled shell. Warm sepia tone that gradually saturates
> into full warm color across the shot. Late afternoon sunlight from a side window.
> Camera slowly pushes in. Nostalgic cinematic grade, soft halation on highlights.
> Duration: 4s. Aspect ratio: 9:16.
> Audio: cassette shell plastic click, faint tape hiss.

⚠️ ต้องระบุ **blank unlabeled** ไม่งั้น AI จะเขียนตัวหนังสือมั่วบนเทป

---

## Shot 3 — MATCH CUT สู่ปัจจุบัน (0:07–0:11)

**รูปจริง — ห้าม AI เจน**

วิธีทำ:
1. เอา `usb-mp3-carabao-4gb-1.webp` ไปตัดพื้นหลังออก (เหลือแพ็กเกจอย่างเดียว)
2. วางลงบนเฟรมสุดท้ายของ Shot 2 ตำแหน่งเดียวกับที่เทปวางอยู่
3. Cross-dissolve 0.4 วิ เทป → แพ็กเกจจริง (match cut)
4. Ken Burns push-in ช้าๆ 4 วิ

หรือถ้าใช้ Runway image-to-video:
> Animate this product photograph. Keep the packaging and all text on it 100% identical
> to the reference image — do not redraw, alter, or regenerate any text. Add only subtle
> ambient motion: slow camera push-in, gentle light shift across the plastic surface,
> faint dust motes. Duration: 4s. Aspect ratio: 9:16.

**Text overlay:** `325 เพลง ในไดร์ฟเดียว`

---

## Shot 4 — เก่า ↔ ใหม่ (0:11–0:16)

**AI · ไม่มีสินค้า**

> Split-screen vertical composition. Top half: an old pickup truck driving away on a
> red dirt road through rice fields, desaturated faded-film look, dust trail behind it.
> Bottom half: a modern SUV on a smooth asphalt highway, rich saturated color, golden
> hour. Both halves move in the same left-to-right direction at matched speed. Locked-off
> camera. Cinematic commercial grade.
> Duration: 5s. Aspect ratio: 9:16.
> Audio: distant engine hum, wind.

**Text overlay:** `40 ปีผ่านไป — เพลงยังเหมือนเดิม`

---

## Shot 5 — คนขับ (0:16–0:21)

**AI · ไม่มีสินค้า**

> Interior car shot from the passenger seat. A Thai man in his late 40s drives, relaxed,
> a small contented smile. His right hand taps a rhythm on the steering wheel. Warm late
> afternoon sunlight streams through the windshield creating soft lens flare. Blurred
> highway and green fields pass outside. Handheld feel with very slight natural sway.
> Cinematic warm grade, shallow depth of field.
> Duration: 5s. Aspect ratio: 9:16.
> Audio: muted road noise, no music.

**Text overlay:** `ไม่ต้องใช้เน็ต · เสียบแล้วฟังได้เลย`

---

## Shot 6 — PRODUCT HERO (0:21–0:26)

**รูปจริง — ห้าม AI เจน**

`usb-mp3-carabao-4gb-1.webp` เต็มเฟรม พื้นหลังไล่สีเข้ม + Ken Burns push-in ช้า
เพิ่มแสงวิ่งผ่านผิวพลาสติก (CapCut: Light Sweep) — **ห้ามแตะข้อความบนกล่อง**

**Text overlay:**
```
เพลงเพื่อชีวิตในตำนาน
325 เพลง · 4GB
```

---

## Shot 7 — CTA (0:26–0:30)

พื้นดำ + แพ็กเกจเล็กมุมล่างซ้าย

```
199.-
ส่งฟรีทั่วไทย
👇 กดที่ตะกร้าได้เลย
```

---

## ตัวเลขที่ต้องใช้ (อย่าใส่มั่ว)

| ค่า | ใช้ตัวนี้ | ที่มา |
|---|---|---|
| จำนวนเพลง | **325** | `products.json` (หน้าสินค้าที่ลูกค้าเห็น) |
| ราคา | **199** | SKU 4GB |
| ความจุ | **4GB** | ชื่อโฟลเดอร์รูปสินค้า |

❌ **ห้ามใช้:** 347 (ไม่มีที่มา) · "ลด 30%" (239→199 = ลดจริง 17%)
⚠️ หมายเหตุ: ตัวเลขบนกล่องจริงพิมพ์ว่า **319** แต่หน้าสินค้าเขียน 325 — ควรเช็คว่าอันไหนถูก
แล้วแก้ให้ตรงกันทั้งกล่อง/หน้าเว็บ/โฆษณา ก่อนยิงแอด

---

## เสียง

**ห้ามใช้เพลงคาราบาวจริงทุกกรณี** แม้ท่อนเดียว — TikTok Content ID จับได้ คลิปโดนมิวต์/ลด reach
และคลิปขายของยิ่งเสี่ยงเพราะเป็นเชิงพาณิชย์

ใช้แทน:
- **TikTok Commercial Music Library** (เลือกตอนอัปโหลดใน TikTok Shop) หาแนวอะคูสติกกีตาร์โปร่ง
- หรือ prompt Kling: `warm nostalgic acoustic guitar instrumental, slow 75 BPM, no lyrics, no vocals, royalty-free style, fade in over 2 seconds`

---

## แนะนำโมเดล

| ช็อต | โมเดล | เหตุผล |
|---|---|---|
| S1, S2, S4, S5 | **Kling 2.6** | ได้ภาพ+เสียง ambient พร้อมกัน ไม่ต้องหา SFX |
| S3, S6 | **Runway Gen 4.5** (image-to-video) | รักษาสินค้าให้เหมือนรูปต้นฉบับได้ดีสุด |
| ตัดต่อ + text | CapCut | ใส่ text overlay ในนี้ ไม่ต้องให้ AI เขียน |

ถ้าอยากทำเร็ว: เจน S1/S2/S4/S5 ด้วย Kling → ต่อใน CapCut → ใส่รูปจริงเป็น S3/S6 → พิมพ์ text ทับเอง
