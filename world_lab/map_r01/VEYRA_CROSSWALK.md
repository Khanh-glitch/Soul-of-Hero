# MAP-R01 — Veyra → A1 → Web compact crosswalk

**Fisher's Point is a first-hour playable slice, NOT the final world.** This document restores the
larger Map Tower mission. It is a decision register, not a migration and not a new gameplay law.
No Veyra authoring coordinate was scaled, resampled or written into Web's 200×200 island.

## Sources actually read (not assumed)

| Source | Ref / head | What was taken from it |
|---|---|---|
| Gameplay Bible §V `5.1–5.4`, §11.5 | `arena/4795760e-soul-of-hero` @ `8421b9c3` `web/ref/bible.md` | world-layer obligations, MAP-* tests, Map→Gameplay data contracts, "geography as final actuator, NEVER gameplay author" |
| `docs/survival/CURRENT_PRODUCT_CONTRACT.md` | map canon `19d8c6ec` | single gameplay law; BUILD-0 integrated slice; A0/A3/A8 ownership; source/POI/road authority |
| `map_tower/REAL_MAP_CONVERSION_CONTRACT.md` | map canon `19d8c6ec` | exact object-class compiler, coordinate warning, pixel-art contract, acceptance gates |
| `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` | map canon `19d8c6ec` | parsed counts, IDs, `conf`, coordinate range, object classes |
| `map_tower/ASSET_STAGING_STATUS.md`, `README.md` | map canon `19d8c6ec` | `STAGING_PARTIAL`, missing families, no Drive fallback, art readiness ≠ implementation |
| A1 `WORLD_ART_HANDOFF.md`, `RESEARCH_AND_LICENSES.md`, `atlas.v1.json`, `world_art_grammar.v1.json`, `first_hour_asset_provenance.v1.json` | `arena/e385312a-soul-of-hero` @ `ce9d4ba2` | 384×256 Godot world truth, 16px grammar, compiled atlas, original/inherited/licence classes |
| Web `core.ts`, `world.ts`, `render.ts`, `engine.ts` | PR38 `8421b9c3` | 200×200 locked-canon island, `TILE=16`, 640×360 camera, 20 tile materials, 4 starts, 17 places, 6 elders, 4 888 sources |

## Three coordinate spaces — never conflate them

| Space | Extent | Unit | Authority | Status |
|---|---|---|---|---|
| Veyra authoring canvas | `world.w=2000`, `world.h=1400` | authoring unit (float polygons, `r` radii) | `VEYRA_GOLD_MAP.sohmap.json`, `meta.status = "GOLD MAP DESIGN - PAPER ONLY - NOT NATIVE PRODUCTION"` | **PAPER** |
| A1 / Godot native world truth | 384×256 tiles | 16px tile, camera 640×360 ≈ 40×22.5 tiles | `data/overworld/hollow_marches.json` + `_layers.json` + `_props.json` (13 299 props), spawn `[56,218]` | **NATIVE** (Godot, not Web) |
| Web playable runtime | `WW=WH=200` tiles = 3200×3200 px | 16px tile, `VIEW 640×360`, `WORLD_SEED=0x50f1` | `web/src/game/world.ts` deterministic generator + authored `starts`/`places`/`buildings`/`statics` | **PLAYABLE** (this slice) |

The conversion contract explicitly forbids inferring that 2000×1400 authoring units equal
2000×1400 native tiles. 2000/16 = 125 and 1400/16 = 87.5 do **not** fit Web's 200×200 either; any
mapping is a **world-scale decision** that must be documented with measured journey times. MAP-R01
therefore mapped **zero coordinates**; it mapped **visual materials only** (A1 authored 16px frames
onto existing Web tile classes).

Veyra parsed inventory (source IDs retained in the JSON): 8 `land` (1 main + 6 satellite + 1 islet),
5 `lakes`, 17 `rivers` (13 river / 1 canal / 3 distributary), 92 `roads` (34 cart / 37 trail /
11 foot / 2 riverside / **8 ferry**), 12 `bridges` (7 cart / 5 foot), 27 `docks` (17 coastal / 10
inland), 81 `pois` (25 archetypes incl. 6 `ragnarok_cache`, 2 `chest_vendor`, 3 `evac`, 5
`elder_site`), 23 `zones`, 280 `resources` (11 kinds, all `gate:"none"`), 4 `spawns`, 6 `elders`
(Surtur/Typhon/Aion/Atlas/Argus/Anubis), 24 `labels`. Most objects carry `conf:"proposal"` or
`"assumption"` — they are **candidates**, not approved gameplay law. The contract's `terrain`
raster (250×175, cell 8) is **not present in this JSON**; it must be sourced before any geometry compile.

