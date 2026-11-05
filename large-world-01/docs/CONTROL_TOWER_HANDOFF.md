# LW-01 — Control Tower Handoff
## Runnable Soul of Hero Web large-world / streaming pilot

**Status:** bounded pilot **complete and independently reviewable**. This is a
pilot stop, **not** completion of the production Gameplay program. One final
handoff only.

| Field | Value |
|---|---|
| **Exact code SHA** | `38d13514d20b089b6fcbf0fa78d605086c50385c` (commit `LW-01: runnable large-world/streaming pilot (WMP-04R1, U=1 Veyra + 2,000x2,000 capacity)`) |
| Handoff document commit | added immediately after the code commit; final branch head is reported in the Control Tower delivery message |
| Branch (Arena-pinned, `active`) | `arena/2e3cfbd2-soul-of-hero` |
| Branch at start | `f0c2182bd2ec5e067f5c59cf3985dcf71856cdb1` |
| Remote Map head at handoff | `f0c2182bd2ec5e067f5c59cf3985dcf71856cdb1` (unchanged) |
| `main` | `5214788933b1a827f3a177d11ff486433dfe5e8a` (untouched) |
| PR44 base | `arena/4795760e-soul-of-hero` @ `8421b9c3335c7648488ce8ae5dab43eb5787977e` (untouched) |
| Vendored Gameplay SHA (pinned for this pilot) | `e11a9b4471a0832cd6d039b5510725b10ee0275c` |
| **Live Gameplay / PR44 head at handoff (DRIFT)** | `b5c8004ca4e77be62484fb3cd296fe296d7de4c9`, PR44 `OPEN`/`DRAFT`, `updatedAt 2026-11-05T02:16:08Z` |
| Active Map authority | `veyra-world-master/CURRENT_WORLD_MASTER.json` → `WMP-04R1`, `v4/r1/manifest.r1.json`, `api/current.mjs` |
| Isolated tree | `large-world-01/` — no isolated branch, no merge, no force-push, no rewrite of Map/GOLD/PR44/work |

> **10× LINEAR is 100× CELLS**, not 10× area: 200×200 = 40,000; 2,000×2,000 =
> 4,000,000. The authored WMP-04R1 Veyra frame at **U=1 is 2,000×1,400 =
> 2,800,000 cells and is NOT square**. No 600 rows of fabricated explorable land
> are added, and no full 2,000×2,000 Veyra geography is asserted. There is **no
> approved final U**.

---

## 1. Branch deviation, refs and drift (re-verified before handoff)

Arena pins this session to `arena/2e3cfbd2-soul-of-hero` and forbids isolated
branches, so **all LW-01 work lives in the new isolated `large-world-01/` tree** on
that pinned branch. No Map/GOLD/`main`/PR44 branch was switched to, created,
merged, force-pushed or rewritten. `origin/gp-current` was used only as a
read-only fetch ref for `e11a9b44`.

**Gameplay drift discovered at handoff:** the pinned vendored Gameplay
`e11a9b44…` is no longer PR44's head. Four new commits exist on
`arena/d4bfcfff-soul-of-hero`:

```
b5c8004c Connect salvage fuel, finite trade and generator capacity
4d2a9bbf Reject Spirit landings near lethal terrain
b1072835 Compose WMP04R1 diagnostics and extend Spirit evidence
65df55b7 Make Spirit transit respect perception and interruption
```

`git diff --stat e11a9b44..b5c8004c -- web/src web/tests`: **24 files, +2,063 /
−97**, including `web/src/game/veyra/wmp04r1.ts`,
`wmp04r1.generated.ts`, `projection.ts`, `engine.ts`, `persist.ts`, `render.ts`,
`sim.ts`, `world.ts`, `Game.tsx`, `Title.tsx`, `panels.tsx` and new
`wmp04r1-current` / `v17-*` tests. Gameplay has therefore added **its own**
WMP-04R1 projection after this pilot vendored `e11a9b44`. Nothing in this pilot
silently discards those commits; they remain on their owner branch. All LW-01
verdicts are explicitly scoped to the pinned `e11a9b44` copy. Re-vendoring
against `b5c8004c` is a named blocker below, **not** a hidden integration.

