const fs = require('fs');
const path = require('path');

const imgDir = path.resolve(__dirname, '..', 'images');
const root = path.resolve(__dirname, '..');

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

const orphans = [...existing].filter(f => !referenced.has(f)).sort();

console.log(`Total files in images/: ${existing.size}`);
console.log(`Referenced in code: ${referenced.size}`);
console.log(`Orphan (not referenced): ${orphans.length}\n`);

if (orphans.length === 0) {
  console.log('✅ No orphan files');
  process.exit(0);
}

// Group by extension
const byExt = {};
for (const f of orphans) {
  const ext = path.extname(f).toLowerCase();
  if (!byExt[ext]) byExt[ext] = [];
  byExt[ext].push(f);
}

for (const [ext, list] of Object.entries(byExt)) {
  console.log(`\n${ext} (${list.length}):`);
  for (const f of list) console.log('  - images/' + f);
}
