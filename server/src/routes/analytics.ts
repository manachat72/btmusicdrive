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
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Google Analytics access token was not returned');
  return token.token;
}

async function runGaReport(
  propertyId: string,
  token: string,
  body: Record<string, unknown>,
): Promise<any> {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message || 'Google Analytics report request failed';
    throw new Error(message);
  }
  return json;
}

function monthLabel(yearMonth: string): string {
  const year = Number(yearMonth.slice(0, 4));
  const monthIndex = Number(yearMonth.slice(4, 6)) - 1;
  return new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'short' });
}

function reportMetric(row: any, index: number): number {
  return Number(row?.metricValues?.[index]?.value || 0);
}

// ── GET /api/analytics/stats ────────────────────────────────────────────────
// Google Analytics 4 stats — ADMIN only. Requires GA service account credentials.
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });

    const propertyId = process.env.GA4_PROPERTY_ID || '533617757';
    const credentials = readServiceAccountCredentials();

    if (!credentials?.client_email || !credentials?.private_key) {
      return res.json({
        configured: false,
        propertyId,
        source: 'not-configured',
        message: 'Set GA service account credentials to enable Google Analytics charts.',
      });
    }

    const token = await getAccessToken(credentials);
    const [monthlyReport, topPagesReport] = await Promise.all([
      runGaReport(propertyId, token, {
        dateRanges: [{ startDate: '365daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'yearMonth' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
        ],
        orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
      }),
      runGaReport(propertyId, token, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 6,
      }),
    ]);

    const monthly = (monthlyReport.rows || []).map((row: any) => {
      const key = row.dimensionValues?.[0]?.value || '';
      return {
        key,
        label: monthLabel(key),
        activeUsers: reportMetric(row, 0),
        newUsers: reportMetric(row, 1),
        sessions: reportMetric(row, 2),
        pageViews: reportMetric(row, 3),
      };
    });

    const totals = monthly.reduce(
      (sum: any, row: any) => ({
        activeUsers: sum.activeUsers + row.activeUsers,
        newUsers: sum.newUsers + row.newUsers,
        sessions: sum.sessions + row.sessions,
        pageViews: sum.pageViews + row.pageViews,
      }),
      { activeUsers: 0, newUsers: 0, sessions: 0, pageViews: 0 },
    );

    const topPages = (topPagesReport.rows || []).map((row: any) => ({
      path: row.dimensionValues?.[0]?.value || '/',
      pageViews: reportMetric(row, 0),
      activeUsers: reportMetric(row, 1),
    }));

    return res.json({
      configured: true,
      propertyId,
      source: 'google-analytics',
      monthly,
      totals,
      topPages,
    });
  } catch (error: any) {
    console.error('Google Analytics stats error:', error);
    return res.status(502).json({ error: error?.message || 'Failed to fetch Google Analytics stats' });
  }
});

export default router;
