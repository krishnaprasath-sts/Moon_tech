import { Op } from 'sequelize';
import { User, CustomerProfile, KycProfile, KycReview } from '../models/index.js';
import { KycStatus, KycReviewAction, UserRole, KycFilterParams, NotificationType, JwtUserPayload } from '../types/index.js';
import { encryptData, decryptData } from '../utils/encryption.js';
import { NotificationService } from './notificationService.js';
import { extractPanLast4, extractAadhaarLast4, extractBankAccountLast4, maskPan, maskAadhaar, maskBankAccount } from '../utils/mask.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { FileService } from './fileService.js';
import { ActivityLogService } from './activityLogService.js';
import { EmailService } from './emailService.js';
import { identityHash } from '../utils/identityHash.js';
import { BankAccountService, accountFingerprint } from './bankAccountService.js';
import { KycSubmitInput, ManualKycSubmitInput, KycVerifyInput, KycRejectInput, KycResubmitInput } from '../validators/kycValidators.js';

/** Plain-language guidance shown to the customer for each KYC state. */
const NEXT_STEP: Record<string, string> = {
  [KycStatus.DRAFT]: 'Complete your KYC by uploading your PAN card, Aadhaar card (front and back) and bank passbook.',
  [KycStatus.PENDING]: 'Your documents are in the review queue. Verification usually completes within 1 working day.',
  [KycStatus.UNDER_REVIEW]: 'A reviewer is checking your documents right now. No action is needed from you.',
  [KycStatus.VERIFIED]: 'You are fully verified. You can invest and withdraw to your registered bank account.',
  [KycStatus.REJECTED]: 'Your KYC was rejected. Review the reason below, fix the issue and submit again.',
  [KycStatus.RESUBMISSION_REQUIRED]: 'Some details or documents need correction. Please resubmit the items mentioned below.',
  [KycStatus.SUSPENDED]: 'Your KYC has been suspended. Please contact support for help.',
};

export class KycService {
  /**
   * One person, one account: a PAN or Aadhaar that is already on another customer's KYC
   * (anything but a rejected submission) cannot be submitted again. This is what stops a
   * customer from opening a second account with their own referral code.
   */
  private static async assertIdentityNotReused(userId: number, pan: string, aadhaarReference: string): Promise<void> {
    const panHash = identityHash(pan);
    const aadhaar = aadhaarReference.trim();
    const conditions: any[] = [];
    if (panHash) conditions.push({ pan_hash: panHash });
    if (aadhaar) conditions.push({ aadhaar_reference: aadhaar });
    if (conditions.length === 0) return;
    const clash = await KycProfile.findOne({
      where: {
        user_id: { [Op.ne]: userId },
        kyc_status: { [Op.ne]: KycStatus.REJECTED },
        [Op.or]: conditions,
      },
      attributes: ['id', 'user_id', 'pan_hash', 'aadhaar_reference'],
    });
    if (clash) {
      const what = panHash && clash.pan_hash === panHash ? 'PAN' : 'Aadhaar';
      throw new BadRequestError(
        `This ${what} is already registered with another Clyvus Ventures account. Only one account per person is allowed; please contact support if this is a mistake.`
      );
    }
  }

