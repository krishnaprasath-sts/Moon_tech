import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { BankChangeStatus } from '../types/index.js';

/**
 * A customer's request to replace the bank account that withdrawals are paid to.
 * The current account keeps receiving payouts until an admin approves the request;
 * the previous account is copied here so the change can always be traced.
 */
export interface BankChangeRequestAttributes {
  id: number;
  user_id: number;
  status: BankChangeStatus;
  account_holder_name: string;
  account_number_encrypted: string;
  account_last4: string;
  account_hash: string;
  ifsc_code: string;
  bank_name: string;
  bank_branch: string;
  proof_document: string;
  reason?: string | null;
  previous_account_holder?: string | null;
  previous_account_last4?: string | null;
  previous_account_hash?: string | null;
  previous_ifsc?: string | null;
  previous_bank_name?: string | null;
  previous_bank_branch?: string | null;
  admin_remarks?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: Date | null;
  ip_address?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface BankChangeRequestCreationAttributes
  extends Optional<
    BankChangeRequestAttributes,
    | 'id'
    | 'reason'
    | 'previous_account_holder'
    | 'previous_account_last4'
    | 'previous_account_hash'
    | 'previous_ifsc'
    | 'previous_bank_name'
    | 'previous_bank_branch'
    | 'admin_remarks'
    | 'reviewed_by'
    | 'reviewed_at'
    | 'ip_address'
    | 'created_at'
    | 'updated_at'
  > {}

export class BankChangeRequest
  extends Model<BankChangeRequestAttributes, BankChangeRequestCreationAttributes>
  implements BankChangeRequestAttributes
{
  declare public id: number;
  declare public user_id: number;
  declare public status: BankChangeStatus;
  declare public account_holder_name: string;
  declare public account_number_encrypted: string;
  declare public account_last4: string;
  declare public account_hash: string;
  declare public ifsc_code: string;
  declare public bank_name: string;
  declare public bank_branch: string;
  declare public proof_document: string;
  declare public reason: string | null;
  declare public previous_account_holder: string | null;
  declare public previous_account_last4: string | null;
  declare public previous_account_hash: string | null;
  declare public previous_ifsc: string | null;
  declare public previous_bank_name: string | null;
  declare public previous_bank_branch: string | null;
  declare public admin_remarks: string | null;
  declare public reviewed_by: number | null;
  declare public reviewed_at: Date | null;
  declare public ip_address: string | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

BankChangeRequest.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(BankChangeStatus)),
      allowNull: false,
      defaultValue: BankChangeStatus.PENDING,
    },
    account_holder_name: { type: DataTypes.STRING(255), allowNull: false },
    account_number_encrypted: { type: DataTypes.TEXT, allowNull: false },
    account_last4: { type: DataTypes.STRING(4), allowNull: false },
    account_hash: { type: DataTypes.STRING(64), allowNull: false },
    ifsc_code: { type: DataTypes.STRING(20), allowNull: false },
    bank_name: { type: DataTypes.STRING(100), allowNull: false },
    bank_branch: { type: DataTypes.STRING(100), allowNull: false },
    proof_document: { type: DataTypes.STRING(255), allowNull: false },
    reason: { type: DataTypes.STRING(500), allowNull: true },
    previous_account_holder: { type: DataTypes.STRING(255), allowNull: true },
    previous_account_last4: { type: DataTypes.STRING(4), allowNull: true },
    previous_account_hash: { type: DataTypes.STRING(64), allowNull: true },
    previous_ifsc: { type: DataTypes.STRING(20), allowNull: true },
    previous_bank_name: { type: DataTypes.STRING(100), allowNull: true },
    previous_bank_branch: { type: DataTypes.STRING(100), allowNull: true },
    admin_remarks: { type: DataTypes.STRING(500), allowNull: true },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    reviewed_at: { type: DataTypes.DATE, allowNull: true },
    ip_address: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    sequelize,
    tableName: 'bank_change_requests',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['user_id'] }, { fields: ['status'] }, { fields: ['account_hash'] }],
  }
);
