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
