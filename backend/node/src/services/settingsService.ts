import { SystemSetting } from '../models/index.js';
import { BadRequestError } from '../utils/errors.js';
import { toPaise } from '../utils/money.js';
import { RequestMeta } from '../utils/http.js';
import { ActivityLogService } from './activityLogService.js';
import { UpdateSettingsInput } from '../validators/financeValidators.js';

export interface AppSettings {
  walletMinTopup: number;
  walletMaxTopup: number;
  upiId: string;
  upiPayeeName: string;
  depositInstructions: string;
  requireKycForInvestment: boolean;
}

const DEFAULTS: AppSettings = {
  walletMinTopup: 500,
  walletMaxTopup: 200000,
  upiId: 'moontech@upi',
  upiPayeeName: 'Moon Tech Solutions',
  depositInstructions:
    'Pay the exact amount to the UPI ID shown, then submit the UPI transaction ID (UTR) along with the payment receipt.',
  requireKycForInvestment: false,
};

const KEY_MAP: Record<keyof AppSettings, string> = {
  walletMinTopup: 'wallet_min_topup',
  walletMaxTopup: 'wallet_max_topup',
  upiId: 'upi_id',
  upiPayeeName: 'upi_payee_name',
  depositInstructions: 'deposit_instructions',
  requireKycForInvestment: 'require_kyc_for_investment',
};

export class SettingsService {
  /**
   * Returns all settings, falling back to defaults for keys not yet stored
   */
  public static async getSettings(): Promise<AppSettings> {
    const rows = await SystemSetting.findAll();
    const stored = new Map(rows.map((r) => [r.setting_key, r.setting_value]));

    const numberOr = (key: string, fallback: number) => {
      const raw = stored.get(key);
      const num = raw === undefined ? NaN : Number(raw);
      return Number.isFinite(num) && num > 0 ? num : fallback;
    };

    const textOr = (key: string, fallback: string) => {
      const raw = stored.get(key);
      return raw !== undefined && raw.trim() !== '' ? raw : fallback;
    };

    const kycRaw = stored.get(KEY_MAP.requireKycForInvestment);

    return {
      walletMinTopup: numberOr(KEY_MAP.walletMinTopup, DEFAULTS.walletMinTopup),
      walletMaxTopup: numberOr(KEY_MAP.walletMaxTopup, DEFAULTS.walletMaxTopup),
      upiId: textOr(KEY_MAP.upiId, DEFAULTS.upiId),
      upiPayeeName: textOr(KEY_MAP.upiPayeeName, DEFAULTS.upiPayeeName),
      depositInstructions: textOr(KEY_MAP.depositInstructions, DEFAULTS.depositInstructions),
      requireKycForInvestment:
        kycRaw === undefined ? DEFAULTS.requireKycForInvestment : kycRaw === 'true',
    };
  }

  /**
   * Admin: update one or more settings
   */
  public static async updateSettings(
    input: UpdateSettingsInput,
    adminId: number,
    meta: RequestMeta = {}
  ): Promise<AppSettings> {
    const current = await this.getSettings();
    const next: AppSettings = { ...current };

    if (input.walletMinTopup !== undefined) next.walletMinTopup = input.walletMinTopup;
    if (input.walletMaxTopup !== undefined) next.walletMaxTopup = input.walletMaxTopup;
    if (input.upiId !== undefined) next.upiId = input.upiId.trim();
    if (input.upiPayeeName !== undefined) next.upiPayeeName = input.upiPayeeName.trim();
    if (input.depositInstructions !== undefined) next.depositInstructions = input.depositInstructions.trim();
    if (input.requireKycForInvestment !== undefined) {
      next.requireKycForInvestment = input.requireKycForInvestment;
    }

    if (toPaise(next.walletMaxTopup) < toPaise(next.walletMinTopup)) {
      throw new BadRequestError('Maximum wallet top-up must be greater than or equal to the minimum');
    }

    const changed: string[] = [];
    for (const field of Object.keys(KEY_MAP) as (keyof AppSettings)[]) {
      if (String(next[field]) === String(current[field])) continue;
      await SystemSetting.upsert({
        setting_key: KEY_MAP[field],
        setting_value: String(next[field]),
        updated_by: adminId,
      });
      changed.push(`${KEY_MAP[field]}: "${current[field]}" -> "${next[field]}"`);
    }

    if (changed.length > 0) {
      await ActivityLogService.log({
        userId: adminId,
        action: 'SYSTEM_SETTINGS_UPDATED',
        entity: 'SYSTEM_SETTING',
        description: `Admin #${adminId} updated settings (${changed.join('; ')})`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    return next;
  }
}
