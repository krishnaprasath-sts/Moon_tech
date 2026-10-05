import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { ProfitType } from '../types/index.js';
import { decimalGetter } from '../utils/money.js';

export interface InvestmentPlanAttributes {
  id: number;
  name: string;
  description?: string | null;
  min_amount: number;
  max_amount: number;
  duration_days: number;
  profit_type: ProfitType;
  profit_value: number;
  is_active: boolean;
  is_featured: boolean;
  featured_tagline?: string | null;
  sort_order: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface InvestmentPlanCreationAttributes
  extends Optional<
    InvestmentPlanAttributes,
    'id' | 'description' | 'is_active' | 'is_featured' | 'featured_tagline' | 'sort_order' | 'created_at' | 'updated_at'
  > {}

export class InvestmentPlan
  extends Model<InvestmentPlanAttributes, InvestmentPlanCreationAttributes>
  implements InvestmentPlanAttributes
{
  declare public id: number;
  declare public name: string;
  declare public description: string | null;
  declare public min_amount: number;
  declare public max_amount: number;
  declare public duration_days: number;
  declare public profit_type: ProfitType;
  declare public profit_value: number;
  declare public is_active: boolean;
  declare public is_featured: boolean;
  declare public featured_tagline: string | null;
  declare public sort_order: number;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

InvestmentPlan.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    min_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('min_amount'),
    },
    max_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('max_amount'),
    },
    duration_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    profit_type: {
      type: DataTypes.ENUM(...Object.values(ProfitType)),
      allowNull: false,
      defaultValue: ProfitType.PERCENTAGE,
    },
    // PERCENTAGE: % of principal earned over the full period. FIXED: rupee amount.
    profit_value: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      get: decimalGetter('profit_value'),
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // Shown on the website's Featured Plans page, in sort_order
    is_featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Optional promotional line written by the admin for the featured card
    featured_tagline: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'investment_plans',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['is_active'] }, { fields: ['is_featured'] }, { fields: ['sort_order'] }],
  }
);
