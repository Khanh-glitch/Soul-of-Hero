# NATURE-02 — FOREST QUALITY VERTICAL SLICE (ONE biome, THREE compositions)

**Status:** independently reviewable ONE-biome pilot with real 640×360 screenshots.
**NOT** `VISUAL_ACCEPTED`, **NOT** approved for production, **NOT** a full-world
propagation, **NOT** a POI/architecture step, **NOT** a Gameplay merge, **NOT**
`VEYRA_PLAYABLE`. QA/browser evidence is **not** visual acceptance.

**Branch:** `arena/2e3cfbd2-soul-of-hero`
**Map HEAD at slice start:** `b5dfafb278eb15333a66a4d3b24c23d4aa17c427`
**Creator-verified Gameplay HEAD:** `5b3e683402bbc8540dea9404576164097e753f97`
**Gameplay HEAD observed later (read-only):** `2f0836587b76a4a98fffedf8c202fb37cbb2a67c`
**Owner branch:** `arena/d4bfcfff-soul-of-hero` (Map must not edit it)

---

## 1. What was asked, and what was delivered

NATURE-01 proved that GOLD/WMP-04R1 geography could carry a decorative ecology
layer, but its five-biome windows showed a **uniform, sparse scatter** and left an
unresolved **decorative-vs-harvestable** ambiguity. NATURE-02 takes **ONE** of
those windows — the temperate forest — and asks whether it can be made to read
like a credible survival-game forest *without* touching any other biome, the
world, or Gameplay.

| File | Bytes | SHA-256 |
|---|---:|---|
| `SoulOfHero_TerrainOnly_U05_x10.html` (**untouched U=0.5 baseline**) | 1 407 498 | `540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0` |
| `SoulOfHero_Nature01_U05.html` (**untouched NATURE-01**) | 1 427 241 | `ac4d54e310f0f3cf7e0e12d728bc5e9ad62f801994be37ce64f76b099af4a0a7` |
| `SoulOfHero_Nature02_ForestSlice.html` (**NEW standalone pilot**) | 1 436 807 | `6e1e897a0e365412f6bc92d65390dc10bf7b0352e6ad8ef4a1c38e57f4f30fa6` |
| `SoulOfHero_Nature02_ForestSlice.zip` (forced-download mirror) | 131 874 | — |

`build-nature02-forest-slice.mjs` **asserts both protected SHA-256 values before
writing anything**. No NATURE-01 or terrain-only source, executable, evidence JSON
or screenshot was modified. `N` toggles the forest layer; with `N = OFF` the
native 640×360 canvas is **pixel-identical** to the untouched baseline at four
positions (PNG SHA-256 equality + ImageMagick mean absolute difference `0`).

**Live preview (port 5183):** `/nature02` (play), `/nature02-download` (forced
attachment), `/nature01`, `/nature01-download`, `/`, `/download` — the four old
routes are byte-for-byte unchanged (`evidence/nature02-preview.json`, 6/6 HTTP 200
with correct SHA and `Content-Disposition`).

**Controls:** `N` forest OFF/ON · `1`/`2`/`3` or the three buttons → dense
interior / clearing / road–forest edge · `M` → native art audit sheet · `Z`, `F`,
`L`, `C`, `H`, `R`, x1–x10 speed and real WASD/arrows inherited unchanged.

---

## 2. Non-negotiable contract (unchanged)

`U = 0.5 AU/tile`, `TILE = 16 px`, camera **640×360 @ 1× DPR 1**, hero **16×24**,
base **72 px/s**, viewer x1…x10 = 72…720 px/s (viewer control, NOT a Gameplay
law), frame **4000×2800 = 11 200 000 addressable cells**, never materialised.
Real WASD / arrow keys; no camera trick, no route teleport. GOLD polygons, WMP-04R1
rasters, roads, rivers, docks, POI anchors, resource authoring, verbatim
PAL/PRIO/texel painter (`f29c1a68…`), despeckle policy and natural-terrain
collision authority are **READ ONLY**.

**One window:** `[1392, 1288, 1488, 1352)` = the same 96×64 temperate-forest window
used by NATURE-01 site 01. GOLD sampling at the three shot centres: dense interior
920/920 forest tiles, 0 road, 0 water, 14 `sourceTile`; clearing 920/920 forest,
0 road, 0 water, 16 source; road edge 659 forest + 261 ancient, 190 road tiles,
0 water, 23 source (`evidence/nature02-forest.json`). The other four NATURE-01
windows and the whole rest of the frame have **zero** N02 objects.

