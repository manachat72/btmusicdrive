// inject-theme-init.js
// Adds a tiny anti-FOUC theme init snippet to <head> of every HTML file.
// Safe to run multiple times — skips files that already have the snippet.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MARKER = 'btmusicdrive_theme_init';
const SNIPPET = `    <script>/* ${MARKER} */(function(){var t=localStorage.getItem('btmusicdrive_theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');})();</script>`;
// Anchor: insert right after <meta name="viewport" ...> line
const ANCHOR_RE = /(<meta name="viewport"[^>]*>)/;

const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
let updated = 0;

for (const file of htmlFiles) {
    const fullPath = path.join(ROOT, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(MARKER)) continue; // already injected
    const newContent = content.replace(ANCHOR_RE, `$1\n${SNIPPET}`);
    if (newContent === content) continue; // no match (shouldn't happen)
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log('  injected:', file);
    updated++;
}

console.log(`Done: ${updated}/${htmlFiles.length} files updated`);
