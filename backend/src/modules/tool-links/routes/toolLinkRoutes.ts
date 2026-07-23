/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { requireRole } from '../../../middleware/auth';
import { z } from 'zod';
import { validateBody, validateParams } from '../../../middleware/validation';
import { logger } from '../../../utils/logger';
import { toolLinkCrudService } from '../services/toolLinkCrudService';
import { randomUUID } from 'crypto';

const router = Router();

// 延迟加载存储（multer + fs IO 处理保留在 routes 层——属于传输层关注点）
let upload: ReturnType<typeof multer>;
const getUploadDir = () =>
  path.resolve(
    process.env.UPLOAD_DIR || path.join(__dirname, '../../../../data/uploads/tool-icons'),
  );
const ensureUploadDir = () => {
  const uploadDir = getUploadDir();
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (e) {
      logger.warn(`Failed to create tool-icons upload directory: ${uploadDir}`, e);
    }
  }
  return uploadDir;
};
const getUpload = () => {
  if (!upload) {
    const uploadDir = ensureUploadDir();
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.png';
        cb(null, `${randomUUID()}${ext}`);
      },
    });
    upload = multer({
      storage,
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
      },
    });
  }
  return upload;
};

// Tool Links CRUD
router.get('/', requireRole('viewer'), (_req: Request, res: Response) => {
  try {
    const tools = toolLinkCrudService.listLinks();
    res.json({ success: true, data: tools });
  } catch (error) {
    logger.error('Failed to list tool links', error);
    res.status(500).json({ success: false, message: 'Failed to list tool links' });
  }
});

// 按 category 分组聚合（前端 ToolLinks 页消费）
router.get('/categories', requireRole('viewer'), (_req: Request, res: Response) => {
  try {
    const groups = toolLinkCrudService.listLinksByCategory();
    res.json({ success: true, data: groups });
  } catch (error) {
    logger.error('Failed to list tool link categories', error);
    res.status(500).json({ success: false, message: 'Failed to list tool link categories' });
  }
});

const createToolSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional(),
  category: z.string().optional(),
});

router.post(
  '/',
  requireRole('admin'),
  validateBody(createToolSchema),
  (req: Request, res: Response) => {
    try {
      const created = toolLinkCrudService.createLink(req.body);
      res.json({ success: true, data: created });
    } catch (error) {
      logger.error('Failed to create tool link', error);
      res.status(500).json({ success: false, message: 'Failed to create tool link' });
    }
  },
);

router.put(
  '/:id',
  requireRole('admin'),
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(createToolSchema.partial()),
  (req: Request, res: Response) => {
    try {
      const result = toolLinkCrudService.updateLink(req.params.id, req.body);
      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error });
      }
      res.json({ success: true, data: result.data });
    } catch (error) {
      logger.error('Failed to update tool link', error);
      res.status(500).json({ success: false, message: 'Failed to update tool link' });
    }
  },
);

router.delete(
  '/:id',
  requireRole('admin'),
  validateParams(z.object({ id: z.string().uuid() })),
  (req: Request, res: Response) => {
    try {
      toolLinkCrudService.deleteLink(req.params.id);
      res.json({ success: true, message: 'Tool link deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete tool link', error);
      res.status(500).json({ success: false, message: 'Failed to delete tool link' });
    }
  },
);

// Icon Upload
router.post(
  '/:id/icon',
  requireRole('admin'),
  validateParams(z.object({ id: z.string().uuid() })),
  (req: Request, res: Response, next: NextFunction) => {
    const u = getUpload();
    u.single('icon')(req, res, next);
  },
  (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      const data = toolLinkCrudService.updateIcon(
        req.params.id,
        `/tool-icons/${req.file.filename}`,
      );
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to upload icon', error);
      res.status(500).json({ success: false, message: 'Failed to upload icon' });
    }
  },
);

// Clear icon（清空 DB 字段，文件保留磁盘上以便恢复）
router.delete(
  '/:id/icon',
  requireRole('admin'),
  validateParams(z.object({ id: z.string().uuid() })),
  (req: Request, res: Response) => {
    try {
      const data = toolLinkCrudService.clearIcon(req.params.id);
      if (!data) {
        return res.status(404).json({ success: false, message: 'Tool link not found' });
      }
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to clear icon', error);
      res.status(500).json({ success: false, message: 'Failed to clear icon' });
    }
  },
);

// Serve static icons
router.get('/icons/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const uploadDir = ensureUploadDir();
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).end();
    }
    res.sendFile(filePath);
  } catch (error) {
    logger.error('Failed to serve icon', error);
    res.status(500).end();
  }
});

export default router;
