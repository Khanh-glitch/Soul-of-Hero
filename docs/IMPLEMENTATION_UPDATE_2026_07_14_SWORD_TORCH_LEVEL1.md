# Implementation update - Sword Echo, torch vision, Level 1 doors

- Removed the legacy floating hand/spirit weapon visuals from the default Sword
  presentation while preserving their nodes for old loadout code paths.
- Replaced code-drawn Sword Crescent Recoil and Soul Echo waves with the
  project-owned `assets/vfx/sword/sword_crescent_wave.png`: a transparent,
  white semi-oval pixel crescent with prompt/provenance stored beside it.
- Soul Echo now presents one delayed white spectral Sword that plays the exact
  authored combo strip. The former chain of frozen snapshots and extra blade
  glint were removed because they obscured the owner and timing of Echo hits.
- Added dark dungeon lighting: `WorldTint`, player circular `VisionLight`, and
  torch PointLight2D illumination.
- Made torches interactable. Player can pick/place a torch; carrying a torch
  blocks Sword attack and Soul Echo skill use.
- Added `floor_door` entities and regenerated Level 1 as a three-floor
  top-down dungeon linked by paired doors. The same layout is now registered as
  playable Campaign Level 01 while Training remains a separate run mode.
- Restored E as the primary interaction binding (F remains an alternate) and
  centralized nearest-interactable selection in the player controller.
- Updated schema, runtime entity loading, and smoke tests for the new
  door-linked multi-floor level contract.

Verification:

- Full regression: 525 numbered non-MCP checks passed.
- MCP lifecycle, bidirectional runtime/JSON sync, and reconnect suites passed.
