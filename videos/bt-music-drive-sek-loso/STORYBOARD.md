---
format: 1080x1920
duration: 15s
message: "พกเส้นทางเพลงร็อกในตำนาน 172 เพลงไปฟังได้ทุกที่ด้วย USB MP3"
arc: "Category hook → nostalgia → proof → ease → offer + CTA"
audience: "แฟนเพลงร็อกไทยและผู้ฟังที่ต้องการเปิดเพลง MP3 ในรถ คอมพิวเตอร์ หรือลำโพง"
language: th-TH
mode: autonomous
music: "original copyright-free Thai classic rock instrumental, heavy electric guitar, tight drums, energetic but under narration"
captions: false
---

## Video direction

- Palette system: use `frame.md` exactly — ink-black `#080604` as the dominant ground, cream `#F4E6C3` for copy, fire-orange `#F05A1A` as the only motion accent, and cream-muted `#C89738` for gold metadata. Photo assets keep their original red/gold color; never recolor the bitmaps.
- Type system: Kanit display/body by role, massive weight contrast, one dominant statement per frame, flat broadside plane, sharp edges and 1px hairlines. Keep Thai copy live HTML text; never bake newly generated Thai into imagery.
- Motion grammar: smooth long-tail settles; every reveal follows the spoken cue across the back half of its frame. Use deterministic finite ember particles, light sweeps, and camera moves only. No lazy breathing; during a hold use stillness or one low-amplitude finite subtle jitter.
- Rhythm: Frames 1–4 build energy through reveal → pan → proof impact → product clarity. Frame 5 is the deliberate breather: price and CTA hold cleanly long enough to read.
- Caption keep-out: keep all critical copy, faces, the 172 metric, USB, icons, price, and CTA inside the top 83% of the 1080×1920 canvas; the bottom 17% stays clear for captions.
- Negative list: no regenerated faces, no artist voice imitation, no warped source art, no gradients added to the broadside ground, no second accent hue, no rounded card UI, no random logos, no infinite loops, no bouncy default motion, no slideshow front-load/freeze, and no screensaver motion with independent floating elements.

## Frame 1 — ปกเปิดตัว

- scene: ความมืดและประกายไฟเปิดทางให้ภาพปกต้นฉบับซูมเข้ากลางเวที
- voiceover: "คิดถึงเพลงร็อกในตำนานไหม?"
- duration: 2.194s
- poster: 1.5s
- transition_in: cut
- status: animated
- src: compositions/frames/01-cover-reveal.html
- type: hook
- persuasion: Nostalgia trigger
- beat: curiosity + recognition
- blueprint: compose
- asset_candidates: assets/sek-loso-cover.png — exact supplied cover artwork with locked faces and original Thai title
- text_on_screen: "คิดถึงเพลงร็อกในตำนานไหม?"
- focal: assets/sek-loso-cover.png
- roles: sek-loso-cover = cutout hero, preserved bitmap; headline = foreground live text; ember field = background
- sfx: electric-guitar-hit, fire-whoosh

narrativeRole: เปิดด้วยคำถามที่เรียกความทรงจำทันที พร้อมให้ภาพปกเป็นคำตอบทางอารมณ์
keyMessage: นี่คือชุดเพลงร็อกที่คนดูคิดถึง

Use the source bitmap intact. Do not synthesize, redraw, warp, relight, or replace any face or lettering inside the artwork.

Compose: build the rhetorical hook directly from a fire-streak entrance, locked bitmap reveal, and VO-paced live headline so the original artwork stays untouched.

Scene 1 (0.0–0.60s): ink-black full-bleed background; one fire-orange guitar-like light streak snaps upward with a basic transform as a deterministic ember burst crosses the upper half (`particle-burst`). Centered layered-depth composition with the frame still mostly dark; only the incoming sound hit and streak are visible.

Scene 2 (0.60–1.70s): the exact cover bitmap reveals at center through a fast transform push and resolves from a tight crop to a full square card via a smooth coordinate-target zoom (`coordinate-target-zoom`). As the voice reaches “เพลงร็อกในตำนาน,” the live Thai headline assembles chunk-by-chunk in the upper third (`dynamic-content-sequencing`), cream text with “ตำนาน” in fire-orange; centered hero, 3 depth layers, source faces untouched.

Scene 3 (1.70–2.194s): the question mark lands with one restrained basic scale settle; cover and headline hold completely still for the read while a bounded ember tail finishes. No exit animation; the harness transition owns the cut.

## Frame 2 — สามยุคบนเส้นทางเดียวกัน

