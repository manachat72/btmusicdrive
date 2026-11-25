const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const imgDir = path.join(root, 'images');
const archiveDir = path.join(imgDir, '_archive');

if (!fs.existsSync(archiveDir)) {
  console.log('No _archive/ directory');
  process.exit(0);
}

const files = fs.readdirSync(archiveDir);
let moved = 0;
for (const f of files) {
  const src = path.join(archiveDir, f);
  // Restore collision-suffixed names (dir__file.ext) to their original location
  let destRel;
  if (f.includes('__')) {
    const [dir, name] = f.split('__');
    destRel = dir.replace(/_/g, '/') + '/' + name;
  } else {
    destRel = f;
  }
  const dest = path.join(imgDir, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    console.log('Skip (exists):', destRel);
    continue;
  }
  fs.renameSync(src, dest);
  moved++;
}

const remaining = fs.readdirSync(archiveDir);
if (remaining.length === 0) {
  fs.rmdirSync(archiveDir);
  console.log('Removed empty _archive/');
}

console.log(`Restored ${moved} files`);
