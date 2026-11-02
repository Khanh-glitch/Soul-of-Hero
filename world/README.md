# Veyra overworld (corrective build)

Compiled from the creator-approved GOLD map `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json`
(SHA-256 `88780f78…`), using **only art committed to this repository**.

```
python3 tools/world/art_registry.py     # curated, SHA-pinned sprite registry -> map_tower/assets/VEYRA_ART_MANIFEST.json
python3 tools/world/veyra_compile.py    # out/world.png, out/world_meta.json, out/solid.npy  (~9 s)
python3 tools/world/audit.py --gates    # GOLD coverage audit + determinism gates
python3 -m http.server 8011 --bind 0.0.0.0 --directory world
#   -> http://<host>:8011/  (walk test)
node tools/world/walktest.mjs http://127.0.0.1:8011/web/    # headless logic test
```

## Architecture

| layer | resolution | notes |
| --- | --- | --- |
| GOLD geometry | 2000×1400 units | polygons, polylines, points straight from GOLD |
| visual raster | 4 px/unit → 8000×5600 px | rivers, roads, bridges, piers, water sheet rasterised here, so authored widths survive |
| ground art | 32 px Cainos tiles, 250×175 cells | 1 GOLD cell = 1 art tile |
| collision | 16 px cells, 500×350 | a 10 px river cannot block a 32 px cell |
| objects | pixel placement, y-sorted | curated Cainos props/plants/structures |

`world_meta.json` schema `soh.veyra.world.v2` carries `source` (GOLD + art hashes), `scale`,
`spawns`, `pois`, `resources`, `zones`, `lakes`, `rivers`, `roads`, `bridges`, `docks`, `elders`,
`labels`, `lands`, `collision` (RLE per row over the 16 px grid) and `art_gaps`.

## Controls

WASD / arrows walk, Shift runs, M toggles the minimap, 1–4 jump to the four GOLD spawns.

## Honest status

- Gate A (source fidelity): **PASS** — 579 objects audited, every GOLD id exactly once,
  GOLD SHA matches, counts 8/5/17/92/12/27/81/23/280/4/6/24 all match.
- Gate B (determinism): **PASS** — two clean builds under `PYTHONHASHSEED=1` and `987654`
  produce identical `world.png`, `world_meta.json`, `solid.npy`.
- Gate C (runtime traversal): **PARTIAL** — headless VM test passes (spawns walkable, movement
  never enters solid geometry, spawn cycling, minimap); it uses stubbed Image/Canvas, so it is a
  logic test, not a rendering test.
- Gate D (real browser render): **BLOCKED** — no Chromium/Firefox/Playwright in this sandbox.
- Gate E (visual quality): **NOT ACCEPTED** — see `docs/map_tower/VISUAL_ACCEPTANCE_REPORT.md`.
- Gate F (native Godot): **BLOCKED** — no Godot binary in this sandbox.

Art gaps that must be closed before visual acceptance are listed with exact requirements in
`map_tower/assets/UNRESOLVED_ART_GAPS.json` (water surface, building exteriors, bridge modules,
dock modules, sand/ash/dry ground families).
