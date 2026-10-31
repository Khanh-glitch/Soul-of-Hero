# Waystation Audition — Pilot 2 (new CraftPix sources + D051 avatars)

Baseline for this reset: `93c80959835b05e45176a0ba745749d5991b9675`.
Branch: `arena/103e4440-soul-of-hero`.

**Status in one line:** Gate 0 passes on the sources this corridor needs, Gate 1 is written
below, **Gate 2 is NOT met** — everything in `evidence/` is a Python/Pillow compositor
render, not a Godot 4.7 capture, and no input-driven movement exists. Do not read the
images here as engine evidence.

Every pixel in `evidence/` comes from the newly supplied CraftPix archives extracted under
`/home/user/asset_vault/x/` (private, git-ignored) or from the locked D051 character ZIPs.
None of the old `overworld_tiles.png` / `overworld_props.png` / Knight sheet is used
anywhere in `tools2/` — the compositor has no reference to those files.

---

## 1. Gate 0 — source readiness

18 source PNGs from 6 of the 43 enumerated CraftPix ZIPs, each hashed per file in
`evidence/report2_day.json → sources` and again in `evidence/manifest2.json`.

| role | pack (CraftPix ID) | file(s) used |
|---|---|---|
| ground material | 574220 | `PNG_Tiled/Ground_grass.png` |
| road | 574220 | `PNG_Tiled/Road1_grass.png` |
| palisade / gate | 504452 | `1.1 Tiles/Tileset2.png` |
| bare clay (impassable) | 504452 | `1 Tiles/FieldsTileset.png` |
| trees | 385863 | `Tree1`, `Tree2`, `Broken_tree7`, `Burned_tree1` |
| bushes | 141354 | `Bush_blue_flowers1`, `Bush_simple1_1` |
| rocks | 974061 | `Rock1_1`, `Rock2_1`, `Rock2_3` |
| supply stand | 218281 | `PNG/supplies_objects.png` |
| **male D051** | 555940 | `PNG/Unarmed/Without_shadow/Unarmed_Walk_without_shadow.png` |
| **female D051** | 419402 | `PNG/Unarmed/Without_shadow/Unarmed_Idle_without_shadow.png` |

Avatar check (see `evidence/avatar_proof_day_1280x720.png`): both sprites are **bald,
unarmored and gender-correct** — the male sheet is `384×256` (6 columns × 4 rows of 64 px),
the female `768×256` (12 columns), rows `down, left, right, up`, visible body
`13×22 px` inside the 64 px cell with the foot at cell y≈44. There is no Knight, no
substitute swordsman and no invented stand-in in this pilot. Armor-1/2 art remains
`SOURCE_BLOCKED` per D051 and is **not** claimed anywhere.

Scale finding that matters for Gate 2 asset work: the packs are **not** in one scale band.
A D051 body is 22 px tall against 16 px cells, while the tree pack draws 128 px trees.
Compositing them at native size makes the character look like an insect. Trees, rocks and
bushes are therefore halved by integer NEAREST (`"scale": 0.5` in `data/placement2.json`);
palisade, gate, shelves and produce stay native.

---

## 2. Gate 1 — composition

Same A1 geography as before, SHA-pinned copy in `data/cells2.json`; nothing in A0/A1/A3/A6/A8
production code or data was edited.

**Player's immediate objective.** Follow the cobbles east. The cobble ribbon is derived, not
authored: `route.outbound ∪ route.return ∪ poi.required_nav_cells`, widened by one cell, then
clipped to authored walkable dirt `d` — **175 cells** in a 3–4-cell ribbon. A1's own `'='`
detail is 531 cells and is a plaza, not a route, so it is *not* used as the paved mask.

**Landmark.** The palisade gate with its arch, standing across the road at the waystation
entrance. It sits there because it is the only man-made vertical in the corridor, it is on
the authored `entrance [403,200]` cell, and it frames the route rather than blocking it.

**Surface legend — one meaning per surface.**