The prior `wmp04r1-pilot/` visual pilot derives from older Gameplay
`f8fcde910c330aa953dd5c65b80a51792945d35e` and is **not** this integration.

---

## 2. Launch, commands and real input

```bash
cd large-world-01/web-large  && npm install && npm run dev -- --port 5180 --strictPort   # LW-01 pilot
cd large-world-01/web-legacy && npm install && npm run dev -- --port 5181 --strictPort   # 200×200 baseline
```

* Arena **live preview: port 5180** = LW-01 pilot, **port 5181** = verbatim
  200×200 baseline. Both bind `0.0.0.0` with `allowedHosts: true`.
* Local equivalent: `http://localhost:5180/` / `http://localhost:5181/`.
* Direct reproducible entry (all switches are QA, not gameplay):

```
http://localhost:5180/?profile=veyra-u1&scene=beacon&seed=20261105&hours=0.08&autostart=1&hud=0&fresh=1
```

`profile` = `capacity-2000x2000` (synthetic, NON-CANON) · `veyra-u2` ·
`veyra-u1` · `beacon-u05`; `scene` = `beacon` · `village` · `snow` · `shore` ·
`westmouth`; `hours=0.08` ≈ midday, `hours=0.32` ≈ deep night (flagged
`QA·LOCAL`); `hud=1` turns on the dev HUD; `fresh=1` ignores an LW-01 save;
**`cam=tx,ty` is QA fast scene selection only, never a walked journey**.
Remove `fresh=1` and reload to resume the saved global coordinate.

| Key | Action |
|---|---|
| `W A S D` / arrows | **real** WASD movement; `TILE=16`, `VIEW=640×360`, `BAL.player.speed=72` px/s, `BAL.terrainSpeed` unchanged — no speed hack, no enlarged pixel art, no game-time-rate hack |
| `F3` | developer HUD toggle (**OFF by default**) |
| `F9` | save `soh.lw01.save.v1`; reports legacy-save preservation |
| `H` / `J` | **QA-only** harvest / place state fixtures. Production interaction range is NOT implemented (see §7) |
| `1`–`8`, `Esc` | quickbar slots, menu / save & title |

Dev HUD exposes active profile + U + cell count, exact source revision and
Map/Gameplay heads, global tile + linear index, chunk/local coords, loaded
chunks, loads/unloads, resident layer bytes, render-canvas bytes, JS heap, frame
p50/p95/max, save bytes, walked px, chunk boundaries, active/distant creatures
and deferred events.

---

## 3. Comparative screenshots (real Chromium, 640×360, DPR 1, 0 browser errors)

All 16 captures are in `evidence/shots/`; per-capture metadata (profile, U,
global tile, camera, weather, day/night, metrics, full `inspect()`) is in
`evidence/qa-report.json`. No capture is composited, upscaled or substituted.

| File | What it shows |
|---|---|
| `baseline_legacy_200x200.png` | verbatim current-Gameplay 200×200 baseline, started through the real Title → New run → Begin flow |
| `veyra_u1_beacon_day.png` / `veyra_u1_beacon_night.png` | same U=1 Beacon tile (272,652), real SOH day/night lighting (`hours=0.08` vs `0.32`) |
| `veyra_u1_village_road.png` | mainland village / cart road / river at AU [1002,730], `po_mill`, authored GOLD road centreline sampled at 1 AU, SOH oak/bush art |
| `veyra_u1_snowy_rocky.png` | WMP-04R1 snow + **restored rock (510 cells)** boundary at AU [640,320], snowpine art |
| `veyra_u1_sea_shore.png` | Cinder geothermal sea / shore, real GOLD coastline (no square 8-AU outline), static marine region |
| `veyra_u1_westmouth.png` | Westmouth shore & port, river, forest, sand, `po_westmouth` |
| `beacon_veyra_u2.png`, `beacon_veyra_u1.png`, `beacon_beacon_u05.png` | **same authored AU [272,652]** at U=2 / U=1 / U=0.5 |
| `capacity_2000x2000.png` | 2,000×2,000 synthetic NON-CANON capacity fixture with dev HUD |
| `dev_hud_on.png` | F3 HUD toggled on; `off.dom=false`, `on.dom=true` |
| `journey_start.png`, `journey_far.png`, `journey_return.png`, `relaunch_at_global_coord.png` | real WASD 3-boundary out-and-back + save/relaunch |

