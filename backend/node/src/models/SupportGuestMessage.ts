import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { SupportSender, SupportTopic } from '../types/index.js';

/** One line of a visitor's (not signed in) support chat. `sender` CUSTOMER means the visitor. */
export interface SupportGuestMessageAttributes {
  id: number;
  guest_id: number;
  topic: SupportTopic;
  sender: SupportSender;
  admin_user_id?: number | null;
  message: string;
  read_by_guest: boolean;
  read_by_admin: boolean;
  created_at?: Date;
}

export interface SupportGuestMessageCreationAttributes
  extends Optional<SupportGuestMessageAttributes, 'id' | 'admin_user_id' | 'read_by_guest' | 'read_by_admin' | 'created_at'> {}

export class SupportGuestMessage
  extends Model<SupportGuestMessageAttributes, SupportGuestMessageCreationAttributes>
  implements SupportGuestMessageAttributes
{
  declare public id: number;
  declare public guest_id: number;
  declare public topic: SupportTopic;
  declare public sender: SupportSender;
  declare public admin_user_id: number | null;
  declare public message: string;
  declare public read_by_guest: boolean;
  declare public read_by_admin: boolean;
  declare public readonly created_at: Date;
}

SupportGuestMessage.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    guest_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'support_guests', key: 'id' },
      onDelete: 'CASCADE',
    },
    topic: { type: DataTypes.ENUM(...Object.values(SupportTopic)), allowNull: false },
    sender: { type: DataTypes.ENUM(...Object.values(SupportSender)), allowNull: false },
    admin_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    message: { type: DataTypes.TEXT, allowNull: false, validate: { len: [1, 2000] } },
    read_by_guest: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    read_by_admin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    tableName: 'support_guest_messages',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['guest_id'] }, { fields: ['created_at'] }],
  }
);
