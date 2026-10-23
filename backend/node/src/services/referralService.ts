import { Op } from 'sequelize';
import { User, CustomerProfile, KycProfile, Referral, ReferralCommission, Investment } from '../models/index.js';
import { PaginationParams, ReferralCommissionStatus } from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';
import { toPaise, fromPaise } from '../utils/money.js';
import { toIso } from '../utils/dates.js';
import { maskEmail, maskPhone } from '../utils/mask.js';
import { SettingsService } from './settingsService.js';

const sumPaise = (values: (number | null | undefined)[]) =>
  values.reduce<number>((acc, v) => acc + toPaise(v ?? 0), 0);

function serializeCommission(c: ReferralCommission) {
  const inv: Investment | undefined = (c as any).investment;
  const referred = (c as any).referred;
  return {
    id: c.id,
    referredUserId: c.referred_user_id,
    referredName: referred?.profile?.full_name || 'N/A',
    investmentId: c.investment_id,
    investmentReference: inv?.reference || null,
    planName: inv?.plan_name || null,
    investmentAmount: c.investment_amount,
    commissionPercent: c.commission_percent,
    amount: c.amount,
    status: c.status,
    eligibleAt: toIso(c.eligible_at),
    creditedAt: toIso(c.credited_at),
    cancelledAt: toIso(c.cancelled_at),
    createdAt: toIso(c.created_at),
  };
}

export class ReferralService {
  /**
   * Customer retrieves their own referral statistics, referred network and commissions
   */
  public static async getMyReferrals(userId: number) {
    const profile = await CustomerProfile.findOne({ where: { user_id: userId } });
    if (!profile) {
      throw new NotFoundError('Customer profile not found');
    }

    const [referrals, commissions, settings] = await Promise.all([
      Referral.findAll({
        where: { referrer_user_id: userId },
        include: [
          {
            model: User,
            as: 'referred',
            attributes: ['id', 'email', 'phone', 'created_at', 'status'],
            include: [
              { model: CustomerProfile, as: 'profile', attributes: ['full_name', 'created_at'] },
              { model: KycProfile, as: 'kyc', attributes: ['kyc_status'] },
            ],
          },
        ],
        order: [['created_at', 'DESC']],
      }),
      ReferralCommission.findAll({
        where: { referrer_user_id: userId },
        include: [
          { model: Investment, as: 'investment', attributes: ['id', 'reference', 'plan_name'] },
          {
            model: User,
            as: 'referred',
            attributes: ['id'],
            include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
          },
        ],
        order: [
          ['created_at', 'DESC'],
          ['id', 'DESC'],
        ],
        limit: 100,
      }),
      SettingsService.getSettings(),
    ]);

    const earnedByUser = new Map<number, number>();
    for (const c of commissions) {
      if (c.status !== ReferralCommissionStatus.CREDITED) continue;
      earnedByUser.set(c.referred_user_id, (earnedByUser.get(c.referred_user_id) ?? 0) + toPaise(c.amount));
    }

    const referredUsers = referrals.map((r: any) => {
      const u = r.referred;
      const p = u?.profile;
      const k = u?.kyc;

      return {
        id: r.id,
        referredUserId: r.referred_user_id,
        fullName: p?.full_name || 'N/A',
        // Contact details of other customers are never shown in full to a referrer
        email: u?.email ? maskEmail(u.email) : 'N/A',
        phone: u?.phone ? maskPhone(u.phone) : 'N/A',
        kycStatus: k?.kyc_status || 'DRAFT',
        accountStatus: u?.status,
        joinedAt: r.created_at,
        status: r.status,
        commissionEarned: fromPaise(earnedByUser.get(r.referred_user_id) ?? 0),
      };
    });

    const credited = commissions.filter((c) => c.status === ReferralCommissionStatus.CREDITED);
    const pending = commissions.filter((c) => c.status === ReferralCommissionStatus.PENDING);

    return {
      referralCode: profile.referral_code,
      referredBy: profile.referred_by,
      commissionPercent: settings.referralCommissionPercent,
      totalReferrals: referredUsers.length,
      verifiedReferrals: referredUsers.filter((u) => u.kycStatus === 'VERIFIED').length,
      pendingKycReferrals: referredUsers.filter((u) => u.kycStatus === 'PENDING').length,
      totalCommissionEarned: fromPaise(sumPaise(credited.map((c) => c.amount))),
      pendingCommission: fromPaise(sumPaise(pending.map((c) => c.amount))),
      pendingCommissionCount: pending.length,
      referrals: referredUsers,
      commissions: commissions.map(serializeCommission),
    };
  }

