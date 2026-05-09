#!/usr/bin/env node
/**
 * Replace <i class="ph ph-ICON ..."> tags in index.html with inline SVG.
 * Also removes the two Phosphor <link rel="preload"> lines from the head.
 * Backup written to index.html.bak before any changes.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const SVGS_JSON = path.join(__dirname, '_phosphor_svgs.json');

const svgs = JSON.parse(fs.readFileSync(SVGS_JSON, 'utf8'));

// Build lookup: iconName (with optional -fill suffix) → SVG path string
function getPath(iconName, fill) {
  const key = fill ? `${iconName}-fill` : iconName;
  const paths = svgs[key];
  if (!paths) throw new Error(`No SVG found for: ${key}`);
  return paths.map(d => `<path d="${d}"/>`).join('');
}

function makeSvg(iconName, fill, extraClasses, ariaHidden) {
  const svgPaths = getPath(iconName, fill);
  const classAttr = extraClasses.trim()
    ? ` class="${extraClasses.trim()} inline-block"`
    : ` class="inline-block"`;
  const ariaAttr = ariaHidden ? ' aria-hidden="true"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"` +
    ` width="1em" height="1em" fill="currentColor" style="vertical-align:-0.125em"` +
    `${classAttr}${ariaAttr}>${svgPaths}</svg>`;
}

/**
 * Parse a single <i class="..."> tag and return the replacement SVG string,
 * or null if it's not a Phosphor icon.
 */
function replaceITag(fullMatch) {
  // Extract the class attribute value
  const classMatch = fullMatch.match(/class="([^"]*)"/);
  if (!classMatch) return null;
  const classes = classMatch[1].split(/\s+/);

  // Detect fill variant
  const isFill = classes.includes('ph-fill');

  // Find the icon name: the class starting with ph- that is NOT 'ph' and NOT 'ph-fill'
  const iconClass = classes.find(c => c.startsWith('ph-') && c !== 'ph-fill');
  if (!iconClass) return null;
  const iconName = iconClass.replace(/^ph-/, '');

  // Check we have SVG for this icon
  const key = isFill ? `${iconName}-fill` : iconName;
  if (!svgs[key]) return null;

  // aria-hidden
  const ariaHidden = /aria-hidden="true"/.test(fullMatch);

  // Extra classes = all classes minus 'ph', 'ph-fill', 'ph-ICONNAME'
  const skipClasses = new Set(['ph', 'ph-fill', iconClass]);
  const extra = classes.filter(c => !skipClasses.has(c)).join(' ');

  return makeSvg(iconName, isFill, extra, ariaHidden);
}

let html = fs.readFileSync(HTML, 'utf8');

// Backup
fs.writeFileSync(HTML + '.bak', html);

// Replace all <i class="ph..."> tags (self-closing-style with empty content)
let replacements = 0;
html = html.replace(/<i\s+class="[^"]*\bph\b[^"]*"[^>]*><\/i>/g, (match) => {
  const replacement = replaceITag(match);
  if (replacement) { replacements++; return replacement; }
  return match;
});

// Remove the two Phosphor CSS <link rel="preload"> lines from <head>
// They're on a single concatenated line (line 48 in original)
const phosphorPreloadRE = /<link rel="preload" href="\/vendor\/phosphor\/[^"]*" as="style" onload="[^"]*"><link rel="preload" href="\/vendor\/phosphor\/[^"]*" as="style" onload="[^"]*"><noscript><link rel="stylesheet" href="\/vendor\/phosphor\/[^"]*"><link rel="stylesheet" href="\/vendor\/phosphor\/[^"]*"><\/noscript>/;
const hadPhosphorPreload = phosphorPreloadRE.test(html);
html = html.replace(phosphorPreloadRE, '<!-- Phosphor CSS removed: replaced with inline SVG -->');

fs.writeFileSync(HTML, html, 'utf8');

console.log(`Replaced ${replacements} <i> tags with inline SVG`);
console.log(`Phosphor preload block removed: ${hadPhosphorPreload}`);
console.log(`Backup saved to index.html.bak`);
