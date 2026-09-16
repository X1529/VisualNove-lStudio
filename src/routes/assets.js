// ─── Assets API ────────────────────────────────────────────────────────────
// CRUD asset + จัดการไฟล์จริงบนดิสก์ (upload/replace/delete)

const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { upload, MulterFileTypeError } = require('../upload');
const {
  getFolderNameByType,
  placeCharacterFile,
  safeFilePath,
  normalizeAssetRow
} = require('../helpers');
const { ownerWhere, ownerValues, requireApiAuth, assertStoryOwner } = require('../auth');
const { assetDirs, publicAssetRoot } = require('../config');

// ย้ายไฟล์จาก tempUploadDir ไปโฟลเดอร์ถาวรตาม asset_type
// คืน relative path สำหรับเก็บใน DB (ใช้โดย Express static middleware)
function moveUploadedFile(file, assetType, assetName) {
  const type = (assetType || 'character').toLowerCase();
  if (type === 'character') {
    return placeCharacterFile(file, assetName || file.originalname);
  }
  const folder = getFolderNameByType(type);
  const destDir = assetDirs[type] || path.join(publicAssetRoot, folder);
  fs.mkdirSync(destDir, { recursive: true });
  const destAbs = path.join(destDir, path.basename(file.path));
  if (path.resolve(destAbs) !== path.resolve(file.path)) {
    fs.renameSync(file.path, destAbs);
  }
  return `/assets/${folder}/${path.basename(file.path)}`;
}

