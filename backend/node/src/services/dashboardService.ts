import { Op } from 'sequelize';
import { User, CustomerProfile, KycProfile, ActivityLog } from '../models/index.js';
import { UserRole, KycStatus, DashboardStats } from '../types/index.js';

export class DashboardService {
  /**
   * Retrieves aggregated dashboard metrics with optimized SQL queries
   */
  public static async getStats(): Promise<DashboardStats> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Parallel count queries
    const [
      totalCustomers,
      pendingKyc,
      verifiedKyc,
      rejectedKyc,
      resubmissionKyc,
      draftKyc,
      newCustomersToday,
      recentUsers,
      recentKycProfiles,
      recentLogs,
    ] = await Promise.all([
      User.count({ where: { role: UserRole.CUSTOMER } }),
      KycProfile.count({ where: { kyc_status: KycStatus.PENDING } }),
      KycProfile.count({ where: { kyc_status: KycStatus.VERIFIED } }),
      KycProfile.count({ where: { kyc_status: KycStatus.REJECTED } }),
      KycProfile.count({ where: { kyc_status: KycStatus.RESUBMISSION_REQUIRED } }),
      KycProfile.count({ where: { kyc_status: KycStatus.DRAFT } }),
      User.count({
        where: {
          role: UserRole.CUSTOMER,
          created_at: { [Op.gte]: todayStart },
        },
      }),
      // Recent registrations (5)
      User.findAll({
        where: { role: UserRole.CUSTOMER },
        limit: 5,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'email', 'phone', 'status', 'created_at'],
        include: [
          {
            model: CustomerProfile,
            as: 'profile',
            attributes: ['full_name', 'referral_code', 'city'],
          },
          {
            model: KycProfile,
            as: 'kyc',
            attributes: ['id', 'kyc_status'],
          },
        ],
      }),
      // Recent KYC submissions (5)
      KycProfile.findAll({
        where: {
          kyc_status: { [Op.in]: [KycStatus.PENDING, KycStatus.UNDER_REVIEW, KycStatus.RESUBMISSION_REQUIRED] },
        },
        limit: 5,
        order: [['submitted_at', 'DESC']],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'phone'],
            include: [{ model: CustomerProfile, as: 'profile', attributes: ['full_name', 'referral_code'] }],
          },
        ],
      }),
      // Recent admin activity (5)
      ActivityLog.findAll({
        limit: 6,
        order: [['created_at', 'DESC']],
        include: [{ model: User, as: 'user', attributes: ['id', 'email', 'role'] }],
      }),
    ]);

    // Registration trend for past 7 days
    const registrationTrend: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      // Label with the local calendar date so it matches the local day range queried below
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);

      const count = await User.count({
        where: {
          role: UserRole.CUSTOMER,
          created_at: { [Op.between]: [start, end] },
        },
      });

      registrationTrend.push({
        date: dateStr,
        count,
      });
    }

    const kycStatusDistribution = [
      { name: 'Verified', value: verifiedKyc, color: '#10b981' },
      { name: 'Pending', value: pendingKyc, color: '#f59e0b' },
      { name: 'Rejected', value: rejectedKyc, color: '#f43f5e' },
      { name: 'Resubmit', value: resubmissionKyc, color: '#8b5cf6' },
      { name: 'Draft', value: draftKyc, color: '#64748b' },
    ];

    return {
      totalCustomers,
      pendingKyc,
      verifiedKyc,
      rejectedKyc,
      newCustomersToday,
      recentRegistrations: recentUsers.map((u: any) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        fullName: u.profile?.full_name || 'N/A',
        referralCode: u.profile?.referral_code || 'N/A',
        city: u.profile?.city || 'N/A',
        kycId: u.kyc?.id || null,
        kycStatus: u.kyc?.kyc_status || 'DRAFT',
        createdAt: u.created_at,
      })),
      recentKycSubmissions: recentKycProfiles.map((k: any) => ({
        id: k.id,
        userId: k.user_id,
        fullName: k.user?.profile?.full_name || 'N/A',
        email: k.user?.email || 'N/A',
        phone: k.user?.phone || 'N/A',
        referralCode: k.user?.profile?.referral_code || 'N/A',
        kycStatus: k.kyc_status,
        submittedAt: k.submitted_at || k.created_at,
      })),
      recentAdminActivity: recentLogs.map((l: any) => ({
        id: l.id,
        action: l.action,
        description: l.description,
        entity: l.entity,
        ipAddress: l.ip_address,
        createdAt: l.created_at,
        user: l.user ? { email: l.user.email, role: l.user.role } : null,
      })),
      kycStatusDistribution,
      registrationTrend,
    };
  }
}
