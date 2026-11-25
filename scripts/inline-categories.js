// Inlines categories.json into HTML files as window.__CATEGORIES__
// so pages don't need to fetch it separately on first paint.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CATEGORIES_JSON = path.join(ROOT, 'categories.json');
const TARGETS = ['index.html', 'shop.html', 'category.html'];

const START = '<!-- INLINE_CATEGORIES_START -->';
const END = '<!-- INLINE_CATEGORIES_END -->';

const categories = JSON.parse(fs.readFileSync(CATEGORIES_JSON, 'utf8'));
const payload = JSON.stringify(categories).replace(/</g, '\\u003c');
const block = `${START}\n<script>window.__CATEGORIES__=${payload};</script>\n${END}`;

let updated = 0;
for (const file of TARGETS) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;
  let html = fs.readFileSync(filePath, 'utf8');

  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (re.test(html)) {
    html = html.replace(re, block);
  } else {
    // Insert right before </head>
    html = html.replace(/<\/head>/i, `${block}\n</head>`);
  }
  fs.writeFileSync(filePath, html);
  updated++;
}
console.log(`Inlined categories into ${updated} HTML files`);