**Scenes without new geography are reported unchanged, not faked.** Beacon at
U=1 shows the authored island/shore/dock/POI label; the **helicopter object is
`PROVEN_MISSING`** — the capture carries an on-screen honest label
"HELICOPTER OBJECT PROVEN MISSING / authored AU [272,652] only / owner: Gameplay
machines / vehicles". No lighthouse/dock/helicopter sprite was invented. Source
density comes from deterministic 1-AU instancing **inside authored GOLD
resource areas** (`r`, `dens`) reusing the existing `art.ts` sprites; no new
POIs, loot tables, prices or Gameplay legality were minted.

**C1 — equal native camera/player size** (`evidence/qa-report.json`, measured
from the live module graph in both browsers): `TILE=16`, `VIEW_W=640`,
`VIEW_H=360`, `playerSpeed=72`, `dayLengthMinutes=24`, hero sprite `16×24`
— **identical**. `core.ts`, `art.ts` and `map-package.ts` are SHA-identical
between `web-legacy/` and `web-large/`. No enlarged pixel art, no global speed
hack.

---

## 4. U=1 spatial profile and 2,000×2,000 capacity proof

| Profile | Kind | Runtime tiles | Cells | U | Note |
|---|---|---|---|---|---|
| `capacity-2000x2000` | `CAPACITY_FIXTURE` | 2,000×2,000 | **4,000,000** | 1 | deterministic synthetic terrain, explicitly **NOT Veyra canon**, not explorable authored land |
| `veyra-u2` | `AUTHORED_VEYRA` | 1,000×700 | 700,000 | 2 | prior diagnostic, **not** an approved final scale |
| `veyra-u1` | `AUTHORED_VEYRA` | **2,000×1,400** | **2,800,000** | 1 | **primary candidate**, full authored frame, no padded rows |
| `beacon-u05` | `AUTHORED_VEYRA` | 4,000×2,800 | 11,200,000 | 0.5 | **bounded Beacon-only triage**; full traversal/streaming **NOT claimed** |

**U=1 spatial profile:** GOLD authoring frame 2,000×1,400 AU; 8-AU analysis
raster 250×175 is **analysis data only**, never a runtime tile. Coastline,
lakes, rivers, road centrelines, POI footprints, zone rings and resource areas
are evaluated at the exact 1-AU tile centre with a dithered biome boundary; no
nearest-neighbour 8-AU square land. WMP-04R1 effective biome
(`dryLandCells=14392`, `snowAfter=3311`, `rockAfter=510`,
`snowAtY610Plus=0`, `changedSeaWaterCells=0`) and WMP-03 physical overlays are
sampled from the 21 pinned rasters. GOLD stats: `land=8, lakes=5, rivers=17,
roads=92, bridges=12, docks=27, pois=81, zones=23, resources=280, spawns=4,
elders=6`.

**2,000×2,000 engine capacity (`evidence/qa-report.json` → `capacity`):**
exhaustive `verifyAllChunkKeys()` over `63×63 = 3,969` chunks →
`uniqueKeys=3969`, `collisions=0`. `verifyRenderChunkKeys()` on the original
16-tile renderer cache (`125×88 = 11,000` display chunks) finds
**2,175 real in-frame `cy*100+cx` collisions** and **0** collisions for the new
profile-scoped `profileId|cx:cy` string key. Residency is bounded:
`resident=25` chunks, `residentBytes=128,000`, `peakResident=25`,
`loads=25`, `unloads=0` — **no 4,000,000-cell synchronized copy**. The synthetic
fixture is labelled NON-CANON in the HUD, profile metadata, test suite and this
document.

---

## 5. Beacon triage — evidence, not a canon change

Same GOLD source coordinate **AU [272,652]** (`po_beacon`, Beacon Rock Light;
helicopter landmark `poi_beacon_engine_out_helicopter` at AU [272,652]),
same 640×360 camera and 16×24 hero:

