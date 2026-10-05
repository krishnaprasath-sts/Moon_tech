import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export interface ActivityLogAttributes {
  id: number;
  user_id?: number | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  description: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: Date;
}

export interface ActivityLogCreationAttributes
  extends Optional<ActivityLogAttributes, 'id' | 'user_id' | 'entity_id' | 'ip_address' | 'user_agent' | 'created_at'> {}

export class ActivityLog
  extends Model<ActivityLogAttributes, ActivityLogCreationAttributes>
  implements ActivityLogAttributes
{
  declare public id: number;
  declare public user_id: number | null;
  declare public action: string;
  declare public entity: string;
  declare public entity_id: string | null;
  declare public description: string;
  declare public ip_address: string | null;
  declare public user_agent: string | null;
  declare public readonly created_at: Date;
}

ActivityLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    entity: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'activity_logs',
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['action'] },
      { fields: ['entity'] },
      { fields: ['created_at'] },
    ],
  }
);
