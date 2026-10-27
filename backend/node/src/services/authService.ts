import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { config } from '../config/index.js';
import { sequelize, User, CustomerProfile, KycProfile, Referral, LoginOtp, EmailVerification } from '../models/index.js';
import { UserRole, UserStatus, KycStatus, ReferralStatus, JwtUserPayload } from '../types/index.js';
import { ConflictError, UnauthorizedError, BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { customerIdFor } from '../utils/customerId.js';
import { SettingsService } from './settingsService.js';
import {
  RegisterInput,
  LoginInput,
  LoginOtpVerifyInput,
  LoginOtpResendInput,
  VerifyEmailInput,
  ResendVerificationInput,
} from '../validators/authValidators.js';
import { ActivityLogService } from './activityLogService.js';
import { logger } from '../utils/logger.js';
import { EmailService } from './emailService.js';

/** Customer login code: valid for 2 minutes, 5 attempts, new code no sooner than 30 s, session abandoned after 15 min */
const LOGIN_OTP_EXPIRY_SECONDS = 120;
/** How long the pass from the verification link lets the first sign-in skip the login code */
const FIRST_LOGIN_PASS_TTL = '24h';
/** How long the sign-in request waits for the code email before answering anyway */
const LOGIN_OTP_SEND_WAIT_MS = 2000;
const LOGIN_OTP_MAX_ATTEMPTS = 5;
const LOGIN_OTP_RESEND_COOLDOWN_SECONDS = 30;
const LOGIN_OTP_SESSION_MINUTES = 15;

/** r***@example.com, so the login screen can say where the code went without revealing the address */
/** te***08@gmail.com: the start and end of the name stay visible so customers recognise their address */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  // Show 2 + 2 characters for longer names, 1 + 1 for short ones, and only the first for 1-2 letters
  const edge = local.length >= 6 ? 2 : local.length >= 3 ? 1 : 0;
  const start = edge ? local.slice(0, edge) : local.slice(0, 1);
  const end = edge ? local.slice(-edge) : '';
  return `${start}***${end}@${domain}`;
}

/** Verification links stay valid this long; a new link can be requested after the cooldown */
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

export class AuthService {
  /**
   * Generates a unique referral code based on user's name
   */
  public static async generateUniqueReferralCode(name: string): Promise<string> {
    const prefix = name
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 4)
      .toUpperCase()
      .padEnd(4, 'CLYV');
    
    let isUnique = false;
    let referralCode = '';

    while (!isUnique) {
      // Cryptographically random digits: codes are not guessable from the user id or the clock
      const randomDigits = crypto.randomInt(1000, 10000);
      referralCode = `${prefix}${randomDigits}`;
      const existing = await CustomerProfile.findOne({ where: { referral_code: referralCode } });
      // Never hand out the company's own starting code
      const { companyReferralCode } = await SettingsService.getSettings();
      if (!existing && referralCode !== companyReferralCode) {
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
  /**
   * Every spelling under which an Indian mobile number may be stored: as typed, and (for a
   * valid 10-digit number) bare, with +91, with 91 and with a leading 0. Registration now
   * saves numbers as +91XXXXXXXXXX while older accounts hold the bare 10 digits.
   */
  public static phoneVariants(raw: string): string[] {
    const typed = String(raw || '').replace(/[\s-]/g, '');
    const variants = new Set<string>([typed]);
    const match = typed.match(/^(?:\+?91|0)?([6-9][0-9]{9})$/);
    if (match) {
      const ten = match[1];
      ['', '+91', '91', '0'].forEach((prefix) => variants.add(`${prefix}${ten}`));
    }
    return [...variants];
  }

  public static async resolveReferrer(referralNumber: string | null | undefined): Promise<User | null> {
    if (!referralNumber) return null;
    const code = referralNumber.toUpperCase().trim();
    // The company code lets the very first customers register; nobody earns commission on it
    const { companyReferralCode } = await SettingsService.getSettings();
    if (companyReferralCode && code === companyReferralCode) return null;
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

  /** 403 with a field marker the sign-in page uses to offer "resend the link" */
  private static emailNotVerifiedError(): ForbiddenError {
    const err = new ForbiddenError('Please verify your email address first. We sent you a link when you registered; you can request a new one below.');
    (err as any).errors = [{ field: 'emailVerification', message: 'EMAIL_NOT_VERIFIED' }];
    return err;
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

    // No new accounts while the platform is under maintenance
    await SettingsService.assertCustomerAccessOpen();

    // Check duplicate email
    const existingEmail = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingEmail) {
      throw new ConflictError('An account with this email already exists');
    }

    // Check duplicate phone (the same number may be stored with or without the +91 prefix)
    const existingPhone = await User.findOne({ where: { phone: { [Op.in]: this.phoneVariants(phone) } } });
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
          // Activated by the verification link emailed below
          status: UserStatus.PENDING_VERIFICATION,
        },
        { transaction: t }
      );

      const createdProfile = await CustomerProfile.create(
        {
          user_id: createdUser.id,
          full_name: name.trim(),
          referral_code,
          customer_id: customerIdFor(createdUser.id),
          // The code used to join: a member's code, or the company's starting code
          referred_by: referralNumber ? referralNumber.toUpperCase().trim() : null,
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

    // Verification link (the welcome email follows once the address is confirmed)
    await this.issueEmailVerification(user, profile.full_name);

    // No session yet: the account is activated by the verification link
    return {
      verificationRequired: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        fullName: profile.full_name,
        referralCode: profile.referral_code,
        customerId: profile.customer_id,
        kycStatus: kyc.kyc_status,
        canAccessInvestments: false,
      },
    };
  }

  /** Creates a fresh verification token for the user and emails the link; older links stop working */
  private static async issueEmailVerification(user: User, name: string): Promise<void> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

    await EmailVerification.update({ used_at: new Date() }, { where: { user_id: user.id, used_at: null } });
    await EmailVerification.create({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt });

    const verifyUrl = `${config.frontendUrl.replace(/\/+$/, '')}/verify-email?token=${rawToken}`;
    try {
      await EmailService.sendVerificationEmail(user.email, name, verifyUrl, EMAIL_VERIFICATION_EXPIRY_HOURS);
    } catch (err) {
      logger.error(`Failed to send the verification email to ${user.email}`, err);
      throw new Error('We could not send the verification email. Please try again in a moment.');
    }
  }

