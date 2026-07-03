import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { requireRole } from '../../../middleware/auth';
import { z } from 'zod';
import { validateBody, validateParams } from '../../../middleware/validation';
import { toolLinksRepo } from '../../../repositories';

const router = Router();

// 延迟加载存储，避免启动时路径问题
let upload: ReturnType<typeof multer>;
const getUploadDir = () => path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../../../data/uploads/tool-icons'));
const ensureUploadDir = () => {
  const uploadDir = getUploadDir();
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (e) {
      console.warn(`Failed to create tool-icons upload directory: ${uploadDir}`, e);
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
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
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
    const tools = toolLinksRepo.list();
    res.json({ success: true, data: tools });
  } catch (error) {
    console.error('Failed to list tool links', error);
    res.status(500).json({ success: false, message: 'Failed to list tool links' });
  }
});

const createToolSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional(),
  category: z.string().optional(),
});

router.post('/', requireRole('admin'), validateBody(createToolSchema), (req: Request, res: Response) => {
  try {
    const { name, url, description, category } = req.body;
    const id = randomUUID();
    toolLinksRepo.create({ id, name, url, description, category });
    res.json({ success: true, data: toolLinksRepo.getById(id) });
  } catch (error) {
    console.error('Failed to create tool link', error);
    res.status(500).json({ success: false, message: 'Failed to create tool link' });
  }
});

router.put('/:id', requireRole('admin'), validateParams(z.object({ id: z.string().uuid() })), validateBody(createToolSchema.partial()), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, url, description, category } = req.body;
    const changes = toolLinksRepo.update(id, { name, url, description, category });
    if (changes === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    res.json({ success: true, data: toolLinksRepo.getById(id) });
  } catch (error) {
    console.error('Failed to update tool link', error);
    res.status(500).json({ success: false, message: 'Failed to update tool link' });
  }
});

router.delete('/:id', requireRole('admin'), validateParams(z.object({ id: z.string().uuid() })), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    toolLinksRepo.delete(id);
    res.json({ success: true, message: 'Tool link deleted successfully' });
  } catch (error) {
    console.error('Failed to delete tool link', error);
    res.status(500).json({ success: false, message: 'Failed to delete tool link' });
  }
});

// Icon Upload
router.post('/:id/icon', requireRole('admin'), validateParams(z.object({ id: z.string().uuid() })), (req: Request, res: Response, next: NextFunction) => {
  const u = getUpload();
  u.single('icon')(req, res, next);
}, (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const { id } = req.params;
    toolLinksRepo.updateIcon(id, `/tool-icons/${req.file.filename}`);
    res.json({ success: true, data: toolLinksRepo.getById(id) });
  } catch (error) {
    console.error('Failed to upload icon', error);
    res.status(500).json({ success: false, message: 'Failed to upload icon' });
  }
});

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
    console.error('Failed to serve icon', error);
    res.status(500).end();
  }
});

export default router;
