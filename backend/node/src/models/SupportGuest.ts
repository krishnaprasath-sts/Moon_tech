import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * A visitor who wrote to support before signing in (from the home, sign-in or registration
 * page). The browser keeps a random token; only its SHA-256 hash is stored here, and the
 * visitor reads the admin's replies with it.
 */
export interface SupportGuestAttributes {
  id: number;
  token_hash: string;
  name: string;
  email: string;
  phone?: string | null;
  last_message_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface SupportGuestCreationAttributes
  extends Optional<SupportGuestAttributes, 'id' | 'phone' | 'last_message_at' | 'created_at' | 'updated_at'> {}

export class SupportGuest
  extends Model<SupportGuestAttributes, SupportGuestCreationAttributes>
  implements SupportGuestAttributes
{
  declare public id: number;
  declare public token_hash: string;
  declare public name: string;
  declare public email: string;
  declare public phone: string | null;
  declare public last_message_at: Date | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

SupportGuest.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    last_message_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'support_guests',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['email'] }, { fields: ['last_message_at'] }],
  }
);
