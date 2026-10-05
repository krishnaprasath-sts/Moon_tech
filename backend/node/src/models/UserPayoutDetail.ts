import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { PayoutMethod } from '../types/index.js';

export interface UserPayoutDetailAttributes {
  id: number;
  user_id: number;
  preferred_method: PayoutMethod;
  upi_id?: string | null;
  account_holder_name?: string | null;
  account_number_encrypted?: string | null;
  account_last4?: string | null;
  ifsc_code?: string | null;
  bank_name?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface UserPayoutDetailCreationAttributes
  extends Optional<
    UserPayoutDetailAttributes,
    | 'id'
    | 'upi_id'
    | 'account_holder_name'
    | 'account_number_encrypted'
    | 'account_last4'
    | 'ifsc_code'
    | 'bank_name'
    | 'created_at'
    | 'updated_at'
  > {}

/**
 * Customer's registered bank / UPI details used for withdrawal payouts
 */
export class UserPayoutDetail
  extends Model<UserPayoutDetailAttributes, UserPayoutDetailCreationAttributes>
  implements UserPayoutDetailAttributes
{
  declare public id: number;
  declare public user_id: number;
  declare public preferred_method: PayoutMethod;
  declare public upi_id: string | null;
  declare public account_holder_name: string | null;
  declare public account_number_encrypted: string | null;
  declare public account_last4: string | null;
  declare public ifsc_code: string | null;
  declare public bank_name: string | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

UserPayoutDetail.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    preferred_method: {
      type: DataTypes.ENUM(...Object.values(PayoutMethod)),
      allowNull: false,
    },
    upi_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    account_holder_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    account_number_encrypted: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    account_last4: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    ifsc_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    bank_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'user_payout_details',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['user_id'], unique: true }],
  }
);
