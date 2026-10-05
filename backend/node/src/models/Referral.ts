import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { ReferralStatus } from '../types/index.js';

export interface ReferralAttributes {
  id: number;
  referrer_user_id: number;
  referred_user_id: number;
  referral_code: string;
  status: ReferralStatus;
  created_at?: Date;
}

export interface ReferralCreationAttributes
  extends Optional<ReferralAttributes, 'id' | 'status' | 'created_at'> {}

export class Referral
  extends Model<ReferralAttributes, ReferralCreationAttributes>
  implements ReferralAttributes
{
  declare public id: number;
  declare public referrer_user_id: number;
  declare public referred_user_id: number;
  declare public referral_code: string;
  declare public status: ReferralStatus;
  declare public readonly created_at: Date;
}

Referral.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    referrer_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    referred_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      unique: true,
    },
    referral_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ReferralStatus)),
      allowNull: false,
      defaultValue: ReferralStatus.ACTIVE,
    },
  },
  {
    sequelize,
    tableName: 'referrals',
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['referrer_user_id'] },
      { fields: ['referred_user_id'], unique: true },
      { fields: ['referral_code'] },
      { fields: ['created_at'] },
    ],
  }
);
