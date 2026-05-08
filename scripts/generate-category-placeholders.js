#!/usr/bin/env node
// Generates branded placeholder WebP images for missing categories.
// Run: node scripts/generate-category-placeholders.js
// Replace outputs with proper AI-generated photos when available.

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'images', 'category');
const SIZE = 1024;

const categories = [
  {
    file: 'category-dance.webp',
    bg: '#0F172A',
    glow1: '#7C3AED',
    glow2: '#DB2777',
    // DJ turntable / sound waves motif
    svg: (s) => `
      <circle cx="${s/2}" cy="${s/2}" r="${s*0.38}" fill="none" stroke="#7C3AED" stroke-width="3" opacity="0.7"/>
      <circle cx="${s/2}" cy="${s/2}" r="${s*0.28}" fill="none" stroke="#DB2777" stroke-width="2" opacity="0.5"/>
      <circle cx="${s/2}" cy="${s/2}" r="${s*0.18}" fill="none" stroke="#A855F7" stroke-width="2" opacity="0.4"/>
      <!-- Sound bars -->
      ${[0,1,2,3,4,5,6].map(i => {
        const h = [160,230,180,280,200,150,240][i];
        const x = s*0.25 + i * 76;
        return `<rect x="${x}" y="${s/2 - h/2}" width="40" height="${h}" rx="20"
          fill="url(#g${i%2})" opacity="0.85"/>`;
      }).join('')}
      <circle cx="${s/2}" cy="${s/2}" r="24" fill="#DB2777" opacity="0.9"/>
      <circle cx="${s/2}" cy="${s/2}" r="10" fill="#0F172A"/>
    `,
    defs: `
      <radialGradient id="bg" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stop-color="#1e0a3c"/>
        <stop offset="100%" stop-color="#0F172A"/>
      </radialGradient>
      <linearGradient id="g0" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#A855F7"/>
        <stop offset="100%" stop-color="#7C3AED"/>
      </linearGradient>
      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#EC4899"/>
        <stop offset="100%" stop-color="#DB2777"/>
      </linearGradient>
    `,
  },
  {
    file: 'category-accessories.webp',
    bg: '#0F172A',
    // USB / connector motif
    svg: (s) => `
      <!-- Connector body -->
      <rect x="${s*0.3}" y="${s*0.42}" width="${s*0.4}" height="${s*0.16}" rx="18" fill="url(#ga)" opacity="0.9"/>
      <rect x="${s*0.38}" y="${s*0.36}" width="${s*0.06}" height="${s*0.08}" rx="6" fill="#64748B" opacity="0.8"/>
      <rect x="${s*0.56}" y="${s*0.36}" width="${s*0.06}" height="${s*0.08}" rx="6" fill="#64748B" opacity="0.8"/>
      <!-- USB cable -->
      <rect x="${s*0.47}" y="${s*0.58}" width="${s*0.06}" height="${s*0.16}" rx="6" fill="#8B7355" opacity="0.9"/>
      <!-- Glow rings -->
      <circle cx="${s/2}" cy="${s/2}" r="${s*0.38}" fill="none" stroke="#0EA5E9" stroke-width="2" opacity="0.3"/>
      <circle cx="${s/2}" cy="${s/2}" r="${s*0.44}" fill="none" stroke="#8B7355" stroke-width="1.5" opacity="0.2"/>
      <!-- Contact pins -->
      ${[0,1,2,3].map(i => `<rect x="${s*0.36 + i*s*0.075}" y="${s*0.455}" width="${s*0.04}" height="${s*0.09}" rx="4" fill="#0F172A" opacity="0.8"/>`).join('')}
    `,
    defs: `
      <radialGradient id="bg" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stop-color="#0c2340"/>
        <stop offset="100%" stop-color="#0F172A"/>
      </radialGradient>
      <linearGradient id="ga" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#475569"/>
        <stop offset="50%" stop-color="#94A3B8"/>
        <stop offset="100%" stop-color="#475569"/>
      </linearGradient>
    `,
  },
  {
    file: 'category-dhamma.webp',
    bg: '#110A00',
    // Dhamma wheel / lotus motif
    svg: (s) => {
      const cx = s / 2, cy = s / 2, r = s * 0.32;
      const spokes = Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI * 2) / 8;
        const x2 = cx + Math.cos(a) * r;
        const y2 = cy + Math.sin(a) * r;
        return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#F59E0B" stroke-width="6" opacity="0.75"/>`;
      }).join('');
      const petals = Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI * 2) / 8;
        const px = cx + Math.cos(a) * r * 1.22;
        const py = cy + Math.sin(a) * r * 1.22;
        return `<ellipse cx="${px}" cy="${py}" rx="${s*0.07}" ry="${s*0.14}"
          transform="rotate(${i*45} ${px} ${py})"
          fill="url(#gd)" opacity="0.6"/>`;
      }).join('');
      return `
        ${petals}
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F59E0B" stroke-width="4" opacity="0.8"/>
        ${spokes}
        <circle cx="${cx}" cy="${cy}" r="${s*0.06}" fill="#F59E0B" opacity="0.9"/>
        <circle cx="${cx}" cy="${cy}" r="${s*0.03}" fill="#0F172A"/>
        <circle cx="${cx}" cy="${cy}" r="${r*1.45}" fill="none" stroke="#D97706" stroke-width="2" opacity="0.3"/>
      `;
    },
    defs: `
      <radialGradient id="bg" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stop-color="#1c1000"/>
        <stop offset="100%" stop-color="#110A00"/>
      </radialGradient>
      <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FCD34D"/>
        <stop offset="100%" stop-color="#92400E"/>
      </linearGradient>
    `,
  },
  {
    file: 'category-radio.webp',
    bg: '#0F172A',
    // Vintage radio / broadcast tower motif
    svg: (s) => `
      <!-- Radio body -->
      <rect x="${s*0.22}" y="${s*0.42}" width="${s*0.56}" height="${s*0.32}" rx="24" fill="url(#gr)" opacity="0.85"/>
      <!-- Speaker grille circles -->
      <circle cx="${s*0.38}" cy="${s*0.58}" r="${s*0.1}" fill="#0F172A" opacity="0.6"/>
      <circle cx="${s*0.38}" cy="${s*0.58}" r="${s*0.075}" fill="none" stroke="#8B7355" stroke-width="3" opacity="0.7"/>
      <circle cx="${s*0.38}" cy="${s*0.58}" r="${s*0.045}" fill="none" stroke="#8B7355" stroke-width="2" opacity="0.5"/>
      <!-- Tuner dial -->
      <rect x="${s*0.56}" y="${s*0.48}" width="${s*0.14}" height="${s*0.08}" rx="6" fill="#0F172A" opacity="0.7"/>
      <rect x="${s*0.57}" y="${s*0.49}" width="${s*0.06}" height="${s*0.06}" rx="4" fill="#DC2626" opacity="0.9"/>
      <!-- Antenna -->
      <line x1="${s*0.65}" y1="${s*0.42}" x2="${s*0.75}" y2="${s*0.18}" stroke="#94A3B8" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
      <!-- Broadcast waves -->
      ${[1,2,3].map(i => `<circle cx="${s*0.75}" cy="${s*0.18}" r="${i*s*0.07}"
        fill="none" stroke="#DC2626" stroke-width="2" opacity="${0.5 - i*0.12}"/>`).join('')}
    `,
    defs: `
      <radialGradient id="bg" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stop-color="#1f0808"/>
        <stop offset="100%" stop-color="#0F172A"/>
      </radialGradient>
      <linearGradient id="gr" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#8B7355"/>
        <stop offset="100%" stop-color="#44372A"/>
      </linearGradient>
    `,
  },
];

(async () => {
  for (const cat of categories) {
    const out = path.join(OUT, cat.file);
    const bodyContent = typeof cat.svg === 'function' ? cat.svg(SIZE) : cat.svg;
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>${cat.defs || ''}</defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
  ${bodyContent}
</svg>`;

    await sharp(Buffer.from(svg))
      .webp({ quality: 85 })
      .toFile(out);

    const { size } = fs.statSync(out);
    console.log(`✅ ${cat.file} — ${(size / 1024).toFixed(1)} KB`);
  }
  console.log('\nDone. Replace with AI-generated photos when available.');
})();
