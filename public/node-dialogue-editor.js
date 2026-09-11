// ─── Node Content Editor (Dialogue Editor แบบ old — หน้าแยก) ────────────
// แก้ไขบรรทัดใน Node เดียว (node.lines + node.choices) อย่างเป็นหน้าเอง
// ไม่ทับซ้อนกับกราฟ: คลิก Node ในกราฟ → มาหน้านี้ → บันทึก/กลับกราฟ
// ตัวเลือก (Choices) ตั้งชื่อที่นี่ ส่วนการลากเชื่อมเป้าหมายทำบนกราฟ

let ndeChapterId = null;
let ndeNodeId = null;
let ndeNode = null;          // reference ของ node ใน cache (แก้แล้วส่งผลถึงกราฟ)
let ndeLines = [];           // working copy ของ node.lines
let ndeChoices = [];         // working copy ของ node.choices
let ndeEditingLineIdx = 0;
let ndeNodeTitle = '';
let ndePaletteType = 'all';
let ndeSearch = '';
let ndeZonesBound = false;
let ndeTabsBound = false;

const UI_ELEMENTS = ['dialogueLine', 'speakerName', 'dialogueText'];
function normalizeUiArrays(line) {
  if (!line) return;
  // migrate legacy hideUi boolean -> hideUiElements all
  if (line.hideUi && (!line.hideUiElements || !line.hideUiElements.length) && (!line.showUiElements || !line.showUiElements.length)) {
    // if hideUi true and no granular set, treat as hide all (for editor migration preview)
    // keep hideUi for compat but also populate hideUiElements
    line.hideUiElements = [...UI_ELEMENTS];
  }
  if (!Array.isArray(line.hideUiElements)) line.hideUiElements = [];
  if (!Array.isArray(line.showUiElements)) line.showUiElements = [];
  // sanitize: keep only valid keys, dedup
  line.hideUiElements = [...new Set(line.hideUiElements.filter(x => UI_ELEMENTS.includes(x)))];
  line.showUiElements = [...new Set(line.showUiElements.filter(x => UI_ELEMENTS.includes(x)))];
  // remove overlap: if same element in both, prefer hide? we allow but UI will apply show first then hide; normalize by removing conflict
  // keep both to let game apply show then hide sequentially, but editor disallows conflict by unchecking counterpart
}

function assetName(a) { return (a && (a.name || a.asset_name)) || ''; }

/* ───────────── แท็บนำทาง (Edit Line / Choices / อื่นๆ) ───────────── */
function ndeShowTab(tab) {
  document.querySelectorAll('#node-editor .nde-main-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('#node-editor .nde-tab-panel').forEach(p => p.classList.toggle('hidden', p.dataset.tab !== tab));
}

function ndeInitTabs() {
  if (ndeTabsBound) return;
  ndeTabsBound = true;
  document.querySelectorAll('#node-editor .nde-main-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => ndeShowTab(btn.dataset.tab));
  });
}

