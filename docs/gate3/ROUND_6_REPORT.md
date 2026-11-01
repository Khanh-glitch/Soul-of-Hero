# ROUND 6 — Report

Decision-and-planning round. Three documents produced, no production file touched:

* `docs/gate3/ROUND_6_ARCHITECTURE_DECISION.md` — D1 (Level 3 ownership) and D2 (death flow)
* `docs/gate3/ROUND_6_REUSE_MATRIX.md` — REUSE / REAUTHOR / REJECT / DEFER per subsystem
* `docs/gate3/ROUND_6_INTEGRATION_BLUEPRINT.md` — pinned staging, ownership, gates, rollback

---

## Verified this round (obtained, from the live tree at `d7f6da7`)

1. **Candidate A is not a Gate 3 invention — it is PR #5's implementation.**
   `prototypes/gate0/level_data/chapter_1_level_3_a.json` is **byte-identical**
   (`8687766b…`) to `data/levels/chapter_1_level_3.json` on PR #5's base branch
   `arena/b1c99a44` (`f27e8b7`). PR #5's 3-file diff ships no data; the L3/L4 rewrite lives
   on its base branch.
2. **PR #3 is already in this branch's history.** `1c21a49` is an ancestor, and
   `main.gd` / `hud.gd` / `knight.gd` / `hero_soul_manager.gd` are byte-identical to PR #3's
   head. PR #3 does **not** touch `data/levels/chapter_1_level_3.json`.
3. **The map contracts are not the conflict.** PR #5's own auditor passes current canonical
   (unchanged), Candidate A (floor 5 004 → 3 351, Jaccard 0.278) and Gate 3's map. A Python
   re-implementation of `chapter_1_campaign_map_design_test.gd`'s assertions finds **0
   violations for all three** documents. Entity counts, enemy mix, spikes, sigils, camps and
   rooms survive; the divergence is spatial identity and envelope.
4. **Gate 3's map is Candidate A plus a carve that changes collision**: Backdrop 3 351 →
   3 413, Geometry 1 702 → 1 686 (−27 wall cells became floor, +11 new wall cells).
5. **The painter is map-agnostic; the data is not.** Canonical: 5 004/5 004 floor cells,
   1 104/1 104 wall cells (764 `wall_face` + 340 `mass`), 0 cells outside the map, no
   water/coping (no garth). One leak inside `build_material()`: the `SHAFT_ROOM` stair loop
   paints 3 stair tiles onto canonical **floor** cells `(30..32, 21)`.
6. **Props are 116 × 96-bound.** 45 of 52 placements fit canonical, **7 find no legal cell**
   (all floor-3 south), **28 relocate** (median 3.5 cells, max 9). The fitting algorithm and
   its safety proof are reusable.
7. **Camera framing does not transfer.** On canonical the derived storey bands overlap by 5
   and 9 rows and extend past the map edge (x to 119 > 116). The floor-2 arrival framing
   Gate 3 tuned cannot be reproduced there by reusing the code.
8. **The 32-px rock lattice is measurable, not just asserted**: normalised autocorrelation of
   the apron gives (32,0) ≈ 0.25–0.60 across four patches with (32,32) ≈ 0.
9. **Production has a complete revival path switched off.** `knight.gd::respawn()` (`:2765`)
   restores every hero pool, barrier, mana, stamina, teleports to `GameSession.checkpoint`
   and grants 1.0 s invulnerability. **No caller exists in `game/`.** `hud.gd:108` hides
   `RespawnButton`; only `DeathRestartButton` is wired, and it calls `reset_run()` (score,
   sigils, checkpoint) then restarts the level.
10. **At Level 3 the party is one Hero** (reserve capacity 1; Archer arrives at L5 or 50
    shards), so 1 592 gross = **144.7 %** of a bar. Hazards are 6–13 % of the gross; the
    threat is **9–12 enemy blows of ≈150 HP** per descent against a 1 100 HP bar.
11. **Harness limitation confirmed**: `capture_gate3.gd` models one body; no reserve, no
    relay. Its evidence is one-Knight evidence.
12. **Reload contract is the integration's sharpest edge**: after `map_changed`,
    `main.gd::_on_level_data_changed()` respawns entities and `_apply_camera_bounds()` writes
    whole-map camera limits, which the presenter only re-applies on a storey crossing.

## Unknown (specified, never measured here)

* Whether Candidate A passes the production suite in **real Godot** (source-level says yes).
* Design quality of either map — no independent 80/100 score exists for either.
* WebGL2 cost of the presenter. Only software-GL numbers exist (nodes 754 → 866, objects
  12 764 → 14 030, draw calls 227 → 96, frame time 15.44 → 17.05 ms, +10.4 %).
* Whether the owner prefers a presenter at all, versus authoring the archive look into the
  level data.

## Recommended

* **D1 — direction A:** the shipped 77-entity, 116 × 84 map stays the content of record;
  Gate 3 is re-declared as **presentation technology**; its 116 × 96 carved document is a
  fixture that is never promoted. Adopt Candidate A (direction B) only after a green CI
  probe *and* a written owner acceptance of the level-identity change. Do not port the
  archive onto the canonical map now (direction C): 7 placements have no legal cell and
  every frame would be invalidated.
* **D2 — option B:** keep the shipped flow until the owner approves player-chosen revival at
  the last checkpoint (finite per-run budget, `knight.respawn()` as the mechanism, no save
  change). Reject the automatic director even though it is already written, and do not
  rebalance anything.
* **Engineering:** one CI-runner-only substitution probe; fix the two authoring leaks
  (`worldmodel.DOORS`, the stair loop) before any re-authoring pass; promote the presenter
  as moves behind a per-level flag so rollback is one boolean.

## Needs owner approval (not self-approved here)

1. Which Level 3 is the content of record (A1 canonical vs A2 adopt Candidate A).
2. PR #5's scope restated — L3+L4, or Level 4 only.
3. Death-flow policy: keep restart-only, or approve checkpoint revival (and its budget).
4. Promotion of the presenter into `game/`, `data/`, `assets/` (protected trees).
5. Any HP / damage / roster / persistence value — none proposed, none changed.

## Contradiction reported, not resolved

The brief's direction — "retain the canonical 77-entity contract **and** PR #5 owns L3/L4
design" — cannot hold as written: PR #5's branch already ships a 79-entity, 116 × 96 Level 3.
Round 5 §4.3's claim that PR #5's auditor "fails on entity count and footprint by
construction" is also incorrect (measured: it passes). Both are corrected in
`ROUND_6_ARCHITECTURE_DECISION.md` §3.3–3.4.

## Smallest safe Round 7 scope

1. Add **one** CI step that copies Candidate A over the production path *inside the runner
   only* and runs `chapter_1_campaign_map_design_test`, `chapter_1_collision_route_test`,
   `content_contracts_test`, `chapter_1_balance_matrix_test` and the slot-3 campaign capture
   (spawn/mid/end); publish logs and frames as evidence.
2. Write the owner decision package: two questions (A1/A2, B/defer) with the numbers above.
3. Draft `ROUND_7_REVIVAL_POLICY.md` as text only.
4. **No** file moves, **no** balance edits, **no** presenter refactor, **no** PR #3/#5 work.

## Boundaries held

Documentation only. `data/**`, `game/**`, `tests/**`, `assets/**`, `project.godot`, prototype
gameplay code and existing evidence logs/screenshots are unchanged (verified with
`git status` before commit). No merge, no deploy, no rebase, no force-push, no new PR, no
change to PR #3 or PR #5. All probes ran read-only against a `/tmp` copy or in-memory.
