import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { NotificationType } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Transactional email for customers. Every message uses the same branded, mobile-friendly
 * layout (header, content card, optional highlight such as a code or amount, optional
 * details table, one call-to-action button, footer) and ships a plain-text version.
 *
 * Without SMTP credentials the messages are logged instead of sent, so local setups keep
 * working; the login code is additionally surfaced to the caller in development.
 */

const BRAND = 'MoonTech Solutions';
const BRAND_COLOR = '#155DFC';
const BRAND_DARK = '#0f172a';

interface MailDetail {
  label: string;
  value: string;
}

interface MailContent {
  /** Email subject */
  subject: string;
  /** Hidden preview line shown by mail clients next to the subject */
  preheader?: string;
  /** Headline inside the card */
  heading: string;
  /** "Hi Rahul," line; omitted when no name is known */
  greeting?: string;
  /** Plain-text paragraphs (escaped for HTML automatically) */
  paragraphs: string[];
  /** Big centred value, e.g. a sign-in code or an amount */
  highlight?: { value: string; caption?: string; spaced?: boolean };
  /** Two-column details table */
  details?: MailDetail[];
  /** Numbered steps shown as a list */
  steps?: string[];
  /** Call-to-action button */
  cta?: { label: string; url: string };
  /** Small grey note under the content, e.g. a security hint */
  note?: string;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function appUrl(path: string): string {
  return `${config.frontendUrl.replace(/\/+$/, '')}${path}`;
}

function supportAddress(): string {
  const match = config.smtp.from.match(/<([^>]+)>/);
  return match ? match[1] : config.smtp.from;
}

export function renderHtml(content: MailContent): string {
  const year = new Date().getFullYear();
  const paragraphs = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(p)}</p>`
    )
    .join('');

  const highlight = content.highlight
    ? `<div style="margin:22px 0;text-align:center;">
         <div style="display:inline-block;padding:16px 28px;border-radius:12px;background:#f1f5f9;border:1px solid #e2e8f0;font-family:'Courier New',Courier,monospace;font-size:${content.highlight.spaced ? '32px' : '26px'};font-weight:700;letter-spacing:${content.highlight.spaced ? '8px' : '0'};color:${BRAND_DARK};">${escapeHtml(content.highlight.value)}</div>
         ${content.highlight.caption ? `<div style="margin-top:8px;font-size:13px;color:#64748b;">${escapeHtml(content.highlight.caption)}</div>` : ''}
       </div>`
    : '';

  const details =
    content.details && content.details.length > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0;border:1px solid #e2e8f0;border-radius:12px;border-collapse:separate;overflow:hidden;">
           ${content.details
             .map(
               (d, i) => `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                 <td style="padding:10px 14px;font-size:13px;color:#64748b;width:42%;vertical-align:top;">${escapeHtml(d.label)}</td>
                 <td style="padding:10px 14px;font-size:14px;color:${BRAND_DARK};font-weight:600;vertical-align:top;">${escapeHtml(d.value)}</td>
               </tr>`
             )
             .join('')}
         </table>`
      : '';

  const steps =
    content.steps && content.steps.length > 0
      ? `<ol style="margin:6px 0 18px;padding-left:22px;color:#334155;font-size:15px;line-height:1.7;">
           ${content.steps.map((s) => `<li style="margin-bottom:4px;">${escapeHtml(s)}</li>`).join('')}
         </ol>`
      : '';

  const cta = content.cta
    ? `<div style="margin:26px 0 8px;text-align:center;">
         <a href="${escapeHtml(content.cta.url)}" style="display:inline-block;padding:13px 28px;border-radius:999px;background:${BRAND_COLOR};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(content.cta.label)}</a>
       </div>`
    : '';

