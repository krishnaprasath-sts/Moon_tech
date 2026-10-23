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
  /** File name of an admin-uploaded UPI QR image (in the upload dir); empty = generate the QR from the UPI ID */
  upiQrImage: string;
  depositInstructions: string;
  /** Bank account customers transfer to (NEFT / IMPS / RTGS). Bank transfer is offered only when all four are set. */
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  bankTransferInstructions: string;
  requireKycForInvestment: boolean;
  /** Customers must have VERIFIED KYC before requesting any payout */
  requireKycForWithdrawal: boolean;
  /** Smallest wallet-balance withdrawal a customer may request */
  walletMinWithdrawal: number;
  /** One-time referral commission (% of the referred customer's investment amount); 0 disables it */
  referralCommissionPercent: number;
  /** Deducted from every capital withdrawal (closing an investment or withdrawing the capital balance); 0 disables it */
  capitalWithdrawalFeePercent: number;
}

const DEFAULTS: AppSettings = {
  walletMinTopup: 500,
  walletMaxTopup: 200000,
  upiId: 'moontech@upi',
  upiPayeeName: 'Moon Tech Solutions',
  upiQrImage: '',
  depositInstructions:
    'Pay the exact amount to the UPI ID shown, then submit the UPI transaction ID (UTR) along with the payment receipt.',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankName: '',
  bankTransferInstructions:
    'Transfer the exact amount by NEFT, IMPS or RTGS to the account shown, then submit the transfer reference (UTR) number with a screenshot or receipt.',
  // Customers must have a VERIFIED KYC before they can invest (admins can relax this in Settings).
  requireKycForInvestment: true,
  requireKycForWithdrawal: true,
  walletMinWithdrawal: 500,
  // One-time commission on each amount invested by a referred customer, paid instantly to the referrer
  referralCommissionPercent: 5,
  capitalWithdrawalFeePercent: 5,
};

const KEY_MAP: Record<keyof AppSettings, string> = {
  walletMinTopup: 'wallet_min_topup',
  walletMaxTopup: 'wallet_max_topup',
  upiId: 'upi_id',
  upiPayeeName: 'upi_payee_name',
  upiQrImage: 'upi_qr_image',
  depositInstructions: 'deposit_instructions',
  bankAccountName: 'bank_account_name',
  bankAccountNumber: 'bank_account_number',
  bankIfsc: 'bank_ifsc',
  bankName: 'bank_name',
  bankTransferInstructions: 'bank_transfer_instructions',
  requireKycForInvestment: 'require_kyc_for_investment',
  requireKycForWithdrawal: 'require_kyc_for_withdrawal',
  walletMinWithdrawal: 'wallet_min_withdrawal',
  referralCommissionPercent: 'referral_commission_percent',
  capitalWithdrawalFeePercent: 'capital_withdrawal_fee_percent',
};

export class SettingsService {
  /** Bank transfers are offered to customers only when the full destination account is configured */
  public static bankTransferEnabled(settings: AppSettings): boolean {
    return Boolean(settings.bankAccountName && settings.bankAccountNumber && settings.bankIfsc && settings.bankName);
  }

  /** Public API path of the uploaded UPI QR image, or null when the QR is generated from the UPI ID */
  public static upiQrImagePath(settings: Pick<AppSettings, 'upiQrImage'>): string | null {
    return settings.upiQrImage ? `/public/upi-qr/${encodeURIComponent(settings.upiQrImage)}` : null;
  }

