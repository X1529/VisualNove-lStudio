// ════════════════════════════════════════════════════════════════════
// shared-auth.js — โมดูลล็อกอินร่วม (Single Source of Truth)
// ใช้งานทั้งหน้า home และ dashboard เพื่อให้ล็อกอินเป็นหนึ่งเดียว:
//   - initGoogle: ดึง Client ID จาก /api/config แล้ว init Google Identity Services
//   - showLogin: เปิดป๊อปอัป/Modal ล็อกอิน Google
//   - getMe: ตรวจสอบผู้ใช้ปัจจุบันผ่าน session (/api/me)
//   - logout: เรียก /api/logout แล้ว reload
// Session ใช้ cookie เดียวกัน (same-origin) จึงสถานะตรงกันทุกหน้า
// ════════════════════════════════════════════════════════════════════

(function () {
  const API_BASE = window.location.origin;

  let gsiReady = false;
  let clientId = null;

  function getOverlay() {
    return document.getElementById('login-modal-overlay') ||
           document.getElementById('google-login-overlay');
  }

  const LOGIN_MODAL_HTML = `
      <div class="modal-box" role="dialog" aria-modal="true" style="text-align:center; max-width:400px;">
        <h3 class="modal-title" id="auth-modal-title">เข้าสู่ระบบ</h3>
        <p class="modal-message" id="auth-modal-msg">เลือกวิธีเข้าสู่ระบบ</p>
        <div id="auth-modal-body">
          <div style="text-align:left; padding:0 8px;">
            <div style="margin-bottom:10px;">
              <label style="font-size:13px; color:#ccc;">อีเมล</label>
              <input type="email" id="auth-email" placeholder="example@email.com"
                style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid #555; background:#1e1e2e; color:#fff; font-size:14px; box-sizing:border-box;">
            </div>
            <div style="margin-bottom:14px;">
              <label style="font-size:13px; color:#ccc;">รหัสผ่าน</label>
              <input type="password" id="auth-password" placeholder="อย่างน้อย 6 ตัวอักษร"
                style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid #555; background:#1e1e2e; color:#fff; font-size:14px; box-sizing:border-box;">
            </div>
            <div id="auth-name-field" style="display:none; margin-bottom:14px;">
              <label style="font-size:13px; color:#ccc;">ชื่อที่ต้องการแสดง</label>
              <input type="text" id="auth-display-name" placeholder="ชื่อของคุณ"
                style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid #555; background:#1e1e2e; color:#fff; font-size:14px; box-sizing:border-box;">
            </div>
            <div id="auth-error" style="color:#ff6b6b; font-size:13px; margin-bottom:10px; min-height:18px;"></div>
            <button id="auth-submit-btn"
              style="width:100%; padding:10px; border-radius:8px; border:none; background:linear-gradient(135deg,#5b6cff,#8b5cf6); color:#fff; font-size:15px; font-weight:600; cursor:pointer; margin-bottom:8px;">
              เข้าสู่ระบบ
            </button>
          </div>
          <div style="font-size:13px; color:#999; margin-bottom:14px;">
            <span id="auth-toggle-text">ยังไม่มีบัญชี?</span>
            <a href="#" id="auth-toggle-link" style="color:#8b5cf6; text-decoration:none; font-weight:600;">สมัครสมาชิก</a>
          </div>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px; padding:0 8px;">
            <div style="flex:1; height:1px; background:#444;"></div>
            <span style="font-size:12px; color:#777;">หรือ</span>
            <div style="flex:1; height:1px; background:#444;"></div>
          </div>
          <div id="google-signin-btn" style="display:flex; justify-content:center; margin-bottom:8px;"></div>
        </div>
      </div>`;

  function bindModalEvents(overlay) {
    let isRegister = false;
    const toggleLink = overlay.querySelector('#auth-toggle-link');
    const toggleText = overlay.querySelector('#auth-toggle-text');
    const nameField = overlay.querySelector('#auth-name-field');
    const submitBtn = overlay.querySelector('#auth-submit-btn');
    const titleEl = overlay.querySelector('#auth-modal-title');

    function setMode(register) {
      isRegister = register;
      if (register) {
        nameField.style.display = 'block';
        submitBtn.textContent = 'สมัครสมาชิก';
        toggleText.textContent = 'มีบัญชีอยู่แล้ว?';
        toggleLink.textContent = 'เข้าสู่ระบบ';
        titleEl.textContent = 'สมัครสมาชิก';
      } else {
        nameField.style.display = 'none';
        submitBtn.textContent = 'เข้าสู่ระบบ';
        toggleText.textContent = 'ยังไม่มีบัญชี?';
        toggleLink.textContent = 'สมัครสมาชิก';
        titleEl.textContent = 'เข้าสู่ระบบ';
      }
      overlay.querySelector('#auth-error').textContent = '';
    }
    toggleLink.addEventListener('click', (e) => { e.preventDefault(); setMode(!isRegister); });

    submitBtn.addEventListener('click', async () => {
      const email = overlay.querySelector('#auth-email').value.trim();
      const password = overlay.querySelector('#auth-password').value;
      const displayName = overlay.querySelector('#auth-display-name').value.trim();
      const errEl = overlay.querySelector('#auth-error');
      errEl.textContent = '';

      if (!email || !password) { errEl.textContent = 'กรุณากรอกอีเมลและรหัสผ่าน'; return; }

      submitBtn.disabled = true;
      submitBtn.textContent = isRegister ? 'กำลังสมัคร...' : 'กำลังเข้าสู่ระบบ...';

      try {
        const url = isRegister ? `${API_BASE}/api/auth/register` : `${API_BASE}/api/auth/login`;
        const body = isRegister ? { email, password, displayName } : { email, password };
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || 'เกิดข้อผิดพลาด'; return; }
        overlay.classList.add('hidden');
        window.dispatchEvent(new CustomEvent('auth:changed'));
        window.location.reload();
      } catch (e) {
        errEl.textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
      }
    });

    overlay.querySelector('#auth-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitBtn.click();
    });

    // ปิดการคลิกพื้นหลังแล้วปิด dialog — ตาม requirement ให้คลิกนอกไม่ปิด
    // overlay.addEventListener('click', (e) => {
    //   if (e.target === overlay) overlay.classList.add('hidden');
    // });
  }

  function ensureModal() {
    let overlay = getOverlay();
    if (overlay) {
      if (!overlay.querySelector('.modal-box')) {
        overlay.innerHTML = LOGIN_MODAL_HTML;
        bindModalEvents(overlay);
      }
      return overlay;
    }

    overlay = document.createElement('div');
    overlay.id = 'google-login-overlay';
    overlay.className = 'modal-overlay hidden';
    overlay.innerHTML = LOGIN_MODAL_HTML;
    document.body.appendChild(overlay);
    bindModalEvents(overlay);
    return overlay;
  }

  async function initGoogle() {
    if (gsiReady) return;
    try {
      const cfg = await fetch(`${API_BASE}/api/config`).then(r => r.json());
      if (!cfg.googleOAuthEnabled) {
        // OAuth ปิด — ซ่อน Google UI ไม่โหลด GSI
        const btn = document.getElementById('google-signin-btn');
        if (btn) btn.style.display = 'none';
        const divider = document.querySelector('#auth-modal-body .home-tabs, #auth-modal-body [style*="หรือ"]');
        // ไม่โหลด script, ไม่เรียก google.accounts
        return;
      }
      clientId = cfg.googleClientId;
      if (!clientId) return;
      // โหลด GSI script แบบ dynamic เฉพาะเมื่อ enabled
      if (typeof google === 'undefined' || !google.accounts) {
        await loadGsiScript();
        if (typeof google === 'undefined' || !google.accounts) return;
      }
      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential
      });
      const btn = document.getElementById('google-signin-btn');
      if (btn) {
        btn.style.display = 'flex';
        google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large', width: 260 });
      }
      gsiReady = true;
    } catch (e) {
      console.error('Google init error', e);
    }
  }

  function loadGsiScript() {
    return new Promise((resolve) => {
      if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = resolve;
      document.head.appendChild(s);
    });
  }

  async function handleCredential(response) {
    try {
      const cfg = await fetch(`${API_BASE}/api/config`).then(r => r.json()).catch(()=>({}));
      if (!cfg.googleOAuthEnabled) {
        alert('Google login ถูกปิดใช้งาน');
        return;
      }
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      if (!res.ok) throw new Error('Google login failed');
      const overlay = getOverlay();
      if (overlay) overlay.classList.add('hidden');
      window.dispatchEvent(new CustomEvent('auth:changed'));
      window.location.reload();
    } catch (e) {
      alert('ล็อกอินด้วย Google ไม่สำเร็จ');
    }
  }

  function showLogin() {
    const overlay = ensureModal();
    // ซ่อน/แสดง Google ส่วน ตาม config
    fetch(`${API_BASE}/api/config`).then(r=>r.json()).then(cfg=>{
      const btn = overlay.querySelector('#google-signin-btn');
      const dividers = overlay.querySelectorAll('[style*="หรือ"]');
      // ใช้ display none เมื่อ disabled (initGoogle จะจัดการ render)
      if (!cfg.googleOAuthEnabled && btn) btn.style.display='none';
    }).catch(()=>{});
    initGoogle();
    overlay.classList.remove('hidden');
  }

  async function getMe() {
    try {
      const res = await fetch(`${API_BASE}/api/me`);
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  function logout(redirectTo) {
    try {
      fetch(`${API_BASE}/api/logout`, { method: 'POST', keepalive: true });
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('auth:changed'));
    if (redirectTo) window.location.href = redirectTo;
    else window.location.reload();
  }

  window.Auth = { showLogin, getMe, logout, initGoogle, ensureModal };

  const VN_RETURN_KEY = 'vn_return_url';
  function setReturnContext(customUrl = null) {
    try {
      const returnUrl = customUrl || window.location.href;
      sessionStorage.setItem(VN_RETURN_KEY, returnUrl);
    } catch (_) {}
  }
  function getReturnContext(fallbackUrl = '/home.html') {
    try {
      const returnUrl = sessionStorage.getItem(VN_RETURN_KEY);
      return returnUrl || fallbackUrl;
    } catch (_) {
      return fallbackUrl;
    }
  }
  function navigateBackToSource(fallbackUrl = '/home.html') {
    const targetUrl = getReturnContext(fallbackUrl);
    try { sessionStorage.removeItem(VN_RETURN_KEY); } catch (_) {}
    window.location.href = targetUrl;
  }
  window.setReturnContext = setReturnContext;
  window.getReturnContext = getReturnContext;
  window.navigateBackToSource = navigateBackToSource;
  window.ReturnNav = { set: setReturnContext, get: getReturnContext, back: navigateBackToSource };
})();
