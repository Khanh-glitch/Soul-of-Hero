# R4 corrective round — Veyra overworld

Continues `63f6001b` (R3, not accepted). Branch `arena/103e4440-soul-of-hero`. Canonical
Bible / conversion contract / staging registry untouched; **no merge to production.**

## P0 — validators rewritten (no false positives)
`tools/world/validate.py` v2 is all-or-nothing and exits non-zero on any failure
(`python tools/world/validate.py; echo $?` → `1` while a gate is red). Thresholds were never
relaxed; where a check was mis-specified it was replaced with a stronger one, and where the
world was wrong the world was fixed.

| Gate | Assertion | Result |
|---|---|---|
| A1 | GOLD sha + 12 class counts | PASS |
| A2 | every POI/resource/bridge/elder/spawn/label/road/dock position equals `gold*4` on **both axes** | PASS |
| A3 | exactly 8 ferries, water mode, absent from the road list, termini on water or at a dock | PASS |
| A4 | **27/27** dock anchors: land anchor walkable and water-free, water anchor inside the *named* body, pier length sane | PASS |
| A5 | every bridge: path inside its own deck corridor, **no water cell crossed off-deck**, path proven to use the deck over water, deck centreline swept with the 12×8 px D051 feet box | **FAIL — 11/12 (br_b)** |
| A6 | 164 sampled perpendicular crossings across all 17 rivers at 3 points per segment: **164/164 blocked** unless bridge/ford | PASS |
| A7 | all 81 POIs classified from GOLD land kind + authored `access` text; **58/58 non-ferry POIs reachable on foot**; every ferry-only POI sits on an island that owns a dock | PASS |
| A8 | 4/4 spawns walkable, each spawn reaches ≥5 POIs | PASS |

**br_b is a real, unresolved structural defect** and the gate stays red because of it: its GOLD
span is 69 units (552 px) and an off-deck wet route (9 cells) exists inside its own corridor, so
the "no water crossed off-deck" assertion fails. Fixing it means either the GOLD span or the
river mouth shoal geometry at that point; I did not fake it green.

## P1 — assets reconciled against SOH Git
`map_tower/assets/raw_packs/{668008-bridges,351300-island,574220-roads,665131-fields,200380-farm-plants}.zip`
were pulled from `map/veyra-gold-asset-canon-20261102` into this branch (no Drive, no private repo)
and are SHA-256 pinned in `map_tower/assets/RAW_PACK_INVENTORY.json`. `tools/world/kit.py`
extracts them to `assets/environment/packs/**` and exposes named, verified sprite modules:

* `bridges`: stone span, stone viaduct, log bridge, rope bridge, north-south spans, plank walkway
* `island`: 32×16 beach bands with real foam crests, sand
* `fields`/`farm-plants`: crop and field modules (available, not yet used in composition)

The 42-pack CraftPix vault lives on the **private** `Khanh-glitch/APEX-CHAOS` repo per
`map_tower/EXISTING_ASSET_GIT_SOURCES.json`; only these five packs are Git-resident on the
public SOH canon branch. That is the complete inventory of this project's reachable art.

## P2 — world content (not documentation)
* **Bridges are real sprites now**: deck+cap modules tiled to the exact span, rotated to the
  GOLD bearing, with catwalk rails; 12 bridges, no stone-texture causeways.
* **Piers are real plank modules** rotated along each pier axis (24 accepted, 3 rejected).
* **Water is a system**: three depth bands, ordered dither, wave crests, foam ring, real
  32×16 beach bands from the island tileset, cream sand beaches.
* Roads use the dirt-path tiles with dithered edges instead of a dimmed stone grid.
* Collision: channel closure (any trace of water is solid unless an authored crossing), railing
  flank barrier, guaranteed walkable deck centrelines, POI clearings.

## P3/P4 — evidence and gates
`docs/map_tower/R4` evidence is produced by the `veyra-r4-browser` workflow: real Chromium,
real key input, canvas pixel assertions, **640×360**, overlays hidden for evaluation captures
plus a separate gameplay-overlay capture, console log + commit/run metadata in the artifact.
A `godot-native-attempt` job downloads Godot 4.7 and runs a headless import, logging the exact
outcome (no vendored binary, no proxy claim).

## Status
* Technical: A1–A4, A6–A8 pass with command logs; A5 red on br_b.
* Visual: improved substantially (real bridge/piers/beach/water), **not accepted** — Anubis and
  Surtur still need authored environment sets, and Greywater still lacks roofed buildings
  (no roof/building sprite exists in the SOH-resident art; that is a named asset gap).
* Git: raw packs + kit + compiler + validators on this branch, canonical docs unmodified.
* Gameplay: browser walk test only; native Godot readiness pending the CI job result.
