# A1 → A8/A0 cell-to-native transform contract

Status: **REVIEW CONTRACT, NOT A MOUNT**  
Machine authority: `data/survival/world/corridor/a8_site_transforms.v1.json`  
A8 source reviewed: PR #26 head `f9ed82b91e8d1eed52f109247ae511c4f862ffd1`, base `feature/survival-rpg-foundation-20261029`. A8 CI was queued at review; no A8 native PASS is claimed here.

## Authority

A1 `world_plan.v1.json` owns canonical POI cell, region, route, footprint and capability geography. A8 owns the isolated site interaction engine, local walls/gates/actions and local pixel geometry. A8's isolated scene is **not** authoritative overworld geography. A0 owns production mounting and SaveService.

## Exact transform rule

For a canonical A1 cell `C = (cx, cy)` and A8 local `action_socket = S`:

```text
tile_px = 16
canonical_anchor_px = C * 16 + (8, 8)
rotation = 0
scale = (1, 1)
site_root_position_px = canonical_anchor_px - S
implied_bounds = [root.x, root.y, root.x + local_width, root.y + local_height]
```

This aligns the A8 interaction focus to the canonical A1 POI anchor without inventing a new world coordinate. It is a review calculation, not permission to paste an oversized isolated scene onto the continent.

## Computed review

| POI | canonical cell | anchor px | A8 socket | implied root px | implied 1:1 bounds px | authored footprint bounds px | decision |
|---|---:|---:|---:|---:|---|---|---|
| `poi_crown_south_quarry` | `(30,280)` | `(488,4488)` | `(506,302)` | `(-18,4186)` | `[-18,4186,942,4786]` | `[424,4424,552,4552]` | `REJECT_FOOTPRINT_MISMATCH` |
| `poi_crown_south_orchard` | `(140,360)` | `(2248,5768)` | `(510,292)` | `(1738,5476)` | `[1738,5476,2698,6076]` | `[2184,5704,2312,5832]` | `REJECT_FOOTPRINT_MISMATCH` |
| `poi_crown_south_mill` | `(120,300)` | `(1928,4808)` | `(528,294)` | `(1400,4514)` | `[1400,4514,2360,5114]` | `[1864,4744,1992,4872]` | `REJECT_FOOTPRINT_MISMATCH` |

All three A8 scenes are 960×600 local pixels, while the authored POI radius is 4 tiles / 64 px. All three lie outside the current one-chunk connector annex `x384..447,y192..255`. A direct 1:1 overworld mount would overrun the authored footprint and neighboring geography. Do not non-integer-scale the art or collision to force a fit.

## Access and route review

- Quarry: A1 route `sp_poi_crown_south_quarry` from `node_refuge`, no required capability; A8 outer/inner `[]` — **MATCH**. Stone source on the south rim stair remains geographically plausible.
- Orchard: A1 route `sp_poi_crown_south_orchard` from `node_amber_north`, no required capability; A8 outer/inner `[]` — **MATCH**. A8 blocks honey/rare-herb grants; A1 `material_keys` are geographic potential, not loot authority.
- Mill: A1 route `sp_poi_crown_south_mill` from `node_refuge`, requires `cap_salvage`; A8 outer/inner `cap_salvage` — **MATCH**. Outer race observation and gated maintenance walk must remain readable before commitment.

These are southern expedition sites, not part of the first-hour postern crate loop. The corridor checkpoint does not mount them or add empty markers.

## Required owner decisions

1. **A8:** provide either a compact overworld shell whose visual/collision footprint fits the canonical radius, or explicitly classify the 960×600 scene as an interior/local expedition instance entered from the canonical anchor. Keep `intent_requested` / authoritative-result projection ownership.
2. **A0:** choose mount mode, add the world-source injection seam, preserve global-pixel SaveService coordinates, and never treat A8 local `spawn` as a world spawn. If an interior transition is used, persist the return anchor and site claim state atomically.
3. **A1/CT:** approve any footprint/route/access change before production. This contract does not move canonical POIs, change rewards, or approve A8's isolated geometry as world truth.

## Negative gates

The validator rejects: canonical cell drift, anchor/root/bounds formula drift, a false footprint-fit claim, capability mismatch, or a production-mount claim. Tests mutate the root transform and assert failure.
