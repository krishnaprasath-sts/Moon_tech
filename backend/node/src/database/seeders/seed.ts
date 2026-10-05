import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import {
  sequelize,
  User,
  CustomerProfile,
  KycProfile,
  KycReview,
  Referral,
  ActivityLog,
  InvestmentPlan,
} from '../../models/index.js';
import { ensureDatabaseExists } from '../../config/database.js';
import {
  UserRole,
  UserStatus,
  KycStatus,
  KycReviewAction,
  ReferralStatus,
  ProfitType,
} from '../../types/index.js';

import { encryptData } from '../../utils/encryption.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { FileService } from '../../services/fileService.js';

/**
 * Seeds the default investment plans. Idempotent: does nothing once any plan exists.
 */
export async function seedInvestmentDefaults(): Promise<void> {
  const planCount = await InvestmentPlan.count();
  if (planCount > 0) return;

  await InvestmentPlan.bulkCreate([
    {
      name: 'Starter 30',
      description: 'Short 30-day plan for first-time investors.',
      min_amount: 1000,
      max_amount: 50000,
      duration_days: 30,
      profit_type: ProfitType.PERCENTAGE,
      profit_value: 3,
      is_active: true,
      is_featured: true,
      featured_tagline: 'Start with as little as ₹1,000 and see how the platform works in 30 days.',
      sort_order: 1,
    },
    {
      name: 'Growth 90',
      description: 'Balanced 90-day plan with a higher return on larger amounts.',
      min_amount: 5000,
      max_amount: 200000,
      duration_days: 90,
      profit_type: ProfitType.PERCENTAGE,
      profit_value: 10,
      is_active: true,
      is_featured: true,
      featured_tagline: 'Our most popular plan: balanced term with a strong expected return.',
      sort_order: 2,
    },
    {
      name: 'Premium 180',
      description: 'Long-term 180-day plan for maximum returns.',
      min_amount: 25000,
      max_amount: 1000000,
      duration_days: 180,
      profit_type: ProfitType.PERCENTAGE,
      profit_value: 22,
      is_active: true,
      sort_order: 3,
    },
    {
      name: 'Fixed Bonus 60',
      description: 'Earn a fixed profit of ₹1,200 on any amount in range after 60 days.',
      min_amount: 10000,
      max_amount: 25000,
      duration_days: 60,
      profit_type: ProfitType.FIXED,
      profit_value: 1200,
      is_active: true,
      sort_order: 4,
    },
  ]);

  logger.info('Created default investment plans');
}