  /**
   * Get the signed-in customer's own KYC record.
   * This is deliberately separate from getKycById(), whose argument is the
   * KYC profile primary key used by the admin review routes.
   */
  public static async getMyKyc(userId: number) {
    const kyc = await KycProfile.findOne({
      where: { user_id: userId },
      include: [{ model: KycReview, as: 'reviews', attributes: ['id', 'action', 'remarks', 'created_at'] }],
    });

    if (!kyc) {
      return {
        id: null,
        userId,
        status: KycStatus.DRAFT,
        submittedAt: null,
        reviewedAt: null,
        rejectionReason: null,
        hasPassbook: false,
        hasPan: false,
        hasAadhaar: false,
        hasAadhaarBack: false,
        details: null,
        history: [],
        nextStep: NEXT_STEP[KycStatus.DRAFT],
      };
    }

    const reviews: KycReview[] = ((kyc as any).reviews || []).slice();
    reviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      id: kyc.id,
      userId: kyc.user_id,
      status: kyc.kyc_status,
      submittedAt: kyc.submitted_at,
      reviewedAt: kyc.reviewed_at,
      rejectionReason: kyc.rejection_reason,
      hasPassbook: Boolean(kyc.passbook_document),
      hasPan: Boolean(kyc.pan_document),
      hasAadhaar: Boolean(kyc.aadhaar_document),
      hasAadhaarBack: Boolean(kyc.aadhaar_back_document),
      // What the customer submitted, masked - lets them double-check before resubmitting
      details: {
        maskedPan: kyc.pan_last4 ? maskPan(kyc.pan_last4) : null,
        maskedAadhaar: kyc.aadhaar_last4 ? maskAadhaar(kyc.aadhaar_last4) : null,
        maskedAccountNumber: kyc.bank_account_last4 ? maskBankAccount(`XXXXXXXX${kyc.bank_account_last4}`) : null,
        accountHolderName: kyc.account_holder_name,
        ifscCode: kyc.ifsc_code,
        bankBranch: kyc.bank_branch,
        bankName: kyc.bank_name,
      },
      // Review timeline (customer-facing: no reviewer identities)
      history: reviews.map((rev) => ({
        id: rev.id,
        action: rev.action,
        remarks: rev.remarks,
        createdAt: rev.created_at,
      })),
      nextStep: NEXT_STEP[kyc.kyc_status] || null,
    };
  }

  /**
   * Customer submits KYC documents and details
   */
  public static async submitKyc(
    userId: number,
    input: KycSubmitInput,
    files: { [fieldname: string]: Express.Multer.File[] },
    ipAddress?: string,
    userAgent?: string
  ) {
    let kyc = await KycProfile.findOne({ where: { user_id: userId } });
    if (!kyc) {
      kyc = await KycProfile.create({ user_id: userId, kyc_status: KycStatus.DRAFT });
    }

    if (kyc.kyc_status === KycStatus.VERIFIED) {
      throw new BadRequestError('Your KYC has already been verified and cannot be resubmitted');
    }
    await this.assertIdentityNotReused(userId, input.pan, input.aadhaarReference);

    const passbookFiles = files['passbookDocument'] || files['passbook'];
    const panFiles = files['panDocument'] || files['pan'];
    const aadhaarFiles = files['aadhaarDocument'] || files['aadhaar'];
    const aadhaarBackFiles = files['aadhaarBackDocument'] || files['aadhaarBack'];

    // Require every document on initial submission
    if (!kyc.passbook_document && (!passbookFiles || passbookFiles.length === 0)) {
      throw new BadRequestError('Bank Passbook / Statement document is required');
    }
    if (!kyc.pan_document && (!panFiles || panFiles.length === 0)) {
      throw new BadRequestError('PAN Card document is required');
    }
    if (!kyc.aadhaar_document && (!aadhaarFiles || aadhaarFiles.length === 0)) {
      throw new BadRequestError('Aadhaar card front image is required');
    }
    if (!kyc.aadhaar_back_document && (!aadhaarBackFiles || aadhaarBackFiles.length === 0)) {
      throw new BadRequestError('Aadhaar card back image is required');
    }

    // Process and optimize uploaded files
    let passbookDocName = kyc.passbook_document;
    let panDocName = kyc.pan_document;
    let aadhaarDocName = kyc.aadhaar_document;
    let aadhaarBackDocName = kyc.aadhaar_back_document;

    if (passbookFiles && passbookFiles[0]) {
      const saved = await FileService.processAndSaveKycFile(userId, passbookFiles[0], 'PASSBOOK');
      passbookDocName = saved.fileName;
    }

    if (panFiles && panFiles[0]) {
      const saved = await FileService.processAndSaveKycFile(userId, panFiles[0], 'PAN');
      panDocName = saved.fileName;
    }

    if (aadhaarFiles && aadhaarFiles[0]) {
      const saved = await FileService.processAndSaveKycFile(userId, aadhaarFiles[0], 'AADHAAR');
      aadhaarDocName = saved.fileName;
    }

    if (aadhaarBackFiles && aadhaarBackFiles[0]) {
      const saved = await FileService.processAndSaveKycFile(userId, aadhaarBackFiles[0], 'AADHAAR_BACK');
      aadhaarBackDocName = saved.fileName;
    }

    // Encrypt sensitive fields
    const panEncrypted = encryptData(input.pan.toUpperCase().trim());
    const bankEncrypted = encryptData(input.accountNumber.trim());

    // Extract non-reversible last-4 digits
    const panLast4 = extractPanLast4(input.pan);
    const aadhaarLast4 = extractAadhaarLast4(input.aadhaarReference);
    const bankLast4 = extractBankAccountLast4(input.accountNumber);

    // Update KYC profile
    kyc.kyc_status = KycStatus.PENDING;
    kyc.pan_number_encrypted = panEncrypted;
    kyc.pan_hash = identityHash(input.pan);
    kyc.pan_last4 = panLast4;
    kyc.aadhaar_reference = input.aadhaarReference.trim();
    kyc.aadhaar_last4 = aadhaarLast4;
    kyc.bank_account_number_encrypted = bankEncrypted;
    kyc.bank_account_last4 = bankLast4;
    kyc.account_holder_name = input.accountHolderName.trim();
    kyc.ifsc_code = input.ifsc.toUpperCase().trim();
    kyc.bank_branch = input.bankBranch.trim();
    kyc.bank_name = input.bankName.trim();
    kyc.bank_account_hash = accountFingerprint(input.accountNumber);
    kyc.passbook_document = passbookDocName;
    kyc.pan_document = panDocName;
    kyc.aadhaar_document = aadhaarDocName;
    kyc.aadhaar_back_document = aadhaarBackDocName;
    kyc.submitted_at = new Date();
    kyc.rejection_reason = null;

    await kyc.save();

    // First bank account on file comes from KYC (an existing one is replaced only when the KYC is verified)
    await BankAccountService.syncFromKyc(kyc, { verified: false });

    // Audit log
    await ActivityLogService.log({
      userId,
      action: 'KYC_SUBMITTED',
      entity: 'KYC_PROFILE',
      entityId: kyc.id,
      description: `Customer submitted KYC documents for review (PAN ending ${panLast4}, Bank ending ${bankLast4})`,
      ipAddress,
      userAgent,
    });

    return {
      id: kyc.id,
      status: kyc.kyc_status,
      submittedAt: kyc.submitted_at,
      panLast4: kyc.pan_last4,
      aadhaarLast4: kyc.aadhaar_last4,
      bankAccountLast4: kyc.bank_account_last4,
      accountHolderName: kyc.account_holder_name,
      ifscCode: kyc.ifsc_code,
      bankBranch: kyc.bank_branch,
      bankName: kyc.bank_name,
    };
  }

  /**
   * Admin manually creates/submits or verifies KYC for a customer
   */
  public static async manualSubmitKyc(
    adminId: number,
    input: ManualKycSubmitInput,
    files: { [fieldname: string]: Express.Multer.File[] },
    ipAddress?: string,
    userAgent?: string
  ) {
    const customer = await User.findOne({
      where: { id: input.customerId, role: UserRole.CUSTOMER },
      include: [{ model: CustomerProfile, as: 'profile' }],
    });

    if (!customer) {
      throw new NotFoundError(`Customer with ID #${input.customerId} not found`);
    }

    let kyc = await KycProfile.findOne({ where: { user_id: input.customerId } });
    if (!kyc) {
      kyc = await KycProfile.create({ user_id: input.customerId, kyc_status: KycStatus.DRAFT });
    }
    await this.assertIdentityNotReused(input.customerId, input.pan, input.aadhaarReference);

    const passbookFiles = files['passbookDocument'] || files['passbook'];
    const panFiles = files['panDocument'] || files['pan'];
    const aadhaarFiles = files['aadhaarDocument'] || files['aadhaar'];
    const aadhaarBackFiles = files['aadhaarBackDocument'] || files['aadhaarBack'];

    let passbookDocName = kyc.passbook_document;
    let panDocName = kyc.pan_document;
    let aadhaarDocName = kyc.aadhaar_document;

    if (passbookFiles && passbookFiles[0]) {
      const saved = await FileService.processAndSaveKycFile(input.customerId, passbookFiles[0], 'PASSBOOK');
      passbookDocName = saved.fileName;
    }

    if (panFiles && panFiles[0]) {
      const saved = await FileService.processAndSaveKycFile(input.customerId, panFiles[0], 'PAN');
      panDocName = saved.fileName;
    }

    if (aadhaarFiles && aadhaarFiles[0]) {
      const saved = await FileService.processAndSaveKycFile(input.customerId, aadhaarFiles[0], 'AADHAAR');
      aadhaarDocName = saved.fileName;
    }
    let aadhaarBackDocName = kyc.aadhaar_back_document;
    if (aadhaarBackFiles && aadhaarBackFiles[0]) {
      const saved = await FileService.processAndSaveKycFile(input.customerId, aadhaarBackFiles[0], 'AADHAAR_BACK');
      aadhaarBackDocName = saved.fileName;
    }

    // Encrypt sensitive fields
    const panEncrypted = encryptData(input.pan.toUpperCase().trim());
    const bankEncrypted = encryptData(input.accountNumber.trim());

    const panLast4 = extractPanLast4(input.pan);
    const aadhaarLast4 = extractAadhaarLast4(input.aadhaarReference);
    const bankLast4 = extractBankAccountLast4(input.accountNumber);

    const isDirectVerify = input.status === KycStatus.VERIFIED;

    kyc.kyc_status = isDirectVerify ? KycStatus.VERIFIED : KycStatus.PENDING;
    kyc.pan_number_encrypted = panEncrypted;
    kyc.pan_hash = identityHash(input.pan);
    kyc.pan_last4 = panLast4;
    kyc.aadhaar_reference = input.aadhaarReference.trim();
    kyc.aadhaar_last4 = aadhaarLast4;
    kyc.bank_account_number_encrypted = bankEncrypted;
    kyc.bank_account_last4 = bankLast4;
    kyc.account_holder_name = input.accountHolderName.trim();
    kyc.ifsc_code = input.ifsc.toUpperCase().trim();
    kyc.bank_branch = input.bankBranch.trim();
    kyc.bank_name = input.bankName.trim();
    kyc.bank_account_hash = accountFingerprint(input.accountNumber);
    kyc.passbook_document = passbookDocName;
    kyc.pan_document = panDocName;
    kyc.aadhaar_document = aadhaarDocName;
    kyc.aadhaar_back_document = aadhaarBackDocName;
    kyc.submitted_at = new Date();
    kyc.rejection_reason = null;

    if (isDirectVerify) {
      kyc.reviewed_at = new Date();
      kyc.reviewed_by = adminId;
    }

    await kyc.save();
    await BankAccountService.syncFromKyc(kyc, { verified: isDirectVerify });

    if (isDirectVerify) {
      await KycReview.create({
        kyc_id: kyc.id,
        admin_id: adminId,
        action: KycReviewAction.VERIFY,
        remarks: input.remarks || 'KYC manually entered and verified by admin',
      });
    }

    // Audit log
    await ActivityLogService.log({
      userId: adminId,
      action: isDirectVerify ? 'KYC_MANUALLY_VERIFIED' : 'KYC_MANUALLY_SUBMITTED',
      entity: 'KYC_PROFILE',
      entityId: kyc.id,
      description: `Admin #${adminId} manually registered KYC for customer #${input.customerId} (Status: ${kyc.kyc_status})`,
      ipAddress,
      userAgent,
    });

    return {
      id: kyc.id,
      userId: kyc.user_id,
      status: kyc.kyc_status,
      submittedAt: kyc.submitted_at,
      panLast4: kyc.pan_last4,
      aadhaarLast4: kyc.aadhaar_last4,
      bankAccountLast4: kyc.bank_account_last4,
      accountHolderName: kyc.account_holder_name,
      ifscCode: kyc.ifsc_code,
      bankBranch: kyc.bank_branch,
      bankName: kyc.bank_name,
    };
  }

  /**
   * Admin lists KYC applications with filtering and pagination
   */
  public static async listKycSubmissions(params: KycFilterParams) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (params.status && params.status !== 'ALL') {
      where.kyc_status = params.status;
    }

    if (params.startDate || params.endDate) {
      where.submitted_at = {};
      if (params.startDate) {
        where.submitted_at[Op.gte] = new Date(params.startDate);
      }
      if (params.endDate) {
        where.submitted_at[Op.lte] = new Date(params.endDate);
      }
    }

    const userWhere: any = {};
    if (params.search) {
      userWhere[Op.or] = [
        { email: { [Op.like]: `%${params.search}%` } },
        { phone: { [Op.like]: `%${params.search}%` } },
        { '$profile.full_name$': { [Op.like]: `%${params.search}%` } },
        { '$profile.referral_code$': { [Op.like]: `%${params.search}%` } },
      ];
    }

    const [allCount, pendingCount, verifiedCount, rejectedCount, resubmitCount, { count, rows }] =
      await Promise.all([
        KycProfile.count(),
        KycProfile.count({ where: { kyc_status: KycStatus.PENDING } }),
        KycProfile.count({ where: { kyc_status: KycStatus.VERIFIED } }),
        KycProfile.count({ where: { kyc_status: KycStatus.REJECTED } }),
        KycProfile.count({ where: { kyc_status: KycStatus.RESUBMISSION_REQUIRED } }),
        KycProfile.findAndCountAll({
          where,
          limit,
          offset,
          order: [['created_at', params.sortOrder === 'ASC' ? 'ASC' : 'DESC']],
          include: [
            {
              model: User,
              as: 'user',
              where: userWhere,
              attributes: ['id', 'email', 'phone', 'status', 'created_at'],
              include: [
                {
                  model: CustomerProfile,
                  as: 'profile',
                  attributes: ['full_name', 'referral_code', 'customer_id', 'city', 'state'],
                },
              ],
            },
            {
              model: User,
              as: 'reviewer',
              attributes: ['id', 'email', 'role'],
            },
          ],
        }),
      ]);

    const items = rows.map((item) => {
      const u = (item as any).user;
      const p = u?.profile;
      const r = (item as any).reviewer;

      return {
        id: item.id,
        userId: item.user_id,
        status: item.kyc_status,
        customerName: p?.full_name || 'N/A',
        email: u?.email || 'N/A',
        phone: u?.phone || 'N/A',
        referralCode: p?.referral_code || 'N/A',
        customerId: p?.customer_id || null,
        panMasked: item.pan_last4 ? maskPan(item.pan_last4) : 'N/A',
        aadhaarMasked: item.aadhaar_last4 ? maskAadhaar(item.aadhaar_last4) : 'N/A',
        bankAccountMasked: item.bank_account_last4 ? maskBankAccount(`XXXXXXXX${item.bank_account_last4}`) : 'N/A',
        accountHolderName: item.account_holder_name,
        ifscCode: item.ifsc_code,
        bankBranch: item.bank_branch,
        bankName: item.bank_name,
        submittedAt: item.submitted_at,
        reviewedAt: item.reviewed_at,
        reviewedBy: r ? { id: r.id, email: r.email, role: r.role } : null,
        rejectionReason: item.rejection_reason,
        hasPassbookDoc: Boolean(item.passbook_document),
        hasPanDoc: Boolean(item.pan_document),
        hasAadhaarDoc: Boolean(item.aadhaar_document),
        hasAadhaarBackDoc: Boolean(item.aadhaar_back_document),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      };
    });

    return {
      kycSubmissions: items,
      counts: {
        all: allCount,
        pending: pendingCount,
        verified: verifiedCount,
        rejected: rejectedCount,
        resubmission: resubmitCount,
      },
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Get complete KYC details by ID (including review audit history)
   */
  public static async getKycById(kycId: number, requestingUser?: JwtUserPayload) {
    // Managers verify payouts against the real account number; editors only see the mask
    const canSeeFullAccount = Boolean(
      requestingUser && [UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(requestingUser.role)
    );
    const kyc = await KycProfile.findByPk(kycId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'phone', 'status', 'created_at', 'last_login_at'],
          include: [
            {
              model: CustomerProfile,
              as: 'profile',
            },
          ],
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'email', 'role'],
        },
        {
          model: KycReview,
          as: 'reviews',
          include: [
            {
              model: User,
              as: 'admin',
              attributes: ['id', 'email', 'role'],
            },
          ],
          order: [['created_at', 'DESC']],
        },
      ],
    });

    if (!kyc) {
      throw new NotFoundError('KYC record not found');
    }

    const u = (kyc as any).user;
    const p = u?.profile;
    const r = (kyc as any).reviewer;
    const reviews = (kyc as any).reviews || [];

    return {
      id: kyc.id,
      userId: kyc.user_id,
      status: kyc.kyc_status,
      customer: {
        id: u?.id,
        name: p?.full_name || 'N/A',
        email: u?.email || 'N/A',
        phone: u?.phone || 'N/A',
        referralCode: p?.referral_code || 'N/A',
        customerId: p?.customer_id || null,
        referredBy: p?.referred_by || 'N/A',
        dateOfBirth: p?.date_of_birth,
        address: p?.address,
        city: p?.city,
        state: p?.state,
        pincode: p?.pincode,
        accountStatus: u?.status,
        memberSince: u?.created_at,
        lastLoginAt: u?.last_login_at,
      },
      bankDetails: {
        maskedAccountNumber: kyc.bank_account_last4 ? maskBankAccount(`XXXXXXXX${kyc.bank_account_last4}`) : 'N/A',
        accountNumber:
          canSeeFullAccount && kyc.bank_account_number_encrypted
            ? decryptData(kyc.bank_account_number_encrypted) || null
            : null,
        last4: kyc.bank_account_last4,
        accountHolderName: kyc.account_holder_name,
        ifscCode: kyc.ifsc_code,
        bankBranch: kyc.bank_branch,
        bankName: kyc.bank_name,
      },
      identityDetails: {
        maskedPan: kyc.pan_last4 ? maskPan(kyc.pan_last4) : 'N/A',
        panNumber:
          canSeeFullAccount && kyc.pan_number_encrypted
            ? decryptData(kyc.pan_number_encrypted) || null
            : null,
        panLast4: kyc.pan_last4,
        maskedAadhaar: kyc.aadhaar_last4 ? maskAadhaar(kyc.aadhaar_last4) : 'N/A',
        aadhaarNumber: canSeeFullAccount ? kyc.aadhaar_reference : null,
        aadhaarLast4: kyc.aadhaar_last4,
      },
      documents: {
        passbook: {
          available: Boolean(kyc.passbook_document),
          viewUrl: kyc.passbook_document ? `/api/admin/kyc/${kyc.id}/document/passbook` : null,
        },
        pan: {
          available: Boolean(kyc.pan_document),
          viewUrl: kyc.pan_document ? `/api/admin/kyc/${kyc.id}/document/pan` : null,
        },
        aadhaar: {
          available: Boolean(kyc.aadhaar_document),
          viewUrl: kyc.aadhaar_document ? `/api/admin/kyc/${kyc.id}/document/aadhaar` : null,
        },
        aadhaarBack: {
          available: Boolean(kyc.aadhaar_back_document),
          viewUrl: kyc.aadhaar_back_document ? `/api/admin/kyc/${kyc.id}/document/aadhaar-back` : null,
        },
      },
      reviewInfo: {
        submittedAt: kyc.submitted_at,
        reviewedAt: kyc.reviewed_at,
        reviewedBy: r ? { id: r.id, email: r.email, role: r.role } : null,
        rejectionReason: kyc.rejection_reason,
      },
      reviews: reviews.map((rev: any) => ({
        id: rev.id,
        action: rev.action,
        remarks: rev.remarks,
        createdAt: rev.created_at,
        admin: rev.admin ? { id: rev.admin.id, email: rev.admin.email, role: rev.admin.role } : null,
      })),
      createdAt: kyc.created_at,
      updatedAt: kyc.updated_at,
    };
  }

  /**
   * Admin approves/verifies KYC
   */
  public static async verifyKyc(
    kycId: number,
    adminId: number,
    input: KycVerifyInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const kyc = await KycProfile.findByPk(kycId, {
      include: [{ model: User, as: 'user', include: [{ model: CustomerProfile, as: 'profile' }] }],
    });

    if (!kyc) {
      throw new NotFoundError('KYC record not found');
    }

    if (kyc.kyc_status === KycStatus.VERIFIED) {
      throw new BadRequestError('This KYC is already verified');
    }

    kyc.kyc_status = KycStatus.VERIFIED;
    kyc.reviewed_at = new Date();
    kyc.reviewed_by = adminId;
    kyc.rejection_reason = null;
    await kyc.save();

    // The verified KYC bank account is the one withdrawals are paid to
    await BankAccountService.syncFromKyc(kyc, { verified: true });

    // Create KYC Review row
    await KycReview.create({
      kyc_id: kyc.id,
      admin_id: adminId,
      action: KycReviewAction.VERIFY,
      remarks: input.remarks || 'KYC verified by compliance officer',
    });

    // Activity Log
    await ActivityLogService.log({
      userId: adminId,
      action: 'KYC_VERIFIED',
      entity: 'KYC_PROFILE',
      entityId: kyc.id,
      description: `Admin #${adminId} approved KYC for customer #${kyc.user_id}`,
      ipAddress,
      userAgent,
    });

    // Notify user
    const u = (kyc as any).user;
    const p = u?.profile;
    if (u) {
      EmailService.sendKycStatusUpdate(u.email, p?.full_name || 'Customer', 'VERIFIED', input.remarks || undefined).catch(() => {});
    }
    await NotificationService.notify({
      userId: kyc.user_id,
      type: NotificationType.KYC_VERIFIED,
      title: 'KYC verified',
      message: 'Your KYC has been verified. You can now invest in plans and withdraw money to your verified bank account.',
      relatedEntity: 'KYC_PROFILE',
      relatedId: kyc.id,
    });

    return {
      id: kyc.id,
      status: kyc.kyc_status,
      reviewedAt: kyc.reviewed_at,
      reviewedBy: adminId,
    };
  }

  /**
   * Admin rejects KYC
   */
  public static async rejectKyc(
    kycId: number,
    adminId: number,
    input: KycRejectInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const kyc = await KycProfile.findByPk(kycId, {
      include: [{ model: User, as: 'user', include: [{ model: CustomerProfile, as: 'profile' }] }],
    });

    if (!kyc) {
      throw new NotFoundError('KYC record not found');
    }

    kyc.kyc_status = KycStatus.REJECTED;
    kyc.reviewed_at = new Date();
    kyc.reviewed_by = adminId;
    kyc.rejection_reason = input.rejectionReason;
    await kyc.save();

    // Create KYC Review row
    await KycReview.create({
      kyc_id: kyc.id,
      admin_id: adminId,
      action: KycReviewAction.REJECT,
      remarks: input.remarks || input.rejectionReason,
    });

    // Activity Log
    await ActivityLogService.log({
      userId: adminId,
      action: 'KYC_REJECTED',
      entity: 'KYC_PROFILE',
      entityId: kyc.id,
      description: `Admin #${adminId} rejected KYC for customer #${kyc.user_id}. Reason: ${input.rejectionReason}`,
      ipAddress,
      userAgent,
    });

    // Notify user
    const u = (kyc as any).user;
    const p = u?.profile;
    if (u) {
      EmailService.sendKycStatusUpdate(u.email, p?.full_name || 'Customer', 'REJECTED', input.rejectionReason).catch(() => {});
    }
    await NotificationService.notify({
      userId: kyc.user_id,
      type: NotificationType.KYC_REJECTED,
      title: 'KYC rejected',
      message: `Your KYC was rejected. Reason: ${input.rejectionReason}. Please correct the details and submit your KYC again.`,
      relatedEntity: 'KYC_PROFILE',
      relatedId: kyc.id,
    });

    return {
      id: kyc.id,
      status: kyc.kyc_status,
      reviewedAt: kyc.reviewed_at,
      reviewedBy: adminId,
      rejectionReason: kyc.rejection_reason,
    };
  }

  /**
   * Admin requests resubmission
   */
  public static async requestResubmission(
    kycId: number,
    adminId: number,
    input: KycResubmitInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const kyc = await KycProfile.findByPk(kycId, {
      include: [{ model: User, as: 'user', include: [{ model: CustomerProfile, as: 'profile' }] }],
    });

    if (!kyc) {
      throw new NotFoundError('KYC record not found');
    }

    kyc.kyc_status = KycStatus.RESUBMISSION_REQUIRED;
    kyc.reviewed_at = new Date();
    kyc.reviewed_by = adminId;
    kyc.rejection_reason = input.remarks;
    await kyc.save();

    // Create KYC Review row
    await KycReview.create({
      kyc_id: kyc.id,
      admin_id: adminId,
      action: KycReviewAction.REQUEST_RESUBMISSION,
      remarks: input.remarks,
    });

    // Activity Log
    await ActivityLogService.log({
      userId: adminId,
      action: 'KYC_RESUBMISSION_REQUESTED',
      entity: 'KYC_PROFILE',
      entityId: kyc.id,
      description: `Admin #${adminId} requested KYC resubmission for customer #${kyc.user_id}. Remarks: ${input.remarks}`,
      ipAddress,
      userAgent,
    });

    // Notify user
    const u = (kyc as any).user;
    const p = u?.profile;
    if (u) {
      EmailService.sendKycStatusUpdate(u.email, p?.full_name || 'Customer', 'RESUBMISSION_REQUIRED', input.remarks).catch(() => {});
    }
    await NotificationService.notify({
      userId: kyc.user_id,
      type: NotificationType.KYC_RESUBMISSION_REQUIRED,
      title: 'KYC needs resubmission',
      message: `Our team needs you to resubmit your KYC. Remarks: ${input.remarks}`,
      relatedEntity: 'KYC_PROFILE',
      relatedId: kyc.id,
    });

    return {
      id: kyc.id,
      status: kyc.kyc_status,
      reviewedAt: kyc.reviewed_at,
      reviewedBy: adminId,
      rejectionReason: kyc.rejection_reason,
    };
  }

  /**
   * Streams secure document file with authentication & role authorization checks
   */
  public static async getSecureDocument(
    kycId: number,
    documentType: 'passbook' | 'pan' | 'aadhaar' | 'aadhaar-back',
    requestingUser: { id: number; role: UserRole }
  ) {
    const kyc = await KycProfile.findByPk(kycId);
    if (!kyc) {
      throw new NotFoundError('KYC record not found');
    }

    // Role check: Customers can only access their own KYC files; Admins/Super Admins/Editors can view
    if (requestingUser.role === UserRole.CUSTOMER && kyc.user_id !== requestingUser.id) {
      throw new ForbiddenError('You are not authorized to view this document');
    }

    let fileName: string | null = null;
    if (documentType === 'passbook') fileName = kyc.passbook_document;
    else if (documentType === 'pan') fileName = kyc.pan_document;
    else if (documentType === 'aadhaar') fileName = kyc.aadhaar_document;
    else if (documentType === 'aadhaar-back') fileName = kyc.aadhaar_back_document;
    else throw new BadRequestError('Invalid document type requested');

    if (!fileName) {
      throw new NotFoundError(`No ${documentType} document has been uploaded for this customer`);
    }

    return await FileService.getSecureFile(fileName);
  }
}
