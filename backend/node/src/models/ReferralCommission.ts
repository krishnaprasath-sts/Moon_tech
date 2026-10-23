import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { ReferralCommissionStatus } from '../types/index.js';
import { decimalGetter } from '../utils/money.js';

/**
 * One-time commission earned by a referrer when a customer they referred
 * makes an investment. It is created PENDING with the investment and becomes
 * payable (CREDITED) at the first 06:00 IST payout run after 24 hours, as long
 * as the investment has not been cancelled in the meantime.
 */
export interface ReferralCommissionAttributes {
  id: number;
  referrer_user_id: number;
  referred_user_id: number;
  investment_id: number;
  investment_amount: number;
  commission_percent: number;
  amount: number;
  status: ReferralCommissionStatus;
  eligible_at: Date;
  credited_at?: Date | null;
  cancelled_at?: Date | null;
  wallet_transaction_id?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface ReferralCommissionCreationAttributes
  extends Optional<
    ReferralCommissionAttributes,
    'id' | 'status' | 'credited_at' | 'cancelled_at' | 'wallet_transaction_id' | 'created_at' | 'updated_at'
  > {}

export class ReferralCommission
  extends Model<ReferralCommissionAttributes, ReferralCommissionCreationAttributes>
  implements ReferralCommissionAttributes
{
  declare public id: number;
  declare public referrer_user_id: number;
  declare public referred_user_id: number;
  declare public investment_id: number;
  declare public investment_amount: number;
  declare public commission_percent: number;
  declare public amount: number;
  declare public status: ReferralCommissionStatus;
  declare public eligible_at: Date;
  declare public credited_at: Date | null;
  declare public cancelled_at: Date | null;
  declare public wallet_transaction_id: number | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

ReferralCommission.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    referrer_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    referred_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    investment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: 'investments', key: 'id' },
      onDelete: 'CASCADE',
    },
    investment_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('investment_amount'),
    },
    commission_percent: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      get: decimalGetter('commission_percent'),
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('amount'),
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ReferralCommissionStatus)),
      allowNull: false,
      defaultValue: ReferralCommissionStatus.PENDING,
    },
    eligible_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    credited_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    wallet_transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'referral_commissions',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['referrer_user_id'] },
      { fields: ['referred_user_id'] },
      { fields: ['status', 'eligible_at'] },
    ],
  }
);
