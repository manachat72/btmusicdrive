import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'btmusicdrive-admin-2025';

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
  if (adminPw && adminPw === ADMIN_PASSWORD) {
    req.user = { id: 'admin-dashboard', role: 'ADMIN' };
    return next();
  }

  res.status(401).json({ error: 'Access denied. No token provided.' });
  return;
};
