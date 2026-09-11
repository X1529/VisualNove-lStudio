// ─── Config ────────────────────────────────────────────────────────────────
// ค่ากลางของระบบ อ่านจาก .env (dotenv ถูก require ที่ server.js ก่อนไฟล์นี้เสมอ)

const path = require('path');

// Google OAuth — ปิดชั่วคราวสำหรับ Localhost/Pre-Production
// GOOGLE_OAUTH_ENABLED=false (default) = ใช้ Local Account เท่านั้น
const GOOGLE_OAUTH_ENABLED = String(process.env.GOOGLE_OAUTH_ENABLED || 'false').toLowerCase() === 'true';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
if (GOOGLE_OAUTH_ENABLED && !GOOGLE_CLIENT_ID) {
  console.warn('⚠️ GOOGLE_OAUTH_ENABLED=true แต่ GOOGLE_CLIENT_ID ไม่ตั้ง — Google Login จะล้มเหลว');
}
if (!GOOGLE_OAUTH_ENABLED) {
  console.log('ℹ️ Google OAuth DISABLED — ใช้ Local Account (PRODUCTION_OWNER_EMAIL) เท่านั้น');
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const CORS_ORIGIN = process.env.CORS_ORIGIN || BASE_URL;

// Production Master Account — อ่านจาก env เท่านั้น ห้าม hardcode
const PRODUCTION_OWNER_EMAIL = (process.env.PRODUCTION_OWNER_EMAIL || '').trim().toLowerCase();
const PRODUCTION_OWNER_NAME = process.env.PRODUCTION_OWNER_NAME || 'Production Owner';
const PRODUCTION_OWNER_ROLE = process.env.PRODUCTION_OWNER_ROLE || 'admin';

// [SECURITY] เสิร์ฟเฉพาะไฟล์ frontend ใน public/ เท่านั้น
// ห้ามใช้ express.static(__dirname) เพราะจะโหลด server.js / package.json ออกไปได้
const publicDir = path.join(__dirname, '..', 'public');
const publicAssetRoot = path.join(publicDir, 'assets');

const assetDirs = {
  character:  path.join(publicAssetRoot, 'characters'),
  background: path.join(publicAssetRoot, 'backgrounds'),
  bgm:        path.join(publicAssetRoot, 'bgm'),
  sfx:        path.join(publicAssetRoot, 'sfx')
};

// โฟลเดอร์รูปปก Story (อัปโหลดจากเครื่อง)
const coverDir = path.join(publicAssetRoot, 'covers');

module.exports = { PORT, HOST, BASE_URL, CORS_ORIGIN, GOOGLE_OAUTH_ENABLED, GOOGLE_CLIENT_ID, PRODUCTION_OWNER_EMAIL, PRODUCTION_OWNER_NAME, PRODUCTION_OWNER_ROLE, publicDir, publicAssetRoot, assetDirs, coverDir };
