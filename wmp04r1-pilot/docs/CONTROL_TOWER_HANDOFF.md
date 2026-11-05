# SOH WMP-04R1 REAL WORLD VISUAL PILOT — Control Tower handoff

**Date:** 2026-11-05 (Asia/Saigon)
**Deliverable:** runnable SOH Web visual gameplay pilot in `wmp04r1-pilot/`
**Overall status: `PARTIAL`**
**Pilot stop condition: `PASS`** — a creator can open the pilot, see WMP-04R1's actual
geographic differences, control the real character in representative environments and
judge visual quality against the original SOH renderer using trustworthy screenshots.

`PARTIAL` is deliberate and honest. The pilot itself works and is independently
reviewable; four **named** blockers prevent a `PASS` on full Gameplay intake / integration
(see §7). No blocker was hidden by weakening validation.

---

## 1. Exact source identity (live HEADs verified first)

| Role | Ref | SHA | Note |
|---|---|---|---|
| Map WMP-04R1 | `arena/2e3cfbd2-soul-of-hero` | `caccf21613aa57a55491ec44f687cc44c569f79e` | pinned, unchanged |
| Gameplay Web | `arena/d4bfcfff-soul-of-hero` @ pinned commit | `f8fcde910c330aa953dd5c65b80a51792945d35e` | verbatim vendored |
| `main` | `main` | `5214788933b1a827f3a177d11ff486433dfe5e8a` | untouched |
| PR #44 base | `arena/4795760e-soul-of-hero` | `8421b9c3335c7648488ce8ae5dab43eb5787977e` | untouched |
| PR #44 live head | `arena/d4bfcfff-soul-of-hero` | `1b98e806dd000a5e115516ddd7f5ce31c92cfbcf` | **OPEN / DRAFT**, advanced during this work |

* `map-data/CURRENT_WORLD_MASTER.json`: `activeRevision = WMP-04R1`,
  `activeManifest = v4/r1/manifest.r1.json`, `basePhysicalRevision = WMP-03`,
  `status = MAP_GEO_R1_CORRECTED__GAMEPLAY_INTAKE_PENDING`,
  `artDirection.selection = REUSE_EXISTING_SOH_GAME_ART_RENDERER_AND_SPRITES_FIRST`,
  `productionAtlas = NOT_AUTHORIZED`, `creatorVisualApproval = NOT_REQUESTED`.
* `api/current.mjs` is the active runtime reader but imports `node:fs`; it **cannot** be
  imported into a browser. `tools/build-adapter.mjs` therefore emits
  `web-pilot/src/game/veyra/wmp04r1.generated.ts` at build time (7 base64 rasters,
  browser SHA-256 re-verified with `@noble/hashes/sha256`, no `node:fs`, no network).
* `WMP04R1_ADAPTER_OK rasters=7 layouts=10 active=WMP-04R1 changedSeaCells=0`.
* `WMP04R1_VENDOR_OK files=94 bytes=7062739`;
  `WMP04R1_VENDOR_TESTS_OK files=142 bytes=8752709`; both with per-file source commit,
  git blob SHA-1 and SHA-256 (`ASSET_PROVENANCE.json`, `TEST_PROVENANCE.json`).

### Live-HEAD drift (material finding)

