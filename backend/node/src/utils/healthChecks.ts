import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { sequelize, Media } from '../models/index.js';
import { config } from '../config/index.js';

export interface HealthCheck {
  ok: boolean;
  /** Short reason when the check fails (no file system paths) */
  error?: string;
}

export interface HealthReport {
  ok: boolean;
  checks: {
    database: HealthCheck;
    storage: HealthCheck;
    imageProcessing: HealthCheck;
  };
}

const describe = (err: unknown): string => {
  const e = err as { code?: string; name?: string; message?: string };
  const message = (e?.message || String(err)).split(config.uploadDir).join('<storage>');
  return [e?.code || e?.name, message].filter(Boolean).join(': ').slice(0, 200);
};

async function check(run: () => Promise<void>): Promise<HealthCheck> {
  try {
    await run();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describe(err) };
  }
}

/**
 * Live checks behind /api/health: can the API reach the database (and the media table used for
 * uploads), write to the upload directory, and process images? Each check is independent so the
 * response says exactly which part of a deployment is broken.
 */
export async function runHealthChecks(): Promise<HealthReport> {
  const [database, storage, imageProcessing] = await Promise.all([
    check(async () => {
      await sequelize.authenticate();
      await Media.count();
    }),
    check(async () => {
      await fs.mkdir(config.uploadDir, { recursive: true });
      const probe = path.join(config.uploadDir, `.healthcheck_${crypto.randomBytes(6).toString('hex')}`);
      await fs.writeFile(probe, 'ok');
      await fs.unlink(probe);
    }),
    check(async () => {
      await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).png().toBuffer();
    }),
  ]);
  return { ok: database.ok && storage.ok && imageProcessing.ok, checks: { database, storage, imageProcessing } };
}
