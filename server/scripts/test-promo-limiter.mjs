// Throwaway-turned-kept check of the real promoValidateLimiter (server/dist)
// without a DB: fake auth sets req.user, fake handler returns 404 for a wrong
// code and 200 for GOOD. Written by dev_frontend, moved here by dev_builder.
// Run (after `npm run build`): node scripts/test-promo-limiter.mjs
import { createRequire } from 'module';
import assert from 'node:assert';
const require = createRequire(import.meta.url);
const express = require('express');
const { promoValidateLimiter } = require('../dist/middleware/rateLimiter.js');

const app = express();
app.use(express.json());
app.post(
  '/validate',
  (r, _res, next) => { r.user = { id: r.headers['x-user'] }; next(); },
  promoValidateLimiter,
  (r, res) => (r.body.code === 'GOOD' ? res.json({ code: 'GOOD' }) : res.status(404).json({ error: 'ไม่พบโค้ด' }))
);

const srv = app.listen(0, async () => {
  const url = `http://127.0.0.1:${srv.address().port}/validate`;
  const hit = async (user, code) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user': user }, body: JSON.stringify({ code }) });
    return { status: r.status, body: await r.json() };
  };
  try {
    const good = [];
    for (let i = 0; i < 10; i++) good.push((await hit('u1', 'GOOD')).status);
    assert.deepStrictEqual(good, Array(10).fill(200), 'correct codes must not burn the quota');
    const bad = [];
    for (let i = 0; i < 6; i++) bad.push(await hit('u1', 'WRONG' + i));
    assert.deepStrictEqual(bad.map((b) => b.status), [404, 404, 404, 404, 404, 429]);
    console.log('429 body:', JSON.stringify(bad[5].body));
    assert.ok(/[\u0E00-\u0E7F]/.test(bad[5].body.error), '429 message must be Thai JSON {error}');
    assert.strictEqual((await hit('u2', 'WRONG')).status, 404, 'another user keeps their own quota');
    console.log('ALL LIMITER ASSERTIONS PASSED');
  } catch (e) {
    console.error('FAIL', e.message);
    process.exitCode = 1;
  }
  srv.close();
});