/* ───────────── เข้าหน้าแก้ไข Node ───────────── */
function openNodeContentEditor(nodeId) {
  ndeChapterId = currentChapterId;
  ndeNode = (typeof getChapterNodes === 'function') ? getChapterNodes(ndeChapterId).find(n => n.dialogue_id === nodeId) : null;
  if (!ndeNode) return;
  ndeNodeId = nodeId;
  const clonedLines = JSON.parse(JSON.stringify(ndeNode.lines && ndeNode.lines.length ? ndeNode.lines : []));
  if (clonedLines.length) {
    clonedLines.forEach(l => normalizeUiArrays(l));
    ndeLines = clonedLines;
  } else {
    ndeLines = [{ speaker: 'center', name: '', identity: '', text: '', bg: null, bgm: null, sfx: null, characters: [], flash: false, flashDuration: 400, shake: false, shakeType: 'shake-horizontal', shakeDuration: 300, hideUi: false, hideUiElements: [], showUiElements: [] }];
  }
  ndeLines.forEach(normalizeUiArrays);
  ndeChoices = JSON.parse(JSON.stringify(ndeNode.choices || []));
  ndeNodeTitle = ndeNode.title || '';
  ndeEditingLineIdx = 0;
  ndePaletteType = 'all';
  ndeSearch = '';

  document.getElementById('nde-node-id').textContent = nodeId;
  document.getElementById('nde-node-title-input').value = ndeNodeTitle;
  document.getElementById('nde-asset-search').value = '';
  document.querySelectorAll('#nde-tabs .de-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'all'));

  document.getElementById('nde-add-new-line-btn').onclick = () => ndeAddNewLine();
  document.getElementById('nde-add-choice-btn').onclick = () => ndeAddChoice();
  document.getElementById('nde-node-title-input').oninput = (e) => { ndeNodeTitle = e.target.value; };
  document.getElementById('nde-speaker-input').oninput = (e) => { if (ndeLines[ndeEditingLineIdx]) ndeLines[ndeEditingLineIdx].name = e.target.value; };
  document.getElementById('nde-dialogue-input').oninput = (e) => { if (ndeLines[ndeEditingLineIdx]) ndeLines[ndeEditingLineIdx].text = e.target.value; };

  const ft = document.getElementById('nde-flash-toggle');
  if (ft) ft.onchange = (e) => { if (ndeLines[ndeEditingLineIdx]) ndeLines[ndeEditingLineIdx].flash = e.target.checked; };
  const fd = document.getElementById('nde-flash-duration');
  if (fd) fd.oninput = (e) => {
    if (!ndeLines[ndeEditingLineIdx]) return;
    const v = Number(e.target.value);
    ndeLines[ndeEditingLineIdx].flashDuration = v;
    const lbl = document.getElementById('nde-flash-duration-val');
    if (lbl) lbl.textContent = v;
  };

  const st = document.getElementById('nde-shake-toggle');
  if (st) st.onchange = (e) => { if (ndeLines[ndeEditingLineIdx]) ndeLines[ndeEditingLineIdx].shake = e.target.checked; };
  const sType = document.getElementById('nde-shake-type');
  if (sType) sType.onchange = (e) => { if (ndeLines[ndeEditingLineIdx]) ndeLines[ndeEditingLineIdx].shakeType = e.target.value; };
  const sd = document.getElementById('nde-shake-duration');
  if (sd) sd.oninput = (e) => {
    if (!ndeLines[ndeEditingLineIdx]) return;
    const v = Number(e.target.value);
    ndeLines[ndeEditingLineIdx].shakeDuration = v;
    const lbl = document.getElementById('nde-shake-duration-val');
    if (lbl) lbl.textContent = v;
  };

  // Hide/Show granular handlers
  const uiMap = [
    ['nde-hide-line', 'hideUiElements', 'dialogueLine'],
    ['nde-hide-speaker', 'hideUiElements', 'speakerName'],
    ['nde-hide-text', 'hideUiElements', 'dialogueText'],
    ['nde-show-line', 'showUiElements', 'dialogueLine'],
    ['nde-show-speaker', 'showUiElements', 'speakerName'],
    ['nde-show-text', 'showUiElements', 'dialogueText'],
  ];
  uiMap.forEach(([id, arrKey, val]) => {
    const el = document.getElementById(id);
    if (el) el.onchange = (e) => {
      const line = ndeLines[ndeEditingLineIdx];
      if (!line) return;
      normalizeUiArrays(line);
      const arr = line[arrKey];
      if (e.target.checked) {
        if (!arr.includes(val)) arr.push(val);
        // prevent same element being both hide and show simultaneously (auto uncheck counterpart)
        const counterpart = arrKey === 'hideUiElements' ? 'showUiElements' : 'hideUiElements';
        const idx = line[counterpart].indexOf(val);
        if (idx > -1) {
          line[counterpart].splice(idx, 1);
          const counterpartId = arrKey === 'hideUiElements'
            ? id.replace('nde-hide-', 'nde-show-')
            : id.replace('nde-show-', 'nde-hide-');
          const cEl = document.getElementById(counterpartId);
          if (cEl) cEl.checked = false;
        }
      } else {
        const idx = arr.indexOf(val);
        if (idx > -1) arr.splice(idx, 1);
      }
      // clear legacy flag when using granular
      if (line.hideUiElements.length || line.showUiElements.length) line.hideUi = false;
      console.log('[Dialogue UI Visibility] changed', { id, val, arrKey, hideUiElements: line.hideUiElements, showUiElements: line.showUiElements, lineIdx: ndeEditingLineIdx });
    };
  });
  // legacy fallback (if old HTML still present)
  const hu = document.getElementById('nde-hideui-toggle');
  if (hu) hu.onchange = (e) => { if (ndeLines[ndeEditingLineIdx]) { ndeLines[ndeEditingLineIdx].hideUi = e.target.checked; if (e.target.checked) { ndeLines[ndeEditingLineIdx].hideUiElements = [...UI_ELEMENTS]; ndeLines[ndeEditingLineIdx].showUiElements = []; } } };

  document.querySelectorAll('#nde-tabs .de-tab-btn').forEach(btn => btn.onclick = () => {
    document.querySelectorAll('#nde-tabs .de-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ndePaletteType = btn.dataset.type;
    ndeRenderPalette();
  });
  document.getElementById('nde-asset-search').oninput = (e) => { ndeSearch = e.target.value.trim(); ndeRenderPalette(); };

  ndeBindZones();
  ndeBindGlobalDrop();
  ndeInitTabs();
  ndeInitAiTab();
  ndeBindNextChapter();
  (allAssets && allAssets.length ? Promise.resolve() : (typeof loadAssets === 'function' ? loadAssets().catch(() => {}) : Promise.resolve()))
    .then(() => { ndeRenderPalette(); ndeRenderForm(); });

  ndeRenderLines();
  ndeRenderForm();
  ndeRenderChoices();
  ndeShowTab('line');

  if (typeof showSection === 'function') showSection('node-editor');
}

async function backToNodeGraph() {
  await saveNodeContent();
  if (typeof showSection === 'function') showSection('editor');
  if (typeof RenderEngine !== 'undefined' && RenderEngine.renderGraph) RenderEngine.renderGraph();
}

async function saveNodeContent() {
  if (!ndeNode) return;
  ndeNode.lines = ndeLines;
  ndeNode.choices = ndeChoices;
  ndeNode.title = ndeNodeTitle;
  console.log('[Dialogue UI Visibility] BEFORE SAVE', { nodeId: ndeNodeId, lines: JSON.parse(JSON.stringify(ndeNode.lines)) });
  if (typeof DataBridge !== 'undefined' && DataBridge.save) {
    await DataBridge.save();
  } else if (typeof DataBridge !== 'undefined' && DataBridge.scheduleSave) DataBridge.scheduleSave();
  ndeNotify('บันทึกเรียบร้อย');
}

/* ───────────── ตอนต่อไป (Next Chapter) ───────────── */
async function ndeBindNextChapter() {
  const sel = document.getElementById('nde-next-chapter');
  if (!sel) return;

  sel.onchange = (e) => {
    const v = e.target.value ? Number(e.target.value) : null;
    if (ndeNode) ndeNode.nextChapter = v;
    if (typeof DataBridge !== 'undefined' && DataBridge.scheduleSave) DataBridge.scheduleSave();
  };

  const sId = (typeof selectedStoryId !== 'undefined' && selectedStoryId) ? selectedStoryId : null;
  sel.innerHTML = '<option value="">— ไม่มี (จบจริง) —</option>';
  if (!sId) return;

  let curNum = null;
  const ch = (typeof loadedChapters !== 'undefined' ? loadedChapters : []).find(c => c.chapter_id === ndeChapterId);
  if (ch) curNum = ch.chapter_number;

  try {
    const res = await fetch(`/api/stories/${sId}/chapters`);
    if (!res.ok) return;
    const data = await res.json();
    const chapters = data.chapters || [];
    chapters
      .filter(c => (c.chapter_number !== undefined ? c.chapter_number : c.chapterNumber) !== curNum)
      .forEach(c => {
        const num = c.chapter_number !== undefined ? c.chapter_number : c.chapterNumber;
        const opt = document.createElement('option');
        opt.value = num;
        opt.textContent = `ตอนที่ ${num}${c.title ? ' — ' + c.title : ''}`;
        sel.appendChild(opt);
      });
    sel.value = (ndeNode && ndeNode.nextChapter != null) ? String(ndeNode.nextChapter) : '';
  } catch (e) { /* ignore */ }
}

/* ───────────── รายการบรรทัด ───────────── */
function ndeRenderLines() {
  const list = document.getElementById('nde-line-list');
  document.getElementById('nde-line-count').textContent = ndeLines.length;
  list.innerHTML = ndeLines.map((l, i) => `
    <div class="de-line-list-item ${i === ndeEditingLineIdx ? 'editing' : ''}" data-idx="${i}">
      <div class="de-line-list-item-info">
        <span class="order">#${i + 1}</span>
        <span class="speaker">${escapeHtml(l.name || 'Narrator')}</span>
      </div>
      <div class="de-line-text">${escapeHtml((l.text || '').split('\n')[0] || '(ว่าง)')}</div>
      <div style="display: flex; gap: 4px; align-items: center;">
        <button class="de-line-preview-btn btn-danger" data-preview="${i}" title="เล่นตั้งแต่บรรทัดนี้" style="font-size:10px; padding:2px 6px;">▶ Preview</button>
        <button class="de-line-delete-btn" data-del="${i}" title="ลบ">🗑️</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.de-line-list-item').forEach(el => el.addEventListener('click', (e) => {
    if (e.target.closest('button')) return; // Ignore if clicked on buttons
    ndeEditingLineIdx = Number(el.dataset.idx);
    ndeRenderLines();
    ndeRenderForm();
    ndeShowTab('line');
  }));
  list.querySelectorAll('.de-line-preview-btn').forEach(btn => btn.onclick = async (e) => {
    e.stopPropagation();
    const idx = Number(btn.dataset.preview);
    const ch = (typeof loadedChapters !== 'undefined' ? loadedChapters : []).find(c => c.chapter_id === ndeChapterId);
    const chapterNum = ch ? ch.chapter_number : 1;
    const sId = typeof selectedStoryId !== 'undefined' ? selectedStoryId : 1;
    const targetUrl = `/game.html?story=${sId}&chapter=${chapterNum}&previewNode=${ndeNodeId}&previewLine=${idx}&fromPreview=1`;
    
    // บันทึก state ก่อนไป
    sessionStorage.setItem('de_restore', JSON.stringify({
      storyId: sId,
      chapterId: ndeChapterId,
      nodeId: ndeNodeId
    }));

    saveNodeContent();
    if (typeof DataBridge !== 'undefined' && DataBridge.save) await DataBridge.save();

    // Return-to-Source: preview จาก Studio ต้องกดย้อนกลับมา Studio ได้เสมอ
    if (typeof setReturnContext === 'function') setReturnContext(window.location.href);
    window.location.href = targetUrl;
  });
  list.querySelectorAll('.de-line-delete-btn').forEach(btn => btn.onclick = (e) => {
    e.stopPropagation();
    ndeDeleteLine(Number(btn.dataset.del));
  });
}

function ndeAddNewLine() {
  const prev = ndeLines[ndeLines.length - 1] || {};
  ndeLines.push({
    speaker: 'center',
    name: '',
    identity: '',
    text: '',
    bg: (prev.bg != null) ? prev.bg : null,
    bgm: null, // ไม่คัดลอก BGM — ใส่ครั้งเดียวได้หลายบรรทัด
    sfx: (prev.sfx != null) ? prev.sfx : null,
    characters: Array.isArray(prev.characters) ? JSON.parse(JSON.stringify(prev.characters)) : [],
    flash: false,
    flashDuration: 400,
    shake: false,
    shakeType: 'shake-horizontal',
    shakeDuration: 300,
    hideUi: false,
    hideUiElements: [],
    showUiElements: []
  });
  ndeEditingLineIdx = ndeLines.length - 1;
  ndeRenderLines();
  ndeRenderForm();
  ndeShowTab('line');
}

function ndeDeleteLine(i) {
  if (ndeLines.length <= 1) { showAlert('Node ต้องมีอย่างน้อย 1 บรรทัด'); return; }
  ndeLines.splice(i, 1);
  ndeEditingLineIdx = Math.max(0, Math.min(ndeEditingLineIdx, ndeLines.length - 1));
  ndeRenderLines();
  ndeRenderForm();
}

/* ───────────── ฟอร์มบรรทัด ───────────── */
function ndeRenderForm() {
  const line = ndeLines[ndeEditingLineIdx];
  if (!line) return;
  document.getElementById('nde-form-title').textContent = 'Edit Line #' + (ndeEditingLineIdx + 1);
  document.getElementById('nde-speaker-input').value = line.name || '';
  document.getElementById('nde-dialogue-input').value = line.text || '';
  const flashToggle = document.getElementById('nde-flash-toggle');
  if (flashToggle) flashToggle.checked = !!line.flash;
  const flashDur = document.getElementById('nde-flash-duration');
  if (flashDur) { flashDur.value = line.flashDuration || 400; const lbl = document.getElementById('nde-flash-duration-val'); if (lbl) lbl.textContent = line.flashDuration || 400; }
  const shakeToggle = document.getElementById('nde-shake-toggle');
  if (shakeToggle) shakeToggle.checked = !!line.shake;
  const shakeType = document.getElementById('nde-shake-type');
  if (shakeType) shakeType.value = line.shakeType || 'shake-horizontal';
  const shakeDur = document.getElementById('nde-shake-duration');
  if (shakeDur) { shakeDur.value = line.shakeDuration || 300; const lbl = document.getElementById('nde-shake-duration-val'); if (lbl) lbl.textContent = line.shakeDuration || 300; }
  normalizeUiArrays(line);
  const hideToggle = document.getElementById('nde-hideui-toggle');
  if (hideToggle) hideToggle.checked = !!line.hideUi;
  // granular UI
  const hideLineEl = document.getElementById('nde-hide-line');
  const hideSpeakerEl = document.getElementById('nde-hide-speaker');
  const hideTextEl = document.getElementById('nde-hide-text');
  const showLineEl = document.getElementById('nde-show-line');
  const showSpeakerEl = document.getElementById('nde-show-speaker');
  const showTextEl = document.getElementById('nde-show-text');
  // legacy hideUi true -> show all hide checked
  const effectiveHide = line.hideUi ? [...UI_ELEMENTS] : line.hideUiElements;
  if (hideLineEl) hideLineEl.checked = effectiveHide.includes('dialogueLine');
  if (hideSpeakerEl) hideSpeakerEl.checked = effectiveHide.includes('speakerName');
  if (hideTextEl) hideTextEl.checked = effectiveHide.includes('dialogueText');
  if (showLineEl) showLineEl.checked = line.showUiElements.includes('dialogueLine');
  if (showSpeakerEl) showSpeakerEl.checked = line.showUiElements.includes('speakerName');
  if (showTextEl) showTextEl.checked = line.showUiElements.includes('dialogueText');
  ndeRenderZoneCards();
}

// วาดการ์ดใน drop zones ตามข้อมูลบรรทัดปัจจุบัน
// (แยกจาก ndeRenderForm เพื่อไม่ต้องรีเซ็ตค่า input เวลาลาก asset ใส่โซน)
function ndeRenderZoneCards() {
  const line = ndeLines[ndeEditingLineIdx];
  if (!line) return;
  document.querySelectorAll('#node-editor .de-drop-zone').forEach(zone => {
    const type = zone.dataset.accept;
    const pos = zone.dataset.position;
    const old = zone.querySelector('.de-asset-card'); if (old) old.remove();
    const ph = zone.querySelector('.de-placeholder'); if (ph) ph.style.display = '';
    let matchId = null;
    let charEntry = null;
    if (type === 'character') {
      charEntry = (line.characters || []).find(c => c.position === pos);
      matchId = charEntry ? charEntry.asset_id : null;
    } else if (type === 'background') matchId = line.bg;
    else if (type === 'bgm') matchId = line.bgm;
    else if (type === 'sfx') matchId = line.sfx;

    if (matchId != null) {
      const asset = Array.isArray(allAssets) ? allAssets.find(a => a.asset_id === Number(matchId)) : null;
      if (asset) {
        if (ph) ph.style.display = 'none';
        const card = document.createElement('div');
        card.className = 'de-asset-card';
        card.dataset.type = type;
        card.dataset.id = matchId;
        card.dataset.name = assetName(asset);
        const isAudio = (type === 'bgm' || type === 'sfx');
        const thumb = (!isAudio && asset.file_url) ? `<div class="de-asset-thumb"><img src="${asset.file_url}" alt=""></div>` : '';
        card.innerHTML = `<span class="de-type-badge">${type}</span>${thumb}<div class="de-title">${escapeHtml(assetName(asset))}</div>`;

        if (type === 'character') {
          if (!charEntry || !charEntry.highlight) card.classList.add('is-dim');
          const controls = document.createElement('div');
          controls.className = 'de-zone-card-controls';
          controls.innerHTML = `
            <label class="de-flag-check"><input type="checkbox" data-flag="highlight" ${charEntry && charEntry.highlight ? 'checked' : ''}> Highlight</label>`;
          card.appendChild(controls);
          controls.querySelector('input[data-flag]').onchange = (e) => {
            if (!charEntry) return;
            charEntry.highlight = e.target.checked;
            ndeRenderZoneCards();
          };
        }

        zone.appendChild(card);
      }
    }
  });
}

/* ───────────── Choices (ชื่อตัวเลือก) ───────────── */
function ndeRenderChoices() {
  const c = document.getElementById('nde-choices-container');
  c.innerHTML = ndeChoices.map((ch, i) => `
    <div class="de-choice-item">
      <span class="de-choice-order" title="ลำดับตัวเลือก">#${i + 1}</span>
      <input type="text" class="choice-text-input" placeholder="Choice text" value="${escapeHtml(ch.text || '')}">
      <button class="de-choice-move" data-move="up" data-idx="${i}" title="เลื่อนขึ้น" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button class="de-choice-move" data-move="down" data-idx="${i}" title="เลื่อนลง" ${i === ndeChoices.length - 1 ? 'disabled' : ''}>▼</button>
      <button class="btn-danger" data-del="${i}" title="ลบ">✕</button>
    </div>`).join('');
  c.querySelectorAll('.choice-text-input').forEach((inp, i) => inp.oninput = () => { ndeChoices[i].text = inp.value; });
  c.querySelectorAll('button[data-del]').forEach(btn => btn.onclick = () => {
    ndeChoices.splice(Number(btn.dataset.del), 1);
    ndeRenderChoices();
  });
  c.querySelectorAll('.de-choice-move').forEach(btn => btn.onclick = () => {
    const idx = Number(btn.dataset.idx);
    ndeMoveChoice(idx, btn.dataset.move === 'up' ? -1 : 1);
  });
}

function ndeMoveChoice(idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= ndeChoices.length) return;
  const tmp = ndeChoices[idx];
  ndeChoices[idx] = ndeChoices[target];
  ndeChoices[target] = tmp;
  ndeRenderChoices();
}

function ndeAddChoice() { ndeChoices.push({ text: '', next: null }); ndeRenderChoices(); }

/* ทดสอบแสงแฟลชบนหน้า Editor (overlay ขาวกระพริบบนทั้งจอ) */
function previewFlashEffect() {
  const durEl = document.getElementById('nde-flash-duration');
  const dur = (durEl && Number(durEl.value)) || 400;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:99999;transition:opacity 0.1s ease-out;';
  document.body.appendChild(ov);
  requestAnimationFrame(() => { ov.style.opacity = '0.95'; });
  setTimeout(() => { ov.style.opacity = '0'; }, 110);
  setTimeout(() => { ov.remove(); }, 110 + Math.max(dur, 200));
}

/* ทดสอบ Screen Shake บนหน้า Editor */
function previewShakeEffect() {
  const typeEl = document.getElementById('nde-shake-type');
  const durEl = document.getElementById('nde-shake-duration');
  const type = (typeEl && typeEl.value) || 'shake-horizontal';
  const dur = (durEl && Number(durEl.value)) || 300;
  const gameScreen = document.getElementById('game-screen') || document.getElementById('node-editor') || document.body;
  const classes = ['shake-horizontal', 'shake-vertical', 'shake-heavy'];
  classes.forEach(c => gameScreen.classList.remove(c));
  gameScreen.style.setProperty('--shake-dur', dur + 'ms');
  void gameScreen.offsetWidth;
  gameScreen.classList.add(type);
  gameScreen.addEventListener('animationend', () => {
    gameScreen.classList.remove(type);
  }, { once: true });
}

/* ───────────── Asset Library (palette) ───────────── */
function ndeRenderPalette() {
  const list = document.getElementById('nde-asset-list');
  if (!list) return;
  let items = Array.isArray(allAssets) ? allAssets.slice() : [];
  if (ndePaletteType !== 'all') items = items.filter(a => a.asset_type === ndePaletteType);
  if (ndeSearch) {
    const t = ndeSearch.toLowerCase();
    items = items.filter(a => assetName(a).toLowerCase().includes(t));
  }
  list.innerHTML = items.map(a => {
    const isAudio = a.asset_type === 'bgm' || a.asset_type === 'sfx';
    const thumb = (!isAudio && a.file_url)
      ? `<img src="${a.file_url}" alt="">`
      : `<span class="de-card-audio">${isAudio ? '🔊' : '🖼️'}</span>`;
    return `
    <div class="de-asset-card" draggable="true" data-type="${a.asset_type}" data-id="${a.asset_id}" data-name="${escapeHtml(assetName(a))}">
      <div class="de-asset-thumb">${thumb}</div>
      <div class="de-title">${escapeHtml(assetName(a))}</div>
    </div>`;
  }).join('');

  list.querySelectorAll('.de-asset-card').forEach(card => card.addEventListener('dragstart', () => {
    draggedAsset = { id: card.dataset.id, name: card.dataset.name, type: card.dataset.type };
  }));
}

/* ───────────── Drop zones ───────────── */

// Scene Assets (BG/BGM/SFX) รองรับ "โซนอัตโนมัติ" = ลากทิ้งจุดไหนก็ได้ของจอ
// ยกเว้น: Asset Library, ช่องกรอกข้อความ, ตัวเลือก, ตัวละคร (ป้องกันผิดโซน)
function isSceneType(type) {
  return type === 'background' || type === 'bgm' || type === 'sfx';
}

function ndeIsExcludedDropTarget(el) {
  if (!el) return true;
  if (el.closest('#node-editor .de-right-library')) return true;   // Asset Library (ต้นทาง)
  if (el.closest('.nde-section-characters')) return true;          // ตัวละคร
  if (el.closest('.nde-section-choices')) return true;             // ตัวเลือก
  if (el.closest('input, textarea, select')) return true;         // ช่องกรอกข้อความ
  if (el.closest('.de-drop-zone')) return true;                    // ให้โซนจัดการเอง
  return false;
}

function ndeBindGlobalDrop() {
  const root = document.getElementById('node-editor');
  if (!root || root.dataset.globalBound) return;
  root.dataset.globalBound = '1';

  root.addEventListener('dragover', (e) => {
    if (!draggedAsset || !isSceneType(draggedAsset.type)) return;
    if (ndeIsExcludedDropTarget(e.target)) return;
    e.preventDefault(); // อนุญาต drop ทั่วจอ (ยกเว้นพื้นที่ต้องห้าม)
  });

  root.addEventListener('drop', (e) => {
    if (!draggedAsset || !isSceneType(draggedAsset.type)) return;
    if (ndeIsExcludedDropTarget(e.target)) return;
    e.preventDefault();
    const zone = document.querySelector(`#node-editor .de-drop-zone[data-accept="${draggedAsset.type}"]`);
    if (zone) ndePlaceCard(zone, draggedAsset);
    draggedAsset = null;
  });
}

function ndeBindZones() {
  if (ndeZonesBound) return;
  ndeZonesBound = true;
  document.querySelectorAll('#node-editor .de-drop-zone').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      const acceptType = zone.dataset.accept;
      if (draggedAsset && draggedAsset.type === acceptType) {
        e.preventDefault();
        zone.classList.add('drag-over');
      }
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const acceptType = zone.dataset.accept;
      if (!draggedAsset || draggedAsset.type !== acceptType) {
        ndeNotify(`ช่องนี้รับเฉพาะหมวดหมู่ [${acceptType.toUpperCase()}] เท่านั้น!`, true);
        return;
      }
      ndePlaceCard(zone, draggedAsset);
    });
    zone.addEventListener('dblclick', () => ndeClearZone(zone));
  });
}

