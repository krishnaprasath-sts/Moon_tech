import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { InvestmentStatus, ProfitType } from '../types/index.js';
import { decimalGetter } from '../utils/money.js';

export interface InvestmentAttributes {
  id: number;
  reference: string;
  user_id: number;
  plan_id: number;
  plan_name: string;
  profit_type: ProfitType;
  profit_value: number;
  duration_days: number;
  amount: number;
  expected_profit: number;
  maturity_amount: number;
  start_date: Date;
  maturity_date: Date;
  status: InvestmentStatus;
  early_withdrawal_allowed: boolean;
  matured_at?: Date | null;
  completed_at?: Date | null;
  cancelled_at?: Date | null;
  cancel_reason?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface InvestmentCreationAttributes
  extends Optional<
    InvestmentAttributes,
    | 'id'
    | 'status'
    | 'early_withdrawal_allowed'
    | 'matured_at'
    | 'completed_at'
    | 'cancelled_at'
    | 'cancel_reason'
    | 'created_at'
    | 'updated_at'
  > {}

export class Investment
  extends Model<InvestmentAttributes, InvestmentCreationAttributes>
  implements InvestmentAttributes
{
  declare public id: number;
  declare public reference: string;
  declare public user_id: number;
  declare public plan_id: number;
  declare public plan_name: string;
  declare public profit_type: ProfitType;
  declare public profit_value: number;
  declare public duration_days: number;
  declare public amount: number;
  declare public expected_profit: number;
  declare public maturity_amount: number;
  declare public start_date: Date;
  declare public maturity_date: Date;
  declare public status: InvestmentStatus;
  declare public early_withdrawal_allowed: boolean;
  declare public matured_at: Date | null;
  declare public completed_at: Date | null;
  declare public cancelled_at: Date | null;
  declare public cancel_reason: string | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

Investment.init(
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
    plan_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'investment_plans',
        key: 'id',
      },
    },
    // Plan terms are snapshotted so later plan edits never change a running investment
    plan_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    profit_type: {
      type: DataTypes.ENUM(...Object.values(ProfitType)),
      allowNull: false,
    },
    profit_value: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('profit_value'),
    },
    duration_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('amount'),
    },
    expected_profit: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('expected_profit'),
    },
    maturity_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('maturity_amount'),
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    maturity_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(InvestmentStatus)),
      allowNull: false,
      defaultValue: InvestmentStatus.ACTIVE,
    },
    early_withdrawal_allowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    matured_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancel_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'investments',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['reference'], unique: true },
      { fields: ['user_id'] },
      { fields: ['plan_id'] },
      { fields: ['status'] },
      { fields: ['maturity_date'] },
      { fields: ['created_at'] },
    ],
  }
);
