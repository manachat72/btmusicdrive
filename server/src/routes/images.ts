import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const IMAGES_DIR = path.join(__dirname, '../../../images');

// ── multer storage ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
    cb(null, IMAGES_DIR);
  },
  filename: (_req, file, cb) => {
    // Keep original name but make it safe
    const safe = file.originalname.replace(/[^a-zA-Z0-9ก-๙._\- ]/g, '_');
    // If file exists, prefix with timestamp to avoid collision
    const target = path.join(IMAGES_DIR, safe);
    if (fs.existsSync(target)) {
      cb(null, `${Date.now()}_${safe}`);
    } else {
      cb(null, safe);
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allow = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (allow.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp, svg)'));
    }
  },
});

// Admin password check middleware (reuse same header pattern)
function requireAdmin(req: Request, res: Response, next: () => void) {
  const pw = req.headers['x-admin-password'];
  if (pw !== 'btmusicdrive-admin-2025') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

// ── GET /api/images — list all image files ────────────────────────────────────
router.get('/', requireAdmin, (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(IMAGES_DIR)) {
      res.json({ files: [] });
      return;
    }

    const walk = (dir: string, base: string = ''): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const results: string[] = [];
      for (const entry of entries) {
        const rel = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          results.push(...walk(path.join(dir, entry.name), rel));
        } else if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(entry.name)) {
          results.push(rel);
        }
      }
      return results;
    };

    const files = walk(IMAGES_DIR);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// ── POST /api/images/upload — upload image file ───────────────────────────────
router.post('/upload', requireAdmin, upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const relativePath = req.file.filename;
  res.json({ filename: relativePath, url: `/images/${relativePath}` });
});

// ── DELETE /api/images — delete image file ────────────────────────────────────
router.delete('/', requireAdmin, (req: Request, res: Response) => {
  const { filename } = req.body as { filename?: string };
  if (!filename) {
    res.status(400).json({ error: 'filename required' });
    return;
  }
  // Security: prevent path traversal
  const resolved = path.resolve(IMAGES_DIR, filename);
  if (!resolved.startsWith(path.resolve(IMAGES_DIR))) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }
  try {
    if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;
