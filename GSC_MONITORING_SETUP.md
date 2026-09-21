# Google Search Console + SEO Monitoring

Domain: `btmusicdrive.com`

## Current Search Console coverage baseline

Recorded from the owner-provided Search Console report:

| Reason | Pages | Initial assessment |
|---|---:|---|
| Page with redirect | 30 | Usually intentional; review examples for obsolete/internal URLs |
| Alternate page with proper canonical | 21 | Usually intentional duplicate/canonical handling |
| Excluded by `noindex` | 8 | Matches private/account pages; verify example URLs |
| Blocked by robots.txt | 6 | Review examples; `/api/` and `/server/` are intentionally blocked |
| Not found (404) | 5 | Remove internal links/sitemap references if any |
| Crawled — currently not indexed | 5 | Priority: improve/merge thin pages and request validation |
| Duplicate, Google chose different canonical | 4 | Priority: compare Google-selected vs declared canonical |
| Discovered — currently not indexed | at least 5 | Priority: improve internal links and crawl signals |

Public live verification checked all 83 sitemap URLs with a Googlebot user agent: all returned HTTP 200, none contained `noindex`, none redirected, and none returned an `X-Robots-Tag: noindex` header.

## Search Console API integration

The server exposes an admin-only endpoint:

```text
GET /api/search-console/stats?days=28
```

It returns aggregate clicks/impressions/CTR/position, top queries, top pages, device breakdown, and submitted sitemap status. It reuses the existing GA service-account credential variables and requests only the `webmasters.readonly` scope.

### One-time setup

1. Enable **Google Search Console API** in the same Google Cloud project as the GA service account.
2. In Search Console, open **Settings → Users and permissions → Add user**.
3. Add the service account's `client_email`. Restricted access is sufficient for read-only reporting.
4. Set the Vercel environment variable:

```text
GSC_SITE_URL=sc-domain:btmusicdrive.com
```

5. Ensure one existing service-account credential option is configured in Vercel:

```text
GA_SERVICE_ACCOUNT_JSON
GA_SERVICE_ACCOUNT_BASE64
GOOGLE_APPLICATION_CREDENTIALS
GA_SERVICE_ACCOUNT_PATH
```

Never commit the private key or credential JSON to Git.

The site is already present/verified in Search Console because an indexing report is available. These steps grant the backend read-only API access; they do not re-verify ownership.

## Automated public indexability monitor

Hermes cron job:

- Name: `BT Music Drive SEO indexability monitor`
- Schedule: every day at 08:00 (UTC+07:00)
- Job ID: `6d267c85d78a`
- Script: `btmusicdrive_seo_watch.py`
- Behavior: silent when healthy; alerts only on failures

Checks:

- `robots.txt` and sitemap availability
- canonical sitemap declaration
- minimum sitemap URL count and duplicates
- every sitemap URL: HTTP 200, no redirect, no meta/header `noindex`
- private routes remain `noindex`

The Hermes Gateway for profile `bt` is installed via the Windows Startup-folder fallback and verified running.

## Manual actions in Search Console

Open each reason and export/copy the example URLs. Prioritize:

1. Crawled — currently not indexed
2. Discovered — currently not indexed
3. Duplicate, Google chose different canonical
4. 404 URLs that still have internal links

Do not click **Validate fix** for intentional `noindex`, redirect, canonical-alternate, `/api/`, or `/server/` URLs. Validation is appropriate only after fixing an unintended condition.

## Browser access note

Automated inspection of the signed-in Edge profile is currently blocked by Hermes' existing-profile safety setting. To explicitly allow it, set:

```text
computer_use.grant_existing_profile: true
```

Then restart Hermes. This grants access to existing browser cookies/storage, so enable it only if that is acceptable. It is not needed for the public watchdog or server API integration.
