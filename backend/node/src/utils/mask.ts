/**
 * Sensitive Data Masking Helpers
 * Never exposes full PAN, full Aadhaar, or full Bank Account numbers in API responses or logs.
 */

/**
 * Extracts last 4 characters and returns masked PAN (e.g., XXXXXX1234)
 */
export function maskPan(pan: string): string {
  if (!pan) return '';
  const clean = pan.trim().toUpperCase();
  if (clean.length < 4) return 'XXXX';
  const last4 = clean.slice(-4);
  return `XXXXXX${last4}`;
}

export function extractPanLast4(pan: string): string {
  if (!pan) return '';
  const clean = pan.trim().toUpperCase();
  return clean.slice(-4);
}

/**
 * Extracts last 4 digits and returns masked Aadhaar (e.g., XXXX-XXXX-1234)
 */
export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar) return '';
  const clean = aadhaar.replace(/\D/g, '');
  if (clean.length < 4) return 'XXXX-XXXX-XXXX';
  const last4 = clean.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

export function extractAadhaarLast4(aadhaar: string): string {
  if (!aadhaar) return '';
  const clean = aadhaar.replace(/\D/g, '');
  return clean.slice(-4);
}

/**
 * Extracts last 4 digits and returns masked Bank Account (e.g., XXXXXXXX5678)
 */
export function maskBankAccount(accountNumber: string): string {
  if (!accountNumber) return '';
  const clean = accountNumber.replace(/\s+/g, '');
  if (clean.length < 4) return 'XXXX';
  const last4 = clean.slice(-4);
  const prefixLength = Math.max(0, clean.length - 4);
  return `${'X'.repeat(prefixLength)}${last4}`;
}

export function extractBankAccountLast4(accountNumber: string): string {
  if (!accountNumber) return '';
  const clean = accountNumber.replace(/\s+/g, '');
  return clean.slice(-4);
}

/** r****l@example.com: first and last character of the local part, domain kept */
export function maskEmail(email: string): string {
  const clean = String(email || '').trim();
  const at = clean.indexOf('@');
  if (at <= 0) return clean ? '****' : '';
  const local = clean.slice(0, at);
  const domain = clean.slice(at);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(6, local.length - 2))}${local[local.length - 1]}${domain}`;
}

/** +91 XXXXXX3210: only the last four digits of a phone number */
export function maskPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return digits ? 'XXXX' : '';
  return `XXXXXX${digits.slice(-4)}`;
}
