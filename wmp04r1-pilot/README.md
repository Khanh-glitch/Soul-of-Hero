# SOH Web · WMP-04R1 real-world visual gameplay pilot

**Status: `PARTIAL`** (pilot stop condition `PASS`; four named GAMEPLAY / platform blockers remain).
See [`docs/CONTROL_TOWER_HANDOFF.md`](docs/CONTROL_TOWER_HANDOFF.md).

A genuine, independently reviewable Web pilot that renders the **active WMP-04R1 Map
geography** inside the **unchanged SOH Web renderer** at its native **640×360** stage, with
the original camera, character, HUD, keyboard/controller input, pixel art, weather and
day/night presentation. No new tileset, no new POI, no new vehicle, no new loot, no new
damage law, no production integration.

## Exact pinned sources

| Role | Source | SHA |
|---|---|---|
| Map (WMP-04R1) | `arena/2e3cfbd2-soul-of-hero` | `caccf21613aa57a55491ec44f687cc44c569f79e` |
| Gameplay (Web renderer) | `arena/d4bfcfff-soul-of-hero` @ pinned commit | `f8fcde910c330aa953dd5c65b80a51792945d35e` |
| `main` | untouched | `5214788933b1a827f3a177d11ff486433dfe5e8a` |

Active authority: `map-data/CURRENT_WORLD_MASTER.json` → `activeRevision = WMP-04R1`,
`activeManifest = v4/r1/manifest.r1.json`, `basePhysicalRevision = WMP-03`,
`artDirection.selection = REUSE_EXISTING_SOH_GAME_ART_RENDERER_AND_SPRITES_FIRST`,
`productionAtlas = NOT_AUTHORIZED`, `creatorVisualApproval = NOT_REQUESTED`.

> **Live-HEAD drift (2026-11-05):** Gameplay / PR #44 advanced continuously during this
> work: `f8fcde91` → `1b98e806dd000a5e115516ddd7f5ce31c92cfbcf` (10 commits) →
> `e11a9b4471a0832cd6d039b5510725b10ee0275c` (12 commits, final observation at
> 00:40 UTC). Those commits change `web/src/game/{engine,render,core,catalog,persist,sim}.ts`
> and `web/src/ui/Game.tsx`. This pilot deliberately consumes the **exact pinned**
> `f8fcde91` as instructed; it does **not** claim to be based on any newer head.
> Rebase owner: GAMEPLAY.

## Launch (real browser, 640×360)

Both servers are bound to `0.0.0.0` and accept preview hosts; browser-facing code uses
relative URLs only.

```bash
cd wmp04r1-pilot/web-pilot
npm install                 # once
npm run dev -- --port 5174 --strictPort
# open http://<preview-host>:5174/   (or http://localhost:5174/)
```

Untouched original SOH Web (BEFORE build), served from its production single-file build:

```bash
cd wmp04r1-pilot/web-baseline
npm install && npm run build
python3 -m http.server 5175 --bind 0.0.0.0 --directory dist
# open http://<preview-host>:5175/
```

### Five creator scenes

Use the **Title quick selector** (5 buttons) or the **in-game `[P]` selector**, or open a
scene directly:

```
?pilot=wmp04r1-baseline-forest&autostart=1&seed=20261104
?pilot=wmp04r1-snow-highlands&autostart=1&seed=20261104
?pilot=wmp04r1-oasis-corridor&autostart=1&seed=20261104
?pilot=wmp04r1-cinder-shore&autostart=1&seed=20261104
?pilot=wmp04r1-deathwater-beacon&autostart=1&seed=20261104
```

`&cam=tx,ty` overrides the QA view anchor; `&hours=0.2` advances the ORIGINAL SOH
day/night clock through the real `qaAdvance` intent (night). `&seed=` makes the run
reproducible. **WASD / arrows** move the real player; `E`, `I`, `C`, `B`, `M`, `Esc`,
`P` keep their original bindings. The first movement key releases the QA same-camera
lock and the original player-following camera resumes.

| # | Scene | Camera anchor (tile) | What WMP-04R1 shows |
|---|---|---|---|
| 1 | Original SOH forest/coast | seeded legal spawn | **Unchanged** baseline; no pilot geography |
| 2 | Typhon–Argus snow highlands | `30,162` | snow, restored rock outcrops, WMP-03 cliff faces, snow-pine/conifer vegetation, cold-transition classes |
| 3 | Oasis dry road/resource corridor | `176,58` | arid desert + dry-steppe transitions, authored Bone Road centrelines, POI footprints |
| 4 | Cinder geothermal shoreline | `100,48` | volcanic shore, real GOLD water boundary, WMP-03 cliff faces, static Strait of Embers marine domain |
| 5 | Western Deathwater / Beacon Rock shore | `56,46` | deep-water marine domain, `Beacon Rock Light` authored POI, helicopter landmark location |