- scene: กล้องเคลื่อนผ่านสามช่วงยุคจากภาพปกเดียวกันด้วยการครอปและพารัลแลกซ์แบบไม่แก้ภาพต้นฉบับ
- voiceover: "รวมเส้นทางดนตรี เสก โลโซ"
- duration: 2.351s
- poster: 3s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/02-three-eras.html
- type: product_intro
- persuasion: Heritage and authority
- beat: nostalgia + awe
- blueprint: compose
- asset_candidates: assets/sek-loso-cover.png — exact supplied cover artwork containing early era, classic rock era, and present day
- text_on_screen: "เส้นทางดนตรี จากอัลบั้มแรกสู่ปัจจุบัน"
- focal: assets/sek-loso-cover.png
- roles: sek-loso-cover = three crop stations from one preserved bitmap; timeline labels = supporting live text; light sweeps = background accent
- sfx: cinematic-whoosh, spotlight-sweep

narrativeRole: แสดงความกว้างของช่วงเวลาและทำให้สินค้าเป็นการรวบรวมเส้นทางดนตรี
keyMessage: เพลงจากหลายช่วงยุคถูกรวมไว้ด้วยกัน

All three stations must be cropped views of the same original bitmap. Animate only crop position, scale, light overlays, and depth; never generate a new face.

Compose: use one oversized world with three masked crop stations taken from the same source bitmap; the terminal station remains the held “present day” landing.

Scene 1 (0.0–0.73s): an oversized horizontal world opens on the left/early-era crop from the exact cover, filling the upper 75% with the face and guitar safely inside frame; the “ยุคแรก” live label appears above a 1px timeline with a basic scale-X draw. Rule-of-thirds framing, preserved bitmap, warm muted-gold spotlight.

Scene 2 (0.73–1.56s): the `.world` pans left to center the classic-rock middle crop (`viewport-change`); a fire-orange light sweep crosses only as the camera arrives (`ambient-glow-bloom`). The live label “ยุคคลาสสิก” reveals on the spoken phrase “เส้นทางดนตรี,” with background poster texture staying part of the source image.

Scene 3 (1.56–2.351s): one final `.world` pan lands on the present-day right crop and locks (`viewport-change`); “ปัจจุบัน” and the full line “เส้นทางดนตรี จากอัลบั้มแรกสู่ปัจจุบัน” reveal sequentially in the upper third (`dynamic-content-sequencing`). Hold the final station from 2.09s; no back-half drift.

## Frame 3 — หลักฐาน 172 เพลง

- scene: ภาพรายชื่อเพลงสามแผ่นเลื่อนและประกอบเป็นชั้น ก่อนตัวเลข 172 กระแทกขึ้นตรงกลาง
- voiceover: "มากถึง 172 เพลง"
- duration: 2.273s
- poster: 2.2s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/03-tracklist-proof.html
- type: feature_showcase
- persuasion: Statistical proof
- beat: abundance + excitement
- blueprint: compose
- asset_candidates: assets/sek-loso-tracks-01.png — exact track list entries 001–058; assets/sek-loso-tracks-02.png — exact track list entries 059–117; assets/sek-loso-tracks-03.png — exact track list entries 118–172
- text_on_screen: "รวม 172 เพลง | MP3 128 kbps"
- focal: assets/sek-loso-tracks-02.png
- roles: three track-list bitmaps = supporting proof cards; 172 = foreground hero metric; MP3 128 kbps = supporting live label
- sfx: paper-card-whoosh, metal-impact

narrativeRole: เปลี่ยนความรู้สึกคิดถึงให้เป็นหลักฐานปริมาณที่จับต้องได้
keyMessage: สินค้านี้มีเพลงรวม 172 เพลงในรูปแบบ MP3

Keep every track-list image as an unaltered bitmap card. Text may be small during motion but must not be regenerated or rewritten.

Compose: build a traversed proof field from the three authentic track-list cards and land the value-scaled hero metric “172.”

Scene 1 (0.0–0.64s): the first and second track-list bitmaps slide a short distance directly into tall stacked slots from opposite sides, sharp and unmodified; the third remains just off-frame. Asymmetric 60/40 field on ink-black with thin fire-orange hairlines; card motion uses short-path `center-outward-expansion`, not a shared-center burst.

Scene 2 (0.64–1.63s): the third track-list card joins to form a dense triptych while the card group pans with a basic transform. As the voice names “172,” the foreground number counts 0→172 and scales to dominate (`counting-dynamic-scale`), finishing with a brief basic impact settle. Cards dim slightly behind the metric using selective focus (`depth-of-field-blur`).

Scene 3 (1.63–2.273s): “รวม 172 เพลง” locks in the upper third and “MP3 128 kbps” draws beneath it; a single fire-orange glow blooms behind the number (`ambient-glow-bloom`) and settles. The full evidence composition holds static for the final 0.42s.

## Frame 4 — เสียบแล้วฟัง

