'use strict';

const assert = require('assert');
const { PAGE } = require('./lib/studio-page');
const client = require('fs').readFileSync(require('path').join(__dirname, 'lib', 'studio-client.js'), 'utf8');

assert.match(PAGE, /<aside class="sidebar"/i, 'Product Studio should use an admin sidebar');
assert.match(PAGE, /aria-label="เมนูหลัก"/i, 'Sidebar navigation needs an accessible label');
assert.match(PAGE, /<header class="topbar"/i, 'Product Studio should have a standard admin top bar');
assert.match(PAGE, /<main id="view" class="content"/i, 'Main workspace should be a dedicated admin content area');
assert.match(PAGE, /id="tabNew"/);
assert.match(PAGE, /id="tabEdit"/);
assert.match(PAGE, /id="tabQr"/);
assert.match(PAGE, /@media \(max-width:820px\)/, 'Admin layout should collapse for smaller screens');

console.log('Product Studio admin shell contract passed.');
