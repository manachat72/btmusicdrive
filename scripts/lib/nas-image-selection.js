'use strict';

const fs = require('fs');
const path = require('path');
const webImg = require('./web-images');

function resolveNasFolder(nasDir, folderName) {
  const name = String(folderName || '').trim();
  if (!name || path.basename(name) !== name || name === '.' || name === '..') {
    throw new Error('ชื่อโฟลเดอร์ไม่ถูกต้อง');
  }
  const root = path.resolve(nasDir);
  const dir = path.resolve(root, name);
  if (path.dirname(dir) !== root) throw new Error('ชื่อโฟลเดอร์ไม่ถูกต้อง');
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`ไม่พบโฟลเดอร์ใน NAS: ${name}`);
  }
  return dir;
}

function previewNasImages(nasDir, folderName, max = 9) {
  const dir = resolveNasFolder(nasDir, folderName);
  const all = webImg.listSourceImages(dir).map(file => path.basename(file));
  return {
    folder: String(folderName),
    total: all.length,
    files: all.slice(0, max),
    srcDir: dir,
  };
}

module.exports = { resolveNasFolder, previewNasImages };
