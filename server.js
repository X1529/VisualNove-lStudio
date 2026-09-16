// ─── Visual Novel Studio — Server Entrypoint (Render-ready) ─────────────────
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { PORT, HOST, BASE_URL, publicDir, publicAssetRoot, STANDALONE } = require('./src/config');
const { initDatabase, db } = require('./src/db');
const { MulterFileTypeError } = require('./src/upload');
const { sessionMiddleware, ownerMiddleware } = require('./src/auth');

const app = express();

// ─── Global process error handlers — กัน Application exited early แบบเงียบ ──
process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err);
  // ไม่ process.exit ทันที ให้ log ก่อน — Render จะ restart เองถ้าจำเป็น
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason);
});

// ─── Startup: Asset Directory Validation ────────────────────────────────────
// ตรวจสอบว่า /app/public/assets พร้อมใช้งาน — สำคัญมากสำหรับ Render Persistent Disk
function validateAssetDirectories() {
  const isRender = process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL;
  const assetSubdirs = ['characters', 'backgrounds', 'bgm', 'sfx', 'covers'];

  console.log('─── Asset Directory Validation ───');
  console.log(`   publicDir:        ${publicDir}`);
  console.log(`   publicAssetRoot:  ${publicAssetRoot}`);

  // 1. ตรวจว่า publicDir มีอยู่จริง
  if (!fs.existsSync(publicDir)) {
    console.error(`❌ CRITICAL: publicDir ไม่มีอยู่: ${publicDir}`);
    console.error('   Server ยังทำงานได้ แต่ static files จะ 404 ทั้งหมด');
    return false;
  }

  // 2. ตรวจว่า publicAssetRoot มีอยู่จริง
  if (!fs.existsSync(publicAssetRoot)) {
    console.warn(`⚠️ publicAssetRoot ไม่มีอยู่: ${publicAssetRoot}`);
    console.warn('   กำลังสร้าง directory...');
    try {
      fs.mkdirSync(publicAssetRoot, { recursive: true });
      console.log(`✅ สร้าง publicAssetRoot สำเร็จ: ${publicAssetRoot}`);
    } catch (err) {
      console.error(`❌ ไม่สามารถสร้าง publicAssetRoot ได้: ${err.message}`);
      console.error('   ตรวจสอบว่า Persistent Disk mount ถูกต้องบน Render Dashboard');
      return false;
    }
  }

  // 3. ตรวจว่าเขียนได้ (write test)
  const testFile = path.join(publicAssetRoot, '.write_test');
  try {
    fs.writeFileSync(testFile, 'ok', 'utf8');
    fs.unlinkSync(testFile);
    console.log(`✅ publicAssetRoot เขียนได้: ${publicAssetRoot}`);
  } catch (err) {
    console.error(`❌ CRITICAL: publicAssetRoot เขียนไม่ได้: ${publicAssetRoot}`);
    console.error(`   Error: ${err.message}`);
    if (isRender) {
      console.error('   ตรวจสอบ Render Dashboard > Service > Settings > Disk:');
      console.error('   - Mount Path ต้องเป็น /app/public/assets');
      console.error('   - Disk ต้องไม่ Empty (ต้องมีข้อมูลอยู่แล้ว หรือ mount สำเร็จ)');
    }
    return false;
  }

  // 4. ตรวจ subdirectories — สร้างถ้ายังไม่มี
  for (const sub of assetSubdirs) {
    const subPath = path.join(publicAssetRoot, sub);
    if (!fs.existsSync(subPath)) {
      console.warn(`⚠️ Subdirectory ไม่มีอยู่: ${sub} → กำลังสร้าง...`);
      try {
        fs.mkdirSync(subPath, { recursive: true });
        console.log(`   ✅ สร้าง ${sub} สำเร็จ`);
      } catch (err) {
        console.error(`   ❌ ไม่สามารถสร้าง ${sub} ได้: ${err.message}`);
      }
    }
  }

  // 5. นับไฟล์ที่มีอยู่ (สำหรับ diagnostic)
  let totalFiles = 0;
  for (const sub of assetSubdirs) {
    const subPath = path.join(publicAssetRoot, sub);
    try {
      const files = fs.readdirSync(subPath);
      totalFiles += files.length;
    } catch (_) {}
  }
  console.log(`   ไฟล์ที่มีอยู่: ${totalFiles} ไฟล์`);
  if (totalFiles === 0 && isRender) {
    console.warn('⚠️ ไม่มีไฟล์ assets เลย — ถ้าเคยมีไฟล์ก่อนหน้า อาจเป็น Persistent Disk ที่ empty');
    console.warn('   ตรวจสอบ Render Dashboard ว่า Disk ถูก mount ถูกต้อง');
  }

  // 6. ตรวจ tempUploadDir + ลบไฟล์ค้าง (stale temp files จาก upload ที่ล้มเหลว)
  const tempUploadDir = path.join(publicAssetRoot, '_uploads');
  if (!fs.existsSync(tempUploadDir)) {
    try {
      fs.mkdirSync(tempUploadDir, { recursive: true });
    } catch (_) {}
  }
  // ลบไฟล์ temp ที่ค้างเกิน 1 ชั่วโมง (กัน disk เต็ม)
  try {
    const tempFiles = fs.readdirSync(tempUploadDir);
    const now = Date.now();
    let cleaned = 0;
    for (const f of tempFiles) {
      const fp = path.join(tempUploadDir, f);
      try {
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > 3600000) { // > 1 hour
          fs.unlinkSync(fp);
          cleaned++;
        }
      } catch (_) {}
    }
    if (cleaned > 0) console.log(`   Cleaned ${cleaned} stale temp files from _uploads`);
  } catch (_) {}

  console.log('─── Asset Validation Complete ───');
  return true;
}

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