## Crosswalk

| Dimension | Veyra source concept | A1 geography / art | Current Web representation | Compatible integration seam (what MAP-R01 proved) | Unresolved differences |
|---|---|---|---|---|---|
| **Geometry** | Authored polygon land rings + holes, 5 lakes, 17 rivers, elevation raster (missing), coast/inlet/isthmus geometry, 23 buildable polygons | 384×256 authored causal landforms (caldera ash fan, moraine terrace, glacial cirque…); immutable static world truth, dynamic mutations keyed by stable IDs | 200×200 **procedurally generated** island from `WORLD_SEED=0x50f1` with `tiles/zone/seaDist/fresh` arrays; coast, river `x110..112,y178..183`, beach `y178..181` are generator outputs, not authored rings | `worldAssetChunk(r,cx,cy,cv)` reads `effTile(r,x,y)` from the authoritative Web state and blits frames **on the engine's own chunk canvas**. It never writes a tile, so any future geometry authority (Veyra/A1/Web) can be swapped under the same seam without touching the renderer. | Three different extents and two different geometry paradigms (authored polygons vs seeded generator). No elevation/slope, hole, strait, distributary, portage, ferry or multi-level concept exists in Web. Veyra terrain raster absent. **No coordinate transform decided.** |
| **Visual representation** | Atlas-level cartography and native 1× regional scenes are two views over the same world data; nearest filtering, 640×360, no opaque pasted background; autotile + seam tests for shore, bends, T/Y/X confluence, river mouths, inlets, delta, bridges | A1 `terrain.png` (1769 rects / 184 families) + `props.png` (164 rects), 16px grid, `filter:nearest`, `scale:1`, feet anchor, shared 72-key palette ramp, 11 biome/lighting profiles, 14 production rules | Web `render.ts` `PAL/PRIO/texel` hash/sine/fbm pixel painting, 16×16 chunk cache, animated water overlay, day/night `drawLight`, y-sorted entities | **This is the delivered bridge**: a 23 547-byte crop sheet of 181 admitted A1 frames + exact `frame_ledger.v1.json` rects/hashes; deterministic material→frame selector; decoded corner/edge transition masks; nearest-neighbour integer blits; 3 minimal `render.ts` seams. Proved on forest/ground/coast day+night at 640×360. | A1 covers grass/forest/sand/tidal/lake/river/dune/road/coast/ash/snow/… but **not** Web's lava, toxic, cliff face, PWALL, FLOOR, ice, burnt, marsh, hill materials — those remain procedural (KEEP). Veyra needs Surtur lava/obsidian, Anubis dune/oasis, Argus exterior, Atlas gateway, functional boats/piers — `ASSET_STAGING_STATUS.md` marks these **missing**. A1 `cainos_*`/`ocean_*` crops are excluded for licence/style. |
| **Resource authority** | 280 `resources` = candidate geometry (`kind`, `dens`, `gate:"none"`); Bible §5.3 `WorldSourceCandidate` says **Map/A1 owns candidate geometry only**, A3/Gameplay decide item source IDs, stock, respawn; A0 commits | `data/overworld/hollow_marches_resources.json`, harvestable nodes pinned to canonical IDs; crown roadside treatment is visual-only, "no collision, stand, cache identity, reward or save change" | `SOURCES` (19 keys) in `catalog.ts`; `w.src` Int8Array (4 888 placed sources); `sourceAt()` → stock/hp/regrow; `harvestHit()` yields real items; `r.sources` dynamic state | `worldAssetSource()` is called only for **real `w.src` cells** inside the existing y-sorted list, with `stock<=0` falling back to Web's depleted sprite. MAP-R01 verified a real LMB harvest raised `skills.gather 0→2` and an A-vs-C authority fingerprint is identical. All A1 prop replacements were **REJECTED** for style; the seam stays available. | Veyra `resources` have no `SOURCES` key mapping, no stock/respawn/yield, and all `gate:none` — Web has gates via tool `power`, POI protection and creature threat. Veyra `fish`/`clay`/`obsidian`/`fresh_water`/`salt` have no Web equivalent. **Do not let a visual sprite become a new source or a new loot table.** |
| **Road traversal** | 92 `roads` with `kind=cart/trail/foot/riverside/ferry`, 12 bridges with `load=cart/foot`, 8 ferry paths needing boats/boarding rules, slope/footprint/loaded-vs-unloaded costs, alternate routes | `crown_roadside.treatment.v1.json` is a visual overlay pinned by SHA; roads are transparent overlays on opaque ground; compiler rejects baking a road frame into the ground row; native cart/bridge collision owned by A0 | `T.ROAD` / `T.BRIDGE` tiles, `SPEED_KEY` (road/bridge/floor/rough), cart entity with `pulling`, `blockedAt` collision grid, `w.fresh` for water | MAP-R01 kept Web's `T.ROAD` fully authoritative and **KEEPed Web's road art** after the A1 plank `road_dirt_*` set read as boardwalk squares. The A1 road blob set remains in the ledger with its decoded `1=N 2=E 4=S 8=W` mask, ready behind `ASSET_DECISIONS.road`. | Web has **no ferry, no boat, no load class, no slope, no bridge span fit, no `WorldTraversal` edge graph**. 8 Veyra ferries cannot become land roads. Cart geometry/slope/bridge collision must be proven natively before any route claim. No travel-time measurement (`t_foot`, `t_cart_loaded`, `exposure_time`) exists in Web. |
| **POI access** | 81 `pois` with archetype, `foot` + `deep` polygons, access/gates/retreat, 23 buildable `zones`; Bible §5.3 `POIAccessGraphCandidate` says **A8 validates interactions, A3/Gameplay own key stock/power/gate, A0 commits state** | A8 PR26 128×128 overworld shells, action socket `(64,64)`, entry portal `(64,108)`; A1 supplies visual skins only; A0 approves mount mode | `w.places` (4 starts + 6 POIs + 6 elders + evac = 17), 14 `buildings`, 30 `statics`, `r.entities` (18 loot crates, 2 doors, vendor, generators, evac); `findInteract()` + `E` + container/vendor/door panels | MAP-R01 proved **POI access intact** in a real browser: `[E] Search crate` at the Net Shed starter crate, `Take all` moved inventory 3→6; I/C/M/B panels open; identical A/C entity fingerprints. Visual-only change cannot break access. | Web POIs are single tile positions + rectangular buildings, not `foot`/`deep` polygons, power nodes, hazard volumes, stand positions or exit paths. Veyra's 25 archetypes (powerplant, academy, quarry, smelter, tomb, gate, chest_vendor, ragnarok_cache…) have no Web interaction semantics. No multi-layer POI, no `escrow` owned-chest route, no no-boss Ragnarok route, no 6 geographically distinct Elder scenes. |
| Spawns / Elders / endgame | 4 named `spawns` (Westmouth, Greywater S., Hook Meadow, Gulf W.), 6 named Elders, 6 `ragnarok_cache`, 2 `chest_vendor`, 3 `evac` | 6 Elder stones, 14-day/72h Ragnarok, first-escrow cash obligation | 4 starts (Meadow Bay, Fisher's Point, Pinewatch, Eastcove), 6 elders (frost/magma/bog/grove/tide/rust), `evac` at (174,23), sealed vault | Verified spawn `(1352,2744)` = Fisher's Point `(84,171)` and the first-hour route are unchanged; HUD clock `CALM Day 1/14` intact. | Names, IDs and geography are entirely different. No Veyra elder identity was mapped onto Web elders. No endgame law was added. |

## Decisions required BEFORE any full-world migration (all still OPEN)

1. **World-scale / transform**: explicit deterministic `Veyra authoring unit → native 16px tile → Web tile`
   mapping, with measured journey times and a documented ratio; decide whether Web becomes
   384×256 (A1 truth), 200×200, or a new extent. **Nothing was auto-scaled here.**
2. **Geometry authority**: replace/augment `world.ts`'s seeded generator with authored land rings,
   lake volumes, river channels/banks/confluences, bridges, docks and buildable polygons — or
   declare Web a deliberately separate, smaller canon. Both cannot be "the same world" implicitly.
3. **Missing source data**: obtain the `terrain` raster 250×175 @ cell 8 with its original encoding;
   Veyra JSON alone has no elevation/biome raster.
4. **ID / authority mapping**: `WorldSourceCandidate`, `WorldTraversal`, `BuildSiteSample`,
   `POIAccessGraphCandidate`, `WorldTimeHazardCandidate`, `RagnarokRouteCandidate` → existing
   Web/Godot APIs. Map owns candidate geometry only; A3 stock/yield, A8 POI, Gameplay law, A0
   transactions. No new loot quantity, price, gate or drop rate may be invented.
5. **Ferry / boat / portage**: 8 ferry paths and 27 docks need an owner-approved boarding rule and
   real sprites; `ASSET_STAGING_STATUS.md` says functional boats/piers are **missing**. Until then
   they are `BLOCKED`, not land roads.
6. **Art coverage**: Surtur lava/obsidian, Anubis dune/oasis, Argus exterior, Atlas gateway,
   industry exteriors/vehicles, autotile-tested shore network — all missing; 43-pack Drive folder
   not accessed, only 5 raw ZIPs are Git-resident on the map branch. Legal clearance must be read
   from the actual granted scope, not a marketplace label.
7. **Pixel / native proof**: 640×360 1× daylight+night captures, native collision/water/multi-level/
   door transitions, FPS/load/streaming benchmark, and **creator visual review**. MAP-R01's A/B/C
   is Web evidence for a first-hour slice only; it is not Veyra native acceptance and not creator approval.
8. **Status labels**: Veyra remains `PAPER`, A1 Godot remains `NATIVE`, MAP-R01 Web slice is
   `PLAYABLE_WEB_SLICE`. Do not relabel any of them based on buildability percentages.

## Remaining integration blockers (concise)

- `BLOCKED-V01` Veyra terrain raster / elevation encoding absent from the committed JSON.
- `BLOCKED-V02` No agreed coordinate transform; three incompatible extents (2000×1400 / 384×256 / 200×200).
- `BLOCKED-V03` No native Godot 4.7 import of Veyra in this workspace; no native walkable/collision/
  water/door proof, no boat/portage.
- `BLOCKED-V04` Staging partial: full 43-pack library, cohesive approved atlas, source/slot coverage
  and verified boat/pier/Surtur/Anubis/Argus/Atlas/industry families not committed.
- `BLOCKED-V05` No `WorldTraversal` edge graph, ferry rules, load/slope/bridge-span validation or
  measured `t_foot`/`t_cart_loaded`/`exposure_time` in Web.
- `BLOCKED-V06` Web POIs are flat tile positions; no `foot`/`deep` polygons, power nodes, hazard
  volumes, stand positions, multi-layer interiors or 81-ID audit.
- `BLOCKED-V07` Web road/resource/prop materials are a different palette from A1 inherited props;
  A1 prop replacements were rejected until a palette-matched pass is reviewed.
- `BLOCKED-V08` Creator visual approval not obtained; PR38 not merged; A1/Godot native and Veyra
  PAPER statuses unchanged.

## Exact next production step

**MAP-R02 — extend the same seam, do not rebuild the renderer.** On a fresh worktree of PR38
`8421b9c3` with `patch/map_r01.patch` applied, do **one** bounded increment:

1. Add the second authored material band to `worldAssets.ts` (`ASSET_DECISIONS` + ledger frames):
   A1 `ash_*`/`snow_*`/`basalt_*`/`moor_*`/`gravel_*` + `blend_snow_basalt_*`/`shore_*` families
   for the Web `T.SNOW`/`T.ASH`/`T.HILL`/`T.MARSH` bands, using the **already decoded** corner and
   edge mask helpers. Keep the exact-crop provenance generation in `tools/build_slice.mjs`.
2. Capture the same frozen-clock A/B/C day+night set at **Pinewatch (74,74) and Frostcrown (72,26)**
   as the second route, using `tools/capture.mjs` with a configurable start; inspect the screenshots
   and record KEEP/REPLACE per new material. Do not enable a material that loses the comparison.
3. Re-run `tsc`, `build`, `npm test`, `tools/verify.mjs` (including the A-vs-C authority fingerprint)
   and produce a fresh patch + SHA.
4. In parallel, **separately** prepare the Veyra geometry decision (items 1–4 above) as a PAPER
   document with an explicit transform and measured journey times; do not write Veyra coordinates
   into Web's 200×200 island until that decision is approved.

That keeps one integrated playable Web slice as the foundation for larger Map Tower production
without mistaking Fisher's Point for the final world.
