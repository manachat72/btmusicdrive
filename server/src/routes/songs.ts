import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

const router = Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ค้นหาถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' },
});

// GET /api/songs/search?q=...&limit=8
router.get('/search', searchLimiter, async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อเพลงหรือศิลปินที่ต้องการค้นหา' });
  }
  if (q.length > 150) {
    return res.status(400).json({ error: 'คำค้นหายาวเกิน 150 ตัวอักษร' });
  }

  const rawLimit = Number(req.query.limit ?? 8);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(15, Math.trunc(rawLimit))) : 8;

  const baseUrl = (process.env.DOWNLOADER_API_URL || '').trim().replace(/\/+$/, '');
  const token = (process.env.DOWNLOADER_API_TOKEN || '').trim();
  if (!baseUrl) {
    return res.status(503).json({ error: 'ระบบค้นหาเพลงเพิ่มเติมยังไม่เปิดเชื่อมต่อ' });
  }

  try {
    const url = `${baseUrl}/search?q=${encodeURIComponent(q)}&limit=${limit}`;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const upstream = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(12000),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = typeof (data as { detail?: string }).detail === 'string'
        ? (data as { detail: string }).detail
        : 'ไม่สามารถค้นหาเพลงจากเซิร์ฟเวอร์ได้';
      return res.status(upstream.status >= 500 ? 502 : upstream.status).json({ error: msg });
    }

    return res.json(data);
  } catch (err) {
    console.error('[Songs Search Proxy] Error:', err);
    return res.status(502).json({ error: 'เชื่อมต่อระบบค้นหาเพลงไม่สำเร็จ กรุณาลองใหม่หรือทักแชทแจ้งชื่อเพลง' });
  }
});

export default router;
