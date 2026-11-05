# SOH × PixelFX — FX Foundry v1 Report (2026-11-02)

## Verdict line

**244 / 244 effects DISCOVERED → EXPORTED → PARITY_PASS** against the pinned official PixelFX renderer.
0 failures, 0 fabricated assets. `VISUAL_REVIEWED` was performed on representative animations across all
21 categories (see `docs/pixelfx_foundry/qa/`). **SOH_READY = 0** — that status stays gated on native Godot
integration acceptance; a web preview does not grant it.

## Provenance

- Agent branch: `arena/3337c864-soul-of-hero` (see pushed HEAD in the handoff message).
- Upstream: https://github.com/patch-gg/pixelfx, pinned commit **`a84159688af3ca37a4be05a0d422b94451b2e24e`**
  (v0.3.0, 2026-10-31). Gate G0 enforces exactly **244 unique IDs / 21 categories** at that SHA and aborts on drift.
- License: MIT — upstream `LICENSE` + `NOTICE.md` copied verbatim into `assets/pixelfx_foundry/`.
- Node v22.22.3.

## Counts

| status | count |
|---|---|
| DISCOVERED | 244 |
| EXPORTED (atlas files written, hashed) | 244 |
| PARITY_PASS (independent PNG-decode vs `renderFrames().clear`, byte-exact, every frame) | 244 |
| VISUAL_REVIEWED (animation inspected, all 21 categories sampled) | representative set + category strips |
| SOH_READY | 0 (gated) |
| FAILED | 0 |

Category census matches upstream `docs/CATALOG.md` exactly (arcane 12, critters 12, explosions 12, fire 12,
holy 10, ice 10, impacts 11, lightning 11, melee 12, moves 12, nature 13, pickups 11, projectiles 13,
scifi 12, shadow 12, spawn 10, status 13, transitions 10, ui 12, water 12, weather 12). Engine census:
132 simulated (`create()`), 112 pure (`draw()`), 73 with `act` data (37 on-body), 23 full-screen.

## Architecture learned from the source

- One engine, three source-handling semantics: `renderFrames()` (pure + simulated, via `createFx` stepping at
  ≥120 Hz internally) produces canonical `frames[].clear` (combined color+light over transparency), plus
  separate `raw` color and additive `light`; `renderAct()` produces performed previews for the 73 acted effects.
  Both share the same export/registry infrastructure — no per-effect renderers.
- The combined `clear` frame **already includes the source light**; the exporter never adds it twice. The
  separate `light` channel is exported only for emission inspection and the bounded night boost.
- Atlas pages are written **byte-exact** (direct pixel copy, not alpha-blending paste), bounded to 2048px
  pages, each PNG sha256-hashed; per-frame sha256 of the canonical frames is in the manifest.
- Parity gate G1 decodes every written PNG with an independent decoder (`tools/pixelfx_foundry/lib/png-decode.mjs`)
  and compares byte-exact against in-memory source frames for all three channels.
- Presentation proposals are data-driven from category/bg/act metadata (`source`, `ground`, `air`, `screen`,
  `body`, `act`); they are proposals, not accepted roles. `extraShapes=false` for all 244 — no generic circles,
  rings, or telegraphs anywhere.
- Night rule: world gets the night overlay; the effect is composited **after** it, with the source light channel
  additively boosted at a bounded factor (≤ ~1.29×), so combat FX stay luminous at night without double-counting.
- Black Hole is grounded (its source pivot sits at the ground line) and flagged `sceneInteraction: warp`; the
  browser renders a localized, cached (~15 Hz), ~68px-radius tile displacement of the scene around it — the
  effect artwork itself is never distorted, and no ring/shape is added.

## Deliverables

- `tools/pixelfx_foundry/intake.mjs` — universal importer/exporter (discover → export → parity → resume).
- `tools/pixelfx_foundry/lib/png-decode.mjs` — independent PNG decoder for the parity gate.
- `tools/pixelfx_foundry/qa_sheets.mjs` — 21-category source + SOH day/night evidence strips.
- `tools/pixelfx_foundry/perf.mjs` — headless compositing benchmark.
- `tools/pixelfx_foundry/browser/` — FX Foundry Browser (`index.html`, `app.js`, `style.css`, `serve.mjs`):
  category/search navigation, animated previews with play/pause/restart/scrub, day/night, anchor + scale,
  emission-map view, act preview, SOH scene mode with localized warp, lazy per-effect atlas loading,
  metadata + provenance + export/verification status per effect.
- `assets/pixelfx_foundry/index.json` — 244-entry registry manifest (committed; atlas PNGs gitignored, rebuilt by one command).
- `docs/pixelfx_foundry/qa/` — 42 evidence PNGs (source contact sheet + SOH day/night strip per category).

