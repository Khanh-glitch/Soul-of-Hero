# Godot reproduction project (pilot)

Standalone Godot 4 project that re-draws the pilot environment from the same
pinned files `tools/compose.py` uses:

* `pilot/art/*.png` — byte-identical copies of A1's shipped atlases and the
  knight sheet (see `source_manifest.json` for SHA-256).
* `pilot/data/*.json` — the pinned geography window, the A1 frame tables, the
  pilot placement layers, and the verified BFS walk path.

Run: open this folder in Godot 4.3+, press F5. The hero walks
`data/walk_path.v1.json` (17 cells, spawn -> waystation anchor) and the camera
follows at the project's 640x360 viewport with integer 2x scaling.

**Not executed in the authoring sandbox** (no Godot binary available). The
verified pixel evidence for this audition is `tools/compose.py`; this scene is
shipped so the same composition can be run in-engine by the reviewer.