---

## 3. Audit of the ACTUAL native SOH art (no arbitrary enlargement)

Measured from the live offscreen canvases in `getArt()` — not from documentation —
by `tools/build-asset-inventory-nature02.mjs`; the 640×360 sheet
`evidence/nature02-shots/art_audit_sheet.png` shows every sprite at **1×** plus a
clearly-labelled **2× INSPECTION ONLY — NOT IN GAME** panel (`M` key).

| Sprite | Canvas px | Real alpha bbox | Opaque px | H vs hero | W vs hero |
|---|---|---|---:|---:|---:|
| `hero.male.idle0` | 16×24 | `[2,0,13,22]` → 12×23 | 224 | 1.000 | 1.000 |
| `src.oak` | 24×32 | `[0,0,23,31]` → 24×32 | 432 | **1.333** | **1.500** |
| `src.pine` | 24×32 | `[1,2,23,31]` → 23×30 | 338 | 1.333 | 1.500 |
| `src.willow` | 24×32 | `[1,1,22,31]` → 22×31 | 482 | 1.333 | 1.500 |
| `src.dead` | 24×32 | `[5,5,18,31]` → 14×27 | 169 | 1.333 | 1.500 |
| `src.rock` | 16×16 | `[0,4,15,15]` → 16×12 | 152 | 0.667 | 1.000 |
| `src.grass` | 16×16 | `[3,6,11,14]` → 9×9 | 52 | 0.667 | 1.000 |

`getArt().src` has **22** arrays; **12** were measured (all tree, shrub and ground
forms), **6** are used by N02, **16** explicitly excluded. `newArtAssets = 0`,
`newAtlases = 0`, `spriteScaling = false`. Canopy mass comes from **overlapping
24 px crowns on 16 px tiles plus y-sorted depth**, never from a scale factor.

**Verdict — canopy: NOT CONVINCING WITH EXISTING ART ALONE.** A tree is only 8 px
taller than the hero and its crown starts at the top of its canvas; it cannot arch
over the hero. All six tree forms are ONE 24×32 crown tier + thin trunk — no
mid-storey, no sapling, no branching silhouette, no overhead canopy. At native 1×
the result reads as a wall of green lollipops seen obliquely, not as a canopy one
walks under.

**Verdict — undergrowth: NOT CONVINCING WITH EXISTING ART ALONE.** `bush` /
`bush_empty` encode stocked vs **DEPLETED Berry Bush**; `grass` / `reed` / `herb` /
`mush` are harvestable `SOURCES` with yields and regrow; `rock` is a solid
harvestable Boulder. There is **no dedicated non-harvestable fern / shrub layer**.

One disclosed rendering-only effect: a translucent `rgba(8,12,10,0.22)` ground
shadow ellipse under tall sprites. It is **not** a SOH asset, **not** a prop, and
would need art review if this were ever promoted.

---

## 4. Design — stands, clearings, routes, empty space

**13 explicit stands** (`S01…S13`), each with its OWN species mix (`oak`,
`oak_pine`, `pine_oak`, `willow_oak`, `ancient_oak`) and an elliptical falloff, so
a stand reads as one ecological unit. **3 designed clearings** (`C1` reviewed,
`C2`/`C3` natural gaps). **3 deliberate routes** (`TRAIL_TO_ROAD`,
`TRAIL_TO_LAKE`, `ANCIENT_TRACK`, half-width 1 tile = a 3-tile corridor): these
are **OBJECT-FREE CORRIDORS ONLY** — no path/road/ground pixel painted, no GOLD
geometry authored, no Gameplay navigation permission minted. Deliberate review
iteration v2 added the three road-side stands, narrowed the corridors and replaced
an initially visible 2×2 lattice floor with independent per-tile probability
after inspecting the real 640×360 PNGs.

| Zone | tree p | under p | reading |
|---|---:|---:|---|
| `core` | 0.66 | 0.14 | overlapping native canopies, thicket/gap modulation |
| `edge` | 0.30 | 0.42 | dense low mantle: tufts + rocks + occasional snag |
| `exterior` | 0.015 | 0.09 | natural empty ground, sparse tufts |
| `clearing_rim` | 0.06 | 0.50 | dense but low rim framing the opening |
| `clearing_interior` | 0.00 | 0.10 | readable open floor, a few tufts/rocks |

