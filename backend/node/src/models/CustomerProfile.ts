import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';

export interface CustomerProfileAttributes {
  id: number;
  user_id: number;
  full_name: string;
  referral_code: string;
  /** Public customer number shown to the customer and staff (e.g. MT100042); unique */
  customer_id?: string | null;
  referred_by?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface CustomerProfileCreationAttributes
  extends Optional<
    CustomerProfileAttributes,
    | 'id'
    | 'customer_id'
    | 'referred_by'
    | 'date_of_birth'
    | 'address'
    | 'city'
    | 'state'
    | 'pincode'
    | 'created_at'
    | 'updated_at'
  > {}

export class CustomerProfile
  extends Model<CustomerProfileAttributes, CustomerProfileCreationAttributes>
  implements CustomerProfileAttributes
{
  declare public id: number;
  declare public user_id: number;
  declare public full_name: string;
  declare public referral_code: string;
  declare public customer_id: string | null;
  declare public referred_by: string | null;
  declare public date_of_birth: string | null;
  declare public address: string | null;
  declare public city: string | null;
  declare public state: string | null;
  declare public pincode: string | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

CustomerProfile.init(
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
    full_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    referral_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    customer_id: {
      type: DataTypes.STRING(16),
      allowNull: true,
      unique: true,
    },
    referred_by: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    pincode: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'customer_profiles',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id'], unique: true },
      { fields: ['referral_code'], unique: true },
      { fields: ['customer_id'], unique: true },
      { fields: ['referred_by'] },
      { fields: ['full_name'] },
    ],
  }
);
