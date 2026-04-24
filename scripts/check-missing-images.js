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
console.log('Files on disk in images/:', existing.size);

const refs = new Map();
const exts = ['.html', '.js', '.json', '.css'];
const skipDirs = ['node_modules', 'server', '.git', 'images', '.next', 'dist', 'build'];

function scan(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (skipDirs.includes(e.name) || e.name.startsWith('.')) continue;
      scan(path.join(d, e.name));
    } else if (exts.includes(path.extname(e.name))) {
      const full = path.join(d, e.name);
      const s = fs.readFileSync(full, 'utf8');
      const re = /(?:["'(\s>])(?:\/)?images\/([^"'\s)>,]+?\.(?:webp|avif|png|jpg|jpeg|svg|gif))/gi;
      let m;
      while ((m = re.exec(s))) {
        let ref = m[1]
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/\\/g, '/');
        if (!existing.has(ref)) {
          if (!refs.has(full)) refs.set(full, new Set());
          refs.get(full).add(ref);
        }
      }
    }
  }
}
scan(root);

if (refs.size === 0) {
  console.log('\n✅ All image references exist on disk');
  process.exit(0);
}

console.log('\n❌ Missing image references:\n');
const allMissing = new Set();
for (const [f, set] of refs) {
  const rel = path.relative(root, f);
  console.log(rel);
  for (const r of set) {
    console.log('  - images/' + r);
    allMissing.add(r);
  }
  console.log('');
}
console.log(`\nTotal missing unique paths: ${allMissing.size}`);
console.log(`Total files with broken refs: ${refs.size}`);
