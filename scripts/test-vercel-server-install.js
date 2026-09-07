#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.ok(
  /npm\s+--prefix\s+server\s+ci/.test(pkg.scripts?.postinstall || ''),
  'Vercel root install must install locked server dependencies',
);
assert.ok(fs.existsSync(path.join(root, 'server', 'package-lock.json')));
console.log('Vercel server dependency install contract passed.');
