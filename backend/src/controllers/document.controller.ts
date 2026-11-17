import { Request, Response } from 'express';
import fs from 'fs';
import prisma from '../utils/prisma.js';
import { StorageService } from '../services/storage.service.js';

export class DocumentController {
  /**
   * Upload single or multiple documents
   */
  static async upload(req: Request, res: Response): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ success: false, error: 'No files uploaded' });
        return;
      }

      const results = [];

      for (const file of files) {
        StorageService.validateFile(file);
        const processed = await StorageService.processUploadedFile(file);

        results.push({
          tempId: processed.storedFilename,
          originalFilename: processed.originalFilename,
          storedFilename: processed.storedFilename,
          fileSizeBytes: processed.fileSizeBytes,
          mimeType: processed.mimeType,
          pageCount: processed.pageCount,
        });
      }

      res.json({
        success: true,
        data: results,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Securely stream document preview
   */
  static async preview(req: Request, res: Response): Promise<void> {
    try {
      const filename = req.params.filename as string;
      const filePath = StorageService.getFilePath(filename);

      res.sendFile(filePath);
    } catch (err: any) {
      res.status(404).json({ success: false, error: 'Document not found' });
    }
  }
}
