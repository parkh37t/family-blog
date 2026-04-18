import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { uploadFile } from '../storage.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
  },
});

const router = Router();

router.post('/', requireAuth, upload.array('files', 20), async (req, res, next) => {
  try {
    const uploaded = [];
    for (const file of req.files || []) {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomBytes(10).toString('hex')}${ext}`;
      const url = await uploadFile({ key, buffer: file.buffer, contentType: file.mimetype });
      uploaded.push({
        filename: url,        // store full URL so frontend uses it directly
        url,
        size: file.size,
        originalname: file.originalname,
      });
    }
    res.json({ files: uploaded });
  } catch (e) {
    next(e);
  }
});

export default router;
