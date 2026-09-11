#!/usr/bin/env node
// scripts/mergeAccounts.js — รวม localhost accounts -> Production Master Account
// ใช้ env: PRODUCTION_OWNER_EMAIL (บังคับ), PRODUCTION_OWNER_NAME, DB_*
// อ้างอิง schema จริง: users, stories(ch.user_id,guest_id), chapters, assets, user_providers
// - transaction, idempotent, verify orphan, backup reminder, invalidate session ผ่าน SESSION_SECRET ใหม่
// รัน: node scripts/mergeAccounts.js  หรือ  node scripts/mergeAccounts.js --execute
// ถ้าไม่ใส่ --execute จะเป็น dry-run

require('dotenv').config();
const { db } = require('../src/db');

const DRY_RUN = !process.argv.includes('--execute');
const MASTER_EMAIL = (process.env.PRODUCTION_OWNER_EMAIL || '').trim().toLowerCase();
const MASTER_NAME = process.env.PRODUCTION_OWNER_NAME || 'Production Owner';

async function backupReminder() {
  console.log('⚠️  BACKUP ก่อนรันจริง:');
  console.log('   mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME users stories chapters assets user_providers > backup_pre_merge_$(date +%Y%m%d).sql');
  console.log('   + tar czf backup_dialogues_$(date +%Y%m%d).tar.gz data/dialogues public/assets');
}

