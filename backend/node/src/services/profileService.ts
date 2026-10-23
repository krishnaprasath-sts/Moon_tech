import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { User, CustomerProfile, UserPayoutDetail, PasswordReset } from '../models/index.js';
import { PayoutMethod, UserRole, UserStatus } from '../types/index.js';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors.js';
import { encryptData } from '../utils/encryption.js';
import { maskBankAccount } from '../utils/mask.js';
import { toIso } from '../utils/dates.js';
import { RequestMeta } from '../utils/http.js';
import { ActivityLogService } from './activityLogService.js';
import { EmailService } from './emailService.js';
import {
  UpdateProfileInput,
  UpdatePayoutDetailsInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../validators/financeValidators.js';

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function serializePayoutDetail(detail: UserPayoutDetail | null) {
  if (!detail) return null;
  return {
    preferredMethod: detail.preferred_method,
    upiId: detail.upi_id,
    accountHolderName: detail.account_holder_name,
    accountNumberMasked: detail.account_last4 ? maskBankAccount(`XXXXXXXX${detail.account_last4}`) : null,
    ifscCode: detail.ifsc_code,
    bankName: detail.bank_name,
    hasBankDetails: Boolean(detail.account_number_encrypted && detail.ifsc_code && detail.account_holder_name),
    hasUpiDetails: Boolean(detail.upi_id),
    updatedAt: toIso(detail.updated_at),
  };
}

export class ProfileService {
  public static async getProfile(userId: number) {
    const user = await User.findByPk(userId, {
      include: [
        { model: CustomerProfile, as: 'profile' },
        { model: UserPayoutDetail, as: 'payoutDetail' },
      ],
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const profile: CustomerProfile | null = (user as any).profile || null;
    const payoutDetail: UserPayoutDetail | null = (user as any).payoutDetail || null;

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      fullName: profile?.full_name || null,
      referralCode: profile?.referral_code || null,
      dateOfBirth: profile?.date_of_birth || null,
      address: profile?.address || null,
      city: profile?.city || null,
      state: profile?.state || null,
      pincode: profile?.pincode || null,
      payoutDetails: serializePayoutDetail(payoutDetail),
      createdAt: toIso(user.created_at),
    };
  }

  public static async updateProfile(userId: number, input: UpdateProfileInput, meta: RequestMeta = {}) {
    const profile = await CustomerProfile.findOne({ where: { user_id: userId } });
    if (!profile) {
      throw new NotFoundError('Customer profile not found');
    }

    const emptyToNull = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);

    if (input.fullName !== undefined) profile.full_name = input.fullName;
    if (input.dateOfBirth !== undefined) profile.date_of_birth = input.dateOfBirth || null;
    if (input.address !== undefined) profile.address = emptyToNull(input.address);
    if (input.city !== undefined) profile.city = emptyToNull(input.city);
    if (input.state !== undefined) profile.state = emptyToNull(input.state);
    if (input.pincode !== undefined) profile.pincode = input.pincode || null;

    await profile.save();

    await ActivityLogService.log({
      userId,
      action: 'PROFILE_UPDATED',
      entity: 'USER',
      entityId: userId,
      description: `User #${userId} updated profile details`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getProfile(userId);
  }

  /**
   * Saves the bank / UPI details used for withdrawal payouts
   */
  public static async updatePayoutDetails(
    userId: number,
    input: UpdatePayoutDetailsInput,
    meta: RequestMeta = {}
  ) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenError('Only customer accounts can register payout details.');
    }

    const existing = await UserPayoutDetail.findOne({ where: { user_id: userId } });

    const next = {
      preferred_method: input.preferredMethod,
      upi_id: input.upiId !== undefined ? input.upiId || null : existing?.upi_id ?? null,
      account_holder_name:
        input.accountHolderName !== undefined
          ? input.accountHolderName || null
          : existing?.account_holder_name ?? null,
      account_number_encrypted: existing?.account_number_encrypted ?? null,
      account_last4: existing?.account_last4 ?? null,
      ifsc_code: input.ifscCode !== undefined ? input.ifscCode || null : existing?.ifsc_code ?? null,
      bank_name: input.bankName !== undefined ? input.bankName?.trim() || null : existing?.bank_name ?? null,
    };

    if (input.accountNumber) {
      next.account_number_encrypted = encryptData(input.accountNumber);
      next.account_last4 = input.accountNumber.slice(-4);
    } else if (input.accountNumber === null) {
      next.account_number_encrypted = null;
      next.account_last4 = null;
    }

    if (input.preferredMethod === PayoutMethod.BANK) {
      const missing: string[] = [];
      if (!next.account_holder_name) missing.push('account holder name');
      if (!next.account_number_encrypted) missing.push('account number');
      if (!next.ifsc_code) missing.push('IFSC code');
      if (missing.length > 0) {
        throw new BadRequestError(`Bank payouts require: ${missing.join(', ')}`);
      }
    }

    if (input.preferredMethod === PayoutMethod.UPI && !next.upi_id) {
      throw new BadRequestError('UPI payouts require a UPI ID');
    }

    if (existing) {
      await existing.update(next);
    } else {
      await UserPayoutDetail.create({ user_id: userId, ...next });
    }

    await ActivityLogService.log({
      userId,
      action: 'PAYOUT_DETAILS_UPDATED',
      entity: 'USER',
      entityId: userId,
      description: `User #${userId} updated payout details (preferred: ${input.preferredMethod})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const saved = await UserPayoutDetail.findOne({ where: { user_id: userId } });
    return serializePayoutDetail(saved);
  }

  public static async changePassword(userId: number, input: ChangePasswordInput, meta: RequestMeta = {}) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const matches = await bcrypt.compare(input.currentPassword, user.password_hash);
    if (!matches) {
      throw new BadRequestError('Current password is incorrect');
    }

    user.password_hash = await bcrypt.hash(input.newPassword, await bcrypt.genSalt(12));
    await user.save();

    await ActivityLogService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      entity: 'USER',
      entityId: userId,
      description: `User #${userId} changed their password`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { message: 'Password changed successfully' };
  }


  /**
   * Issues a one-time code. The response is identical whether or not the
   * account exists, so the endpoint cannot be used to enumerate users.
   */
  public static async forgotPassword(input: ForgotPasswordInput, meta: RequestMeta = {}) {
    const response = {
      message: 'If an account matches, a 6-digit reset code has been sent to its registered email.',
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    };

    const user = await User.findOne({ where: { email: input.email } });
    if (!user || user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      return response;
    }

    const recent = await PasswordReset.findOne({
      where: {
        user_id: user.id,
        used_at: null,
        created_at: { [Op.gte]: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) },
      },
    });
    if (recent) {
      return response;
    }

    // Only the newest code may be valid
    await PasswordReset.update(
      { used_at: new Date() },
      { where: { user_id: user.id, used_at: null } }
    );

    const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');

    await PasswordReset.create({
      user_id: user.id,
      otp_hash: await bcrypt.hash(otp, 10),
      expires_at: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    });

    await EmailService.sendPasswordResetOtp(user.email, otp, OTP_EXPIRY_MINUTES);

    await ActivityLogService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'USER',
      entityId: user.id,
      description: `Password reset code issued for user #${user.id}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return response;
  }

  public static async resetPassword(input: ResetPasswordInput, meta: RequestMeta = {}) {
    const invalid = new UnauthorizedError('Invalid or expired reset code');

    const user = await User.findOne({ where: { email: input.email } });
    if (!user) {
      throw invalid;
    }

    const reset = await PasswordReset.findOne({
      where: {
        user_id: user.id,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [['id', 'DESC']],
    });
    if (!reset) {
      throw invalid;
    }

    if (reset.attempts >= OTP_MAX_ATTEMPTS) {
      reset.used_at = new Date();
      await reset.save();
      throw new UnauthorizedError('Too many incorrect attempts. Please request a new reset code.');
    }

    const matches = await bcrypt.compare(input.otp, reset.otp_hash);
    if (!matches) {
      reset.attempts += 1;
      await reset.save();
      throw invalid;
    }

    user.password_hash = await bcrypt.hash(input.newPassword, await bcrypt.genSalt(12));
    await user.save();

    reset.used_at = new Date();
    await reset.save();

    await ActivityLogService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entity: 'USER',
      entityId: user.id,
      description: `User #${user.id} reset their password using a one-time code`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { message: 'Password reset successfully. Please sign in with your new password.' };
  }
}