> At the Oasis and Deathwater origins WMP-04R1 changed **zero biome cells**. Their
> BEFORE/AFTER pairs therefore correctly look identical (apart from WMP-03 cliffs and the
> static marine-domain annotation). The **actual** WMP-04 dry-steppe expansion is proven
> by the QA-only pair `wmp04r1-dry-transition` / `wmp04r1-before-dry-transition` at
> AU `[1000,600]`, camera `69,97`. These two are **not** part of the five creator scenes.

### BEFORE / QA / diagnostic URLs

`?pilot=wmp04r1-before-<scene>` renders the same camera with pre-WMP-04 geography
(WMP-01 source biome; no WMP-04 marine domain, no WMP-04R1 cold-transition class, no
WMP-03 cliff faces). `?pilot=wmp04r1-dry-transition` and
`?pilot=wmp04r1-before-dry-transition` expose the real dry-region delta.

## Reproduce the evidence

```bash
cd wmp04r1-pilot
node tools/vendor.mjs                 # 94 pinned files, per-file SHA-1/SHA-256 provenance
node tools/vendor-tests.mjs           # pinned Gameplay vitest suite + full LR01 geography, both trees
node tools/build-adapter.mjs          # browser-compatible TS module (no node:fs in the browser)
cd web-pilot && npm install && npx tsc --noEmit && npm run build && npm test
cd ../web-baseline && npm install && npx tsc --noEmit && npm run build && npm test
# with both servers running:
cd ..
LD_LIBRARY_PATH=/tmp/al2023/lib \
WMP04_PLAYWRIGHT=/path/to/playwright/index.mjs \
WMP04_CHROMIUM=/path/to/chromium \
node tools/qa-browser.mjs             # 16 real 640×360 captures + 6 comparisons
node tools/verify.mjs                 # 26 independent checks
```

`tools/build-adapter.mjs` is the required **build-time adapter**: `api/current.mjs`
imports `node:fs` and cannot be loaded in a browser, so the adapter emits
`web-pilot/src/game/veyra/wmp04r1.generated.ts` with base64 rasters that the browser
re-verifies with `@noble/hashes/sha256`. It asserts `activeRevision = WMP-04R1`,
manifest revisions, 43,750-byte rasters, source digests, `marineRegion` only on water,
code ranges and `changedSeaCells = 0`.

## Architecture boundaries

* **8 AU analytical cells** (`250×175 = 43,750`) are distinct from **gameplay tiles**
  (`200×200 = 40,000`). `U = 2` is a **diagnostic view scale, never an approved world scale**.
* Coastlines, lakes, rivers, roads (excluding ferries), POI footprints and LR02 solids are
  still evaluated from **authored GOLD polygons / centrelines at tile centres**. No
  low-resolution raster square replaces an actual coast, water body, building, physical
  portal or road centreline.
* Static geography (`map-data/`, generated TS) is separate from Gameplay authority
  (`web-pilot/src/game/`). No boat, swimming, Leviathan AI, helicopter flight, loot,
  fixed spawn reward, player-owned structure, weather damage or numeric climate rate was
  added. Marine regions are **labels only**, never collision or damage permission.
* `web-baseline/` is a **verbatim, untouched** copy of Gameplay `f8fcde91`. In
  `web-pilot/` exactly **172 files are byte-identical**, **5 files are intentionally
  edited** (`App.tsx`, `game/world.ts`, `game/veyra/projection.ts`, `ui/Game.tsx`,
  `ui/Title.tsx`) and **2 modules are added** (`wmp04r1.ts`, `wmp04r1.generated.ts`).
* WMP-01/02/03, GOLD, map feature IDs and all existing SOH visuals are preserved. The
  legacy Gameplay projection mappings are byte-for-byte unchanged, so legacy map digests
  and save identities are intact.

## Evidence index

| Path | Content |
|---|---|
| `ASSET_PROVENANCE.json` | 94 vendored files / 7,062,739 bytes, per-file source commit, SHA-1, SHA-256 |
| `TEST_PROVENANCE.json` | 142 pinned Gameplay test + geography files / 8,752,709 bytes |
| `map-data/GENERATED_META.json` | active revision, raster digests, scene definitions, measured per-scene geography |
| `evidence/qa-report.json` | 16 real browser captures, 6 comparisons, runtime inspections, inputs, save reload |
| `evidence/shots/*.png` | 16 native 640×360 captures + 6 labelled 1280×400 comparisons |
| `evidence/verification.json` | 26 independent checks, `WMP04R1_VERIFY_PASS` |
| `evidence/tests-baseline.log`, `evidence/tests-pilot.log` | Gameplay vitest suite: 28/28 files, 233/233 tests on both |
| `docs/CONTROL_TOWER_HANDOFF.md` | final Control Tower handoff |
| `docs/ASSET_INVENTORY.md` | KEEP / REWORK / PROVEN MISSING |
| `docs/QA_VISUAL_ASSESSMENT.md` | per-scene visual QA and world-coordinate vs rendering-quality analysis |