| surface | pixels | meaning |
|---|---|---|
| cobbled ribbon | 574220 `Road1_grass` fill + grass fringe | go this way |
| trodden earth | `Ground_grass` tile + warm wash | clearing people occupy |
| grass moor | `Ground_grass` plain | optional exploration |
| bare clay | 504452 `FieldsTileset` warmest tile | inaccessible `#` shelf |

**Prop clusters, each with its purpose** (17 props; cluster notes in `data/placement2.json`):

| cluster | props | purpose it serves |
|---|---|---|
| palisade + gate | `gate`, 2× `fence_h` | habitation; frames the destination |
| supply stand | `shelf`, `shelf2`, `produce`, `produce2` | resources — why a waystation exists |
| hazard margin | `rock_big`, `rock_mid`, `rock_small` | reads the impassable clay shelf without a UI |
| abandonment | `burned`, `dead_tree` | damage at the authored deadfall cell |
| optional reward | `bush_berry`, `bush_small`, `tree_small`, `tree_big` | forage layby, off the road |

**Negative space.** The stations keep the road's north verge and the moor east of the yard
empty; the gate is the only object in its row. Nothing was added to raise a prop count.

**Camera continuity.** Three connected views along one corridor, each 320×180 world px at 2×:

| station | centre | purpose |
|---|---|---|
| `approach_west` | 396,200 | road reads east; shelf and deadfall on the hazard side |
| `gate_front` | 402,200 | gate and palisade frame the carriageway; stand visible beyond |
| `yard` | 407,201 | inside the station: stands, produce, lane turning south |

**Removed, reorganised, replaced against the rejected pilot.**

- removed: the old `overworld_tiles`/`overworld_props` atlases and the Knight sheet from the
  render path entirely;
- replaced: every terrain, road, prop and actor pixel with newly supplied CraftPix pixels;
- reorganised: props are no longer scattered per-cell decoration. They exist only in four
  clusters, all on the road's north side or in the layby, and none sits on the ribbon;
- removed from the evidence set: any lighting-only beauty shot - day and night are the same
  three cameras so they compare directly.

---

## 3. Gate 2 — not met, blocker unchanged

| requirement | state |
|---|---|
| newly supplied environment pixels | met (Python render only) |
| D051 male **and** female, no Knight | met (Python render only) |
| three connected views, same environment | met (Python render only) |
| **native Godot 4.7 capture** | **blocked** |
| **input-driven player movement** | **blocked** — no engine, no input path |
| obstacle collision for the new props | **not authored** — the palisade and shelves are decor; A1's collider table governs only A1 props |
| day/night visibility | rendered, readable in both |

Blocker, unchanged from pilot 1: this sandbox has no Godot binary and no way to obtain one —
`curl` to GitHub release assets exits 35, `gh release download` ends in EOF, no outbound
egress to `drive/storage.googleapis.com`, and no Vulkan ICD, libGL or libEGL is installed.

**What I am not claiming.** I am not declaring this composition artistically acceptable.
In my own judgement it is still weak in five specific ways, and they are the next things to
fix, not decoration to add:

1. the grass tile's own detail glyphs repeat on a 16 px lattice and read as a dotted grid;
2. the palisade is 46 px tall against a 22 px body — it reads as a wall, not a fence;
3. the derived ribbon ends in rounded stubs at both frame edges instead of leaving the frame;
4. trodden earth and plain grass separate too weakly at 2×;
5. every prop cluster sits in one 20-cell stretch, so the road east of the gate is bare.

---

## 4. Reproduce

```bash
cd prototypes/world_visual_pilot2
python3 tools2/compose2.py --lighting day   --out evidence
python3 tools2/compose2.py --lighting night --out evidence
```

Requires Pillow. Sources are read from `$SOH_ASSET_VAULT` (default
`/home/user/asset_vault/x`), which is not part of the repository.

Evidence: `evidence/contact_{day,night}_1280x720.png` (three stations stacked),
`evidence/pilot2_{day,night}_<station>_{640x360,1280x720}.png`,
`evidence/avatar_proof_day_1280x720.png`, `evidence/world2_{day,night}.png`,
`evidence/manifest2.json` (per-file SHA-256), `data/trace2_{day,night}.json` (draw-op trace:
19 sprite ops per frame plus terrain cells).
