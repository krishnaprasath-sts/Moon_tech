import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User, CustomerProfile, KycProfile, Referral, ActivityLog, Investment } from '../models/index.js';
import { CustomerFilterParams, UserRole, UserStatus, KycStatus, ReferralStatus, InvestmentStatus } from '../types/index.js';
import { toPaise, fromPaise } from '../utils/money.js';
import { maskPan, maskAadhaar, maskBankAccount } from '../utils/mask.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { ActivityLogService } from './activityLogService.js';
import { AuthService } from './authService.js';
import { CreateCustomerInput } from '../validators/authValidators.js';

export class CustomerService {
  /**
   * Admin lists all customers with search, filter, and pagination
   */
  public static async listCustomers(params: CustomerFilterParams) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const offset = (page - 1) * limit;

    const userWhere: any = {
      role: UserRole.CUSTOMER,
    };

    if (params.status) {
      userWhere.status = params.status;
    }

    if (params.search) {
      userWhere[Op.or] = [
        { email: { [Op.like]: `%${params.search}%` } },
        { phone: { [Op.like]: `%${params.search}%` } },
        { '$profile.full_name$': { [Op.like]: `%${params.search}%` } },
        { '$profile.referral_code$': { [Op.like]: `%${params.search}%` } },
      ];
    }

    const kycWhere: any = {};
    if (params.kycStatus) {
      kycWhere.kyc_status = params.kycStatus;
    }

    const { count, rows } = await User.findAndCountAll({
      where: userWhere,
      limit,
      offset,
      order: [['created_at', params.sortOrder === 'ASC' ? 'ASC' : 'DESC']],
      attributes: ['id', 'email', 'phone', 'role', 'status', 'last_login_at', 'created_at', 'updated_at'],
      include: [
        {
          model: CustomerProfile,
          as: 'profile',
          attributes: ['full_name', 'referral_code', 'referred_by', 'city', 'state'],
        },
        {
          model: KycProfile,
          as: 'kyc',
          where: Object.keys(kycWhere).length > 0 ? kycWhere : undefined,
          required: Object.keys(kycWhere).length > 0,
          attributes: ['id', 'kyc_status', 'submitted_at', 'reviewed_at'],
        },
      ],
    });

    const investments = rows.length
      ? await Investment.findAll({
          where: { user_id: { [Op.in]: rows.map((u) => u.id) } },
          attributes: ['user_id', 'amount', 'status'],
        })
      : [];

    const customers = rows.map((u) => {
      const p = (u as any).profile;
      const k = (u as any).kyc;
      const userInvestments = investments.filter((i) => i.user_id === u.id);
      const activeInvestments = userInvestments.filter((i) => i.status === InvestmentStatus.ACTIVE);

      return {
        id: u.id,
        email: u.email,
        phone: u.phone,
        fullName: p?.full_name || 'N/A',
        referralCode: p?.referral_code || 'N/A',
        referredBy: p?.referred_by || null,
        city: p?.city || null,
        state: p?.state || null,
        accountStatus: u.status,
        kycId: k?.id || null,
        kycStatus: k?.kyc_status || KycStatus.DRAFT,
        kycSubmittedAt: k?.submitted_at || null,
        investmentsCount: userInvestments.length,
        activeInvestmentsCount: activeInvestments.length,
        activeInvestedAmount: fromPaise(activeInvestments.reduce((acc, i) => acc + toPaise(i.amount), 0)),
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
      };
    });