const allowedOrigins = (process.env.CORS_ORIGIN || BASE_URL)
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true
}));
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});
app.use(compression());

// ─── Health checks — ต้องอยู่ก่อน rate-limit / auth เพื่อให้ Render probe ได้ ─
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), port: PORT });
});
app.get('/health/db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: rows[0].ok === 1 ? 'connected' : 'unknown' });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});
app.get('/health/disk', (req, res) => {
  const assetSubdirs = ['characters', 'backgrounds', 'bgm', 'sfx', 'covers'];
  const result = { status: 'ok', assetRoot: publicAssetRoot, dirs: {}, writable: false };

  // Check writability
  const testFile = path.join(publicAssetRoot, '.health_test');
  try {
    fs.writeFileSync(testFile, 'ok', 'utf8');
    fs.unlinkSync(testFile);
    result.writable = true;
  } catch (e) {
    result.status = 'error';
    result.writable = false;
    result.error = e.message;
  }

  // Check subdirectories
  for (const sub of assetSubdirs) {
    const subPath = path.join(publicAssetRoot, sub);
    try {
      const files = fs.readdirSync(subPath);
      result.dirs[sub] = { exists: true, count: files.length };
    } catch (e) {
      result.dirs[sub] = { exists: false, error: e.code };
    }
  }

  const statusCode = result.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(result);
});
app.get('/health/dialogues', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT COUNT(*) AS cnt FROM dialogues');
    res.json({ status: 'ok', storage: 'TiDB Cloud', count: rows[0].cnt });
  } catch (e) {
    res.status(503).json({ status: 'error', storage: 'TiDB Cloud', error: e.message });
  }
});

