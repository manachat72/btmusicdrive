# SEO / Search Console / PageSpeed Progress — 2026-09-07

## Executive summary

- Live sitemap audit: **83/83 URLs indexable**, with no `noindex`, redirect, non-200, or canonical mismatch in the sitemap.
- Search Console coverage baseline recorded and triaged.
- Added authenticated, read-only Search Console reporting endpoint.
- Added daily public indexability monitoring; Hermes Gateway is installed and running.
- Lighthouse live baseline completed for five representative pages on mobile and desktop.
- Expanded all nine thin product descriptions using only existing product facts.
- Reduced one repeatedly loaded primary product image from **402 KiB PNG to 23 KiB WebP** and converted its three gallery PNGs.
- Removed duplicate GA4 loading and changed optional Meta/TikTok pixel loading to require explicit full consent.
- Reserved layout space on product/shop/category pages; local desktop CLS verification improved materially.

## Search Console coverage baseline

| Reason | Pages | Assessment / next action |
|---|---:|---|
| Page with redirect | 30 | Usually expected; ensure only destinations are in sitemap |
| Alternate page with proper canonical | 21 | Usually expected; inspect samples only |
| Excluded by `noindex` | 8 | Likely private/transaction pages; compare all eight samples |
| Blocked by robots.txt | 6 | Inspect samples; intentional static/internal resources are acceptable |
| Not found (404) | 5 | Remove stale internal links or redirect genuine legacy equivalents |
| Crawled – currently not indexed | 5 | High-priority content/internal-link review |
| Duplicate; Google chose different canonical | 4 | High-priority canonical and content-equivalence review |
| Discovered – currently not indexed | Not shown | Improve discovery/internal links and monitor crawl demand |

Full setup/runbook: `GSC_MONITORING_SETUP.md`.

### API integration added

Authenticated admin endpoint:

```text
GET /api/search-console/stats?days=28
```

It returns totals, top queries, top pages, device/country/search-appearance breakdowns, and submitted sitemap status. It reuses the existing GA service-account credentials and requests only `webmasters.readonly`.

Remaining external authorization step: add the service account `client_email` as a Search Console user and deploy `GSC_SITE_URL=sc-domain:btmusicdrive.com`. No credential is stored in the repository.

## Live Lighthouse baseline (lab data)

Full table: `reports/pagespeed/SUMMARY.md`.

- SEO: **100/100 on all ten runs**.
- Average mobile performance: **47/100**.
- Average mobile LCP: **12,432 ms**.
- Average desktop performance: **80/100**.
- Average desktop LCP: **1,661 ms**.
- Major live issues: oversized product imagery, duplicate/unused analytics JavaScript, and dynamic-content layout shifts.

These are Lighthouse lab measurements, not CrUX field measurements. The public PageSpeed API was quota-limited and the signed-in browser profile could not be attached because `computer_use.grant_existing_profile` is disabled. Field CWV must therefore be confirmed in Search Console after authorization or after that opt-in is enabled and Hermes is restarted.

## Implemented performance improvements

1. **Analytics / consent**
   - GA4 remains configured through GTM.
   - Removed the second direct `gtag.js` injection for the same measurement ID.
   - Meta/TikTok pixels now load only after stored consent equals `all`.

2. **Images**
   - Main `100-million-views` image: 402 KiB PNG → 23 KiB WebP.
   - Three gallery images: 605–649 KiB PNG → 63–74 KiB WebP.
   - Original PNG files retained; product references now use WebP.

3. **Layout stability**
   - Product loading state reserves 900–1,100 px.
   - Shop and category grids reserve 900 px while loading.
   - Local desktop verification:

| Page | Live CLS before | Local CLS after | Local performance |
|---|---:|---:|---:|
| Category | 0.332 | 0.104 | 96 |
| Product | 0.720 | 0.043 | 87 |
| Shop | 0.540 | 0.109 | 82 |

Local and live environments are not directly equivalent, but this verifies the intended layout-shift mechanism was removed. Re-run live Lighthouse after deployment.

## Content improvements

Expanded nine descriptions that were shorter than 160 visible characters:

- `usb-flash-drive-mp3-includes-80s-era-string-music`
- `usb-flash-drive-mp3-includes-labanun-songs`
- `usb-mp3-bodyslam`
- `usb-mp3-ruam-hit-sai-string`
- `usb-mp3-dance`
- `usb-mp3-phleng-yuk-90`
- `usb-mp3-sakol-sku-077`
- `usb-mp3-ruam-phleng-sakol`
- `usb-mp3-hit-yuk-90-khit-thueng`

Post-change catalog check: **54 products, zero descriptions under 160 visible characters, zero duplicate descriptions**. Descriptions use only existing capacity, track count, format, device compatibility, and real tracklist examples.

## Monitoring

Daily 08:00 Asia/Bangkok:

- Job: `BT Music Drive SEO indexability monitor`
- Job ID: `6d267c85d78a`
- Mode: script-only; silent when healthy
- Checks: robots.txt, sitemap validity, every sitemap URL, public-page `noindex`, private-page `noindex`
- Hermes Gateway: installed and running
- Next scheduled run: 2026-09-08 08:00 +07:00

The watchdog was executed once manually and returned exit code 0 with no alerts.

## Verification

```text
npx tsc --noEmit -p server/tsconfig.json  PASS
npm run build                            PASS
npm test                                 PASS
SEO checks: 21 public pages, 54 products, 10 categories, 83 sitemap URLs
Product Studio Hermes SEO contract       PASS
```

## Deployment follow-up

1. Deploy the current branch.
2. Add the service-account email to Search Console and set `GSC_SITE_URL` in the deployment environment.
3. Test `/api/search-console/stats?days=28` while authenticated as admin.
4. Re-run `npm run perf:baseline` against live URLs after deployment.
5. In Search Console, export/sample the 5 crawled-not-indexed URLs and 4 Google-selected-canonical URLs; remediate URL-by-URL rather than guessing.