    return {
      customers,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Get single customer 360 profile
   */
  public static async getCustomerById(customerId: number) {
    const user = await User.findOne({
      where: { id: customerId, role: UserRole.CUSTOMER },
      attributes: ['id', 'email', 'phone', 'role', 'status', 'last_login_at', 'created_at', 'updated_at'],
      include: [
        {
          model: CustomerProfile,
          as: 'profile',
        },
        {
          model: KycProfile,
          as: 'kyc',
        },
        {
          model: Referral,
          as: 'referralsGiven',
          include: [
            {
              model: User,
              as: 'referred',
              attributes: ['id', 'email', 'phone', 'created_at'],
              include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
            },
          ],
        },
      ],
    });

    if (!user) {
      throw new NotFoundError('Customer not found');
    }

    const p = (user as any).profile;
    const k = (user as any).kyc;
    const referrals = (user as any).referralsGiven || [];

    // Get recent activity logs for this user
    const recentLogs = await ActivityLog.findAll({
      where: { user_id: user.id },
      limit: 10,
      order: [['created_at', 'DESC']],
    });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      role: user.role,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      profile: p
        ? {
            fullName: p.full_name,
            referralCode: p.referral_code,
            referredBy: p.referred_by,
            dateOfBirth: p.date_of_birth,
            address: p.address,
            city: p.city,
            state: p.state,
            pincode: p.pincode,
          }
        : null,
      kyc: k
        ? {
            id: k.id,
            status: k.kyc_status,
            panMasked: k.pan_last4 ? maskPan(k.pan_last4) : 'N/A',
            aadhaarMasked: k.aadhaar_last4 ? maskAadhaar(k.aadhaar_last4) : 'N/A',
            bankAccountMasked: k.bank_account_last4 ? maskBankAccount(k.bank_account_last4) : 'N/A',
            accountHolderName: k.account_holder_name,
            ifscCode: k.ifsc_code,
            submittedAt: k.submitted_at,
            reviewedAt: k.reviewed_at,
            rejectionReason: k.rejection_reason,
            hasPassbookDoc: Boolean(k.passbook_document),
            hasPanDoc: Boolean(k.pan_document),
            hasAadhaarDoc: Boolean(k.aadhaar_document),
          }
        : null,
      referrals: {
        totalReferrals: referrals.length,
        items: referrals.map((r: any) => ({
          id: r.id,
          referredUserId: r.referred_user_id,
          name: r.referred?.profile?.full_name || 'N/A',
          email: r.referred?.email || 'N/A',
          phone: r.referred?.phone || 'N/A',
          status: r.status,
          createdAt: r.created_at,
        })),
      },
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        action: l.action,
        description: l.description,
        ipAddress: l.ip_address,
        createdAt: l.created_at,
      })),
    };
  }

  /**
   * Manually create a customer (Admin action)
   */
  public static async createCustomer(
    input: CreateCustomerInput,
    adminId: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const { name, email, phone, password, referralNumber, dateOfBirth, address, city, state, pincode } = input;

    // Check duplicate email
    const existingEmail = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existingEmail) {
      throw new ConflictError('An account with this email already exists');
    }

    // Check duplicate phone
    const existingPhone = await User.findOne({ where: { phone: phone.trim() } });
    if (existingPhone) {
      throw new ConflictError('An account with this phone number already exists');
    }

    // Check referrer if provided
    let referrerUser: User | null = null;
    if (referralNumber) {
      const referrerProfile = await CustomerProfile.findOne({
        where: { referral_code: referralNumber.toUpperCase().trim() },
      });
      if (referrerProfile) {
        referrerUser = await User.findByPk(referrerProfile.user_id);
      }
    }

    // Password
    const finalPassword = password && password.trim().length >= 6 ? password.trim() : 'Moon@123456';
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(finalPassword, salt);

    // Generate unique referral code
    const referral_code = await AuthService.generateUniqueReferralCode(name);

    // Create User
    const user = await User.create({
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password_hash,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });

    // Create Profile
    const profile = await CustomerProfile.create({
      user_id: user.id,
      full_name: name.trim(),
      referral_code,
      referred_by: referralNumber ? referralNumber.toUpperCase().trim() : null,
      date_of_birth: dateOfBirth || null,
      address: address || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
    });

    // Create default KYC record
    const kyc = await KycProfile.create({
      user_id: user.id,
      kyc_status: KycStatus.DRAFT,
    });

    // Record referral link if applicable
    if (referrerUser) {
      await Referral.create({
        referrer_user_id: referrerUser.id,
        referred_user_id: user.id,
        referral_code: referralNumber!.toUpperCase().trim(),
        status: ReferralStatus.ACTIVE,
      });
    }

    // Audit Log
    await ActivityLogService.log({
      userId: adminId,
      action: 'CUSTOMER_MANUALLY_CREATED',
      entity: 'USER',
      entityId: user.id,
      description: `Admin #${adminId} manually registered customer: ${name} (${email})`,
      ipAddress,
      userAgent,
    });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: profile.full_name,
      referralCode: profile.referral_code,
      referredBy: profile.referred_by,
      status: user.status,
      kycStatus: kyc.kyc_status,
      createdAt: user.created_at,
    };
  }

  /**
   * Update customer account status (Activate / Suspend)
   */
  public static async updateCustomerStatus(
    customerId: number,
    status: UserStatus,
    adminId: number,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await User.findOne({
      where: { id: customerId, role: UserRole.CUSTOMER },
    });

    if (!user) {
      throw new NotFoundError('Customer not found');
    }

    const previousStatus = user.status;
    user.status = status;
    await user.save();

    // Audit log
    await ActivityLogService.log({
      userId: adminId,
      action: 'CUSTOMER_STATUS_UPDATED',
      entity: 'USER',
      entityId: user.id,
      description: `Admin #${adminId} changed customer #${user.id} status from ${previousStatus} to ${status}${
        reason ? `. Reason: ${reason}` : ''
      }`,
      ipAddress,
      userAgent,
    });

    return {
      id: user.id,
      status: user.status,
      previousStatus,
    };
  }
}