function ndePlaceCard(zone, cardData) {
  const line = ndeLines[ndeEditingLineIdx];
  if (!line) return;
  const type = zone.dataset.accept;
  const old = zone.querySelector('.de-asset-card'); if (old) old.remove();

  if (type === 'character') {
    const pos = zone.dataset.position;
    line.characters = (line.characters || []).filter(c => !(c.position === pos));
    line.characters.push({ asset_id: Number(cardData.id), position: pos, highlight: true });
    if (!line.name) line.name = String(cardData.name).split('_')[0];
  } else if (type === 'background') line.bg = Number(cardData.id);
  else if (type === 'bgm') line.bgm = Number(cardData.id);
  else if (type === 'sfx') line.sfx = Number(cardData.id);

  ndeRenderZoneCards();
}

function ndeClearZone(zone) {
  const line = ndeLines[ndeEditingLineIdx];
  if (!line) return;
  const type = zone.dataset.accept;
  const old = zone.querySelector('.de-asset-card'); if (old) old.remove();
  const ph = zone.querySelector('.de-placeholder'); if (ph) ph.style.display = '';

  if (type === 'character') {
    const pos = zone.dataset.position;
    line.characters = (line.characters || []).filter(c => c.position !== pos);
  } else if (type === 'background') line.bg = null;
  else if (type === 'bgm') line.bgm = null;
  else if (type === 'sfx') line.sfx = null;
  ndeRenderZoneCards();
}

