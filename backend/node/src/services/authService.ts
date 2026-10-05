import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { config } from '../config/index.js';
import { User, CustomerProfile, KycProfile, Referral } from '../models/index.js';
import { UserRole, UserStatus, KycStatus, ReferralStatus, JwtUserPayload } from '../types/index.js';
import { ConflictError, UnauthorizedError, BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { RegisterInput, LoginInput } from '../validators/authValidators.js';
import { ActivityLogService } from './activityLogService.js';
import { EmailService } from './emailService.js';

export class AuthService {
  /**
   * Generates a unique referral code based on user's name
   */
  public static async generateUniqueReferralCode(name: string): Promise<string> {
    const prefix = name
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 4)
      .toUpperCase()
      .padEnd(4, 'MOON');
    
    let isUnique = false;
    let referralCode = '';

    while (!isUnique) {
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      referralCode = `${prefix}${randomDigits}`;
      const existing = await CustomerProfile.findOne({ where: { referral_code: referralCode } });
      if (!existing) {
        isUnique = true;
      }
    }

    return referralCode;
  }

  /**
   * Generates Access and Refresh JWT Tokens
   */
  public static generateTokens(user: { id: number; email: string; role: UserRole; status: UserStatus }) {
    const payload: JwtUserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn as any,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Register a new customer
   */
  public static async register(
    input: RegisterInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const { name, email, phone, password, referralNumber } = input;

    // Check duplicate email
    const existingEmail = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingEmail) {
      throw new ConflictError('An account with this email already exists');
    }

    // Check duplicate phone
    const existingPhone = await User.findOne({ where: { phone } });
    if (existingPhone) {
      throw new ConflictError('An account with this phone number already exists');
    }

    // Check referral number if provided
    let referrerUser: User | null = null;
    if (referralNumber) {
      const referrerProfile = await CustomerProfile.findOne({
        where: { referral_code: referralNumber.toUpperCase().trim() },
      });
      if (referrerProfile) {
        referrerUser = await User.findByPk(referrerProfile.user_id);
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Generate referral code
    const referral_code = await this.generateUniqueReferralCode(name);

    // Create User
    const user = await User.create({
      email: email.toLowerCase(),
      phone,
      password_hash,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });

    // Create Customer Profile
    const profile = await CustomerProfile.create({
      user_id: user.id,
      full_name: name.trim(),
      referral_code,
      referred_by: referralNumber ? referralNumber.toUpperCase().trim() : null,
    });

    // Create default KYC record
    const kyc = await KycProfile.create({
      user_id: user.id,
      kyc_status: KycStatus.DRAFT,
    });

    // Create Referral relationship if referrer found
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
      userId: user.id,
      action: 'CUSTOMER_REGISTERED',
      entity: 'USER',
      entityId: user.id,
      description: `New customer registered: ${name} (${email})`,
      ipAddress,
      userAgent,
    });

    // Welcome email
    EmailService.sendWelcomeEmail(user.email, profile.full_name, profile.referral_code).catch(() => {});

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        fullName: profile.full_name,
        referralCode: profile.referral_code,
        kycStatus: kyc.kyc_status,
        canAccessInvestments: false,
      },
      ...tokens,
    };
  }

  /**
   * Log in user (Customer, Admin, Super Admin, Editor)
   */
  public static async login(
    input: LoginInput,
    ipAddress?: string,
    userAgent?: string
  ) {
    const { email, password } = input;
    const cleanIdentifier = email.trim().toLowerCase();

    // Find by email or phone
    const user = await User.findOne({
      where: {
        [Op.or]: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
      },
      include: [
        { model: CustomerProfile, as: 'profile' },
        { model: KycProfile, as: 'kyc' },
      ],
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email/phone or password');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email/phone or password');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Your account has been suspended. Please contact administrator.');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenError('Your account is currently inactive.');
    }

    // Update last login
    user.last_login_at = new Date();
    await user.save();

    // Audit Log
    await ActivityLogService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'USER',
      entityId: user.id,
      description: `User logged in: ${user.email} (${user.role})`,
      ipAddress,
      userAgent,
    });

    const tokens = this.generateTokens(user);

    const profile = (user as any).profile;
    const kyc = (user as any).kyc;

    const kycStatus = kyc ? kyc.kyc_status : KycStatus.DRAFT;
    const canAccessInvestments = user.status === UserStatus.ACTIVE && kycStatus === KycStatus.VERIFIED;

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        lastLoginAt: user.last_login_at,
        fullName: profile ? profile.full_name : (user.role === UserRole.SUPER_ADMIN ? 'Super Admin' : user.role),
        referralCode: profile ? profile.referral_code : null,
        kycStatus,
        canAccessInvestments,
      },
      ...tokens,
    };
  }

  /**
   * Get current authenticated user details
   */
  public static async getCurrentUser(userId: number) {
    const user = await User.findByPk(userId, {
      include: [
        { model: CustomerProfile, as: 'profile' },
        { model: KycProfile, as: 'kyc' },
      ],
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const profile = (user as any).profile;
    const kyc = (user as any).kyc;
    const kycStatus = kyc ? kyc.kyc_status : KycStatus.DRAFT;
    const canAccessInvestments = user.status === UserStatus.ACTIVE && kycStatus === KycStatus.VERIFIED;

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      fullName: profile ? profile.full_name : (user.role === UserRole.SUPER_ADMIN ? 'Super Admin' : user.role),
      referralCode: profile ? profile.referral_code : null,
      referredBy: profile ? profile.referred_by : null,
      address: profile ? profile.address : null,
      city: profile ? profile.city : null,
      state: profile ? profile.state : null,
      pincode: profile ? profile.pincode : null,
      dateOfBirth: profile ? profile.date_of_birth : null,
      kycStatus,
      canAccessInvestments,
      kyc: kyc
        ? {
            id: kyc.id,
            status: kyc.kyc_status,
            panLast4: kyc.pan_last4,
            aadhaarLast4: kyc.aadhaar_last4,
            bankAccountLast4: kyc.bank_account_last4,
            accountHolderName: kyc.account_holder_name,
            ifscCode: kyc.ifsc_code,
            submittedAt: kyc.submitted_at,
            reviewedAt: kyc.reviewed_at,
            rejectionReason: kyc.rejection_reason,
            hasPassbook: Boolean(kyc.passbook_document),
            hasPan: Boolean(kyc.pan_document),
            hasAadhaar: Boolean(kyc.aadhaar_document),
          }
        : null,
    };
  }
}