  const note = content.note
    ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#64748b;">${escapeHtml(content.note)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(content.preheader || content.heading)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
          <tr>
            <td style="padding:0 6px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px;height:36px;border-radius:10px;background:${BRAND_DARK};text-align:center;vertical-align:middle;color:#ffffff;font-size:18px;font-weight:700;">M</td>
                  <td style="padding-left:10px;font-size:18px;font-weight:700;color:${BRAND_DARK};">MoonTech <span style="font-size:11px;font-weight:600;color:${BRAND_COLOR};letter-spacing:1px;">SOLUTIONS</span></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:30px 28px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${BRAND_DARK};">${escapeHtml(content.heading)}</h1>
              ${content.greeting ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(content.greeting)}</p>` : ''}
              ${paragraphs}
              ${steps}
              ${highlight}
              ${details}
              ${cta}
              ${note}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 10px 0;text-align:center;font-size:12px;line-height:1.6;color:#94a3b8;">
              This is an automated message from ${BRAND}. Need help? Write to
              <a href="mailto:${escapeHtml(supportAddress())}" style="color:#64748b;">${escapeHtml(supportAddress())}</a>.<br />
              &copy; ${year} ${BRAND}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText(content: MailContent): string {
  const lines: string[] = [content.heading, ''];
  if (content.greeting) lines.push(content.greeting, '');
  for (const p of content.paragraphs) lines.push(p, '');
  content.steps?.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  if (content.steps?.length) lines.push('');
  if (content.highlight) {
    lines.push(content.highlight.value);
    if (content.highlight.caption) lines.push(content.highlight.caption);
    lines.push('');
  }
  for (const d of content.details ?? []) lines.push(`${d.label}: ${d.value}`);
  if (content.details?.length) lines.push('');
  if (content.cta) lines.push(`${content.cta.label}: ${content.cta.url}`, '');
  if (content.note) lines.push(content.note, '');
  lines.push(`-- ${BRAND}`, `Need help? Write to ${supportAddress()}`);
  return lines.join('\n');
}

/** Where the button of an in-app notification email should take the customer */
const NOTIFICATION_LINKS: Record<NotificationType, { label: string; path: string }> = {
  [NotificationType.PAYMENT_SUBMITTED]: { label: 'View my wallet', path: '/wallet' },
  [NotificationType.PAYMENT_VERIFIED]: { label: 'View my wallet', path: '/wallet' },
  [NotificationType.PAYMENT_REJECTED]: { label: 'View my deposits', path: '/wallet' },
  [NotificationType.INVESTMENT_CONFIRMED]: { label: 'View my investments', path: '/investments' },
  [NotificationType.INVESTMENT_MATURED]: { label: 'View my investments', path: '/investments' },
  [NotificationType.INVESTMENT_CANCELLED]: { label: 'View my investments', path: '/investments' },
  [NotificationType.WITHDRAWAL_REQUESTED]: { label: 'Track my withdrawal', path: '/investments?tab=withdrawals' },
  [NotificationType.WITHDRAWAL_APPROVED]: { label: 'Track my withdrawal', path: '/investments?tab=withdrawals' },
  [NotificationType.WITHDRAWAL_REJECTED]: { label: 'View withdrawal requests', path: '/investments?tab=withdrawals' },
  [NotificationType.WITHDRAWAL_COMPLETED]: { label: 'View withdrawal requests', path: '/investments?tab=withdrawals' },
  [NotificationType.WALLET_ADJUSTMENT]: { label: 'View my wallet', path: '/wallet' },
  [NotificationType.PROFIT_CREDITED]: { label: 'View my profit wallet', path: '/wallet' },
  [NotificationType.REFERRAL_COMMISSION]: { label: 'View my referrals', path: '/referrals' },
  [NotificationType.KYC_VERIFIED]: { label: 'Open my dashboard', path: '/dashboard' },
  [NotificationType.KYC_REJECTED]: { label: 'Update my KYC', path: '/dashboard?kyc=true' },
  [NotificationType.KYC_RESUBMISSION_REQUIRED]: { label: 'Update my KYC', path: '/dashboard?kyc=true' },
  [NotificationType.ANNOUNCEMENT]: { label: 'View notifications', path: '/notifications' },
};

/** Notification types that already get a dedicated, richer email elsewhere */
const SKIP_NOTIFICATION_EMAIL = new Set<NotificationType>([
  NotificationType.KYC_VERIFIED,
  NotificationType.KYC_REJECTED,
  NotificationType.KYC_RESUBMISSION_REQUIRED,
]);

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth:
      config.smtp.user && config.smtp.pass
        ? {
            user: config.smtp.user,
            pass: config.smtp.pass,
          }
        : undefined,
    // Pooled: the TLS handshake and login are paid once, later messages reuse the connection
    pool: true,
    maxConnections: 2,
    maxMessages: 200,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });

  /** Opens the SMTP connection at startup so the first sign-in code is not slowed by it */
  public static async warmUp(): Promise<void> {
    if (!this.isConfigured) return;
    const result = await this.verifyConnection();
    if (result.ok) logger.info(`[EMAIL] ${result.message}`);
    else logger.warn(`[EMAIL] SMTP check failed: ${result.message}`);
  }

  public static get isConfigured(): boolean {
    return Boolean(config.smtp.user && config.smtp.pass);
  }

  /** Sends one branded message; returns false (after logging) when it could not be sent. */
  private static async send(to: string, content: MailContent, mockLine: string): Promise<boolean> {
    if (!this.isConfigured) {
      logger.info(`[MOCK EMAIL] ${mockLine}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: config.smtp.from,
        to,
        subject: content.subject,
        text: renderText(content),
        html: renderHtml(content),
      });
      return true;
    } catch (err: any) {
      logger.error(`Failed to send "${content.subject}" to ${to}: ${err.message}`);
      return false;
    }
  }

  /** Verifies the SMTP connection and credentials (used by health checks and scripts) */
  public static async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isConfigured) return { ok: false, message: 'SMTP is not configured' };
    try {
      await this.transporter.verify();
      return { ok: true, message: `SMTP ready (${config.smtp.host}:${config.smtp.port})` };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  }

  // ------------------------------------------------------------------ account

  public static async sendWelcomeEmail(to: string, name: string, referralCode: string): Promise<void> {
    await this.send(
      to,
      {
        subject: `Welcome to ${BRAND}, ${name}`,
        preheader: 'Your account is ready. Here is how to get started.',
        heading: 'Welcome aboard',
        greeting: `Hi ${name},`,
        paragraphs: [
          'Your MoonTech account has been created. Every sign-in is protected with a one-time code sent to this email address, so keep it safe.',
          'Here is what to do next:',
        ],
        steps: [
          'Complete your KYC: upload your PAN, Aadhaar and bank passbook from the dashboard.',
          'Add money to your capital wallet by bank transfer (NEFT, IMPS or RTGS).',
          'Pick a plan and watch your profit arrive every working day at 6:00 AM.',
        ],
        highlight: { value: referralCode, caption: 'Your referral code. Share it with friends and earn a commission on every amount they invest.' },
        cta: { label: 'Open my dashboard', url: appUrl('/dashboard') },
        note: 'If you did not create this account, please ignore this email or write to us so we can remove it.',
      },
      `Welcome email for ${to} (${name}) with code ${referralCode}`
    );
  }

  /** Login verification code for a customer; expiry is given in seconds (2 minutes by default) */
  public static async sendLoginOtp(to: string, name: string, otp: string, expirySeconds: number): Promise<void> {
    const minutes = Math.max(1, Math.round(expirySeconds / 60));
    const validity = `${minutes} minute${minutes === 1 ? '' : 's'}`;
    if (!this.isConfigured) {
      logger.info(`[MOCK EMAIL] Login code for ${to}: ${otp} (valid ${validity})`);
      return;
    }
    const sent = await this.send(
      to,
      {
        subject: `${otp} is your MoonTech sign-in code`,
        preheader: `Your code is ${otp}. It expires in ${validity}.`,
        heading: 'Your sign-in code',
        greeting: `Hi ${name},`,
        paragraphs: [`Enter this code to finish signing in. It is valid for ${validity} and can be used once.`],
        highlight: { value: otp, spaced: true, caption: `Expires in ${validity}` },
        note: 'If you did not try to sign in, someone may know your password. Change it right away using "Forgot password" on the sign-in page. We will never ask you for this code by phone or chat.',
      },
      ''
    );
    if (!sent) throw new Error('We could not send the verification email. Please try again in a moment.');
  }

  public static async sendPasswordResetOtp(to: string, otp: string, expiryMinutes: number): Promise<void> {
    if (!this.isConfigured) {
      if (config.isDev) {
        logger.info(`[MOCK EMAIL] Password reset code for ${to}: ${otp} (valid ${expiryMinutes} minutes)`);
      } else {
        logger.error(`Password reset requested for ${to} but SMTP is not configured; the code was not delivered.`);
      }
      return;
    }
    await this.send(
      to,
      {
        subject: `${otp} is your MoonTech password reset code`,
        preheader: `Your reset code is ${otp}. It expires in ${expiryMinutes} minutes.`,
        heading: 'Reset your password',
        paragraphs: [`Use this code to set a new password. It is valid for ${expiryMinutes} minutes and can be used once.`],
        highlight: { value: otp, spaced: true, caption: `Expires in ${expiryMinutes} minutes` },
        note: 'If you did not ask to reset your password, you can safely ignore this email; your password stays the same.',
      },
      ''
    );
  }

  // ---------------------------------------------------------------------- KYC

  public static async sendKycStatusUpdate(to: string, name: string, status: string, remarks?: string): Promise<void> {
    const normalized = status.toUpperCase();
    const variants: Record<string, { subject: string; heading: string; paragraphs: string[]; cta: { label: string; url: string } }> = {
      VERIFIED: {
        subject: 'Your KYC is verified',
        heading: 'KYC verified',
        paragraphs: [
          'Good news: our compliance team has verified your identity documents. Your account is now fully active, so you can invest in a plan and withdraw to your registered bank account.',
        ],
        cta: { label: 'Open my dashboard', url: appUrl('/dashboard') },
      },
      REJECTED: {
        subject: 'Your KYC could not be approved',
        heading: 'KYC not approved',
        paragraphs: [
          'Our compliance team could not approve your KYC documents. Please review the reason below, then submit fresh documents from your dashboard.',
        ],
        cta: { label: 'Update my KYC', url: appUrl('/dashboard?kyc=true') },
      },
      RESUBMISSION_REQUIRED: {
        subject: 'Action needed: please resubmit your KYC documents',
        heading: 'A few changes are needed',
        paragraphs: [
          'Our compliance team needs you to resubmit one or more KYC documents. Please read the note below and upload the corrected documents from your dashboard.',
        ],
        cta: { label: 'Update my KYC', url: appUrl('/dashboard?kyc=true') },
      },
    };
    const v = variants[normalized] ?? {
      subject: `KYC update: ${status}`,
      heading: 'KYC update',
      paragraphs: [`Your KYC status is now ${status}.`],
      cta: { label: 'Open my dashboard', url: appUrl('/dashboard') },
    };
    await this.send(
      to,
      {
        subject: v.subject,
        preheader: v.paragraphs[0],
        heading: v.heading,
        greeting: `Hi ${name},`,
        paragraphs: v.paragraphs,
        details: remarks ? [{ label: 'Note from compliance', value: remarks }] : undefined,
        cta: v.cta,
      },
      `KYC status update for ${to} (${name}): ${status}${remarks ? ` - ${remarks}` : ''}`
    );
  }

  // ------------------------------------------------------------ notifications

  /**
   * Email copy of an in-app notification (deposits, investments, withdrawals, daily profit,
   * referral commission, announcements). KYC events have their own email above.
   */
  public static async sendNotificationEmail(
    to: string,
    title: string,
    message: string,
    type?: NotificationType,
    name?: string
  ): Promise<void> {
    if (type && SKIP_NOTIFICATION_EMAIL.has(type)) return;
    const link = type ? NOTIFICATION_LINKS[type] : undefined;
    await this.send(
      to,
      {
        subject: title,
        preheader: message,
        heading: title,
        greeting: name ? `Hi ${name},` : undefined,
        paragraphs: [message],
        cta: link ? { label: link.label, url: appUrl(link.path) } : { label: 'Open my account', url: appUrl('/dashboard') },
        note: 'You receive these updates because you have a MoonTech account. Sign in to see the full details and your complete history.',
      },
      `Notification for ${to}: ${title}`
    );
  }
}
