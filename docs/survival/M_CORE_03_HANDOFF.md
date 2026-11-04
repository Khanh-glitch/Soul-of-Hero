# M-CORE-03 — Gameplay checkpoint

Authority `web/ref/bible.md`; PR #44 remains DRAFT/HOLD. Preflight 2026-11-04:
local and fetched branch both `bfbf44df9ebf403290dce45ff197327947762e8e`;
Control Tower queued this session; no newer public branch commit or concurrent
claim observed. This file is an implementation handoff, not canonical law.

## A/B: source truth and E04

Before this task: physical UID/custody and finite wreck harvest, direct spares,
three research routes, reserve/cancel/refund jobs, player workbench levels and
output containers already existed. Do not count them as new.
`RecipeDef.tier` is discovery complexity; `stationLevel` alone is equipment
capability. `permitsDirectedResearch` and `requiredStationLevel` now explicitly
encode that independent contract in engine and UI, with no gate changes.
Known recipe + real ingredients + reachable station are independently required;
level 3 is not added. Random study excludes Cores until the non-Core unknown
pool is empty; directed tier 3 is refused; specimen study or a physical
blueprint remains available. A specimen is consumed into a timed physical
blueprint job; the blueprint must be retrieved and used.

| Tier-3 recipe | Original source / learning path | Materials → station / function |
|---|---|---|
| Ember Core | Found in keyed Foundry vault in shipping; study it, or a research-produced blueprint | 3 sulfur + 8 spares + 1 crystal → level 1 workbench; 3 fire charges |
| Quake Core | Shipping Foundry vault has its blueprint; study a found Core if obtained; random pool only when non-Cores exhausted | 3 iron ingots + 8 spares + 1 crystal → level 1 workbench; 3 earth charges |
| Storm Core | Shipping powered lighthouse Core, then study; or late random blueprint | 2 glass + 10 spares + 1 crystal → level 1 workbench; 4 chain-lightning charges |
| Rime Core | Shipping Halcyon Hull Core, then study; or late random blueprint | 3 crystal + 8 spares → level 1 workbench; 3 frost charges |
| Chitin Plate | Cinder beetle yields chitin and 30% horn specimen; study horn or random blueprint | 6 chitin + 2 leather → level 1 workbench; body armor 35% |

Crystals require ore-capable tool, snow/hill source; sulfur vent needs ore tool
or beetles, glass needs furnace, spares comes from industrial sources/crawler,
leather from hide and bench. This traces existing dependencies, not measured
route or player-time feasibility. Shipping statics are not Veyra LR02 POI
population; bounded Veyra windows currently have no authored loot/elder statics,
so the above original-item Core path is not asserted there. There is no reason
in existing data to convert tier to level 2; preserve it. Exact practical route
and rare resource population need playtesting and Map/Gameplay integration.
