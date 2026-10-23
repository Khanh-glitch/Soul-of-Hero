# Gate 0 Rebuild — Durable integration contract

## Status and provenance

- **State:** authorized rebuild; prior local-only Gate 0 bundle was lost and is **not recoverable**. This is a NEW implementation, not a reconstruction of identical patch bytes.
- **Base:** Candidate A commit `f27e8b7fe03f33b2001b08579543e5010a0a1b9d`.
- **Art source:** Candidate B commit `e7cad36f8f21e746abefe44ac6cfa54db9a378e6`, folder `prototypes/environment_art/archive_audition/`.
- **Writable branch:** `integration/gate0-archive-art` ONLY.
- **Frozen:** both Arena branches, PR #4, `main`, `data/**`, `game/**`, `tests/**`, `project.godot`, accepted Level 2 and other campaign maps.
- **No** merge, deployment, new PR or changes to the campaign.

## Mandatory checkpoints — push before progressing

1. **M0 — Asset provenance and recovery checkpoint.** Copy only B's required original asset PNGs, atlas descriptors and generator/provenance files into a namespaced Gate 0 folder. Commit and push. Record source blob SHAs and destination paths in `docs/gate0/SOURCE_MANIFEST.md`. Validate the branch HEAD on remote.
2. **M1 — Deterministic overlay checkpoint.** Add a small Level 3 spawn-area overlay (provisional region x=0..39,y=0..26) and its authoring script/validator. Use A's pinned Level 3 playable geometry, no entity/door/reward edits. Commit and push. Validate generation determinism and geometry/prop collisions.
3. **M2 — Runtime adapter and capture harness checkpoint.** Add a *prototype-local* adapter to the REAL `game/main.tscn` / `DungeonLevel` / Knight / HUD instance. Import only selected B whole-sprite props. Do not add schema sources or a second Knight/HUD. Test valid anchor/body collision and actual walking, not just teleports. Commit and push source BEFORE runtime experiments.
4. **M3 — GitHub Actions Godot 4.7 runtime verification.** Add a branch-scoped workflow (Ubuntu, Godot 4.7, Xvfb/Mesa) that imports, validates, executes before+after captures, and asserts success and 1280x720 outputs. Commit and push workflow. Review actual Godot evidence, not PIL previews.
5. **M4 — Durable final evidence.** Commit the raw Godot captures (spawn, entry, destination, combat-space), comparison pairs, close-ups, logs and final report to `docs/gate0/evidence/`; verify the files can be fetched from GitHub at a commit SHA. If CI artifacts are also uploaded, note their expiry and do **not** rely on them as the sole durable copy.

## Fail-closed constraints

- **No local-only final delivery**: any milestone that exists only in a temporary workspace is incomplete.
- On loss of a workspace, restore from the latest pushed checkpoint instead of inventing the missing output.
- `PIL` previews are explicitly labeled authoring-only and **cannot** satisfy runtime visual acceptance.
- Real Godot 4.7, real HUD, renderer/lighting, actual Knight movement and collision, valid TileSet sources and original 79 Level 3 entities are required for M3 acceptance.
- Screenshots must clearly distinguish `before` vs `after`; no mislabeling, compositing or cropping away visual defects.
- If the current footprint cannot convincingly host a B asset, document the limitation; do not fake it with incorrect tiles.
- No more than a curated small set of assets; the objective is environment identity, not prop density.
- Minimize redundant CI. Iterate with the smallest meaningful checks.

## Acceptance

A reviewer must inspect full native Godot images and confirmed collision/route evidence, not just report text or passing tests. Mark **visual approval pending** until M3/M4 evidence is reviewed.

## Agent stopping rule

Stop after M4 and report the branch, exact commit SHA, exact files changed, verified CI run link, raw evidence paths and any unresolved defects. Do not merge or touch PR #4.
