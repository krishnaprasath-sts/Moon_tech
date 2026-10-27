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
import { LoginOtp } from './LoginOtp.js';
import { EmailVerification } from './EmailVerification.js';
import { ProfitCredit } from './ProfitCredit.js';
import { ReferralCommission } from './ReferralCommission.js';
import { ReferralDailyCredit } from './ReferralDailyCredit.js';
import { SupportMessage } from './SupportMessage.js';
import { SupportGuest } from './SupportGuest.js';
import { SupportGuestMessage } from './SupportGuestMessage.js';
import { BankChangeRequest } from './BankChangeRequest.js';
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

// Investment / User <-> ProfitCredit (daily profit ledger)
Investment.hasMany(ProfitCredit, {
  foreignKey: 'investment_id',
  as: 'profitCredits',
  onDelete: 'CASCADE',
});
ProfitCredit.belongsTo(Investment, {
  foreignKey: 'investment_id',
  as: 'investment',
});
ProfitCredit.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// Referral commissions
ReferralCommission.belongsTo(User, {
  foreignKey: 'referrer_user_id',
  as: 'referrer',
});
ReferralCommission.belongsTo(User, {
  foreignKey: 'referred_user_id',
  as: 'referred',
});
ReferralCommission.belongsTo(Investment, {
  foreignKey: 'investment_id',
  as: 'investment',
});
Investment.hasOne(ReferralCommission, {
  foreignKey: 'investment_id',
  as: 'referralCommission',
});

// Recurring daily referral credits
ReferralDailyCredit.belongsTo(User, {
  foreignKey: 'referrer_user_id',
  as: 'referrer',
});
ReferralDailyCredit.belongsTo(User, {
  foreignKey: 'referred_user_id',
  as: 'referred',
});
ReferralDailyCredit.belongsTo(Investment, {
  foreignKey: 'investment_id',
  as: 'investment',
});
Investment.hasMany(ReferralDailyCredit, {
  foreignKey: 'investment_id',
  as: 'dailyReferralCredits',
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

// User <-> LoginOtp
User.hasMany(LoginOtp, {
  foreignKey: 'user_id',
  as: 'loginOtps',
  onDelete: 'CASCADE',
});
LoginOtp.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User <-> EmailVerification (registration link)
User.hasMany(EmailVerification, {
  foreignKey: 'user_id',
  as: 'emailVerifications',
  onDelete: 'CASCADE',
});
EmailVerification.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// Support chat: customer thread + replying admin
User.hasMany(SupportMessage, {
  foreignKey: 'user_id',
  as: 'supportMessages',
  onDelete: 'CASCADE',
});
SupportMessage.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'customer',
});
SupportMessage.belongsTo(User, {
  foreignKey: 'admin_user_id',
  as: 'admin',
  constraints: false,
});

// Visitor (not signed in) support chat
SupportGuest.hasMany(SupportGuestMessage, {
  foreignKey: 'guest_id',
  as: 'messages',
  onDelete: 'CASCADE',
});
SupportGuestMessage.belongsTo(SupportGuest, {
  foreignKey: 'guest_id',
  as: 'guest',
});
SupportGuestMessage.belongsTo(User, {
  foreignKey: 'admin_user_id',
  as: 'admin',
  constraints: false,
});

// Bank account change requests (customer) and the reviewing admin
User.hasMany(BankChangeRequest, { foreignKey: 'user_id', as: 'bankChangeRequests', onDelete: 'CASCADE' });
BankChangeRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
BankChangeRequest.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer', constraints: false });

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
  LoginOtp,
  EmailVerification,
  ProfitCredit,
  ReferralCommission,
  ReferralDailyCredit,
  SupportMessage,
  SupportGuest,
  SupportGuestMessage,
  BankChangeRequest,
};

