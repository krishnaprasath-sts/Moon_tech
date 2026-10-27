import crypto from 'crypto';
import { Op, WhereOptions } from 'sequelize';
import { SupportGuest, SupportGuestMessage, User } from '../models/index.js';
import { SupportSender, SupportTopic } from '../types/index.js';
import { NotFoundError, UnauthorizedError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { toIso } from '../utils/dates.js';
import { RequestMeta, getPagination, buildMeta } from '../utils/http.js';
import { config } from '../config/index.js';
import { ActivityLogService } from './activityLogService.js';
import { EmailService } from './emailService.js';
import { GuestSendInput, GuestThreadsQuery, SupportReplyInput } from '../validators/supportValidators.js';

export interface GuestMessageDto {
  id: number;
  guestId: number;
  topic: SupportTopic;
  sender: SupportSender;
  adminUserId: number | null;
  adminEmail: string | null;
  message: string;
  readByGuest: boolean;
  readByAdmin: boolean;
  createdAt: string | null;
}

export interface GuestThreadDto {
  guestId: number;
  name: string;
  email: string;
  phone: string;
  topics: SupportTopic[];
  lastMessage: string;
  lastTopic: SupportTopic;
  lastSender: SupportSender;
  lastMessageAt: string | null;
  unreadCount: number;
  messageCount: number;
}

/** A visitor message on a topic starts a new conversation when nothing was sent on it for this long */
const AUTO_REPLY_WINDOW_MS = 30 * 60 * 1000;

const TOPIC_LABELS: Record<SupportTopic, string> = {
  [SupportTopic.KYC]: 'KYC',
  [SupportTopic.DEPOSIT]: 'adding money (deposit)',
  [SupportTopic.WITHDRAWAL]: 'a withdrawal',
  [SupportTopic.PLANS]: 'investment plans',
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

function normalisePhone(phone?: string | null): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return `+91${digits.slice(-10)}`;
}

function autoReplyText(topic: SupportTopic, name: string, email: string): string {
  const first = (name || '').trim().split(/\s+/)[0] || 'there';
  return (
    `Hi ${first}, thanks for contacting Clyvus Ventures support. We have received your question about ${TOPIC_LABELS[topic]}. ` +
    `A team member will reply here, usually within one working day, and we will also send the reply to ${email}. ` +
    'Already have an account? Sign in and use this chat to get help with your own KYC, deposits and withdrawals.'
  );
}

function serialize(m: SupportGuestMessage): GuestMessageDto {
  const admin = (m as any).admin as User | undefined;
  return {
    id: m.id,
    guestId: m.guest_id,
    topic: m.topic,
    sender: m.sender,
    adminUserId: m.admin_user_id ?? null,
    adminEmail: admin?.email ?? null,
    message: m.message,
    readByGuest: Boolean(m.read_by_guest),
    readByAdmin: Boolean(m.read_by_admin),
    createdAt: toIso(m.created_at),
  };
}

function serializeGuest(g: SupportGuest) {
  return { guestId: g.id, name: g.name, email: g.email, phone: g.phone || '' };
}

const adminInclude = { model: User, as: 'admin', attributes: ['id', 'email'], required: false };

/**
 * Support chat for visitors who are not signed in. Kept apart from the customer chat because a
 * visitor has no account; admins answer both from the Support page.
 */
export class GuestSupportService {
  private static async findByToken(token: string): Promise<SupportGuest> {
    const guest = await SupportGuest.findOne({ where: { token_hash: hashToken(token) } });
    if (!guest) throw new UnauthorizedError('This chat session has expired. Please start a new conversation.');
    return guest;
  }

  // ----------------------------------------------------------------- visitor

  public static async send(input: GuestSendInput, meta: RequestMeta = {}) {
    let guest: SupportGuest;
    let token = input.token;

    if (token) {
      guest = await this.findByToken(token);
    } else {
      token = crypto.randomBytes(32).toString('hex');
      guest = await SupportGuest.create({
        token_hash: hashToken(token),
        name: input.name!.trim(),
        email: input.email!.trim().toLowerCase(),
        phone: normalisePhone(input.phone),
      });
    }

    const burstStart = new Date(Date.now() - AUTO_REPLY_WINDOW_MS);
    const recentOnTopic = await SupportGuestMessage.count({
      where: { guest_id: guest.id, topic: input.topic, sender: SupportSender.CUSTOMER, created_at: { [Op.gte]: burstStart } },
    });

    const row = await SupportGuestMessage.create({
      guest_id: guest.id,
      topic: input.topic,
      sender: SupportSender.CUSTOMER,
      message: input.message,
      read_by_guest: true,
      read_by_admin: false,
    });

    let autoReply: SupportGuestMessage | null = null;
    if (recentOnTopic === 0) {
      autoReply = await SupportGuestMessage.create({
        guest_id: guest.id,
        topic: input.topic,
        sender: SupportSender.ADMIN,
        admin_user_id: null,
        message: autoReplyText(input.topic, guest.name, guest.email),
        read_by_guest: true,
        read_by_admin: true,
      });
    }

    guest.last_message_at = new Date();
    await guest.save();

    await ActivityLogService.log({
      userId: null,
      action: 'SUPPORT_GUEST_MESSAGE_SENT',
      entity: 'SUPPORT_GUEST_MESSAGE',
      entityId: row.id,
      description: `Visitor ${guest.email} wrote to support about ${input.topic}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    }).catch((err) => logger.warn(`Could not log visitor support message: ${err?.message || err}`));

    const to = config.supportEmail;
    if (!to) {
      logger.warn('SUPPORT_EMAIL is not configured; visitor support email skipped');
    } else {
      EmailService.sendSupportRequestEmail(to, {
        customerName: `${guest.name} (visitor, not signed in)`,
        customerEmail: guest.email,
        customerPhone: guest.phone || '',
        topic: input.topic,
        message: input.message,
      }).catch((err) => logger.error('Failed to email visitor support request', err));
    }

    return {
      token,
      guest: serializeGuest(guest),
      message: serialize(row),
      autoReply: autoReply ? serialize(autoReply) : null,
    };
  }

  /** The visitor's conversation; marks the admin's replies as read */
  public static async thread(token: string) {
    const guest = await this.findByToken(token);
    const rows = await SupportGuestMessage.findAll({
      where: { guest_id: guest.id },
      order: [
        ['created_at', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: 200,
      include: [adminInclude],
    });

    const unreadIds = rows.filter((m) => m.sender === SupportSender.ADMIN && !m.read_by_guest).map((m) => m.id);
    if (unreadIds.length > 0) {
      await SupportGuestMessage.update({ read_by_guest: true }, { where: { id: { [Op.in]: unreadIds } } });
      rows.forEach((m) => {
        if (unreadIds.includes(m.id)) m.read_by_guest = true;
      });
    }

    return { guest: serializeGuest(guest), messages: rows.map(serialize) };
  }

  public static async unreadForGuest(token: string) {
    const guest = await this.findByToken(token);
    const unreadCount = await SupportGuestMessage.count({
      where: { guest_id: guest.id, sender: SupportSender.ADMIN, read_by_guest: false },
    });
    return { unreadCount };
  }

  // ------------------------------------------------------------------- admin

  public static async listThreadsForAdmin(params: GuestThreadsQuery) {
    const { page, limit, offset } = getPagination(params, 20);

    const guestWhere: WhereOptions = {};
    const search = params.search?.trim();
    if (search) {
      const like = `%${search}%`;
      (guestWhere as any)[Op.or] = [{ name: { [Op.like]: like } }, { email: { [Op.like]: like } }, { phone: { [Op.like]: like } }];
    }

    const guests = await SupportGuest.findAll({
      where: guestWhere,
      order: [['last_message_at', 'DESC']],
      include: [{ model: SupportGuestMessage, as: 'messages', attributes: ['id', 'topic', 'sender', 'message', 'read_by_admin', 'created_at'] }],
    });

    let list: GuestThreadDto[] = guests
      .map((g) => {
        const msgs = (((g as any).messages || []) as SupportGuestMessage[]).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id - b.id
        );
        if (msgs.length === 0) return null;
        const last = msgs[msgs.length - 1];
        return {
          guestId: g.id,
          name: g.name,
          email: g.email,
          phone: g.phone || '',
          topics: Array.from(new Set(msgs.map((m) => m.topic))),
          lastMessage: last.message,
          lastTopic: last.topic,
          lastSender: last.sender,
          lastMessageAt: toIso(last.created_at),
          unreadCount: msgs.filter((m) => m.sender === SupportSender.CUSTOMER && !m.read_by_admin).length,
          messageCount: msgs.length,
        };
      })
      .filter((t): t is GuestThreadDto => t !== null);

    if (params.status === 'open') list = list.filter((t) => t.unreadCount > 0);

    list.sort((a, b) => {
      if (a.unreadCount > 0 !== b.unreadCount > 0) return a.unreadCount > 0 ? -1 : 1;
      return (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '');
    });

    return { threads: list.slice(offset, offset + limit), meta: buildMeta(page, limit, list.length) };
  }

  public static async getThreadForAdmin(guestId: number) {
    const guest = await SupportGuest.findByPk(guestId);
    if (!guest) throw new NotFoundError('Visitor conversation not found');

    const rows = await SupportGuestMessage.findAll({
      where: { guest_id: guestId },
      order: [
        ['created_at', 'ASC'],
        ['id', 'ASC'],
      ],
      include: [adminInclude],
    });

    const unreadIds = rows.filter((m) => m.sender === SupportSender.CUSTOMER && !m.read_by_admin).map((m) => m.id);
    if (unreadIds.length > 0) {
      await SupportGuestMessage.update({ read_by_admin: true }, { where: { id: { [Op.in]: unreadIds } } });
      rows.forEach((m) => {
        if (unreadIds.includes(m.id)) m.read_by_admin = true;
      });
    }

    return { guest: serializeGuest(guest), messages: rows.map(serialize) };
  }

  public static async replyFromAdmin(adminUserId: number, guestId: number, input: SupportReplyInput, meta: RequestMeta = {}) {
    const guest = await SupportGuest.findByPk(guestId);
    if (!guest) throw new NotFoundError('Visitor conversation not found');

    const row = await SupportGuestMessage.create({
      guest_id: guestId,
      topic: input.topic,
      sender: SupportSender.ADMIN,
      admin_user_id: adminUserId,
      message: input.message,
      read_by_guest: false,
      read_by_admin: true,
    });

    await SupportGuestMessage.update(
      { read_by_admin: true },
      { where: { guest_id: guestId, topic: input.topic, sender: SupportSender.CUSTOMER, read_by_admin: false } }
    );

    // The visitor may have closed the page, so the reply always goes by email too
    EmailService.sendGuestSupportReplyEmail(guest.email, {
      name: guest.name,
      topic: input.topic,
      message: input.message,
    }).catch((err) => logger.error('Failed to email support reply to visitor', err));

    await ActivityLogService.log({
      userId: adminUserId,
      action: 'SUPPORT_GUEST_REPLY_SENT',
      entity: 'SUPPORT_GUEST_MESSAGE',
      entityId: row.id,
      description: `Admin #${adminUserId} replied to visitor ${guest.email} about ${input.topic}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const saved = await SupportGuestMessage.findByPk(row.id, { include: [adminInclude] });
    return serialize(saved || row);
  }

  public static async unreadCountForAdmin() {
    const [unreadCount, openThreads] = await Promise.all([
      SupportGuestMessage.count({ where: { sender: SupportSender.CUSTOMER, read_by_admin: false } }),
      SupportGuestMessage.count({
        where: { sender: SupportSender.CUSTOMER, read_by_admin: false },
        distinct: true,
        col: 'guest_id',
      }),
    ]);
    return { unreadCount, openThreads };
  }
}
