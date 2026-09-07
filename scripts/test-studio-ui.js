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

assert.match(client, /class="page-heading"/, 'New product view should have a clear page heading');
assert.match(client, /class="form-section"/, 'New product form should be split into scannable sections');
assert.match(client, />ข้อมูลสินค้า</, 'New product form needs a product information section');
assert.match(client, />รูปและรายชื่อเพลง</, 'New product form needs a media section');
assert.match(client, />การสร้าง SEO</, 'New product form needs an SEO section');
assert.match(client, /class="actions form-actions"/, 'Primary action should sit in a standard form footer');

console.log('Product Studio admin UI contract passed.');
