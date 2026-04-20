const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const imagesDir = path.resolve(__dirname, '..', 'images');
const files = fs.readdirSync(imagesDir).filter(f => f.toLowerCase().endsWith('.webp'));

// Keep hero files out of this batch (they're already hand-crafted)
const SKIP = ['hero-mobile.webp', 'hero-desktop.webp'];

const QUALITY = 50;   // more aggressive — WebPs are already compressed
const EFFORT = 9;     // maximum effort for smallest size

let totalBefore = 0;
let totalAfter = 0;
let kept = 0;
let deleted = 0;

(async () => {
  for (const f of files) {
    if (SKIP.includes(f)) continue;

    const src = path.join(imagesDir, f);
    const dest = path.join(imagesDir, f.replace(/\.webp$/i, '.avif'));

    try {
      const buf = await sharp(src)
        .avif({ quality: QUALITY, effort: EFFORT })
        .toBuffer();

      const beforeSize = fs.statSync(src).size;
      const afterSize = buf.length;

      if (afterSize >= beforeSize * 0.9) {
        // AVIF saves less than 10% — not worth it, skip
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        deleted++;
        console.log(`  SKIP  ${f.slice(0, 55).padEnd(55)} ${(beforeSize/1024).toFixed(0).padStart(4)}KB → ${(afterSize/1024).toFixed(0).padStart(4)}KB (not worth)`);
        continue;
      }

      fs.writeFileSync(dest, buf);
      totalBefore += beforeSize;
      totalAfter += afterSize;
      kept++;
      const pct = ((1 - afterSize / beforeSize) * 100).toFixed(0);
      console.log(`  KEEP  ${f.slice(0, 55).padEnd(55)} ${(beforeSize/1024).toFixed(0).padStart(4)}KB → ${(afterSize/1024).toFixed(0).padStart(4)}KB (-${pct}%)`);
    } catch (err) {
      console.error(`  ERR   ${f}: ${err.message}`);
    }
  }

  console.log(`\nKept: ${kept}, Skipped (not worth): ${deleted}`);
  if (totalBefore > 0) {
    console.log(`Savings on kept files: ${(totalBefore/1024).toFixed(0)}KB → ${(totalAfter/1024).toFixed(0)}KB (-${((1 - totalAfter/totalBefore) * 100).toFixed(0)}%)`);
  }
})();
