import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const DEFAULT_JWT_SECRET = 'moon_tech_jwt_secret_key_super_secure_2026_phase1';
const DEFAULT_JWT_REFRESH_SECRET = 'moon_tech_jwt_refresh_secret_key_phase1_secure';
const DEFAULT_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  
  // Database
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'moon_tech_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    dialect: (process.env.DB_DIALECT || 'mysql') as 'mysql' | 'sqlite',
    pool: {
      max: 15,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || DEFAULT_JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // AES-256 Encryption
  encryptionKey: process.env.ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY,

  // URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:5173',
  // Extra comma-separated origins allowed by CORS (e.g. production domains)
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Set to 1 (or the hop count) when running behind nginx / a load balancer so req.ip and rate limits use the real client IP
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || 1 : 0,

  // Storage
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './storage/kyc_documents'),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    max: parseInt(process.env.RATE_LIMIT_MAX || '500', 10),
  },

  // SMTP / Nodemailer
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '2525', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@moontech.com',
  },

  // Mailbox that receives new support chat messages from customers (empty = no email)
  supportEmail: process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || '',
};

/**
 * Secrets that must never keep their development defaults in production.
 * Returns the list of offending variable names (empty when safe).
 */
export function getInsecureProductionSecrets(): string[] {
  const problems: string[] = [];
  if (config.jwt.secret === DEFAULT_JWT_SECRET || config.jwt.secret.length < 32) problems.push('JWT_SECRET');
  if (config.jwt.refreshSecret === DEFAULT_JWT_REFRESH_SECRET || config.jwt.refreshSecret.length < 32) {
    problems.push('JWT_REFRESH_SECRET');
  }
  if (config.encryptionKey === DEFAULT_ENCRYPTION_KEY || config.encryptionKey.length < 32) problems.push('ENCRYPTION_KEY');
  return problems;
}
