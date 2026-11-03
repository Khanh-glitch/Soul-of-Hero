# MAP-SCALE-01A — what was read from Gameplay PR #44 HEAD

**Rule applied:** read the **latest** PR #44 HEAD, not only the pinned `a956c9e` snapshot used
by MAP-GEO-01. Every number below is derived from a pinned git object and fingerprinted in
`output/gameplay_sources.v1.json`; nothing is transcribed from memory or invented.

## 1. Provenance

| Item | Value |
| --- | --- |
| PR | `#44` (OPEN), head ref `arena/d4bfcfff-soul-of-hero` |
| HEAD commit used | `d80ad1b5d46f17b729e90898cfa2ad31b677fae3` |
| Older pinned snapshot | `a956c9e85624c1ca7a2b5585eb423f8fa1cf296c` (MAP-GEO-01 era) |
| Refspec to reproduce | `git fetch -q origin refs/pull/44/head:refs/remotes/origin/pr44-head` |
| Reference docs commit | `7a1c53acfc5b7cda6cb34ea3f348b4e100744354` (`origin/references/gameplay-prototypes-20261102`) |
| Veyra canon | `19d8c6ec820f324a6ac12733165e43b5e2c6eab2`, `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json`, 332,249 B, SHA `88780f78…a256` |

`git diff a956c9e..d80ad1b5` touches 53 files (+637 / −40). Among the benchmark inputs:
`balance.v1.json`, `core.ts` and `sim.ts` all have **different SHA-256** at HEAD than at the
older snapshot. The HEAD `balance.v1.json` adds `fire` and `garden` cold-frame/tender fields;
`core.ts` adds `garden.coldFrame` / `farm` / source fire state; `sim.ts` adds fire spread and
tender steps. `TILE`, `WW`, `WH` and the movement/cart speed expressions are unchanged, but
`output/gameplay_sources.v1.json :: gameplay.headDiffersFromPinned` proves the HEAD was used.

### Files read at HEAD (SHA-256 recorded per file)

```
web/ref/bible.md                             8aa2ac6e…8d40
web/src/game/balance.v1.json                cd12286c…0b62
web/src/game/core.ts                        abcb1f1c…6dab
web/src/game/sim.ts                         ba580a0f…d7b8
web/src/game/engine.ts                      4217d25d…b56f
web/src/game/world.ts                       4d348ffc…46e7
web/src/game/world-economy.ts               bcc87d4a…c5fa
web/src/game/geography-contract.ts          2dad5ff6…b0e3
web/src/game/map-package.ts                 54b5821c…603d
web/src/game/catalog.ts                     0bfbd9c6…00a4
web/src/game/render.ts                      (fingerprinted in output/gameplay_sources.v1.json)
web/IMPLEMENTATION_EVIDENCE.md              (fingerprinted in output/gameplay_sources.v1.json)
```

Reference docs: `docs/survival/CURRENT_PRODUCT_CONTRACT.md`,
`docs/survival/reviews/GAMEPLAY_MAP_CONVERGENCE_BRIEF_20261101.md`,
`docs/survival/tasks/C08_PROTOTYPE_REUSE_AND_CAUSAL_GATE_TRIAGE_20261102.md`,
`reference_prototypes/20261102/SOH_GAME_DEVELOPMENT_GAMEPLAY_DEPTH_REUSE.md`.

## 2. Actual runtime constants (`core.ts`, HEAD)

| Constant | Value | Consequence for a full-Veyra transform |
| --- | --- | --- |
| `TILE` | 16 px | fixed px/tile; `1 au = 16/U px` |
| `WW`, `WH` | 200, 200 | **exact** 40,000 cells; compile-time constants, not parameters |
| `VIEW_W`, `VIEW_H` | 640, 360 px | camera = 40 × 22.5 tiles (MAP-CAMERA reads at 1×) |
| `HOUR` | 3,600,000 ms | run clock is real elapsed ms ⇒ 1 game hour = 3,600 real s |
| `WORLD_SEED` | `0x50f1` | stable geography across runs |
| `SAVE_VERSION` | 3 | — |

