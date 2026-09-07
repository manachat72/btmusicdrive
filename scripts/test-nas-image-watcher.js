'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createNasImageWatcher } = require('./lib/nas-image-watcher');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nas-image-watcher-'));
  const folder = '01-demo';
  const dir = path.join(root, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'หลัก_01.jpg'), 'v1');

  const published = [];
  const watcher = createNasImageWatcher({
    nasDir: root,
    getMappings: () => [{ code: '01', slug: 'demo', dirName: folder }],
    settleMs: 100,
    autoStart: false,
    onChange: async (entry) => published.push(entry),
  });

  await watcher.tick(0);
  assert.strictEqual(published.length, 0, 'Initial scan must establish a baseline without publishing');

  fs.writeFileSync(path.join(dir, 'รายชื่อเพลง.txt'), 'not an image');
  await watcher.tick(200);
  assert.strictEqual(published.length, 0, 'Non-image changes must be ignored');

  fs.writeFileSync(path.join(dir, 'หลัก_01.jpg'), 'v2-changed');
  await watcher.tick(300);
  await watcher.tick(350);
  assert.strictEqual(published.length, 0, 'A changing folder must wait until file copies settle');
  await watcher.tick(401);
  assert.strictEqual(published.length, 1, 'A stable image change should publish automatically once');
  assert.strictEqual(published[0].code, '01');

  await watcher.tick(600);
  assert.strictEqual(published.length, 1, 'An unchanged folder must not publish repeatedly');

  watcher.close();
  fs.rmSync(root, { recursive: true, force: true });
  console.log('NAS image watcher tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