/* ───────────── AI Generated (Groq Cloud) ───────────── */
let ndeAiGenerating = false;

function ndeInitAiTab() {
  const keyInput = document.getElementById('nde-ai-api-key');
  const keyToggle = document.getElementById('nde-ai-key-toggle');
  const keyClear = document.getElementById('nde-ai-key-clear');
  const genBtn = document.getElementById('nde-ai-generate-btn');
  const applyBtn = document.getElementById('nde-ai-apply-btn');

  // Restore key from sessionStorage (if any)
  const savedKey = sessionStorage.getItem('nde_groq_key') || '';
  if (keyInput && savedKey) keyInput.value = savedKey;

  // Toggle visibility
  if (keyToggle) keyToggle.onclick = () => {
    const isPassword = keyInput.type === 'password';
    keyInput.type = isPassword ? 'text' : 'password';
    keyToggle.innerHTML = isPassword ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
  };

  // Clear key
  if (keyClear) keyClear.onclick = () => {
    keyInput.value = '';
    sessionStorage.removeItem('nde_groq_key');
    ndeAiNotify('API Key ถูกลบแล้ว');
  };

  // Save key to sessionStorage on input
  if (keyInput) keyInput.oninput = () => {
    sessionStorage.setItem('nde_groq_key', keyInput.value.trim());
  };

  // Generate button
  if (genBtn) genBtn.onclick = () => ndeAiGenerate();

  // Apply button
  if (applyBtn) applyBtn.onclick = () => ndeAiApplyResult();
}

