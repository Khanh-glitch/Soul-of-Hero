# Regressions

Nothing in the 6–10 pass was allowed to change gameplay. This page records what was
checked and what is already broken before this pass touched anything.

## Green

- `AUTHORED ART: kit=<kit>` is emitted by the renderer for levels 6, 7, 8, 9 and 10,
  and the evidence gate reads the kit name out of each level's architecture
  document, so a document that stopped naming its kit would fail the gate.
- Every `chapter_1_level_*_after.log` still carries
  `CHAPTER1 CAPTURE: … art=on facade_cells≥1`, including the levels this pass did
  not touch.
- The architecture validator is clean for all four new documents: no floor detail
  outside the floor layer, no wall dressing outside solid geometry, no prop on a
  protected gameplay cell, no prop over void, no tall fixture off the wall mass.
- Collision, route and campaign-map suites are unchanged by this pass: the
  documents add no cells, no colliders and no solids.

## Pre-existing failures, documented as such

- `chapter_1_balance_matrix_test.txt` fails on this branch exactly as it did before
  the pass started. It is a balance-matrix assertion, untouched by the visual work,
  and is **not** introduced by Levels 6–10. It is listed here so the owner can tell
  the two apart.
- `Godot 4.7 Runtime Validation` on the run that produced this evidence reports
  failure; the `Chapter 1 — visual overhaul` workflow that captures and publishes
  the frames is green, and its gate step passed for all ten levels. See the run
  logs in `../logs/` for the exact lines rather than a summary here.

## Fixed as part of the pass

- `kitlib.pack` sized a prop atlas from its last row only, silently cropping every
  frame in a wider row. It affected the `gatehouse` kit worst (the whole atlas read
  as empty) and it is fixed in the shared authoring library, not per level.
