import { Request } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { JwtUserPayload } from '../types/index.js';

/**
 * Rate limits.
 *
 * - General API: counted per signed-in user (so staff and customers on the same office or mobile
 *   network do not share one budget), and per IP for anonymous traffic.
 * - Sign-in: wrong passwords counted per IP + account, so one attacker cannot lock out everyone
 *   on a shared network and one account cannot be brute-forced from many attempts.
 * - Other auth forms (register, OTP, password reset): per IP.
 *
 * The client IP comes from X-Forwarded-For when TRUST_PROXY is set (Webuzo / Apache in front).
 */

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Client IP; IPv6 addresses are grouped by their /64 network (one home or phone gets a whole /64) */
export function clientIp(req: Request): string {
  const ip = (req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 4).join(':') + '::/64';
  }
  return ip;
}

/** User id from a valid access token, without failing the request when the token is bad */
function tokenUserId(req: Request): number | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.slice(7), config.jwt.secret) as JwtUserPayload;
    return Number.isInteger(decoded?.id) ? decoded.id : null;
  } catch {
    return null;
  }
}

const tooMany = (message: string) => ({ success: false, message });

/** Signed-in users get their own, larger budget (the panel and the site poll in the background) */
const AUTHENTICATED_MAX = Math.max(config.rateLimit.max * 2, 1000);

export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: (req: Request) => (tokenUserId(req) ? AUTHENTICATED_MAX : config.rateLimit.max),
  keyGenerator: (req: Request) => {
    const userId = tokenUserId(req);
    return userId ? `user:${userId}` : `ip:${clientIp(req)}`;
  },
  // Health checks from the host / uptime monitor must never be blocked
  skip: (req: Request) => req.path === '/health',
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany('Too many requests. Please wait a few minutes and try again.'),
});

/** Register, email verification, OTP and password reset forms: per IP */
export const authRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 40,
  keyGenerator: (req: Request) => `auth:${clientIp(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany('Too many attempts. Please try again in 15 minutes.'),
});

/**
 * Sign-in: 8 wrong passwords per account per IP in 15 minutes. Successful sign-ins are not
 * counted, so a customer who types the password right is never blocked.
 */
export const loginRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 8,
  keyGenerator: (req: Request) => {
    const account = String(req.body?.email ?? '').trim().toLowerCase().slice(0, 120);
    return `login:${clientIp(req)}:${account}`;
  },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany('Too many failed sign-in attempts. Please wait 15 minutes or reset your password.'),
});

/** Password reset emails: 5 per address per hour (stops someone flooding a customer's inbox) */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req: Request) => `reset:${String(req.body?.email ?? '').trim().toLowerCase().slice(0, 120) || clientIp(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany('Too many password reset requests for this email. Please try again in an hour.'),
});
