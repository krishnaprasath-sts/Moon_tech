import bcrypt from 'bcryptjs';
import { Op, WhereOptions } from 'sequelize';
import { BankChangeRequest, CustomerProfile, KycProfile, User, UserPayoutDetail, Withdrawal } from '../models/index.js';
import { BankChangeStatus, BankSource, KycStatus, NotificationType, PayoutMethod, UserRole, WithdrawalStatus } from '../types/index.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { decryptData, encryptData } from '../utils/encryption.js';
import { identityHash } from '../utils/identityHash.js';
import { maskBankAccount } from '../utils/mask.js';
import { toIso } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import { RequestMeta, getPagination, buildMeta } from '../utils/http.js';
import { config } from '../config/index.js';
import { ActivityLogService } from './activityLogService.js';
import { EmailService } from './emailService.js';
import { FileService } from './fileService.js';
import { NotificationService } from './notificationService.js';
import {
  BankChangeListQuery,
  BankChangeReviewInput,
  CreateBankChangeInput,
} from '../validators/bankChangeValidators.js';

/** A withdrawal paid within this many days of an approved bank change is flagged for a closer look */
export const RECENT_BANK_CHANGE_DAYS = 7;

const masked = (last4?: string | null) => (last4 ? maskBankAccount(`XXXXXXXX${last4}`) : null);

/** Keyed fingerprint of a bank account number (digits only), comparable across tables */
export function accountFingerprint(accountNumber: string | null | undefined): string | null {
  const digits = String(accountNumber ?? '').replace(/\D/g, '');
  return digits ? identityHash(digits) : null;
}

/** Fingerprint of an encrypted account number (decrypts in memory only) */
export function encryptedFingerprint(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  return accountFingerprint(decryptData(encrypted));
}

function isManager(role?: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
}

type BankCheckLevel = 'OK' | 'CHANGED' | 'WARNING';

export interface BankCheck {
  /** OK = paid to the KYC-verified account; CHANGED = approved bank change; WARNING = needs a closer look */
  level: BankCheckLevel;
  /** Short headline for the admin */
  title: string;
  /** Reasons behind the level, most important first */
  notes: string[];
  matchesKyc: boolean | null;
  source: string | null;
  kycAccountMasked: string | null;
  kycIfsc: string | null;
  kycBankName: string | null;
  approvedChange: {
    id: number;
    approvedAt: string | null;
    approvedBy: string | null;
    previousAccountMasked: string | null;
    previousIfsc: string | null;
    previousBankName: string | null;
  } | null;
  pendingChangeRequestId: number | null;
}

/**
 * The bank account withdrawals are paid to, and the approval workflow for changing it.
 *
 * Rules:
 * - The bank account given in KYC becomes the payout account. When the KYC is verified it
 *   is copied over (and marked verified), replacing anything the customer typed in earlier.
 * - Once a payout account exists the customer cannot edit it directly: they submit a change
 *   request with proof (passbook / cancelled cheque / statement) and their password. Payouts
 *   keep going to the current account until an admin approves the request.
 * - Every withdrawal stores a fingerprint of the account it is paid to, so the admin sees
 *   whether it is the KYC account, an approved changed account, or something unverified.
 */
export class BankAccountService {
  // --------------------------------------------------------------- KYC sync

  /**
   * Copies the KYC bank account into the payout details.
   * `verified` (KYC approved): always overwrite and mark verified.
   * Not verified (KYC submitted): only fill in when no payout account exists yet.
   */
  public static async syncFromKyc(kyc: KycProfile, opts: { verified: boolean }) {
    if (!kyc.bank_account_number_encrypted || !kyc.ifsc_code || !kyc.account_holder_name) return;

    const existing = await UserPayoutDetail.findOne({ where: { user_id: kyc.user_id } });
    if (!opts.verified && existing?.account_number_encrypted) return;

    const hash = kyc.bank_account_hash || encryptedFingerprint(kyc.bank_account_number_encrypted);
    const replacing =
      existing?.account_number_encrypted &&
      (existing.account_hash !== hash || existing.ifsc_code !== kyc.ifsc_code);

    // A verified KYC never overrides a bank change the admin approved after it
    if (opts.verified && existing?.bank_source === BankSource.CHANGE_REQUEST && existing.bank_verified_at) {
      const kycReviewed = kyc.reviewed_at ? new Date(kyc.reviewed_at).getTime() : 0;
      if (new Date(existing.bank_verified_at).getTime() > kycReviewed) return;
    }

    const values = {
      preferred_method: PayoutMethod.BANK,
      account_holder_name: kyc.account_holder_name,
      account_number_encrypted: kyc.bank_account_number_encrypted,
      account_last4: kyc.bank_account_last4,
      account_hash: hash,
      ifsc_code: kyc.ifsc_code,
      bank_name: kyc.bank_name ?? null,
      bank_branch: kyc.bank_branch ?? null,
      bank_source: BankSource.KYC,
      bank_verified_at: opts.verified ? new Date() : null,
      bank_change_request_id: null,
    };

    if (existing) await existing.update(values);
    else await UserPayoutDetail.create({ user_id: kyc.user_id, ...values });

    if (replacing) {
      await ActivityLogService.log({
        userId: kyc.reviewed_by ?? kyc.user_id,
        action: 'PAYOUT_BANK_SET_FROM_KYC',
        entity: 'USER',
        entityId: kyc.user_id,
        description: `Payout bank account of customer #${kyc.user_id} replaced by the KYC-verified account (ending ${kyc.bank_account_last4}); the self-entered account ending ${existing?.account_last4} is no longer used`,
      });
    }
  }

