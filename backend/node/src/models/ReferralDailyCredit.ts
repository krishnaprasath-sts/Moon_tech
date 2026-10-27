import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { decimalGetter } from '../utils/money.js';

export interface ReferralDailyCreditAttributes {
  id: number;
  investment_id: number;
  referrer_user_id: number;
  referred_user_id: number;
  credit_day: string; // IST calendar date YYYY-MM-DD
  commission_percent: number;
  amount: number;
  wallet_transaction_id?: number | null;
  created_at?: Date;
}

export interface ReferralDailyCreditCreationAttributes
  extends Optional<ReferralDailyCreditAttributes, 'id' | 'wallet_transaction_id' | 'created_at'> {}

/**
 * One row per investment per working day on which a recurring referral commission was credited.
 * The (investment_id, credit_day) unique key guarantees idempotency across payout runs.
 */
export class ReferralDailyCredit
  extends Model<ReferralDailyCreditAttributes, ReferralDailyCreditCreationAttributes>
  implements ReferralDailyCreditAttributes
{
  declare public id: number;
  declare public investment_id: number;
  declare public referrer_user_id: number;
  declare public referred_user_id: number;
  declare public credit_day: string;
  declare public commission_percent: number;
  declare public amount: number;
  declare public wallet_transaction_id: number | null;
  declare public readonly created_at: Date;
}

ReferralDailyCredit.init(
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
    referrer_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    referred_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    credit_day: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    commission_percent: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      get: decimalGetter('commission_percent'),
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
    tableName: 'referral_daily_credits',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['investment_id', 'credit_day'],
        name: 'unique_referral_daily_credit_per_investment_day',
      },
      { fields: ['referrer_user_id'] },
      { fields: ['referred_user_id'] },
      { fields: ['credit_day'] },
    ],
  }
);
