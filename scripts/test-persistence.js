#!/usr/bin/env node
// ─── Persistence Test Script ───────────────────────────────────────────────
// ทดสอบว่า asset files และ dialogue data คงอยู่หลัง restart/redeploy
//
// วิธีใช้:
//   node scripts/test-persistence.js              (test ทุกอย่าง)
//   node scripts/test-persistence.js --assets      (test เฉพาะ assets)
//   node scripts/test-persistence.js --dialogues   (test เฉพาะ dialogues)
//   node scripts/test-persistence.js --health      (ตรวจสอบ health endpoints)
//
// ต้องมี server กำลังรันอยู่ (PORT default = 3000)

const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ ${msg}`);
    failed++;
  }
}

async function api(method, urlPath, body, isFormData = false) {
  const opts = { method, headers: {} };
  if (body && !isFormData) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body && isFormData) {
    opts.body = body;
  }
  const res = await fetch(`${BASE}${urlPath}`, opts);
  return res;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Health Endpoints
// ═══════════════════════════════════════════════════════════════════════════
async function testHealth() {
  console.log('\n─── Health Checks ───');

  // /health
  try {
    const res = await api('GET', '/health');
    const data = await res.json();
    assert(res.ok, `/health → ${data.status}`);
  } catch (e) {
    assert(false, `/health → ${e.message}`);
  }

  // /health/db
  try {
    const res = await api('GET', '/health/db');
    const data = await res.json();
    assert(res.ok, `/health/db → ${data.db || data.status}`);
  } catch (e) {
    assert(false, `/health/db → ${e.message}`);
  }

  // /health/disk
  try {
    const res = await api('GET', '/health/disk');
    const data = await res.json();
    assert(data.writable === true, `/health/disk → writable: ${data.writable}`);
    assert(data.dirs?.characters?.exists, '/health/disk → characters dir exists');
    assert(data.dirs?.backgrounds?.exists, '/health/disk → backgrounds dir exists');
    assert(data.dirs?.bgm?.exists, '/health/disk → bgm dir exists');
    assert(data.dirs?.sfx?.exists, '/health/disk → sfx dir exists');
    assert(data.dirs?.covers?.exists, '/health/disk → covers dir exists');
  } catch (e) {
    assert(false, `/health/disk → ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Asset Upload Persistence
