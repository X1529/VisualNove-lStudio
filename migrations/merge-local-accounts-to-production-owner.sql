-- migrations/merge-local-accounts-to-production-owner.sql
-- วัตถุประสงค์: รวม ownership จาก localhost accounts ทั้งหมด -> Production Master Account เดียว
-- อ้างอิง schema จริง: users(user_id,email,google_id), stories/chapters/assets(user_id,guest_id), user_providers(user_id)
-- กฎ: ห้าม hardcode email, ใช้ placeholder :MASTER_EMAIL ให้แทนค่าจาก PRODUCTION_OWNER_EMAIL ก่อนรัน
-- idempotent + transaction + verify + rollback ได้
-- BACKUP ก่อนรัน: mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME users stories chapters assets user_providers > backup_pre_merge_$(date +%Y%m%d).sql

-- 0. ตั้งค่าตัวแปร (แทนค่าจริงก่อนรัน)
-- SET @MASTER_EMAIL = 'PRODUCTION_OWNER_EMAIL';
-- SET @MASTER_NAME  = 'Production Owner';

START TRANSACTION;

-- 1. สร้าง/หา Master Account (idempotent, ใช้ email unique)
INSERT INTO users (email, display_name, password_hash, google_id)
VALUES (@MASTER_EMAIL, @MASTER_NAME, NULL, NULL)
ON DUPLICATE KEY UPDATE display_name = COALESCE(VALUES(display_name), display_name);

-- ดึง master_id หลัง insert
SET @MASTER_ID = (SELECT user_id FROM users WHERE email = @MASTER_EMAIL LIMIT 1);

-- Guard: ต้องได้ master_id
-- ถ้า @MASTER_ID IS NULL ให้ ROLLBACK
-- SELECT IF(@MASTER_ID IS NULL, (SELECT 'ERROR: Master account not found'), 'OK');

-- 2. แสดงบัญชีต้นทางที่จะถูกย้าย (เพื่อ audit)
SELECT user_id, email, display_name FROM users WHERE user_id != @MASTER_ID;

-- 3. รวม Ownership — stories / chapters / assets
-- stories: user_id ownership -> master, guest_id เคลียร์ถ้าเคยเป็น guest ของ master? ไม่ย้าย guest ที่ไม่ใช่ของ master
UPDATE stories   SET user_id = @MASTER_ID WHERE user_id IS NOT NULL AND user_id != @MASTER_ID;
UPDATE chapters  SET user_id = @MASTER_ID WHERE user_id IS NOT NULL AND user_id != @MASTER_ID;
UPDATE assets    SET user_id = @MASTER_ID WHERE user_id IS NOT NULL AND user_id != @MASTER_ID;

-- หมายเหตุ: dialogues ไม่ย้าย — เก็บเป็นไฟล์ data/dialogues/chapter_<id>.json ไม่ผูก user_id โดยตรง จะตาม story/chapter ที่ย้ายแล้ว
-- uploads: file_path ใน assets ชี้ public/assets/... ไม่มี user_id ใน path จึงไม่ต้องย้ายไฟล์

-- 4. Verify — ต้องไม่มี orphan
SELECT 'stories orphan' AS check_name, COUNT(*) AS cnt FROM stories  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT user_id FROM users)
UNION ALL SELECT 'chapters orphan', COUNT(*) FROM chapters WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT user_id FROM users)
UNION ALL SELECT 'assets orphan',   COUNT(*) FROM assets   WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT user_id FROM users);

-- 5. แสดงผลหลังย้าย
SELECT 'stories' AS tbl, user_id, COUNT(*) AS cnt FROM stories GROUP BY user_id
UNION ALL SELECT 'chapters', user_id, COUNT(*) FROM chapters GROUP BY user_id
UNION ALL SELECT 'assets',   user_id, COUNT(*) FROM assets   GROUP BY user_id;

-- 6. Disable localhost accounts (ไม่ DELETE เพื่อกันพลาด FK) — ล้าง credential ให้ login ไม่ได้
-- ถ้าต้องการเก็บ history ให้คง row ไว้ แต่ทำให้ login ไม่ได้
UPDATE users
SET password_hash = NULL,
    google_id = NULL,
    display_name = CONCAT(display_name, ' (migrated)')
WHERE user_id != @MASTER_ID
  AND email != @MASTER_EMAIL;

-- ลบ provider ของ account เก่า (กัน Google login ย้อน)
DELETE FROM user_providers WHERE user_id != @MASTER_ID;

-- 7. จบ transaction — ถ้า verify ข้างบนพบ orphan >0 ให้ ROLLBACK เอง
COMMIT;

-- 8. หลัง COMMIT: ต้องเปลี่ยน SESSION_SECRET บน production เพื่อ invalidate localhost session/cookie ทั้งหมด
-- และตั้ง GOOGLE_CLIENT_ID/SECRET + BASE_URL/CORS_ORIGIN เป็น https://your-production-domain

-- ROLLBACK ตัวอย่างเมื่อต้องการย้อน:
-- ROLLBACK;
