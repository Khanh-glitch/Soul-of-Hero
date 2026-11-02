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
