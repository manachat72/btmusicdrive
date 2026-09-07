'use strict';

const fs = require('fs');
const path = require('path');

const IMAGE_EXT = /\.(jpe?g|png|webp|avif|tiff?|bmp)$/i;

function folderSignature(nasDir, dirName) {
  const dir = path.join(nasDir, dirName);
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && IMAGE_EXT.test(entry.name))
      .map((entry) => {
        const stat = fs.statSync(path.join(dir, entry.name));
        return `${entry.name}:${stat.size}:${Math.floor(stat.mtimeMs)}`;
      })
      .sort()
      .join('|');
  } catch {
    return null;
  }
}

/**
 * Polling watcher สำหรับ mapped/network drive ซึ่ง fs.watch ส่ง event ไม่สม่ำเสมอบน Windows
 * scan ครั้งแรกเป็น baseline และทุกงานถูกต่อ queue เพื่อไม่ให้ build/R2/DB ซ้อนกัน
 */
function createNasImageWatcher({
  nasDir,
  getMappings,
  onChange,
  onError = () => { },
  pollMs = 3000,
  settleMs = 5000,
  autoStart = true,
}) {
  const states = new Map();
  let timer = null;
  let queue = Promise.resolve();
  let closed = false;

  async function tick(timestamp = Date.now()) {
    if (closed) return;
    const mappings = getMappings() || [];
    const active = new Set();

    for (const entry of mappings) {
      if (!entry || !entry.code || !entry.slug || !entry.dirName) continue;
      const key = String(entry.code);
      if (active.has(key)) continue;
      active.add(key);

      const signature = folderSignature(nasDir, entry.dirName);
      if (signature === null) continue;
      const state = states.get(key);
      if (!state) {
        states.set(key, { signature, pendingSince: null, entry });
        continue;
      }

      state.entry = entry;
      if (signature !== state.signature) {
        state.signature = signature;
        state.pendingSince = timestamp;
        continue;
      }
      if (state.pendingSince === null || timestamp - state.pendingSince < settleMs) continue;

      state.pendingSince = null;
      const queuedEntry = { ...state.entry };
      queue = queue.then(() => onChange(queuedEntry)).catch((error) => {
        state.pendingSince = Date.now();
        onError(error, queuedEntry);
      });
    }

    for (const key of states.keys()) {
      if (!active.has(key)) states.delete(key);
    }
    await queue;
  }

  function close() {
    closed = true;
    if (timer) clearInterval(timer);
  }

  if (autoStart) {
    void tick();
    timer = setInterval(() => void tick(), pollMs);
  }

  return { tick, close };
}

module.exports = { createNasImageWatcher, folderSignature, IMAGE_EXT };
