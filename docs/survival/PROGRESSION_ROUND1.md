# Web gameplay content & progression — Round 1 checkpoint

**Status: PARTIAL_PLAYABLE/HOLD, not product acceptance.** Based on primary PR #38 `acaa002746061d9e2abe828ccc8a10bba9fc891d`. The canonical law is `web/ref/bible.md`, not this checkpoint. All new numbers and details are provisional tuning. No server verification, Gold FX, main merge, new ecology, forced quest or permanent blueprint system is claimed.

## Phase A: source-derived dependency snapshot

Reproduce current graph with `cd web && npx vite-node scripts/progression-graph.ts ../docs/survival/PROGRESSION_AFTER.json`. [`PROGRESSION_BEFORE_acaa002.json`](PROGRESSION_BEFORE_acaa002.json) is the pre-change extract; [`PROGRESSION_AFTER.json`](PROGRESSION_AFTER.json) includes definitions, ingredient/output/station edges, source placements, POI statics, wildlife, vendor, equipment study, maintenance and upgrade costs. These are source edges, not a proof of traversal or practical obtainability; the before extract uses an earlier version of the generator and lacks some special-use annotations. `rcash` is minted by cash statics in the final 72h, not a normal loot entry; seeds/garden, arrows/bow, blueprint use, keycards/doors, fuel cans/generator and stones/endings are special handlers. A lack of a recipe ingredient edge is not proof an item is useless. Maximum depth counts recipe-to-recipe transformations, not a travel/upgrade edge and not production time.

| Source-derived area | Classification | Evidence and gap |
|---|---|---|
| Source, custody, durability | EXISTS_VERIFIED at code/unit level | `world.ts` physical nodes/static crates; `harvestHit`, `move`, `wearTool`, paid jobs and save validation. No claim every source is reachable by a new player. |
| 34 recipes, 33 distinct outputs before; depth 2 | EXISTS_VERIFIED | `RECIPES`, output/input graph. Tier was not actual workstation capability. |
| Repair/study/salvage before | PARTIAL / MISSING | Existing specimen/Core research had reservation/refund, but ordinary equipment had no corresponding generic paid repair, equipment study or dismantle action. |
| Level-up production before | MISSING | `craft` checked station kind/knowledge/input, not an upgrade level. |
| Offline home before | PARTIAL | `stepStations`, `stepGardensBarrels`, `settle` model funded processes, but crop and meal choices are limited. B2 chronology and hunger-only shelter floor are protected, not re-fixed. |
| Item-use dead ends | PARTIAL | `shell` has a source/drops but no actual gameplay sink found. `palm` has a definition but zero source placements in both measured layouts. Other apparent graph dead ends must be checked against special handlers, not presumed unused. |
| Recipe/output reachability | NEEDS_PLAYTEST | Catalog links, source numbers and `stationNear` are necessary, not a no-boss route proof or creator acceptance. |
| Repaired item / parts / spear / herb roast | PROPOSAL + code/fixture verification | New tuning listed below is not Bible law. Live normal-input and economic duration evidence is limited; see final handoff. |

