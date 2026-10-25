# Chapter 1 — audit sweep

Mosaicked native frames of every level, taken by
`tools/captures/chapter1_audit_sweep.tscn` and stitched 1:1 by
`tools/chapter1_audit/audit_sheets.py`.

Each `L<nn>_mosaic.png` is the level exactly as the game renders it, composited
from 1280×720 frames taken on a 960×540 overlapping grid with actors and HUD
hidden. Because the mosaic is 1:1 in map pixels, any region of it can be cropped
and read at pixel scale without resampling.

`L<nn>_mosaic.json` records how many frames went in, the camera bounds, whether
the camera obeyed its limits, the authored content rectangle and the fraction of
that rectangle covered. `manifests/` keeps the per-level manifests the sweep wrote,
so the stitching can be re-derived without re-running the game.

These images are **not** the evidence tree: `docs/chapter1-visual-overhaul/`
remains the handoff evidence. This folder exists to be looked through for defects,
and it is read-only with respect to the game.