## Reproduce

```bash
git clone https://github.com/patch-gg/pixelfx.git /tmp/pixelfx-upstream
git -C /tmp/pixelfx-upstream checkout a84159688af3ca37a4be05a0d422b94451b2e24e
node tools/pixelfx_foundry/intake.mjs --upstream /tmp/pixelfx-upstream --out assets/pixelfx_foundry
node tools/pixelfx_foundry/qa_sheets.mjs /tmp/pixelfx-upstream docs/pixelfx_foundry/qa assets/pixelfx_foundry .
node tools/pixelfx_foundry/perf.mjs --assets assets/pixelfx_foundry
node tools/pixelfx_foundry/browser/serve.mjs 8734   # http://localhost:8734/tools/pixelfx_foundry/browser/
```

## Performance (honest, headless)

`perf.mjs` times the exact browser compositing workload in pure JS on this sandbox CPU (scene fill + night
overlay + N atlas instances + bounded additive emission), 60-frame samples, p50/p95 ms/frame:

- 1280×720: 1 fx day 2.9 / night 8.6; 3 fx 3.7 / 9.4; 10 fx 6.3 / 14.4
- 1920×1080: 1 fx 6.5 / 18.9; 3 fx 7.1 / 19.6; 10 fx 9.7 / 24.6
- 2560×1440: 1 fx 11.3 / 32.7; 3 fx 11.7 / 34.3; 10 fx 14.6 / 38.1

These are CPU per-pixel numbers, i.e. a worst case: in a real browser the same path runs through GPU
`drawImage`/`lighter` compositing and will be substantially faster. Night overhead is the full-screen overlay
plus the additive light pass — both single-pass GPU ops in the browser. No FPS promises are made; the source
artwork is never degraded to buy performance (scene warp is the first thing a quality preset would cut).

## Corrective round (2026-11-02, post-review)

**Defects fixed and verified**

1. `intake.mjs` latent `category: cat` ReferenceError (undefined in the fresh-discovery path; masked earlier
   because resume kept prior entries). Fixed to `id.split("/")[0]`; proven by a **clean rebuild from a fresh
   clone of the pinned SHA into an empty output dir: 244/244 PARITY_PASS, 0 failed**, and all 244 effects'
   file-hash sets + per-frame hashes are **byte-identical to the committed manifest** (1204/1204 on-disk
   files match their manifest sha256). Reproducibility is deterministic, not approximate.
2. `browser/app.js` playback froze 30 fps animations on 60 Hz displays (accumulated frame position was
   floored each tick, discarding the sub-frame remainder). Now float `animT` drives an integer derived
   frame index. Verified in real Chromium: 20 distinct frames across 40 rAF samples; loop wraps; pause
   freezes; resume advances; scrub sets the exact frame; restart returns to 0; one-shot (fire/meteor)
   ends on the last frame and stops. 8/8 behavior tests pass.
3. Canvas backing store is now resized only when the display size/DPR changes (was reset every frame).
   Also fixed a layout feedback bug (`#view` sized by its own attributes) — canvas now fills the stage.
4. Async selection race: a generation counter discards stale atlas loads after rapid switching; loading and
   error states are shown. Verified: rapid 5-effect switching lands on the last selection with no error.
5. Black Hole placement: anchoring now distinguishes **source pivot** (`meta.origin` 92,124) from the
   **visual bounds** (`[9,1,177,130]`, computed data-driven from actual alpha pixels of all frames for every
   effect — no per-effect constants). `ground` anchor puts the bottom edge of the artwork's visual bounds on
   the ground line, so the disk itself sits on the battlefield (screenshot-verified day+night).
6. Scene warp now **samples the environment before FX artwork is drawn** and composites the displaced scene
   *under* the effect, so Black Hole pixels/disk/particles/glow remain intact (earlier version painted the
   warp over the FX and visibly erased the disk). No artificial range circle anywhere; `extraShapes=false`.

**Real Chromium verification** — HeadlessChrome 153.0.8010.0 driven via CDP (puppeteer-core) against the live
browser server; harness committed at `tools/pixelfx_foundry/browser/verify.mjs`. 8/8 behavior tests pass;
screenshots in `docs/pixelfx_foundry/qa/browser/` cover Pure (ice-lance), Simulated (meteor), Acting
(ice-lance-throw act), Status (frozen), Environment (fireflies), UI (achievement), Screen (crt-off),
plus day/night for the marquee effects. Day/night keeps effect art luminous (post-night composite +
bounded emission boost).

