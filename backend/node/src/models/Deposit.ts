import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { DepositStatus } from '../types/index.js';
import { decimalGetter } from '../utils/money.js';

export interface DepositAttributes {
  id: number;
  reference: string;
  user_id: number;
  amount: number;
  upi_transaction_id: string;
  receipt_file: string;
  status: DepositStatus;
  rejection_reason?: string | null;
  admin_remarks?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface DepositCreationAttributes
  extends Optional<
    DepositAttributes,
    | 'id'
    | 'status'
    | 'rejection_reason'
    | 'admin_remarks'
    | 'reviewed_by'
    | 'reviewed_at'
    | 'created_at'
    | 'updated_at'
  > {}

/**
 * A UPI wallet top-up submitted by a customer, awaiting admin verification
 */
export class Deposit
  extends Model<DepositAttributes, DepositCreationAttributes>
  implements DepositAttributes
{
  declare public id: number;
  declare public reference: string;
  declare public user_id: number;
  declare public amount: number;
  declare public upi_transaction_id: string;
  declare public receipt_file: string;
  declare public status: DepositStatus;
  declare public rejection_reason: string | null;
  declare public admin_remarks: string | null;
  declare public reviewed_by: number | null;
  declare public reviewed_at: Date | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

Deposit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    reference: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('amount'),
    },
    upi_transaction_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    receipt_file: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(DepositStatus)),
      allowNull: false,
      defaultValue: DepositStatus.PENDING,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    admin_remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'deposits',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['reference'], unique: true },
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['upi_transaction_id'] },
      { fields: ['created_at'] },
    ],
  }
);
