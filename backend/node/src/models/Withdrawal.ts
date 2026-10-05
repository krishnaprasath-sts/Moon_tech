import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { WithdrawalStatus, PayoutMethod } from '../types/index.js';
import { decimalGetter } from '../utils/money.js';

export interface WithdrawalAttributes {
  id: number;
  reference: string;
  user_id: number;
  investment_id: number;
  principal_amount: number;
  profit_amount: number;
  total_amount: number;
  is_early: boolean;
  payout_method: PayoutMethod;
  payout_upi_id?: string | null;
  payout_account_holder?: string | null;
  payout_account_number_encrypted?: string | null;
  payout_account_last4?: string | null;
  payout_ifsc?: string | null;
  payout_bank_name?: string | null;
  status: WithdrawalStatus;
  admin_remarks?: string | null;
  rejection_reason?: string | null;
  payment_reference?: string | null;
  payment_proof_file?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: Date | null;
  processed_by?: number | null;
  completed_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface WithdrawalCreationAttributes
  extends Optional<
    WithdrawalAttributes,
    | 'id'
    | 'is_early'
    | 'payout_upi_id'
    | 'payout_account_holder'
    | 'payout_account_number_encrypted'
    | 'payout_account_last4'
    | 'payout_ifsc'
    | 'payout_bank_name'
    | 'status'
    | 'admin_remarks'
    | 'rejection_reason'
    | 'payment_reference'
    | 'payment_proof_file'
    | 'reviewed_by'
    | 'reviewed_at'
    | 'processed_by'
    | 'completed_at'
    | 'created_at'
    | 'updated_at'
  > {}

export class Withdrawal
  extends Model<WithdrawalAttributes, WithdrawalCreationAttributes>
  implements WithdrawalAttributes
{
  declare public id: number;
  declare public reference: string;
  declare public user_id: number;
  declare public investment_id: number;
  declare public principal_amount: number;
  declare public profit_amount: number;
  declare public total_amount: number;
  declare public is_early: boolean;
  declare public payout_method: PayoutMethod;
  declare public payout_upi_id: string | null;
  declare public payout_account_holder: string | null;
  declare public payout_account_number_encrypted: string | null;
  declare public payout_account_last4: string | null;
  declare public payout_ifsc: string | null;
  declare public payout_bank_name: string | null;
  declare public status: WithdrawalStatus;
  declare public admin_remarks: string | null;
  declare public rejection_reason: string | null;
  declare public payment_reference: string | null;
  declare public payment_proof_file: string | null;
  declare public reviewed_by: number | null;
  declare public reviewed_at: Date | null;
  declare public processed_by: number | null;
  declare public completed_at: Date | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

Withdrawal.init(
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
    investment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'investments',
        key: 'id',
      },
    },
    principal_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('principal_amount'),
    },
    profit_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('profit_amount'),
    },
    total_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('total_amount'),
    },
    is_early: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Payout destination is snapshotted at request time
    payout_method: {
      type: DataTypes.ENUM(...Object.values(PayoutMethod)),
      allowNull: false,
    },
    payout_upi_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    payout_account_holder: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    payout_account_number_encrypted: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    payout_account_last4: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    payout_ifsc: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    payout_bank_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(WithdrawalStatus)),
      allowNull: false,
      defaultValue: WithdrawalStatus.PENDING,
    },
    admin_remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    payment_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    payment_proof_file: {
      type: DataTypes.STRING(255),
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
    processed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'withdrawals',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['reference'], unique: true },
      { fields: ['user_id'] },
      { fields: ['investment_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
    ],
  }
);
