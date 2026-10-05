import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

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
  });

  public static async sendWelcomeEmail(to: string, name: string, referralCode: string): Promise<void> {
    try {
      if (!config.smtp.user) {
        logger.info(`[MOCK EMAIL] Welcome email queued for ${to} (${name}) with code ${referralCode}`);
        return;
      }
      await this.transporter.sendMail({
        from: config.smtp.from,
        to,
        subject: 'Welcome to Moon Tech Solutions',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2544e6;">Welcome to Moon Tech Solutions, ${name}!</h2>
            <p>Your account has been created successfully.</p>
            <p>Your unique referral code is: <strong>${referralCode}</strong></p>
            <p>Please log in and complete your KYC verification to access full platform features.</p>
            <br/>
            <p>Best regards,<br/>Moon Tech Solutions Team</p>
          </div>
        `,
      });
    } catch (err: any) {
      logger.error(`Failed to send welcome email to ${to}: ${err.message}`);
    }
  }

  private static escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public static async sendNotificationEmail(to: string, title: string, message: string): Promise<void> {
    try {
      if (!config.smtp.user) {
        logger.info(`[MOCK EMAIL] Notification for ${to}: ${title}`);
        return;
      }
      await this.transporter.sendMail({
        from: config.smtp.from,
        to,
        subject: `Moon Tech Solutions: ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2544e6;">${this.escapeHtml(title)}</h2>
            <p>${this.escapeHtml(message)}</p>
            <p>Log in to your account to view the details.</p>
            <br/>
            <p>Best regards,<br/>Moon Tech Solutions Team</p>
          </div>
        `,
      });
    } catch (err: any) {
      logger.error(`Failed to send notification email to ${to}: ${err.message}`);
    }
  }

  public static async sendPasswordResetOtp(to: string, otp: string, expiryMinutes: number): Promise<void> {
    try {
      if (!config.smtp.user) {
        if (config.isDev) {
          // No SMTP configured: surface the OTP in the server log so local setups remain usable
          logger.info(`[MOCK EMAIL] Password reset code for ${to}: ${otp} (valid ${expiryMinutes} minutes)`);
        } else {
          logger.error(`Password reset requested for ${to} but SMTP is not configured; the code was not delivered.`);
        }
        return;
      }
      await this.transporter.sendMail({
        from: config.smtp.from,
        to,
        subject: 'Moon Tech Solutions: Password Reset Code',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2544e6;">Password Reset</h2>
            <p>Use the code below to reset your password. It is valid for ${expiryMinutes} minutes.</p>
            <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
            <p>If you did not request this, you can safely ignore this email.</p>
            <br/>
            <p>Best regards,<br/>Moon Tech Solutions Team</p>
          </div>
        `,
      });
    } catch (err: any) {
      logger.error(`Failed to send password reset email to ${to}: ${err.message}`);
    }
  }

  public static async sendKycStatusUpdate(
    to: string,
    name: string,
    status: string,
    remarks?: string
  ): Promise<void> {
    try {
      if (!config.smtp.user) {
        logger.info(`[MOCK EMAIL] KYC status update for ${to} (${name}): Status=${status}, Remarks=${remarks || 'N/A'}`);
        return;
      }
      await this.transporter.sendMail({
        from: config.smtp.from,
        to,
        subject: `Moon Tech Solutions: KYC Verification Update - ${status}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2544e6;">KYC Verification Update</h2>
            <p>Hello ${name},</p>
            <p>Your KYC verification status has been updated to: <strong style="color: #2544e6;">${status}</strong></p>
            ${remarks ? `<p><strong>Notes from compliance team:</strong> ${remarks}</p>` : ''}
            <p>Log in to your account dashboard to check details.</p>
            <br/>
            <p>Best regards,<br/>Moon Tech Solutions Compliance Team</p>
          </div>
        `,
      });
    } catch (err: any) {
      logger.error(`Failed to send KYC email to ${to}: ${err.message}`);
    }
  }
}
