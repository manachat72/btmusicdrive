#!/usr/bin/env node
'use strict';
// Local-only, read-only catalog server. Never serves the repository wholesale.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const ai = require('./lib/content-studio-ai');
const ROOT = path.resolve(__dirname, '..');
const FILES = {
  '/': ['content-studio/index.html', 'text/html; charset=utf-8'],
  '/style.css': ['content-studio/style.css', 'text/css; charset=utf-8'],
  '/core.js': ['content-studio/core.js', 'text/javascript; charset=utf-8'],
  '/app.js': ['content-studio/app.js', 'text/javascript; charset=utf-8'],
};
function createServer() {
  let generating = false;
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https:; media-src 'self' blob:; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const fail = (code, error) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error })); };
    if (!/^127\.0\.0\.1(?::\d+)?$/.test(req.headers.host || '')) return fail(403, 'Local access only');
    if (req.method === 'POST' && ['/api/ai/generate','/api/ai/connect'].includes(req.url)) {
      if (req.headers.origin !== `http://${req.headers.host}` || !/^application\/json\b/i.test(req.headers['content-type'] || '')) return fail(403, 'Same-origin JSON requests only');
      if (generating) return fail(409, 'AI กำลังทำงานอยู่ กรุณารอให้เสร็จก่อน');
      generating = true;
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      try {
        const chunks=[];let size=0;
        for await (const chunk of req) { size+=chunk.length;if(size>200000){fail(413,'Request too large');return;}chunks.push(chunk); }
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if(req.url==='/api/ai/connect') {const result=ai.configurePaid(body);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(result));return;}
          ai.prepare(body);
        }catch(err){return fail(400,err.message);}
        const result=await ai.generate(body,{signal:controller.signal});
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(result));
      } catch(err) { if(!res.destroyed)fail(502,err.name==='TimeoutError'?'AI ใช้เวลานานเกิน 5 นาที กรุณาลองใหม่':err.message); }
      finally {generating=false;}
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(405, 'Method not allowed');
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/api/ai/status') {
        const result=await ai.status();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
        return res.end(req.method==='HEAD'?undefined:JSON.stringify({...result,openai:ai.paidStatus()}));
      }
      if (url.pathname === '/api/catalog') {
        const all = JSON.parse(await fs.readFile(path.join(ROOT, 'products.json'), 'utf8'));
        const products = all.filter(p => p.isActive !== false).map(p => ({
          id: p.id, name: p.name, slug: p.slug, price: p.price, imageUrl: p.imageUrl,
          images: p.images || [], tags: p.tags || [], tracklist: p.tracklist || [],
          category: typeof p.category === 'object' ? p.category?.name || '' : p.category || '',
        }));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ products, source: 'products.json', loadedAt: new Date().toISOString() }));
      }
      const file = FILES[url.pathname];
      if (!file) return fail(404, 'Not found');
      const body = await fs.readFile(path.join(ROOT, file[0]));
      res.writeHead(200, { 'Content-Type': file[1] });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { fail(500, 'Unable to load studio data'); }
  });
}
if (require.main === module) {
  const port = Number(process.env.CONTENT_STUDIO_PORT || 4781);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('CONTENT_STUDIO_PORT must be 1024–65535');
  const server = createServer();
  server.on('error', err => { console.error(`Content Studio: ${err.code === 'EADDRINUSE' ? 'Port in use. Set CONTENT_STUDIO_PORT to another port.' : err.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Content Studio ready: http://127.0.0.1:${port}`));
}
module.exports = { createServer };
