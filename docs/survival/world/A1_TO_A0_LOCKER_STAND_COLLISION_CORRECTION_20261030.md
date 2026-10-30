# A1 → A0: exact Waystation locker stand collision correction

**Status:** `SOURCE_CORRECTION_AUTHORED_PENDING_CI_AND_A0_NATIVE`  
**A1 branch / PR:** `arena/e385312a-soul-of-hero` / PR #20, open/unmerged  
**Authority:** CT narrow local POI collision/stand correction after A0 native counterexample run [40996028162](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40996028162).  
**Correction id:** `a1_locker_stand_toe_clearance_v1`

## Defect proved by A0

At the exact authored Waystation locker stand `(408,199)`, the real Knight foot is `(6536,3199)`. Its `12×16` body with offset `(0,-8)` occupies:

- Hero body: `x6530..6542`, `y3183..3199`.
- Original full-tile locker blocker at `(408,198)`: `x6528..6544`, `y3168..3184`.
- Original overlap: **12×1 px**, collider `obs_waystation_locker_bank_408_198`.

Reaching Waystation anchor `(408,200)` is not interaction-stand evidence.

## Smallest A1-owned correction

Keep the stand, anchor, node, obstacle cells, nav blocking, interaction radius and rewards unchanged. Refine only the locker-bank collision footprint:

| Field | Original | Repaired |
|---|---:|---:|
| Stand cell | `(408,199)` | `(408,199)` |
| Anchor cell | `(408,200)` | `(408,200)` |
| Locker node / obstacle cells | `(408,198)`, `(409,198)` | unchanged |
| Collision size per obstacle cell | `16×16` | **`16×14`** |
| Collision offset from tile center | `(0,0)` | **`(0,-1)`** |
| Visual footprint | `16×16` | `16×16` unchanged |
| Nav cell | blocked | blocked |
| Interaction radius | `24 px` | `24 px` |

Repaired locker collision at `(408,198)` occupies `x6528..6544`, `y3168..3182`. The Hero body top is `y3183`, leaving **1 px toe clearance**. The visible locker remains full-tile; only the south collision edge is inset by 2 px.

A0 mount rule for every static obstacle cell:

```text
body.position = cell * 16 + (8,8) + collision_offset_px
RectangleShape2D.size = collision_size_px
defaults when fields absent: size [16,16], offset [0,0]
```

Interaction reach from the exact stand:

- node center `(6536,3176)`;
- stand foot `(6536,3199)` distance **23 px ≤ 24 px**;
- Hero body center `(6536,3191)` distance **15 px ≤ 24 px**.

## Source diff / inverse

Changed A1-owned files:

- `tools/survival/worldgen/compile_slice.py`: emits `collision_size_px`, `collision_offset_px`, `visual_size_px`, `collision_correction_id` on `obs_waystation_locker_bank`; publishes `a0.locker_stand_collision_correction`.
- `data/survival/world/vertical_slice/poi_crown_waystation.slice.json`, `handoff_contracts.json`, `manifest.json`: deterministic compiled outputs.
- `tools/survival/worldgen/validate_slice.py`: fail-closed Hero-body-vs-obstacle collision and interaction-radius checks for every action stand.
- `tools/survival/worldgen/compile_connector.py`, `validate_connector.py`, connector contract/delta pins: CN-03 now requires the exact locker stand; physical ridge delta remains **46 solid / 48 dressed / 14 props**. The delta file hash changes only because the pinned Waystation slice hash changed; the legacy cell/prop deltas are unchanged.
- `tests/survival/world/connector_native_test.gd`: adverse original full-tile query, repaired live-shape stand query, interaction range, ordinary-input Refuge → exact locker stand → Relay → Refuge.

Inverse / rollback: remove `collision_size_px`, `collision_offset_px`, `visual_size_px`, `collision_correction_id` from `obs_waystation_locker_bank` (or set `[16,16]`, `[0,0]`, `[16,16]`). That restores the original full-tile blocker and the original 12×1 px overlap. No legacy ridge, chunk, anchor, stand, reward or Hero collider rollback is needed.

## Acceptance vectors

| ID | Gate | Status |
|---|---|---|
| LS-01 | Source diff preserves anchor `(408,200)`, stand `(408,199)`, obstacle cells, rewards, chunk6:3, 46/48/14 ridge, ten entrances. | PASS source gate / pytest |
| LS-02 | Adverse proof: original full-tile locker body intersects exact stand via live `intersect_shape`. | CI-PENDING |
| LS-03 | Repaired stand is nav-free and live-shape clear; no Hero resize. | CI-PENDING |
| LS-04 | Exact stand is inside authored 24 px interaction range. | CI-PENDING |
| LS-05 | Ordinary input walks Refuge → exact locker stand → Relay crank stand → Refuge. | CI-PENDING |
| LS-06 | Camera, border, padding, ten endpoints and one-size/collision constraints remain valid. | CI-PENDING |
| LS-07 | A0 production controller fresh-save/reload, genuine rewards, inverse route, downgrade/protected endpoints and B0. | **A0 PENDING** |

## Limits

This is an A1 isolated composed-world fixture correction, not production integration. `native_playable=false`. A0 must mount the authored collision fields, re-run the exact stand through the production Knight/controller, and validate genuine SaveService rewards before any native-playable claim.
