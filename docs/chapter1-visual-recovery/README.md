# Chapter 1 — Visual Recovery & Art Direction

This is the implementation record for the pass that follows the audit baseline
`e613242`. The audit said what was wrong. This says what was changed, what it was
verified with, and what is still open.

Everything here is on `arena/6e89e68d-soul-of-hero`. Nothing is merged, and no
claim of owner approval is made anywhere in this directory.

## The rule the whole pass is written against

**Repair without nerfing.** No decor was deleted to lower a count, no monument was
shrunk to fit a camera, no level was uniformly darkened, no void was filled with
generic flooring, and no thin-but-meaningful marking was removed because a
validator could not measure it. Where a repair and a number disagreed, the number
was re-derived (see `AUDIT.md`'s own corrections) rather than the art.

Two examples of what that means in practice:

* Level 7 asked the renderer for a prop frame called `barrels` twenty times. The
  kit has `barrel`. The repair is the typo in the generator — the twenty cells keep
  their prop, and now draw one.
* Level 5's aisles changed tile halfway along their own length because a corridor
  pass and a dressing pass wrote the same cell and the last write won. The repair is
  a rule that decides which frame a cell gets, plus a report of every claim it
  settled — not deleting the dressing.

## Gates

| Gate | What it covers | Status |
| --- | --- | --- |
| A | Gameplay readability / missing content | **Done** — 3 missing-frame classes repaired, 1 validator added |
| B | Architectural boundaries and clipping | **Partly done** — camera headroom and wall crowns done; per-level boundary work on L5's portal, L9's gate framing and L10's hall is open |
| C | L1–L4 enclosed voids finished as architecture | **Partly done** — every void is rock, in the headroom too; room-level architecture is open |
| D | Visual hierarchy (floor/wall, light, hero objects) | **Partly done** — light pools normalised; L10's throne, L7's ward ring, L9's seal stations and L5's exposure repaired; L6/L7 value structure and L5's bowl still open |
| E | Art direction (motifs, composition, bedrock, variation) | **Partly done** — L10's seam rules and L9's rings are built features; the L1–L4 kits carry their own motifs, surfaces and prop variants, and the ossuary's frieze is now a frieze rather than wallpaper; L6's conduits, L7's lanes and the rock outside the rooms are open |
| F | Level identity L1–L4, polish | **Done for identity** — four kits, four documents, four prop layers (see `repair-ledger.md` F1 and section H). Interior variety within a level is a P1 and still open |

A partly-done gate is not a passed gate. The visual verdict at the bottom of
`level-report.md` follows from that.

## Commits in this pass

| Commit | Gate | What |
| --- | --- | --- |
| `0a7bbce` | B | Camera headroom of six rows, rock to the top of the visible world, wall crown (cornice + cap) that compresses instead of being sliced, prop clamp |
| `897ae4b` | A | L7 `barrels`, L8 `banner_pale` authored, L5 kit/ambient/background stated, L5 floor claims resolved, `tools/validate_chapter1_art_refs.py` |
| `951552f` | B | Level schema allows bounded headroom above row 0 (the fix for the regression `0a7bbce` caused) |
| `971e7d2` | D | Every light normalised to a 140–400 px pool with a 1.15 energy ceiling, L9 gains its portcullis, L9 gate light becomes a threshold glow |
| `48de9ab` | C | Voids become rock (L1–L4), derived by flood from the map border |
| `bc3d3a3` | C | The keep sits in rock instead of on a black field |
| `408a451` | E | The chain is drawn as a chain, not a dotted seam |
| `b0a7268`, `7c5e4d5` | C | Rock measured on the native frames and corrected twice: out of black, then to one value with rock in the headroom |
| `869aa67` | — | The audit sweep re-photographs the chapter when the chapter changes, and publishes to `after/` |
| `e9f6a6a` | — | `docs/chapter1-audit/` frozen at `e613242` and protected by a guard; publishing made race-proof |
| `e5aa108` | — | First documentation pass |

### Second pass — art repairs (this pass)

| Commit | Gate | What |
| --- | --- | --- |
| `9b9c803` | D | L10: the throne rebuilt out of five masses instead of twenty-two 1-px columns |
| `3164bcb` | D, E | L9: the cauldron no longer covers the seal, rings generated per arm, paving separated from walls, blood darkened |
| `67046b5` | E | L10: the staircase becomes tread/riser bands, and the aisle/lane seam rules become centred inlay |
| `27a98ea` | D | L7: the apron no longer repaints the ward ring — the arena's floor art was never visible |
| `4c77e47` | D | L5: ambient lifted out of black (0.44/0.45/0.53) with all 29 lights untouched |
| `1dac103` | E | L9: rings get a recessed pad and bronze socket caps inside the last paintable column |

Every one of these is kit art, an architecture document or a per-level lighting
constant. No level file, entity, collider, route or save field changed.

## Documents here

* `repair-ledger.md` — every defect, its evidence, its repair, its verification.
* `level-report.md` — the ten levels, one at a time.
* `technical-validation.md` — the CI runs, the validators, and the invariant checks.

## Reproducing

```
python3 tools/level5/architecture.py            # L5 document, floor claims, lights
python3 tools/level7/architecture_vigil.py      # L7 document, barrel stores
python3 tools/level8/art_reliquary.py           # pale mourning banner
python3 tools/validate_chapter1_art_refs.py     # every authored frame resolves
powershell -File tools/validate_chapter_1_assets.ps1
```

The AFTER mosaics are `docs/chapter1-visual-recovery/after/L01..L10_mosaic.png`,
regenerated from this branch by the sweep workflow. The BEFORE mosaics are
`docs/chapter1-audit/`, which is frozen at `e613242` and is not written to by any
workflow: a BEFORE frame that gets overwritten by a later build is not evidence of
anything. The two sets are separate directories on purpose, and the AFTER set is
labelled as such wherever it is used.