  /**
   * Admin retrieves all referral relationships with the commission each one produced
   */
  public static async getAllReferrals(params: PaginationParams) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where[Op.or] = [
        { referral_code: { [Op.like]: `%${params.search}%` } },
        { '$referrer.email$': { [Op.like]: `%${params.search}%` } },
        { '$referred.email$': { [Op.like]: `%${params.search}%` } },
        { '$referrer.profile.full_name$': { [Op.like]: `%${params.search}%` } },
        { '$referred.profile.full_name$': { [Op.like]: `%${params.search}%` } },
      ];
    }

    const { count, rows } = await Referral.findAndCountAll({
      where,
      limit,
      offset,
      subQuery: false,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'referrer',
          attributes: ['id', 'email', 'phone'],
          include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name', 'referral_code'] }],
        },
        {
          model: User,
          as: 'referred',
          attributes: ['id', 'email', 'phone', 'status'],
          include: [
            { model: CustomerProfile, as: 'profile', attributes: ['full_name', 'referral_code'] },
            { model: KycProfile, as: 'kyc', attributes: ['kyc_status'] },
          ],
        },
      ],
    });

    const referredIds = rows.map((r) => r.referred_user_id);
    const commissions = referredIds.length
      ? await ReferralCommission.findAll({
          where: { referred_user_id: { [Op.in]: referredIds } },
          attributes: ['referrer_user_id', 'referred_user_id', 'amount', 'status'],
        })
      : [];

    const totals = new Map<string, { credited: number; pending: number; count: number }>();
    for (const c of commissions) {
      const key = `${c.referrer_user_id}:${c.referred_user_id}`;
      const entry = totals.get(key) ?? { credited: 0, pending: 0, count: 0 };
      entry.count += 1;
      if (c.status === ReferralCommissionStatus.CREDITED) entry.credited += toPaise(c.amount);
      if (c.status === ReferralCommissionStatus.PENDING) entry.pending += toPaise(c.amount);
      totals.set(key, entry);
    }

    const items = rows.map((r: any) => {
      const totalsForPair = totals.get(`${r.referrer_user_id}:${r.referred_user_id}`) ?? {
        credited: 0,
        pending: 0,
        count: 0,
      };
      return {
        id: r.id,
        referralCode: r.referral_code,
        status: r.status,
        createdAt: r.created_at,
        commissionEarned: fromPaise(totalsForPair.credited),
        commissionPending: fromPaise(totalsForPair.pending),
        commissionCount: totalsForPair.count,
        referrer: {
          id: r.referrer?.id,
          name: r.referrer?.profile?.full_name || 'N/A',
          email: r.referrer?.email || 'N/A',
          phone: r.referrer?.phone || 'N/A',
          referralCode: r.referrer?.profile?.referral_code || 'N/A',
        },
        referred: {
          id: r.referred?.id,
          name: r.referred?.profile?.full_name || 'N/A',
          email: r.referred?.email || 'N/A',
          phone: r.referred?.phone || 'N/A',
          kycStatus: r.referred?.kyc?.kyc_status || 'DRAFT',
          accountStatus: r.referred?.status,
        },
      };
    });

    return {
      referrals: items,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Admin: every commission, newest first, with referrer / referred names
   */
  public static async adminListCommissions(params: PaginationParams & { status?: string }) {
    const page = Number(params.page) || 1;
    const limit = Math.min(100, Number(params.limit) || 20);
    const offset = (page - 1) * limit;

    const where: any = {};
    if (params.status && Object.values(ReferralCommissionStatus).includes(params.status as ReferralCommissionStatus)) {
      where.status = params.status;
    }

    const { count, rows } = await ReferralCommission.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
      include: [
        { model: Investment, as: 'investment', attributes: ['id', 'reference', 'plan_name'] },
        {
          model: User,
          as: 'referrer',
          attributes: ['id', 'email', 'phone'],
          include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
        },
        {
          model: User,
          as: 'referred',
          attributes: ['id', 'email', 'phone'],
          include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name'] }],
        },
      ],
    });

    const statusCounts = await Promise.all(
      Object.values(ReferralCommissionStatus).map(async (status) => [
        status,
        await ReferralCommission.count({ where: { status } }),
      ])
    );

    return {
      commissions: rows.map((c: any) => ({
        ...serializeCommission(c),
        referrerUserId: c.referrer_user_id,
        referrerName: c.referrer?.profile?.full_name || 'N/A',
        referrerEmail: c.referrer?.email || 'N/A',
        referredEmail: c.referred?.email || 'N/A',
      })),
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
        counts: Object.fromEntries(statusCounts),
      },
    };
  }
}
