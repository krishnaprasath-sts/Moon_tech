import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { KycReviewAction } from '../types/index.js';

export interface KycReviewAttributes {
  id: number;
  kyc_id: number;
  admin_id: number;
  action: KycReviewAction;
  remarks?: string | null;
  created_at?: Date;
}

export interface KycReviewCreationAttributes
  extends Optional<KycReviewAttributes, 'id' | 'remarks' | 'created_at'> {}

export class KycReview
  extends Model<KycReviewAttributes, KycReviewCreationAttributes>
  implements KycReviewAttributes
{
  declare public id: number;
  declare public kyc_id: number;
  declare public admin_id: number;
  declare public action: KycReviewAction;
  declare public remarks: string | null;
  declare public readonly created_at: Date;
}

KycReview.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    kyc_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'kyc_profiles',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    action: {
      type: DataTypes.ENUM(...Object.values(KycReviewAction)),
      allowNull: false,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'kyc_reviews',
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['kyc_id'] },
      { fields: ['admin_id'] },
      { fields: ['created_at'] },
    ],
  }
);
