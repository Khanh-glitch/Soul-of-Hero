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
| C | L1–L4 enclosed voids finished as architecture | **Partly done** — all voids are rock now; room-level architecture is open |
| D | Visual hierarchy (floor/wall, light, hero objects) | **Partly done** — light pools normalised; floor/wall value separation and hero objects are open |
| E | Art direction (motifs, composition, bedrock, variation) | **Open** — see the ledger |
| F | Level identity L1–L4, polish | **Open** |

A partly-done gate is not a passed gate. The visual verdict at the bottom of
`level-report.md` follows from that.

## Commits in this pass

| Commit | Gate | What |
| --- | --- | --- |
| `0a7bbce` | B | Camera headroom of six rows, rock to the top of the visible world, wall crown (cornice + cap) that compresses instead of being sliced, prop clamp |
| `897ae4b` | A | L7 `barrels`, L8 `banner_pale` authored, L5 kit/ambient/background stated, L5 floor claims resolved, `tools/validate_chapter1_art_refs.py` |
| `951552f` | B | Level schema allows bounded headroom above row 0 (the fix for the regression `0a7bbce` caused) |
| `971e7d2` | D | Every light normalised to a 140–400 px pool with a 1.15 energy ceiling, L9 gains its portcullis, L9 gate light becomes a threshold glow |
| `48de9ab` | C | Enclosed voids become rock (L1–L4) |
| `bc3d3a3` | C | Outer voids become darker rock, so the keep sits in the world instead of on a black field |
| `869aa67` | — | The audit sweep now re-photographs the chapter when the chapter changes |

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

The AFTER mosaics are `docs/chapter1-audit/L01..L10_mosaic.png`, regenerated from
the branch by the audit sweep workflow. The BEFORE mosaics that the audit shipped
are the same paths at commit `e613242`; the sweep overwrites the working copies, so
the audit's own set is preserved by the commit, not by the file.
