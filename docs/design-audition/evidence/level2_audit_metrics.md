# Level 2 candidate — auditable diff against frozen integration baseline
- Frozen SHA: `1c21a49c2eb3775c4b421dab86d057c7256f5964`
- Schema: 2; map dimensions: 164×138 16px cells
- Authored entities: 64 baseline → 64 candidate
- Original entity IDs preserved: True; types preserved: True
- Newly added entity IDs: 0
- Existing entities moved: 64
- Rooms: 13 → 13; combat camps: 3 → 3
- Floor cells: 4460 → 8057
- Floor footprint symmetric difference: **9037 cells**
- Floor mask Jaccard similarity: **0.161** (1.000 = unchanged)
- Geometry overlay: `level2_footprint_overlay.svg` (blue retained / orange removed / green added)

## Automated immutable-contract violations
- None detected.

## Review notes (not automatic rejection)
- layout_profile changed; explain any runtime compatibility

## Important limits
This is a **source audit**, not Godot collision, room routing, screenshot or independent level design approval.
Spatial difference metrics cannot establish quality. Godot runtime + actual images + design review are required.
