# PixelFX integration (Soul of Hero web prototype)

Original [PixelFX](https://github.com/patch-gg/pixelfx) effects (244, upstream pinned at
`a84159688af3ca37a4be05a0d422b94451b2e24e`, MIT) are rendered inside the real SOH
Canvas2D game through one universal, data-driven, **presentation-only** adapter.

## Architecture (v2 compositor)

- `src/game/pixelfx.ts` — the universal presentation compositor. Pipeline:
  **official combined art (byte-faithful) → world placement by family profile
  (ground / hover / body / proj / screen) → depth & occlusion (instances join the
  game's y-sorted world list; roofs still occlude) → warp scene response (per-instance
  cached, localized; source art undistorted) → colored environmental radiance
  (soft cached falloff sprites tinted per effect category — illumination, not drawn
  geometry) → night-safe bounded emission (light channel only, incremental, post-night)
  → lifecycle → cleanup.** Presentation-only: never mutates game state.
- `src/game/pixelfxMap.ts` — visual-only event→FX mappings (Core casts, bolts, booms).
- `src/game/render.ts` — minimal seams: FX into the y-sorted list, warp+screen passes
  after `g.restore()`, radiance+emission after `drawLight`. The legacy fireball sprite
  is skipped when PixelFX owns the projectile (no duplicate visuals).
- `src/ui/FxLab.tsx` — F9 workbench: search all 244, cast at mouse/player/target,
  family modes, scale slider, pause/frame-scrub, layer toggles (art/emission/radiance/
  warp), quality presets (high/balanced/performance), QA day/night, p50/p95 stats,
  H collapses the panel for clean screenshots, Enter replays the last effect.
- Quality presets change warp slice count/refresh, radiance and emission caps — never
  the source artwork. Page cache is LRU-bounded (pilot data-URLs never evicted).

## Core mappings (visual only; combat rules untouched)

| Core item | sim core | FX id (verified in pinned catalog) |
|---|---|---|
| Ember Core | `fire` | `fire/fireball` (rides the real projectile) + `explosions/small-explosion` on impact (`boom`) |
| Quake Core | `earth` | `nature/quake` per spike hazard, rotated along aim, delayed by the hazard tell |
| Storm Core | `storm` | `lightning/chain-lightning` per `bolt` segment, rotated + stretched to the segment |
| Rime Core | `frost` | `ice/frost-nova` on the nova hazard ring |
| any Core windup | — | `arcane/spell-charge` (hover, bounded 560 ms) |

Charge accounting is unchanged: sim debits exactly one charge at cast contact
(proven in browser QA: one click-cast 3→2; all four cores [2,2,3,2] after one cast each).

## Delivery mode A — portable standalone offline HTML (pilot)

```
cd web && npm ci && npm run build
# -> dist/index.html  (~13.9 MB, single file, 11 pilot effects embedded as data URLs)
```

Open `dist/index.html` directly (file://) — no toolchain, no server, no network.
Full original gameplay/HUD/inventory/crafting/building/map/skills/save-load preserved.
Pilot set: ice/ice-lance, arcane/arcane-orb, shadow/black-hole, fire/fireball, nature/quake,
lightning/chain-lightning, ice/frost-nova, moves/ice-lance-throw, impacts/impact-frame,
arcane/spell-charge, explosions/small-explosion.

## Delivery mode B — full 244-effect lazy loading

The 414 MB atlas pack is NOT committed. Rebuild it reproducibly from the pinned upstream
and hash-verify against the Foundry registry:

```
# from the repo root (Foundry pipeline at the accepted commit d89dc219)
node tools/pixelfx_foundry/intake.mjs --upstream /path/to/pixelfx@a84159688af3ca37a4be05a0d422b94451b2e24e --out web/pixelfx-assets
# verify: node tools/pixelfx_foundry/browser/verify.mjs (or compare hashes in web/pixelfx-assets/index.json
# against assets/pixelfx_foundry/index.json — 244/244 PARITY_PASS)
```

`web/pixelfx-assets/index.json` (the 244-entry manifest, 2.6 MB) IS committed; only
`web/pixelfx-assets/assets/` is gitignored. Then:

```
cd web && npm run dev          # serves the game AND /pixelfx-assets (vite middleware)
# open http://localhost:5173 and press F9 — the lab shows "full pack: 244 effects lazy-loaded"
# (or serve dist/ + pixelfx-assets/ with any static server and pass ?pfxbase=/pixelfx-assets/)
```

## Tests / QA

```
cd web && npm ci && npm test && npx tsc --noEmit && npm run build
# browser QA (headless Chromium, enforced assertions, nonzero exit on FAIL):
LD_LIBRARY_PATH=<nss-stub> WITH_ASSETS=1 node scripts/qa-pixelfx.mjs   # full 244 pack
LD_LIBRARY_PATH=<nss-stub> node scripts/qa-pixelfx.mjs                 # standalone pilot
# existing project QA: node scripts/qa.mjs ; e2e/salt-chain.mjs via GAME_URL=<dev server>
```

Latest results (Chromium headless, this sandbox, vsync-capped 60 fps): 30/30 vitest,
tsc clean, build ~13.9 MB single file. Browser QA both modes: ALL PASS — v5 gate now
uses **deliberate source frames**: per-frame source luminance (`window.__pfx.frameLuma`)
picks anticipation (8 %) / peak (argmax) / decay (90 %) frames, the lab pauses and
scrubs to the exact frame time (frame/30×1000 ms) for day + QA-night screenshots,
and canvas pixel probes are enforced: ice-lance peak cyan n=151 day / 970 night
(maxL 246), arcane-orb peak purple n=1090 day / 1566 night (maxL 187/189 — the orb's
peak luminance is only ~3 % above its mean, i.e. a sustained glow rather than a flash;
richness verified by pixel count, not just a bright frame), black-hole peak purple
n=930 day / 2908 night (maxL 214/218) with art centroid aligned to the world anchor
(|cx−sx| < 26 px) and the disk grounded (cy ≤ anchor+10 — it touches the ground/roof
line instead of floating), real night (dayTime 0.001) black hole + orb n=7526.
Night light mask uses one smooth radial gradient per light (no concentric bands).
Gallery: ice-lance / arcane-orb / black-hole × day / QA-night × 3 deliberate frames +
real DAY/NIGHT pair, lab hidden for unobstructed shots. Lab non-mutation (state+save
byte-identical),
one Core cast = exactly one charge debit (3→2; four cores → [2,2,3,2]), perf
1/3/10 FX = 59–60 fps, p50=p95=16.7 ms, full pack catalog = 244 with lazy load,
save/reload, zero page errors. `e2e/salt-chain.mjs` PASSES on the latest prototype
baseline (campfire-fuel fix is upstream in `arena/4795760e-soul-of-hero` @ f8b5005);
`scripts/qa.mjs` passes with zero console errors. Evidence: `web/docs/pixelfx-qa/*.png`
(day/night pairs are labeled `day` / `qanight` (QA override) / `real-NIGHT`).
Direct frame-by-frame comparison to the historical Foundry v5 build was not possible
(the v5 HTML/archive is not available in the repo); the documented v5 artistic
qualities were used as the qualitative contract.

## Attribution

PixelFX © patch-gg, MIT license, upstream commit
`a84159688af3ca37a4be05a0d422b94451b2e24e`. Foundry QA/parity evidence:
`docs/pixelfx_foundry/FOUNDRY_REPORT.md` (repo root).
