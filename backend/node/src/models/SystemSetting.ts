import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export interface SystemSettingAttributes {
  setting_key: string;
  setting_value: string;
  updated_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

export class SystemSetting
  extends Model<SystemSettingAttributes, SystemSettingAttributes>
  implements SystemSettingAttributes
{
  declare public setting_key: string;
  declare public setting_value: string;
  declare public updated_by: number | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

SystemSetting.init(
  {
    setting_key: {
      type: DataTypes.STRING(100),
      primaryKey: true,
    },
    setting_value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'system_settings',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);
