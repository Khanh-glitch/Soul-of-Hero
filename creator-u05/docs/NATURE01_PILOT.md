# NATURE-01 — REAL WORLD ECOLOGY PILOT (five-biome, decorative, toggleable)

**Status:** independently reviewable pilot. **NOT** visual acceptance, **NOT** production
art, **NOT** full-world propagation, **NOT** POI architecture, **NOT** a production
merge, **NOT** `VEYRA_PLAYABLE`.

**Branch:** `arena/2e3cfbd2-soul-of-hero`
**Verified Map HEAD at pilot start / source SHA:** `b327e8049607791567defaf24bb6c6afc0871c84`
**Delivery commit (this pilot):** `5245f30dd9ce429d002f450f1ea81d0a7edb224e`
**Full source SHA / links record:** `creator-u05/evidence/nature01-delivery.json`
**Gameplay HEAD verified:** `5b3e683402bbc8540dea9404576164097e753f97`
(`Publish standalone M1-M4 gameplay build`); `web/src/game/art.ts` is unchanged
between the vendored pin `b5c8004c…` and that HEAD.

**Source-custody observation during this pilot:** the live Gameplay branch later
advanced to `2f0836587b76a4a98fffedf8c202fb37cbb2a67c` (*Implement provisional
territory cabinet upkeep*). `git diff 5b3e683…2f083658 -- web/src/game/art.ts`
shows **exactly one** change: `S.claim`, a structure sprite **not used** by
NATURE-01; `buildSources()` (all 12 nature sprites) is untouched. We did **not**
re-vendor, silently sync, or adopt that head: this pilot stays pinned to the
Creator-verified `5b3e683…` / `b5c8004c…` source, and the standing verification
packet is preserved. The drift is disclosed in
`evidence/source-custody.json → nature01Disclosure`.

---

## 1. Deliverable — a NEW file, not a modified baseline

| File | Bytes | SHA-256 |
|---|---:|---|
| `creator-u05/SoulOfHero_TerrainOnly_U05_x10.html` (**untouched baseline**) | 1 407 498 | `540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0` |
| `creator-u05/SoulOfHero_Nature01_U05.html` (**new pilot**) | 1 427 241 | `ac4d54e310f0f3cf7e0e12d728bc5e9ad62f801994be37ce64f76b099af4a0a7` |
| `creator-u05/SoulOfHero_Nature01_U05.zip` (forced-download mirror) | 127 215 | — |

The build script **asserts the baseline SHA-256 before writing anything**
(`U05_NATURE01_BASELINE_MODIFIED` otherwise). The terrain-only executable, its
`src/terrain-only/*`, `src/u05/terrain.ts` (verbatim PAL/PRIO/texel
`f29c1a68…`), `src/u05/world.ts` (despeckle) and all 21 WMP-04R1 rasters are
unchanged. Only additive files were created, plus `tsconfig.u05.json` include and
`.gitignore` entries for the new Vite outDir.

**Play / download (live preview, port 5183):**
- `/nature01` — playable pilot
- `/nature01-download` — forced `Content-Disposition: attachment`
- `/` — the untouched terrain-only baseline (unchanged)
- `/download` — the untouched baseline download (unchanged)

**GitHub (branch-pinned raw):** `https://github.com/Khanh-glitch/Soul-of-Hero/raw/refs/heads/arena/2e3cfbd2-soul-of-hero/creator-u05/SoulOfHero_Nature01_U05.html`

---

## 2. Non-negotiable contract (unchanged)

`U = 0.5 AU/tile`, `TILE = 16 px`, camera **640×360 @ 1× DPR 1**, hero **16×24**,
base **72 px/s**, viewer multiplier **x1…x10 = 72…720 px/s** (viewer control, NOT a
Gameplay law), frame **4000×2800 tiles = 11 200 000 addressable cells**, never
materialised. Real WASD / arrow keys; no camera trick, no route teleport. `Z`
whole-map zoom, `F` follow modes, `L` native 1× lens, `C` optional natural-terrain
collision and `H`/`R` from the baseline all still work.

