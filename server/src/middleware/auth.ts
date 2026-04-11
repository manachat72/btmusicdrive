import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'btmusicdrive-admin-2025';

// Track failed admin password attempts per IP
const adminAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ADMIN_ATTEMPTS = 5;
const ADMIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Try JWT token first
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; role: string };
      req.user = decoded;
      return next();
    } catch (error) {
      // Token invalid, fall through to admin password check
    }
  }

  // Fallback: admin password header (for admin dashboard without login)
  const adminPw = req.headers['x-admin-password'] as string;
  if (adminPw) {
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const now = Date.now();

    // Check lockout
    const attempt = adminAttempts.get(ip);
    if (attempt && attempt.count >= MAX_ADMIN_ATTEMPTS && now < attempt.resetAt) {
      res.status(429).json({ error: 'Too many admin login attempts. Try again later.' });
      return;
    }

    // Constant-time comparison to prevent timing attacks
    const isValid = adminPw.length === ADMIN_PASSWORD.length &&
      crypto.timingSafeEqual(Buffer.from(adminPw), Buffer.from(ADMIN_PASSWORD));

    if (isValid) {
      // Reset attempts on success
      adminAttempts.delete(ip);
      req.user = { id: 'admin-dashboard', role: 'ADMIN' };
      return next();
    }

    // Track failed attempt
    const current = adminAttempts.get(ip) || { count: 0, resetAt: now + ADMIN_LOCKOUT_MS };
    current.count++;
    current.resetAt = now + ADMIN_LOCKOUT_MS;
    adminAttempts.set(ip, current);
  }

  res.status(401).json({ error: 'Access denied. No token provided.' });
  return;
};
