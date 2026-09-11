// ai-prompt.js — gemini-3.6-flash | ประหยัด Token + JSON 100% (RAM-only)
(function () {
  const MODEL = 'gemini-3.6-flash';
  let lastResult = null;
  let apiKeyRAM = '';

  // Schema บังคับ JSON — ฝังใน code อัตโนมัติ ไม่ต้องให้ผู้ใช้พิมพ์
  const SCHEMA_BLOCK = `Output ONLY valid JSON matching this EXACT schema (single node):
{"dialogue_id":number,"sort_order":number,"title":string,"pos_x":number,"pos_y":number,"lines":[{"speaker":"center|left|right","name":string,"identity":string,"text":string,"bg":number|null,"bgm":number|null,"sfx":number|null,"characters":[{"asset_id":number,"position":"left|center|right","highlight":boolean}],"flash":boolean,"flashDuration":number,"shake":boolean,"shakeType":"shake-horizontal|shake-vertical|shake-heavy","shakeDuration":number}],"nextChapter":number|null,"choices":[{"text":string,"next":number|null}]}
Rules: pos_x/pos_y=0, title="", bg/bgm/sfx=asset_id or null. No Markdown, no extra keys.`;

  function $(id) { return document.getElementById(id); }

  function getAssetCatalog() {
    // allAssets มาจาก dashboard.js (GET /api/assets?mine=1) — มี asset_id + asset_name
    const list = (typeof allAssets !== 'undefined' && Array.isArray(allAssets)) ? allAssets : [];
    if (!list.length) return '';
    const byType = { character: [], background: [], bgm: [], sfx: [] };
    list.forEach(a => { if (byType[a.asset_type]) byType[a.asset_type].push(a); });
    let out = 'Available assets — ใช้ asset_id ตามชื่อนี้เท่านั้น (ถ้าไม่มีให้ใส่ null):\n';
    for (const t of ['character','background','bgm','sfx']) {
      if (byType[t].length) {
        out += `- ${t}: ` + byType[t].map(a => `${a.asset_name} (id:${a.asset_id})`).join(', ') + '\n';
      }
    }
    return out.trim();
  }

  // ── Real-time Sync: เอา JSON ที่ AI เจนไปอัปเดตผัง Node บน Canvas ทันที ──
  function syncToGraph(aiResult) {
    // รองรับ 2 รูปแบบ: Node เดียว หรือ { dialogues: [Node, Node...] }
    let nodesToAdd = [];
    if (Array.isArray(aiResult)) nodesToAdd = aiResult;
    else if (aiResult.dialogues && Array.isArray(aiResult.dialogues)) nodesToAdd = aiResult.dialogues;
    else if (aiResult.lines) nodesToAdd = [aiResult]; // single node
    else return false;

    const chId = (typeof currentChapterId !== 'undefined' && currentChapterId) ? currentChapterId : null;
    if (!chId || typeof chapterNodesCache === 'undefined') return false;

    const existing = chapterNodesCache[chId] || [];
    // ถ้าได้ node เดียวและกำลังเปิด Node Editor อยู่ -> อัปเดต node นั้น (real-time)
    if (nodesToAdd.length === 1 && typeof ndeNode !== 'undefined' && ndeNode) {
      return false; // ให้ applyAiToCurrentNode จัดการ
    }

    // เพิ่มเป็น Node ใหม่บนกราฟ
    nodesToAdd.forEach((n, idx) => {
      const id = (n.dialogue_id != null) ? Number(n.dialogue_id) : (typeof nextNodeId !== 'undefined' ? nextNodeId++ : Date.now() + idx);
      if (typeof nextNodeId !== 'undefined' && id >= nextNodeId) nextNodeId = id + 1;
      const node = {
        dialogue_id: id,
        sort_order: existing.length,
        title: n.title || '',
        pos_x: n.pos_x ?? (40 + (existing.length % 4) * 320),
        pos_y: n.pos_y ?? (40 + Math.floor(existing.length / 4) * 250),
        lines: (n.lines || []).map(l => ({
          speaker: l.speaker || 'center', name: l.name || '', identity: l.identity || '', text: l.text || '',
          bg: l.bg ?? null, bgm: l.bgm ?? null, sfx: l.sfx ?? null,
          characters: Array.isArray(l.characters) ? l.characters : [],
          flash: !!l.flash, flashDuration: l.flashDuration || 400,
          shake: !!l.shake, shakeType: l.shakeType || 'shake-horizontal', shakeDuration: l.shakeDuration || 300
        })),
        nextChapter: n.nextChapter ?? null,
        choices: (n.choices || []).map(c => ({ text: c.text || '', next: c.next ?? null }))
      };
      existing.push(node);
    });
    chapterNodesCache[chId] = existing;
    if (typeof RenderEngine !== 'undefined' && RenderEngine.renderGraph) RenderEngine.renderGraph();
    if (typeof DataBridge !== 'undefined' && DataBridge.scheduleSave) DataBridge.scheduleSave();
    return true;
  }

  // ── Clean + Safe Parse (กัน Unterminated string / โดนตัด / markdown) ──
  function cleanJsonText(raw) {
    let s = String(raw || '').trim();
    // ตัด ```json ... ``` ถ้ามี
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    // ดึงช่วง JSON หลัก { ... } ถ้ามีข้อความเกิน
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
    // ลบ trailing comma ก่อน } ]
    s = s.replace(/,\s*([}\]])/g, '$1');
    return s;
  }

  function safeParseJson(raw) {
    const cleaned = cleanJsonText(raw);
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Unterminated string มักเกิดจาก maxOutputTokens ตัดกลางคำ — ลองซ่อมแบบเบาๆ
      if (/Unterminated string/i.test(e.message)) {
        // ปิด string ที่ค้าง + ปิดวงเล็บที่ขาด
        let fixed = cleaned;
        // ถ้าจบไม่ครบ ให้ปิด " แล้วเติม } ] ให้ครบ
        if ((fixed.match(/"/g) || []).length % 2 === 1) fixed += '"';
        // เติม } ] ให้ balance
        const openBraces = (fixed.match(/{/g) || []).length - (fixed.match(/}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length - (fixed.match(/]/g) || []).length;
        fixed += ']}'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
        // ลองอีกครั้งแบบไม่ strict
        try { return JSON.parse(fixed.replace(/,\s*([}\]])/g, '$1')); } catch (_) {}
      }
      // โยน error เดิมพร้อม hint
      const hint = /Unterminated string/i.test(e.message)
        ? ' (JSON ถูกตัดกลางข้อความ — ลองเพิ่ม maxOutputTokens หรือลดความยาว prompt)'
        : '';
      throw new Error(e.message + hint);
    }
  }

  async function generateVNSceneWithGemini36(apiKey, userPrompt, systemPromptOverride) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    // ฝัง schema + แคตตาล็อก Asset อัตโนมัติ — ผู้ใช้พิมพ์แค่ Role สั้นๆ ก็พอ
    const catalog = getAssetCatalog();
    const userSys = (systemPromptOverride || '').trim();
    const baseSys = catalog ? `${catalog}\n\n${SCHEMA_BLOCK}` : SCHEMA_BLOCK;
    const systemPrompt = userSys ? `${userSys}\n\n${baseSys}` : baseSys;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 4096
        }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Gemini API Error ${res.status}`);
    // เช็ค finishReason ว่าโดนตัดเพราะ MAX_TOKENS หรือไม่
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      console.warn('[Gemini] โดนตัดเพราะ MAX_TOKENS — เพิ่ม maxOutputTokens แล้ว ลองใหม่');
    }
    const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJsonText) throw new Error('ไม่มีผลลัพธ์จาก Gemini');
    if (data.usageMetadata) {
      console.log(`[Token] in:${data.usageMetadata.promptTokenCount} out:${data.usageMetadata.candidatesTokenCount} total:${data.usageMetadata.totalTokenCount}`);
      const s = $('nde-ai-status');
      if (s) s.textContent += ` | Token in:${data.usageMetadata.promptTokenCount} out:${data.usageMetadata.candidatesTokenCount}`;
    }
    return safeParseJson(rawJsonText);
  }

  function init() {
    // รองรับทั้ง id ใหม่ (nde-ai-key) และ id เก่า (nde-ai-api-key)
    const keyEl = $('nde-ai-key') || $('nde-ai-api-key');
    const sysEl = $('nde-ai-system') || $('nde-ai-system-prompt');
    const userEl = $('nde-ai-user') || $('nde-ai-user-prompt');
    const genBtn = $('nde-ai-gen-btn') || $('nde-ai-generate-btn');
    const applyBtn = $('nde-ai-apply-btn');
    const statusEl = $('nde-ai-status');
    const outEl = $('nde-ai-output') || $('nde-ai-result-json');
    const resultBox = $('nde-ai-result');
    if (!genBtn || !sysEl || !userEl) return;
    if (sysEl && !sysEl.value.trim()) sysEl.value = 'คุณเป็นนักเขียนบท Visual Novel ที่เชี่ยวชาญ';

    keyEl?.addEventListener('input', () => { apiKeyRAM = keyEl.value.trim(); });
    // sync จาก sessionStorage ของระบบเก่า (ถ้ามี)
    const savedOld = sessionStorage.getItem('nde_groq_key');
    if (savedOld && keyEl && !keyEl.value) { keyEl.value = savedOld; apiKeyRAM = savedOld; }

    genBtn.addEventListener('click', async () => {
      const apiKey = (keyEl?.value || apiKeyRAM || '').trim();
      const systemPrompt = sysEl.value.trim();
      const userPrompt = userEl.value.trim();
      if (!apiKey) { statusEl.textContent = 'กรุณาใส่ API Key'; return; }
      if (!userPrompt) { statusEl.textContent = 'กรุณาใส่ User Prompt'; return; }
      apiKeyRAM = apiKey;
      genBtn.disabled = true;
      genBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> กำลังสร้าง...';
      statusEl.textContent = `กำลังเรียก ${MODEL}...`;
      if (outEl) outEl.style.display = 'none';
      if (resultBox) resultBox.classList.add('hidden');
      applyBtn.disabled = true;
      lastResult = null;
      try {
        const result = await generateVNSceneWithGemini36(apiKey, userPrompt, systemPrompt);
        lastResult = result;
        const pretty = JSON.stringify(result, null, 2);
        if (outEl) { outEl.textContent = pretty; outEl.style.display = 'block'; }
        if (resultBox) { resultBox.classList.remove('hidden'); const j = $('nde-ai-result-json'); if (j) j.textContent = pretty; }
        statusEl.textContent = 'สร้างสำเร็จ — กด "นำไปใช้กับ Node"';
        applyBtn.dataset.result = JSON.stringify(result);
        applyBtn.disabled = false;
      } catch (e) {
        const msg = e.message.includes('Unterminated string')
          ? e.message + ' — ลองลด User Prompt ให้สั้นลงหรือกดสร้างใหม่'
          : e.message;
        statusEl.textContent = 'ผิดพลาด: ' + msg;
        console.error('[AI Parse Error]', e);
      } finally {
        genBtn.disabled = false;
        genBtn.innerHTML = '<i class="bi bi-stars"></i> สร้างด้วย Gemini';
      }
    });

    applyBtn.addEventListener('click', () => {
      if (!lastResult) return;
      window._aiLastResult = lastResult;
      // ถ้า AI ส่งมาหลาย Node -> Sync ลงกราฟทันที
      if (syncToGraph(lastResult)) {
        statusEl.textContent = 'ซิงค์ลง Canvas แล้ว — Node/Edges วาดใหม่ทันที (auto-save)';
        // กลับไปดูกราฟ
        if (typeof showSection === 'function') showSection('editor');
        return;
      }
      // Node เดียว -> อัปเดต Node ที่เปิดอยู่ (Real-time)
      if (typeof window.applyAiToCurrentNode === 'function') {
        window.applyAiToCurrentNode(lastResult);
        // auto-save ให้กราฟเห็นผลทันทีเมื่อกลับ
        if (typeof saveNodeContent === 'function') saveNodeContent();
        if (typeof RenderEngine !== 'undefined' && RenderEngine.renderGraph) RenderEngine.renderGraph();
        if (typeof DataBridge !== 'undefined' && DataBridge.scheduleSave) DataBridge.scheduleSave();
      } else {
        const lines = lastResult.lines || [];
        const nameEl = $('nde-speaker-input');
        const textEl = $('nde-dialogue-input');
        if (lines[0] && nameEl && textEl) {
          nameEl.value = lines[0].name || '';
          textEl.value = lines[0].text || '';
        }
        statusEl.textContent = 'นำไปใช้แล้ว (ตัวอย่างบรรทัดแรก) — ตรวจก่อนบันทึก';
      }
      document.querySelector('.nde-main-tabs .tab-btn[data-tab="line"]')?.click();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  window.generateVNSceneWithGemini36 = generateVNSceneWithGemini36;
})();