async function ndeAiGenerate() {
  if (ndeAiGenerating) return;

  const apiKey = (document.getElementById('nde-ai-api-key')?.value || '').trim();
  const systemPrompt = (document.getElementById('nde-ai-system-prompt')?.value || '').trim();
  const userPrompt = (document.getElementById('nde-ai-user-prompt')?.value || '').trim();

  if (!apiKey) { ndeAiNotify('กรุณาใส่ Groq API Key', true); return; }
  if (!systemPrompt) { ndeAiNotify('กรุณาใส่ System Prompt', true); return; }
  if (!userPrompt) { ndeAiNotify('กรุณาใส่ User Prompt', true); return; }

  const genBtn = document.getElementById('nde-ai-generate-btn');
  const statusEl = document.getElementById('nde-ai-status');
  const resultEl = document.getElementById('nde-ai-result');
  const resultJson = document.getElementById('nde-ai-result-json');
  const applyBtn = document.getElementById('nde-ai-apply-btn');

  ndeAiGenerating = true;
  genBtn.disabled = true;
  genBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> กำลังสร้าง...';
  statusEl.className = 'nde-ai-status';
  statusEl.textContent = 'กำลังส่งคำสั่งไปยัง Groq API...';
  resultEl.classList.add('hidden');
  applyBtn.disabled = true;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content);

    resultJson.textContent = JSON.stringify(parsed, null, 2);
    resultEl.classList.remove('hidden');
    applyBtn.disabled = false;
    applyBtn.dataset.result = content;
    statusEl.textContent = 'สร้างสำเร็จ! กด "นำไปใช้" เพื่ออัปเดต Node';
    statusEl.className = 'nde-ai-status success';
  } catch (err) {
    statusEl.textContent = 'ผิดพลาด: ' + err.message;
    statusEl.className = 'nde-ai-status error';
  } finally {
    ndeAiGenerating = false;
    genBtn.disabled = false;
    genBtn.innerHTML = '<i class="bi bi-stars"></i> สร้างเนื้อหาด้วย AI';
  }
}

