# LR01 / K6 player-built base systems — gameplay handoff

**Status: bounded implementation checkpoint; PR #44 remains DRAFT / HOLD, not a merge recommendation or full-game acceptance.** Branch `arena/d4bfcfff-soul-of-hero`, on the existing runtime map and trace/economy baseline. Review code checkpoint `86bfb06c0d44a57cb1b67d36b9c85fceb2d94289`; this document is committed afterwards. The exact final branch head is given in the PR update and can be read with `git rev-parse HEAD`.

| Milestone | Status | Pushed code commit | Qualification |
| --- | --- | --- | --- |
| A — rooms, roofs, access | **PARTIAL** | `88c4067455519f6c6cf21a53ead3cd70ae5adb86` | Shared room traversal and wall-aware access work on existing player and POI adapters. Construction placement still checks distance, protection, occupancy and support but **does not trace intervening walls**; authored Veyra POI rooms and scale are not integrated. |
| B — paid in-place upgrades | **DONE for the listed structures** | `4285bcf80cc7a27d64b16d781e1469a97598283b` | Wood→stone→brick walls, wood→iron doors, wood→stone floors, thatch→tile roofs, small→large chests; not a universal station-upgrade system. |
| C — local power and defense | **DONE as a bounded slice** | `4e24d7f3ff9e905ad41a803f3cba621f2884028d` | One explicitly linked generator/turret pair per generator, real fuel/ammunition/target and live projectile; no offline turret shots or general power grid. |
| D — build UX and feedback | **DONE as a bounded slice** | `86bfb06c0d44a57cb1b67d36b9c85fceb2d94289` | Searchable categories, edit-layer selection, costs/condition/ownership, device and firing feedback at both requested viewport sizes. Text remains small at native 640 and needs human review. |

## What works and what is not implied

- `roofRoom` traverses connected, roof-covered cells and physical boundaries with no former 90-cell cap; player floor/roof pieces and existing Map POI roof rectangles are separate inputs to the same room/shelter/reveal queries. Closed doors/walls divide rooms, openings affect shelter, and rendering fades only the player's connected room. Removing a supporting floor via destruction removes its roof. Walls and closed doors also obstruct normal structure/container reach; this does not establish a complete swept-path or placement-LOS rule. The current POI adapter uses the existing authored runtime rectangles and walls, **not** the future Veyra room/portal handoff.
- An upgrade pays the full target tier cost, keeps entity ID, location, claim/owner and HP proportion, and expands a chest without replacing its container or contents. Repair pays existing quarter-cost for quarter max HP; reclaim refunds the existing 50% rounded-down policy and bags custody. Protected sites and claims still apply. Reclaiming a supporting floor requires first removing the roof. Station queues are not rewritten by these structure upgrades; existing custody/reclaim rules remain in force.
- The paid Field Generator (3 iron ingots, 3 mechanical parts, 4 spares, 6 wood) consumes real fuel while switched on, including while away. The paid Arrow Turret (10 wood, 2 iron ingots, 2 mechanical parts, 2 fasteners) must be loaded with real arrows, enabled, and linked to one owned generator within three runtime tiles through an unobstructed physical line; one generator supports at most one turret. This is an explicit nearby link, **not placed wire, a network graph, or an electrical-capacity model beyond one consumer**. The turret picks an actual live hostile in range/physical line of sight, aims, consumes one arrow and emits a real projectile with 16 damage. Fog/storm reduce sight. Structures can take existing legitimate physical impacts and destruction bags stored contents; there are no invented raids. Missing fuel, ammunition, link, line of sight or target prevents firing. Indicator, aim, flash, HP and actual shot/damage are visible.
- During offline settlement the generator burns finite existing fuel chronologically; the turret does **not** acquire targets, expend arrows, deal damage or fabricate kills. Prior bounded trace-actor playback remains bounded (≤24 initially evidenced creatures, ≤2,400 frames of ≤50 ms per settlement, deferred unsupported situations); this is not generalized offline world replay. See `TRACE_GROUNDED_HOME_SAFETY.md`. Save fields are additive/validated; rollback to an older build is not supported.
- B opens the categorized searchable catalog; placement preview reports materials and the current `buildReason` (not a promise of LOS). U/V/X select upgrade/repair/dismantle, mouse selects a tile, G cycles auto/wall/object/roof/floor. The HUD shows the selected structure, HP, ownership and applicable cost/refund. E opens a nearby device; generator and turret panels expose stored fuel, arrows, link and state. Device indicators do not expose hidden enemy locations.