async function main() {
  if (!MASTER_EMAIL || !MASTER_EMAIL.includes('@')) {
    console.error('❌ ต้องตั้ง PRODUCTION_OWNER_EMAIL ใน .env ก่อน (ห้าม hardcode)');
    process.exit(1);
  }
  const conn = await db.getConnection();
  try {
    await backupReminder();
    if (DRY_RUN) console.log('\n🔍 DRY-RUN (ไม่เขียนจริง) — เติม --execute เพื่อรันจริง\n');

    // 1. หา/สร้าง Master Account (idempotent)
    const exec = async (sql, params) => DRY_RUN ? console.log(`[DRY] ${sql} --`, params) : conn.query(sql, params);

    // สร้าง master ถ้ายังไม่มี (ON DUPLICATE)
    await exec(
      `INSERT INTO users (email, display_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE display_name = COALESCE(VALUES(display_name), display_name)`,
      [MASTER_EMAIL, MASTER_NAME]
    );
    let master = null;
    let masterId = null;
    const [[found]] = await conn.query('SELECT user_id, email FROM users WHERE email = ? LIMIT 1', [MASTER_EMAIL]);
    if (found) {
      master = found;
      masterId = found.user_id;
      console.log(`✅ Master Account: ${master.email} (user_id=${masterId})`);
    } else if (DRY_RUN) {
      masterId = 9999;
      console.log(`ℹ️ DRY-RUN: Master ${MASTER_EMAIL} ยังไม่มีใน DB (จะถูกสร้างเป็น user_id ~ auto-increment) ใช้ placeholder id=${masterId} สำหรับแสดง SQL`);
    } else {
      throw new Error('Master account not found after upsert');
    }

    // 2. สำรวจ source accounts
    const [sources] = await conn.query('SELECT user_id, email, display_name FROM users WHERE user_id != ?', [masterId]);
    console.log(`📋 Source accounts found: ${sources.length}`);
    sources.forEach(u => console.log(`   - ${u.user_id}: ${u.email} (${u.display_name})`));

    // 3. นับก่อนย้าย
    const countOwned = async (tbl) => {
      const [[r]] = await conn.query(`SELECT COUNT(*) AS cnt FROM ${tbl} WHERE user_id IS NOT NULL AND user_id != ?`, [masterId]);
      return r.cnt;
    };
    const before = {
      stories: await countOwned('stories'),
      chapters: await countOwned('chapters'),
      assets: await countOwned('assets'),
    };
    console.log('📊 Before:', before);

    if (DRY_RUN) {
      console.log('\n--- DRY-RUN SQL ที่จะรัน ---');
      console.log(`UPDATE stories  SET user_id=${masterId} WHERE user_id IS NOT NULL AND user_id != ${masterId}`);
      console.log(`UPDATE chapters SET user_id=${masterId} WHERE user_id IS NOT NULL AND user_id != ${masterId}`);
      console.log(`UPDATE assets   SET user_id=${masterId} WHERE user_id IS NOT NULL AND user_id != ${masterId}`);
      console.log(`UPDATE users SET password_hash=NULL, google_id=NULL WHERE user_id != ${masterId}`);
      console.log(`DELETE FROM user_providers WHERE user_id != ${masterId}`);
      console.log('\n✅ DRY-RUN เสร็จ — ตรวจก่อนรันจริงด้วย --execute');
      return;
    }

    // 4. Transaction จริง
    await conn.beginTransaction();
    try {
      const [r1] = await conn.query('UPDATE stories  SET user_id = ? WHERE user_id IS NOT NULL AND user_id != ?', [masterId, masterId]);
      const [r2] = await conn.query('UPDATE chapters SET user_id = ? WHERE user_id IS NOT NULL AND user_id != ?', [masterId, masterId]);
      const [r3] = await conn.query('UPDATE assets   SET user_id = ? WHERE user_id IS NOT NULL AND user_id != ?', [masterId, masterId]);
      console.log(`✅ Reassigned: stories=${r1.affectedRows} chapters=${r2.affectedRows} assets=${r3.affectedRows}`);

      // 5. Verify orphan
      const [[o1]] = await conn.query('SELECT COUNT(*) AS cnt FROM stories  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT user_id FROM users)');
      const [[o2]] = await conn.query('SELECT COUNT(*) AS cnt FROM chapters WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT user_id FROM users)');
      const [[o3]] = await conn.query('SELECT COUNT(*) AS cnt FROM assets   WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT user_id FROM users)');
      if (o1.cnt + o2.cnt + o3.cnt > 0) throw new Error(`Orphan found stories=${o1.cnt} chapters=${o2.cnt} assets=${o3.cnt}`);
      console.log('✅ Orphan check: 0');

      // 6. Disable localhost accounts (ไม่ DELETE)
      const [uUpd] = await conn.query(
        `UPDATE users SET password_hash=NULL, google_id=NULL, display_name=CONCAT(display_name,' (migrated)') WHERE user_id != ?`,
        [masterId]
      );
      const [pDel] = await conn.query('DELETE FROM user_providers WHERE user_id != ?', [masterId]);
      console.log(`✅ Disabled accounts: users updated=${uUpd.affectedRows}, providers deleted=${pDel.affectedRows}`);

      await conn.commit();
      console.log('✅ COMMIT success');
    } catch (e) {
      await conn.rollback();
      throw e;
    }

    // 7. หลัง migrate
    const [after] = await conn.query(
      `SELECT 'stories' tbl, user_id, COUNT(*) cnt FROM stories GROUP BY user_id UNION ALL SELECT 'chapters', user_id, COUNT(*) FROM chapters GROUP BY user_id UNION ALL SELECT 'assets', user_id, COUNT(*) FROM assets GROUP BY user_id`
    );
    console.table(after);
    console.log('\n🔑 Session Reset: เปลี่ยน SESSION_SECRET ใหม่บน Production เพื่อ invalidate localhost session/cookie ทั้งหมด');
    console.log('🔐 Google OAuth: ตั้ง GOOGLE_CLIENT_ID/SECRET + BASE_URL/CORS_ORIGIN = https://your-production-domain');
    console.log('📁 Filesystem: public/assets/* และ data/dialogues/chapter_*.json ไม่มี user_id ใน path จึงไม่ต้องย้ายไฟล์ (ตรวจสอบแล้ว src/helpers.js:27, dialogue-store.js:19)');
  } finally {
    conn.release();
    await db.end().catch(()=>{});
  }
}

main().catch(e => { console.error('❌ Migration failed:', e.message); process.exit(1); });