| U | Profile | Tile of the same AU | Global linear index | Capture |
|---|---|---|---|---|
| 2 | 1,000×700 | `(136,326)` | `326136` | `beacon_veyra_u2.png` — whole authored island fits one screen |
| 1 | 2,000×1,400 | `(272,652)` | `1304272` | `beacon_veyra_u1.png` — partial island + authored road |
| 0.5 | 4,000×2,800 (bounded) | `(544,1304)` | `5216544` | `beacon_beacon_u05.png` — only a fraction of the island visible |

Expected and actual tiles match exactly for all three. Beacon at U=1 is only
~35×40 tiles, so **a global U=1 change alone is NOT proof of satisfactory
island composition**. The alternative — a **separate Beacon redesign** while the
rest of Veyra keeps another scale — is presented here as an **evidence option
for the Creator**, not as an adopted canon change. `visualAssessment =
CREATOR_DECISION_PENDING` on every row; `finalU = NOT_APPROVED`,
`visualApproval = NOT_REQUESTED`, `productionAtlas = NOT_AUTHORIZED`.

---

## 6. Architecture, memory, frames, save, source IDs, negatives

**Architecture (real re-architecture, not a constant change).**
`web-large/src/game/large/`:

* `profile.ts` — explicit dimension profiles/scenes/source identity; no global WW/WH.
* `coords.ts` — stable world-space tiles, `chunkX/chunkY/localX/localY`,
  `index(p,x,y)` with **profile stride**, `inFrame`, floor-division negative
  coords, `profileId|cx:cy` collision-free key, `verifyNoAliasing()`,
  `verifyAllChunkKeys()`, `verifyRenderChunkKeys()`.
* `geometry.ts` — GOLD polygon/centreline/point sampling at tile centres +
  typed permission boundary (`boat/swim/ferryFoot/build = false`,
  `gameplayAuthority = GAMEPLAY_ONLY__NOT_APPROVED`).
* `chunk.ts` — `ChunkStore`: per-chunk `Uint8Array` layers
  (`tiles/biome/foot/flags/elevation`), LRU residency, deterministic
  source/POI IDs, real load/unload accounting, bounded 5×5 active sim set.
  **Not** just a `renderChunk()` canvas cache.
* `state.ts` — `DurableStore`: world-global idempotent harvest/place/grant/
  transaction/monster/ownership/trace, versioned `soh.lw01.save.v1`, bounded
  causal offline catch-up, read-only legacy-save inspection at the **real**
  Gameplay key `soh.state.v3`.
* `sim.ts` — `ActiveSim`: only active-set creatures are instantiated/ticked;
  distant monster state is durable and reattaches when its chunk re-enters.
* `compat.ts` — chunk-backed `effTile/sourceAt/entsAt/...` for the patched
  renderer; cache misses fall back to deterministic authored geometry so a
  streaming boundary can never paint a false sea. Exact SOH time/weather
  formulas, unchanged rates.
* `runtime.ts` — `LargeWorldRuntime`: real WASD, camera/collision in global
  coords, chunk-boundary log, frame/heap/memory/save metrics, `setCellCap`,
  offline catch-up on resume.
* `validate.ts` — **additive**, exact profile-aware package validator; the
  legacy `map-package.ts` validator is byte-identical and NOT weakened.

`render.ts` is patched to `LW.w/LW.h` + `chunkKey()` + a **bounded 200×140
minimap** (the original allocated one canvas pixel per world tile — 2.8M pixels
for U=1). `world-economy.ts` exposes `setCellCap(w,h)` with the legacy
1,000,000 default unchanged. `App.tsx` / `ui/Title.tsx` / `ui/GameLarge.tsx`
provide the launch, profile/scene selector, real input loop, original SOH HUD
and the F3 dev HUD. `web-legacy/` is **never patched**
(`render.ts` still contains `cy * 100 + cx`).

**Measured metrics (real journey, `evidence/qa-report.json` → `journey` / `metrics`).**