export async function seedDatabase(): Promise<void> {
  try {
    logger.info('Starting database seeding...');
    await FileService.ensureStorageDir();
    await ensureDatabaseExists();

    await sequelize.sync();

    // Helper for password hash
    const defaultPassword = 'Admin@123456';
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(defaultPassword, salt);

    // 1. Seed SUPER_ADMIN
    let superAdmin = await User.findOne({ where: { email: 'superadmin@moontech.com' } });
    if (!superAdmin) {
      superAdmin = await User.create({
        email: 'superadmin@moontech.com',
        phone: '+919876543210',
        password_hash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      });
      logger.info('Created Super Admin: superadmin@moontech.com');
    }

    // 2. Seed ADMIN
    let admin = await User.findOne({ where: { email: 'admin@moontech.com' } });
    if (!admin) {
      admin = await User.create({
        email: 'admin@moontech.com',
        phone: '+919876543211',
        password_hash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      });
      logger.info('Created Admin: admin@moontech.com');
    }

    // 3. Seed EDITOR
    let editor = await User.findOne({ where: { email: 'editor@moontech.com' } });
    if (!editor) {
      editor = await User.create({
        email: 'editor@moontech.com',
        phone: '+919876543212',
        password_hash,
        role: UserRole.EDITOR,
        status: UserStatus.ACTIVE,
      });
      logger.info('Created Editor: editor@moontech.com');
    }

    // Create a mock sample document file for visual testing
    const sampleDocPath = path.join(config.uploadDir, 'sample_kyc_document.jpg');
    try {
      const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
        <rect width="800" height="500" fill="#1e293b"/>
        <rect x="20" y="20" width="760" height="460" rx="12" fill="#0f172a" stroke="#3b62f2" stroke-width="2"/>
        <text x="400" y="80" fill="#60a5fa" font-size="24" font-family="Arial" text-anchor="middle" font-weight="bold">GOVERNMENT OF INDIA / OFFICIAL DOCUMENT</text>
        <line x1="100" y1="110" x2="700" y2="110" stroke="#334155" stroke-width="2"/>
        <text x="100" y="180" fill="#94a3b8" font-size="18" font-family="Arial">Name / Name of Holder:</text>
        <text x="350" y="180" fill="#f8fafc" font-size="20" font-family="Arial" font-weight="bold">SAMPLE CITIZEN</text>
        <text x="100" y="240" fill="#94a3b8" font-size="18" font-family="Arial">Identity / Account Reference:</text>
        <text x="350" y="240" fill="#38bdf8" font-size="20" font-family="monospace">XXXX-XXXX-1234</text>
        <text x="100" y="300" fill="#94a3b8" font-size="18" font-family="Arial">Issuing Authority / Bank:</text>
        <text x="350" y="300" fill="#f8fafc" font-size="18" font-family="Arial">MOON TECH VERIFIED RECORD</text>
        <rect x="100" y="360" width="600" height="70" rx="8" fill="#1e1b4b" stroke="#6366f1" stroke-width="1"/>
        <text x="400" y="405" fill="#a5b4fc" font-size="16" font-family="Arial" text-anchor="middle">Confidential Document — Strictly Protected under Moon Tech Security Architecture</text>
      </svg>`;
      await fs.writeFile(sampleDocPath, sampleSvg);
    } catch (e) {
      // Ignored
    }

    // 4. Seed Sample Customers
    const sampleCustomers = [
      {
        email: 'rahul.sharma@example.com',
        phone: '+919876541001',
        fullName: 'Rahul Sharma',
        referralCode: 'RAHU1001',
        referredBy: null,
        city: 'Mumbai',
        state: 'Maharashtra',
        kycStatus: KycStatus.PENDING,
        pan: 'ABCDE1234F',
        aadhaar: '987654321234',
        accountNumber: '912345678901',
        accountHolderName: 'Rahul Sharma',
        ifsc: 'HDFC0001234',
      },
      {
        email: 'priya.patel@example.com',
        phone: '+919876541002',
        fullName: 'Priya Patel',
        referralCode: 'PRIY1002',
        referredBy: 'RAHU1001',
        city: 'Ahmedabad',
        state: 'Gujarat',
        kycStatus: KycStatus.VERIFIED,
        pan: 'FGHIJ5678K',
        aadhaar: '543212345678',
        accountNumber: '987654321098',
        accountHolderName: 'Priya Patel',
        ifsc: 'SBIN0004567',
      },
      {
        email: 'amit.verma@example.com',
        phone: '+919876541003',
        fullName: 'Amit Verma',
        referralCode: 'AMIT1003',
        referredBy: null,
        city: 'Delhi',
        state: 'Delhi',
        kycStatus: KycStatus.REJECTED,
        pan: 'KLMNO9012P',
        aadhaar: '123456789012',
        accountNumber: '112233445566',
        accountHolderName: 'Amit Verma',
        ifsc: 'ICIC0007890',
        rejectionReason: 'Uploaded PAN document image was illegible and signature did not match.',
      },
      {
        email: 'sneha.reddy@example.com',
        phone: '+919876541004',
        fullName: 'Sneha Reddy',
        referralCode: 'SNEH1004',
        referredBy: 'AMIT1003',
        city: 'Hyderabad',
        state: 'Telangana',
        kycStatus: KycStatus.RESUBMISSION_REQUIRED,
        pan: 'PQRST3456U',
        aadhaar: '678901234567',
        accountNumber: '556677889900',
        accountHolderName: 'Sneha Reddy',
        ifsc: 'AXIS0003456',
        rejectionReason: 'Bank Passbook copy was truncated. Please upload complete page with IFSC clearly visible.',
      },
      {
        email: 'vikram.singh@example.com',
        phone: '+919876541005',
        fullName: 'Vikram Singh',
        referralCode: 'VIKR1005',
        referredBy: null,
        city: 'Jaipur',
        state: 'Rajasthan',
        kycStatus: KycStatus.DRAFT,
        pan: 'UVWXY7890Z',
        aadhaar: '456789012345',
        accountNumber: '334455667788',
        accountHolderName: 'Vikram Singh',
        ifsc: 'KKBK0001122',
      },
    ];

    for (const data of sampleCustomers) {
      let custUser = await User.findOne({ where: { email: data.email } });
      if (!custUser) {
        custUser = await User.create({
          email: data.email,
          phone: data.phone,
          password_hash,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        });

        await CustomerProfile.create({
          user_id: custUser.id,
          full_name: data.fullName,
          referral_code: data.referralCode,
          referred_by: data.referredBy,
          city: data.city,
          state: data.state,
          address: `Flat 101, Sky Towers, ${data.city}`,
          pincode: '400001',
          date_of_birth: '1995-06-15',
        });

        const kyc = await KycProfile.create({
          user_id: custUser.id,
          kyc_status: data.kycStatus,
          pan_number_encrypted: encryptData(data.pan),
          pan_last4: data.pan.slice(-4),
          aadhaar_reference: `XXXX-XXXX-${data.aadhaar.slice(-4)}`,
          aadhaar_last4: data.aadhaar.slice(-4),
          bank_account_number_encrypted: encryptData(data.accountNumber),
          bank_account_last4: data.accountNumber.slice(-4),
          account_holder_name: data.accountHolderName,
          ifsc_code: data.ifsc,
          passbook_document: 'sample_kyc_document.jpg',
          pan_document: 'sample_kyc_document.jpg',
          aadhaar_document: 'sample_kyc_document.jpg',
          submitted_at: data.kycStatus !== KycStatus.DRAFT ? new Date() : null,
          reviewed_at: [KycStatus.VERIFIED, KycStatus.REJECTED, KycStatus.RESUBMISSION_REQUIRED].includes(data.kycStatus)
            ? new Date()
            : null,
          reviewed_by: [KycStatus.VERIFIED, KycStatus.REJECTED, KycStatus.RESUBMISSION_REQUIRED].includes(data.kycStatus)
            ? admin.id
            : null,
          rejection_reason: data.rejectionReason || null,
        });

        if (data.kycStatus === KycStatus.VERIFIED) {
          await KycReview.create({
            kyc_id: kyc.id,
            admin_id: admin.id,
            action: KycReviewAction.VERIFY,
            remarks: 'All documents verified successfully against official records.',
          });
        } else if (data.kycStatus === KycStatus.REJECTED) {
          await KycReview.create({
            kyc_id: kyc.id,
            admin_id: admin.id,
            action: KycReviewAction.REJECT,
            remarks: data.rejectionReason,
          });
        } else if (data.kycStatus === KycStatus.RESUBMISSION_REQUIRED) {
          await KycReview.create({
            kyc_id: kyc.id,
            admin_id: admin.id,
            action: KycReviewAction.REQUEST_RESUBMISSION,
            remarks: data.rejectionReason,
          });
        }

        logger.info(`Created Customer: ${data.email} (${data.fullName}, KYC: ${data.kycStatus})`);
      }
    }

    // 5. Seed Referral Links
    const rahulUser = await User.findOne({ where: { email: 'rahul.sharma@example.com' } });
    const priyaUser = await User.findOne({ where: { email: 'priya.patel@example.com' } });
    const amitUser = await User.findOne({ where: { email: 'amit.verma@example.com' } });
    const snehaUser = await User.findOne({ where: { email: 'sneha.reddy@example.com' } });

    if (rahulUser && priyaUser) {
      const existingRef = await Referral.findOne({ where: { referred_user_id: priyaUser.id } });
      if (!existingRef) {
        await Referral.create({
          referrer_user_id: rahulUser.id,
          referred_user_id: priyaUser.id,
          referral_code: 'RAHU1001',
          status: ReferralStatus.ACTIVE,
        });
      }
    }

    if (amitUser && snehaUser) {
      const existingRef = await Referral.findOne({ where: { referred_user_id: snehaUser.id } });
      if (!existingRef) {
        await Referral.create({
          referrer_user_id: amitUser.id,
          referred_user_id: snehaUser.id,
          referral_code: 'AMIT1003',
          status: ReferralStatus.ACTIVE,
        });
      }
    }

    // 6. Seed Sample Activity Logs
    const logCount = await ActivityLog.count();
    if (logCount === 0 && admin) {
      await ActivityLog.bulkCreate([
        {
          user_id: superAdmin.id,
          action: 'SYSTEM_INITIALIZED',
          entity: 'SYSTEM',
          entity_id: '1',
          description: 'Moon Tech Solutions investment platform initialized with security parameters',
          ip_address: '127.0.0.1',
          user_agent: 'Antigravity/Node-Bootstrap',
        },
        {
          user_id: admin.id,
          action: 'KYC_VERIFIED',
          entity: 'KYC_PROFILE',
          entity_id: '2',
          description: 'Admin approved KYC for Priya Patel (FGHIJ5678K)',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        {
          user_id: admin.id,
          action: 'KYC_REJECTED',
          entity: 'KYC_PROFILE',
          entity_id: '3',
          description: 'Admin rejected KYC for Amit Verma. Reason: Image blurry',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      ]);
    }

    // 7. Seed Default Investment Plans
    await seedInvestmentDefaults();

    logger.info('Database seeding completed successfully.');

  } catch (error: any) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
}

if (process.argv[1]?.includes('seed')) {
  seedDatabase()
    .then(() => {
      logger.info('Seeder execution finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Seeder execution failed:', err);
      process.exit(1);
    });
}
