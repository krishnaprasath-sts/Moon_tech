import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { BadRequestError } from '../utils/errors.js';
import { config } from '../config/index.js';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'application/pdf',
];

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(
        `Invalid file type '${file.mimetype}'. Only JPEG, PNG, WEBP, and PDF documents are supported.`
      )
    );
  }
};

const storage = multer.memoryStorage();

const singleFileUpload = (fieldName: string) =>
  multer({
    storage,
    limits: {
      fileSize: config.maxFileSizeMb * 1024 * 1024,
      files: 1,
    },
    fileFilter,
  }).single(fieldName);

// UPI payment receipt uploaded by the customer with a wallet top-up
export const uploadReceipt = singleFileUpload('receipt');

// Payout proof uploaded by the admin when completing a withdrawal
export const uploadPaymentProof = singleFileUpload('paymentProof');

// Bank proof (passbook / cancelled cheque / statement) with a bank account change request
export const uploadBankProof = singleFileUpload('proof');

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

// Custom UPI QR image uploaded by the admin in Settings (images only, 2 MB)
export const uploadUpiQr = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new BadRequestError(`Invalid file type '${file.mimetype}'. Upload the QR as a JPEG, PNG or WEBP image.`));
  },
}).single('qrImage');

export const uploadKycDocuments = multer({
  storage,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024, // 5MB
    files: 4,
  },
  fileFilter,
}).fields([
  { name: 'passbookDocument', maxCount: 1 },
  { name: 'panDocument', maxCount: 1 },
  { name: 'aadhaarDocument', maxCount: 1 },
  { name: 'aadhaarBackDocument', maxCount: 1 },
  // Also accept short field aliases for convenience
  { name: 'passbook', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'aadhaar', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
]);