- scene: USB สีดำขอบทองหมุนช้าเหนือแท่นเวที ไอคอนรถยนต์ คอมพิวเตอร์ และลำโพงประกอบขึ้นด้านล่าง
- voiceover: "เสียบแล้วฟังได้ทันที"
- duration: 2.038s
- poster: 2.2s
- transition_in: squeeze
- status: animated
- src: compositions/frames/04-plug-and-play.html
- type: benefit_highlight
- persuasion: Friction reduction
- beat: ease + control
- blueprint: grid-card-assemble (Adapt)
- asset_candidates:
- text_on_screen: "เสียบแล้วฟังได้ทันที | รถยนต์ • คอมพิวเตอร์ • ลำโพง"
- focal: generated premium black USB 2.0 hero
- roles: USB = foreground focal built in HTML/CSS/SVG; car/computer/speaker icons = supporting vector tiles; stage and spotlight = background
- sfx: mechanical-spin, usb-click

narrativeRole: แปลคุณสมบัติสินค้าเป็นประโยชน์ที่เข้าใจในหนึ่งวินาที
keyMessage: ใช้ง่ายและรองรับอุปกรณ์ที่ผู้ชมใช้อยู่แล้ว

Construct the USB and icons deterministically with HTML/CSS/SVG. Use no third-party logo and no artist artwork in this frame.

Adapt: keep the blueprint’s three-item stagger assemble and resolved grid; place one USB hero above the three device icons. The icon row assembles on the spoken ease claim and then stops.

Scene 1 (0.0–0.61s): on an ink-black concert-stage plane, a black USB with restrained muted-gold trim rotates once from a three-quarter angle into a readable front angle using a bounded 3D transform (`depth-scatter-assemble`, single hero only), then settles above a sharp rectangular pedestal. Centered template, USB occupies at least 45% of the upper content area; a fire-orange spotlight blooms behind it (`ambient-glow-bloom`).

Scene 2 (0.61–1.46s): as the voice says “เสียบแล้วฟัง,” three sharp vector tiles assemble directly into a 3-column row—car, computer, speaker—via short-path stagger (`center-outward-expansion`); their internal line icons draw on (`svg-path-draw`). The live headline “เสียบแล้วฟังได้ทันที” reveals above the row on the phrase cue (`dynamic-content-sequencing`).

Scene 3 (1.46–2.038s): the device names “รถยนต์ • คอมพิวเตอร์ • ลำโพง” resolve under their icons; a small connector line from the USB to the icon row draws once (`svg-path-draw`). USB, headline, and icons hold still for legibility; only the already-running glow settles.

## Frame 5 — ราคาและคำสั่งซื้อ

- scene: ภาพปกต้นฉบับกลับมาเต็มจอ พร้อมการ์ดราคา โลโก้ BT และปุ่มสั่งซื้อที่หยุดนิ่งพอให้อ่านทัน
- voiceover: "วันนี้เพียง 199 บาท สั่งเลยที่ BT Music Drive"
- duration: 6.144s
- poster: 2.3s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/05-offer-cta.html
- type: cta
- persuasion: Price anchoring + urgency-to-act
- beat: motivation + urgency-to-act
- blueprint: titlecard-reveal (Adapt)
- asset_candidates: assets/sek-loso-cover.png — exact supplied cover artwork for the final product card; assets/bt-logo.webp — circular gold BT brand mark
- text_on_screen: "พิเศษเพียง 199.- | 319.- | สั่งเลยที่ BT Music Drive"
- focal: assets/sek-loso-cover.png
- roles: sek-loso-cover = preserved background product card dimmed 35%; bt-logo = foreground brand mark; price and CTA = live text foreground
- sfx: price-impact-soft, logo-lock

narrativeRole: ปิดการขายด้วยราคาที่จำง่ายและคำสั่งซื้อที่ตรงไปตรงมา
keyMessage: ราคาโปรโมชั่น 199 บาท และสั่งซื้อผ่าน BT Music Drive

Keep the cover artwork and logo as supplied bitmaps. The 319.- price must be visibly crossed out, while 199.- and the CTA remain legible through the final frame.

Adapt: keep the blueprint’s calm two-card CTA chain with instant full-opacity seam; the source cover remains a fixed, preserved background while the offer and brand lockup take turns as the readable foreground.

Scene 1 (0.0–0.70s): the exact cover bitmap reveals full-bleed behind a 35% ink-black veil, centered and unwarped; a narrow fire-orange light sweep clears the previous frame (`ambient-glow-bloom`). Static camera, upper 83% contains all critical content.

Scene 2 (0.70–2.56s): the offer card arrives with one restrained upward settle (`scale-swap-transition`): small “พิเศษเพียง,” large fire-orange “199.-,” and muted “319.-” below. The old price receives one live SVG strike draw (`svg-path-draw`) exactly as the voice says “199 บาท.” Hold the price at full opacity.

Scene 3 (2.56–4.65s): instant hard-cut handoff at full opacity to the final brand card; the supplied BT mark locks beside live text “BT Music Drive,” then the CTA “สั่งเลยที่ BT Music Drive” reveals left-to-right (`discrete-text-sequence`). Price 199.- stays as a smaller anchor above. Everything holds completely still from 3.64s to the final frame.
