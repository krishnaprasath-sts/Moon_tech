import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { NotificationType } from '../types/index.js';

export interface NotificationAttributes {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  related_entity?: string | null;
  related_id?: number | null;
  is_read: boolean;
  read_at?: Date | null;
  created_at?: Date;
}

export interface NotificationCreationAttributes
  extends Optional<
    NotificationAttributes,
    'id' | 'related_entity' | 'related_id' | 'is_read' | 'read_at' | 'created_at'
  > {}

export class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  declare public id: number;
  declare public user_id: number;
  declare public type: NotificationType;
  declare public title: string;
  declare public message: string;
  declare public related_entity: string | null;
  declare public related_id: number | null;
  declare public is_read: boolean;
  declare public read_at: Date | null;
  declare public readonly created_at: Date;
}

Notification.init(
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
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    related_entity: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    related_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'notifications',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['user_id', 'is_read'] },
      { fields: ['created_at'] },
    ],
  }
);

export interface AnnouncementAttributes {
  id: number;
  title: string;
  message: string;
  created_by: number;
  recipients_count: number;
  created_at?: Date;
}

export interface AnnouncementCreationAttributes
  extends Optional<AnnouncementAttributes, 'id' | 'recipients_count' | 'created_at'> {}

export class Announcement
  extends Model<AnnouncementAttributes, AnnouncementCreationAttributes>
  implements AnnouncementAttributes
{
  declare public id: number;
  declare public title: string;
  declare public message: string;
  declare public created_by: number;
  declare public recipients_count: number;
  declare public readonly created_at: Date;
}

Announcement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    recipients_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'announcements',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['created_at'] }],
  }
);
