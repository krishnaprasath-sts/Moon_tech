import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { WalletTxnType, WalletTxnDirection, WalletBucket } from '../types/index.js';
import { decimalGetter } from '../utils/money.js';

export interface WalletTransactionAttributes {
  id: number;
  reference: string;
  user_id: number;
  wallet_id: number;
  type: WalletTxnType;
  direction: WalletTxnDirection;
  /** Which balance this entry moved; balance_before/after refer to that bucket */
  bucket: WalletBucket;
  amount: number;
  balance_before: number;
  balance_after: number;
  related_entity?: string | null;
  related_id?: number | null;
  description: string;
  created_by?: number | null;
  created_at?: Date;
}

export interface WalletTransactionCreationAttributes
  extends Optional<
    WalletTransactionAttributes,
    'id' | 'related_entity' | 'related_id' | 'created_by' | 'created_at'
  > {}

/**
 * Immutable wallet ledger. Rows are only ever inserted, never updated.
 */
export class WalletTransaction
  extends Model<WalletTransactionAttributes, WalletTransactionCreationAttributes>
  implements WalletTransactionAttributes
{
  declare public id: number;
  declare public reference: string;
  declare public user_id: number;
  declare public wallet_id: number;
  declare public type: WalletTxnType;
  declare public direction: WalletTxnDirection;
  declare public bucket: WalletBucket;
  declare public amount: number;
  declare public balance_before: number;
  declare public balance_after: number;
  declare public related_entity: string | null;
  declare public related_id: number | null;
  declare public description: string;
  declare public created_by: number | null;
  declare public readonly created_at: Date;
}

WalletTransaction.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    reference: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    wallet_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'wallets',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM(...Object.values(WalletTxnType)),
      allowNull: false,
    },
    direction: {
      type: DataTypes.ENUM(...Object.values(WalletTxnDirection)),
      allowNull: false,
    },
    bucket: {
      type: DataTypes.ENUM(...Object.values(WalletBucket)),
      allowNull: false,
      defaultValue: WalletBucket.PROFIT,
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('amount'),
    },
    balance_before: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('balance_before'),
    },
    balance_after: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('balance_after'),
    },
    related_entity: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    related_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'wallet_transactions',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['reference'], unique: true },
      { fields: ['user_id'] },
      { fields: ['wallet_id'] },
      { fields: ['type'] },
      { fields: ['bucket'] },
      { fields: ['created_at'] },
      { fields: ['related_entity', 'related_id'] },
    ],
  }
);
