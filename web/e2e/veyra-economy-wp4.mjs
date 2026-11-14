// WP4 Browser Visual E2E across 1280x720 and 640x360 against the real production HTTP build (no QA mode).
// Phase A: pure zero-fixture new run on veyra05-world (Title -> D1 Profile -> New Run -> Movement -> Journey D1 ->
//          BuildBar -> Survivor/Craft D2 -> Map -> Esc Save & Quit -> localStorage audit -> Reload -> Continue).
// Phase B: disclosed WP3 non-QA natural-run snapshots generated on the same commit by wp3-veyra-recycler-integration.test.ts
//          (po_slag Foundry Recycler UI + L2 Workbench & base_generator + Vehicle Frame + Floor -1 cold reload + F0 return).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const url = process.env.GAME_URL || 'http://127.0.0.1:4173/';
const sha = process.env.BUILD_SHA || 'unknown';
const snapDir = process.env.WP3_SNAP_DIR || '/tmp/wp3-snaps';
const outRoot = 'evidence/veyra-economy-wp4';
await mkdir(outRoot, { recursive: true });

const snapRecycler = await readFile(resolve(snapDir, 'po-slag-recycler.json'), 'utf8');
const snapBench = await readFile(resolve(snapDir, 'base-and-bench.json'), 'utf8');
const snapB1 = await readFile(resolve(snapDir, 'floor-minus1.json'), 'utf8');

async function closeReturnIfVisible(page) {
  for (const name of ['Enter the Island', 'Continue']) {
    const btn = page.getByRole('button', { name, exact: true });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(300);
    }
  }
}

async function assertCanvasAndViewport(page, label, viewport) {
  const check = await page.evaluate(({ vw, vh }) => {
    const c = document.querySelector('canvas.px');
    if (!c) return { ok: false, reason: 'missing canvas.px' };
    const ctx = c.getContext('2d');
    if (!ctx) return { ok: false, reason: 'missing 2d context' };
    const mid = ctx.getImageData(Math.floor(c.width / 2) - 8, Math.floor(c.height / 2) - 8, 16, 16).data;
    let nonBlack = 0;
    for (let i = 0; i < mid.length; i += 4) if (mid[i] > 2 || mid[i + 1] > 2 || mid[i + 2] > 2) nonBlack++;
    const boxes = [];
    for (const sel of ['.panel', '.ledger', '.buildbar', '.sv', '.return-digest', '.waymark']) {
      for (const el of document.querySelectorAll(sel)) {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < -4 || r.top < -4 || r.right > vw + 4 || r.bottom > vh + 4) {
          boxes.push({ sel, left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), vw, vh });
        }
      }
    }
    const overlaps = [];
    const rightCol = document.querySelector('.hud-col--right');
    if (rightCol) {
      const children = Array.from(rightCol.children).map((el) => ({ cls: el.className, r: el.getBoundingClientRect() })).filter((x) => x.r.width > 0 && x.r.height > 0);
      for (let i = 0; i < children.length; i++) {
        for (let j = i + 1; j < children.length; j++) {
          const a = children[i].r, b = children[j].r;
          const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ix > 2 && iy > 2) overlaps.push({ a: children[i].cls, b: children[j].cls, ix: Math.round(ix), iy: Math.round(iy) });
        }
      }
    }
    const blankTiles = [];
    for (const tile of document.querySelectorAll('.sv-tile')) {
      const img = tile.querySelector('img.px');
      if (!img || !img.complete || img.naturalWidth === 0) blankTiles.push(tile.getAttribute('data-recipe') || 'unknown');
    }
    return { ok: nonBlack > 0 && boxes.length === 0 && overlaps.length === 0 && blankTiles.length === 0, nonBlack, overflow: boxes, overlaps, blankTiles, width: c.width, height: c.height };
  }, { vw: viewport[0], vh: viewport[1] });
  assert.equal(check.ok, true, `${label} UI/canvas check failed: ${JSON.stringify(check)}`);
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const records = [];
let failed = false;