| Measure | Value |
|---|---|
| Frames measured | `1,200` (rolling), `dtP50=16.7 ms`, `dtP95=16.8 ms` |
| Frame work p50 / p95 / max | `1.1 ms` / `1.9 ms` / `62.2 ms` (max = first chunk materialization) |
| JS heap (`performance.memory`) | `36,567,451 B` ≈ 34.9 MB (limit 2,166,358,016 B) |
| Resident typed layers | `128,000 B` = 25 × 32×32 × 5 bytes |
| Render presentation cache | `5,242,880 B` = 20 × 256×256×4 |
| Peak active chunks | `30` (steady sim set `25`) |
| Loads / unloads / evictions | `55` / `30` / `0` |
| Materialize work | `753.7 ms` total, `22.8 ms` max per chunk |
| Save size | `1,932 B` (`soh.lw01.save.v1`) vs legacy `soh.state.v3` `52,812 B` |
| Walked | `3,299.9 px` in `46,632 ms` → `4.42` physically-walked tiles/s |
| **Neutral-terrain theoretical** | `222.22 s / 1,000 tiles` (1000×16 / 72) |
| **Physically walked valid route** | `226.24 s / 1,000 tiles` (extrapolated from the real out-and-back) |

Reported separately: the theoretical figure assumes flat neutral terrain with
no collision/terrain modifiers; the physical figure is from real WASD on a
collision-resolved authored route. **No unmeasured "60 FPS" claim is made** —
only measured `dtP50/dtP95` and frame p50/p95 are reported.

**World-global durable IDs & save.** Pre-save records:
`source:fish:rs_5k@340,559#329,558`, `struct:claim:353,556`,
`monster:qa-distant-boar` (distant chunk `veyra-u1|31:22`),
`ownership:qa-home`, `trace:qa-trace`, `txn:qa-txn` — each with a unique receipt.
After a **real** 3-boundary out-and-back that unloads/reloads the start chunk,
then `F9` save and full page relaunch: `tile=(352,556)` preserved,
`stableIds=true`, `duplicateReceipts=0`, `saveErrors=[]`, inventory identical,
`durableKinds = [monster, ownership, source, struct, trace, txn]`. The legacy
200×200 `soh.state.v3` fixture was **byte-identical** after all operations
(`byteIdentical=true`). Offline catch-up on resume:
`wallElapsedMs=643`, `processed=0`, `deferred=2`, `truncated=0`, `cap=5000`,
policy `CAUSAL_BOUNDED_BATCH__NO_60FPS_REPLAY`; explicit `catchUp(120000)`
processed `2`, `truncated=0`. Distant monster: `distantCreatureCount=1`,
`tickedCreatures=0` → persisted but **not instantiated/run every frame**.

**Real WASD journey (no teleport in lieu of route).** Start = authored
Westmouth anchor `(352,556)`; a legality snap moves the spawn only when the
authored anchor is not foot-legal (here `tilesMoved=0`; village/shore anchors
required `6`/`27` tile snaps, recorded in `inspect().spawn`). Walked
`S` to `(352,560)`, then **`D` east across `384 → 416 → 448`** (three
consecutive 32-tile chunk boundaries) to `(452,560)`, then **`A` west** back
across `448 → 416 → 384`, then `W` to `(352,556)`. `chunkBoundaryLog` has
**6** entries, `consecutiveEastwardBoundaries=3`, `teleportUsed=false`,
`camUsedAsRoute=false`. Source IDs, POIs, water, elevation, art and weather did
not pop or reset; `loads=55` / `unloads=30` prove real unload/reload.

**Negative fixtures (14/14 PASS, `evidence/qa-report.json` → `negatives`):**
`LW-N01` 4,004-probe chunk uniqueness; `LW-N01b` exhaustive all-chunk key
uniqueness; `LW-N02` legacy 100-stride arithmetic alias; `LW-N02b` **2,175 real
in-frame render-cache collisions** with 0 new-key collisions; `LW-N03`
negative coords/frame edges; `LW-N04` no wrong-stride/cross-chunk index
aliasing; `LW-N05` no land-walk on sea; `LW-N06` no ferry foot permission;
`LW-N07` no default walkability on cliffs/blocked crossings; `LW-N08` no bogus
buildable grants; `LW-N09` no beach/land duplication (inland water is `RIVER`,
ocean is `SHALLOW/DEEP`); `LW-N10` no duplicate source grant; `LW-N11` no
duplicate loot grant; `LW-N12` no duplicate transaction receipt.
All 25 resident `validateChunkPackage()` results have `errors=[]`. No validator
was weakened: `map-package.ts` is byte-identical and all 257 legacy tests pass.