## Verification and fixture disclosure

On the code checkpoint, `cd web && npx tsc --noEmit && npm test && npm run build && npm audit` passed: **199 tests in 20 files**, production build, **0 audit vulnerabilities**. `tests/k6-spatial.test.ts` includes a 12×10 rectangle over the old limit, a real three-cell L shape, separate rooms and door/access cases, upgrades and custody. `tests/k6-power.test.ts` covers target damage/arrow and fuel consumption, blocked/disabled/no-fuel/no-ammo states, save/reload, one-consumer capacity, destruction custody and no offline shots. These are automated checks, not human play or economy balance approval.

Inspected browser demonstrations use real keyboard, mouse and panel actions at **640×360 and 1280×720** unless noted. All are short controlled setups using injected materials, positions or targets; they are not natural resource gathering, a 336-hour campaign, or a human enjoyment/readability study.

| Script and evidence | What was actually exercised |
| --- | --- |
| `e2e/k6-building-ui.mjs`, `evidence/k6-ui/` | Catalog search/category; mouse-paid wall and floor on the same tile; U/G layer selection and paid wall/floor upgrades. Claim, starting supplies and position are fixture setup. |
| `e2e/k6-repair-reclaim.mjs`, `evidence/k6-edit/` | Paid fixture wall with **injected damage**; real V/click repair from 80→120 HP and X/click reclaim/refund. |
| `e2e/k6-device-build.mjs`, `evidence/k6-device-build/` | Paid generator and turret built with build-menu clicks, inventory Shift-click fuel/arrows, E/panel switch/link/start. Claim and supplies injected; no combat target. |
| `e2e/k6-power-smoke.mjs`, `evidence/k6-power/` | Paid fixture devices/fuel/arrows, actual E and panel controls; controlled wolf and position: one shot, arrows 8→7, wolf HP 50→34; browser save/reload retains link and generator state. Original C screenshots are retained; rerunning regenerates them. |
| `e2e/k6-upgrade-smoke.mjs`, `evidence/k6-upgrade/` | Controlled paid wall; real U and click upgrade, both viewports. Original B captures retained. |
| `e2e/k6-rooms-smoke.mjs`, `evidence/k6-rooms/` | Small two-room fixture built with paid dispatch transactions and injected supplies/position; real E opens the shared door and D walks through; captures closed/open/entered. This is not a large-room browser playthrough. |
| `e2e/k6-previous-save.mjs`, `evidence/k6-save/` | At 640×360 an actual browser-created save from pre-K6 commit `0b2ba508cba71e48242f871e4a47c8506165dd20` is continued by the candidate and saved/reloaded, preserving run/source identity, position and inventory. |
| `e2e/trace-door-smoke.mjs`, `trace-combat-save-smoke.mjs`, `trace-home-consequences.mjs` | Prior real-input door/torch, committed combat save, and controlled trace/home consequences remain working. Controlled already-provoked boar follows generated marks and impacts a door; broken/undiscovered controls do not. Historical screenshots remain under `evidence/trace-home/` and `evidence/trace-consequences/`. |

Reproduce from `web/` with an already running candidate Vite server on port 4191 (or set `GAME_URL` for scripts that accept it):

```sh
npm ci
npx tsc --noEmit && npm test && npm run build && npm audit
npm run dev -- --host 0.0.0.0 --port 4191  # separate terminal
# A locally installed Playwright Chromium normally needs no env vars.
# In this sandbox: export CHROMIUM_PATH=/tmp/chromium LD_LIBRARY_PATH=/tmp/chromelibs/lib:/tmp
for t in k6-building-ui k6-repair-reclaim k6-device-build k6-upgrade-smoke k6-power-smoke k6-rooms-smoke trace-door-smoke trace-combat-save-smoke trace-home-consequences; do node "e2e/$t.mjs" || break; done
```