**Vetoes:** road/bridge + **3-tile buffer**, water/river/lake/coast + 2-tile tree
buffer, GOLD `sourceTile`, non-authored land, steep/cliff, non-forest/ancient
biome, and any tile outside the one window. Chunks 32×32, LRU ≤ 36.
`auditForest()` → **1 350 objects**, `stabilityHash = 5dccf0df`, **0 violations**
of any veto; open-ground share **0.6137 / 0.7035 / 0.6846** — natural empty space
is deliberately preserved, the scene is not filled and roads are not covered.

**Uniform scatter corrected objectively** (F-G7, same 96×64 window):

| | NATURE-01 | NATURE-02 |
|---|---:|---:|
| tree tiles | 207 | 839 |
| largest 8-connected tree cluster | **3 tiles** | **178 tiles** |
| top-5 clusters | 3,3,2,2,2 | 178,79,62,59,56 |
| 8×8-block density CV | 1.172 | 1.231 |

---

## 5. Three independently reviewable compositions

| # | Key | Shot tile | Intent |
|---|---|---|---|
| 01 | `dense_interior` | `[1416, 1320]` | coherent overlapping oak stands, thicket edges, object-free corridor, remaining natural gaps |
| 02 | `clearing` | `[1408, 1332]` | designed elliptical opening C1: sparse interior, dense low rim, silhouette against canopy wall |
| 03 | `road_forest_edge` | `[1452, 1316]` | stands stop at the 3-tile road veto; authored GOLD road stays fully visible |

