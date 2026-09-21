const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'reports/pagespeed';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const rows = files.map((file) => {
  const report = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const audit = report.audits;
  const metric = (id) => audit[id]?.numericValue;
  const score = (id) => Math.round((report.categories[id]?.score || 0) * 100);
  return {
    page: file.replace(/-(mobile|desktop)\.json$/, ''),
    mode: file.match(/-(mobile|desktop)\.json$/)?.[1] || '',
    performance: score('performance'),
    seo: score('seo'),
    accessibility: score('accessibility'),
    bestPractices: score('best-practices'),
    fcp: metric('first-contentful-paint'),
    lcp: metric('largest-contentful-paint'),
    cls: metric('cumulative-layout-shift'),
    tbt: metric('total-blocking-time'),
    si: metric('speed-index'),
  };
});

const ms = (value) => Number.isFinite(value) ? `${Math.round(value)} ms` : 'n/a';
const cls = (value) => Number.isFinite(value) ? value.toFixed(3) : 'n/a';
console.log('# Lighthouse baseline');
console.log('');
console.log('> Lab data only. Core Web Vitals field data must be checked in Search Console or CrUX.');
console.log('');
console.log('| Page | Mode | Perf | SEO | A11y | Best | FCP | LCP | CLS | TBT | Speed Index |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
  console.log(`| ${r.page} | ${r.mode} | ${r.performance} | ${r.seo} | ${r.accessibility} | ${r.bestPractices} | ${ms(r.fcp)} | ${ms(r.lcp)} | ${cls(r.cls)} | ${ms(r.tbt)} | ${ms(r.si)} |`);
}
