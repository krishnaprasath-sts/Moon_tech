import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * One-time code emailed to a customer after a correct password. The login completes only when
 * the code is verified within its expiry. `token` is the opaque challenge id the browser holds.
 */
export interface LoginOtpAttributes {
  id: number;
  user_id: number;
  token: string;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  used_at?: Date | null;
  created_at?: Date;
}

export interface LoginOtpCreationAttributes
  extends Optional<LoginOtpAttributes, 'id' | 'attempts' | 'used_at' | 'created_at'> {}

export class LoginOtp extends Model<LoginOtpAttributes, LoginOtpCreationAttributes> implements LoginOtpAttributes {
  declare public id: number;
  declare public user_id: number;
  declare public token: string;
  declare public otp_hash: string;
  declare public expires_at: Date;
  declare public attempts: number;
  declare public used_at: Date | null;
  declare public readonly created_at: Date;
}

LoginOtp.init(
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
    token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    otp_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'login_otps',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['user_id'] }, { fields: ['expires_at'] }],
  }
);
