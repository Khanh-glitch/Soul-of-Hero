# R3 corrective round — Veyra overworld

Base: `2408128e` (rejected R2). This round: `515f2b91` + this commit, branch `arena/103e4440-soul-of-hero`.
Canonical inputs: `map/veyra-gold-asset-canon-20261102` (Bible, `REAL_MAP_CONVERSION_CONTRACT.md`,
staging registry) are **retained unmodified**; the only compiler of record is
`tools/world/veyra_compile.py` → `out/`, mirrored to `world/assets/`.

## Gate table (commands, not claims)

| Gate | Command | Result |
|---|---|---|
| A world built from GOLD | `python tools/world/art_registry.py && python tools/world/veyra_compile.py` | 2217 objects, 118876/175000 solid cells, 8000×5600 |
| B spatial validation | `python tools/world/validate.py` | **12/12 PASS** → `docs/map_tower/SPATIAL_VALIDATION.json` |
| C browser (real) | CI `veyra-r3-browser` run **41380615359** | **PASS**, job `browser-capture` 1m16s |
| D Godot 4.7 native | — | **BLOCKED** (no binary, no libGL/Mesa/Xvfb) |
| E visual acceptance | creator | **NOT CLAIMED** |
| F source fragmentation | one registry + one manifest, 14 SHA-pinned sources | PASS |

`validate.py` checks geometry, not IDs: GOLD hash, class counts, `world_px == gold*4` for every
POI/bridge/spawn/resource (0 off-transform), 8 ferries and ferries never in the road list, 24/27
dock anchors verified against collision **and** the named water body with 3 explicitly rejected,
12/12 bridge landings connected through the deck by flood fill, 12/12 railings hold against a
12×8 px D051 feet box, 19/20 unbridged perpendicular river crossings blocked at 4 px sampling,
81/81 POIs have walkable ground within 6 units, 4/4 spawns walkable, 54/81 POI centres reachable.

Browser evidence (CI, real Chromium, not a canvas simulation): page served over HTTP, both
atlases decoded at full size (8000×5600 world, 384 px hero sheet), `keyboard_moves_avatar` proves
real key events move the avatar >10 px, every capture must keep >30 % non-blank canvas pixels,
M toggles the minimap, and no console/page errors are permitted. Captures: 4 spawns, 6 elders,
12 bridges, 3 docks, 6 POIs, world overview — artifact `veyra-browser-evidence` on the run.
The sandbox has no route to `*.blob.core.windows.net`, so I could not re-open those PNGs locally;
they are downloadable from the Actions run link above.

## What changed in the map itself
- Bridge kits: deck + rails with real collision (`& False` removed), 2.5-unit approach aprons,
  landings exported and proven reachable — the crossing is now a walkable structure, not a mask.
- Black-block and void tiles eliminated: `rubble` filtered to its 3 lit tiles (18 near-black tiles
  were painting the ground black), `stone` trimmed to 4; `crypt_wall`/`cliff` sheet blocks are no
  longer used as ground props; stone wall sprite now aliased as `struct_wall`.
- Water: procedural 2-tone dither replaces the seamy sheet; shoreline shelf/foam kept.
- Distinct regions: Surtur volcanic ash (1.8 %) and Anubis dry necropolis soil (2.4 %) from GOLD
  elder rings + zone soil vocabulary, not a label.
- Three resolved reference areas: `river_village`, `bridge_quarry_corridor`, `maritime_landing`.

## Remaining gaps (explicit, not hidden)
1. Bridge decks still draw with a stone texture; the plank/post kit is not built yet — geometry is
   correct, the deck *art* is not a bridge kit.
2. Docks: 24 accepted piers, 3 rejected (`dk_emberport`, `dk_gulfhead` land anchor solid,
   `dk_mirage` anchor outside its named lake). Rejection is recorded, not papered over.
3. `crypt_door` still serves as the village door sprite — recognisable but not ideal.
4. 27 of 81 POI centres are not reachable on foot from any spawn (water-locked or prop-blocked);
   POIs still have walkable ground within 6 units, so this is a routing gap, not a sealed map.
5. Native Godot 4.7 gameplay is still unvalidated; no capture exists from the engine.

## Status split
- **Technical progress:** gates A/B/C/F pass with logs; collision, anchors, crossings, hydrology and
  the ID-count validation are genuinely replaced by spatial assertions.
- **Visual acceptance:** open. The creator-rejected images are improved but bridge/dock kits and
  some structure sprites remain below the bar; I do not claim acceptance.
- **Git integration:** `515f2b91` (+ this commit) pushed; canonical docs untouched; no new authority.
- **Gameplay integration:** the walk test runs in real Chromium with real input and passes; native
  engine parity is still untested. Not merged to production.