**Performance — real Chromium (HeadlessChrome 153, software GL in this sandbox), 60-sample p50/p95**
(`docs/pixelfx_foundry/qa/browser/perf-chromium.json`): rAF deltas are vsync-quantized under software
rasterization — 720p: 33 ms p50 (1–10 instances, day/night); 1080p: 50–83 ms; 1440p: 83–117 ms, dominated by
full-screen scene fill in software, not by sprites. Actual recorded draw-call cost p50: 0–0.1 ms at 1–3
instances; 16–94 ms p50 at 10 instances night (full-screen 'lighter' emission pass). Pure-JS CPU worst case
from round 1 (perf.mjs): 720p 10 instances 6.3 ms day / 14.4 ms night p50. No source art is degraded in any
preset; scene warp remains the first thing a quality preset would cut.

**Durable artifact** — atlas PNGs stay gitignored (414 MB), but the committed `index.json` pins every file's
sha256 + every frame's sha256, and the clean-rebuild proof above shows a fresh Agent gets byte-identical
assets with one command (see README). Upstream `LICENSE`/`NOTICE.md` travel with the output.

## Final presentation round (2026-11-02, round 3)

**1. Evidence harness now captures authored timestamps.** `verify.mjs` no longer screenshots frame 0: it
scrubs to deliberate fractions (start / anticipation / release-impact / midpoint / decay / end) via a
deterministic `captureFrame()` hook and assembles 6-frame strips per effect — real animated sequences in
`docs/pixelfx_foundry/qa/gallery/` (Ice Lance, Arcane Orb, Black Hole, Meteor, Frozen, Fireflies, Ice Lance
Throw act, Big Explosion; day and night where relevant).

**2. Real SOH test environment.** "SOH scene" now uses actual game assets — `ocean_tileset_stone_ground` tiled
as the ground plane, `ocean_tileset_grass` horizon strip, and the knight `_Idle` sprite as standing depth
references — an isolated test scene, production scenes untouched. Effects auto-scale to a readable size
(~42% of view height, slider override). Day/night: the world is pre-rendered to cached day/night scene
canvases; per frame the app does ONE scene blit + the FX sprites — no per-frame world repaint.

**3. Black Hole placement.** The manifest now records, per effect, source-derived placement data: source
`pivot`, `visualBounds` (all alpha>0 pixels incl. debris), `coreBounds` (solid alpha≥128 artwork), and
`focalPoint` (alpha-weighted centroid). `ground` anchor places the **bottom of the solid core** on the ground
line, sunk by 8% of core height so it reads as resting, not hovering (black hole: pivot y=124, core bottom
122, focal y=45.9 → disk seats on the battlefield; verified numerically: core bottom lands exactly
`sink` px below the ground line, and visually in the gallery strips). No cropping, no redrawn art, no range
circles. The localized warp samples the **cached scene canvas (pre-FX)** and is composited **under** the
effect, so the accretion disk, particles and glow stay intact while structured terrain and the knights are
visibly distorted around it.

**4. Real-Chromium verification + performance.** HeadlessChrome 153 via CDP: behavior suite 9/9 (motion on
60 Hz, loop wrap, pause/resume, scrub, restart, one-shot end, rapid switching, 3-FX combat demo animating).
Live playback perf after closing stale pages and caching the scene — **rAF p50/p95 = 16.7/16.7 ms (locked 60
FPS) at canvas sizes 1275×941, 1915×1413 and 2555×1885, for 1 and 3 simultaneous FX, day and night**
(`qa/gallery/perf-chromium-final.json`). Caveat, honestly: this sandbox renders via software GL; the numbers
prove the per-frame workload is small and vsync-bound here, and real GPU hardware will be at least as fast.
Earlier slow numbers were an artifact of leftover harness pages contending for the software rasterizer plus
per-frame scene repaint — both fixed. No source art, trails or glow are degraded in any mode.

## Known limitations / exceptions

- Per-effect exception report: **0 export/parity exceptions** — all 244 passed byte-exact parity.
- On-body statuses (37) export the effect-only frames; the body binding to a real SOH character needs a
  mask/pixels binding step at integration time (the `act` atlas shows the stock stand-in for reference only
  and must never be baked into SOH sprites).
- Back/front split-layer compositing is preserved as separate channels but the combined canonical frame is the
  primary asset; games needing strict behind/in-front layering should composite `combined` per layer role.
- Web preview ≠ Godot production acceptance: `SOH_READY` remains 0 until the native integration gate.
- QA evidence strips composite screen-category effects centered; in the browser use the `screen fit` anchor.

## What the next stage can safely consume

`assets/pixelfx_foundry/index.json` + the atlas PNGs (rebuildable) — 244 byte-verified transparent animation
atlases with separate emission maps, act timing for 73 acted effects, stable IDs, provenance and hashes.
Safe to wire into a Godot importer or skill-composition tool as *visual assets only*; no gameplay, damage,
roles, or Skill Cores are implied by registration.
