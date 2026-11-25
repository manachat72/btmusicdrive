import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Strict limiter for auth endpoints (login/register): 10 attempts per 15 min
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// Limiter for order lookup by phone: 5 per 15 min to prevent enumeration
export const orderSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many search attempts, please try again later.' },
});

// Limiter for promo code validation: 5 per 15 min, keyed by logged-in user id
// (not IP) — /validate always runs after authenticateToken, and req.ip is
// unreliable behind Vercel + Cloudflare tunnel's multiple proxy hops.
// Separate from orderSearchLimiter: different endpoint, don't share its budget.
export const promoValidateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ใส่โค้ดผิดหรือกดใช้โค้ดบ่อยเกินไป กรุณาลองใหม่ใน 15 นาที' },
  skipSuccessfulRequests: true, // a correct code shouldn't burn the quota for re-entering/removing it
  keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req.ip || 'unknown'),
});

// Limiter for admin password attempts: 5 per 15 min
export const adminPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin login attempts, please try again later.' },
  // Only count requests that use admin password header
  keyGenerator: (req) => ipKeyGenerator(req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown'),
  skip: (req) => {
    // Skip rate limiting if using JWT (only limit admin password attempts)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    return !!token;
  },
});
