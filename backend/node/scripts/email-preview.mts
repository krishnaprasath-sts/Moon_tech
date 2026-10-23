/**
 * Sends one of each customer email to an inbox so the templates can be checked in real mail
 * clients. Run with: npx tsx scripts/email-preview.mts you@example.com
 */
import 'dotenv/config';
import { EmailService } from '../src/services/emailService.js';
import { NotificationType } from '../src/types/index.js';

const to = process.argv[2];
if (!to) {
  console.error('Usage: npx tsx scripts/email-preview.mts <email>');
  process.exit(1);
}

const check = await EmailService.verifyConnection();
console.log(`SMTP: ${check.message}`);
if (!check.ok) process.exit(1);

const name = 'Rahul Sharma';
await EmailService.sendWelcomeEmail(to, name, 'RAHU1001');
await EmailService.sendLoginOtp(to, name, '482913', 120);
await EmailService.sendPasswordResetOtp(to, '731046', 10);
await EmailService.sendKycStatusUpdate(to, name, 'VERIFIED');
await EmailService.sendKycStatusUpdate(to, name, 'RESUBMISSION_REQUIRED', 'The Aadhaar image is blurred; please upload a clear photo of both sides.');
await EmailService.sendNotificationEmail(
  to,
  'Withdrawal request received',
  'Your capital withdrawal WDR-20261023-1A2B3C4D for ₹1,00,000.00 has been received and is awaiting review. After the 5% early withdrawal fee of ₹5,000.00, ₹95,000.00 will be paid to you. Daily profit on this investment stops now.',
  NotificationType.WITHDRAWAL_REQUESTED,
  name
);
await EmailService.sendNotificationEmail(
  to,
  'Withdrawal paid',
  'Your withdrawal WDR-20261023-1A2B3C4D of ₹95,000.00 has been paid to your bank account ending 1234. Payment reference: UTR N310251234567890.',
  NotificationType.WITHDRAWAL_COMPLETED,
  name
);
await EmailService.sendNotificationEmail(
  to,
  'Daily profit credited',
  '₹250.00 profit for 2026-10-23 has been credited to your profit wallet from investment INV-20261023-F238B0CD16. You can withdraw it any time.',
  NotificationType.PROFIT_CREDITED,
  name
);
await EmailService.sendNotificationEmail(
  to,
  'Referral commission credited',
  '₹5,000.00 referral commission (5% of ₹1,00,000.00 invested by Priya) has been credited to your profit wallet.',
  NotificationType.REFERRAL_COMMISSION,
  name
);
console.log(`Sent 9 preview emails to ${to}`);
