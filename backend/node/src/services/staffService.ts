import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User } from '../models/index.js';
import { UserRole, UserStatus } from '../types/index.js';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../utils/errors.js';
import { ActivityLogService } from './activityLogService.js';
import { CreateStaffInput } from '../validators/staffValidators.js';

export class StaffService {
  /**
   * List all administrative/staff members (Super Admin, Admin, Editor)
   */
  public static async listStaff() {
    const staffMembers = await User.findAll({
      where: {
        role: {
          [Op.in]: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
        },
      },
      attributes: ['id', 'email', 'phone', 'role', 'status', 'last_login_at', 'created_at', 'updated_at'],
      order: [
        ['role', 'ASC'],
        ['created_at', 'ASC'],
      ],
    });

    return staffMembers.map((s) => ({
      id: s.id,
      email: s.email,
      phone: s.phone,
      role: s.role,
      status: s.status,
      lastLoginAt: s.last_login_at,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  }

  /**
   * Create a new staff operator (Super Admin, Admin, Editor)
   */
  public static async createStaff(
    input: CreateStaffInput,
    operatorId: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const { email, phone, password, role } = input;

    // Check email uniqueness
    const existingEmail = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existingEmail) {
      throw new ConflictError('A user with this email address already exists');
    }

    // Check phone uniqueness
    const existingPhone = await User.findOne({ where: { phone: phone.trim() } });
    if (existingPhone) {
      throw new ConflictError('A user with this phone number already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newStaff = await User.create({
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password_hash,
      role,
      status: UserStatus.ACTIVE,
    });

    // Audit log
    await ActivityLogService.log({
      userId: operatorId,
      action: 'STAFF_MEMBER_CREATED',
      entity: 'USER',
      entityId: newStaff.id,
      description: `Operator #${operatorId} created staff member ${email} with role ${role}`,
      ipAddress,
      userAgent,
    });

    return {
      id: newStaff.id,
      email: newStaff.email,
      phone: newStaff.phone,
      role: newStaff.role,
      status: newStaff.status,
      createdAt: newStaff.created_at,
    };
  }

  /**
   * Update a staff member's RBAC role
   */
  public static async updateStaffRole(
    staffId: number,
    newRole: UserRole,
    operatorId: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const target = await User.findByPk(staffId);
    if (!target || target.role === UserRole.CUSTOMER) {
      throw new NotFoundError('Staff member record not found');
    }

    // Prevent demoting the last SUPER_ADMIN
    if (target.role === UserRole.SUPER_ADMIN && newRole !== UserRole.SUPER_ADMIN) {
      const superAdminCount = await User.count({ where: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE } });
      if (superAdminCount <= 1) {
        throw new BadRequestError('Cannot demote the last active Super Admin. Assign another Super Admin first.');
      }
    }

    const previousRole = target.role;
    target.role = newRole;
    await target.save();

    // Audit log
    await ActivityLogService.log({
      userId: operatorId,
      action: 'RBAC_ROLE_UPDATED',
      entity: 'USER',
      entityId: target.id,
      description: `Operator #${operatorId} changed ${target.email} role from ${previousRole} to ${newRole}`,
      ipAddress,
      userAgent,
    });

    return {
      id: target.id,
      email: target.email,
      role: target.role,
      previousRole,
    };
  }

  /**
   * Update staff account status (Active / Suspended)
   */
  public static async updateStaffStatus(
    staffId: number,
    status: UserStatus,
    operatorId: number,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (staffId === operatorId) {
      throw new ForbiddenError('You cannot suspend or modify your own active staff account status.');
    }

    const target = await User.findByPk(staffId);
    if (!target || target.role === UserRole.CUSTOMER) {
      throw new NotFoundError('Staff member record not found');
    }

    if (target.role === UserRole.SUPER_ADMIN && status !== UserStatus.ACTIVE) {
      const superAdminCount = await User.count({ where: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE } });
      if (superAdminCount <= 1) {
        throw new BadRequestError('Cannot deactivate the last active Super Admin.');
      }
    }

    const previousStatus = target.status;
    target.status = status;
    await target.save();

    // Audit log
    await ActivityLogService.log({
      userId: operatorId,
      action: 'STAFF_STATUS_UPDATED',
      entity: 'USER',
      entityId: target.id,
      description: `Operator #${operatorId} changed staff ${target.email} status to ${status}${reason ? ` (${reason})` : ''}`,
      ipAddress,
      userAgent,
    });

    return {
      id: target.id,
      email: target.email,
      status: target.status,
      previousStatus,
    };
  }

  /**
   * Delete a staff account
   */
  public static async deleteStaff(
    staffId: number,
    operatorId: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (staffId === operatorId) {
      throw new ForbiddenError('You cannot delete your own staff account.');
    }

    const target = await User.findByPk(staffId);
    if (!target || target.role === UserRole.CUSTOMER) {
      throw new NotFoundError('Staff member not found');
    }

    if (target.role === UserRole.SUPER_ADMIN) {
      const superAdminCount = await User.count({ where: { role: UserRole.SUPER_ADMIN } });
      if (superAdminCount <= 1) {
        throw new BadRequestError('Cannot delete the last Super Admin.');
      }
    }

    const email = target.email;
    const role = target.role;
    await target.destroy();

    // Audit log
    await ActivityLogService.log({
      userId: operatorId,
      action: 'STAFF_MEMBER_DELETED',
      entity: 'USER',
      entityId: staffId,
      description: `Operator #${operatorId} deleted staff account: ${email} (${role})`,
      ipAddress,
      userAgent,
    });

    return {
      id: staffId,
      deleted: true,
      email,
    };
  }
}