**New key:** `N` toggles the nature layer OFF/ON. Buttons `01…05` (or `Digit1…5`)
jump the *viewer spawn* to one of the five pilot windows; these are viewer spawn
controls, **not** a teleport/route claim.

With **N = OFF**, the native canvas is **pixel-identical** to the untouched
terrain baseline (proved at 6 positions by exact PNG SHA-256 comparison,
`N-G1`). With **N = ON**, the only added pixels are decorative natural sprites.

---

## 3. Source entities — decorative or Gameplay-owned? (explicit answer)

| Question | Answer |
|---|---|
| Are NATURE-01 trees / rocks / plants harvestable resources? | **NO.** |
| Are they Gameplay-owned entities? | **NO.** `decorativeOnly: true`, `gameplayOwned: false` on every object. |
| Do they have stock / depletion / regrow / yields / rewards / ownership / interaction? | **NO.** None of those fields or systems exist in this pilot. |
| Do they collide or block movement? | **NO.** `blocksMovement: false`; `canStand()` is untouched; `FREE_ROAM__NO_COLLISION` unchanged. |
| Did we mint new art or a new atlas? | **NO.** 12 pre-existing `getArt().src` arrays only; `newArtAssets: 0`, `newAtlases: 0`, `newPngOrJpgFiles: 0`. |
| Did we consult `sourceAt()` / GOLD resource instances? | Only to **EXCLUDE** `sourceTile` positions so decorative objects never sit on a GOLD resource instance. |
| Are live Gameplay resource sprites used? | **NO.** `src.iron`, `src.coal`, `src.sulfur`, `src.crystal`, `src.stump`, `src.rubble`, `src.picked` are explicitly excluded as **Gameplay-owned harvestable-source sprites**; `src.scrap`, `src.wreck` as artificial props; `src.palm` unused (no oasis in the five windows). |

Full inventory: `creator-u05/evidence/nature01-assets.json` (22 total
`getArt().src` arrays → 12 used, 10 excluded, all with SHA-256 of source files).

**Known consequence:** a player may *mistake* a decorative oak/rock for a
harvestable one. Distinguishing them visually or semantically is a **Gameplay-side
decision for a later, separately authorised phase** — it is deliberately NOT
fabricated here.

---

## 4. Five genuinely distinct samples — real GOLD / WMP-04R1 geography

Each site is a **bounded 96×64-tile (1536×1024 px) window**. Nature objects exist
**only** inside these five windows. Every other tile of the 4000×2800 frame has
zero nature objects. This is a **pilot**, deliberately **NOT** full-world
propagation. Counts below are exact GOLD tile samples at U=0.5
(`evidence/nature01-sites.json`):

| # | Site | Window centre | OFF/ON shot tile | GOLD biome mix (of 6144 tiles) | Demonstrates |
|---|---|---|---|---|---|
| 01 | Rừng ôn đới / Temperate forest | `[1440,1320]` | `[1472,1336]` | forest 4473, ancient 1556, meadow 115; road 9.78 %, water 12.58 % | oak/pine, undergrowth, rocks, noise clearings, 2-tile road buffer visible |
| 02 | Rừng tuyết / Snow forest | `[1360,840]` | `[1360,840]` | snow 4137, conifer 1759, rock 248; water 12.58 % | snow pines, green pines on conifer, exposed rocks, snow↔conifer transition, legible lake shore |
| 03 | Đầm lầy / Marsh | `[2160,840]` | `[2152,828]` | marsh 4766, forest 1378; water 28.6 % | reed fringe on the LAND side of the water edge, willow behind it, wet ground left visible |
| 04 | Vùng khô / Dry region | `[2640,1320]` | `[2640,1320]` | scrub_dry_steppe 6144; water 0 %, road 0 % | sparse scrub + rock formations, **95.1 % open ground** |
| 05 | Cao nguyên đá / Rocky highlands | `[1100,1200]` | `[1100,1200]` | rock 4049, conifer 2011, meadow 84; road 8.59 % | low-frequency rock clusters with y-sorted depth, conifer↔rock transition, open traversable road corridor |
| ctrl | Beacon road | `[544,1304]` | `[544,1304]` | beach 3770, meadow 2374; road 8.01 % | **outside** all five windows → 0 nature objects with N ON |

