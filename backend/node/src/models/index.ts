import { User } from './User.js';
import { CustomerProfile } from './CustomerProfile.js';
import { KycProfile } from './KycProfile.js';
import { KycReview } from './KycReview.js';
import { Referral } from './Referral.js';
import { Media } from './Media.js';
import { ActivityLog } from './ActivityLog.js';
import { Wallet } from './Wallet.js';
import { WalletTransaction } from './WalletTransaction.js';
import { Deposit } from './Deposit.js';
import { InvestmentPlan } from './InvestmentPlan.js';
import { Investment } from './Investment.js';
import { Withdrawal } from './Withdrawal.js';
import { Notification, Announcement } from './Notification.js';
import { SystemSetting } from './SystemSetting.js';
import { UserPayoutDetail } from './UserPayoutDetail.js';
import { PasswordReset } from './PasswordReset.js';
import { sequelize } from '../config/database.js';

// User <-> CustomerProfile
User.hasOne(CustomerProfile, {
  foreignKey: 'user_id',
  as: 'profile',
  onDelete: 'CASCADE',
});
CustomerProfile.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User <-> KycProfile
User.hasOne(KycProfile, {
  foreignKey: 'user_id',
  as: 'kyc',
  onDelete: 'CASCADE',
});
KycProfile.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// KycProfile <-> Reviewer (User)
KycProfile.belongsTo(User, {
  foreignKey: 'reviewed_by',
  as: 'reviewer',
});

// KycProfile <-> KycReview
KycProfile.hasMany(KycReview, {
  foreignKey: 'kyc_id',
  as: 'reviews',
  onDelete: 'CASCADE',
});
KycReview.belongsTo(KycProfile, {
  foreignKey: 'kyc_id',
  as: 'kyc',
});

// KycReview <-> Admin (User)
KycReview.belongsTo(User, {
  foreignKey: 'admin_id',
  as: 'admin',
});

// User <-> Referral (Referrer)
User.hasMany(Referral, {
  foreignKey: 'referrer_user_id',
  as: 'referralsGiven',
});
Referral.belongsTo(User, {
  foreignKey: 'referrer_user_id',
  as: 'referrer',
});

// User <-> Referral (Referred)
User.hasOne(Referral, {
  foreignKey: 'referred_user_id',
  as: 'referralReceived',
});
Referral.belongsTo(User, {
  foreignKey: 'referred_user_id',
  as: 'referred',
});

// User <-> Media
User.hasMany(Media, {
  foreignKey: 'user_id',
  as: 'media',
  onDelete: 'CASCADE',
});
Media.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User <-> ActivityLog
User.hasMany(ActivityLog, {
  foreignKey: 'user_id',
  as: 'activityLogs',
  onDelete: 'SET NULL',
});
ActivityLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User <-> Wallet
User.hasOne(Wallet, {
  foreignKey: 'user_id',
  as: 'wallet',
  onDelete: 'CASCADE',
});
Wallet.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// Wallet / User <-> WalletTransaction
Wallet.hasMany(WalletTransaction, {
  foreignKey: 'wallet_id',
  as: 'transactions',
});
WalletTransaction.belongsTo(Wallet, {
  foreignKey: 'wallet_id',
  as: 'wallet',
});
User.hasMany(WalletTransaction, {
  foreignKey: 'user_id',
  as: 'walletTransactions',
});
WalletTransaction.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User <-> Deposit
User.hasMany(Deposit, {
  foreignKey: 'user_id',
  as: 'deposits',
});
Deposit.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});
Deposit.belongsTo(User, {
  foreignKey: 'reviewed_by',
  as: 'reviewer',
  constraints: false,
});

// InvestmentPlan / User <-> Investment
InvestmentPlan.hasMany(Investment, {
  foreignKey: 'plan_id',
  as: 'investments',
  onDelete: 'RESTRICT',
});
Investment.belongsTo(InvestmentPlan, {
  foreignKey: 'plan_id',
  as: 'plan',
});
User.hasMany(Investment, {
  foreignKey: 'user_id',
  as: 'investments',
});
Investment.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// Investment / User <-> Withdrawal
Investment.hasMany(Withdrawal, {
  foreignKey: 'investment_id',
  as: 'withdrawals',
});
Withdrawal.belongsTo(Investment, {
  foreignKey: 'investment_id',
  as: 'investment',
});
User.hasMany(Withdrawal, {
  foreignKey: 'user_id',
  as: 'withdrawals',
});
Withdrawal.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User <-> Notification
User.hasMany(Notification, {
  foreignKey: 'user_id',
  as: 'notifications',
  onDelete: 'CASCADE',
});
Notification.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// Announcement <-> Author (User)
Announcement.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'author',
  constraints: false,
});

// User <-> UserPayoutDetail
User.hasOne(UserPayoutDetail, {
  foreignKey: 'user_id',
  as: 'payoutDetail',
  onDelete: 'CASCADE',
});
UserPayoutDetail.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User <-> PasswordReset
User.hasMany(PasswordReset, {
  foreignKey: 'user_id',
  as: 'passwordResets',
  onDelete: 'CASCADE',
});
PasswordReset.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

export {
  sequelize,
  User,
  CustomerProfile,
  KycProfile,
  KycReview,
  Referral,
  Media,
  ActivityLog,
  Wallet,
  WalletTransaction,
  Deposit,
  InvestmentPlan,
  Investment,
  Withdrawal,
  Notification,
  Announcement,
  SystemSetting,
  UserPayoutDetail,
  PasswordReset,
};

