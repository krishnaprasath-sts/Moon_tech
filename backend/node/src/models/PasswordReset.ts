import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export interface PasswordResetAttributes {
  id: number;
  user_id: number;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  used_at?: Date | null;
  created_at?: Date;
}

export interface PasswordResetCreationAttributes
  extends Optional<PasswordResetAttributes, 'id' | 'attempts' | 'used_at' | 'created_at'> {}

export class PasswordReset
  extends Model<PasswordResetAttributes, PasswordResetCreationAttributes>
  implements PasswordResetAttributes
{
  declare public id: number;
  declare public user_id: number;
  declare public otp_hash: string;
  declare public expires_at: Date;
  declare public attempts: number;
  declare public used_at: Date | null;
  declare public readonly created_at: Date;
}

PasswordReset.init(
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
    tableName: 'password_resets',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['user_id'] }, { fields: ['expires_at'] }],
  }
);