No GOLD polygon, road, river, lake, shoreline, bridge, biome raster or Beacon
road tile was authored, widened, recoloured or redrawn. `sampleTile()` is READ
ONLY. `N-G9` compares 12 authority tiles (including Beacon, marsh, speckle
windows) between the two executables: identical `tile/biome/road/bridge/water/
river/lake/coast/authoredLand/poiId/sourceTile/u05Tile`; despeckle config
identical; painted isolated cells still 0.

---

## 5. Placement rules — deterministic, NOT generic random scatter

`web-u05/src/nature01/nature.ts` + `sites.ts` (`BIOME_RULES`):

1. **Authority gates** — never place on `!authoredLand`, `water`, `road`,
   `bridge`, `river`, `lake`, `coast` or a GOLD `sourceTile`. Never on
   `cliffCandidate >= 2` for non-rock biomes.
2. **Access** — a **2-tile Chebyshev buffer** around every road/bridge tile is
   object-free, so paths stay readable. `auditPilot()` measured **0** road /
   bridge / buffer violations across all 2 944 objects.
3. **Water boundaries** — `waterDist` from a 38×38 per-chunk flag grid. Trees /
   willow need `waterDist >= 2`; marsh willow only within `2…6`; `reed` is a
   distinct **land-side fringe** at `waterDist 1` (74 %) and `2` (38 %), never in
   water. 0 objects on water/river/lake/coast.
4. **Biome rule tables** — per-biome weighted sprite sets, density and clearing /
   cluster thresholds. Forest = oak/pine/rock + bush/grass/mush/herb; snow =
   snowpine/rock/dead, conifer = pine/snowpine/rock/dead; marsh = willow/oak +
   grass/caps + reed fringe; dry = dead/rock/scrub, very low density; rock /
   volcanic = clustered rock/dead/pine.
5. **Deterministic structure** — jittered **3×3 lattice** for tall/volume objects
   and **2×2 lattice** for ground cover (hash-selected anchor per cell, never a
   visible grid), plus a low-frequency `fbm` field at ~16-tile scale for
   **forest clearings**, **dry open gaps** and **rock clusters**.
6. **Rock formations** — in high cluster-field areas a rock emits 1–3 adjacent
   rocks with small deterministic pixel jitter; all extras pass the same
   authority/access exclusions and stay inside their owning 32-tile chunk, so
   chunk boundaries produce **no duplicate objects**.
7. **Transitions** — `coldClass` from WMP-04R1 biases conifer tiles toward
   `snowpine` and warm snow tiles toward `pine`; `cliffCandidate` / `heightClass`
   suppress trees on cliffs. No new snow-covered art was created.
8. **Visual density** — measured open ground: forest 84.4 %, snow 89.1 %, marsh
   82.4 %, dry **95.1 %**, rocky 89.9 %; all above their designed floors.
9. **Drawing order** — all decorative objects and the hero are y-sorted by the
   same `tile*16 + 14` key the live Gameplay painter uses. Objects both behind
   and in front of the hero exist in all five sites (`N-G5`). Only canvas
   primitives (a small ground shadow ellipse) are added — **no new sprite**.
10. **Bounded memory** — 32-tile nature chunks, LRU ≤ 36, built lazily;
    `materializedAllCells: false`, `overview.fullFrameAllocated: false`.

---

## 6. Browser evidence (native 640×360, 1×, `file://`, Chromium DPR 1)

`creator-u05/evidence/nature01-shots/` — **32 PNGs**:

- **5 OFF/ON pairs at identical tile positions**
  `{temperate_forest,snow_forest,marsh,dry,rocky_highlands}_{off,on}.png`
  (context A freezes `requestAnimationFrame` time so the hero frame is
  deterministic → exact PNG comparison is meaningful).