Read-only historical reference: [Last Island Atlas](https://github.com/Khanh-glitch/Soul-of-Hero/blob/feature/survival-rpg-foundation-20261029/docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md). Its 2019 loot/blueprint and repair, 2020 permanent Operation Base, 2021 Civilization workbench/blueprint changes, 2023 mode-specific directed research and building quotas are distinct historical contexts. Only the broad competing-resource/physical-maintenance idea is inspiration; no 2020 permanent base, 2021 permanent blueprints, PvP/clan requirement, later-mode quotas, odds or prices are imported.

## Implemented vertical slice

- In the existing factory exterior crate, `iron_sword` joins existing scrap/spares for **newly created runs**; this adds loot only, not map geography. Existing runs keep their already-created crate contents. The sword is usable immediately without any research or boss.
- **Workbench:** expand “Equipment maintenance & upgrades”. Knife repair costs 1 scrap + 1 fiber; stone axe/pick cost 1 wood + 1 stone; iron axe/pick/sword and reinforced spear cost 1 ingot + 1 mechanical part; bow costs 1 wood + 2 fiber. Worn eligible item must be in inventory, in a valid slot with matching UID, and the owned workbench within reach. Repair is immediate, restores to definition max, preserves the UID, consumes the physical inputs, refuses zero/full/missing durability and replay. Equipment destroyed when durability hits zero stays destroyed under existing wear rules; no repair of destroyed objects or recharging Cores is implied.
- **Research table:** carried iron sword or hunting bow can enter the existing specimen queue to make its matching blueprint. This is a destructive alternative; the real item/UID is reserved in the job, cancellation returns it or drops it if pack full, destruction bags it, completed output waits if full, and taking/using the blueprint is required to learn. Existing specimen/Core paths remain. Only eligible item types are declared; no universal Core study/recharge.
- **Optional salvage:** iron sword at the workbench can be destroyed for 1 iron ingot, strictly less than its recipe's 5 ingots. The confirmation is explicit; output follows existing give-or-drop custody and command replay validation.
- **Parts/progression:** old recipes remain at level 1. Scrap → furnace `scrap_ingot` (3 scrap + real fuel → 1 ingot) → workbench `mechanical_parts` (2 scrap + 1 ingot → 2 parts) → pay 2 parts + 1 ingot to upgrade that exact workbench to level 2. No refund is promised for the paid upgrade on reclaim/destruction; the station and capability are run-local. Parts compete with iron gear repair and the new spear recipe. Level-2 workbench and learned recipe permit `reinforced_spear` (2 ingots + 1 part + 2 wood; 20 s) and the actual weapon has 23 damage/36 reach/320 durability. Study/Spare research can teach the recipe; no new boss/Core condition. Parts are base-known for **new** runs; existing run knowledge is not silently mutated and can discover the recipe through existing research.
- `station.level` is additive; absent legacy level behaves as 1, validation rejects invalid/new level on wrong station. Previously queued jobs can complete through the existing single scheduler even if missing new capability metadata; no existing recipe gets a retroactive gate. Reclaim/destroy keeps B1 reserved-input/output behavior. An upgrade invests in that world entity only; recreating a station starts at 1.
- **Home cooking choice:** existing funded campfire gets `herb_roast` (meat + Bitterleaf, 10 s; +30 hunger/+15 HP/+8 warmth) alongside `salted_meat` (meat + raw salt, 10 s; +42 hunger/+8 HP/+8 warmth). Bitterleaf also has medicine recipes; salt is sourced from coastal shale. Both output actual food to the same physical station, with existing fuel, capacity and chronological settlement; this is not a food-spoilage simulation and no automatic reward was added.
- A reproducible quick-start browser failure was observed while testing: `Game` could mount without a run/canvas after overlapping asynchronous initial loads and crash at `getContext`. `App` now cancels obsolete load-effect completions, and `Game` guards a missing canvas. This is a focused crash fix, not another Save Manager.

## Before → after counts

| Category | Before | After |
|---|---:|---:|
| Items | 70 | 73 |
| Sources | 19 | 19 |
| Recipes / distinct outputs | 34 / 33 | 37 / 36 |
| Base-known / learnable | 16 / 18 | 18 / 19 for new runs |
| Recipes by tier 0/1/2/3 | 14/10/5/5 | 15/11/6/5 |
| Hand / campfire / furnace / workbench | 7/4/4/19 | 7/5/4/21 |
| Structure definitions | 23 | 23 |
| Station types | 4 | 4; workbench has level 1 and paid level 2 |
| Longest recipe-to-recipe depth | 2 | 3 |

No new source respawn, prices from Last Island, weather, run timer, currency or combat AI authority is introduced. Recipes, parts, equipment, station levels and buildings reset with the run under the existing endRun contract.

## Contract map and proof limits

K1/C03/C04/C07: UID + physical reservation + legal repair/salvage/study. K3/C01/C02: scrap/ore and existing found sword. K4/C06: knowledge, queue, station and paid fuel/output. K6/C07: paid workbench upgrade on a physical entity. K8/C06/C09: serialize/settle in focused tests; offline is the existing model, including hunger-only shelter protection and lethal thirst. J01/J02/J03/J04/J09/J11/J13 are optional observations, not progression flags. No proof here of a complete 14-day player experience.

Focused state tests use explicit fixtures: verify validator/data links, UID conservation, retry rejection, invalid access/cost/action, full pack/output, cancellation/destruction, save round-trip, upgrade gating and both cooking choices under `settle`. These tests are not lawful source-to-target user journeys. The Pinewatch browser journey is normal keyboard/mouse input and uses a read-only QA state hook: it gathered fiber/wood/stone/scrap, crafted a pick, paid for claim and workbench, repaired the actually worn starter knife 201→300 with scrap/fiber, and preserved it across same-browser reload + Continue (`web/evidence/progression-round1/`). It did not acquire the sword or upgrade. The subsequent final engine change only tightened UID validation for equipment study; the knife journey predates that change. The separate existing Salt browser journey is normal keyboard/mouse input and uses a read-only QA state hook; it tests the preexisting Salt chain, not the new sword/upgrade/meal end to end (`web/evidence/progression-salt/`). Salt was run before the final UI collapse and quick-start fix. The separate workbench visual test explicitly injects a synthetic save fixture, then clicks ordinary UI; it is evidence of UI/action behavior only, not source reachability. Both 640×360 and 1280×720 screenshots from the fixture and normal-input knife path were opened for visual inspection. `e2e/quick-start.mjs` passes three fresh-profile fast-start runs without a page error.

## Remaining work

1. Complete and record a normal-input new-game path from physical found sword to iron repair vs actual equipment study and research result; fix concrete interaction blockers, not synthetic edge cases.
2. Run two independent browser processes on the same saved, funded campfire/garden state and collect/use two voluntary outcomes with no time acceleration or injected goods. The previous long HOME→OFFLINE→RETURN campaign remains on HOLD; request permission before running the broader campaign. A short focused restart test is not a human 24h test.
3. Demonstrate upgrade → learned spear → actual target via normal input, and compare contested parts/repair choices; inspect 640×360 and 1280×720 after final code. Confirm actual old-save UX for acquiring newly introduced base recipe.
4. Measure multiple spawn paths, real transit/freight, days 2–7 engagement and final72 no-boss economy; never promote static arithmetic/QA time into 14-day human balancing.
5. Further catalog gaps remain (e.g. shell sink), no season system, turret/structure repair, Gold integration, complete ecology or verified leaderboard claimed. Prices, durability and food benefits require player testing.
