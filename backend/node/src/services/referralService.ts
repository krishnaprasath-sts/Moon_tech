import { User, CustomerProfile, KycProfile, Referral } from '../models/index.js';
import { PaginationParams } from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';
import { Op } from 'sequelize';

export class ReferralService {
  /**
   * Customer retrieves their own referral statistics and referred network
   */
  public static async getMyReferrals(userId: number) {
    const profile = await CustomerProfile.findOne({ where: { user_id: userId } });
    if (!profile) {
      throw new NotFoundError('Customer profile not found');
    }

    const referrals = await Referral.findAll({
      where: { referrer_user_id: userId },
      include: [
        {
          model: User,
          as: 'referred',
          attributes: ['id', 'email', 'phone', 'created_at', 'status'],
          include: [
            {
              model: CustomerProfile,
              as: 'profile',
              attributes: ['full_name', 'created_at'],
            },
            {
              model: KycProfile,
              as: 'kyc',
              attributes: ['kyc_status'],
            },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const referredUsers = referrals.map((r: any) => {
      const u = r.referred;
      const p = u?.profile;
      const k = u?.kyc;

      return {
        id: r.id,
        referredUserId: r.referred_user_id,
        fullName: p?.full_name || 'N/A',
        email: u?.email || 'N/A',
        phone: u?.phone || 'N/A',
        kycStatus: k?.kyc_status || 'DRAFT',
        accountStatus: u?.status,
        joinedAt: r.created_at,
        status: r.status,
      };
    });

    return {
      referralCode: profile.referral_code,
      referredBy: profile.referred_by,
      totalReferrals: referredUsers.length,
      verifiedReferrals: referredUsers.filter((u) => u.kycStatus === 'VERIFIED').length,
      pendingKycReferrals: referredUsers.filter((u) => u.kycStatus === 'PENDING').length,
      referrals: referredUsers,
    };
  }

  /**
   * Admin retrieves all referral relationships
   */
  public static async getAllReferrals(params: PaginationParams) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where[Op.or] = [
        { referral_code: { [Op.like]: `%${params.search}%` } },
      ];
    }

    const { count, rows } = await Referral.findAndCountAll({
      where,
      limit,
      offset,
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

    const items = rows.map((r: any) => ({
      id: r.id,
      referralCode: r.referral_code,
      status: r.status,
      createdAt: r.created_at,
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
    }));

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
}
