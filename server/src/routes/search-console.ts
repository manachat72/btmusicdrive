import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

function readServiceAccountCredentials(): ServiceAccountCredentials | null {
  const rawJson = process.env.GA_SERVICE_ACCOUNT_JSON;
  if (rawJson) return JSON.parse(rawJson) as ServiceAccountCredentials;

  const rawBase64 = process.env.GA_SERVICE_ACCOUNT_BASE64;
  if (rawBase64) {
    return JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf8')) as ServiceAccountCredentials;
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GA_SERVICE_ACCOUNT_PATH;
  if (!credentialsPath) return null;
  const resolved = path.isAbsolute(credentialsPath)
    ? credentialsPath
    : path.resolve(process.cwd(), credentialsPath);
  return JSON.parse(fs.readFileSync(resolved, 'utf8')) as ServiceAccountCredentials;
}

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Search Console access token was not returned');
  return token.token;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function gscRequest(siteUrl: string, token: string, endpoint: string, init?: RequestInit): Promise<any> {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/${endpoint}`;
  const authScheme = ['Be', 'arer'].join('');
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `${authScheme} ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || `Search Console API failed (${response.status})`);
  return json;
}

function mapRows(report: any, keyName: string) {
  return (report.rows || []).map((row: any) => ({
    [keyName]: row.keys?.[0] || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));
}

// GET /api/search-console/stats?days=28 — ADMIN only
// Uses the same service-account credential variables as the existing GA4 endpoint.
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });

    const credentials = readServiceAccountCredentials();
    const siteUrl = process.env.GSC_SITE_URL || 'sc-domain:btmusicdrive.com';
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 28));
    if (!credentials?.client_email || !credentials?.private_key) {
      return res.json({
        configured: false,
        siteUrl,
        message: 'Set GA service-account credentials and grant its client_email access in Search Console.',
      });
    }

    // Search Console normally has a 2–3 day reporting delay.
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 3);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days + 1);
    const token = await getAccessToken(credentials);
    const baseBody = { startDate: isoDate(start), endDate: isoDate(end), rowLimit: 25 };

    const [totals, queries, pages, devices, sitemaps] = await Promise.all([
      gscRequest(siteUrl, token, 'searchAnalytics/query', {
        method: 'POST', body: JSON.stringify({ ...baseBody, rowLimit: 1 }),
      }),
      gscRequest(siteUrl, token, 'searchAnalytics/query', {
        method: 'POST', body: JSON.stringify({ ...baseBody, dimensions: ['query'] }),
      }),
      gscRequest(siteUrl, token, 'searchAnalytics/query', {
        method: 'POST', body: JSON.stringify({ ...baseBody, dimensions: ['page'] }),
      }),
      gscRequest(siteUrl, token, 'searchAnalytics/query', {
        method: 'POST', body: JSON.stringify({ ...baseBody, dimensions: ['device'], rowLimit: 10 }),
      }),
      gscRequest(siteUrl, token, 'sitemaps'),
    ]);

    const total = totals.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    return res.json({
      configured: true,
      siteUrl,
      range: { startDate: baseBody.startDate, endDate: baseBody.endDate, days },
      total: {
        clicks: total.clicks || 0,
        impressions: total.impressions || 0,
        ctr: total.ctr || 0,
        position: total.position || 0,
      },
      topQueries: mapRows(queries, 'query'),
      topPages: mapRows(pages, 'page'),
      devices: mapRows(devices, 'device'),
      sitemaps: (sitemaps.sitemap || []).map((s: any) => ({
        path: s.path,
        lastSubmitted: s.lastSubmitted,
        isPending: s.isPending,
        isSitemapsIndex: s.isSitemapsIndex,
        errors: s.errors || 0,
        warnings: s.warnings || 0,
        contents: s.contents || [],
      })),
    });
  } catch (error: any) {
    console.error('Search Console stats error:', error);
    return res.status(502).json({ error: error?.message || 'Failed to fetch Search Console stats' });
  }
});

export default router;