  // ---------------------------------------------------------------- customer

  public static serializeForCustomer(r: BankChangeRequest) {
    return {
      id: r.id,
      status: r.status,
      accountHolderName: r.account_holder_name,
      accountNumberMasked: masked(r.account_last4),
      ifscCode: r.ifsc_code,
      bankName: r.bank_name,
      bankBranch: r.bank_branch,
      reason: r.reason,
      previousAccountMasked: masked(r.previous_account_last4),
      previousBankName: r.previous_bank_name,
      adminRemarks: r.admin_remarks,
      reviewedAt: toIso(r.reviewed_at),
      createdAt: toIso(r.created_at),
    };
  }

  public static async listMine(userId: number) {
    const rows = await BankChangeRequest.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: 20,
    });
    return rows.map((r) => this.serializeForCustomer(r));
  }

  public static async createRequest(
    userId: number,
    input: CreateBankChangeInput,
    proof: Express.Multer.File | undefined,
    meta: RequestMeta = {}
  ) {
    const user = await User.findByPk(userId, {
      include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name', 'customer_id'] }],
    });
    if (!user) throw new NotFoundError('User not found');
    if (user.role !== UserRole.CUSTOMER) throw new ForbiddenError('Only customer accounts have payout bank details.');

    // Re-authenticate: changing where money goes must not be possible with a stolen session alone
    const passwordOk = await bcrypt.compare(input.currentPassword, user.password_hash);
    if (!passwordOk) throw new BadRequestError('Your password is incorrect', [{ field: 'currentPassword', message: 'Incorrect password' }]);

    const current = await UserPayoutDetail.findOne({ where: { user_id: userId } });
    if (!current?.account_number_encrypted) {
      throw new BadRequestError('You have no bank account on file yet. Add your bank details first.');
    }

    const pending = await BankChangeRequest.findOne({ where: { user_id: userId, status: BankChangeStatus.PENDING } });
    if (pending) {
      throw new ConflictError('You already have a bank change request waiting for approval. Cancel it first to submit a new one.');
    }

    const accountNumber = input.accountNumber.replace(/\D/g, '');
    const hash = accountFingerprint(accountNumber)!;
    const currentHash = current.account_hash || encryptedFingerprint(current.account_number_encrypted);
    if (hash === currentHash && input.ifscCode === current.ifsc_code) {
      throw new BadRequestError('This is already your registered bank account.');
    }

    // The same account must not receive payouts for two customers
    const usedElsewhere =
      (await UserPayoutDetail.count({ where: { account_hash: hash, user_id: { [Op.ne]: userId } } })) +
      (await KycProfile.count({ where: { bank_account_hash: hash, user_id: { [Op.ne]: userId } } }));
    if (usedElsewhere > 0) {
      throw new ConflictError('This bank account is already registered with another customer. Please contact support.');
    }

    if (!proof) {
      throw new BadRequestError('Upload a bank proof (passbook first page, cancelled cheque or bank statement)', [
        { field: 'proof', message: 'Bank proof is required' },
      ]);
    }
    const saved = await FileService.savePaymentDocument(userId, proof, 'BANK_PROOF');

    const request = await BankChangeRequest.create({
      user_id: userId,
      status: BankChangeStatus.PENDING,
      account_holder_name: input.accountHolderName,
      account_number_encrypted: encryptData(accountNumber),
      account_last4: accountNumber.slice(-4),
      account_hash: hash,
      ifsc_code: input.ifscCode,
      bank_name: input.bankName,
      bank_branch: input.bankBranch,
      proof_document: saved.fileName,
      reason: input.reason || null,
      previous_account_holder: current.account_holder_name,
      previous_account_last4: current.account_last4,
      previous_account_hash: currentHash,
      previous_ifsc: current.ifsc_code,
      previous_bank_name: current.bank_name,
      previous_bank_branch: current.bank_branch,
      ip_address: meta.ipAddress || null,
    });

    await ActivityLogService.log({
      userId,
      action: 'BANK_CHANGE_REQUESTED',
      entity: 'BANK_CHANGE_REQUEST',
      entityId: request.id,
      description: `Customer #${userId} asked to change the payout bank account from ending ${current.account_last4} (${current.ifsc_code}) to ending ${request.account_last4} (${request.ifsc_code})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Security notice to the account email: if the customer did not do this, they can react
    const name = (user as any).profile?.full_name || 'Customer';
    EmailService.sendNotificationEmail(
      user.email,
      'Bank account change requested',
      `We received a request to change the bank account for your withdrawals to an account ending ${request.account_last4} (${request.bank_name}). Withdrawals keep going to your current account ending ${current.account_last4} until our team approves the change. If you did not ask for this, contact support immediately and change your password.`,
      NotificationType.BANK_CHANGE_APPROVED,
      name
    ).catch(() => {});

    if (config.supportEmail) {
      EmailService.sendNotificationEmail(
        config.supportEmail,
        'Bank change request waiting for approval',
        `${name} (${(user as any).profile?.customer_id || `#${userId}`}, ${user.email}) asked to change their payout bank account from ending ${current.account_last4} to ending ${request.account_last4} (${request.bank_name}, ${request.ifsc_code}). Review it under Bank Changes in the admin panel.`,
        NotificationType.ANNOUNCEMENT,
        'Admin'
      ).catch((err) => logger.warn(`Could not email bank change alert: ${err?.message || err}`));
    }

    return this.serializeForCustomer(request);
  }

  public static async cancelRequest(userId: number, requestId: number, meta: RequestMeta = {}) {
    const request = await BankChangeRequest.findOne({ where: { id: requestId, user_id: userId } });
    if (!request) throw new NotFoundError('Bank change request not found');
    if (request.status !== BankChangeStatus.PENDING) throw new BadRequestError('Only a pending request can be cancelled');

    request.status = BankChangeStatus.CANCELLED;
    await request.save();

    await ActivityLogService.log({
      userId,
      action: 'BANK_CHANGE_CANCELLED',
      entity: 'BANK_CHANGE_REQUEST',
      entityId: request.id,
      description: `Customer #${userId} cancelled bank change request #${request.id}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return this.serializeForCustomer(request);
  }

  // ------------------------------------------------------------------- admin

  private static async serializeForAdmin(r: BankChangeRequest, viewerRole?: UserRole, withContext = false) {
    const user = (r as any).user as (User & { profile?: CustomerProfile }) | undefined;
    const reviewer = (r as any).reviewer as User | undefined;
    const fullAccess = isManager(viewerRole);

    const base = {
      id: r.id,
      status: r.status,
      customer: {
        userId: r.user_id,
        name: user?.profile?.full_name || user?.email || `Customer #${r.user_id}`,
        customerId: user?.profile?.customer_id || null,
        email: user?.email || '',
        phone: user?.phone || '',
      },
      requested: {
        accountHolderName: r.account_holder_name,
        accountNumberMasked: masked(r.account_last4),
        accountNumber: fullAccess ? decryptData(r.account_number_encrypted) || null : null,
        ifscCode: r.ifsc_code,
        bankName: r.bank_name,
        bankBranch: r.bank_branch,
      },
      previous: {
        accountHolderName: r.previous_account_holder,
        accountNumberMasked: masked(r.previous_account_last4),
        ifscCode: r.previous_ifsc,
        bankName: r.previous_bank_name,
        bankBranch: r.previous_bank_branch,
      },
      holderNameChanged:
        (r.previous_account_holder || '').trim().toLowerCase() !== (r.account_holder_name || '').trim().toLowerCase(),
      reason: r.reason,
      adminRemarks: r.admin_remarks,
      reviewedBy: reviewer?.email || null,
      reviewedAt: toIso(r.reviewed_at),
      createdAt: toIso(r.created_at),
      ipAddress: r.ip_address,
    };

    if (!withContext) return base;

    // What the admin needs to judge the request
    const [kyc, pendingWithdrawals, previousRequests] = await Promise.all([
      KycProfile.findOne({ where: { user_id: r.user_id } }),
      Withdrawal.count({
        where: { user_id: r.user_id, status: { [Op.in]: [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED] } },
      }),
      BankChangeRequest.count({ where: { user_id: r.user_id, id: { [Op.ne]: r.id } } }),
    ]);

    return {
      ...base,
      kyc: kyc
        ? {
            status: kyc.kyc_status,
            accountHolderName: kyc.account_holder_name,
            accountNumberMasked: masked(kyc.bank_account_last4),
            ifscCode: kyc.ifsc_code,
            bankName: kyc.bank_name,
            bankBranch: kyc.bank_branch,
            requestedMatchesKyc: Boolean(kyc.bank_account_hash && kyc.bank_account_hash === r.account_hash),
            holderMatchesKyc:
              (kyc.account_holder_name || '').trim().toLowerCase() === (r.account_holder_name || '').trim().toLowerCase(),
          }
        : null,
      openWithdrawals: pendingWithdrawals,
      previousRequests,
    };
  }

  public static async listForAdmin(params: BankChangeListQuery, viewerRole?: UserRole) {
    const { page, limit, offset } = getPagination(params, 20);
    const where: WhereOptions = {};
    if (params.status) (where as any).status = params.status;

    const userInclude: any = {
      model: User,
      as: 'user',
      attributes: ['id', 'email', 'phone'],
      include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name', 'customer_id'] }],
    };
    const search = params.search?.trim();
    if (search) {
      const like = `%${search}%`;
      userInclude.required = true;
      userInclude.where = {
        [Op.or]: [
          { email: { [Op.like]: like } },
          { phone: { [Op.like]: like } },
          { '$user.profile.full_name$': { [Op.like]: like } },
          { '$user.profile.customer_id$': { [Op.like]: like } },
        ],
      };
    }

    const { count, rows } = await BankChangeRequest.findAndCountAll({
      where,
      include: [userInclude, { model: User, as: 'reviewer', attributes: ['id', 'email'], required: false }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      distinct: true,
      subQuery: false,
    });

    const items = await Promise.all(rows.map((r) => this.serializeForAdmin(r, viewerRole)));
    const pendingCount = await BankChangeRequest.count({ where: { status: BankChangeStatus.PENDING } });
    return { items, meta: { ...buildMeta(page, limit, count), pendingCount } };
  }

  private static async loadForAdmin(id: number) {
    const r = await BankChangeRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'phone'],
          include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name', 'customer_id'] }],
        },
        { model: User, as: 'reviewer', attributes: ['id', 'email'], required: false },
      ],
    });
    if (!r) throw new NotFoundError('Bank change request not found');
    return r;
  }

  public static async getForAdmin(id: number, viewerRole?: UserRole) {
    return this.serializeForAdmin(await this.loadForAdmin(id), viewerRole, true);
  }

  public static async pendingCount() {
    return { pendingCount: await BankChangeRequest.count({ where: { status: BankChangeStatus.PENDING } }) };
  }

  public static async getProof(id: number) {
    const r = await BankChangeRequest.findByPk(id, { attributes: ['id', 'proof_document'] });
    if (!r) throw new NotFoundError('Bank change request not found');
    return FileService.getSecureFile(r.proof_document);
  }

  public static async approve(adminId: number, id: number, input: BankChangeReviewInput, meta: RequestMeta = {}) {
    const request = await this.loadForAdmin(id);
    if (request.status !== BankChangeStatus.PENDING) throw new BadRequestError(`This request is already ${request.status.toLowerCase()}`);

    // Re-check: the account may have been registered by someone else since the request
    const usedElsewhere =
      (await UserPayoutDetail.count({ where: { account_hash: request.account_hash, user_id: { [Op.ne]: request.user_id } } })) +
      (await KycProfile.count({ where: { bank_account_hash: request.account_hash, user_id: { [Op.ne]: request.user_id } } }));
    if (usedElsewhere > 0) {
      throw new ConflictError('This bank account is now registered with another customer. Reject the request instead.');
    }

    const now = new Date();
    const values = {
      preferred_method: PayoutMethod.BANK,
      account_holder_name: request.account_holder_name,
      account_number_encrypted: request.account_number_encrypted,
      account_last4: request.account_last4,
      account_hash: request.account_hash,
      ifsc_code: request.ifsc_code,
      bank_name: request.bank_name,
      bank_branch: request.bank_branch,
      bank_source: BankSource.CHANGE_REQUEST,
      bank_verified_at: now,
      bank_change_request_id: request.id,
    };
    const payout = await UserPayoutDetail.findOne({ where: { user_id: request.user_id } });
    if (payout) await payout.update(values);
    else await UserPayoutDetail.create({ user_id: request.user_id, ...values });

    request.status = BankChangeStatus.APPROVED;
    request.admin_remarks = input.remarks?.trim() || null;
    request.reviewed_by = adminId;
    request.reviewed_at = now;
    await request.save();

    await ActivityLogService.log({
      userId: adminId,
      action: 'BANK_CHANGE_APPROVED',
      entity: 'BANK_CHANGE_REQUEST',
      entityId: request.id,
      description: `Admin #${adminId} approved bank change #${request.id} for customer #${request.user_id}: ending ${request.previous_account_last4} -> ending ${request.account_last4} (${request.ifsc_code})`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId: request.user_id,
      type: NotificationType.BANK_CHANGE_APPROVED,
      title: 'Bank account updated',
      message: `Your new bank account ending ${request.account_last4} (${request.bank_name}) is approved. New withdrawals are paid to it. Requests made before the change are still paid to the old account.`,
      relatedEntity: 'BANK_CHANGE_REQUEST',
      relatedId: request.id,
    });

    return this.getForAdmin(request.id, UserRole.ADMIN);
  }

  public static async reject(adminId: number, id: number, input: BankChangeReviewInput, meta: RequestMeta = {}) {
    const request = await this.loadForAdmin(id);
    if (request.status !== BankChangeStatus.PENDING) throw new BadRequestError(`This request is already ${request.status.toLowerCase()}`);
    const remarks = input.remarks?.trim();
    if (!remarks) throw new BadRequestError('Give the customer a reason for the rejection', [{ field: 'remarks', message: 'Reason is required' }]);

    request.status = BankChangeStatus.REJECTED;
    request.admin_remarks = remarks;
    request.reviewed_by = adminId;
    request.reviewed_at = new Date();
    await request.save();

    await ActivityLogService.log({
      userId: adminId,
      action: 'BANK_CHANGE_REJECTED',
      entity: 'BANK_CHANGE_REQUEST',
      entityId: request.id,
      description: `Admin #${adminId} rejected bank change #${request.id} for customer #${request.user_id}: ${remarks}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await NotificationService.notify({
      userId: request.user_id,
      type: NotificationType.BANK_CHANGE_REJECTED,
      title: 'Bank account change not approved',
      message: `Your request to change the bank account to one ending ${request.account_last4} was not approved: ${remarks}. Withdrawals continue to your current account ending ${request.previous_account_last4}.`,
      relatedEntity: 'BANK_CHANGE_REQUEST',
      relatedId: request.id,
    });

    return this.getForAdmin(request.id, UserRole.ADMIN);
  }

  // ------------------------------------------------- withdrawal identification

  /**
   * How the bank account of a withdrawal relates to the customer's KYC and to approved
   * bank changes. Shown to the admin before a payout is approved or paid.
   */
  public static async bankCheckForWithdrawal(w: Withdrawal): Promise<BankCheck | null> {
    if (w.payout_method !== PayoutMethod.BANK && !w.payout_account_number_encrypted) return null;

    const hash = w.payout_account_hash || encryptedFingerprint(w.payout_account_number_encrypted);
    const [kyc, pendingChange, changeRequest] = await Promise.all([
      KycProfile.findOne({ where: { user_id: w.user_id } }),
      BankChangeRequest.findOne({ where: { user_id: w.user_id, status: BankChangeStatus.PENDING }, attributes: ['id'] }),
      hash
        ? BankChangeRequest.findOne({
            where: { user_id: w.user_id, status: BankChangeStatus.APPROVED, account_hash: hash },
            include: [{ model: User, as: 'reviewer', attributes: ['email'], required: false }],
            order: [['reviewed_at', 'DESC']],
          })
        : Promise.resolve(null),
    ]);

    const kycHash = kyc?.bank_account_hash || encryptedFingerprint(kyc?.bank_account_number_encrypted);
    const matchesKyc = hash && kycHash ? hash === kycHash && kyc?.ifsc_code === w.payout_ifsc : null;
    const kycVerified = kyc?.kyc_status === KycStatus.VERIFIED;
    const notes: string[] = [];
    let level: BankCheckLevel;
    let title: string;

    if (matchesKyc && kycVerified) {
      level = 'OK';
      title = 'Paid to the KYC-verified bank account';
    } else if (changeRequest) {
      level = 'CHANGED';
      title = 'Paid to a changed bank account (approved by admin)';
      const approvedAt = changeRequest.reviewed_at ? new Date(changeRequest.reviewed_at) : null;
      notes.push(
        `Changed from account ending ${changeRequest.previous_account_last4 || '?'} (${changeRequest.previous_bank_name || changeRequest.previous_ifsc || 'previous bank'}) by request #${changeRequest.id}.`
      );
      if (approvedAt) {
        const requestedAt = w.created_at ? new Date(w.created_at) : new Date();
        const days = (requestedAt.getTime() - approvedAt.getTime()) / 86_400_000;
        if (days >= 0 && days < RECENT_BANK_CHANGE_DAYS) {
          level = 'WARNING';
          notes.unshift(`Bank account was changed only ${Math.max(0, Math.floor(days))} day(s) before this withdrawal. Confirm with the customer before paying.`);
        }
      }
    } else if (matchesKyc && !kycVerified) {
      level = 'WARNING';
      title = 'Bank account matches the KYC, but the KYC is not verified yet';
    } else {
      level = 'WARNING';
      title = kyc?.bank_account_number_encrypted
        ? 'Bank account differs from the KYC account and no change was approved'
        : 'Bank account was entered by the customer and has not been verified';
      notes.push('Check the account holder name against the customer before paying.');
    }

    if (pendingChange) {
      notes.push(`The customer has a bank change request #${pendingChange.id} waiting for approval; this withdrawal still goes to the account shown.`);
    }

    const reviewer = (changeRequest as any)?.reviewer as User | undefined;
    return {
      level,
      title,
      notes,
      matchesKyc,
      source: w.payout_bank_source || null,
      kycAccountMasked: masked(kyc?.bank_account_last4),
      kycIfsc: kyc?.ifsc_code || null,
      kycBankName: kyc?.bank_name || null,
      approvedChange: changeRequest
        ? {
            id: changeRequest.id,
            approvedAt: toIso(changeRequest.reviewed_at),
            approvedBy: reviewer?.email || null,
            previousAccountMasked: masked(changeRequest.previous_account_last4),
            previousIfsc: changeRequest.previous_ifsc,
            previousBankName: changeRequest.previous_bank_name,
          }
        : null,
      pendingChangeRequestId: pendingChange?.id ?? null,
    };
  }

  /** Light flag for withdrawal lists: OK / CHANGED / WARNING, computed in one batch */
  public static async bankFlagsForWithdrawals(withdrawals: Withdrawal[]): Promise<Map<number, BankCheckLevel>> {
    const result = new Map<number, BankCheckLevel>();
    const userIds = Array.from(new Set(withdrawals.map((w) => w.user_id)));
    if (userIds.length === 0) return result;

    const [kycs, approved] = await Promise.all([
      KycProfile.findAll({ where: { user_id: { [Op.in]: userIds } }, attributes: ['user_id', 'bank_account_hash', 'ifsc_code', 'kyc_status'] }),
      BankChangeRequest.findAll({
        where: { user_id: { [Op.in]: userIds }, status: BankChangeStatus.APPROVED },
        attributes: ['user_id', 'account_hash', 'reviewed_at'],
      }),
    ]);
    const kycByUser = new Map(kycs.map((k) => [k.user_id, k]));

    for (const w of withdrawals) {
      if (!w.payout_account_hash) continue;
      const kyc = kycByUser.get(w.user_id);
      if (kyc?.kyc_status === KycStatus.VERIFIED && kyc.bank_account_hash === w.payout_account_hash && kyc.ifsc_code === w.payout_ifsc) {
        result.set(w.id, 'OK');
        continue;
      }
      const change = approved
        .filter((a) => a.user_id === w.user_id && a.account_hash === w.payout_account_hash)
        .sort((a, b) => new Date(b.reviewed_at || 0).getTime() - new Date(a.reviewed_at || 0).getTime())[0];
      if (change?.reviewed_at) {
        const days = (new Date(w.created_at || Date.now()).getTime() - new Date(change.reviewed_at).getTime()) / 86_400_000;
        result.set(w.id, days >= 0 && days < RECENT_BANK_CHANGE_DAYS ? 'WARNING' : 'CHANGED');
      } else {
        result.set(w.id, 'WARNING');
      }
    }
    return result;
  }
}
