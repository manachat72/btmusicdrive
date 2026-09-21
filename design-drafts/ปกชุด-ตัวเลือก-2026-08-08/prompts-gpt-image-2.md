# Prompt gpt-image-2 สำหรับผลิตปกจริง (6 แบบ)

ทุก prompt ทำตามกติกา skill: ชื่อชุดตัว 3D ทองช่วงบน · ล่าง 1/3 โปร่ง (โดนแถบ BUTTHRRM ทับ) · มุมบนสองข้างสะอาด · ไม่มีรายชื่อเพลง/โลโก้/ราคา

## วิธีรัน (ในเครื่อง จากโฟลเดอร์ downloader_mp3_mp4 — ต้องมี env OPENAI_API_KEY)

```bash
python tools/cover_ai/generate_cover.py --prompt "<วาง prompt ด้านล่าง>" --composite frame
python tools/cover_ai/check_layout.py --mode frame --annotate
```

ถ้าเลือกแบบไหนแล้วอยากได้ครบชุด (แผ่นพิมพ์+รายชื่อเพลง) ใช้ `make_cover_set.py --project "<โฟลเดอร์โปรเจกต์>" --prompt "..."`

---

## แบบ 1 — สตริง 90s เรโทร

Retro 1990s Thai city-pop album cover. Neon sunset sky in purple-pink-orange, large sun with horizontal scanlines, glowing synthwave grid floor, palm tree silhouettes at both sides, a retro cassette tape at center. Thai title "รวมฮิตสตริง 90s" in shiny 3D gold letters in the upper third. Nostalgic, vibrant, clean upper corners, keep the bottom third of the image simple and uncluttered.

## แบบ 2 — ลูกทุ่งทองวินเทจ

Vintage Thai countryside album cover at golden hour. Endless golden rice field, warm sun low on the horizon, wooden cart and small farmhouse silhouettes, rice stalks in the foreground, flying birds. Warm amber-gold color palette, film-grain nostalgic mood. Thai title "ลูกทุ่งรวมฮิต" in bold 3D gold letters in the upper third. Clean upper corners, bottom third simple and uncluttered.

## แบบ 3 — เพื่อชีวิตกองไฟ

Thai folk-rock "songs for life" album cover. Night mountain landscape under a starry sky with a bright moon, a warm campfire glowing, silhouette of a man playing acoustic guitar beside the fire. Deep blue-teal night tones contrasted with orange firelight. Thai title "เพื่อชีวิต รวมฮิต" in rugged 3D gold letters in the upper third. Clean upper corners, bottom third simple and dark.

## แบบ 4 — ลูกกรุงอาร์ตเดโค

Elegant classic Thai "luk krung" album cover, 1950s art-deco style. Deep navy background with a golden sunburst pattern, a brass gramophone with vinyl record at center, thin gold deco columns at the sides, floating gold music notes. Luxurious, nostalgic ballroom mood. Thai title "ลูกกรุงคลาสสิก" in refined 3D gold letters in the upper third. Clean upper corners, bottom third simple.

## แบบ 5 — หมอลำ 3ช่า ปาร์ตี้

Festive Thai molam concert album cover. Purple-magenta stage with bright spotlights, a mirror disco ball, silhouettes of khaen bamboo mouth organs and a dancing crowd, colorful pha-khao-ma striped fabric accent. Energetic festival night mood. Thai title "หมอลำม่วนซื่น" in playful 3D gold letters in the upper third. Clean upper corners, bottom third simple and dark.

## แบบ 6 — สากล Golden Oldies

Premium international oldies album cover. Dark warm background with soft golden bokeh lights, a large black vinyl record with gold rim and red label at center, silver tonearm touching the record. Classy retro listening-room mood. Thai title "เพลงสากลอมตะ" in luxurious 3D gold letters in the upper third, small English subtitle "GOLDEN OLDIES". Clean upper corners, bottom third simple and dark.