function ndeAiApplyResult() {
  const applyBtn = document.getElementById('nde-ai-apply-btn');
  const raw = applyBtn?.dataset?.result;
  if (!raw) return;

  let parsed;
  try { parsed = JSON.parse(raw); } catch { ndeAiNotify('JSON ไม่ถูกต้อง', true); return; }

  // Support multiple formats:
  // 1. { dialogues: [{ lines: [...], choices: [...] }] }
  // 2. { lines: [...], choices: [...] }
  // 3. { text: "...", speaker: "..." }  (single line)
  // 4. Array of lines

  let lines = [];
  let choices = [];

  if (Array.isArray(parsed)) {
    lines = parsed;
  } else if (parsed.dialogues && Array.isArray(parsed.dialogues)) {
    // If multiple dialogues, take the first one (or all if only one)
    const d = parsed.dialogues[0] || {};
    lines = d.lines || [];
    choices = d.choices || [];
  } else if (parsed.lines) {
    lines = parsed.lines || [];
    choices = parsed.choices || [];
  } else if (parsed.text || parsed.speaker || parsed.name) {
    lines = [parsed];
  } else {
    ndeAiNotify('ไม่รู้จักรูปแบบผลลัพธ์ — ลองปรับ User Prompt', true);
    return;
  }

  // Normalize each line to match the data model
  lines = lines.map(l => {
    const hideEls = Array.isArray(l.hideUiElements) ? l.hideUiElements : (Array.isArray(l.hideElements) ? l.hideElements : []);
    const showEls = Array.isArray(l.showUiElements) ? l.showUiElements : (Array.isArray(l.showElements) ? l.showElements : []);
    return {
    speaker: l.speaker || 'center',
    name: l.name || l.speaker_name || '',
    identity: l.identity || '',
    text: l.text || l.dialogue || '',
    bg: l.bg != null ? l.bg : (ndeLines[ndeEditingLineIdx]?.bg ?? null),
    bgm: l.bgm != null ? l.bgm : null,
    sfx: l.sfx != null ? l.sfx : null,
    characters: Array.isArray(l.characters) ? l.characters : [],
    flash: !!l.flash,
    flashDuration: l.flashDuration || 400,
    shake: !!l.shake,
    shakeType: l.shakeType || 'shake-horizontal',
    shakeDuration: l.shakeDuration || 300,
    hideUi: !!l.hideUi,
    hideUiElements: hideEls.filter(x => UI_ELEMENTS.includes(x)),
    showUiElements: showEls.filter(x => UI_ELEMENTS.includes(x))
  };});

  if (lines.length === 0) { ndeAiNotify('ผลลัพธ์ไม่มีบรรทัด', true); return; }

  // Apply to current node
  ndeLines = lines;
  ndeChoices = choices.map(c => ({ text: c.text || '', next: c.next || null }));
  ndeEditingLineIdx = 0;

  ndeRenderLines();
  ndeRenderForm();
  ndeRenderChoices();
  ndeNotify('นำผลลัพธ์ AI มาใช้แล้ว');
  ndeShowTab('line');
}

