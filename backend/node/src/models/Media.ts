import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export interface MediaAttributes {
  id: number;
  user_id: number;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  file_type: string;
  created_at?: Date;
}

export interface MediaCreationAttributes
  extends Optional<MediaAttributes, 'id' | 'created_at'> {}

export class Media
  extends Model<MediaAttributes, MediaCreationAttributes>
  implements MediaAttributes
{
  declare public id: number;
  declare public user_id: number;
  declare public file_name: string;
  declare public file_path: string;
  declare public mime_type: string;
  declare public file_size: number;
  declare public file_type: string;
  declare public readonly created_at: Date;
}

Media.init(
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
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    file_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'media',
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['file_type'] },
      { fields: ['created_at'] },
    ],
  }
);
