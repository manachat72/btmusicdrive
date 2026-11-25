const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const imgDir = path.join(root, 'images');
const archiveDir = path.join(imgDir, '_archive');

const existing = new Set();
function walk(d, base = '') {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) walk(full, rel);
    else existing.add(rel);
  }
}
walk(imgDir);

const referenced = new Set();
const exts = ['.html', '.js', '.json', '.css', '.ts', '.md'];
const skipDirs = ['node_modules', 'server', '.git', 'images', 'dist', 'build'];

function scan(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (skipDirs.includes(e.name) || e.name.startsWith('.')) continue;
      scan(path.join(d, e.name));
    } else if (exts.includes(path.extname(e.name))) {
      const s = fs.readFileSync(path.join(d, e.name), 'utf8');
      for (const f of existing) {
        const base = path.basename(f);
        if (s.includes(base)) referenced.add(f);
      }
    }
  }
}
scan(root);

// Keep: referenced files, anything under images/original/, .gitkeep, _archive/
const toMove = [...existing].filter(f => {
  if (referenced.has(f)) return false;
  if (f.startsWith('original/')) return false;
  if (f.startsWith('_archive/')) return false;
  if (f === '.gitkeep') return false;
  return true;
});

console.log(`Total files: ${existing.size}`);
console.log(`Referenced: ${referenced.size}`);
console.log(`To archive: ${toMove.length}\n`);

if (toMove.length === 0) {
  console.log('Nothing to archive');
  process.exit(0);
}

if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

let moved = 0;
for (const f of toMove) {
  const src = path.join(imgDir, f);
  // Flatten into _archive/ using basename to keep simple
  const dest = path.join(archiveDir, path.basename(f));
  // Handle collisions by prefixing with parent dir
  let finalDest = dest;
  if (fs.existsSync(finalDest)) {
    const parent = path.dirname(f).replace(/[/\\]/g, '_');
    finalDest = path.join(archiveDir, parent + '__' + path.basename(f));
  }
  try {
    fs.renameSync(src, finalDest);
    moved++;
  } catch (err) {
    console.error('Failed to move:', f, err.message);
  }
}

console.log(`Moved ${moved} files to images/_archive/`);

// Clean up empty subdirs under images/ (except original, _archive)
function cleanEmpty(d) {
  const entries = fs.readdirSync(d, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      const full = path.join(d, e.name);
      if (e.name === 'original' || e.name === '_archive') continue;
      cleanEmpty(full);
      try {
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
      } catch {}
    }
  }
}
cleanEmpty(imgDir);