// ═══════════════════════════════════════════════════════════════════════════
async function testAssetPersistence() {
  console.log('\n─── Asset Persistence ───');

  // 2.1 Create test asset (upload a small PNG)
  const testPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const fd = new FormData();
  fd.append('file', new Blob([testPng], { type: 'image/png' }), 'persistence_test.png');
  fd.append('asset_type', 'background');
  fd.append('asset_name', 'persistence_test');

  let assetId;
  let fileUrl;
  try {
    const res = await api('POST', '/api/assets', fd, true);
    const data = await res.json();
    assert(res.ok, `POST /api/assets → ${res.status}`);
    assetId = data.asset_id;
    fileUrl = data.file_url;
    assert(!!assetId, `asset_id: ${assetId}`);
    assert(!!fileUrl, `file_url: ${fileUrl}`);
  } catch (e) {
    assert(false, `Upload failed: ${e.message}`);
    return;
  }

  // 2.2 Verify file exists on disk
  const publicRoot = path.join(__dirname, '..', 'public');
  const filePath = path.join(publicRoot, fileUrl);
  assert(fs.existsSync(filePath), `File exists on disk: ${fileUrl}`);

  // 2.3 Verify HTTP URL returns 200
  try {
    const res = await api('GET', fileUrl);
    assert(res.ok, `GET ${fileUrl} → ${res.status}`);
  } catch (e) {
    assert(false, `GET ${fileUrl} → ${e.message}`);
  }

  // 2.4 Verify database record
  try {
    const res = await api('GET', `/api/assets/${assetId}`);
    const data = await res.json();
    assert(res.ok, `GET /api/assets/${assetId} → found`);
    assert(data.file_path === fileUrl, `DB file_path matches: ${data.file_path} === ${fileUrl}`);
  } catch (e) {
    assert(false, `DB check failed: ${e.message}`);
  }

  // 2.5 Verify asset in list
  try {
    const res = await api('GET', '/api/assets');
    const data = await res.json();
    const found = data.find(a => a.asset_id === assetId);
    assert(!!found, `Asset appears in GET /api/assets list`);
  } catch (e) {
    assert(false, `Asset list check failed: ${e.message}`);
  }

  // Cleanup: delete test asset
  try {
    await api('DELETE', `/api/assets/${assetId}`);
    assert(!fs.existsSync(filePath), `File deleted from disk after DELETE`);
  } catch (e) {
    console.warn(`  ⚠️ Cleanup failed: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Dialogue Persistence (TiDB)
// ═══════════════════════════════════════════════════════════════════════════
async function testDialoguePersistence() {
  console.log('\n─── Dialogue Persistence (TiDB) ───');

  // Use a test chapter ID that won't conflict with real data
  const testChapterId = 999999;

  // 3.1 Write dialogue
  const testData = {
    chapter_id: testChapterId,
    story_id: 1,
    title: 'Persistence Test Chapter',
    next_id: 5,
    assets_preload: [],
    dialogues: [
      { dialogue_id: 1, text: 'Test line 1', sort_order: 0 },
      { dialogue_id: 2, text: 'Test line 2', sort_order: 1 }
    ]
  };

  try {
    const { writeChapter, readChapter, deleteChapterFile } = require('../dialogue-store');
    await writeChapter(testChapterId, testData);
    assert(true, `writeChapter(${testChapterId}) → success`);
  } catch (e) {
    assert(false, `writeChapter failed: ${e.message}`);
    return;
  }

  // 3.2 Read dialogue back
  try {
    const { readChapter } = require('../dialogue-store');
    const data = await readChapter(testChapterId);
    assert(data.dialogues.length === 2, `readChapter → ${data.dialogues.length} dialogues`);
    assert(data.title === 'Persistence Test Chapter', `readChapter → title matches`);
    assert(data.next_id === 5, `readChapter → next_id matches`);
  } catch (e) {
    assert(false, `readChapter failed: ${e.message}`);
  }

  // 3.3 Update dialogue
  try {
    const { readChapter, writeChapter } = require('../dialogue-store');
    const data = await readChapter(testChapterId);
    data.dialogues.push({ dialogue_id: 3, text: 'Test line 3 (added)', sort_order: 2 });
    data.next_id = 6;
    await writeChapter(testChapterId, data);

    const updated = await readChapter(testChapterId);
    assert(updated.dialogues.length === 3, `Write+Read update → ${updated.dialogues.length} dialogues`);
    assert(updated.next_id === 6, `Write+Read update → next_id updated`);
  } catch (e) {
    assert(false, `Update failed: ${e.message}`);
  }

  // 3.4 Delete dialogue
  try {
    const { deleteChapterFile, readChapter } = require('../dialogue-store');
    await deleteChapterFile(testChapterId);
    const data = await readChapter(testChapterId);
    assert(data.dialogues.length === 0, `deleteChapterFile → dialogues cleared`);
    assert(true, `deleteChapterFile → success`);
  } catch (e) {
    assert(false, `Delete failed: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Filename Safety
// ═══════════════════════════════════════════════════════════════════════════
async function testFilenameSafety() {
  console.log('\n─── Filename Safety ───');

  // Upload with special characters in name
  const testPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const fd = new FormData();
  fd.append('file', new Blob([testPng], { type: 'image/png' }), 'test file (special) [chars].png');
  fd.append('asset_type', 'background');
  fd.append('asset_name', 'Test Special Chars');

  let fileUrl;
  let assetId;
  try {
    const res = await api('POST', '/api/assets', fd, true);
    const data = await res.json();
    assetId = data.asset_id;
    fileUrl = data.file_url;
    assert(res.ok, `Upload with special chars → ${res.status}`);
    assert(!!fileUrl, `file_url: ${fileUrl}`);
  } catch (e) {
    assert(false, `Special char upload failed: ${e.message}`);
    return;
  }

  // Verify HTTP URL works (case-sensitive check)
  try {
    const res = await api('GET', fileUrl);
    assert(res.ok, `GET special-char file → ${res.status}`);
  } catch (e) {
    assert(false, `GET special-char file → ${e.message}`);
  }

  // Cleanup
  if (assetId) await api('DELETE', `/api/assets/${assetId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  VisualNovelStudio — Persistence Test');
  console.log(`  Target: ${BASE}`);
  console.log('═══════════════════════════════════════════════════════');

  const args = process.argv.slice(2);
  const onlyHealth = args.includes('--health');
  const onlyAssets = args.includes('--assets');
  const onlyDialogues = args.includes('--dialogues');

  try {
    if (onlyHealth || args.length === 0) await testHealth();
    if (onlyAssets || args.length === 0) await testAssetPersistence();
    if (onlyDialogues || args.length === 0) await testDialoguePersistence();
    if (!onlyHealth && !onlyAssets && !onlyDialogues) await testFilenameSafety();
  } catch (e) {
    console.error('\n❌ Unexpected error:', e);
    failed++;
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

main();
