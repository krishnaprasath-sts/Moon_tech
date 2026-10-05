/**
 * Safe Logger with automated sanitization of sensitive data
 */

const SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'pan_number',
  'pan',
  'aadhaar',
  'aadhaar_number',
  'account_number',
  'bank_account_number',
  'secret',
  'token',
];

function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = sanitize(obj[key]);
      }
    }
    return clean;
  }
  return obj;
}

export const logger = {
  info: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.log(`[${timestamp}] [INFO]: ${message}`, JSON.stringify(sanitize(meta)));
    } else {
      console.log(`[${timestamp}] [INFO]: ${message}`);
    }
  },
  warn: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.warn(`[${timestamp}] [WARN]: ${message}`, JSON.stringify(sanitize(meta)));
    } else {
      console.warn(`[${timestamp}] [WARN]: ${message}`);
    }
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    if (error instanceof Error) {
      console.error(`[${timestamp}] [ERROR]: ${message} - ${error.message}\n${error.stack}`);
    } else if (error) {
      console.error(`[${timestamp}] [ERROR]: ${message}`, JSON.stringify(sanitize(error)));
    } else {
      console.error(`[${timestamp}] [ERROR]: ${message}`);
    }
  },
};
