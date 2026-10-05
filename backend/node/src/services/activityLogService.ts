import { ActivityLog, User } from '../models/index.js';
import { PaginationParams } from '../types/index.js';
import { Op } from 'sequelize';

export interface CreateLogParams {
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class ActivityLogService {
  /**
   * Records a new audit log
   */
  public static async log(params: CreateLogParams): Promise<ActivityLog> {
    try {
      return await ActivityLog.create({
        user_id: params.userId || null,
        action: params.action,
        entity: params.entity,
        entity_id: params.entityId ? String(params.entityId) : null,
        description: params.description,
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
      });
    } catch (err) {
      console.error('Failed to create activity log:', err);
      // We do not throw from activity logging to avoid failing primary business actions
      return null as any;
    }
  }

  /**
   * Retrieves paginated activity logs
   */
  public static async getLogs(
    params: PaginationParams & { entity?: string; action?: string; userId?: number }
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const offset = (page - 1) * limit;

    const where: any = {};

    if (params.entity) {
      where.entity = params.entity;
    }

    if (params.action) {
      where.action = params.action;
    }

    if (params.userId) {
      where.user_id = params.userId;
    }

    if (params.search) {
      where[Op.or] = [
        { description: { [Op.like]: `%${params.search}%` } },
        { action: { [Op.like]: `%${params.search}%` } },
        { entity: { [Op.like]: `%${params.search}%` } },
      ];
    }

    const { count, rows } = await ActivityLog.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'role'],
        },
      ],
    });

    return {
      logs: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }
}
