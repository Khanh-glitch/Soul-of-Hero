# Veyra WMP-04 / creator-directed world design update

**Owner:** Map. **Historical authority:** WMP-01→03 preserved. **Current authority:** `veyra-world-master/CURRENT_WORLD_MASTER.json` -> WMP-04.

## Creator changes
1. Snow coverage expanded from 217 of 14,392 dry-land cells (1.508%) to 3,454 cells (24.0%). Snow connects from Typhon towards northern/Argus highlands (north-most land at Y=128 AU) and encompasses Observatory, Academy, Archive, Hall of Eyes, Kestrel, powerplant and quarry POIs. No POI is moved.
2. Existing combined desert+dry scrub 2,632 cells expanded by 790 suitable adjacent meadow cells to 3,422 (**+30.015% relative**, 23.78% of dry land). The added ring develops east/southeast, avoids water, original snow, beaches, marsh and volcanic/toxic biomes.
3. Western Deathwater (between mainland-adjacent Beacon Rock and distant Threshold/Wreck group): unique large aquatic monster habitat; creature is not immobile or ferry-bound. Danger becomes information-rich via ripples, wake, distant calls, refuge/route choices. Spawn, AI, rewards, persistence remain Gameplay-owned.
4. Beacon Rock: stranded helicopter from engine failure, AU [272,652], one physical landmark. Fixed, not granted to player; potential flight logs/repair/material interaction without minted loot or implied flight mechanic.
5. Strait of Embers between mainland and Cinder Isle: geothermal marine zone with hot water, vents, visible steam and locally varying current/exposure; numeric heat/cold simulation must be owned by Gameplay.
6. Existing harbors/docks remain fixed physical sites; sea routes remain **free-form open-water**, not hard-coded ferry paths. Authored eight ferry lines become optional navigation references only. Foot does not pass on sea; open-water mode and collision permission require Gameplay integration.

## Exact deterministic metrics
- World authoring coordinates unchanged 2000×1400 AU, raster 250×175 cells at 8 AU.
- Source snow: 217, effective snow: 3,454 of 14,392 dry cells = 23.9994%.
- Source desert+scrub: 2,632, effective combined dry: 3,422; +30.0152% relative.
- Changed biome cells: 4,027 on dry land, zero on water/coast; water geometry, POI IDs, roads, docks unchanged.
- West deadly sea: 1,451 sea cells. Cinder hot strait: 1,332 sea cells. No overlap, no land cells affected.

## Integration and required review
The base WMP-03 manifests, artifacts and test evidence remain valid for historical source geometry, not for the updated effective biome. Developers must use WMP-04 active pointer rather than archived GOLD or v3 direct Geo handoff. `candidateEconomyMap()` adapts biome / normalized climate proxies but is NOT GameRoot adoption or a passed Gameplay validator. Gameplay must explicitly approve weather/temperature/monster AI/movement source and population, dynamic resource habitat effects, vessel equipment, unique helicopter salvage, save/restart and 1× visual acceptance.

This is a map-data deliverable with static world/event-site hooks; no native Gameplay work is claimed. Any policy that forbids new machines or vehicles is preserved: crashed helicopter is not usable vehicle until separate Gameplay/Creator decision.

## Open gates
- GPU/renderer/tileset proof for 24% snow, seasonal contrast and hot water (not done).
- World-clock and offline conditions for snow/ice and geothermal heat.
- One unique Leviathan AI/encounter and source custody, no auto-kill, no offline instant destruction.
- Helicopter interaction/collision and optional salvage loot, no duplicated rare items.
- Marine locomotion controls, exposure, currents and disembark mechanics, independent of eight ferry paths.
- EconomyMap validator and native integration with v4 map, including v3 road/cargo/passability caveats.

**No merge to gameplay/main; no runtime/visual acceptance.**
