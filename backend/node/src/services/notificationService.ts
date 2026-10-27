import { Op } from 'sequelize';
import { Notification, Announcement, User, CustomerProfile } from '../models/index.js';
import { NotificationType, UserRole, UserStatus } from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { toIso } from '../utils/dates.js';
import { RequestMeta, getPagination, buildMeta } from '../utils/http.js';
import { ActivityLogService } from './activityLogService.js';
import { SettingsService } from './settingsService.js';
import { EmailService } from './emailService.js';
import { AnnouncementInput } from '../validators/financeValidators.js';

export interface NotifyParams {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntity?: string;
  relatedId?: number;
}

function serialize(n: Notification) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    relatedEntity: n.related_entity,
    relatedId: n.related_id,
    isRead: Boolean(n.is_read),
    readAt: toIso(n.read_at),
    createdAt: toIso(n.created_at),
  };
}

export class NotificationService {
  /**
   * Creates an in-app notification and sends the matching email.
   * Never throws: a notification failure must not fail the business action.
   */
  public static async notify(params: NotifyParams): Promise<void> {
    try {
      await Notification.create({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        related_entity: params.relatedEntity ?? null,
        related_id: params.relatedId ?? null,
      });

      const user = await User.findByPk(params.userId, {
        attributes: ['email'],
        include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
      });
      if (user) {
        const name: string | undefined = (user as any).profile?.full_name || undefined;
        EmailService.sendNotificationEmail(user.email, params.title, params.message, params.type, name).catch(() => {});
      }
    } catch (err) {
      logger.error(`Failed to create notification for user #${params.userId}`, err);
    }
  }

  public static async listForUser(
    userId: number,
    params: { page?: unknown; limit?: unknown; unreadOnly?: unknown }
  ) {
    const { page, limit, offset } = getPagination(params, 20);

    const where: any = { user_id: userId };
    if (String(params.unreadOnly) === 'true') {
      where.is_read = false;
    }

    const [{ count, rows }, unreadCount] = await Promise.all([
      Notification.findAndCountAll({
        where,
        limit,
        offset,
        order: [
          ['created_at', 'DESC'],
          ['id', 'DESC'],
        ],
      }),
      Notification.count({ where: { user_id: userId, is_read: false } }),
    ]);

    return {
      notifications: rows.map(serialize),
      meta: { ...buildMeta(page, limit, count), unreadCount },
    };
  }

  public static async getUnreadCount(userId: number) {
    const unreadCount = await Notification.count({ where: { user_id: userId, is_read: false } });
    return { unreadCount };
  }

  public static async markRead(userId: number, notificationId: number) {
    const notification = await Notification.findOne({
      where: { id: notificationId, user_id: userId },
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    if (!notification.is_read) {
      notification.is_read = true;
      notification.read_at = new Date();
      await notification.save();
    }

    return serialize(notification);
  }

  public static async markAllRead(userId: number) {
    const [updated] = await Notification.update(
      { is_read: true, read_at: new Date() },
      { where: { user_id: userId, is_read: false } }
    );
    return { updated };
  }

  /**
   * Admin: broadcast an announcement to every customer that can sign in
   */
  public static async announce(input: AnnouncementInput, adminId: number, meta: RequestMeta = {}) {
    const recipients = await User.findAll({
      where: {
        role: UserRole.CUSTOMER,
        status: { [Op.notIn]: [UserStatus.SUSPENDED, UserStatus.INACTIVE] },
      },
      attributes: ['id'],
    });

    const announcement = await Announcement.create({
      title: input.title,
      message: input.message,
      created_by: adminId,
      recipients_count: recipients.length,
    });

    if (recipients.length > 0) {
      await Notification.bulkCreate(
        recipients.map((u) => ({
          user_id: u.id,
          type: NotificationType.ANNOUNCEMENT,
          title: input.title,
          message: input.message,
          related_entity: 'ANNOUNCEMENT',
          related_id: announcement.id,
        }))
      );
    }

    // The latest pushed announcement also greets visitors as a popup on the login page
    if (input.showOnLoginPage !== false) {
      await SettingsService.setLoginAnnouncement(input.title, input.message, adminId);
    }

    await ActivityLogService.log({
      userId: adminId,
      action: 'ANNOUNCEMENT_SENT',
      entity: 'ANNOUNCEMENT',
      entityId: announcement.id,
      description: `Admin #${adminId} sent announcement "${input.title}" to ${recipients.length} customer(s)`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      id: announcement.id,
      title: announcement.title,
      message: announcement.message,
      recipientsCount: announcement.recipients_count,
      createdAt: toIso(announcement.created_at),
    };
  }

  public static async listAnnouncements(params: { page?: unknown; limit?: unknown }) {
    const { page, limit, offset } = getPagination(params, 10);

    const { count, rows } = await Announcement.findAndCountAll({
      limit,
      offset,
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
      include: [{ model: User, as: 'author', attributes: ['id', 'email', 'role'] }],
    });

    return {
      announcements: rows.map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        recipientsCount: a.recipients_count,
        createdBy: (a as any).author?.email || `Admin #${a.created_by}`,
        createdAt: toIso(a.created_at),
      })),
      meta: buildMeta(page, limit, count),
    };
  }
}