- `beacon_road_{off,on}.png` — ON is byte-identical to OFF (no objects there).
- **4 real-keyboard traversal shots per site** (`_walk_1…4.png`), captured after
  real `D → S → A → W` key holds at x10, ~1 200 px moved per site, 4 `keydown`
  + 4 `keyup` real events per site, no teleport, no camera-as-route.

Machine-readable: `evidence/nature01-qa.json` (12 gates, all results, hashes,
chunk checks, traversal, obstruction, performance), `evidence/nature01-build.json`,
`evidence/nature01-sites.json`, `evidence/nature01-assets.json`.

The HTTP live preview was also smoke-tested (`evidence/nature01-preview.json`):
`/nature01` boots at 640×360 DPR 1, the `N` key toggles `true→false→true`, the
`03 Đầm lầy` button lands at shot tile `[2152,828]`, 156 decorative objects draw,
0 page errors. `tests/qa-nature01-preview.mjs` is the reproducible check.

### QA result

`U05_NATURE01_QA 12/12 PASS shots=32 failing=none errors=0`

| Gate | What it proves |
|---|---|
| N-G0 | boot, untouched baseline SHA, U=0.5 / 640×360 / 16×24 / x1…x10, `overlays` all 0, no forbidden bundle code |
| **N-G1** | **OFF canvas pixel-identical to the untouched terrain baseline at 6 positions**; ON differs at 5 sites; Beacon ON unchanged |
| N-G2 | five distinct GOLD-biome samples, 2 944 objects, 0 authority violations, dry ≥ 85 % open ground |
| N-G3 | 12 existing SOH sprites only; decorative, NOT Gameplay-owned; no structures / rewards / depletion / ownership |
| N-G4 | deterministic positions; identical `stabilityHash` across cache resets; no loss/duplication at 32-tile chunk boundaries in all 5 sites |
| N-G5 | y-sorted draw order, objects both behind and in front of the hero in all 5 sites |
| N-G6 | nature changes neither `movedPx` nor `blockedSubsteps` nor collision (OFF/ON ratio 0.91…1.03) |
| N-G7 | p50/p95 frame time 16.7–16.8 ms ON and OFF (ratio 1.00), nature chunks ≤ 36, terrain chunks ≤ 36, no full-frame allocation |
| N-G8 | 4 real-key traversal shots per site, ≥ 1 176 px moved, real keyboard events, no teleport |
| **N-G9** | Beacon road / GOLD / roads / rivers / biome raster / despeckle config unchanged; 0 nature objects at Beacon |
| N-G10 | 0 browser errors, `cameraTrick: false`, real input log |
| N-G11 | source SHA + build + site evidence consistent (6 source SHA-256 values) |

Also: `npx tsc --noEmit -p tsconfig.u05.json` clean,
`tests/test-nature01.mjs` **31/31 PASS**,
`tests/test-u05.mjs` **272/0** (unchanged),
`tools/verify-u05.mjs` unchanged (`P6-G0…G3 PASS`; `P5-G5/G6 FAIL`,
`P5-G7/G8 PARTIAL` — standing scope preserved).

---

## 7. Identified weaknesses (reported, not hidden)

1. **Five bounded windows only.** No full-world propagation, no streaming plan,
   no POI architecture. Everything outside the 5×96×64 windows has zero nature
   objects — by design, not by omission.
2. **Decorative-only is a real semantic gap.** These trees/rocks look like the
   live Gameplay harvestable sources but are **not** harvestable. Before any
   merge, Gameplay must decide how they differ (interaction, collision,
   resource semantics). We did not fabricate that decision.
3. **No interaction / animation / seasons / weather / light / night / VFX.**
   No leaf storm, no grass sway (live `drawSource` sways), no snow accumulation,
   no wind, no shadows for 16×16 sprites. Blanket VFX were explicitly out of
   scope.
4. **Reused art has colour limitations.** `src.grass` / `src.bush_empty` are
   green even in `scrub_dry_steppe`; `src.palm` is unused because no oasis is in
   these windows; snow-covered rock/bush variants do not exist. Recolouring or
   drawing new art was NOT authorised (no demonstrated asset gap requiring it).
