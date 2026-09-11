// ─── Visual Novel Studio — Server Entrypoint (Render-ready) ─────────────────
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const multer = require('multer');

const { PORT, HOST, BASE_URL, publicDir } = require('./src/config');
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
app.use('/api/auth', authLimiter);
app.use('/api/login', authLimiter);

app.use(sessionMiddleware());
app.use('/api', ownerMiddleware());

// ─── Pages ─────────────────────────────────────────────────────────────────
const page = (name) => path.join(publicDir, name);
const dashboard = (req, res) => res.sendFile(page('dashboard.html'));

const dashboardRoutes = ['/', '/dashboard', '/dashboard.html', '/index.html', '/asset-manager', '/CRUD_asset.html'];
dashboardRoutes.forEach((route) => app.get(route, dashboard));
app.get('/game', (req, res) => res.sendFile(page('game.html')));

app.use(express.static(publicDir));

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
