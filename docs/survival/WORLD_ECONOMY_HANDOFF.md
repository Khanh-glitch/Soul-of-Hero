# World-economy candidate — PARTIAL IMPLEMENTATION / HOLD

**Follow-up:** [WORLD_ECONOMY_CONTRACT_FOLLOWUP.md](WORLD_ECONOMY_CONTRACT_FOLLOWUP.md) updates map-package integration, cart diagnostics and controlled physical route evidence; the overall order remains on HOLD.

**2026-11-03.** This is a playable engineering candidate, not acceptance of the complete portability/economics order. No enjoyment claim and no 336-hour bot campaign were made. The owning geography agent remains responsible for the map. Do not merge this work to main on the strength of these checks.

## Lineage and review

- Session branch: `arena/d4bfcfff-soul-of-hero`; exact candidate is the commit containing this document (`git rev-parse HEAD`). Its parent integrates #44 `0333dee4203f4a6d6752caab1af23049193302b0` and creator/Bible #38 `8421b9c3335c7648488ce8ae5dab43eb5787977e` through merge `8e1b0c8`.
- The session is restricted to that branch. A separate new branch/PR was not possible. Publishing this candidate fast-forwards the existing draft [#44](https://github.com/Khanh-glitch/Soul-of-Hero/pull/44); the earlier candidate remains recoverable by SHA above. [#38](https://github.com/Khanh-glitch/Soul-of-Hero/pull/38) and #44 remain open; neither was merged or force-pushed. #44’s earlier narrow `READY_FOR_CREATOR_REVIEW` status does **not** apply to this expanded order.
- Canon is `web/ref/bible.md`: solo/offline-first, 336 real hours with final 72-hour Ragnarok, stable geography and run-local physical sources/gear/buildings/recipes/Core, and only approved achievements/history/legitimately secured currency across runs. Cores, Elders, homes and POI/quest progression remain optional. Gardening starts manual; any later automation must be paid, physical and causally ordered. This change does not implement farm automation.

## Play and reproduce

```sh
cd web
npm ci
npm run dev -- --host 0.0.0.0
# or: npm run build && npm run preview -- --host 0.0.0.0
npx tsc --noEmit && npm test && npm run build && npm audit
node scripts/world-economy-report.mjs
node scripts/world-economy-report.mjs --fixture
node scripts/haul-diagnostic.mjs
```

Final local verification: TypeScript passed; 132/132 tests passed; production build succeeded; npm audit reported zero vulnerabilities. The three focused production-browser smokes above passed after the final build. There is no independent CI or human playtest result.

New runs use placement v3. WASD moves, mouse aims, hold left click to harvest with a suitable active tool, E interacts, I opens inventory, C opens crafting, B builds, M opens map. The HUD reports wear and unmet costs. Exhausted sources now give an explicit toast; map shading uses the run’s source version, rather than the old v1 map. Claims no longer use a blanket landmark-distance ban; they are rejected on the current adapter’s protected road/entrance/static/start masks and normal physical restrictions. This is **not** yet proof that all building placements preserve an actual cart corridor or every POI escape.

Evidence is in `web/evidence/world-economy/`: six fresh-profile 640×360 and 1280×720 world/inventory/crafting captures. They are real browser captures, not mockups. At 640×360 HUD and log text are quite small; panels obscure much of the world. `e2e/world-source-smoke.mjs` additionally walked from Pinewatch with real keys and harvested a v3 bush with the knife, without injecting or teleporting state. `e2e/integration-candidate.mjs` covered fresh movement, berry use, inventory/crafting, save/reload and real #44 v2 save → candidate → reload; `e2e/world-economy-smoke.mjs` captures the two world sizes. Use `GAME_URL`, optionally `CHROMIUM_PATH`, and for compatibility set `COMPAT_URL`, `COMPAT_INDEX`, `EXPECT_SOURCE_VERSION=2`; the script replaces the compatibility server's index **after** creating the old save.

## What is implemented and what portability actually means

`world-economy.ts` accepts map ID/revision/seed/bounds/tile scale and row-major semantic terrain, climate, water/coast, foot/build/cart, road, protection and industrial masks. It validates missing/invalid basic fields, uses seeded per-source weighted competition, restricts spawning to reachable legal land, preserves roads/protected geometry, separates adjacent blockers and removes isolated candidates. Road salvage is adjacent to a start-reachable cart-passable road. Industrial density is permitted only around an explicitly tagged authored industrial site. It never draws a road/POI or invents an absent resource source. Missing 30-step wood/stone/food/salvage/freshwater/buildable capacity generates diagnostics rather than spawning magic supplies. A bounded 72×48 two-landmass/isthmus fixture with crossing and authored descriptor runs the same compiler and basic handoff validator; an explicitly missing-water case reports it, with no manufactured iron/sulfur. It is **not a playable second map** and does not prove spatial mechanics beyond those tests.

The shipping adapter derives climate/moisture proxies and protections from existing generated geometry, and tags the already-authored Foundry hall as industrial; it does not redraw geography. `geography-contract.ts` adds an explicit richer road/width/bridge, POI footprint/entrance/room/door/power/hazard/loot/retreat, build/loading, cash/vendor/evacuation and critical-path handoff validator. **This validator is a first schema/sanity gate, not yet wired to a complete shipping or second playable map and not a proof of connectivity or finite authored loot.** The shipping map lacks authoritative climate, road widths/loading regions, hazard and detailed POI room/gate/power/loot/retreat metadata; this remains a Map Agent dependency. The source raster’s 30-step checks and a cash/vendor collision-grid test are engineering diagnostics, not a physical end-to-end route.

## Normalized geography and economic diagnostics

`WORLD_ECONOMY_METRICS.json` is reproducible output from `scripts/world-economy-report.mjs`, comparing old v2 source cells to v3 within the **same** map-provided, walkable, unprotected, slope≤0.6 eligible biome cells. These are source-node counts, not harvest yields or an accessibility/quality guarantee. Rates below are per 100 eligible cells:

| Eligible geography | v2 → v3 |
|---|---|
| Forest, 4,520 cells: oak + pine | 40.62 → 16.13 |
| Hill, 726 cells: rock + iron + coal | 14.46 → 13.22 |
| Sand, 645 cells: palm / salt shale | 1.86 / 22.33 → 3.41 / 12.25 |

For 446 orthogonal cargo-road tile-graph edges (7,136 world pixels; not a surveyed centerline), roadside scrap within 2–3 Manhattan cells is 55 → 72, or 12.33 → 16.14 nodes per 100 edges; wreck is 12 → 6, or 2.69 → 1.35. Graph widths/junctions can overcount road centerline. Road reports are proximity to any cargo-passable road, whereas actual placement additionally checks connection to a start. At 30 foot steps, s0 reachable cells go 1,073 → 1,358 with wood 226 → 118, stone 13 → 13 and food 49 → 47; s1 goes 729 → 1,361 and its freshwater diagnostic changes false → true. All four v3 start diagnostics pass. The exact data and per-start alternatives are in the JSON. Forest reductions and different node types are material balance changes requiring human review; totals do not establish replenishment or fairness.

On the independent synthetic isthmus, `WORLD_ECONOMY_FIXTURE_METRICS.json` reports v3 forest oak+pine 138/987 = 13.98 per 100 eligible cells (shipping 16.13), marsh willow+reed 80/418 = 19.14 (shipping 116/660 = 17.58), and roadside scrap 12/69 = 17.39 per 100 road edges (shipping 16.14). West/east 30-step reachable areas are 1,200/1,165 cells with 53/138 wood, 18/18 stone, 46/41 food and 11/5 salvage; both have freshwater. Its hill/sand/ash eligible area is zero, so density there is undefined, not zero-performance; no legacy baseline exists for this invented fixture. These comparisons are geometry-normalized compiler diagnostics, **not** a playable alternate map or proof of equal experience.

`WORLD_ECONOMY_HAUL.json` estimates a shortest-*tile-count* route from each start to outside the Foundry and applies current terrain/weight multipliers. At s0: 114 foot tiles, ~25.8 s empty and ~73.8 s with 100 stone (120 kg); a different 130-tile cart-mask route is ~48.9 s empty/~62.3 s loaded. Empty-out/loaded-return estimates are ~99.6 s foot versus ~111.2 s cart, not a demonstration of a cart benefit. These are kinematic calculations, not continuous-body/cart-rope tests: no collisions at corners, doors, pick-up, construction, water, danger or changing weather were simulated. Starts are not established home plots; faster paths may exist.

A best-case accounting illustration for that load: a full boulder has 6 stone and 18 HP. A stone pick has power 3 and 450 ms/swing, so 100 successful hits across at least 17 boulders can produce 100 stone in ~45 s of swing animations and consume 100 of its 180 durability. This excludes finding nodes, aiming, pickup and return-trip detours; the pick itself costs 3 wood, 4 stone and 1 rope (3 fiber), has weight 1.5, and its paid full repair needs a workbench plus 1 stone and 1 wood. Using the illustrative foot legs + swing-only ~144.6 s, baseline drains at 2.4 hunger and 3.6 thirst/minute are ~5.8 and ~8.7, before terrain/weather effects and other work. The stone competes with claims, tools and construction. A cart requires learned recipe and a workbench, 24 wood, 3 iron ingots and 4 rope (12 fiber), plus furnace inputs/fuel and at least 30 s of three ingot processing and 25 s cart crafting; taking those inputs away from buildings/tools matters. None of these numbers proves net economic advantage or that a naturally loaded cart reaches the target. Cargo capacity, weight, and return legs cannot be replaced with a straight-line distance claim.

A focused test finds a nonboss cash chest with face value above the 30-cash escrow price and a vendor reachable on a tile graph after unlocked doors are opened. Existing transaction tests pay, build and deposit with injected materials/teleports. We have **not** demonstrated the complete natural chest→vendor→claim→escrow→positive deposit route, three practical home sites, real loaded cart passage, an exterior-to-deeper-POI chain, or weather/consumable-safe alternatives. Do not infer these from the graph. No numerical enjoyment or balance conclusion is warranted.

## Save identity, custody and risks

The legacy positional `SRC_KEYS` order is frozen, and v1/v2 continue to use the old base grid plus v2 Palm overlay and original per-cell stock/burn deltas. New runs only use v3. They record map ID/revision/seed, rules version and a deterministic source-grid digest; load/save validates it before applying deltas. The digest is an accidental-change guard, **not authentication**. Changed geography/rules or catalog behavior must not silently reinterpret a v3 save: retain the exact v3 generator/data or implement an explicit, tested cell-and-custody migration before altering it. Current behavior rejects mismatches; it does not migrate them. Rolling back to older code is unsupported and mixed-version copies can lead to selection/quarantine of an older valid snapshot. Back up browser storage before experimenting.

Browser forward compatibility used an actual #44 `0333dee` v2 executable, compared run identity, position, inventory UIDs/quantities, entities, source deltas and knowledge before/after save/reload. The exercised save was early and did **not** cover queued jobs, player buildings, real cart cargo, fire or deep depleted-source histories. Unit tests exercise v1 identity, depleted v2 palm with physical loot UID, v3 depletion and digest rejection, as well as separate earlier cargo/job/chronology custody cases; they are not a complete migration audit. `blockGrid` rebuilds all 40,000 v3 cells when dirty, so profiling under repeated construction/fire events is still needed. Offline cold currently omits cloak insulation, and cart pulling currently ignores the player's carried-load penalty; these are known pre-existing model limitations, not hidden balance assumptions.

## Last Island: dated source review, not copy-pasted canon

Reviewed 2026-11-03; sources refer to dated modes/updates and do not establish current universal drop probabilities.

- **ADOPT (high confidence, official):** physical placement must not float inside terrain or rocks, from [2019-11-07 update](https://hero.yingxiong.com/info/2019/1107/8181.html); landscape, road, POI, tree and ore changes interact, [2019-10-31 update](https://hero.yingxiong.com/info/2019/1031/8033.html).
- **ADAPT (medium/high, official site’s 2019 player guide):** airport exterior scavenging and deeper gated/powered/risky rooms coexist; [2019-08-05 airport guide](https://hero.yingxiong.com/info/2019/0805/7010.html) and [2019-08-07 access-card guide](https://hero.yingxiong.com/info/2019/0807/7028.html). SOH must retain optional alternatives, actual authored gates/fuel/hazards, finite loot and retreat, not compulsory card progression.
- **ADAPT (high for source, design not canon):** paid repairs/material investment and directed knowledge from [2019 FAQ](https://hero.yingxiong.com/info/2019/0730/6973.html), [2020 operations base](https://hero.yingxiong.com/info/2020/0826/10634.html) and [2021 Civilization mode](https://hero.yingxiong.com/info/2021/0629/11237.html), constrained to SOH's physical, run-local economy. Sources describe different eras/modes, not one fixed specification.
- **REJECT:** persistent bases/resources or PvP reset assumptions from those modes; SOH's only allowed cross-run economic value is legitimately secured currency.
- **UNKNOWN:** specific drop chances, guaranteed locations and external recipe quantities. Guides disagree or describe different versions. The requested 9game page `https://www.9game.cn/news/3425504.html` returned a CAPTCHA; no numeric recipe assertion from it is used.

## Most useful next step

Obtain a Map Agent-authored, playable second topology with the complete handoff and integrate it into the real runtime; then exercise three physical claim/escape/load sites, complete a nonboss positive escrow route, and drive a genuinely loaded cart through the corridors at both viewports. Validate real gate/power/fuel/loot/retreat paths and compare normalized source, road and reachable-area distributions on both maps. Only then decide tuning and request human play feedback. Keep HOLD until these gaps and version-preserving migration/rollback policy are resolved.