5. **Placement is procedural, not hand-authored GOLD detail.** Clearings and
   clusters come from deterministic hash lattices + `fbm` over the authoritative
   biome raster. They are an *interpretation* of GOLD, not new authored geography.
   At a glance some stands can still read as slightly regular.
6. **Whole-map overview (`Z`) shows terrain only.** At 0.1286 px/tile a 24×32
   sprite is sub-pixel; nature is drawn only at native 1× (the 192×144 `Camera 1×`
   lens DOES include it). Report this honestly when comparing zoom modes.
7. **Chunk cache pressure.** `auditPilot()` builds 30 chunks; at the rocky site
   the resident nature cache reached its 36-chunk cap. Roaming beyond all five
   windows will evict chunks; rebuilds are deterministic (`N-G4`) but a cold
   full-pilot audit took ~1.35 s in-browser (QA-only, not per frame).
8. **Performance is headless Chromium only.** p50/p95 16.7–16.8 ms is a
   `--disable-gpu` desktop measurement, not a low-end device / mobile / sustained
   full-world measurement. No visual acceptance follows from it.
9. **No exact pixel-diff proof against a Creator benchmark.** These are whitebox
   browser screenshots. No `VISUAL_ACCEPTED`, no production-art claim, no
   all-81-art claim, no `VEYRA_PLAYABLE`.
10. **Road buffer is a Map-side heuristic** (2 tiles), not Gameplay permission;
    `SITE_ENVELOPE`, `BUILDING_COMPOSITION`, `DOORS/ROOMS`, `ROOF/OCCLUSION`,
    `SOLID_COLLISION`, `NAV/RETREAT`, `GAMEPLAY_SOCKETS` remain separate and
    untouched.
11. **Live Gameplay branch drifted after the verified head.** `2f083658…`
    appeared during this pilot and `record-drift-u05.mjs` would now report
    `u05RelevantBlocksIdentical=false` (its `core/catalog/render/balance`
    blocks changed). We deliberately **restored the standing verification
    packet** instead of silently regenerating it, and did not re-vendor. The
    only `art.ts` change is `S.claim` (unused structure sprite). Any future
    phase needs an explicit source-custody decision before syncing.

---

## 8. Control Tower handoff

**What is ready for independent review:** the new standalone HTML, the untouched
baseline, 5 OFF/ON pairs, 20 real-input traversal shots, the Beacon control pair,
12/12 QA gates, 31/31 static tests, the asset inventory with source SHA-256, the
five site definitions with exact GOLD biome counts, and the placement rule table.

**Decision requested from Creator / Control Tower:** *visual acceptance of these
five pilot samples* — yes / no, with per-site notes (density, sprite colour,
clearings, water edge, rock clustering, road readability). QA is **not** that
acceptance.

**Explicitly NOT requested and NOT done:**
- propagating the system across the whole 4000×2800 world;
- starting POI architecture, buildings, walls, roofs, doors, fences or ruins;
- merging into production / PR44 / `main`;
- granting `VISUAL_ACCEPTED`, `productionAtlas`, `VEYRA_PLAYABLE`, all-81
  art-complete/interactive, or full Gameplay runtime integration;
- changing GOLD, WMP-04R1 biome authority, roads, rivers, Beacon road or the
  terrain-only baseline executable.

**If (and only if) the Creator accepts the five samples**, the next phase needs
its own authorisation and must cover: per-biome density tuning from Creator
notes; the decorative-vs-harvestable semantic distinction; interaction / collision
/ ownership semantics owned by Gameplay; full-world chunk streaming and cache
budgets on target devices; and separate Control Tower sign-off. Standing
`P5-G5/G6 FAIL`, `P5-G7/G8 PARTIAL` gates remain in force until exhaustive
runtime proof.

**Stop condition honoured:** this delivery stops before full-world propagation,
before POI architecture, before Creator visual acceptance, before production
merge and before any `VEYRA_PLAYABLE` claim.