**Reproducible tests / commands.**

```bash
node tools/vendor.mjs                 # LW01_VENDOR_OK files=39 bytes=1675828 legacyFiles=803
node tools/build-sources.mjs          # LW01_BUILD_SOURCES_OK rasters=21 goldLand=8 goldPois=81 goldRoads=92
LW_SRC=/tmp/clean/src/game node tools/patch-engine.mjs   # byte-identical patch on a fresh verbatim tree
cd web-large  && npx tsc --noEmit && npm test && npm run build
cd web-legacy && npx tsc --noEmit && npm test && npm run build
LW_CHROMIUM=/tmp/chromium LD_LIBRARY_PATH=/tmp/al2023/lib node tools/qa-browser.mjs
node tools/verify.mjs
```

`evidence/build.log`: both trees `TSC_OK`; **web-large 35 files / 274 tests**,
**web-legacy 34 files / 257 tests**, both `✓ built`
(`15,099.38 kB` / `16,668.30 kB` single-file). New suite
`web-large/tests/lw01-large-world.test.ts` = 17 tests. Browser QA:
`LW01_QA_CAPTURES scenes=16 comparisons=3 browserErrors=0 boundaries=6
negFail=0`. Verifier: `LW01_VERIFY_PASS checks=38 passed=38 failed=0`
(`evidence/verification.json` contains per-check evidence and exact per-file
SHA-256 digests).

---

## 7. Gate verdicts and stop condition

| Gate | Verdict | Exact evidence |
|---|---|---|
| **LW-G0** source custody | **PASS** | 39 files / 1,675,828 B with matching SHA-256, WMP-04R1 active manifest, pinned `f0c2182b` + `e11a9b44`, 803 verbatim legacy files, retired WMP-04/WMP-03-standalone/raw-GOLD never substituted |
| **LW-G1** engine capacity | **PASS** | 4,000,000 cells, 3,969 unique chunk keys, 2,175 in-frame legacy-key collisions vs 0 new, 25-chunk bounded residency / 128,000 B, no WW/WH or `cy*100+cx` in new renderer, verbatim legacy preserved |
| **LW-G2** geographic continuity | **PARTIAL** | PASS: 5 authored scenes + day/night, real WASD 3 consecutive boundaries away/back, 14/14 negatives, exact chunk packages, 1-AU GOLD sampling, honest missing helicopter. **BLOCKED:** full-world traversal, Gameplay semantic validators/traversal/collision permission, marine/boat/ferry law, helicopter object |
| **LW-G3** player/world state | **PARTIAL** | PASS in bounded pilot: world-global IDs, versioned save, idempotent grants, offline catch-up, bounded sim, legacy-save preservation. **BLOCKED:** production Gameplay inventory/transactions/traces/monsters/ownership integration, interaction range, real harvest economy, full offline drains. `VEYRA_PLAYABLE` is **not** claimed |
| **LW-G4** scale decision evidence | **PASS (evidence only)** | same Beacon AU at U=2/1/0.5, exact transforms, equal native camera/player, bounded U=0.5. **No approved final U; Creator visual decision pending** |
| **LW-G5** regression / QA | **PASS** | 274+257 tests, both builds, 16 real 640×360 captures, 0 browser errors, measured frame/heap/save metrics, HUD off by default, no weakened validator |

**Full pilot stop condition: `PASS`** — scope
`BOUNDED LW-01 SCALE/STREAMING PILOT ONLY`. Success criterion met: the Creator
can control a real SOH character through a visibly larger contiguous Veyra, see
Beacon scale differences, and Control Tower can independently verify
chunk/memory/save behaviour. **This is NOT the entire production Gameplay
program complete.** Not claimed: `VEYRA_PLAYABLE`, `VISUAL_ACCEPTED`,
`MERGE_READY`, `WORLD_MASTER_SEALED`, production art approval, complete Veyra
gameplay, approved final U, sustained 60 FPS.

---

## 8. Exact blockers — owner + ONE Control Tower action each

