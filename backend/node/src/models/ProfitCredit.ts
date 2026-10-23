import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { decimalGetter } from '../utils/money.js';

/**
 * One row per investment per working day on which daily profit was credited.
 * The (investment_id, credit_day) unique key makes the payout job idempotent.
 */
export interface ProfitCreditAttributes {
  id: number;
  investment_id: number;
  user_id: number;
  credit_day: string; // IST calendar date YYYY-MM-DD
  /** 30-day cycle of the investment this credit belongs to (0 = first cycle) */
  cycle_no: number;
  amount: number;
  wallet_transaction_id?: number | null;
  created_at?: Date;
}

export interface ProfitCreditCreationAttributes
  extends Optional<ProfitCreditAttributes, 'id' | 'cycle_no' | 'wallet_transaction_id' | 'created_at'> {}

export class ProfitCredit
  extends Model<ProfitCreditAttributes, ProfitCreditCreationAttributes>
  implements ProfitCreditAttributes
{
  declare public id: number;
  declare public investment_id: number;
  declare public user_id: number;
  declare public credit_day: string;
  declare public cycle_no: number;
  declare public amount: number;
  declare public wallet_transaction_id: number | null;
  declare public readonly created_at: Date;
}

ProfitCredit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    investment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'investments', key: 'id' },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    credit_day: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    cycle_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('amount'),
    },
    wallet_transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'profit_credits',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['investment_id', 'credit_day'], unique: true },
      { fields: ['user_id', 'credit_day'] },
    ],
  }
);
