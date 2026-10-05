import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { UserRole, UserStatus } from '../types/index.js';

export interface UserAttributes {
  id: number;
  email: string;
  phone: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  last_login_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface UserCreationAttributes
  extends Optional<UserAttributes, 'id' | 'role' | 'status' | 'last_login_at' | 'created_at' | 'updated_at'> {}

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  declare public id: number;
  declare public email: string;
  declare public phone: string;
  declare public password_hash: string;
  declare public role: UserRole;
  declare public status: UserStatus;
  declare public last_login_at: Date | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      allowNull: false,
      defaultValue: UserRole.CUSTOMER,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(UserStatus)),
      allowNull: false,
      defaultValue: UserStatus.ACTIVE,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'users',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['email'], unique: true },
      { fields: ['phone'], unique: true },
      { fields: ['role'] },
      { fields: ['status'] },
    ],
  }
);