## 3. Actual movement / balance (`balance.v1.json` + `sim.ts`, HEAD)

`player.speed = 72 px/s` ⇒ `4.5` tiles/s ⇒ `4.5 × U` authoring units/s.

| Group | Values used |
| --- | --- |
| `terrainSpeed` | road/bridge 1.28, floor 1.10, grass/meadow 1.00, forest 0.86, sand 0.88, marsh 0.62, shallow 0.50, snow 0.78, hill 0.90, ash 0.92, toxic 0.95, burnt 1.00, ice 1.05 |
| `cart` | slots 24 / `maxWeight` 240; freight 32 / 360; `speedOnRoad` 1.36, `speedOffRoad` 0.72, `speedRough` 0.42; `weightPenaltyPer100` 0.18 |
| `player` | hunger 2.4/min, thirst 3.6/min, `carryLimit` 60, stamina 100 / regen 26, roll 190 px / 260 ms |
| `economy` | `claimRadius` 6 tiles, `maxClaims` 2, `claimMinDistFromPoi` 10 tiles, `tenderLinkTiles` 3, escrow price 30 |
| `ai` | `activeRadiusTiles` 30, `sightDay` 110 px, `sightNight` 70 px, `traceSenseRadius` 20 px |
| `run` | 336 h (1,209,600 s), Ragnarok last 72 h, danger day 12, Elders day 14 |
| `dayNight` | fictional day 24 real min (separate clock) |

`sim.ts` (HEAD lines ~210–217) — the benchmark uses exactly these expressions:

```ts
let sp = B.speed * (BAL.terrainSpeed[SPEED_KEY[t]] ?? 1) * speedMul;
sp *= personalLoad * condition;
if (cart) {
  const ct = effTile(r, tileOf(cart.x), tileOf(cart.y));
  const road = ct === T.ROAD || ct === T.BRIDGE || ct === T.FLOOR;
  const rough = ct === T.FOREST || ct === T.MARSH || ct === T.HILL || ct === T.SNOW;
  const base = road ? BAL.cart.speedOnRoad : rough ? BAL.cart.speedRough : BAL.cart.speedOffRoad;
  const cw = cartWeightOf(r, cart);
  sp = B.speed * speedMul * base * Math.max(0.25, 1 - cw / 100 * BAL.cart.weightPenaltyPer100)
     * (cw > cartLimit(cart) ? 0.4 : 1) * personalLoad * condition;
}
```

`moveBody` radii: player **4 px**, cart **5 px** ⇒ diameters 0.5 and 0.625 runtime tiles.
Rope distances 15 / 26 px; the stuck toast explicitly says carts cannot ford water or squeeze
through. Cart weight is the sum of `ITEMS[key].w × qty` in its container.

`engine.ts` `blockGrid` is `Uint8Array(WW*WH)`; blocking classes DEEP/CLIFF/PWALL = 1,
LAVA = 5, SHALLOW/RIVER = 4, structures/doors/statics = 3. Build range `4.6*TILE`; near
interaction `2.2` / `3` tiles. These are the **only** collision rules used here; no rule was
invented for Veyra.

## 4. Exact runtime limits discovered in HEAD source

| Limit | Source | Value |
| --- | --- | --- |
| Exact-dimension package validator | `map-package.ts :: validateRuntimeMapPackage()` | `e.width === WW`, `e.height === WH`, `e.tileSize === TILE`; `tiles/fresh/zone/seaDist` arrays must have exactly `WW*WH = 40,000` bounded integers (bounds 19/1/15/255); `resize is not supported` |
| Economy cell cap | `world-economy.ts :: validateEconomyMap()` | `n = width*height > 1_000_000` rejected; 13 equal-length cell arrays (`biome,elevation,slope,moisture,temperature,freshwater,coast,walkable,buildable,cargoPassable,road,protected,industrial`); 14-string biome enum; starts must be walkable and reachable |
| Fixed grid | `core.ts`, `engine.ts` | `WW*WH = 40,000`; `Uint8Array(WW*WH)` blockGrid |
| Render chunk cache | `render.ts` | `CH = 16` tiles per chunk; key `k = cy*100 + cx`; collision-free only if `ceil(W/16) ≤ 100` ⇒ `W ≤ 1,600` tiles. At U=1, W=2,000 tiles ⇒ 125 chunk columns ⇒ **key collisions** |
| `seaDist` semantics | `world.ts` | BFS stops at `> 6` hops; inland cells keep sentinel 255. Measured meaningful coverage: U=1 **0%**, U=2 **5.39%**, U=4 **15.29%**, U=8 **31.91%** of land cells |
| Streaming | `web/src/game/*` | **No** world streaming / LOD loader found. `render.ts` has only a 16-tile terrain chunk *cache* (256×256 px canvas per chunk, no global eviction cap) |