function ndeAiNotify(msg, isError) {
  const el = document.getElementById('nde-ai-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'nde-ai-status' + (isError ? ' error' : '');
}

// ── Bridge สำหรับ ai-prompt.js (Gemini) ให้กด "นำไปใช้" แล้วอัปเดต Editor จริง ──
window.applyAiToCurrentNode = function (result) {
  if (!result) return;
  let lines = result.lines || [];
  let choices = result.choices || [];
  // รองรับกรณี AI ส่งมาเป็น { dialogues: [...] } หรือ array
  if (Array.isArray(result)) lines = result;
  else if (result.dialogues && Array.isArray(result.dialogues)) {
    const d = result.dialogues[0] || {};
    lines = d.lines || []; choices = d.choices || [];
  }
  lines = lines.map(l => ({
    speaker: l.speaker || 'center',
    name: l.name || '',
    identity: l.identity || '',
    text: l.text || '',
    bg: l.bg != null ? l.bg : (ndeLines[ndeEditingLineIdx]?.bg ?? null),
    bgm: l.bgm != null ? l.bgm : null,
    sfx: l.sfx != null ? l.sfx : null,
    characters: Array.isArray(l.characters) ? l.characters : [],
    flash: !!l.flash,
    flashDuration: l.flashDuration || 400,
    shake: !!l.shake,
    shakeType: l.shakeType || 'shake-horizontal',
    shakeDuration: l.shakeDuration || 300,
    hideUi: !!l.hideUi,
    hideUiElements: Array.isArray(l.hideUiElements) ? l.hideUiElements.filter(x => UI_ELEMENTS.includes(x)) : [],
    showUiElements: Array.isArray(l.showUiElements) ? l.showUiElements.filter(x => UI_ELEMENTS.includes(x)) : []
  }));
  if (!lines.length) { ndeNotify('AI ไม่ได้ส่ง lines มา', true); return; }
  ndeLines = lines;
  ndeChoices = choices.map(c => ({ text: c.text || '', next: c.next ?? null }));
  // ถ้า AI ส่ง title / nextChapter มาด้วย
  if (result.title != null) ndeNodeTitle = result.title;
  if (result.nextChapter !== undefined && ndeNode) ndeNode.nextChapter = result.nextChapter;
  ndeEditingLineIdx = 0;
  ndeRenderLines();
  ndeRenderForm();
  ndeRenderChoices();
  const titleEl = document.getElementById('nde-node-title-input');
  if (titleEl) titleEl.value = ndeNodeTitle;
  ndeNotify('นำผลลัพธ์ AI มาใช้แล้ว — อย่าลืมกด บันทึก');
  ndeShowTab('line');
};

/* ───────────── Notify ───────────── */
function ndeNotify(message, isError) {
  const el = document.getElementById('nde-notification');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}
