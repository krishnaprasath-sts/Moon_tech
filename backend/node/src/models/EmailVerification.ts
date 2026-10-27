import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Email verification link sent after registration. Only the SHA-256 hash of the token is stored;
 * the raw token travels in the link. A new account stays PENDING_VERIFICATION until a valid,
 * unused, unexpired token is presented.
 */
export interface EmailVerificationAttributes {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  used_at?: Date | null;
  created_at?: Date;
}

export interface EmailVerificationCreationAttributes
  extends Optional<EmailVerificationAttributes, 'id' | 'used_at' | 'created_at'> {}

export class EmailVerification
  extends Model<EmailVerificationAttributes, EmailVerificationCreationAttributes>
  implements EmailVerificationAttributes
{
  declare public id: number;
  declare public user_id: number;
  declare public token_hash: string;
  declare public expires_at: Date;
  declare public used_at: Date | null;
  declare public readonly created_at: Date;
}

EmailVerification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    token_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'email_verifications',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['user_id'] }, { fields: ['expires_at'] }],
  }
);