**Exact baseline / NATURE-01 / NATURE-02 comparisons** at four identical tiles
(the three shot tiles plus NATURE-01's own site-01 tile `[1472, 1336]`). Numbers
are whole-image mean absolute channel differences (ImageMagick), `0` =
pixel-identical; files are `evidence/nature02-shots/compare_<key>_<variant>.png`,
all exactly 640×360.

| Tile | baseline→N01 | baseline→N02 | N01→N02 | N02-OFF→baseline |
|---|---:|---:|---:|---:|
| dense interior `[1416,1320]` | 0.009390 | 0.044230 | 0.050978 | **0** |
| clearing `[1408,1332]` | 0.011986 | 0.030609 | 0.040506 | **0** |
| road edge `[1452,1316]` | 0.012600 | 0.026731 | 0.035960 | **0** |
| N01 site-01 `[1472,1336]` | 0.011919 | 0.010923 | 0.021618 | **0** |

**Genuine screenshots:** 44 PNGs in `evidence/nature02-shots/` — 4 OFF/ON pairs,
4 four-file comparison triptychs, 3 full-viewport Chromium screenshots, 12
real-keyboard walking shots, and the art audit sheet. Native captures use
`canvas.toDataURL()` on the 640×360 drawing surface (the element has a 1 px CSS
border, so an element screenshot would be 642×362); full-viewport Chromium
screenshots are supplied separately to prove real browser rendering. All are
**native 1×, DPR 1** — no zoom, no upscaling, no composited mock-up.

**Road unobstructed, objectively:** 51 424 authored road/bridge pixels have the
identical FNV hash `9242f6ad` with forest OFF and ON. **Real walking:** 4 native
shots per composition, `D→S→A→W` at x10, 1 152 / 1 188 / 1 224 px moved, 4 real
keydowns + 4 keyups each, camera follows, no teleport, no camera-as-route.

---

## 6. Automated QA (NOT visual acceptance)

`tests/qa-nature02.mjs` → `evidence/nature02-qa.json`: **15/15 PASS**, 44 PNGs,
0 browser errors.

| Gate | Result |
|---|---|
| F-G0 | three untouched executables + native contract + no forbidden leak |
| F-G1 | OFF pixel-identical to baseline at 4 positions; ON changes only the 3 compositions |
| F-G2 | exact 640×360 triptychs at 4 identical tiles, 3 distinct files each |
| F-G2b | 3 genuine full-viewport Chromium screenshots at exactly 640×360 |
| F-G3 | 3 distinct compositions; readable clearing; road pixels OFF=ON |
| F-G4 | real alpha-bbox art audit sheet; hero 16×24, tree 24×32, no scaling |
| F-G5 | decorative-only; exact owner dependency; asset gap PROPOSED not manufactured |
| F-G6 | deterministic placement, stable across cache resets and 32-tile chunk boundaries |
| F-G7 | uniform scatter corrected; zero veto violations; empty space ≥ 0.60 |
| F-G8 | y-sorted draw order, objects behind and in front of the hero |
| F-G9 | real keyboard walking sequences (4 native shots × 3 compositions) |
| F-G10 | no obstruction / collision change in **both** collision modes |
| F-G11 | p50/p95 16.7–16.8 ms ON=OFF (ratio 1.00), forest chunks ≤ 36, no 11.2M-cell allocation |
| F-G12 | 16 authority tiles identical, despeckle config identical, 0 isolated painted cells, 0 objects outside the window |
| F-G13 | 0 errors, no camera trick, evidence SHA consistency |

`tests/test-nature02.mjs` **52/52**; `tests/test-nature01.mjs` **31/31**;
`tests/test-u05.mjs` **272/0** (its regenerated `test-results.json` was restored
to the standing packet); `npx tsc --noEmit -p web-u05/tsconfig.u05.json` clean;
`tests/qa-nature02-preview.mjs` PASS, 6/6 routes. `evidence/nature01-*.json` and
`evidence/terrain-only-*.json` still all-pass.

---

## 7. Separate visual evaluation (NOT an automated test)

`evidence/nature02-visual-review.json` holds the five required axes **separately
from the gates**, each with direct observations from the actual PNGs and its own
objective failures:

| Axis | Verdict |
|---|---|
| **Silhouette** | `PARTIAL__COMPOSITION_FIXED__CANOPY_STILL_MISSING` — contiguous forest masses replace isolated lollipops, but one crown tier, no overhead canopy, visible variant repetition |
| **Ecological coherence** | `PARTIAL_PASS__COHERENT_STANDS__SHALLOW_ECOLOGY` — per-stand species, wet-edge willow, snags, clearings, empty space; but no age variation, litter, shade or mid-storey |
| **Navigation readability** | `PASS_FOR_PILOT__LIMITED_BY_NO_PATH_PAINTING` — 3 legible compositions, clean road strip, real WASD; but invisible negative-space trails and an unchanged stair-step GOLD road polygon |
| **Sprite scale** | `PASS_NO_ARBITRARY_ENLARGEMENT__FAIL_AS_SURVIVAL_FOREST_SCALE` — native sizes honoured, but 1.333× hero height cannot make a canopy |
| **Semantic consistency** | `FAIL_FOR_PRODUCTION__BLOCKED_BY_GAMEPLAY_OWNER` — no contradiction INSIDE the pilot, but identical sprites are harvestable/solid in live Gameplay |

**12 objective failures** are registered (`N02-F1 … N02-F12`) with severity and
owner; the most consequential are `N02-F1` (no overhead canopy possible at native
scale) and `N02-F2` (production blocked by the identical-sprite conflict).

---

## 8. Exact owner dependency — recorded, NOT resolved by Map

| Live Gameplay location | Fact |
|---|---|
| `web/src/game/catalog.ts:143` | `SOURCES.oak` `art:'oak'`, `stock:6`, `yields:[['wood',1]]`, `block:true` → visually identical oak is SOLID and HARVESTABLE |
| `web/src/game/catalog.ts:149` | `SOURCES.rock` `stock:6`, `block:true` → identical rock SOLID/HARVESTABLE |
| `web/src/game/catalog.ts:156` | `SOURCES.grass` `stock:2`, `yields:[['fiber',1]]`, `regrow:300` → identical grass harvestable |
| `web/src/game/render.ts:212` | Gameplay source renderer draws `A.src[art]` at `y = ty*16+14`; depleted forms `stump`/`rubble`/`picked` |
| `web/src/game/render.ts:215` | `r.natureTrees` draws **the same `A.src.oak`** at `x-4,y-16,y+14` — not decoration |
| `web/src/game/sim.ts:199` | mature grove trees spawn wood drops + receipts (`core.grove.wood`) |
| `web/src/game/engine.ts:189` | `blockGrid()` sets `r.natureTrees` to collision class 2 → SOLID |
| `web/src/game/engine.ts:156` | `sourceAt()` owns stock / hp / regrow / burnt and source layout version |

NATURE-02 objects have **no interaction, collision, reward, stock, depletion or
owner** and never occupy a GOLD `sourceTile`, so there is no contradictory
interaction *inside this pilot*. But **no visually identical trees with
contradictory interactions may be approved for production**. Therefore
`pilotStatus = NOT_APPROVED_FOR_PRODUCTION`. Map must not invent rewards,
collision or source ownership; the decision belongs to the Gameplay owner.

**Decision required from Gameplay:** designate, in Gameplay-owned data, which
oak/pine/rock/grass instances are harvestable and which are purely visual; **OR**
ship a distinct non-harvestable forest asset set. Until that is resolved, the
slice stays a reviewable pilot only.

---

## 9. Proposed asset specification — PROPOSAL ONLY, nothing manufactured

`N02-ASSET-GAP-01`, status `PROPOSED__NOT_CREATED__NOT_APPROVED`, owner **Gameplay
art + Gameplay semantic registry (NOT Map)**:

| Key | Size px | Variants | Note |
|---|---|---:|---|
| `forest_canopy_oak` | 24×40 | 3 | **NEW** asset, NOT an enlargement of `S.oak`; two irregular crown tiers + visible trunk; native 1× grid, outline `#140c14` |
| `forest_fern` | 16×16 | 3 | non-harvestable undergrowth; NO berries/flowers, NO picked/depleted state |
| `forest_snag` | 24×32 | 2 | standing deadwood without the charcoal/ember reward cue of `S.dead` |

Registration constraint: **MUST NOT** be added to `SOURCES`, `sourceAt()`, yields,
stock, regrow, `blockGrid()` or any loot/receipt path. Camera constraint: U=0.5,
640×360 @1×, hero 16×24 unchanged, no sprite scaling, no camera zoom. **No
substitute asset was created, imported or drawn.**

---

## 10. Control Tower handoff + STOP conditions

**Hand off for review:** the three compositions, the exact triptychs, the 44
native PNGs, the 15-gate QA packet, the separate five-axis visual evaluation, the
12-item failure register, `N02-ASSET-GAP-01`, and the eight-point owner
dependency. Creator/Control Tower decisions needed:

1. Is the **stand/clearing/edge composition** direction acceptable at native 1×?
2. Is the **negative-space-only route** convention acceptable, or is a Gameplay-
   owned path/navigation contract required first?
3. Which **Gameplay owner** resolves the identical-sprite semantic conflict, and
   on which head? (`5b3e683…` verified; `2f083658…` observed later.)
4. Is `N02-ASSET-GAP-01` to be commissioned, rejected, or replaced? No asset is
   created until an explicit approval.

**STOP.** This slice does **not**: change any other biome; propagate to the
4000×2800 world; add buildings, POIs, ruins, fences or arbitrary props; modify
GOLD/WMP-04R1 roads, rivers, collision or source ownership; merge Gameplay;
declare `VISUAL_ACCEPTED`; claim `VEYRA_PLAYABLE`; or manufacture an unapproved
substitute asset. `productionApproved = false`,
`creatorVisualAcceptance = NOT_GRANTED`, `productionMerge = NOT_DONE`. Earlier
blockers remain: `P5-G5/G6` FAIL, `P5-G7/G8` PARTIAL, LW-G2/G3 PARTIAL,
`VEYRA_PLAYABLE` BLOCKED.

---

## 11. Source custody & reproduction

- Art: `creator-u05/web-u05/src/game/art.ts`, vendored verbatim from
  `b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/art.ts`, **unchanged**.
  The later live head `2f083658…` changes only `S.claim` (an unused structure
  sprite); no re-vendor, no silent sync. Disclosure added to
  `evidence/source-custody.json → nature02Disclosure`.
- Geography: GOLD `VEYRA_GOLD_MAP.sohmap.json` + WMP-04R1 via `sampleTile()`
  **read only**; verbatim painter `f29c1a68…`; 21 embedded rasters unchanged.
- Build evidence: `evidence/nature02-build.json` (11 source SHA-256 values);
  design: `evidence/nature02-forest.json`; art: `evidence/nature02-assets.json`;
  QA: `evidence/nature02-qa.json`; visual: `evidence/nature02-visual-review.json`;
  preview: `evidence/nature02-preview.json`; delivery: `evidence/nature02-delivery.json`.

```bash
cd creator-u05
node build-nature02-forest-slice.mjs                 # asserts both protected SHAs
LD_LIBRARY_PATH=/tmp/al2023/lib node tools/build-asset-inventory-nature02.mjs
LD_LIBRARY_PATH=/tmp/al2023/lib node tests/qa-nature02.mjs
node tests/test-nature02.mjs
LD_LIBRARY_PATH=/tmp/al2023/lib node tests/qa-nature02-preview.mjs
cd web-u05 && npx tsc --noEmit -p tsconfig.u05.json
```