// ─── Rate limiting ───────────────────────────────────────────────────────
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref?.();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const rec = hits.get(key) || { count: 0, reset: now + windowMs };
    if (now > rec.reset) { rec.count = 0; rec.reset = now + windowMs; }
    rec.count += 1;
    hits.set(key, rec);
    if (rec.count > max) {
      return res.status(429).json({ error: message || 'Too many requests' });
    }
    next();
  };
}
app.use('/api', createRateLimiter({
  windowMs: 10 * 60 * 1000, max: 600,
  message: 'Too many requests, please slow down'
}));
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000, max: 15,
  message: 'Too many login attempts, please try again later'
});
if (!STANDALONE) {
  app.use('/api/auth', authLimiter);
  app.use('/api/login', authLimiter);
}

app.use(sessionMiddleware());
app.use('/api', ownerMiddleware());

// Standalone health hint
if (STANDALONE) {
  console.log('ℹ️ Standalone bypass active — session/auth not required for Studio APIs');
}

// ─── Pages ─────────────────────────────────────────────────────────────────
const page = (name) => path.join(publicDir, name);
const dashboard = (req, res) => res.sendFile(page('dashboard.html'));

const dashboardRoutes = ['/', '/dashboard', '/dashboard.html', '/index.html', '/asset-manager', '/CRUD_asset.html'];
dashboardRoutes.forEach((route) => app.get(route, dashboard));
app.get('/game', (req, res) => res.sendFile(page('game.html')));

app.use(express.static(publicDir));

// ─── 404 Diagnostic Logging for Static Assets ───────────────────────────────
// ช่วยระบุสาเหตุของ 404 โดยไม่เปิดเผยข้อมูลลับ (ไม่ log full path บน disk)
app.use('/assets', (req, res, next) => {
  // ให้ Express static จัดการก่อน — ถ้าเจอไฟล์จะไม่เข้า middleware นี้
  // ถ้าไม่เจอ จะเข้า middleware นี้แทน
  const ext = path.extname(req.url).toLowerCase();
  const safeUrl = req.url.replace(/[^\w.\-/]/g, '_').slice(0, 100);
  console.warn(`[Asset 404] ${req.method} /assets${safeUrl} — File not found on disk`);
  console.warn(`  Hint: ตรวจว่า Persistent Disk mount ถูกต้อง และไฟล์อยู่ในโฟลเดอร์ที่ถูกต้อง`);
  next();
});

// ─── API Routes ────────────────────────────────────────────────────────────
require('./src/routes/assets').register(app);
require('./src/routes/stories').register(app);
require('./src/routes/chapters').register(app);
require('./src/routes/dialogues').register(app);
require('./src/routes/users').register(app);

// ─── Global Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof MulterFileTypeError || err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err.statusCode === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ─────────────────────────────────────────────────────────────────
async function startServer() {
  // Validate asset directories before anything else
  const assetsOk = validateAssetDirectories();
  if (!assetsOk) {
    console.error('❌ Asset directory validation failed — uploads will fail, existing assets may 404');
    console.error('   Server will still start to allow debugging via /health endpoints');
  }

  try {
    await initDatabase();
  } catch (err) {
    console.error('❌ Database init failed — server will still start but /health/db will be 503');
    console.error('   ตรวจ ENV บน Render: DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/DB_SSL');
    console.error('   Detail:', err.message);
    // ไม่ throw ต่อ — ให้ HTTP server ยัง bind port ได้เพื่อให้ Render ไม่ถือว่า exited early
    // ถ้าต้องการให้ fail fast ให้ uncomment บรรทัดถัดไป:
    // process.exit(1);
  }

  const bindHost = HOST || '0.0.0.0';
  const server = app.listen(PORT, bindHost, () => {
    console.log(`✅ Server running at ${BASE_URL} (listen ${bindHost}:${PORT}, env PORT=${process.env.PORT})`);
  });
  server.on('error', (err) => {
    console.error(`❌ เปิด port ${PORT} ไม่สำเร็จ: ${err.message}`);
    console.error('   ลองปิด process เดิม หรือรัน: PORT=3001 node server.js');
    process.exit(1);
  });
}

startServer();
