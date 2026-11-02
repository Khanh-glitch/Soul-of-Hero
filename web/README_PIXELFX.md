# PixelFX integration (Soul of Hero web prototype)

Original [PixelFX](https://github.com/patch-gg/pixelfx) effects (244, upstream pinned at
`a84159688af3ca37a4be05a0d422b94451b2e24e`, MIT) are rendered inside the real SOH
Canvas2D game through one universal, data-driven, **presentation-only** adapter.

## Architecture

- `src/game/pixelfx.ts` — the adapter singleton. Pipeline:
  gameplay event → FX id (`pixelfxMap.ts`) → presentation profile → world anchor
  (ground / hover / body / screen) → instance → depth + night composition → cleanup.
  It never mutates game state; all gameplay authority stays in `sim.ts`/`engine.ts`.
- `src/game/pixelfxMap.ts` — visual-only event→FX mappings (Core casts, bolts, booms).
- `src/game/render.ts` — FX instances join the existing y-sorted draw list (depth-integrated
  with actors/trees/structures), the warp pass (black hole) runs after `g.restore()`, and a
  **bounded post-night emission** pass (light channel only, additive, alpha ≤ 0.55) keeps
  skill art luminous after the night overlay. The combined channel already contains light and
  is drawn as-is — never dimmed, cropped, redrawn, or double-added. `extraShapes:false`:
  no generic circles/rings/telegraphs are added by the adapter.
- `src/ui/FxLab.tsx` — dev-only **FX Test Lab** (F9): browse/search all 244, trigger at
  mouse/player/target, ground/hover/body/screen anchors, replay, day/night compare (QA
  night override, visual only), live FX id + loaded status + FPS/frame-time. Lab casts go
  through the SAME adapter and are provably non-mutating (verified in tests).
- `src/game/pixelfx/pilot.ts` — GENERATED (`npm run gen:pilot`) embedded pilot atlas set.

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
# browser QA (headless Chromium), screenshots -> web/qa-pixelfx-shots/:
LD_LIBRARY_PATH=<nss-stub> WITH_ASSETS=1 node scripts/qa-pixelfx.mjs   # full pack
LD_LIBRARY_PATH=<nss-stub> node scripts/qa-pixelfx.mjs                 # standalone pilot
# curated evidence screenshots: web/docs/pixelfx-qa/*.png
```

Latest results (Chromium, this machine): 28/28 vitest, tsc clean, build 13.9 MB;
non-mutation PASS; one Core cast = exactly one charge debit PASS; all four Cores PASS;
60 fps at 1/3/10 simultaneous FX (16.7 ms frame); save/reload PASS; full pack catalog 244
with lazy page loading PASS; zero page errors. Pre-existing note: `e2e/salt-chain.mjs`
fails identically on the pristine prototype baseline 93f413e ("Campfire did not accept wood
fuel") — not caused by this integration.

## Attribution

PixelFX © patch-gg, MIT license, upstream commit
`a84159688af3ca37a4be05a0d422b94451b2e24e`. Foundry QA/parity evidence:
`docs/pixelfx_foundry/FOUNDRY_REPORT.md` (repo root).
