/**
 * OpenWorship product screenshot capture — polished edition
 * Captures 7 screens with correct mock data matching the TypeScript types.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = '/tmp/ow-screenshots/captures';
fs.mkdirSync(OUT_DIR, { recursive: true });

const NOW = Date.now();

const MOCK_IDENTITY = {
  church_id: 'grace-community-church',
  church_name: 'Grace Community Church',
  branch_id: 'main-campus',
  branch_name: 'Main Campus',
  role: 'operator',
  invite_code: 'GRACE2026',
};

const MOCK_SONGS = [
  { id: '1', title: 'How Great Is Our God', artist: 'Chris Tomlin', key: 'G', lyrics_slide_count: 6 },
  { id: '2', title: 'What A Beautiful Name', artist: 'Hillsong Worship', key: 'D', lyrics_slide_count: 5 },
  { id: '3', title: 'Oceans (Where Feet May Fail)', artist: 'Hillsong United', key: 'D', lyrics_slide_count: 7 },
  { id: '4', title: 'Good Good Father', artist: 'Chris Tomlin', key: 'C', lyrics_slide_count: 5 },
  { id: '5', title: '10,000 Reasons (Bless the Lord)', artist: 'Matt Redman', key: 'G', lyrics_slide_count: 6 },
  { id: '6', title: 'Amazing Grace (My Chains Are Gone)', artist: 'Chris Tomlin', key: 'F', lyrics_slide_count: 4 },
  { id: '7', title: 'Blessed Be Your Name', artist: 'Matt Redman', key: 'A', lyrics_slide_count: 5 },
  { id: '8', title: 'Build My Life', artist: 'Housefires', key: 'E', lyrics_slide_count: 5 },
];

// ServiceProject matching the TypeScript interface exactly
const MOCK_PROJECTS = [
  {
    id: 'proj-1',
    name: 'Sunday Morning Service – April 27',
    created_at_ms: NOW - 86400000,
    closed_at_ms: null,
    scheduled_at_ms: NOW + 259200000, // 3 days from now
    description: 'Easter Sunday celebration service',
    items: [
      {
        id: 'i1', reference: 'Song', text: 'How Great Is Our God', translation: '',
        position: 0, added_at_ms: NOW - 3600000, item_type: 'song',
        duration_secs: 300, notes: 'Opening worship – Chris Tomlin key of G', asset_ids: []
      },
      {
        id: 'i2', reference: 'Psalm 23:1-6', text: 'The Lord is my shepherd; I shall not want...',
        translation: 'ESV', position: 1, added_at_ms: NOW - 3500000, item_type: 'scripture',
        duration_secs: 120, notes: null, asset_ids: []
      },
      {
        id: 'i3', reference: 'Song', text: 'What A Beautiful Name', translation: '',
        position: 2, added_at_ms: NOW - 3400000, item_type: 'song',
        duration_secs: 280, notes: 'Hillsong – key of D', asset_ids: []
      },
      {
        id: 'i4', reference: 'Sermon', text: "The Shepherd's Voice", translation: '',
        position: 3, added_at_ms: NOW - 3300000, item_type: 'sermon',
        duration_secs: 2400, notes: 'Pastor James – main message', asset_ids: []
      },
      {
        id: 'i5', reference: 'Song', text: 'Oceans (Where Feet May Fail)', translation: '',
        position: 4, added_at_ms: NOW - 3200000, item_type: 'song',
        duration_secs: 320, notes: 'Hillsong United – closing worship', asset_ids: []
      },
    ],
    tasks: [],
  },
  {
    id: 'proj-2',
    name: 'Wednesday Night Worship',
    created_at_ms: NOW - 172800000,
    closed_at_ms: null,
    scheduled_at_ms: NOW + 518400000,
    description: null,
    items: [],
    tasks: [],
  },
];

const MOCK_VERSES = [
  { reference: 'Romans 8:28', text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.', translation: 'ESV' },
  { reference: 'Romans 8:38-39', text: 'For I am convinced that neither death nor life, neither angels nor demons, neither the present nor the future, nor any powers, neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord.', translation: 'ESV' },
  { reference: 'Psalm 23:1', text: 'The Lord is my shepherd; I shall not want.', translation: 'ESV' },
  { reference: 'Psalm 23:4', text: 'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me.', translation: 'ESV' },
];

function buildTauriStub(identity, songs, projects, verses) {
  return `(function() {
    var IDENTITY = ${JSON.stringify(identity)};
    var SONGS = ${JSON.stringify(songs)};
    var PROJECTS = ${JSON.stringify(projects)};
    var VERSES = ${JSON.stringify(verses)};

    window.__TAURI_INTERNALS__ = {
      transformCallback: function() { return 0; },
      invoke: function(cmd, args) {
        if (cmd === 'plugin:event|listen') return Promise.resolve(args && args.handler ? args.handler : 0);
        if (cmd === 'plugin:event|unlisten') return Promise.resolve();
        if (cmd === 'plugin:app|version') return Promise.resolve('1.0.0');
        if (cmd === 'get_identity') return Promise.resolve(IDENTITY);
        if (cmd === 'list_translations') return Promise.resolve([
          { id: 'ESV', name: 'English Standard Version', abbreviation: 'ESV', verse_count: 31102 },
          { id: 'NIV', name: 'New International Version', abbreviation: 'NIV', verse_count: 31103 },
          { id: 'KJV', name: 'King James Version', abbreviation: 'KJV', verse_count: 31100 },
          { id: 'NASB', name: 'New American Standard Bible', abbreviation: 'NASB', verse_count: 31102 },
          { id: 'NLT', name: 'New Living Translation', abbreviation: 'NLT', verse_count: 31103 },
        ]);
        if (cmd === 'get_active_translation') return Promise.resolve('ESV');
        if (cmd === 'get_queue') return Promise.resolve([
          { id: 'q1', confidence: 0.97, song_title: 'How Great Is Our God', artist: 'Chris Tomlin', slide_index: 2, lyrics_preview: 'How great is our God, sing with me' }
        ]);
        if (cmd === 'list_service_projects') return Promise.resolve(PROJECTS);
        if (cmd === 'get_active_project') return Promise.resolve(PROJECTS[0]);
        if (cmd === 'search_content_bank') return Promise.resolve(SONGS);
        if (cmd === 'search_songs') return Promise.resolve(SONGS);
        if (cmd === 'search_scriptures') return Promise.resolve(VERSES);
        if (cmd === 'search_semantic') return Promise.resolve([]);
        if (cmd === 'list_announcements') return Promise.resolve([]);
        if (cmd === 'list_sermon_notes') return Promise.resolve([]);
        if (cmd === 'list_service_summaries') return Promise.resolve([]);
        if (cmd === 'import_songs_ccli') return Promise.resolve([]);
        if (cmd === 'import_songs_openlp') return Promise.resolve([]);
        if (cmd === 'list_preset_backgrounds') return Promise.resolve([]);
        if (cmd === 'list_uploaded_backgrounds') return Promise.resolve([]);
        if (cmd === 'list_stt_providers') return Promise.resolve(['whisper', 'deepgram']);
        if (cmd === 'list_audio_input_devices') return Promise.resolve([
          { id: 'mic-1', name: 'MacBook Pro Microphone' },
          { id: 'mic-2', name: 'USB Audio Interface' }
        ]);
        if (cmd === 'list_recent_artifacts') return Promise.resolve([]);
        if (cmd === 'get_detection_mode') return Promise.resolve('copilot');
        if (cmd === 'get_blackout') return Promise.resolve(false);
        if (cmd === 'get_book_chapters') { var ch = []; for(var i=1;i<=50;i++) ch.push(i); return Promise.resolve(ch); }
        if (cmd === 'get_chapter_verses') { var vs = []; for(var i=1;i<=30;i++) vs.push(i); return Promise.resolve(vs); }
        if (cmd === 'get_semantic_status') return Promise.resolve({ ready: true, verse_count: 31102, enabled: true });
        if (cmd === 'get_audio_settings') return Promise.resolve({ engine: 'whisper', model: 'base.en', deepgram_enabled: false });
        if (cmd === 'get_stt_status') return Promise.resolve({ engine: 'whisper', running: true, model_downloaded: true });
        if (cmd === 'get_display_settings') return Promise.resolve({ font_size: 48, font_family: 'Poppins', text_color: '#FFFFFF', background_color: '#000000' });
        if (cmd === 'get_obs_display_url') return Promise.resolve('http://localhost:7411/display');
        if (cmd === 'get_display_window_open') return Promise.resolve(false);
        if (cmd === 'list_monitors') return Promise.resolve([
          { id: '1', name: 'Built-in Retina Display', width: 2560, height: 1664, is_primary: true },
          { id: '2', name: 'External Monitor', width: 1920, height: 1080, is_primary: false }
        ]);
        if (cmd === 'get_artifacts_settings') return Promise.resolve({ base_path: '/Users/worship/OpenWorship' });
        if (cmd === 'get_email_settings') return Promise.resolve({ auto_send: false, recipient: '' });
        if (cmd === 'get_storage_usage') return Promise.resolve({ used_bytes: 2147483648, total_bytes: 107374182400 });
        if (cmd === 'get_tour_state') return Promise.resolve('not_started');
        if (cmd === 'dismiss_tour') return Promise.resolve();
        if (cmd === 'complete_tour') return Promise.resolve();
        if (cmd === 'get_tutorial_state') return Promise.resolve('not_started');
        return Promise.resolve(null);
      },
      listen: function() { return Promise.resolve(function() {}); },
      unregisterListener: function() {},
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: function() {},
      listeners: {},
    };
  })();`;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function newPage(browser, stub) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (stub) await context.addInitScript(stub);
  return context.newPage();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const stub = buildTauriStub(MOCK_IDENTITY, MOCK_SONGS, MOCK_PROJECTS, MOCK_VERSES);
  const captures = [];

  // ── Screenshot 1: Operator main view — AI Copilot mode ──────────────────
  console.log('📸 1/7 Operator main view (AI Copilot mode)...');
  {
    const page = await newPage(browser, stub);
    await page.goto('http://localhost:1420/');
    await page.waitForSelector('[data-qa="operator-root"]', { timeout: 15000 });
    await sleep(800);
    // Dismiss any welcome modal
    // Dismiss any welcome modal — only click if visible and enabled
    const dismiss = page.locator('button').filter({ hasText: /set up later|dismiss/i });
    const enabledDismiss = dismiss.and(page.locator(':not([disabled])'));
    if (await enabledDismiss.count() > 0) {
      await enabledDismiss.first().click({ timeout: 2000 }).catch(() => {});
      await sleep(300);
    }
    await page.screenshot({ path: path.join(OUT_DIR, '01-operator-copilot-mode.png') });
    captures.push({ file: '01-operator-copilot-mode.png', label: 'Operator main view – AI Copilot mode' });
    await page.context().close();
  }
  console.log('  ✓ Saved');

  // ── Screenshot 2: Song library (Bank) — songs tab with results ─────────
  console.log('📸 2/7 Song library (Bank > Songs)...');
  {
    const page = await newPage(browser, stub);
    await page.goto('http://localhost:1420/');
    await page.waitForSelector('[data-qa="operator-root"]', { timeout: 15000 });
    await sleep(600);
    // Dismiss any welcome modal — only click if visible and enabled
    const dismiss = page.locator('button').filter({ hasText: /set up later|dismiss/i });
    const enabledDismiss = dismiss.and(page.locator(':not([disabled])'));
    if (await enabledDismiss.count() > 0) {
      await enabledDismiss.first().click({ timeout: 2000 }).catch(() => {});
      await sleep(300);
    }
    // Navigate to Bank
    await page.locator('[data-qa="rail-library"]').click();
    await sleep(500);
    // Switch to Songs tab
    await page.locator('button').filter({ hasText: /^Songs$/ }).first().click();
    await sleep(400);
    // Search for songs (use empty string or click search to get default list)
    const songInput = page.locator('input[placeholder*="Search songs"]');
    if (await songInput.count() > 0) {
      await songInput.fill('');
      // Press Enter or trigger the search — try typing one char then deleting
      await songInput.fill('g');
      await sleep(400);
    }
    await page.screenshot({ path: path.join(OUT_DIR, '02-song-library.png') });
    captures.push({ file: '02-song-library.png', label: 'Song library – content bank with populated songs' });
    await page.context().close();
  }
  console.log('  ✓ Saved');

  // ── Screenshot 3: Plan screen (order of service builder) ────────────────
  console.log('📸 3/7 Plan screen (order of service)...');
  {
    const page = await newPage(browser, stub);
    await page.goto('http://localhost:1420/');
    await page.waitForSelector('[data-qa="operator-root"]', { timeout: 15000 });
    await sleep(600);
    // Dismiss any welcome modal — only click if visible and enabled
    const dismiss = page.locator('button').filter({ hasText: /set up later|dismiss/i });
    const enabledDismiss = dismiss.and(page.locator(':not([disabled])'));
    if (await enabledDismiss.count() > 0) {
      await enabledDismiss.first().click({ timeout: 2000 }).catch(() => {});
      await sleep(300);
    }
    await page.locator('[data-qa="rail-plan"]').click();
    await sleep(1000);
    await page.screenshot({ path: path.join(OUT_DIR, '03-order-of-service-plan.png') });
    captures.push({ file: '03-order-of-service-plan.png', label: 'Order of service builder' });
    await page.context().close();
  }
  console.log('  ✓ Saved');

  // ── Screenshot 4: Settings modal (General — church identity) ────────────
  console.log('📸 4/7 Settings modal (General)...');
  {
    const page = await newPage(browser, stub);
    await page.goto('http://localhost:1420/');
    await page.waitForSelector('[data-qa="operator-root"]', { timeout: 15000 });
    await sleep(600);
    // Dismiss any welcome modal — only click if visible and enabled
    const dismiss = page.locator('button').filter({ hasText: /set up later|dismiss/i });
    const enabledDismiss = dismiss.and(page.locator(':not([disabled])'));
    if (await enabledDismiss.count() > 0) {
      await enabledDismiss.first().click({ timeout: 2000 }).catch(() => {});
      await sleep(300);
    }
    await page.locator('button[aria-label="Open settings"]').click();
    await sleep(700);
    await page.waitForSelector('[role="dialog"], [aria-label="Settings"]', { timeout: 5000 }).catch(() => {});
    await sleep(400);
    await page.screenshot({ path: path.join(OUT_DIR, '04-settings-general.png') });
    captures.push({ file: '04-settings-general.png', label: 'Settings – Church identity & configuration' });
    await page.context().close();
  }
  console.log('  ✓ Saved');

  // ── Screenshot 5: Settings modal (Audio / Detection tab) ────────────────
  console.log('📸 5/7 Settings modal (Audio/Detection)...');
  {
    const page = await newPage(browser, stub);
    await page.goto('http://localhost:1420/');
    await page.waitForSelector('[data-qa="operator-root"]', { timeout: 15000 });
    await sleep(600);
    // Dismiss any welcome modal — only click if visible and enabled
    const dismiss = page.locator('button').filter({ hasText: /set up later|dismiss/i });
    const enabledDismiss = dismiss.and(page.locator(':not([disabled])'));
    if (await enabledDismiss.count() > 0) {
      await enabledDismiss.first().click({ timeout: 2000 }).catch(() => {});
      await sleep(300);
    }
    await page.locator('button[aria-label="Open settings"]').click();
    await sleep(700);
    // Click Audio or Detection tab
    const audioTab = page.locator('button, [role="listitem"]').filter({ hasText: /^Audio$/ });
    const detectionTab = page.locator('button, [role="listitem"]').filter({ hasText: /^Detection$/ });
    if (await audioTab.count() > 0) {
      await audioTab.first().click();
      await sleep(400);
    } else if (await detectionTab.count() > 0) {
      await detectionTab.first().click();
      await sleep(400);
    }
    await page.screenshot({ path: path.join(OUT_DIR, '05-settings-audio-detection.png') });
    captures.push({ file: '05-settings-audio-detection.png', label: 'Settings – Audio & AI detection configuration' });
    await page.context().close();
  }
  console.log('  ✓ Saved');

  // ── Screenshot 6: Screen / Display output settings ───────────────────────
  console.log('📸 6/7 Screen / Display settings...');
  {
    const page = await newPage(browser, stub);
    await page.goto('http://localhost:1420/');
    await page.waitForSelector('[data-qa="operator-root"]', { timeout: 15000 });
    await sleep(600);
    // Dismiss any welcome modal — only click if visible and enabled
    const dismiss = page.locator('button').filter({ hasText: /set up later|dismiss/i });
    const enabledDismiss = dismiss.and(page.locator(':not([disabled])'));
    if (await enabledDismiss.count() > 0) {
      await enabledDismiss.first().click({ timeout: 2000 }).catch(() => {});
      await sleep(300);
    }
    await page.locator('[data-qa="rail-display"]').click();
    await sleep(1000);
    await page.screenshot({ path: path.join(OUT_DIR, '06-display-screen-settings.png') });
    captures.push({ file: '06-display-screen-settings.png', label: 'Screen / display output configuration' });
    await page.context().close();
  }
  console.log('  ✓ Saved');

  // ── Screenshot 7: Onboarding / first-run setup ──────────────────────────
  console.log('📸 7/7 Onboarding / setup screen...');
  {
    const noIdentityStub = `(function(){
      window.__TAURI_INTERNALS__ = {
        transformCallback: function(){ return 0; },
        invoke: function(cmd, args){
          if(cmd==='plugin:event|listen') return Promise.resolve(args&&args.handler?args.handler:0);
          if(cmd==='plugin:event|unlisten') return Promise.resolve();
          if(cmd==='plugin:app|version') return Promise.resolve('1.0.0');
          if(cmd==='get_identity') return Promise.resolve(null);
          return Promise.resolve(null);
        },
        listen: function(){ return Promise.resolve(function(){}); },
        unregisterListener: function(){},
      };
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: function(){}, listeners: {} };
    })()`;
    const page = await newPage(browser, noIdentityStub);
    await page.goto('http://localhost:1420/');
    await page.waitForSelector('[data-qa="onboarding-root"]', { timeout: 10000 });
    await sleep(500);
    await page.screenshot({ path: path.join(OUT_DIR, '07-onboarding-setup.png') });
    captures.push({ file: '07-onboarding-setup.png', label: 'First-run setup / church onboarding' });
    await page.context().close();
  }
  console.log('  ✓ Saved');

  await browser.close();

  console.log('\n✅ All screenshots saved to', OUT_DIR);
  console.log('\nCaptures:');
  captures.forEach((c, i) => console.log(` ${i+1}. ${c.file} — ${c.label}`));

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(captures, null, 2));
}

main().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
