const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter(f => f.endsWith('.html'));

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap';

let changed = 0;
for (const f of files) {
  const p = path.join(root, f);
  let s = fs.readFileSync(p, 'utf8');
  const before = s;

  // 1. Replace Tailwind CDN with local compiled CSS
  s = s.replace(
    /<script\s+src="https:\/\/cdn\.tailwindcss\.com"><\/script>/g,
    '<link rel="stylesheet" href="tailwind.min.css">'
  );

  // 2. Remove the inline tailwind.config = {...} script block (no longer needed)
  s = s.replace(
    /<script>\s*tailwind\.config\s*=\s*\{[\s\S]*?\};?\s*<\/script>\s*/g,
    ''
  );

  // 3. Add defer to Phosphor Icons
  s = s.replace(
    /<script\s+src="https:\/\/unpkg\.com\/@phosphor-icons\/web"><\/script>/g,
    '<script defer src="https://unpkg.com/@phosphor-icons/web"></script>'
  );

  // 4. Google Fonts: swap to non-blocking load (skip if already converted)
  if (!s.includes('media="print" onload')) {
    const fontLinkRegex = new RegExp(
      `<link\\s+(?:href="${FONT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+rel="stylesheet"|rel="stylesheet"\\s+href="${FONT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}")\\s*>`,
      'g'
    );
    const replacement =
      `<link rel="preload" as="style" href="${FONT_URL}">\n` +
      `    <link rel="stylesheet" href="${FONT_URL}" media="print" onload="this.media='all'">\n` +
      `    <noscript><link rel="stylesheet" href="${FONT_URL}"></noscript>`;
    s = s.replace(fontLinkRegex, replacement);

    // Alternative multi-line format
    const multilineRegex = new RegExp(
      `<link[\\s\\n]+href="${FONT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\n]+rel="stylesheet"\\s*>`,
      'g'
    );
    s = s.replace(multilineRegex, replacement);
  }

  if (s !== before) {
    fs.writeFileSync(p, s);
    changed++;
    console.log('updated:', f);
  }
}
console.log(`\nTotal files changed: ${changed}/${files.length}`);
