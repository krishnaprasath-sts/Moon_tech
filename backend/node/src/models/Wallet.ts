import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { decimalGetter } from '../utils/money.js';

export interface WalletAttributes {
  id: number;
  user_id: number;
  balance: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface WalletCreationAttributes
  extends Optional<WalletAttributes, 'id' | 'balance' | 'created_at' | 'updated_at'> {}

export class Wallet
  extends Model<WalletAttributes, WalletCreationAttributes>
  implements WalletAttributes
{
  declare public id: number;
  declare public user_id: number;
  declare public balance: number;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

Wallet.init(
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
    balance: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
      get: decimalGetter('balance'),
    },
  },
  {
    sequelize,
    tableName: 'wallets',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['user_id'], unique: true }],
  }
);