  /**
   * Admin: use an uploaded image as the UPI QR shown to customers ('' switches back to the generated QR).
   * Returns the previous file name so the caller can delete it.
   */
  public static async setUpiQrImage(fileName: string, adminId: number, meta: RequestMeta = {}): Promise<string> {
    const current = await this.getSettings();
    if (current.upiQrImage === fileName) return '';
    await SystemSetting.upsert({ setting_key: KEY_MAP.upiQrImage, setting_value: fileName, updated_by: adminId });
    await ActivityLogService.log({
      userId: adminId,
      action: 'SYSTEM_SETTINGS_UPDATED',
      entity: 'SYSTEM_SETTING',
      description: fileName
        ? `Admin #${adminId} uploaded a custom UPI QR image (${fileName})`
        : `Admin #${adminId} removed the custom UPI QR image; the QR is generated from the UPI ID again`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return current.upiQrImage;
  }

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

    // Empty string is a legitimate stored value (feature switched off)
    const textOrEmpty = (key: string) => (stored.get(key) ?? '').trim();

    const boolOr = (key: string, fallback: boolean) => {
      const raw = stored.get(key);
      return raw === undefined ? fallback : raw === 'true';
    };

    // Like numberOr but 0 is a legitimate value (feature switched off)
    const nonNegativeOr = (key: string, fallback: number) => {
      const raw = stored.get(key);
      const num = raw === undefined ? NaN : Number(raw);
      return Number.isFinite(num) && num >= 0 ? num : fallback;
    };

    return {
      walletMinTopup: numberOr(KEY_MAP.walletMinTopup, DEFAULTS.walletMinTopup),
      walletMaxTopup: numberOr(KEY_MAP.walletMaxTopup, DEFAULTS.walletMaxTopup),
      upiId: textOr(KEY_MAP.upiId, DEFAULTS.upiId),
      upiPayeeName: textOr(KEY_MAP.upiPayeeName, DEFAULTS.upiPayeeName),
      upiQrImage: textOrEmpty(KEY_MAP.upiQrImage),
      depositInstructions: textOr(KEY_MAP.depositInstructions, DEFAULTS.depositInstructions),
      bankAccountName: textOrEmpty(KEY_MAP.bankAccountName),
      bankAccountNumber: textOrEmpty(KEY_MAP.bankAccountNumber),
      bankIfsc: textOrEmpty(KEY_MAP.bankIfsc),
      bankName: textOrEmpty(KEY_MAP.bankName),
      bankTransferInstructions: textOr(KEY_MAP.bankTransferInstructions, DEFAULTS.bankTransferInstructions),
      requireKycForInvestment: boolOr(KEY_MAP.requireKycForInvestment, DEFAULTS.requireKycForInvestment),
      requireKycForWithdrawal: boolOr(KEY_MAP.requireKycForWithdrawal, DEFAULTS.requireKycForWithdrawal),
      walletMinWithdrawal: numberOr(KEY_MAP.walletMinWithdrawal, DEFAULTS.walletMinWithdrawal),
      referralCommissionPercent: nonNegativeOr(KEY_MAP.referralCommissionPercent, DEFAULTS.referralCommissionPercent),
      capitalWithdrawalFeePercent: nonNegativeOr(
        KEY_MAP.capitalWithdrawalFeePercent,
        DEFAULTS.capitalWithdrawalFeePercent
      ),
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
    if (input.bankAccountName !== undefined) next.bankAccountName = input.bankAccountName.trim();
    if (input.bankAccountNumber !== undefined) next.bankAccountNumber = input.bankAccountNumber.trim();
    if (input.bankIfsc !== undefined) next.bankIfsc = input.bankIfsc.trim().toUpperCase();
    if (input.bankName !== undefined) next.bankName = input.bankName.trim();
    if (input.bankTransferInstructions !== undefined) next.bankTransferInstructions = input.bankTransferInstructions.trim();

    const bankFieldsSet = [next.bankAccountName, next.bankAccountNumber, next.bankIfsc, next.bankName].filter(Boolean).length;
    if (bankFieldsSet > 0 && bankFieldsSet < 4) {
      throw new BadRequestError(
        'To offer bank transfers, fill in the account holder name, account number, IFSC and bank name (or clear all four)'
      );
    }
    if (input.requireKycForInvestment !== undefined) {
      next.requireKycForInvestment = input.requireKycForInvestment;
    }
    if (input.requireKycForWithdrawal !== undefined) {
      next.requireKycForWithdrawal = input.requireKycForWithdrawal;
    }
    if (input.walletMinWithdrawal !== undefined) next.walletMinWithdrawal = input.walletMinWithdrawal;
    if (input.referralCommissionPercent !== undefined) {
      next.referralCommissionPercent = input.referralCommissionPercent;
    }
    if (input.capitalWithdrawalFeePercent !== undefined) {
      next.capitalWithdrawalFeePercent = input.capitalWithdrawalFeePercent;
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
