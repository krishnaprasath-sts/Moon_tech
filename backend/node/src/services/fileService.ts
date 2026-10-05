import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { config } from '../config/index.js';
import { Media } from '../models/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface ProcessedFileInfo {
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
}

const PDF_SIGNATURE = Buffer.from('%PDF-');

/**
 * A PDF upload must actually start with the PDF signature; the MIME type is client-supplied.
 */
function assertRealPdf(file: Express.Multer.File): void {
  if (!file.buffer || file.buffer.length < PDF_SIGNATURE.length || !file.buffer.subarray(0, 5).equals(PDF_SIGNATURE)) {
    throw new BadRequestError('The uploaded file is not a valid PDF document.');
  }
}

export class FileService {
  /**
   * Ensures the private upload directory exists
   */
  public static async ensureStorageDir(): Promise<void> {
    try {
      if (!fsSync.existsSync(config.uploadDir)) {
        await fs.mkdir(config.uploadDir, { recursive: true });
      }
    } catch (err) {
      logger.error('Failed to create storage directory', err);
    }
  }

  /**
   * Processes an uploaded file (optimizes images with Sharp if applicable)
   * and saves it securely to the private storage directory.
   */
  public static async processAndSaveKycFile(
    userId: number,
    file: Express.Multer.File,
    fileType: 'PASSBOOK' | 'PAN' | 'AADHAAR'
  ): Promise<ProcessedFileInfo> {
    await this.ensureStorageDir();

    const fileHash = crypto.randomBytes(16).toString('hex');
    const isImage = file.mimetype.startsWith('image/');
    const isPdf = file.mimetype === 'application/pdf';

    if (!isImage && !isPdf) {
      throw new BadRequestError(`Unsupported file format: ${file.mimetype}`);
    }

    let savedFileName: string;
    let finalMimeType: string;
    let finalBuffer: Buffer;

    if (isImage) {
      try {
        // Optimize image with Sharp: auto rotate, resize if wider than 2000px, compress
        finalBuffer = await sharp(file.buffer)
          .rotate()
          .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();

        savedFileName = `${userId}_${fileType.toLowerCase()}_${fileHash}.jpg`;
        finalMimeType = 'image/jpeg';
      } catch (sharpError: any) {
        logger.warn(`Sharp optimization failed, saving original buffer: ${sharpError.message}`);
        const ext = path.extname(file.originalname) || '.jpg';
        savedFileName = `${userId}_${fileType.toLowerCase()}_${fileHash}${ext}`;
        finalMimeType = file.mimetype;
        finalBuffer = file.buffer;
      }
    } else {
      // PDF file
      assertRealPdf(file);
      savedFileName = `${userId}_${fileType.toLowerCase()}_${fileHash}.pdf`;
      finalMimeType = 'application/pdf';
      finalBuffer = file.buffer;
    }

    const fullFilePath = path.join(config.uploadDir, savedFileName);
    await fs.writeFile(fullFilePath, finalBuffer);

    // Record in media table
    await Media.create({
      user_id: userId,
      file_name: savedFileName,
      file_path: fullFilePath,
      mime_type: finalMimeType,
      file_size: finalBuffer.length,
      file_type: fileType,
    });

    return {
      fileName: savedFileName,
      filePath: fullFilePath,
      mimeType: finalMimeType,
      fileSize: finalBuffer.length,
    };
  }

  /**
   * Saves a payment document (deposit receipt / payout proof) to private storage
   */
  public static async savePaymentDocument(
    userId: number,
    file: Express.Multer.File,
    fileType: 'DEPOSIT_RECEIPT' | 'PAYOUT_PROOF'
  ): Promise<ProcessedFileInfo> {
    await this.ensureStorageDir();

    const fileHash = crypto.randomBytes(16).toString('hex');
    const isImage = file.mimetype.startsWith('image/');
    const isPdf = file.mimetype === 'application/pdf';

    if (!isImage && !isPdf) {
      throw new BadRequestError(`Unsupported file format: ${file.mimetype}`);
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestError('Uploaded file is empty');
    }
    if (isPdf) {
      assertRealPdf(file);
    }

    const prefix = `${userId}_${fileType.toLowerCase()}_${fileHash}`;
    let savedFileName = `${prefix}.pdf`;
    let finalMimeType = 'application/pdf';
    let finalBuffer = file.buffer;

    if (isImage) {
      try {
        finalBuffer = await sharp(file.buffer)
          .rotate()
          .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();
        savedFileName = `${prefix}.jpg`;
        finalMimeType = 'image/jpeg';
      } catch (sharpError: any) {
        // A file that cannot be decoded is not a usable receipt
        throw new BadRequestError('Uploaded image could not be read. Please upload a valid JPEG, PNG or WEBP file.');
      }
    }

    const fullFilePath = path.join(config.uploadDir, savedFileName);
    await fs.writeFile(fullFilePath, finalBuffer);

    await Media.create({
      user_id: userId,
      file_name: savedFileName,
      file_path: fullFilePath,
      mime_type: finalMimeType,
      file_size: finalBuffer.length,
      file_type: fileType,
    });

    return {
      fileName: savedFileName,
      filePath: fullFilePath,
      mimeType: finalMimeType,
      fileSize: finalBuffer.length,
    };
  }

  /**
   * Retrieves file path and mime type for secure streaming
   */
  public static async getSecureFile(fileName: string): Promise<{ fullPath: string; mimeType: string }> {
    const sanitizedFileName = path.basename(fileName);
    const fullPath = path.join(config.uploadDir, sanitizedFileName);

    if (!fsSync.existsSync(fullPath)) {
      throw new NotFoundError('Requested document was not found on server');
    }

    const ext = path.extname(sanitizedFileName).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';

    return { fullPath, mimeType };
  }
}