`compileEconomy()` scans each cell with a 7×7 `nearRoad` neighbourhood ⇒ worst case `49 × n`
checks. `mapDigest` converts many arrays to JS arrays, so memory scales at least linearly.

## 5. Actual authored building dimensions (`world.ts`, units = runtime tiles)

`stamp()` buildings measured from HEAD: `b_s0` 6×5, `b_s1` 5×5, `b_s2` 6×5, `b_s3` 5×5,
`b_tp` 11×7, `b_m1` 6×5, `b_m2` 7×6, `b_m3` 5×5, `b_fa` 17×12, `b_li` 5×5, `b_wr` 9×5,
`b_wa` 5×5, `b_ev` 5×4, `b_vault` 5×4. **Smallest = 5×4 = 20 tiles² with a 4-tile side**;
largest = 17×12. `STRUCTS` (`catalog.ts`) are single-tile placed instances with HP/collision.
This is the physical yardstick for "can a Veyra POI hold a usable room?" at each `U`.

## 6. Bible / acceptance IDs read verbatim

`web/ref/bible.md` §I.A ownership rows and §5.2 Map tests were extracted verbatim into
`output/gameplay_sources.v1.json :: bible`:

- **K2** Environment, **K3** Sources, **K6** Territory/build/POI, **K7** Travel/freight,
  **K8** Clock/run — section headers + ownership rows.
- **MAP-SPAWN-04** — four spawns, no-Core water/food/tool source, road/offroad, route to buildable land; a "safe dot" is insufficient.
- **MAP-HOME-03** — three tester-chosen houses, real collision/roof/garden/furnace, freight and differing monster encounters; buildable % or HousePins are insufficient.
- **MAP-LOG-03** — one source POI with distinct foot and cart roads, a far warehouse whose value rises after a cart, a weather/enemy-changed route; no real item/collision/cart is insufficient.
- **MAP-U4** — no-boss cash → seller → own base → place chest → positive deposit → optional evacuation.
- **MAP-U5** — six distinct Elder regions, distinct point sources, at least one no-boss retreat; symmetric coloured zones are insufficient.
- §`World-position costs to measure, not fix by fiat`: `t_foot`, `t_cart_loaded`,
  `t_cart_unloaded`, `distance_to_road`, `exposure_time`, … and **"No invented km/minutes,
  number of chests, bank purchase cost or exact drop percentages."**

`web/IMPLEMENTATION_EVIDENCE.md` C24 records the current Web prototype as `200×200` tiles with
each of 4 starts having wood, stone and food within **12 tiles**; its C13 text still quotes the
older cart multipliers (×1.05 / ×0.55 / ×0.32). **This benchmark uses the HEAD
`balance.v1.json` values (1.36 / 0.72 / 0.42), not the stale evidence text.**

## 7. Geographic contract (`geography-contract.ts`)

Road `widthTiles` and advertised-width physical checks; POI footprint, entrances, rooms,
doors, power/hazard/loot sites and retreat paths; critical paths protected + walkable;
build sites buildable with cargo loading cells; all six Elder sites required by
`validateRuntimeMapPackage()`. These are **contract requirements**, not dimensions: Veyra
canonical POIs have a `foot`/`deep` polygon and a textual `access` label but **zero authored
doors, rooms, corridors or workspaces**, and no swept-clearance dimension exists in the source
(GEO-02 `maplab_encoding.v1.json :: widthSemantics.roads.sweptClearance = UNVALIDATED`).
