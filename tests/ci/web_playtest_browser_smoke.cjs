// Executed only in CI against the real Godot 4.7 browser export.
// A build/deploy pass is insufficient: require AppRoot and authored Title.
const { chromium } = require("playwright-core");
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

(async () => {
  const logs = [];
  const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage",
      "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const fail = (type, value) => logs.push(type + " " + String(value));
  page.on("console", m => {
    if (["error", "warning"].includes(m.type())) fail("CONSOLE:" + m.type(), m.text());
  });
  page.on("pageerror", e => fail("PAGE ERROR", e.stack || e.message));
  page.on("requestfailed", r => fail("REQUEST FAILED", r.url() + " " + r.failure()?.errorText));
  page.on("response", r => {
    if (r.status() >= 400) fail("HTTP " + r.status(), r.url());
  });
  const out = process.env.WEB_SMOKE_OUTPUT || "web-browser-smoke";
  fs.mkdirSync(out, { recursive: true });
  let successful = false;
  try {
    await page.goto(process.env.WEB_SMOKE_URL || "http://127.0.0.1:8787/",
      { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(
      () => window.__soulHeroAppReady === true && window.__soulHeroRoute === "title",
      null, { timeout: 45000, polling: 250 }
    );
    await page.waitForTimeout(1700);
    const status = await page.evaluate(() => ({
      appReady: window.__soulHeroAppReady,
      route: window.__soulHeroRoute,
      canvasSize: [
        document.querySelector("canvas")?.width || 0,
        document.querySelector("canvas")?.height || 0,
      ],
    }));
    console.log("GODOT WEB APP STATE:", JSON.stringify(status));
    if (status.canvasSize[0] < 100 || status.canvasSize[1] < 100) {
      throw new Error("Game canvas missing or unexpectedly small");
    }
    const pngBytes = await page.screenshot({ path: path.join(out, "title.png") });
    const png = PNG.sync.read(pngBytes);
    let distinct = new Set();
    for (let y = 0; y < png.height; y += 17) {
      for (let x = 0; x < png.width; x += 17) {
        const pos = (y * png.width + x) * 4;
        const r = png.data[pos], g = png.data[pos + 1], b = png.data[pos + 2];
        distinct.add([r >> 4, g >> 4, b >> 4].join("-"));
      }
    }
    console.log("GODOT WEB SCREENSHOT COLOR BUCKETS:", distinct.size);
    if (distinct.size < 10) {
      throw new Error("Game loaded title route but visible canvas remains nearly monochrome/black");
    }
    console.log("GODOT WEB TITLE SCREEN PASSED - route and nonblank screenshot");

    // A Title-only smoke missed the user-facing bug: map tiles could show while
    // Main.gd failed to compile, leaving monsters, chests and gates absent.
    // This localhost-only CI route loads the actual game scene from its authored
    // crypt_entrance.json without altering campaign save/unlock state.
    const gameplayURL = new URL(
      process.env.WEB_SMOKE_URL || "http://127.0.0.1:8787/"
    );
    gameplayURL.searchParams.set("ci_gameplay", "1");
    await page.goto(gameplayURL.toString(), {
      waitUntil: "domcontentloaded", timeout: 30000
    });
    await page.waitForFunction(
      () => window.__soulHeroRoute === "game" &&
        window.__soulHeroLevelReady &&
        window.__soulHeroLevelReady.instantiated_count > 10,
      null, { timeout: 55000, polling: 250 }
    );
    await page.waitForTimeout(1200);
    const gameplay = await page.evaluate(() => window.__soulHeroLevelReady);
    console.log("GODOT WEB LIVE ENTITY REPORT:", JSON.stringify(gameplay));
    if (!gameplay.layout.endsWith("crypt_entrance.json") ||
        gameplay.authored_count < 50 ||
        gameplay.instantiated_count < 30) {
      throw new Error("Gameplay map is missing expected authored population");
    }
    for (const required of ["skeleton", "chest", "exit_gate", "spikes", "torch"]) {
      if ((gameplay.types?.[required] || 0) < 1) {
        throw new Error("Missing live runtime entity in browser: " + required);
      }
    }
    const gamePNG = await page.screenshot({ path: path.join(out, "gameplay.png") });
    const image = PNG.sync.read(gamePNG);
    const distinctGame = new Set();
    for (let y = 0; y < image.height; y += 17) {
      for (let x = 0; x < image.width; x += 17) {
        const pos = (y * image.width + x) * 4;
        distinctGame.add([image.data[pos] >> 4,
          image.data[pos + 1] >> 4, image.data[pos + 2] >> 4].join("-"));
      }
    }
    console.log("GODOT WEB GAMEPLAY SCREENSHOT COLOR BUCKETS:", distinctGame.size);
    if (distinctGame.size < 10) throw new Error("Gameplay canvas is blank");
    const fatal = logs.filter(e => /PAGE ERROR|SCRIPT ERROR|Failed loading|Parse Error|Preload file/.test(e));
    if (fatal.length) throw new Error("Fatal browser/Godot errors: " + fatal.slice(0, 6).join("\n"));
    successful = true;
    console.log("GODOT WEB BROWSER SMOKE PASSED - title and live gameplay entity population");
  } finally {
    try {
      await page.screenshot({ path: path.join(out, "last-state.png"), timeout: 12000 });
    } catch (ignored) {}
    fs.writeFileSync(path.join(out, "console.json"), JSON.stringify(logs, null, 2));
    console.log("GODOT WEB BROWSER LOGS:", JSON.stringify(logs.slice(-30)));
    await browser.close();
  }
  if (!successful) process.exitCode = 1;
})().catch(err => {
  console.error("GODOT WEB BROWSER SMOKE FAILED:", err?.stack || String(err));
  process.exitCode = 1;
});
