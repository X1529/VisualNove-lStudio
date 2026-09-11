// ─── Users API (Mock / Future Google Login) ──────────────────────────────────

const { GOOGLE_CLIENT_ID, GOOGLE_OAUTH_ENABLED } = require('../config');
const bcrypt = require('bcryptjs');
const {
  getCurrentUser, requireApiAuth, findUserByGoogleId, createUserFromGoogle,
  migrateGuestToUser
} = require('../auth');

function register(app) {
  // คืน config ให้ browser — ถ้า GOOGLE_OAUTH_ENABLED=false จะไม่ส่ง clientId (กันโหลด GSI)
  app.get('/api/config', (req, res) => {
    if (!GOOGLE_OAUTH_ENABLED) {
      return res.json({ googleOAuthEnabled: false, googleClientId: null });
    }
    res.json({ googleOAuthEnabled: true, googleClientId: GOOGLE_CLIENT_ID });
  });

  // ล็อกอิน (ตอนนี้จำลอง: ใช้ mock user id=1)
  // ⚠️ อนุญาตเฉพาะในโหมด development เท่านั้น — ใน production ให้ใช้ /api/auth/google หรือ /api/auth/login
  app.post('/api/login', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Mock login disabled in production' });
    }
    try {
      const user = await getCurrentUser(1);
      if (!user) return res.status(404).json({ error: 'Mock user not found' });
      req.session.userId = user.user_id;
      const gid = req.owner && req.owner.kind === 'guest' ? req.owner.guestId : null;
      await migrateGuestToUser(gid, user.user_id);
      res.clearCookie('guest_id');
      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // ─── Email/Password: สมัครสมาชิก ─────────────────────────────────────
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, displayName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
      }

      // ตรวจอีเมลซ้ำ
      const [existing] = await require('../db').db.query(
        'SELECT user_id FROM users WHERE email = ?', [email]
      );
      if (existing.length) {
        return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' });
      }

      const hash = await bcrypt.hash(String(password), 10);
      const [result] = await require('../db').db.query(
        `INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)`,
        [email, hash, displayName || email.split('@')[0]]
      );
      const userId = result.insertId;

      req.session.userId = userId;

      // Migration: ย้ายข้อมูล guest มาเป็นของ user นี้
      const gid = req.owner && req.owner.kind === 'guest' ? req.owner.guestId : null;
      await migrateGuestToUser(gid, userId);
      res.clearCookie('guest_id');

      const user = await getCurrentUser(userId);
      res.status(201).json(user);
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'สมัครสมาชิกไม่สำเร็จ' });
    }
  });

  // ─── Email/Password: เข้าสู่ระบบ ──────────────────────────────────────
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
      }

      const [rows] = await require('../db').db.query(
        'SELECT user_id, email, password_hash, display_name, avatar_url FROM users WHERE email = ?',
        [email]
      );
      const user = rows[0];
      if (!user || !user.password_hash) {
        return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
      }

      const ok = await bcrypt.compare(String(password), user.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
      }

      req.session.userId = user.user_id;

      const gid = req.owner && req.owner.kind === 'guest' ? req.owner.guestId : null;
      await migrateGuestToUser(gid, user.user_id);
      res.clearCookie('guest_id');

      res.json({ user_id: user.user_id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'เข้าสู่ระบบไม่สำเร็จ' });
    }
  });

  // ล็อกอินด้วย Google: ปิดเมื่อ GOOGLE_OAUTH_ENABLED=false (ไม่เรียก tokeninfo)
  app.post('/api/auth/google', async (req, res) => {
    if (!GOOGLE_OAUTH_ENABLED) {
      return res.status(403).json({ error: 'Google authentication is disabled' });
    }
    try {
      const { credential } = req.body;
      if (!credential) return res.status(400).json({ error: 'Missing credential' });

      // ⚠️ ต้องตรวจสอบลายเซ็น (signature) ของ ID token ผ่าน Google
      //    วิธีที่ง่ายและปลอดภัยคือส่งไปให้ tokeninfo ตรวจสอบให้
      let info;
      try {
        const verifyRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
        );
        info = await verifyRes.json();
        if (!verifyRes.ok || info.error) {
          return res.status(401).json({ error: 'Invalid Google token', detail: info.error_description });
        }
      } catch (netErr) {
        console.error('Google tokeninfo error:', netErr);
        return res.status(502).json({ error: 'Unable to verify Google token' });
      }

      // ตรวจ aud / iss / exp (tokeninfo ตรวจ signature ให้แล้ว)
      if (info.aud !== GOOGLE_CLIENT_ID) {
        return res.status(401).json({ error: 'Client ID mismatch (GOOGLE_CLIENT_ID in .env ไม่ตรงกับฝั่ง Google Console)' });
      }
      if (!String(info.iss || '').includes('accounts.google.com')) {
        return res.status(401).json({ error: 'Invalid issuer' });
      }
      if (info.exp && Date.now() / 1000 > Number(info.exp)) {
        return res.status(401).json({ error: 'Token expired' });
      }

      const googleId = info.sub;
      let user = await findUserByGoogleId(googleId);
      if (!user) {
        const userId = await createUserFromGoogle({
          email: info.email,
          googleId,
          displayName: info.name,
          avatarUrl: info.picture
        });
        user = await findUserByGoogleId(googleId);
        if (!user) {
          return res.status(500).json({ error: 'Failed to create user' });
        }
      }

      req.session.userId = user.user_id;
      // Migration: ย้ายข้อมูล guest (ถ้ามี) มาเป็นของ user นี้
      const gid = req.owner && req.owner.kind === 'guest' ? req.owner.guestId : null;
      await migrateGuestToUser(gid, user.user_id);
      res.clearCookie('guest_id');
      res.json(user);
    } catch (err) {
      console.error('Google auth error:', err);
      res.status(500).json({ error: 'Google login failed', detail: err.message });
    }
  });

  // ออกจากระบบ
  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('vn.sid');
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });

  // โปรไฟล์ผู้ใช้ปัจจุบัน (คืนผู้ใช้ที่ล็อกอินจริง จาก session)
  app.get('/api/me', requireApiAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req.session.userId);
      if (!user) return res.status(404).json({ error: 'Not logged in' });
      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to load user' });
    }
  });
}

module.exports = { register };
