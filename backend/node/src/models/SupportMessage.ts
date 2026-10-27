import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { SupportSender, SupportTopic } from '../types/index.js';

export interface SupportMessageAttributes {
  id: number;
  user_id: number;
  topic: SupportTopic;
  sender: SupportSender;
  admin_user_id?: number | null;
  message: string;
  read_by_customer: boolean;
  read_by_admin: boolean;
  created_at?: Date;
}

export interface SupportMessageCreationAttributes
  extends Optional<
    SupportMessageAttributes,
    'id' | 'admin_user_id' | 'read_by_customer' | 'read_by_admin' | 'created_at'
  > {}

/**
 * One line of the support chat between a customer and the admin team.
 * `user_id` is always the customer the thread belongs to; `admin_user_id` is set on replies.
 */
export class SupportMessage
  extends Model<SupportMessageAttributes, SupportMessageCreationAttributes>
  implements SupportMessageAttributes
{
  declare public id: number;
  declare public user_id: number;
  declare public topic: SupportTopic;
  declare public sender: SupportSender;
  declare public admin_user_id: number | null;
  declare public message: string;
  declare public read_by_customer: boolean;
  declare public read_by_admin: boolean;
  declare public readonly created_at: Date;
}

SupportMessage.init(
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
    topic: {
      type: DataTypes.ENUM(...Object.values(SupportTopic)),
      allowNull: false,
    },
    sender: {
      type: DataTypes.ENUM(...Object.values(SupportSender)),
      allowNull: false,
    },
    admin_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [1, 2000] },
    },
    read_by_customer: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    read_by_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'support_messages',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['user_id'] }, { fields: ['topic'] }, { fields: ['created_at'] }],
  }
);