| # | Owner | Exact blocker | One Control Tower action |
|---|---|---|---|
| B1 | **Gameplay** | HEAD drift `e11a9b44` → `b5c8004c` (4 commits, 24 files) added Gameplay's own `wmp04r1.ts` / `wmp04r1.generated.ts` / `projection.ts` and changed `render.ts`, `engine.ts`, `persist.ts`, `sim.ts`, `world.ts`, `Game.tsx`. LW-01's reproducible patch is pinned to `e11a9b44`. | Authorize one re-vendor + patch-revalidation against `b5c8004c` on a fresh isolated Gameplay-derived worktree; do **not** merge or overwrite PR44. |
| B2 | **Gameplay** | `validateGeographicHandoff()` / `validateEconomyMap()` / `compileEconomy()` / `diagnoseStarts()` runtime ingestion and `approvedTraversal.status = UNKNOWN` remain unresolved; `footPassableOnSea=false`, `activeCollisionPermission=false`, `boatOrSwimPermission=UNRESOLVED_GAMEPLAY`, `cargoPassable` assumptions. | Request a Gameplay-owned native traversal/collision/permission verdict for the U=1 candidate; keep Map candidate rasters as candidates only. |
| B3 | **Gameplay** | Production inventory, transactions, traces, monster AI, ownership/homes, loot economy, offline drain rates and player→source **interaction range** are not integrated. `H`/`J` are QA state fixtures (nearest source was 23.09 tiles away, `interactionRangeImplemented=false`). | Commission a Gameplay integration ticket that replaces QA probes with real intent dispatch + world-global receipt IDs, reusing `DurableStore` semantics. |
| B4 | **Gameplay** | Helicopter / helipad object at AU [272,652] `PROVEN_MISSING`; no repair/flight/loot, no Leviathan AI, no boat/swim/ferry foot permission. | Ask Gameplay to confirm machine/vehicle asset ownership and whether the Beacon helicopter is in scope; keep the honest missing-object label until then. |
| B5 | **Map** | WMP-04R1 status `MAP_GEO_R1_CORRECTED__GAMEPLAY_INTAKE_PENDING`; POI entrance/buildable semantics, marine sites (static), `noStartingLootGrant`, `repairFlightStatus=NOT_APPROVED`, `spawnAndAiOwner=GAMEPLAY`, `lootRewards=UNDECIDED`; no `WORLD_MASTER_SEALED`. | Request Map Lead confirmation that the 39 vendored files / digests are the exact active authority and publish the intake decision; do not seal or mint Gameplay law. |
| B6 | **Creator** | No approved final U; Beacon at U=1 is ~35×40 tiles and global U=1 alone does not prove satisfactory island composition; `creatorVisualApproval=NOT_REQUESTED`, `productionAtlas=NOT_AUTHORIZED`. | Put one decision to the Creator: accept **global U=1**, request a **separate Beacon redesign**, or keep the scale question open — using the three labelled captures. No silent canon change. |
| B7 | **Control Tower / Arena** | Branch isolation: Arena pins `arena/2e3cfbd2-soul-of-hero`; no isolated LW-01 branch based on live Gameplay was permitted, so work is in `large-world-01/`. PR44 comments are not new Map authorization. | If integration is to proceed, authorize an isolated branch based on `b5c8004c` (or explicitly accept the isolated-tree deviation) before any PR. |

**Explicitly out of scope / not done:** automatic merge, `main` edits, production
tilesets/atlases, other-island redesign, marine travel invention, player-speed
or game-time-rate hacks, 2,000×2,000 Veyra geography padding, full-world
traversal claim, `VEYRA_PLAYABLE` / `VISUAL_ACCEPTED` / `MERGE_READY` labels.

---

## 9. Evidence index

`SOURCE_PROVENANCE.json` · `map-data/GENERATED_META.json` ·
`evidence/build.log` · `evidence/qa-report.json` ·
`evidence/verification.json` · `evidence/shots/*.png` (16) ·
`web-large/tests/lw01-large-world.test.ts` · `README.md` · this handoff.

`LW01_VERIFY_PASS checks=38 passed=38 failed=0`. All verdicts are reproducible
from the commands in §6 against the exact code SHA at the top of this document.
