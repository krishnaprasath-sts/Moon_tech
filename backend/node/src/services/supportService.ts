import { Op, WhereOptions } from 'sequelize';
import { SupportMessage, User, CustomerProfile } from '../models/index.js';
import { NotificationType, SupportSender, SupportTopic, UserRole } from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { toIso } from '../utils/dates.js';
import { RequestMeta, getPagination, buildMeta } from '../utils/http.js';
import { config } from '../config/index.js';
import { ActivityLogService } from './activityLogService.js';
import { EmailService } from './emailService.js';
import { NotificationService } from './notificationService.js';
import {
  SendSupportMessageInput,
  SupportReplyInput,
  SupportListQuery,
  SupportThreadsQuery,
  SupportThreadQuery,
} from '../validators/supportValidators.js';

type UserWithProfile = User & { profile?: { full_name?: string | null } | null };

export interface SupportMessageDto {
  id: number;
  userId: number;
  topic: SupportTopic;
  sender: SupportSender;
  adminUserId: number | null;
  adminEmail: string | null;
  message: string;
  readByCustomer: boolean;
  readByAdmin: boolean;
  createdAt: string | null;
}

export interface SupportThreadDto {
  userId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  topics: SupportTopic[];
  lastMessage: string;
  lastTopic: SupportTopic;
  lastSender: SupportSender;
  lastMessageAt: string | null;
  unreadCount: number;
  messageCount: number;
}

function serialize(m: SupportMessage): SupportMessageDto {
  const admin = (m as any).admin as User | undefined;
  return {
    id: m.id,
    userId: m.user_id,
    topic: m.topic,
    sender: m.sender,
    adminUserId: m.admin_user_id ?? null,
    adminEmail: admin?.email ?? null,
    message: m.message,
    readByCustomer: Boolean(m.read_by_customer),
    readByAdmin: Boolean(m.read_by_admin),
    createdAt: toIso(m.created_at),
  };
}

const customerInclude = {
  model: User,
  as: 'customer',
  attributes: ['id', 'email', 'phone'],
  include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
};

const adminInclude = { model: User, as: 'admin', attributes: ['id', 'email'], required: false };

/** A customer message on a topic starts a new conversation when nothing was sent on it for this long */
const AUTO_REPLY_WINDOW_MS = 30 * 60 * 1000;

const TOPIC_NEXT_STEPS: Record<SupportTopic, string> = {
  [SupportTopic.KYC]:
    'Our verification team checks KYC submissions within one working day. You can see your current KYC status on the Dashboard, and we will tell you here and by email if anything else is needed.',
  [SupportTopic.DEPOSIT]:
    'Bank transfers (NEFT / IMPS / RTGS) are verified by our team within a few hours on working days. Once approved, the amount appears in your capital wallet and you receive a notification. Please keep your transfer reference handy.',
  [SupportTopic.WITHDRAWAL]:
    'Withdrawal requests are reviewed and paid to the bank account saved under Profile, Bank details, usually within 1 to 3 working days. You can follow the status on the Wallet page.',
  [SupportTopic.PLANS]:
    'Our team will explain the plan, the profit schedule and the withdrawal rules here. In the meantime the Plans page shows a live example for any amount you choose.',
};

/** The instant acknowledgement posted in the chat when a customer starts a conversation */
function autoReplyText(topic: SupportTopic, name: string, customerId: string | null): string {
  const first = (name || '').trim().split(/\s+/)[0] || 'there';
  const ref = customerId ? ` Your customer ID is ${customerId}; please quote it if you contact us by phone or email.` : '';
  return `Hi ${first}, thanks for writing to Clyvus Ventures support. We have received your message about ${TOPIC_LABELS[topic]} and a team member will reply here, usually within one working day. ${TOPIC_NEXT_STEPS[topic]}${ref}`;
}

const TOPIC_LABELS: Record<SupportTopic, string> = {
  [SupportTopic.KYC]: 'KYC',
  [SupportTopic.DEPOSIT]: 'adding money (deposit)',
  [SupportTopic.WITHDRAWAL]: 'a withdrawal',
  [SupportTopic.PLANS]: 'investment plans',
};

function customerName(user: UserWithProfile | null | undefined): string {
  return user?.profile?.full_name || user?.email || 'Customer';
}

/**
 * Support chat between customers and the admin team, grouped per customer.
 */
export class SupportService {
  // ---------------------------------------------------------------- customer

