# WMP-04 — Active Veyra geography / marine overlay

WMP-04 is the **active semantic revision of the Veyra World Master** via `../CURRENT_WORLD_MASTER.json` and `../api/current.mjs`. WMP-01/02/03 and archived GOLD are preserved byte-for-byte; changes are new effective layers rather than prohibited modifications to historical source parity.

## Main changes
- Snow biome **217 → 3454 dry-land cells** (23.9994% dry land). Connected northern highland expansion reaches Typhon/Argus and multiple large POIs. Preserves all original snow; the 24% target is a **worldwide land area share** not percent map canvas or seasonal snowfall.
- Desert (5) + dry steppe/scrub (6) **2632 → 3422 dry-land cells**, **+30.0152% relative**. Adds 790 eligible meadow cells east/southeast. Existing dunes remain code 5, added belt code 6.
- Deathwater western sea marine region: 1451 SEA cells, Leviathan world-unique roaming territory, auditory/hazard cues proposed for Gameplay.
- Cinder geothermal strait: 1332 SEA cells; heat vents, steam and currents are **geographical cues**; numeric thermal effects remain Gameplay-owned.
- Engine-failed helicopter: one unique grounded landmark on **Beacon Rock** at AU [272,652], a small island close to the mainland in the western cluster.
- Fixed authored docks; free navigation through contiguous sea water, not ferry rail paths; open-water navigability is only a **geographic candidate** until Gameplay supplies boat/swim vehicle and collision rules.

## Active files and contract
- `../CURRENT_WORLD_MASTER.json`: explicit active revision pointer.
- `../api/current.mjs`: createCurrentWorld() reads V1→V3 physical geometry with **V4 biome, cold transition and marine masks**.
- `src/world_v4.mjs`: deterministic generator (provided source arrays, no GOLD import), and three `data/*.u8` compiled outputs.
- `layers/geography_design.v4.json`, `marine_sites.v4.json`, `marine_navigation.v4.json`: static design/owner boundaries.
- `tests/run_v4.mjs`: validates determinism, coverage, preservation, sites, hazards and consumer shapes. Run `bash v4/reproduce_v4.sh` from WMP directory or `node veyra-world-master/v4/tests/run_v4.mjs` from repository root.

## Integration notes
Do **NOT** let downstream Gameplay load the archived `v3/handoff/map_to_gameplay_v3.json` and assume it reflects active biome geography. Use `createCurrentWorld().candidateEconomyMap()` as an explicitly unapproved bridge and coordinate Gameplay-owned climate/temperatures, sources, equipment exposure and save migrations before runtime adoption. V4 normalized temperature/moisture are **heuristic EconomyMap compatibility candidates**, never Celsius or final damage rates.

Neither the ferry routes nor v4 open sea grant a player vessel, swimming, a fixed boat path or instant ocean encounter. Gameplay must instantiate creatures/vehicles according to its actor/event source-of-truth.
