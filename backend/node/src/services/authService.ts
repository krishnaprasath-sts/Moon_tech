import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { config } from '../config/index.js';
import { sequelize, User, CustomerProfile, KycProfile, Referral, LoginOtp } from '../models/index.js';
import { UserRole, UserStatus, KycStatus, ReferralStatus, JwtUserPayload } from '../types/index.js';
import { ConflictError, UnauthorizedError, BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { RegisterInput, LoginInput, LoginOtpVerifyInput, LoginOtpResendInput } from '../validators/authValidators.js';
import { ActivityLogService } from './activityLogService.js';
import { logger } from '../utils/logger.js';
import { EmailService } from './emailService.js';

/** Customer login code: valid for 2 minutes, 5 attempts, new code no sooner than 30 s, session abandoned after 15 min */
const LOGIN_OTP_EXPIRY_SECONDS = 120;
/** How long the sign-in request waits for the code email before answering anyway */
const LOGIN_OTP_SEND_WAIT_MS = 2000;
const LOGIN_OTP_MAX_ATTEMPTS = 5;
const LOGIN_OTP_RESEND_COOLDOWN_SECONDS = 30;
const LOGIN_OTP_SESSION_MINUTES = 15;

/** r***@example.com, so the login screen can say where the code went without revealing the address */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.min(6, Math.max(3, local.length - visible.length)))}@${domain}`;
}

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
      // Cryptographically random digits: codes are not guessable from the user id or the clock
      const randomDigits = crypto.randomInt(1000, 10000);
      referralCode = `${prefix}${randomDigits}`;
      const existing = await CustomerProfile.findOne({ where: { referral_code: referralCode } });
      if (!existing) {
        isUnique = true;
      }
    }

    return referralCode;
  }

  /**
   * Resolves a referral code to the customer who owns it. Throws a field error when the code
   * is unknown or its owner is not an active customer (suspended / inactive accounts cannot
   * refer). Returns null when no code was given.
   */
  public static async resolveReferrer(referralNumber: string | null | undefined): Promise<User | null> {
    if (!referralNumber) return null;
    const code = referralNumber.toUpperCase().trim();
    const referrerProfile = await CustomerProfile.findOne({ where: { referral_code: code } });
    const referrerUser = referrerProfile ? await User.findByPk(referrerProfile.user_id) : null;
    if (!referrerUser || referrerUser.role !== UserRole.CUSTOMER) {
      throw new BadRequestError(`Referral code ${code} does not belong to any member`);
    }
    if (referrerUser.status !== UserStatus.ACTIVE) {
      throw new BadRequestError(`Referral code ${code} is not active right now. Please ask for another code.`);
    }
    return referrerUser;
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

    // The referral code must belong to an existing, active customer. An unknown code is a
    // typo, not something to store silently; a suspended referrer cannot bring in new members.
    const referrerUser = await this.resolveReferrer(referralNumber);

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Generate referral code
    const referral_code = await this.generateUniqueReferralCode(name);

    // User, profile, KYC record and referral link are created together or not at all
    const { user, profile, kyc } = await sequelize.transaction(async (t) => {
      const createdUser = await User.create(
        {
          email: email.toLowerCase(),
          phone,
          password_hash,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
        { transaction: t }
      );

      const createdProfile = await CustomerProfile.create(
        {
          user_id: createdUser.id,
          full_name: name.trim(),
          referral_code,
          referred_by: referrerUser ? referralNumber!.toUpperCase().trim() : null,
        },
        { transaction: t }
      );

      const createdKyc = await KycProfile.create(
        {
          user_id: createdUser.id,
          kyc_status: KycStatus.DRAFT,
        },
        { transaction: t }
      );

      if (referrerUser) {
        await Referral.create(
          {
            referrer_user_id: referrerUser.id,
            referred_user_id: createdUser.id,
            referral_code: referralNumber!.toUpperCase().trim(),
            status: ReferralStatus.ACTIVE,
          },
          { transaction: t }
        );
      }

      return { user: createdUser, profile: createdProfile, kyc: createdKyc };
    });

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

    // Customers confirm every sign-in with a code emailed to them; staff sign in with the password alone
    if (user.role === UserRole.CUSTOMER) {
      return this.startOtpChallenge(user, ipAddress, userAgent);
    }

    return this.completeLogin(user, ipAddress, userAgent);
  }

  /** Issues the session once the user is fully authenticated */
  private static async completeLogin(user: User, ipAddress?: string, userAgent?: string) {
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

  /** Email a 6-digit code and return the challenge the browser must answer within the expiry */
  private static async startOtpChallenge(user: User, ipAddress?: string, userAgent?: string) {
    // Any earlier pending code for this account stops working
    await LoginOtp.update({ used_at: new Date() }, { where: { user_id: user.id, used_at: null } });

    const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    const challenge = await LoginOtp.create({
      user_id: user.id,
      token: crypto.randomBytes(24).toString('hex'),
      otp_hash: await bcrypt.hash(otp, 10),
      expires_at: new Date(Date.now() + LOGIN_OTP_EXPIRY_SECONDS * 1000),
    });

    const profile = (user as any).profile;
    const sending = EmailService.sendLoginOtp(user.email, profile?.full_name || 'Member', otp, LOGIN_OTP_EXPIRY_SECONDS)
      .then(() => true)
      .catch((err: Error) => {
        logger.error(`[AUTH] Login code email to ${user.email} failed: ${err.message}`);
        return false;
      });
    // Wait briefly so an immediate SMTP failure still reaches the customer; a slow but
    // healthy mail server does not hold up the response (the code arrives moments later).
    const sentInTime = await Promise.race([sending, new Promise<null>((resolve) => setTimeout(() => resolve(null), LOGIN_OTP_SEND_WAIT_MS))]);
    if (sentInTime === false) {
      throw new Error('We could not send the verification email. Please try again in a moment.');
    }
    if (config.isDev) logger.info(`[DEV] Login code for ${user.email}: ${otp}`);

    await ActivityLogService.log({
      userId: user.id,
      action: 'USER_LOGIN_OTP_SENT',
      entity: 'USER',
      entityId: user.id,
      description: `Login verification code emailed to ${user.email}`,
      ipAddress,
      userAgent,
    });

    return {
      otpRequired: true as const,
      challengeId: challenge.token,
      email: maskEmail(user.email),
      expiresAt: challenge.expires_at.toISOString(),
      expiresInSeconds: LOGIN_OTP_EXPIRY_SECONDS,
      resendAfterSeconds: LOGIN_OTP_RESEND_COOLDOWN_SECONDS,
      // Local development without a mailbox: the code is shown so the flow can be tested
      ...(config.isDev && !config.smtp.user ? { devOtp: otp } : {}),
    };
  }

  /** Step 2 of the customer login: check the emailed code and issue the session */
  public static async verifyLoginOtp(input: LoginOtpVerifyInput, ipAddress?: string, userAgent?: string) {
    const challenge = await LoginOtp.findOne({ where: { token: input.challengeId } });
    if (!challenge || challenge.used_at) {
      throw new UnauthorizedError('This login code is no longer valid. Please sign in again.');
    }
    if (challenge.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedError('The code has expired. Request a new code to continue.');
    }
    if (challenge.attempts >= LOGIN_OTP_MAX_ATTEMPTS) {
      challenge.used_at = new Date();
      await challenge.save();
      throw new UnauthorizedError('Too many incorrect codes. Please sign in again to get a new code.');
    }

    const matches = await bcrypt.compare(input.otp, challenge.otp_hash);
    if (!matches) {
      challenge.attempts += 1;
      await challenge.save();
      const left = LOGIN_OTP_MAX_ATTEMPTS - challenge.attempts;
      throw new UnauthorizedError(
        left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many incorrect codes. Please sign in again to get a new code.'
      );
    }

    const user = await User.findByPk(challenge.user_id, {
      include: [
        { model: CustomerProfile, as: 'profile' },
        { model: KycProfile, as: 'kyc' },
      ],
    });
    if (!user) throw new UnauthorizedError('Account not found. Please sign in again.');
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Your account has been suspended. Please contact administrator.');
    }
    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenError('Your account is currently inactive.');
    }

    // Consumed: delete it so the code (and its challenge id) can never be replayed or resent
    await challenge.destroy();

    return this.completeLogin(user, ipAddress, userAgent);
  }

  /** Sends a fresh code for a pending challenge (after the resend cooldown) */
  public static async resendLoginOtp(input: LoginOtpResendInput, ipAddress?: string, userAgent?: string) {
    const previous = await LoginOtp.findOne({ where: { token: input.challengeId } });
    if (!previous) throw new UnauthorizedError('This login session has ended. Please sign in again.');

    const ageMs = Date.now() - new Date(previous.created_at).getTime();
    if (ageMs > LOGIN_OTP_SESSION_MINUTES * 60 * 1000) {
      throw new UnauthorizedError('This login session has ended. Please sign in again.');
    }
    if (ageMs < LOGIN_OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      const wait = Math.ceil((LOGIN_OTP_RESEND_COOLDOWN_SECONDS * 1000 - ageMs) / 1000);
      throw new BadRequestError(`Please wait ${wait} second${wait === 1 ? '' : 's'} before requesting another code.`);
    }
    // (A challenge that was answered correctly is deleted, so it can never reach this point.)

    const user = await User.findByPk(previous.user_id, {
      include: [{ model: CustomerProfile, as: 'profile' }],
    });
    if (!user || user.role !== UserRole.CUSTOMER) {
      throw new UnauthorizedError('This login session has ended. Please sign in again.');
    }
    return this.startOtpChallenge(user, ipAddress, userAgent);
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