  public static async listForCustomer(userId: number, params: SupportListQuery) {
    const { page, limit, offset } = getPagination(params, 50);

    const where: WhereOptions = { user_id: userId };
    if (params.topic) (where as any).topic = params.topic;

    const { count, rows } = await SupportMessage.findAndCountAll({
      where,
      limit,
      offset,
      // Newest page first, then flipped so the thread reads top-to-bottom
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
      include: [adminInclude],
    });

    const unreadIds = rows.filter((m) => m.sender === SupportSender.ADMIN && !m.read_by_customer).map((m) => m.id);
    if (unreadIds.length > 0) {
      await SupportMessage.update({ read_by_customer: true }, { where: { id: { [Op.in]: unreadIds } } });
      rows.forEach((m) => {
        if (unreadIds.includes(m.id)) m.read_by_customer = true;
      });
    }

    const unreadCount = await SupportMessage.count({
      where: { user_id: userId, sender: SupportSender.ADMIN, read_by_customer: false },
    });

    return {
      messages: rows.reverse().map(serialize),
      meta: { ...buildMeta(page, limit, count), unreadCount },
    };
  }

  public static async sendFromCustomer(userId: number, input: SendSupportMessageInput, meta: RequestMeta = {}) {
    const user = (await User.findByPk(userId, {
      attributes: ['id', 'email', 'phone'],
      include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name', 'customer_id'] }],
    })) as UserWithProfile | null;
    if (!user) throw new NotFoundError('User not found');

    // Is this the first message of a new conversation on this topic? (Nothing from the customer
    // on it in the last 30 minutes.) Checked before the new row exists.
    const burstStart = new Date(Date.now() - AUTO_REPLY_WINDOW_MS);
    const recentOnTopic = await SupportMessage.count({
      where: { user_id: userId, topic: input.topic, sender: SupportSender.CUSTOMER, created_at: { [Op.gte]: burstStart } },
    });

    const row = await SupportMessage.create({
      user_id: userId,
      topic: input.topic,
      sender: SupportSender.CUSTOMER,
      message: input.message,
      read_by_customer: true,
      read_by_admin: false,
    });

    await ActivityLogService.log({
      userId,
      action: 'SUPPORT_MESSAGE_SENT',
      entity: 'SUPPORT_MESSAGE',
      entityId: row.id,
      description: `Customer #${userId} wrote to support about ${input.topic}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Instant acknowledgement from Support, so the customer sees straight away that the message
    // arrived and what happens next. Stored as an ADMIN message without an admin user (shown as
    // "Support"), already read on both sides so it never counts as unread for anyone.
    let autoReply: SupportMessage | null = null;
    if (recentOnTopic === 0) {
      const profile = (user as any).profile as { customer_id?: string | null } | undefined;
      autoReply = await SupportMessage.create({
        user_id: userId,
        topic: input.topic,
        sender: SupportSender.ADMIN,
        admin_user_id: null,
        message: autoReplyText(input.topic, customerName(user), profile?.customer_id ?? null),
        read_by_customer: true,
        read_by_admin: true,
      });
    }

    // Fire-and-forget: SMTP trouble must never fail the chat
    const to = config.supportEmail;
    if (!to) {
      logger.warn('SUPPORT_EMAIL is not configured; support message email skipped');
    } else {
      EmailService.sendSupportRequestEmail(to, {
        customerName: customerName(user),
        customerEmail: user.email,
        customerPhone: user.phone || '',
        topic: input.topic,
        message: input.message,
      }).catch((err) => logger.error('Failed to email support request', err));
    }

    return { ...serialize(row), autoReply: autoReply ? serialize(autoReply) : null };
  }

  public static async unreadCountForCustomer(userId: number) {
    const unreadCount = await SupportMessage.count({
      where: { user_id: userId, sender: SupportSender.ADMIN, read_by_customer: false },
    });
    return { unreadCount };
  }

  // ------------------------------------------------------------------- admin

  public static async listThreadsForAdmin(params: SupportThreadsQuery) {
    const { page, limit, offset } = getPagination(params, 20);

    const where: WhereOptions = {};
    if (params.topic) (where as any).topic = params.topic;

    // One pass over the (filtered) messages, newest first, grouped per customer in JS
    const rows = await SupportMessage.findAll({
      where,
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
      include: [customerInclude],
    });

    const threads = new Map<number, SupportThreadDto & { topicSet: Set<SupportTopic> }>();
    for (const m of rows) {
      let t = threads.get(m.user_id);
      if (!t) {
        const customer = (m as any).customer as UserWithProfile | undefined;
        t = {
          userId: m.user_id,
          customerName: customerName(customer),
          customerEmail: customer?.email || '',
          customerPhone: customer?.phone || '',
          topics: [],
          topicSet: new Set<SupportTopic>(),
          lastMessage: m.message,
          lastTopic: m.topic,
          lastSender: m.sender,
          lastMessageAt: toIso(m.created_at),
          unreadCount: 0,
          messageCount: 0,
        };
        threads.set(m.user_id, t);
      }
      t.messageCount += 1;
      t.topicSet.add(m.topic);
      if (m.sender === SupportSender.CUSTOMER && !m.read_by_admin) t.unreadCount += 1;
    }

    let list: SupportThreadDto[] = Array.from(threads.values()).map(({ topicSet, ...t }) => ({
      ...t,
      topics: Array.from(topicSet),
    }));

    if (params.status === 'open') list = list.filter((t) => t.unreadCount > 0);

    const search = params.search?.trim().toLowerCase();
    if (search) {
      list = list.filter(
        (t) =>
          t.customerName.toLowerCase().includes(search) ||
          t.customerEmail.toLowerCase().includes(search) ||
          t.customerPhone.toLowerCase().includes(search)
      );
    }

    // Threads with unread customer messages first, then by latest activity
    list.sort((a, b) => {
      if (a.unreadCount > 0 !== b.unreadCount > 0) return a.unreadCount > 0 ? -1 : 1;
      return (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '');
    });

    const total = list.length;
    return {
      threads: list.slice(offset, offset + limit),
      meta: buildMeta(page, limit, total),
    };
  }

  public static async getThreadForAdmin(customerUserId: number, params: SupportThreadQuery) {
    const customer = (await User.findOne({
      where: { id: customerUserId, role: UserRole.CUSTOMER },
      attributes: ['id', 'email', 'phone'],
      include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
    })) as UserWithProfile | null;
    if (!customer) throw new NotFoundError('Customer not found');

    const where: WhereOptions = { user_id: customerUserId };
    if (params.topic) (where as any).topic = params.topic;

    const rows = await SupportMessage.findAll({
      where,
      order: [
        ['created_at', 'ASC'],
        ['id', 'ASC'],
      ],
      include: [adminInclude],
    });

    const unreadIds = rows.filter((m) => m.sender === SupportSender.CUSTOMER && !m.read_by_admin).map((m) => m.id);
    if (unreadIds.length > 0) {
      await SupportMessage.update({ read_by_admin: true }, { where: { id: { [Op.in]: unreadIds } } });
      rows.forEach((m) => {
        if (unreadIds.includes(m.id)) m.read_by_admin = true;
      });
    }

    return {
      customer: {
        userId: customer.id,
        name: customerName(customer),
        email: customer.email,
        phone: customer.phone || '',
      },
      messages: rows.map(serialize),
    };
  }

  public static async replyFromAdmin(
    adminUserId: number,
    customerUserId: number,
    input: SupportReplyInput,
    meta: RequestMeta = {}
  ) {
    const customer = await User.findOne({
      where: { id: customerUserId, role: UserRole.CUSTOMER },
      attributes: ['id'],
    });
    if (!customer) throw new NotFoundError('Customer not found');

    const row = await SupportMessage.create({
      user_id: customerUserId,
      topic: input.topic,
      sender: SupportSender.ADMIN,
      admin_user_id: adminUserId,
      message: input.message,
      read_by_customer: false,
      read_by_admin: true,
    });

    // Everything the customer wrote in this topic counts as handled once an admin replies
    await SupportMessage.update(
      { read_by_admin: true },
      { where: { user_id: customerUserId, topic: input.topic, sender: SupportSender.CUSTOMER, read_by_admin: false } }
    );

    await NotificationService.notify({
      userId: customerUserId,
      type: NotificationType.SUPPORT_REPLY,
      title: 'Support replied',
      message: input.message.slice(0, 200),
      relatedEntity: 'SUPPORT_MESSAGE',
      relatedId: row.id,
    });

    await ActivityLogService.log({
      userId: adminUserId,
      action: 'SUPPORT_REPLY_SENT',
      entity: 'SUPPORT_MESSAGE',
      entityId: row.id,
      description: `Admin #${adminUserId} replied to customer #${customerUserId} about ${input.topic}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const saved = await SupportMessage.findByPk(row.id, { include: [adminInclude] });
    return serialize(saved || row);
  }

  public static async unreadCountForAdmin() {
    const [unreadCount, openThreads] = await Promise.all([
      SupportMessage.count({ where: { sender: SupportSender.CUSTOMER, read_by_admin: false } }),
      SupportMessage.count({
        where: { sender: SupportSender.CUSTOMER, read_by_admin: false },
        distinct: true,
        col: 'user_id',
      }),
    ]);
    return { unreadCount, openThreads };
  }
}
