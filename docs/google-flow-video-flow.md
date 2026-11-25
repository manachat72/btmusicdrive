# Flow: สั่ง Google Flow (Veo) สร้างวิดีโอรีวิวสินค้า ผ่าน Claude in Chrome

> ทดสอบจริง 2026-11-09 กับ `BT-ST-04-043` · ใช้โดย skill `video-director` ขั้น "ผลิต"
> Flow ย้ายไป `https://flow.google.com` และเป็นหน้าแชตกับ Agent ของ Flow แล้ว (ไม่มีเมนูเลือกโหมดวิดีโอเหมือนเดิม)

## ข้อจำกัดของหน้า Flow (สำคัญ)

| เรื่อง | ผล | ทางออก |
|---|---|---|
| `screenshot` / `find` / `read_page` / `get_page_text` | ใช้ไม่ได้ (หน้าไม่เคย idle → timeout) | ใช้ `javascript_tool` อย่างเดียว |
| `fetch` รูปจาก CDN / localhost | CSP บล็อก | ส่งรูปผ่าน URL hash ด้วย `scripts/video/flow-relay.js` |
| คลิกปุ่มส่งด้วย `button.click()` | ไม่ส่ง | กด `computer key Return` ตอน editor focus อยู่ |
| ปุ่ม "อนุมัติ" เป็น `div[role=radio]` | `click()` เฉย ๆ ไม่ติด | dispatch `pointerdown→mousedown→pointerup→mouseup→click` |
| `javascript_tool` รอเกิน 45 วิ | CDP timeout | รอครั้งละ ≤30 วิ แล้วเรียกใหม่ |

## ขั้นตอน

1. **เปิดโปรเจกต์ใหม่** — `navigate https://flow.google.com` → JS คลิกปุ่มที่มีข้อความ `โปรเจ็กต์ใหม่`
   → URL เป็น `https://flow.google.com/project/<id>` (จด id ลง `job.json` ช่อง `flowProjectUrl`)
   ใช้โปรเจกต์เดียวต่อรอบคิวได้ ไม่ต้องสร้างใหม่ทุก SKU
2. **ส่งรูปเข้าแท็บ** — รัน background: `node scripts/video/flow-relay.js videos/flow/<SKU>/cover.webp <flowProjectUrl>`
   → `navigate http://127.0.0.1:4788/` → รอ 6 วิ แล้ว JS:
   ```js
   const [mime,b64]=location.hash.slice(7).split(';'); const bin=atob(b64);
   const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
   window.__btFile=new File([u],'cover.'+mime.split('/')[1],{type:mime});
   history.replaceState(null,'',location.pathname);
   ```
3. **แนบรูป** — JS: `const ed=document.querySelector('.ProseMirror'); ed.focus();` แล้ว dispatch
   `ClipboardEvent('paste')` ที่มี `DataTransfer` ใส่ `window.__btFile`
   ⚠ อย่าเลือก `textarea` ตัวสุดท้าย (เป็นของ reCAPTCHA) · ตรวจผล: มี `img[src*="flow-content.google/image"]` ในกล่องพรอม
4. **ใส่พรอม** — `document.execCommand('insertText', false, script.flowPrompt)` บน `.ProseMirror`
5. **ส่ง** — `computer key Return` → editor ว่าง (`innerText.length<=1`)
6. **อนุมัติเครดิต** — ใน 20–30 วิ Agent ของ Flow จะถามในกล่อง `flow-permission-message`
   เช่น "…Veo 3.1 - Lite … ใช้เครดิต 10 ไหม"
   - user อนุญาตให้กด **"อนุมัติ"** เองทีละคลิป (2026-11-09) — **ห้ามกด "อนุมัติเสมอ"**
   - ถ้าเครดิตที่ขอ **เกิน 10** หรือเป็นโมเดลอื่นที่แพงกว่า → หยุดถาม user ก่อน
   - จดเครดิตที่ใช้ลง `job.json` ช่อง `creditsUsed`
7. **รอวิดีโอ** — ช่วงคนเยอะ Flow ตอบว่า "อยู่ในคิว" อาจรอหลายนาที
   เช็กทุก ~30 วิ: `document.querySelectorAll('video')` / ข้อความแชตล่าสุด
8. **ดาวน์โหลด** — (ดูหัวข้อล่างสุด) ย้ายไฟล์ไป `videos/flow/<SKU>/video.mp4`

## ดาวน์โหลด

- การ์ดวิดีโอที่เสร็จแล้วอยู่ในแผงสื่อด้านซ้าย มีป้าย `Veo 3.1 - Lite • 720p • 8 วินาที` และปุ่ม `play_circle`
  (ใช้ `[...document.querySelectorAll('video')]` เช็กไม่ได้ — การ์ดเป็น `img` thumbnail)
- ปุ่ม `button[aria-label="ดาวน์โหลด"]` **ตัวแรก** = การ์ดใหม่สุด (ตัวหลัง ๆ เป็นรูป cover.webp) → JS `click()` ได้เลย ไม่มีเมนูให้เลือก
- Chrome ของ user ตั้งให้ถามที่เซฟ → ไฟล์ค้างเป็น `%USERPROFILE%\Downloads\<uuid>.tmp` (เนื้อไฟล์ครบแล้ว)
  วิธีเก็บ: ก่อนกดจด `ls -t ~/Downloads` → กดแล้วรอ 5–10 วิ → หาไฟล์ใหม่ (`.mp4` หรือ `.tmp`)
  → เช็ก `ffprobe` ว่ามี video stream → **copy** (ไม่ใช่ move) ไป `videos/flow/<SKU>/video.mp4`
  ไม่ต้องไปยุ่งกับหน้าต่าง Save ของ Chrome — บอก user ทีเดียวตอนจบคิวว่ากด Cancel ได้
- ผลทดสอบ: 720×1280, 7.93 วิ, มีเสียง, ~1.5 MB

## ปัญหาที่เจอจากการทดสอบ

- Veo แต่งตัวหนังสือมั่วบนปุ่มเครื่องเสียงรถ → แม่แบบพรอมระบุ "หน้าเครื่องเสียงเบลอ ไม่มีตัวหนังสือ" แล้ว
- แพ็ก/ปก/โลโก้ออกมาตรงต้นฉบับดีมาก (image-to-video ด้วยรูปปกพื้นขาว)
