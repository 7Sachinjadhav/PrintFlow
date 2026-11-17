import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_DIR = process.env.STORAGE_DIR || './storage';

// Ensure base storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export interface StoredFileInfo {
  originalFilename: string;
  storedFilename: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  pageCount: number;
}

export class StorageService {
  /**
   * Validates file format and size
   */
  static validateFile(file: Express.Multer.File, maxSizeBytes: number = 26214400) {
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];

    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Unsupported file type: ${ext}. Supported types: PDF, JPG, PNG`);
    }

    if (file.size > maxSizeBytes) {
      const mbLimit = Math.round(maxSizeBytes / (1024 * 1024));
      throw new Error(`File size (${Math.round(file.size / (1024 * 1024))}MB) exceeds maximum limit of ${mbLimit}MB`);
    }

    return true;
  }

  /**
   * Inspects PDF or Image and returns page count and metadata
   */
  static async processUploadedFile(file: Express.Multer.File): Promise<StoredFileInfo> {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedFilename = `${uuidv4()}${ext}`;
    const destinationPath = path.resolve(STORAGE_DIR, storedFilename);

    // Save buffer or move file
    if (file.buffer) {
      await fs.promises.writeFile(destinationPath, file.buffer);
    } else if (file.path) {
      await fs.promises.copyFile(file.path, destinationPath);
    }

    let pageCount = 1;

    if (file.mimetype === 'application/pdf' || ext === '.pdf') {
      try {
        const fileBytes = await fs.promises.readFile(destinationPath);
        const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
        pageCount = pdfDoc.getPageCount();
      } catch (err) {
        console.warn('PDF page counting fallback:', err);
        pageCount = 1;
      }
    }

    return {
      originalFilename: file.originalname,
      storedFilename,
      filePath: destinationPath,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      pageCount,
    };
  }

  /**
   * Resolves absolute path of stored file safely
   */
  static getFilePath(storedFilename: string): string {
    const safeName = path.basename(storedFilename);
    const fullPath = path.resolve(STORAGE_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found on storage');
    }
    return fullPath;
  }
}
