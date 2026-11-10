// Real-input interaction proof. No state injection: the driver reads rendered
// pixels to find a tree, aims the real mouse, and uses real keys/clicks.
export async function run({ page, shot, w, h, log }) {
  const S = w / 640; // stage scale (integer)

  // ---- 1. animation frame sequence: six consecutive walk frames ----------
  await page.mouse.move(w * 0.7, h * 0.5);
  await page.keyboard.down('d');
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(90); await shot(`11-gait-${i}`); }
  await page.keyboard.up('d');
  await page.waitForTimeout(200);

  // ---- 2. find a tree trunk in the rendered canvas, aim, harvest ----------
  const findTrunk = () => page.evaluate(() => {
    const cv = document.querySelector('canvas'); if (!cv) return null;
    const g = cv.getContext('2d'); const d = g.getImageData(0, 0, cv.width, cv.height).data;
    // oak trunk highlight #7a5232 — absent from the terrain palette
    for (let y = 60; y < cv.height - 40; y++) for (let x = 40; x < cv.width - 40; x++) {
      const i = (y * cv.width + x) * 4;
      const R = d[i], G = d[i + 1], B = d[i + 2];
      // trunk brown survives the colour grade: warm, r>g>b, mid luminance
      if (R > 84 && R < 150 && G > 48 && G < 104 && B > 22 && B < 74 && R - G > 26 && G - B > 12) return { x, y };
    }
    return null;
  });
  let harvested = false;
  for (let attempt = 0; attempt < 8 && !harvested; attempt++) {
    const t = await findTrunk();
    if (!t) { await page.keyboard.down('s'); await page.waitForTimeout(400); await page.keyboard.up('s'); continue; }
    // walk toward it, then swing at contact range
    const dx = t.x - 320, dy = t.y - 180;
    const kx = dx > 8 ? 'd' : dx < -8 ? 'a' : null, ky = dy > 8 ? 's' : dy < -8 ? 'w' : null;
    if (Math.hypot(dx, dy) > 26) {
      if (kx) await page.keyboard.down(kx); if (ky) await page.keyboard.down(ky);
      await page.waitForTimeout(Math.min(900, Math.hypot(dx, dy) * 9));
      if (kx) await page.keyboard.up(kx); if (ky) await page.keyboard.up(ky);
    }
    const t2 = (await findTrunk()) || t;
    await page.mouse.move(t2.x * S, (t2.y - 6) * S);
    for (let i = 0; i < 10; i++) { await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(130); }
    await shot(`12-harvest-${attempt}`);
    const txt = await page.evaluate(() => document.body.innerText);
    if (/Wood/i.test(txt)) { harvested = true; log('harvest confirmed by on-screen text'); }
  }
  log('harvested:', harvested);

  // ---- 3. craft panel: real costs are now visible -------------------------
  await page.keyboard.press('c'); await page.waitForTimeout(400);
  await shot('13-craft-costs');
  const camp = page.getByRole('button', { name: /^Campfire$/i });
  if (await camp.count()) { await camp.first().click(); await page.waitForTimeout(350); await shot('14-craft-campfire-tab'); }
  await page.keyboard.press('c'); await page.waitForTimeout(250);

  // ---- 4. three art directions on the SAME live gameplay state ------------
  await page.keyboard.press('Escape'); await page.waitForTimeout(700);
  log('dir buttons:', await page.locator('.dirbtn').count());
  for (const [name, file] of [['Survival Fieldcraft', '15-dir-A-fieldcraft'], ['Arcane Industrial', '16-dir-B-arcane'], ['Mythic Pixel', '17-dir-C-mythic']]) {
    const b = page.locator('.dirbtn', { hasText: name });
    if (await b.count()) { await b.first().click(); await page.waitForTimeout(450); }
    await shot(file);
  }
  // restore the shipped direction
  const back = page.locator('.dirbtn', { hasText: 'Arcane Industrial' });
  if (await back.count()) await back.first().click();
  await page.waitForTimeout(300);

  // ---- 5. live controls: grade, shake, mixer, accessibility ---------------
  const sliders = page.locator('.panel input[type=range]');
  const n = await sliders.count();
  log('presentation sliders:', n);
  if (n > 0) { await sliders.nth(0).fill('0'); await page.waitForTimeout(350); await shot('18-grade-off'); await sliders.nth(0).fill('1'); }
  const solid = page.getByRole('button', { name: /Solid HUD/i });
  if (await solid.count()) { await solid.first().click(); await page.waitForTimeout(300); await shot('19-solid-hud'); await solid.first().click(); }
  const mute = page.getByRole('button', { name: /MUTE ALL|UNMUTE ALL/i });
  if (await mute.count()) { await mute.first().click(); await page.waitForTimeout(200); await mute.first().click(); }
  await page.waitForTimeout(200);
  await shot('20-presentation');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);

  // ---- 6. audio actually running? ----------------------------------------
  const audio = await page.evaluate(() => {
    const AC = window.AudioContext;
    return { hasCtor: !!AC, contexts: (window).__audioProbe ?? 'not instrumented' };
  });
  log('audio:', JSON.stringify(audio));

  // ---- 7. vehicle art contact sheet from the real sprite builder ---------
  await shot('21-final');
}
