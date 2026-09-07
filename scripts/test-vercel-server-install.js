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

const { execFileSync } = require('child_process');
const indexSource = fs.readFileSync(path.join(root, 'server', 'src', 'index.ts'), 'utf8');
const routeImports = [...indexSource.matchAll(/from ['"](\.\/routes\/[^'"]+)['"]/g)]
  .map(match => `server/src/${match[1].replace(/^\.\//, '')}.ts`);
const tracked = new Set(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/));
for (const route of routeImports) {
  assert.ok(tracked.has(route), `Server route imported by index.ts must be tracked by Git: ${route}`);
}
console.log('Vercel server dependency and tracked-import contract passed.');
