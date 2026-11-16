# G1B — Chest Asset Custody (SOH)

These are the **real exported pixel assets** derived from the uploaded `new-chat.zip` art studio. 5 families × 3 states = 15 base sprites stored in a 240×144 atlas, 48×48 each, shared anchor (24,42). A second atlas stores per-pixel material/plane masks for Surface Sheen Sweep. This is the production-art payload, not a screenshot or a placeholder.

Read `manifest.json` for five physical families, 16 permitted family-grade variants, art scale, sheen parameters and collision-box metadata. The manifest's small 0.96–1.04 scale spread and High 3.4-second sheen cycle are **studio defaults, not user-accepted final values**; tune with the actual player watching in SOH at 640×360. Crop pixels with nearest-neighbor only. Do not apply glow/bloom, invent more chest types, or put loot item icons into the chest sprite.

## Boundaries

This commit supplies art custody **only**, does not implement G1B loot, resupply, Core V2, NPC, gameplay tests or UI. Do not label it a playable G1B implementation. The original full React/TypeScript studio source archive was not transferred to the repository; preserve its SHA-256 in `manifest.json`. The image pixels in the base atlas are losslessly identical to the integration export (palette storage optimization), and the material mask remains unchanged.

## Game integration owner

On PR #61 branch, integrate the files from `/assets/g1b/chests/` into the real renderer; retain exact source+container custody, no synthetic test loot in production. Ship an actual playable path and 640×360 screenshots for the user to evaluate. Bot checks should be short and limited to bugs/invariants (no item duplication, correct save/reload, no auto re-pickup on intentional drop, proper respawn cycle).
