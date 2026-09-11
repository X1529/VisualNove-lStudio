// ─── Upload (Multer) ───────────────────────────────────────────────────────
// กติกา: จำกัด 100 MB/ไฟล์ + อนุญาตเฉพาะ MIME ที่รู้จัก

const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { assetDirs, coverDir } = require('./config');

class MulterFileTypeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MulterFileTypeError';
  }
}

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac'
]);
const ALLOWED_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.mp3', '.ogg', '.wav', '.webm', '.aac', '.m4a', '.flac', '.oga'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // req.body อาจยังไม่พร้อมตอน destination callback ถ้า field มาหลัง file
    // เลยอ่าน type จาก query string สำรองไว้ด้วย — client ควรส่ง asset_type ก่อน file field
    const type = (req.body.asset_type || req.query.asset_type || 'character').toLowerCase();
    const dir = assetDirs[type] || assetDirs.character;
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, uniqueSuffix + '-' + safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new MulterFileTypeError(`ไม่อนุญาตประเภทไฟล์: ${file.mimetype}`));
    }
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new MulterFileTypeError(`ไม่อนุญาตนามสกุลไฟล์: ${ext}`));
    }
    // กัน double extension เช่น image.png.exe
    if (file.originalname.split('.').length > 3) {
      return cb(new MulterFileTypeError('ชื่อไฟล์ไม่ถูกต้อง'));
    }
    cb(null, true);
  }
});

// อัปโหลดรูปปก Story (จำกัดเฉพาะรูปภาพ)
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(coverDir, { recursive: true });
    cb(null, coverDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, uniqueSuffix + '-' + safeName);
  }
});

const coverUpload = multer({
  storage: coverStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = require('path').extname(file.originalname).toLowerCase();
    const allowedCoverExt = new Set(['.png','.jpg','.jpeg','.gif','.webp']);
    if (!file.mimetype.startsWith('image/')) {
      return cb(new MulterFileTypeError(`ไม่อนุญาตประเภทไฟล์: ${file.mimetype}`));
    }
    if (!allowedCoverExt.has(ext)) {
      return cb(new MulterFileTypeError(`ไม่อนุญาตนามสกุลไฟล์: ${ext}`));
    }
    cb(null, true);
  }
});

module.exports = { upload, coverUpload, MulterFileTypeError };
