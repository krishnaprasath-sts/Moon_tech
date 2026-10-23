import crypto from 'crypto';
import { config } from '../config/index.js';

/**
 * Keyed, one-way fingerprint of an identity number (PAN, Aadhaar) so that duplicates across
 * accounts can be detected without storing or comparing the plain value. The encrypted copy
 * stays the only reversible form.
 */
export function identityHash(value: string | null | undefined): string | null {
  const clean = String(value ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  if (!clean) return null;
  return crypto.createHmac('sha256', config.encryptionKey).update(clean).digest('hex');
}
