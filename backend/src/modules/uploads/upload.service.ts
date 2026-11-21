import { Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';

// Cấu hình storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'messages');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

// Filter theo type
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(ErrorCodes.VALIDATION_ERROR, 'Loại file không được hỗ trợ'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
});

export class UploadService {
  async saveFiles(files: Express.Multer.File[], userId: string, conversationId: string) {
    return files.map(file => ({
      // Sử dụng decoded name để tránh lỗi hiển thị tiếng Việt
      fileName: this.decodeFilename(file.originalname),
      fileType: this.getFileType(file.mimetype),
      fileSize: file.size,
      mimeType: file.mimetype,
      storagePath: file.path,
      url: `/uploads/messages/${file.filename}`,
      width: undefined,
      height: undefined,
    }));
  }

  /** Decode filename to handle Vietnamese characters properly */
  private decodeFilename(originalName: string): string {
    try {
      return Buffer.from(originalName, 'latin1').toString('utf-8');
    } catch {
      return originalName;
    }
  }

  private getFileType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return 'FILE';
  }
}