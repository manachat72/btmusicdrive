const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');

const ASSETS = [
  'app.min.css',
  'script.min.js',
  'components.min.js',
  'checkout.min.js',
];

const hashes = {};
for (const asset of ASSETS) {
  const p = path.join(root, asset);
  if (!fs.existsSync(p)) {
    console.warn('missing asset:', asset);
    continue;
  }
  const buf = fs.readFileSync(p);
  hashes[asset] = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
}

const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));

let changed = 0;
for (const f of htmlFiles) {
  const p = path.join(root, f);
  let s = fs.readFileSync(p, 'utf8');
  const before = s;

  for (const [asset, hash] of Object.entries(hashes)) {
    // Match href="asset" or href="asset?v=xxxx" — same for src=
    const escaped = asset.replace(/\./g, '\\.');
    const regex = new RegExp(`(href|src)="${escaped}(?:\\?v=[a-f0-9]+)?"`, 'g');
    s = s.replace(regex, `$1="${asset}?v=${hash}"`);
  }

  if (s !== before) {
    fs.writeFileSync(p, s);
    changed++;
  }
}

console.log('Hashes:');
for (const [a, h] of Object.entries(hashes)) console.log(`  ${a} → ?v=${h}`);
console.log(`\nHTML files updated: ${changed}/${htmlFiles.length}`);
