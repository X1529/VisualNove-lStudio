// ─── Dialogue Store: TiDB Cloud JSON Storage ──────────────────────────────
// เก็บบทสนทนาในตาราง dialogues ของ TiDB Cloud (JSON column)
// 1 Chapter = 1 row — โครงสร้าง: {chapter_id, story_id, title, next_id, assets_preload[], dialogues[]}
//
// ย้ายจาก filesystem (data/dialogues/chapter_<id>.json) มา TiDB Cloud
// เพื่อให้ข้อมูลคงอยู่ข้าม Render restart/redeploy/sleep/crash
//
// Migration อัตโนมัติ: ถ้าเจอไฟล์บน filesystem จะย้ายไป DB แล้วลบไฟล์เก่า

const path = require('path');
const fsp = require('fs/promises');
const fs = require('fs');

// ─── Lazy DB connection (ใช้ db จาก src/db.js) ─────────────────────────────
let _db = null;
function getDb() {
  if (!_db) {
    // ใช้ require cache — db.js ถูก init ก่อน dialogue-store.js เสมอ
    _db = require('./src/db').db;
  }
  return _db;
}

// ─── Legacy filesystem path (สำหรับ migration ครั้งเดียว) ──────────────────
const legacyDataRoot = path.join(__dirname, 'data', 'dialogues');

// ─── Per-chapter write lock ───────────────────────────────────────────────────
// กัน race condition ตอนอ่าน-แก้-เขียนพร้อมกัน (read-modify-write)
const writeLocks = new Map();

function withChapterLock(chapterId, task) {
  const key = `c${chapterId}`;
  const prev = writeLocks.get(key) || Promise.resolve();
  let release;
  const myTurn = new Promise((res) => { release = res; });
  const run = myTurn.then(task);
  const chained = run.then(() => {}, () => {});
  writeLocks.set(key, chained);
  prev.finally(() => release());
  chained.finally(() => {
    if (writeLocks.get(key) === chained) writeLocks.delete(key);
  });
  return run;
}

function emptyChapter(chapterId) {
  return {
    chapter_id: parseInt(chapterId, 10),
    story_id: null,
    title: '',
    next_id: 1,
    assets_preload: [],
    dialogues: []
  };
}

// ─── Migration: filesystem → TiDB (ครั้งเดียวตอน startup) ───────────────────
let _migrationDone = false;
async function migrateLegacyFiles() {
  if (_migrationDone) return;
  _migrationDone = true;

  try {
    const files = await fsp.readdir(legacyDataRoot);
    const jsonFiles = files.filter(f => f.startsWith('chapter_') && f.endsWith('.json'));
    if (jsonFiles.length === 0) return;

    console.log(`🔄 Migrating ${jsonFiles.length} dialogue files from filesystem to TiDB...`);
    const db = getDb();
    let migrated = 0;

    for (const file of jsonFiles) {
      try {
        const raw = await fsp.readFile(path.join(legacyDataRoot, file), 'utf8');
        const data = JSON.parse(raw);
        const chapterId = parseInt(file.replace('chapter_', '').replace('.json', ''), 10);

        if (isNaN(chapterId)) continue;

        // Upsert — ถ้ามีใน DB แล้ว ใช้ค่าที่ใหม่กว่า (ไฟล์ filesystem เป็น source of truth สำหรับข้อมูลเก่า)
        await db.query(
          `INSERT INTO dialogues (chapter_id, story_id, data)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             story_id = VALUES(story_id),
             data = VALUES(data)`,
          [chapterId, data.story_id || null, JSON.stringify(data)]
        );
        migrated++;
      } catch (err) {
        console.error(`  ❌ Failed to migrate ${file}: ${err.message}`);
      }
    }

    console.log(`✅ Migrated ${migrated}/${jsonFiles.length} dialogue files to TiDB`);

    // ลบไฟล์เก่าหลัง migration สำเร็จ
    for (const file of jsonFiles) {
      try {
        await fsp.unlink(path.join(legacyDataRoot, file));
      } catch (_) {}
    }
    console.log('✅ Legacy dialogue files cleaned up');
  } catch (err) {
    // data/dialogues อาจไม่มีไฟล์ (fresh install) — ไม่เป็นไร
    if (err.code !== 'ENOENT') {
      console.warn(`⚠️ Dialogue migration check: ${err.message}`);
    }
  }
}

// ─── Core API (始终保持เหมือนเดิม) ─────────────────────────────────────────

async function readChapter(chapterId) {
  const cid = parseInt(chapterId, 10);

  // Migration check (ครั้งเดียว)
  await migrateLegacyFiles();

  const db = getDb();
  try {
    const [rows] = await db.query(
      'SELECT data FROM dialogues WHERE chapter_id = ?',
      [cid]
    );

    if (rows.length === 0) {
      return emptyChapter(cid);
    }

    // data column เป็น JSON — mysql2 จะ parse อัตโนมัติถ้า config ถูก
    // แต่เพื่อความปลอดภัย รองรับทั้ง string และ object
    let data = rows[0].data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (_) { return emptyChapter(cid); }
    }

    return {
      ...emptyChapter(cid),
      ...data,
      chapter_id: cid,
      next_id: Number(data.next_id) || 1,
      assets_preload: Array.isArray(data.assets_preload) ? data.assets_preload : [],
      dialogues: Array.isArray(data.dialogues) ? data.dialogues : []
    };
  } catch (err) {
    console.error(`[DialogueStore] readChapter(${cid}) error:`, err.message);
    throw err;
  }
}

async function writeChapter(chapterId, data) {
  return withChapterLock(chapterId, async () => {
    const cid = parseInt(chapterId, 10);
    const db = getDb();

    // Ensure chapter_id ใน data สอดคล้องกัน
    const payload = {
      ...data,
      chapter_id: cid,
      next_id: Number(data.next_id) || 1,
      assets_preload: Array.isArray(data.assets_preload) ? data.assets_preload : [],
      dialogues: Array.isArray(data.dialogues) ? data.dialogues : []
    };

    try {
      await db.query(
        `INSERT INTO dialogues (chapter_id, story_id, data)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           story_id = VALUES(story_id),
           data = VALUES(data)`,
        [cid, payload.story_id || null, JSON.stringify(payload)]
      );
    } catch (err) {
      console.error(`[DialogueStore] writeChapter(${cid}) error:`, err.message);
      throw err;
    }
  });
}

async function deleteChapterFile(chapterId) {
  const cid = parseInt(chapterId, 10);
  const db = getDb();
  try {
    await db.query('DELETE FROM dialogues WHERE chapter_id = ?', [cid]);
  } catch (err) {
    console.error(`[DialogueStore] deleteChapter(${cid}) error:`, err.message);
    throw err;
  }
}

// ─── Exports (dataRoot ยัง export เพื่อ backward compatibility) ─────────────
module.exports = { readChapter, writeChapter, deleteChapterFile, emptyChapter, dataRoot: legacyDataRoot };