After the pinned source was vendored, Gameplay / PR #44 advanced **10 commits** to
`1b98e806…` (2026-11-05 00:27 UTC, "Implement provisional Mjolnir combat and finite
acquisition"), changing `web/src/game/{engine,render,core,catalog,persist,sim}.ts` and
`web/src/ui/Game.tsx`. `f8fcde91` **is** an ancestor, but the newer head is a different
renderer/gameplay source. This pilot deliberately consumes the **exact pinned**
`f8fcde91` as instructed and does **not** claim to be based on the newer head.
**Rebase owner: GAMEPLAY.**

### Branch isolation (platform constraint, declared)

Arena binds this session to `arena/2e3cfbd2-soul-of-hero` and forbids creating,
switching to or pushing any other branch. A separate integration branch therefore could
not be created. All pilot work is isolated in the **self-contained new directory**
`wmp04r1-pilot/` on the session branch, with Gameplay `f8fcde91` vendored verbatim and
digest-verified. `git status` shows **only** `?? wmp04r1-pilot/` — no existing Map or
Gameplay file was modified, no history was rewritten, PR #44 was not edited,
force-pushed, merged or interrupted, and no `gh` PR operation was performed.
**Owner of this deviation: Arena platform policy / Control Tower.**

---

## 2. What was built

`web-baseline/` = verbatim Gameplay `f8fcde91` Web app (BEFORE build).
`web-pilot/` = same app + WMP-04R1 pilot. Source diff: **172 files byte-identical,
5 intentionally edited** (`src/App.tsx`, `src/game/world.ts`,
`src/game/veyra/projection.ts`, `src/ui/Game.tsx`, `src/ui/Title.tsx`), **2 added**
(`src/game/veyra/wmp04r1.ts`, `wmp04r1.generated.ts`), **0 missing**.

* The existing bounded Veyra projection was **extended**, not replaced, with
  `biomeEffective.r1`, `coldTransition.r1`, `marineRegion.v4`, `cliffCandidate.v3`,
  `heightClass.v3`, `waterClass`, and the WMP-01 `biomeCode` for QA BEFORE.
* Coastlines, lakes, rivers, roads (ferries excluded), POI footprints and LR02 solids
  still come from **authored GOLD polygons/centrelines evaluated at tile centres**. No
  low-resolution raster square replaced a coast, water body, building, physical portal
  or road centreline.
* **8 AU analytical cells** (250×175 = 43,750) remain distinct from **gameplay tiles**
  (200×200 = 40,000). `U=2` is **diagnostic, not an approved world scale**.
* Static geography and Gameplay authority are separate. Marine regions are **labels
  only**; `footOnSea = FORBIDDEN`, `cargoPassable` on sea `false`.
* WMP-01/02/03, GOLD, map feature IDs, legacy layouts and all existing SOH visuals are
  preserved. Legacy projection mappings are byte-for-byte unchanged → legacy map
  digests and save identities intact.
* **No new tileset.** `scrub_dry_steppe` reuses the existing `T.HILL` brown palette.
* No boat, Leviathan AI, helicopter flight, loot, fixed spawn reward, player-owned
  structure, weather damage, numeric climate/damage rate, POI relocation or Gameplay
  runtime authority change.

### Five accessible in-game creator scenes

Selector: 5 buttons on the Title screen and 5 buttons in the in-game `[P]` selector.
Every scene uses the original 640×360 renderer, original player, original camera and
real WASD/arrow input.

| # | Scene | Anchor | Real captures | WMP-04R1 content |
|---|---|---|---|---|
| 1 | Original SOH forest/coast | seeded legal spawn | `01_AFTER_wmp04r1-baseline-forest_{day,night}.png` | **Unchanged** baseline |
| 2 | Typhon–Argus snow highlands | `30,162` | `02_AFTER_wmp04r1-snow-highlands_{day,night}.png` | snow, restored rock, WMP-03 cliff faces, snow-pine/conifer vegetation, cold-transition classes |
| 3 | Oasis dry road/resource corridor | `176,58` | `03_AFTER_wmp04r1-oasis-corridor_{day,night}.png` | arid desert + dry-steppe transitions, `Bone Road Waystation` authored route |
| 4 | Cinder geothermal shoreline | `100,48` | `04_AFTER_wmp04r1-cinder-shore_{day,night}.png` | real GOLD water boundary, volcanic ground, cliffs, static Strait of Embers marine domain, **no invented damage** |
| 5 | Western Deathwater / Beacon Rock | `56,46` | `05_AFTER_wmp04r1-deathwater-beacon_{day,night}.png` | deep-water marine domain, `Beacon Rock Light` POI at the exact helicopter coordinate, **helicopter object PROVEN MISSING** |

**Honest finding:** WMP-04R1 changed **3,884** analytical cells — **3,094 → snow** and
**790 → scrub dry steppe** — and **zero sea-water cells**. None fall inside the canonical
Oasis `[400,840]` or Deathwater `[160,560]` windows. Their BEFORE/AFTER pairs therefore
correctly look identical. To still show the **actual dry regions**, a **QA-only**
diagnostic pair at AU `[1000,600]` (camera `69,97`) was added:
`wmp04r1-dry-transition` / `wmp04r1-before-dry-transition`
(`06_DIAG_dry-transition_AFTER.png`, `BEFORE_wmp04r1-dry-transition.png`,
`COMPARE_wmp04r1-dry-transition.png`, 10,720 changed diagnostic tiles). These two are
**not** part of the five creator scenes. No prettier mockup was substituted.

### Helicopter landmark — PROVEN MISSING

`marine_sites.v4.json` declares `poi_beacon_engine_out_helicopter` at AU `[272,652]`,
`GROUND_STATIONARY__ENGINE_FAILED`, `gameplayOwnership: … Gameplay machines/vehicles`.
Exhaustive `git grep` over Gameplay `f8fcde91` found **no helicopter/helipad/rotor/
rotorcraft/aircraft runtime sprite, entity, structure or machine** (only `web/ref/bible.md`
lore and a binary reference prototype zip). Existing `S.wreck` is a **Car Wreck** and
`roof_hull` is a ship hull. Neither was substituted. Scene 5 shows the exact location,
the authored `Beacon Rock Light` POI and a HUD `OBJECT PROVEN MISSING` label.
**Owner: GAMEPLAY machines/vehicles + A0/A3 custody + A8 interaction.**

---

## 3. Launch

```bash
cd wmp04r1-pilot/web-pilot
npm install
npm run dev -- --port 5174 --strictPort      # host 0.0.0.0; allowedHosts:true
# open https://<preview-host>:5174/

cd wmp04r1-pilot/web-baseline
npm install && npm run build
python3 -m http.server 5175 --bind 0.0.0.0 --directory dist
# open https://<preview-host>:5175/   (untouched Gameplay BEFORE build)
```

Direct scene URLs (also emitted by both selectors):

```
?pilot=<scene-id>&autostart=1&seed=20261104[&cam=tx,ty][&hours=0.2]
```

`hours=0.2` uses the real `qaAdvance` intent to reach night. First WASD keypress
releases the QA same-camera lock; the original player-following camera resumes.

Both live previews were running during QA: **port 5174 = pilot**, **port 5175 = original
SOH Web baseline**. Browser-facing code uses relative URLs only.

---

## 4. Build / browser / input / regression results

| Check | Result |
|---|---|
| `node tools/vendor.mjs` | `WMP04R1_VENDOR_OK files=94 bytes=7062739` |
| `node tools/vendor-tests.mjs` | `WMP04R1_VENDOR_TESTS_OK files=142 bytes=8752709` |
| `node tools/build-adapter.mjs` | `WMP04R1_ADAPTER_OK rasters=7 layouts=10 active=WMP-04R1 changedSeaCells=0` |
| `npx tsc --noEmit` (baseline / pilot) | **0 errors / 0 errors** |
| `npm run build` (baseline) | `dist/index.html 3,397.68 kB` ✓ |
| `npm run build` (pilot) | `dist/index.html 3,821.13 kB` ✓ (`vite-plugin-singlefile`) |
| `npm test` (baseline) | **28/28 files, 233/233 tests PASS** |
| `npm test` (pilot) | **28/28 files, 233/233 tests PASS** — **zero regressions** |
| Chromium | `153.0.8010.0`, headless, `--no-sandbox`, 640×360, DPR 1 |
| Real browser captures | **16** native 640×360 PNGs + **6** labelled 1280×400 comparisons |
| Console/page errors | **0** |
| Browser raster integrity | `ok=true` on all 10 WMP scenes, 7/7 SHA-256 digests |
| `node tools/verify.mjs` | **`WMP04R1_VERIFY_PASS checks=26 passed=26 failed=0`** |

### Input / camera / collision / save (all real, no teleport claim)

| Test | Result |
|---|---|
| Multi-key WASD journey (snow) | 108 position samples, 4.29 s, 144.5 px path, `nonWalkableSamples=0`, `seaSamples=0` |
| Sustained `KeyD` 2600 ms (dry diagnostic) | 184.8 px displacement, 185.3 px camera delta, `cameraFollowedPlayer=true`, `camLockReleased=true`, 0 sea / 0 non-walkable samples |
| In-game `[P]` selector | opens with `P`, **5** scene buttons, closes with `P` |
| Sea collision (Cinder) | player placed on dry land 4 tiles from real DEEP water (explicit diagnostic setup); walked **47.1 px**, stopped at `x=2699.36` before `seaBoundaryX=2704`, `seaSamples=0`, `blockedAtSea=true` |
| Autosave → reload → Continue | `recoveryScreenShown=false`, `runResumed=true`, `layoutPreserved=true`, `mapDigestPreserved=true` |
| Static no-walk-on-sea | all 10 WMP scenes: `walkableWater=0`, `cargoWater=0`, `buildableWater=0`, `roadOnWater=0` (8 inherited ferries excluded from road centrelines) |
| No fixed spawn reward / structure | all 10 WMP scenes: `entities=0`, `statics=0`, `buildings=0`, inventory exactly `knife×1, water_flask×1, berries×3` |
| Source identity | `sourceLayoutVersion=3`, `sourceMap.veyra.worldRevision=WMP-04R1`, `sourceMap.mapDigest` preserved across save/reload |

> The **untouched original `shipping_fresh`** world retains 3,194 shallow-water tiles
> with `walkable=1` — existing Gameplay behaviour, deliberately unchanged. The
> WMP-04R1 scenes enforce `footOnSea=FORBIDDEN`. Ferry cells are navigational
> suggestions, never foot permission.

---

## 5. Visual QA and BEFORE/AFTER comparisons

Every screenshot and comparison was opened and inspected directly. Full per-scene
assessment (material readability, height/cliff composition, forest density, water
boundaries, road legibility, POI scale, landmark identity, pixel-art coherence):
[`QA_VISUAL_ASSESSMENT.md`](QA_VISUAL_ASSESSMENT.md).

All **6** comparisons are **exactly same-camera** (`cameraDeltaPx = 0`):

| Comparison | Image | Verdict |
|---|---|---|
| original Gameplay Web → pilot scene 1 | `evidence/shots/COMPARE_baseline_original_vs_pilot.png` | Terrain, coast, forest density, HUD, quickbar and pixel-art coherence **identical**. Only seed-dependent weather (`cloudy` vs `clear`), rain particles and 2–3 creature positions differ. **Baseline not visually degraded.** |
| snow BEFORE → AFTER | `COMPARE_wmp04r1-snow-highlands.png` | **Dramatic genuine delta**: green forest/meadow → snow field, snow-pines, restored rock, WMP-03 cliff faces. Same rock/road positions prove identical camera. |
| oasis BEFORE → AFTER | `COMPARE_wmp04r1-oasis-corridor.png` | **Visually identical** — zero WMP-04R1 biome cells in this window. Honestly reported, not faked. |
| cinder BEFORE → AFTER | `COMPARE_wmp04r1-cinder-shore.png` | WMP-03 cliff faces + static geothermal marine annotation; **no biome change** (`changedSeaCells=0`). |
| deathwater BEFORE → AFTER | `COMPARE_wmp04r1-deathwater-beacon.png` | Static Western Deathwater marine annotation; **no biome/AI/damage change**. |
| QA dry BEFORE → AFTER | `COMPARE_wmp04r1-dry-transition.png` | **Genuine WMP-04 delta**: green meadow → brown dry steppe with the SAME authored road band. |

Day/night pairs exist for all five creator scenes; night uses the original SOH lighting
and weather presentation. No screenshot was retouched, upscaled or composited from
another renderer.

---

## 6. KEEP / REWORK / PROVEN MISSING

Full inventory with exhaustive evidence: [`ASSET_INVENTORY.md`](ASSET_INVENTORY.md).

* **KEEP** — original `shipping_fresh` forest/coast, `T.SNOW` + snow-pine art, `T.SAND`
  desert/palm/road art, `T.ASH` volcanic shore, `T.DEEP` waves, `Beacon Rock Light` POI,
  GOLD polygons/centrelines, original camera/character/input/weather/save, existing
  `T.HILL` palette reused for dry steppe.
* **REWORK** — WMP-03 cliff faces render as flat blocky dark-grey rectangles at 8 AU cell
  edges; night road/dry-steppe contrast; dense 9px QA HUD annotation; canonical Oasis /
  Deathwater windows contain no WMP-04R1 biome delta; `buildable` still consumed as a
  placement gate by `buildReason()`; POI entrance behaviour not instantiated.
* **PROVEN MISSING** — stranded helicopter scene object; boat/swim/ferry foot traversal;
  Leviathan AI; helicopter flight/repair/flight-log/salvage; production atlas & human art
  approval; numeric geothermal temperature / damage / weather-damage rates; full
  Gameplay semantic validator.

---

## 7. Blockers with exact owners (why `PARTIAL`, not `PASS`)

| # | Blocker | Exact owner | Consequence |
|---|---|---|---|
| B1 | Gameplay live HEAD / PR #44 advanced to `1b98e806…` (10 commits changing `engine.ts`, `render.ts`, `core.ts`, `sim.ts`, `Game.tsx`) after the pinned `f8fcde91` was consumed | **GAMEPLAY** (PR #44 author) | Pilot is based on the exact pinned source, not the current live head. A rebase is required before any integration discussion. |
| B2 | `approvedTraversal.status = UNKNOWN`; `boatOrSwimPermission = UNRESOLVED_GAMEPLAY`; `activeCollisionPermission = false`; `candidateEconomyMap = CANDIDATE_ONLY__NEEDS_GAMEPLAY_REVIEW`; `validateGeographicHandoff()` / `validateEconomyMap()` / `compileEconomy()` / `diagnoseStarts()` not executed as Gameplay intake validators (WMP-03 `gameplayValidatorsExecuted=false`) | **GAMEPLAY** (intake review) | A **complete** Gameplay semantic validator cannot pass. The pilot did **not** weaken validation to hide this; it reports 26 independent technical checks and the 233/233 pinned Web suite instead. |
| B3 | POI entrance/door/frontage collision is not instantiated in the existing Web Veyra projection (`statics=[]`, `buildings=[]`); `buildable` Map zone candidacy is consumed by `buildReason()` as a placement gate | **GAMEPLAY** (static architecture runtime ingestion + placement semantics) | Genuine sea/cliff collision is proven; POI entrance behaviour and road/cargo/buildable permission separation remain unverified. Not silently converted into permission by this pilot — the pre-existing behaviour was preserved unchanged. |
| B4 | No legitimate helicopter/rotorcraft scene object exists in Gameplay `f8fcde91`; no production atlas or human art approval; Arena forbids creating a separate integration branch | **GAMEPLAY machines/vehicles + A0/A3/A8**; **Control Tower / creator**; **Arena platform** | Scene 5 reports `PROVEN MISSING` instead of fabricating. Work is isolated in `wmp04r1-pilot/` on the session branch rather than a new branch. |
| B5 | WMP-03 cliff/height composition reads as flat blocky rectangles at U=2 | **GAMEPLAY art / WMP-03 geometry intake** | Visual REWORK; `productionAtlas = NOT_AUTHORIZED`, so no new tileset was created. |

---

## 8. Explicit non-claims

No merge. No production integration. No full Veyra playability. No world-master sealing.
No human art / visual approval. No completed gameplay. No `WORLD_MASTER_SEALED`,
`VEYRA_PLAYABLE`, `VISUAL_ACCEPTED` or `MERGE_READY`. No PR #44 comment posted for this
pilot (the earlier WMP-02 `6625676255` and WMP-03 `6627661853` comments remain the only
posted comments and were not duplicated). No owner branch was edited, force-pushed,
merged or interrupted.

## 9. One-line reproduction

```bash
cd wmp04r1-pilot && node tools/verify.mjs   # WMP04R1_VERIFY_PASS checks=26 passed=26 failed=0
```

Open `https://<preview-host>:5174/` (pilot) and `https://<preview-host>:5175/`
(untouched original), press `[P]` for the five scenes, and compare
`evidence/shots/COMPARE_*.png`.