try {
  for (const [w, h] of [[1280, 720], [640, 360]]) {
    const tag = `${w}x${h}`;
    const rec = {
      sha,
      viewport: [w, h],
      phaseA_steps: [],
      phaseB_steps: [],
      shots: [],
      errors: [],
      auDelta: null,
      saveAudit: null,
      verdict: 'RUNNING',
    };

    const hookErrors = (page) => {
      page.on('pageerror', (e) => rec.errors.push(`pageerror: ${e.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') rec.errors.push(`console: ${msg.text()}`);
      });
    };

    const takeShot = async (page, phase, name) => {
      const filename = `${tag}-${name}.png`;
      const bytes = await page.screenshot({ path: `${outRoot}/${filename}`, animations: 'disabled' });
      rec.shots.push({ phase, name: filename, sha256: createHash('sha256').update(bytes).digest('hex') });
    };

    const runStepPage = async (setupInit, fn) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      if (setupInit) await ctx.addInitScript(setupInit.fn, setupInit.arg);
      const page = await ctx.newPage();
      hookErrors(page);
      try {
        await fn(page);
      } catch (err) {
        try { await takeShot(page, 'ERR', '99-failure'); } catch {}
        throw err;
      } finally {
        await ctx.close();
      }
    };

    records.push(rec);
    try {
      await runStepPage(null, async (page) => {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        assert.equal(resp?.status(), 200, 'HTTP 200 required');
        await page.getByRole('button', { name: 'New run', exact: true }).waitFor({ timeout: 30000 });
        await page.waitForTimeout(500);
        await takeShot(page, 'A', '01-title');
        rec.phaseA_steps.push('TITLE_VISIBLE');

        // D1 Profile & History check (zero phantom cash on fresh profile)
        await page.getByRole('button', { name: 'Profile & history', exact: true }).click();
        await page.getByText('Secured Ragnarok cash:').waitFor({ timeout: 10000 });
        const profText = await page.locator('.panel').innerText();
        assert.match(profText, /Secured Ragnarok cash:\s*0/);
        await takeShot(page, 'A', '02-profile-escrow');
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        rec.phaseA_steps.push('D1_PROFILE_CASH_ZERO');

        // Select VEYRA · Unified World + Greywater South Shore + launch run
        await page.getByRole('button', { name: 'New run', exact: true }).click();
        await page.getByText('Choose your Adventurer').waitFor({ timeout: 10000 });
        await page.getByRole('button', { name: 'VEYRA · Unified World', exact: true }).click();
        await page.getByRole('button', { name: 'Greywater South Shore', exact: true }).click();
        await page.waitForTimeout(250);
        await takeShot(page, 'A', '03-character-select');
        await page.getByRole('button', { name: 'Begin the 14 days', exact: true }).click();

        const auLocator = page.locator('.chip').filter({ hasText: /^AU .* · F0$/ }).first();
        await auLocator.waitFor({ timeout: 25000 });
        await page.waitForTimeout(1000);
        await assertCanvasAndViewport(page, `${tag}:spawn`, [w, h]);
        const auBefore = (await auLocator.innerText()).trim();
        await takeShot(page, 'A', '04-veyra-spawn');
        rec.phaseA_steps.push('VEYRA_SPAWN_F0');

        // Real WASD walking + attack swing
        await page.keyboard.down('KeyD'); await page.waitForTimeout(900); await page.keyboard.up('KeyD');
        await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
        await page.keyboard.press('Space');
        await page.waitForTimeout(400);
        await assertCanvasAndViewport(page, `${tag}:move`, [w, h]);
        const auAfter = (await auLocator.innerText()).trim();
        rec.auDelta = { before: auBefore, after: auAfter };
        await takeShot(page, 'A', '05-veyra-move');
        rec.phaseA_steps.push('REAL_WASD_INPUT');

        // D1 Journey Ledger check (Wayfarer Marks only, no rcash minting)
        await page.keyboard.press('KeyJ');
        const ledger = page.getByRole('dialog', { name: 'Journey ledger' });
        await ledger.waitFor({ timeout: 10000 });
        await ledger.getByRole('button', { name: /Waypoints/ }).click();
        await page.waitForTimeout(250);
        const ledgerText = await ledger.innerText();
        assert.match(ledgerText, /Wayfarer Marks/);
        assert.doesNotMatch(ledgerText, /Ragnarok cash/i);
        await assertCanvasAndViewport(page, `${tag}:journey`, [w, h]);
        await takeShot(page, 'A', '06-journey-waypoints');
        await page.getByRole('button', { name: 'Back to the island', exact: true }).click();
        rec.phaseA_steps.push('D1_JOURNEY_VERIFIED');

        // D2 BuildBar [B]
        await page.keyboard.press('KeyB');
        await page.locator('.buildbar').waitFor({ timeout: 10000 });
        await page.waitForTimeout(200);
        await assertCanvasAndViewport(page, `${tag}:buildbar`, [w, h]);
        await takeShot(page, 'A', '07-buildbar');
        await page.keyboard.press('KeyB');
        rec.phaseA_steps.push('BUILDBAR_RENDERED');

        // D2 Survivor Screen [I] + Bear Trap & Work view
        await page.keyboard.press('KeyI');
        const sv = page.locator('.sv');
        await sv.waitFor({ timeout: 10000 });
        const workToggle = page.locator('.sv-compact-nav button').filter({ hasText: 'WORK' });
        if (await workToggle.isVisible().catch(() => false)) {
          await workToggle.click();
          await page.waitForTimeout(150);
        }
        await sv.locator('.sv-cat', { hasText: 'Devices' }).click();
        await page.locator('.sv-tile[data-recipe="S:bear_trap"]').waitFor({ timeout: 5000 });
        await page.locator('.sv-tile[data-recipe="S:base_generator"]').waitFor({ timeout: 5000 });
        await page.locator('.sv-tile[data-recipe="S:bear_trap"]').click();
        await page.waitForTimeout(200);
        await assertCanvasAndViewport(page, `${tag}:survivor`, [w, h]);
        await takeShot(page, 'A', '08-survivor-craft');
        await page.keyboard.press('Escape');
        rec.phaseA_steps.push('D2_SURVIVOR_CRAFT_VERIFIED');

        // Map Panel [M]
        await page.keyboard.press('KeyM');
        await page.locator('canvas[aria-label^="Explored island map"]').waitFor({ timeout: 10000 });
        await page.waitForTimeout(300);
        await assertCanvasAndViewport(page, `${tag}:map`, [w, h]);
        await takeShot(page, 'A', '09-map-panel');
        await page.keyboard.press('Escape');
        rec.phaseA_steps.push('MAP_PANEL_RENDERED');

        // Escape Menu -> Save & Quit -> localStorage audit -> Reload -> Continue
        await page.keyboard.press('Escape');
        const quitBtn = page.getByRole('button', { name: 'Save & quit to title', exact: true });
        await quitBtn.waitFor({ timeout: 10000 });
        await assertCanvasAndViewport(page, `${tag}:menu`, [w, h]);
        await takeShot(page, 'A', '10-esc-menu');
        await quitBtn.click();
        await page.getByRole('button', { name: /^Continue —/ }).waitFor({ timeout: 15000 });

        const saveAudit = await page.evaluate(() => {
          const raw = localStorage.getItem('soh.state.v3');
          if (!raw) return null;
          const env = JSON.parse(raw);
          const gs = JSON.parse(env.payload);
          return {
            layoutId: gs.run?.layoutId,
            wreckEconomy: gs.run?.wreckEconomy,
            qaUsed: gs.run?.qaUsed,
            securedCash: gs.profile?.securedCash,
            badReceipts: (gs.run?.receipts || []).filter((x) => x.kind.startsWith('qa') || x.kind === 'inspect' || x.kind === 'addItem').length,
          };
        });
        assert.ok(saveAudit, 'soh.state.v3 missing after Save & Quit');
        assert.equal(saveAudit.layoutId, 'veyra05-world');
        assert.equal(saveAudit.wreckEconomy, 'recycler-v1');
        assert.equal(saveAudit.qaUsed, false);
        assert.equal(saveAudit.securedCash, 0);
        assert.equal(saveAudit.badReceipts, 0);
        rec.saveAudit = saveAudit;

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /^Continue —/ }).waitFor({ timeout: 20000 });
        await page.getByRole('button', { name: /^Continue —/ }).click();
        await closeReturnIfVisible(page);
        await auLocator.waitFor({ timeout: 20000 });
        await page.waitForTimeout(800);
        await assertCanvasAndViewport(page, `${tag}:reload`, [w, h]);
        await takeShot(page, 'A', '11-reload-continue');
        rec.phaseA_steps.push('SAVE_RELOAD_CONTINUE_VERIFIED');
      });

      // ==================== PHASE B: Disclosed Live-Commit WP3 Natural-Loop Continuation ====================
      // B1: po_slag Foundry Recycler UI + live X:drive recycle start
      await runStepPage({ fn: (s) => { if (!localStorage.getItem('soh.state.v3')) localStorage.setItem('soh.state.v3', s); }, arg: snapRecycler }, async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.getByRole('button', { name: /^Continue —/ }).click();
        await closeReturnIfVisible(page);
        await page.locator('.chip').filter({ hasText: /^AU .* · F0$/ }).first().waitFor({ timeout: 20000 });
        await page.waitForTimeout(500);
        await page.keyboard.press('KeyE');
        const sel = page.getByLabel('Recycler item');
        await sel.waitFor({ timeout: 10000 });
        await page.getByText('Foundry Recycler').first().waitFor({ timeout: 5000 });
        const driveVal = await sel.evaluate((el) => {
          const opt = Array.from(el.options).find((o) => o.textContent?.includes('Damaged Drive') && o.textContent?.includes('eligible'));
          return opt ? opt.value : '';
        });
        assert.ok(driveVal, 'Natural Damaged Drive missing from Foundry Recycler select');
        await sel.selectOption(driveVal);
        await page.getByRole('button', { name: 'Recycle item…', exact: true }).click();
        await page.getByText(/Returns:\s*2 Parts/).waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: 'Confirm recycle', exact: true }).click();
        await page.getByText(/Processing · \d+s/).waitFor({ timeout: 5000 });
        await assertCanvasAndViewport(page, `${tag}:recycler`, [w, h]);
        await takeShot(page, 'B', '12-foundry-recycler-ui');
        rec.phaseB_steps.push('PO_SLAG_RECYCLER_XDRIVE_UI');
      });

      // B2: Constructed furnace / L2 workbench / base_generator outside po_slag + Vehicle Frame
      await runStepPage({ fn: (s) => { if (!localStorage.getItem('soh.state.v3')) localStorage.setItem('soh.state.v3', s); }, arg: snapBench }, async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.getByRole('button', { name: /^Continue —/ }).click();
        await closeReturnIfVisible(page);
        await page.locator('.chip').filter({ hasText: /^AU .* · F0$/ }).first().waitFor({ timeout: 20000 });
        await page.waitForTimeout(500);
        await assertCanvasAndViewport(page, `${tag}:base-outside`, [w, h]);
        await takeShot(page, 'B', '13-built-base-outside');

        await page.keyboard.press('KeyE');
        const consolePanel = page.locator('.station-console--workbench');
        await consolePanel.waitFor({ timeout: 10000 });
        await consolePanel.getByText('LV 2', { exact: true }).waitFor({ timeout: 5000 });
        const frameRow = consolePanel.locator('.recipe-row').filter({ hasText: 'Utility Frame' }).first();
        await frameRow.waitFor({ timeout: 5000 });
        await frameRow.click();
        await page.waitForTimeout(200);
        await assertCanvasAndViewport(page, `${tag}:workbench-l2`, [w, h]);
        await takeShot(page, 'B', '14-workbench-l2-ui');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);

        await page.keyboard.press('KeyI');
        await page.locator('.sv').waitFor({ timeout: 10000 });
        const frameSlot = page.locator('.sv .dslot[title*="Utility Frame"]').first();
        await frameSlot.waitFor({ timeout: 5000 });
        await frameSlot.click();
        await page.waitForTimeout(150);
        await assertCanvasAndViewport(page, `${tag}:vehicle-frame-inv`, [w, h]);
        await takeShot(page, 'B', '15-inventory-vehicle-frame');
        rec.phaseB_steps.push('BUILT_GEN_WORKBENCH_L2_VEHICLE_FRAME_UI');
      });

      // B3: Cold reload on Floor -1 (Quench Underpass) & stair return to Floor 0
      await runStepPage({ fn: (s) => { if (!localStorage.getItem('soh.state.v3')) localStorage.setItem('soh.state.v3', s); }, arg: snapB1 }, async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.getByRole('button', { name: /^Continue —/ }).click();
        await closeReturnIfVisible(page);
        await page.locator('.chip').filter({ hasText: /^AU .* · F-1/ }).first().waitFor({ timeout: 20000 });
        await page.waitForTimeout(600);
        await assertCanvasAndViewport(page, `${tag}:floor-minus1`, [w, h]);
        await takeShot(page, 'B', '16-floor-minus1');

        await page.keyboard.press('KeyE');
        await page.locator('.chip').filter({ hasText: /^AU .* · F0$/ }).first().waitFor({ timeout: 10000 });
        await page.waitForTimeout(500);
        await assertCanvasAndViewport(page, `${tag}:floor-return-0`, [w, h]);
        await takeShot(page, 'B', '17-floor-return-0');
        rec.phaseB_steps.push('FLOOR_MINUS1_RELOAD_AND_RETURN_VERIFIED');
      });

      rec.verdict = rec.errors.length === 0 ? 'PASS' : 'FAIL_CONSOLE';
      if (rec.verdict !== 'PASS') failed = true;
    } catch (err) {
      failed = true;
      rec.verdict = 'FAIL_EXCEPTION';
      rec.failure = String(err);
    }
  }
} finally {
  await browser.close();
}

await writeFile(
  `${outRoot}/manifest.json`,
  JSON.stringify(
    {
      sha,
      url,
      phaseA_scope: 'PURE_ZERO_FIXTURE_FRESH_BROWSER_RUN',
      phaseB_scope: 'DISCLOSED_SAME_COMMIT_WP3_NATURAL_LOOP_SNAPSHOTS',
      results: records,
    },
    null,
    2,
  ),
);

console.log(JSON.stringify(records.map((r) => ({ viewport: r.viewport, verdict: r.verdict, phaseA_steps: r.phaseA_steps, phaseB_steps: r.phaseB_steps, errors: r.errors, failure: r.failure })), null, 2));
if (failed || records.some((r) => r.verdict !== 'PASS')) process.exit(1);
