#!/usr/bin/env node
'use strict';
/**
 * ส่งรูปในเครื่องเข้าแท็บ Google Flow ผ่าน URL hash
 * (Flow บล็อก fetch ไป localhost/CDN และ browser tool หา input file ในหน้า Flow ไม่เจอ)
 * hash ไม่ถูกส่งออกนอกเบราว์เซอร์ รูปจึงไม่ไปไหนนอกจากแท็บนี้
 *
 *   node scripts/video/flow-relay.js <image> <flow-project-url>
 *   → เปิด http://127.0.0.1:4788/ ในแท็บ Flow → redirect ไป <flow-project-url>#btimg=<mime>;<base64>
 *
 * ปิดตัวเองใน 10 นาที
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const [img, target] = process.argv.slice(2);
if (!img || !target) {
  console.error('usage: node scripts/video/flow-relay.js <image> <flow-project-url>');
  process.exit(1);
}
const ext = path.extname(img).slice(1).toLowerCase();
const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] || 'image/webp';
const b64 = fs.readFileSync(img).toString('base64');
const dest = `${target.split('#')[0]}#btimg=${mime};${b64}`;

http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<script>location.replace(${JSON.stringify(dest)})</script>`);
  })
  .listen(4788, '127.0.0.1', () => console.log('relay on http://127.0.0.1:4788/'));
setTimeout(() => process.exit(0), 10 * 60 * 1000);