For the true older-build save check, extract the old commit without switching branches and start it separately, then run the script:

```sh
# From repository root; use a clean temporary directory.
mkdir -p /tmp/k6-previous
git archive 0b2ba508cba71e48242f871e4a47c8506165dd20 web | tar -x -C /tmp/k6-previous
ln -s "$PWD/web/node_modules" /tmp/k6-previous/web/node_modules
(cd /tmp/k6-previous/web && npm run dev -- --host 0.0.0.0 --port 4192) # separate terminal
(cd web && node e2e/k6-previous-save.mjs) # candidate on 4191, old on 4192
```

The browser scripts overwrite their own evidence directories, including historical ones; restore tracked prior captures if only validating. No independent exact-SHA CI or human playtest is claimed.

## Map dependencies and ownership — exact pins

Inspected at checkpoints A/B/C/D: Map branch `map/veyra-gold-asset-canon-20261102` remains `19d8c6ec820f324a6ac12733165e43b5e2c6eab2`; `main` is `5214788933b1a827f3a177d11ff486433dfe5e8a`. The geography-only foundation `world_lab/geo02/output/geometry_package.v1.json` is separately pinned at `c6a900ae39fb05a83058606a80035a34021cd69d`; see the [architecture ACK](https://github.com/Khanh-glitch/Soul-of-Hero/pull/44#issuecomment-6608030530) and [scale benchmark](https://github.com/Khanh-glitch/Soul-of-Hero/pull/44#issuecomment-6606283007). No Map files were edited or merged.

| Dependency / concrete source | Field and units / incompatibility | Owner and expected resolution |
| --- | --- | --- |
| MAP-GEO / MAP-SCALE: `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` at `19d8c6ec` | `project.world.w=2000`, `h=1400`; `project.terrain.cell=8`, `gw=250`, `gh=175` in Map authoring units. Runtime is 200×200 cells and TILE=16 render/gameplay pixels. Conversion and physical scale are **UNKNOWN**, not 8:16. | Map preserves source IDs/frame/provenance and supplies/approves the transform as part of existing scale work; Gameplay owns runtime compilation, physics and performance decisions. Do not force/crop Veyra into 200×200. |
| POI `po_academy`, `project.pois[].foot`, `at`, `rot`, `scale` at `19d8c6ec`; GEO-02 `poi_po_kilns.proposed.v1.json` at `c6a900ae` | Gold polygons are authoring-space footprints; actual runtime-consumable room/roof/entrance/portal topology and placement/socket clearances are not generally established by a footprint. Proposal status is not canonical playable geometry. | Map owns source-traceable POI shells, room/portal/opening/roof geometry, orientation, socket locations and explicit UNKNOWNs. Gameplay owns dynamic doors, damage, lock/device state and later adapter/compiler. |
| GEO-02 route RT-1 `sp_lake → po_kilns`, `rd_b`, `br_4`/`br_a` at `c6a900ae` | ~400.1147 authoring units; cart/foot segments and crossing points do not prove a continuous cart road, bridge deck, swept width or clearance. | Map owns physical route/deck/clearance evidence and connectivity; Gameplay owns vehicle simulation and conversion after an agreed transform. Do not claim a tested Veyra cart route. |
| `web/src/game/geography-contract.ts::GeographicHandoff` and `map-package.ts::RuntimeMapPackage` at code checkpoint | The former requires economy, gameplay cash/vendor/loot/power population; the latter requires populated 200×200 runtime data. Neither is a pure Veyra geography-only intake. | Joint follow-up: Map exports pure stable-ID geography; Gameplay validates/populates it and compiles a RuntimeMapPackage. Do not require Map to author gameplay states or rebrand the mixed validator as the agreed contract. |

**Remaining review work:** resolve construction reach/LOS without invalidating legitimate queues/access; implement and validate the approved geography-only seam and authored POI adapters after Map data/scale are ready; broader power-network and general offline scheduling only if explicitly scoped; human playtest at native scale and evaluate natural acquisition, usability, balance and the full run lifecycle. No mandatory upkeep, PvP raids, synthetic geography or scripted quests were added.
