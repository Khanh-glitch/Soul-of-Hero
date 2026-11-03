# MAP-LR01 — VEYRA WORLD PRODUCTION (Map Tower)

> **MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.**

Long-run Map workstream producing a geographically coherent physical Veyra from
the creator-selected GOLD source. This is **not** a scale report, an isolated
showcase, or a Fisher's Point cosmetic experiment. It is **not** a playable
survival game, and static geography QA is never playable acceptance.

* Canonical source: `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` @
  `19d8c6ec820f324a6ac12733165e43b5e2c6eab2`, SHA-256
  `88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256`.
* Authoring frame: **2000×1400 authoring units**, terrain raster 250×175 @ 8 au/cell.
  Never rescaled, cropped or warped. Runtime tile scale remains **UNDECIDED**;
  every artifact carries explicit transform metadata.
* Retained non-production research: `world_lab/geo01`, `geo02`, `scale01a`,
  `map_r01`. No canonical rewrite without creator authorization.
* Gameplay coordination: PR44 (`arena/d4bfcfff-soul-of-hero`) live HEAD
  `0b2ba508cba71e48242f871e4a47c8506165dd20`; ACK `6608030530`, benchmark
  `6606283007`. Map pushes only to `arena/2e3cfbd2-soul-of-hero`.

## Milestones

| id | subject | status |
|---|---|---|
| A | corrected per-POI footprint/interior/entrance tool, fractional scale + raster coverage | **complete** (diagnostic, runtime scale undecided) |
| B | whole-Veyra deterministic geography compiler (8 landmasses, water, elevation, biomes, corridors, Elder territories) | in progress |
| C | full transport audit at `SNAP_TOL=7`, physical bridges/clearance, build zones | planned |
| D | 81 POI real spatial layouts, rooms/portals/sockets, 24 archetypes | planned |
| E | native 640×360 in-world art, provenance, before/after stable views | planned |
| F | versioned **geography-only** handoff package + adapter spec; no Gameplay population | planned |

## Run

```sh
cd world_lab/lr01
./reproduce.sh
```

`reproduce.sh` regenerates every committed output, renders the inspected views,
runs the continuous gate suite and the GEO-01/GEO-02 regression scripts.
Chromium at `/tmp/chromium` with `LD_LIBRARY_PATH=/tmp/al2023/lib` is used for
SVG→PNG capture (same as MAP-SCALE-01A); the SVG is the reproducible source of
truth if Chromium is unavailable.

## Status vocabulary

Every important feature carries one of: `SOURCE_AUTHORED`, `DERIVED`,
`PROPOSED`, `VALIDATED`, `UNRESOLVED`, `BLOCKED`. `PROPOSED` interiors are never
presented as canon; `UNKNOWN`/`UNRESOLVED` is never silently filled with a
guess. Sockets describe **where an object could fit**, not that a generator,
loot container, lock, vendor or weather effect exists there.

## No-claims

No approved runtime scale. No `U=2` canonization. No `200×200` / 1M-cell /
chunk-stride design law. No invented loot, money, resource instances, generator
states, locked doors, power requirements, recipes, quests, weather or survival
outcomes. No cart-passable claim without physical clearance evidence. No claim
of Gameplay receipt without a matching acknowledgement. No parallel fake game.
