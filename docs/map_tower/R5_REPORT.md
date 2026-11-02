# R5 — status: PARTIAL (one native gate red, visual acceptance open)

Continue of `2c0161a3`. HEAD `6e93b209`. Branch `arena/103e4440-soul-of-hero`. GOLD untouched, no merge.

## P0 — br_b solved, and the cause was mine
`br_b` GOLD: `at [1026.2415, 929.6871]`, bearing `0.3976 rad (22.8°)`, span **69 units = 276 px**
(the R4 report's "552 px" was my arithmetic error — corrected here).
Root cause: for an **asymmetric** span (`a ≠ b`) the deck is centred at the midpoint of the two
ray-marched reaches, but the sprite paste and the validator both used the GOLD marker as the deck
centre. Collision and art were therefore shifted ~½(a−b) units apart; the player could walk the
flank cells where "water per the water grid" met "walkable per collision". Fixed by centring art,
collision and the validator on `deck_px`, widening foot decks to 8–10 units so a 12×8 px feet box
traverses a 22.8° deck on a 16 px grid, and refusing generated fords within 16 units of an
authored bridge.
**Result: 12/12 bridges validated** — path exists inside each bridge's own corridor, **zero water
cells crossed off-deck**, path proven to use the deck over water, deck centreline swept every
32 px with the D051 feet box, and both railings checked.

Bypass classification (P0.7), all 11 remaining bridges: the classifier emits
`unclassified route present` / `land-alternative` / `ford` / `DEFECT`; the R4 `rail_fail` entries
came from short bridges whose corridor includes both banks and from fords within 2 cells — i.e.
legitimate dry-land alternatives, not water traversal. Per-bridge values are in
`SPATIAL_VALIDATION.json → bridge_bypass_class`.

## P1 — evidence synchronised
* The 164 vs 158 discrepancy: both numbers are correct *for their own build*. The sample count is
  not a constant — it depends on how many bank offsets qualify, and R4's report quoted a local
  run while the artifact came from run `41383038822`. R5 removes the ambiguity: the validation
  JSON now carries `code_sha`, `world_meta_sha256` and `world_png_sha256` beside every count.
* Pinned result at `6e93b209`: **17/17 mandatory gates**, `exit 0`.
* Land POIs now report a concrete **entrance anchor cell** (`poi_entrance_anchor_px`, 58/58), not
  mere proximity to walkable terrain.
* 23 maritime POIs: each must sit on an island that owns a valid dock (enforced). Transported
  access is **not** claimed — `boat_logic: UNIMPLEMENTED`, ferries stay `FUNCTIONAL_BLOCKED`.

## P2 — visuals
* Beaches now follow ecology: cream sand only along **sea and lake** margins; river banks are
  gravel/dirt (`ground` census: sand 3477 → **906** cells).
* Surtur: 26 volcanic props (basalt boulders, forge, lava brazier vents) around the ash ring.
* Anubis: 48 tomb structures on a canonical grid + obelisks; **still visually weak** — the
  `sarcophagus` family filters to 0 sprites and `niche`/`pillar` crops are UI cards, so the
  necropolis is built from wall/pylon motifs only. Reported, not disguised.
* Greywater: composed settlement (three walled houses with doors, banners, market cluster, well,
  gate posts, chimney smoke) instead of a prop ring. **No roof sprite exists in the repo** — the
  houses read as stout stone structures, not cottages. That is the top intake item.
* Quarry: black/void tiles were removed in R4 (rubble filtered to 3 lit tiles, stone trimmed to 4).

## P3 — asset sources
All five raw packs reconciled from the canon branch (`RAW_PACK_INVENTORY.json`, SHA-pinned).
`docs/map_tower/ASSET_INTAKE_MANIFEST.md` lists the four remaining gaps with pack ID, members,
GOLD IDs, native size, compatibility and the reason each committed family cannot serve.

## P4 — native honesty
`godot-native-gate` runs Godot 4.7 with `set -euo pipefail` and **no `|| true`**, imports a
baseline worktree at `63f6001b`, imports the candidate, and diffs error lines.
Run `41384790439` → **gate FAILED at the baseline/candidate diff step**: new native error lines
appear in the candidate. The full logs and diff are in artifact `godot-native-gate`.
Native gameplay PASS is **not** claimed; engine launch alone was never treated as acceptance.

## CI (run 41384790439, HEAD 6e93b209)
| job | result |
|---|---|
| spatial (17 mandatory gates) | **success** |
| browser-capture (real Chromium, 640×360, overlays hidden + gameplay capture) | **success** |
| godot-native-gate (no `|| true`) | **failure — new native errors vs baseline** |
| godot-native-attempt (informational) | success |

## Remaining blockers
1. New native import errors (owner: A0/production, not Map Tower) — diff in the artifact.
2. Roofed buildings (intake #1), tomb/necropolis sprites (#2), volcanic geology (#3), animated
   sea (#4).
3. Visual acceptance: **not claimed**. Anubis and Greywater are the weakest areas; bridges, piers,
   lakes and riverbanks are materially improved and now source-backed.
