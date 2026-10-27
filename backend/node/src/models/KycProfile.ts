import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database.js';
import { KycStatus } from '../types/index.js';

export interface KycProfileAttributes {
  id: number;
  user_id: number;
  kyc_status: KycStatus;
  pan_number_encrypted?: string | null;
  /** Keyed one-way fingerprint of the PAN, used to spot the same PAN on another account */
  pan_hash?: string | null;
  pan_last4?: string | null;
  aadhaar_reference?: string | null;
  aadhaar_last4?: string | null;
  bank_account_number_encrypted?: string | null;
  bank_account_last4?: string | null;
  account_holder_name?: string | null;
  ifsc_code?: string | null;
  bank_branch?: string | null;
  bank_name?: string | null;
  /** Keyed fingerprint of the account number, to compare accounts without decrypting */
  bank_account_hash?: string | null;
  passbook_document?: string | null;
  pan_document?: string | null;
  aadhaar_document?: string | null;
  /** Back side of the Aadhaar card (the front, or an e-Aadhaar PDF, is aadhaar_document) */
  aadhaar_back_document?: string | null;
  submitted_at?: Date | null;
  reviewed_at?: Date | null;
  reviewed_by?: number | null;
  rejection_reason?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface KycProfileCreationAttributes
  extends Optional<
    KycProfileAttributes,
    | 'id'
    | 'kyc_status'
    | 'pan_number_encrypted'
    | 'pan_hash'
    | 'pan_last4'
    | 'aadhaar_reference'
    | 'aadhaar_last4'
    | 'bank_account_number_encrypted'
    | 'bank_account_last4'
    | 'account_holder_name'
    | 'ifsc_code'
    | 'bank_name'
    | 'bank_account_hash'
    | 'passbook_document'
    | 'pan_document'
    | 'aadhaar_document'
    | 'aadhaar_back_document'
    | 'submitted_at'
    | 'reviewed_at'
    | 'reviewed_by'
    | 'rejection_reason'
    | 'created_at'
    | 'updated_at'
  > {}

export class KycProfile
  extends Model<KycProfileAttributes, KycProfileCreationAttributes>
  implements KycProfileAttributes
{
  declare public id: number;
  declare public user_id: number;
  declare public kyc_status: KycStatus;
  declare public pan_number_encrypted: string | null;
  declare public pan_hash: string | null;
  declare public pan_last4: string | null;
  declare public aadhaar_reference: string | null;
  declare public aadhaar_last4: string | null;
  declare public bank_account_number_encrypted: string | null;
  declare public bank_account_last4: string | null;
  declare public account_holder_name: string | null;
  declare public ifsc_code: string | null;
  declare public bank_branch: string | null;
  declare public bank_name: string | null;
  declare public bank_account_hash: string | null;
  declare public passbook_document: string | null;
  declare public pan_document: string | null;
  declare public aadhaar_document: string | null;
  declare public aadhaar_back_document: string | null;
  declare public submitted_at: Date | null;
  declare public reviewed_at: Date | null;
  declare public reviewed_by: number | null;
  declare public rejection_reason: string | null;
  declare public readonly created_at: Date;
  declare public readonly updated_at: Date;
}

KycProfile.init(
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
    kyc_status: {
      type: DataTypes.ENUM(...Object.values(KycStatus)),
      allowNull: false,
      defaultValue: KycStatus.DRAFT,
    },
    pan_number_encrypted: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pan_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    pan_last4: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    aadhaar_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    aadhaar_last4: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    bank_account_number_encrypted: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    bank_account_last4: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    account_holder_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ifsc_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    bank_branch: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    bank_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    bank_account_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    passbook_document: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    pan_document: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    aadhaar_document: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    aadhaar_back_document: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'kyc_profiles',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id'], unique: true },
      { fields: ['kyc_status'] },
      { fields: ['created_at'] },
      { fields: ['submitted_at'] },
    ],
  }
);
