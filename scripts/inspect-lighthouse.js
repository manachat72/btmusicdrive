const fs = require('fs');
const path = require('path');
const dir = process.argv[2] || 'reports/pagespeed';
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const a = d.audits;
  console.log(`\n=== ${file} ===`);
  for (const id of ['largest-contentful-paint-element','lcp-discovery-insight','lcp-breakdown-insight','cls-culprits-insight','layout-shifts','render-blocking-insight','image-delivery-insight','unused-javascript','total-byte-weight','third-parties-insight']) {
    const x=a[id]; if(!x) continue;
    const savings=x.details?.overallSavingsMs || x.details?.overallSavingsBytes || x.numericValue || 0;
    const items=x.details?.items || [];
    console.log(id, 'score=',x.score,'display=',x.displayValue||'','value=',Math.round(savings));
    for(const item of items.slice(0,3)) {
      const node=item.node?.snippet || item.node?.selector || item.url || item.source || '';
      const val=item.wastedMs || item.wastedBytes || item.totalBytes || item.score || item.value || '';
      if(node || val) console.log('  -',String(node).replace(/\s+/g,' ').slice(0,180),val);
    }
  }
}