function register(app) {
  app.get('/api/assets', async (req, res) => {
    try {
      // ?mine=1 → โหมดสตูดิโอ คืนเฉพาะ asset ของเจ้าของ (user_id/guest_id)
      // ปกติ → คืนทั้งหมด (หน้าเกมโหลด asset สาธารณะจากหลายเรื่องได้)
      let rows;
      if (req.query.mine === '1') {
        const o = ownerWhere(req);
        [rows] = await db.query(
          `SELECT * FROM assets WHERE ${o.clause} ORDER BY asset_id DESC`,
          o.params
        );
      } else {
        [rows] = await db.query('SELECT * FROM assets ORDER BY asset_id DESC');
      }
      res.json(rows.map(normalizeAssetRow));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch assets' });
    }
  });

  app.get('/api/assets/:assetId', async (req, res) => {
    try {
      const [rows] = await db.query('SELECT * FROM assets WHERE asset_id = ?', [req.params.assetId]);
      if (!rows.length) return res.status(404).json({ error: 'Asset not found' });
      res.json(normalizeAssetRow(rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch asset' });
    }
  });

  app.get('/api/chapters/:chapterId/assets', async (req, res) => {
    try {
      const [rows] = await db.query(
        'SELECT * FROM assets WHERE chapter_id = ? ORDER BY asset_type, asset_name',
        [req.params.chapterId]
      );
      res.json(rows.map(normalizeAssetRow));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch chapter assets' });
    }
  });

  app.post('/api/assets', requireApiAuth, upload.single('file'), async (req, res) => {
    try {
      let { story_id, chapter_id, asset_type, asset_name } = req.body;

      if (!req.file) return res.status(400).json({ error: 'File is required' });

      // ถ้าไม่ส่ง story_id มา -> ใช้ story แรกของเจ้าของปัจจุบันแทน (กัน FK fail เมื่อ story_id=1 ไม่มี)
      if (!story_id) {
        const o = ownerWhere(req);
        const [myStories] = await db.query(`SELECT story_id FROM stories WHERE ${o.clause} ORDER BY story_id ASC LIMIT 1`, o.params);
        if (myStories.length) {
          story_id = myStories[0].story_id;
        } else {
          // ลบไฟล์ที่อัปโหลดแล้วทิ้งก่อนตอบ error
          try { fs.unlinkSync(req.file.path); } catch(_) {}
          return res.status(400).json({ error: 'กรุณาสร้าง Story ก่อนอัปโหลด Asset' });
        }
      }

      // ห้ามผูก asset เข้า story ของคนอื่น
      if (!(await assertStoryOwner(req, res, story_id))) return;

      // ย้ายไฟล์จาก temp ไปโฟลเดอร์ถาวรตาม asset_type (req.body พร้อมแล้วตอนนี้)
      const relativePath = moveUploadedFile(req.file, asset_type, asset_name || req.file.originalname);

      const ov = ownerValues(req);
      const [result] = await db.query(
        `INSERT INTO assets
           (story_id, chapter_id, asset_type, asset_name, file_name, file_path, mime_type, size_bytes, user_id, guest_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          story_id,
          chapter_id || null,
          asset_type || 'character',
          asset_name || req.file.originalname,
          req.file.originalname,
          relativePath,
          req.file.mimetype,
          req.file.size,
          ov.user_id,
          ov.guest_id
        ]
      );

      res.status(201).json({
        success:  true,
        asset_id: result.insertId,
        file_url: relativePath
      });
    } catch (err) {
      console.error('POST /api/assets error:', err);
      if (err instanceof MulterFileTypeError) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: 'Failed to create asset', detail: err.message });
    }
  });

  app.put('/api/assets/:assetId', requireApiAuth, upload.single('file'), async (req, res) => {
    try {
      const { story_id, chapter_id, asset_type, asset_name } = req.body;
      const [existingRows] = await db.query(
        'SELECT * FROM assets WHERE asset_id = ?',
        [req.params.assetId]
      );

      if (!existingRows.length) return res.status(404).json({ error: 'Asset not found' });

      const existing = existingRows[0];
      // ถ้ามีการย้ายไป story อื่น ต้องเป็น story ของผู้ใช้เท่านั้น
      if (story_id && String(story_id) !== String(existing.story_id)
          && !(await assertStoryOwner(req, res, story_id))) return;
      let nextPath  = existing.file_path;
      let fileName  = existing.file_name;
      let mimeType  = existing.mime_type;
      let sizeBytes = existing.size_bytes;

      if (req.file) {
        // ลบไฟล์เก่าก่อนใช้ไฟล์ใหม่
        const oldFilePath = safeFilePath(existing.file_path);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);

        // ย้ายไฟล์จาก temp ไปโฟลเดอร์ถาวร (req.body พร้อมแล้วตอนนี้)
        nextPath  = moveUploadedFile(req.file, asset_type || existing.asset_type, asset_name || existing.asset_name);
        fileName  = req.file.originalname;
        mimeType  = req.file.mimetype;
        sizeBytes = req.file.size;
      }

      const o = ownerWhere(req);
      await db.query(
        `UPDATE assets
         SET story_id = ?, chapter_id = ?, asset_type = ?, asset_name = ?,
             file_name = ?, file_path = ?, mime_type = ?, size_bytes = ?
         WHERE asset_id = ? AND ${o.clause}`,
        [
          story_id   || existing.story_id,
          chapter_id === '' ? null : (chapter_id || existing.chapter_id),
          asset_type || existing.asset_type,
          asset_name || existing.asset_name,
          fileName,
          nextPath,
          mimeType,
          sizeBytes,
          req.params.assetId,
          ...o.params
        ]
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update asset' });
    }
  });

  app.delete('/api/assets/:assetId', requireApiAuth, async (req, res) => {
    try {
      const o = ownerWhere(req);
      const [rows] = await db.query(
        `SELECT * FROM assets WHERE asset_id = ? AND ${o.clause}`,
        [req.params.assetId, ...o.params]
      );
      if (!rows.length) return res.status(404).json({ error: 'Asset not found' });

      // ลบไฟล์จริงออกจากดิสก์ด้วย
      const filePath = safeFilePath(rows[0].file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await db.query('DELETE FROM assets WHERE asset_id = ?', [req.params.assetId]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete asset' });
    }
  });
}

module.exports = { register };
