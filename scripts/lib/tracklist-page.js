/** สร้างหน้าเว็บรายชื่อเพลง (ธีมทอง-ดำ + ช่องค้นหา) จากข้อความรายชื่อเพลง — ใช้ร่วมกันหลายสคริปต์ */
function tracklistHtml(title, rawText) {
  const lines = String(rawText).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const rows = [];
  let count = 0;
  for (const l of lines) {
    const m = l.match(/^(\d+)\s*[.)\-]?\s*(.+)$/);
    if (m) { count++; rows.push(`<li><span>${m[1].padStart(3, '0')}</span>${m[2].replace(/\[official.*?\]|\.mp3$/gi, '').replace(/^[.\s]+/, '').trim()}</li>`); }
    else rows.push(`<li class="al">${l}</li>`);   // บรรทัดไม่มีเลข = หัวข้อ/ชื่ออัลบั้ม
  }
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — รายชื่อเพลง</title>
<style>
  * { box-sizing:border-box; margin:0; }
  body { font-family:'Segoe UI',Tahoma,sans-serif; background:#100d08; color:#e8ddc8; padding:0 0 40px; }
  header { background:linear-gradient(180deg,#1a1508,#100d08); text-align:center; padding:28px 16px 18px; border-bottom:2px solid #8B7355; position:sticky; top:0; }
  h1 { font-size:22px; color:#f5c343; letter-spacing:.5px; }
  .n { color:#b3a180; font-size:14px; margin-top:4px; }
  .search { margin:12px auto 0; max-width:420px; }
  .search input { width:100%; padding:10px 16px; border-radius:99px; border:1px solid #8B7355; background:#1c1710; color:#e8ddc8; font-size:15px; outline:none; }
  ol { list-style:none; max-width:560px; margin:14px auto; padding:0 16px; }
  li { padding:7px 10px; border-bottom:1px solid #241d12; font-size:15px; display:flex; gap:10px; }
  li span { color:#8B7355; font-variant-numeric:tabular-nums; flex:none; }
  li.al { background:#1c1710; color:#f5c343; font-weight:600; border-radius:8px; margin:14px 0 4px; border:0; display:block; }
  footer { text-align:center; color:#6b5d45; font-size:12px; margin-top:26px; }
  footer a { color:#f5c343; }
</style></head><body>
<header><h1>${title}</h1><div class="n">รายชื่อเพลงทั้งหมด ${count} เพลง</div>
<div class="search"><input id="q" placeholder="🔍 ค้นหาเพลง…" oninput="f(this.value)"></div></header>
<ol id="list">${rows.join('')}</ol>
<footer>BT Music Drive · <a href="https://btmusicdrive.com">btmusicdrive.com</a></footer>
<script>function f(q){q=q.toLowerCase();document.querySelectorAll('#list li').forEach(li=>{li.style.display=!q||li.textContent.toLowerCase().includes(q)?'':'none'})}</script>
</body></html>`;
}

module.exports = { tracklistHtml };