  /** Activates the account behind a verification link */
  public static async verifyEmail(input: VerifyEmailInput, ipAddress?: string, userAgent?: string) {
    const tokenHash = crypto.createHash('sha256').update(input.token.trim()).digest('hex');
    const record = await EmailVerification.findOne({ where: { token_hash: tokenHash } });
    if (!record || record.used_at) {
      throw new BadRequestError('This verification link is not valid any more. Request a new one from the sign-in page.');
    }
    if (record.expires_at.getTime() < Date.now()) {
      throw new BadRequestError('This verification link has expired. Request a new one from the sign-in page.');
    }

    const user = await User.findByPk(record.user_id, { include: [{ model: CustomerProfile, as: 'profile' }] });
    if (!user) throw new BadRequestError('Account not found. Please register again.');

    record.used_at = new Date();
    await record.save();

    const alreadyActive = user.status !== UserStatus.PENDING_VERIFICATION;
    if (!alreadyActive) {
      user.status = UserStatus.ACTIVE;
      await user.save();

      await ActivityLogService.log({
        userId: user.id,
        action: 'EMAIL_VERIFIED',
        entity: 'USER',
        entityId: user.id,
        description: `Customer verified email address: ${user.email}`,
        ipAddress,
        userAgent,
      });

      const profile = (user as any).profile as CustomerProfile | null;
      if (profile) {
        EmailService.sendWelcomeEmail(user.email, profile.full_name, profile.referral_code).catch(() => {});
      }
    }

    // Opening the link proved the customer owns this mailbox, so their first sign-in from this
    // browser does not need a second emailed code. Every later sign-in still asks for one.
    const firstLoginToken =
      !alreadyActive && !user.last_login_at
        ? jwt.sign({ purpose: 'first-login', uid: user.id }, this.firstLoginSecret(), { expiresIn: FIRST_LOGIN_PASS_TTL })
        : undefined;

    return { email: user.email, alreadyActive, ...(firstLoginToken ? { firstLoginToken } : {}) };
  }

  /** Separate key so a first-login pass can never be used as a session token */
  private static firstLoginSecret() {
    return `${config.jwt.secret}:first-login`;
  }

  /** True when the pass came from this account's verification link and the account has never signed in */
  private static hasValidFirstLoginPass(user: User, token?: string): boolean {
    if (!token || user.last_login_at) return false;
    try {
      const decoded = jwt.verify(token, this.firstLoginSecret()) as { purpose?: string; uid?: number };
      return decoded.purpose === 'first-login' && decoded.uid === user.id;
    } catch {
      return false;
    }
  }

  /** Sends a new verification link; answers the same way whether or not the address is known */
  public static async resendVerification(input: ResendVerificationInput) {
    const user = await User.findOne({
      where: { email: input.email.toLowerCase() },
      include: [{ model: CustomerProfile, as: 'profile' }],
    });
    if (user && user.status === UserStatus.PENDING_VERIFICATION) {
      const latest = await EmailVerification.findOne({ where: { user_id: user.id }, order: [['id', 'DESC']] });
      if (latest && Date.now() - new Date(latest.created_at).getTime() < EMAIL_VERIFICATION_RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - (Date.now() - new Date(latest.created_at).getTime())) / 1000);
        throw new BadRequestError(`Please wait ${wait} second${wait === 1 ? '' : 's'} before requesting another link.`);
      }
      const profile = (user as any).profile as CustomerProfile | null;
      await this.issueEmailVerification(user, profile?.full_name || 'there');
    }
    return { email: input.email.toLowerCase(), expiresInHours: EMAIL_VERIFICATION_EXPIRY_HOURS };
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
        [Op.or]: [{ email: cleanIdentifier }, { phone: { [Op.in]: this.phoneVariants(cleanIdentifier) } }],
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

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw this.emailNotVerifiedError();
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Your account has been suspended. Please contact administrator.');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenError('Your account is currently inactive.');
    }

    // Customers confirm every sign-in with a code emailed to them; staff sign in with the password alone.
    // While maintenance mode is on, customers cannot sign in at all (staff still can).
    if (user.role === UserRole.CUSTOMER) {
      await SettingsService.assertCustomerAccessOpen();
      if (this.hasValidFirstLoginPass(user, input.firstLoginToken)) {
        await ActivityLogService.log({
          userId: user.id,
          action: 'USER_LOGIN_FIRST_AFTER_VERIFY',
          entity: 'USER',
          entityId: user.id,
          description: `First sign-in right after email verification (login code skipped): ${user.email}`,
          ipAddress,
          userAgent,
        });
        return this.completeLogin(user, ipAddress, userAgent);
      }
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
        customerId: profile ? profile.customer_id : null,
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
    if (user.status === UserStatus.PENDING_VERIFICATION) throw this.emailNotVerifiedError();
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Your account has been suspended. Please contact administrator.');
    }
    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenError('Your account is currently inactive.');
    }
    if (user.role === UserRole.CUSTOMER) await SettingsService.assertCustomerAccessOpen();

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
      customerId: profile ? profile.customer_id : null,
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
