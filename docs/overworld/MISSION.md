# MISSION — World art, readability, and the hybrid asset pipeline

This document is the working plan for the environment production pass on
`arena/54306b59-soul-of-hero`. It records what was asked for, what was built,
and — the part that matters — what was **measured natively** rather than
assumed.

> Note on provenance: the `SOH_WORLD_ART_AND_READABILITY_MISSION.zip` attachment
> named in the brief was not present in the workspace (no archive anywhere on the
> filesystem, no `MISSION.md` inside the repository). The scope below is the
> mission as stated in the message: finish the world-art pass, establish a
> reusable smart occlusion and traversability system, build the non-destructive
> hybrid asset/manual-override pipeline, keep the game playable, and prove it with
> real Godot screenshots and runtime evidence instead of green exit codes.

## Scope and frozen surfaces

| In scope | Frozen |
| --- | --- |
| `game/overworld/` runtime readability systems | combat, Hero kits, RPG/progression math |
| `tools/overworld/` asset generation + override pipeline | HUD layout and narrative strings |
| `assets/environment/overworld/` art | dungeon interiors (L01–L10) |
| overworld visual evidence and CI gates | save schema, rewards, unlock topology, Gold VFX |

## The four workstreams

### 1. Smart occlusion (readability)

The overworld is y-sorted, so a landmark whose feet are below the player's is
drawn over the player. Walking the north face of any building made the Knight
invisible — the exact moment a player is trying to find the door.

`game/overworld/overworld_occlusion.gd` fades only what actually hides the
player:

* overlap is tested against the sprite's real atlas rect anchored at its feet, so
  a tall tower with a narrow base does not fade for a player at its empty corner;
* only props drawn in front are considered (feet at or below the player's);
* radius-hysteresis (enter 2 px, exit 5 px) so standing on the boundary does not
  flicker the world;
* fade depth depends on what is hidden — a bush goes to 0.30, a landmark to 0.62,
  because the destination must stay readable;
* work is bucketed on a 128 px grid and bounded to the buckets around the player;
* `snap()` resolves alphas immediately, so a screenshot never depends on how many
  frames of interpolation have elapsed.

### 2. Traversability (honesty)

`OverworldWorld.is_solid_cell()` knows the terrain painter and nothing else, while
the running world also builds a `StaticBody2D` for every landmark, tent, tree and
cart. Nothing asked whether the built world was still *connected*.

`game/overworld/overworld_traversability.gd` builds a grid from the live scene —
0 free, 1 terrain, 2 prop body — floods it with walking distances, and reports
every landmark threshold, camp, discovery and the spawn that the running world has
sealed off. The overworld controller runs this at build time and `push_error()`s
with a diagnosis if anything is unreachable, so a walled-in dungeon door can never
ship quietly.

It also answers the only honest question about a shortcut: after opening one, is
the walk between the two sides actually shorter? (`world.set_shortcut_open()` also
drops the prop's own body out of collision, and an open shortcut's body is skipped
so the grid matches what the player feels.)

### 3. Hybrid asset pipeline (non-destructive overrides)

Generated art is fast and reproducible and a dead end for art direction: the
moment a frame needs a human hand, either the generator becomes unmaintainable or
the hand work is destroyed by the next regeneration.

`tools/overworld/overrides.py` adds a non-destructive layer:

```
assets/environment/overworld/overrides/tiles/<frame>.png
assets/environment/overworld/overrides/props/<frame>.png
```

`art.py` / `art_props.py` write the generated sheet, then compose every override
on top, at the frame's own size, in place. Deleting the override restores the
generated frame. An override with a wrong frame name or a wrong size is reported
and skipped — a typo must not blank part of the atlas.

`data/overworld/art_manifest.json` records per frame: rect, source
(`generated` | `override`), origin file and license. That manifest is what the
provenance audit reads, so "is any pixel of unknown origin" is answered from data.

**First users of the pipeline.** The two plainest exteriors — L03 Crossfire
Archive and L04 Spiral Reliquary — are painted by hand in
`tools/overworld/manual_landmarks.py` and live as overrides. They are the only
bespoke frames in the set; everything else stays generated.

### 4. Native evidence (the only kind that counts)

The frame report (`tools/captures/frame_report.gd`) prints, per station, the
colour count, edge density, dominant-tone share, luminance spread, palette and a
32×16 luminance map — because the PNGs cannot be downloaded from this project's
CI, so the log is the only way anyone sees the rendered pixels. A station fails
below 24 colours or 8 % edge density.

New stations added for this pass:

| station | what it must prove |
| --- | --- |
| `occlusion_off` | the player behind a landmark, occlusion disabled: the Knight is invisible |
| `occlusion_on` | the same frame, occlusion enabled: the Knight is visible, the landmark is not erased |
| `archive_approach`, `reliquary_approach` | the two hand-painted exteriors, natively |

The pair is the demonstration: same camera, same tile, one flag different, and the
frame report's own numbers must differ in the region the Knight occupies.

## Regression tests

| test | what it asserts |
| --- | --- |
| `overworld_occlusion_runtime_test.gd` | occlusion off → sprite opaque; player behind → fades to a readable alpha; walking away restores exactly; step() does not move the player or the faded set; work stays local |
| `overworld_traversability_runtime_test.gd` | grid agrees with the terrain painter; prop bodies contribute walls; nothing is sealed off; opening a shortcut clears terrain, restores its body, and shortens the walk |

Both boot the **production** `chapter1_overworld.tscn` through the existing
`overworld_runtime_case.gd` harness and assert observable state, never frames
elapsed.

## Verification discipline

* A green exit code is never evidence. Every native station carries a structure
  report and every step's log goes through `tools/ci/gate_log.sh`.
* Tests assert state that can fail. The occlusion test fails if the fade is a
  no-op, if it never restores, or if it moves the player.
* No test was weakened to make this pass. The suites that existed before this
  pass run unchanged.

---

# Status at the end of this pass

Everything below was executed on `arena/54306b59-soul-of-hero`, not planned.

| workstream | delivered |
| --- | --- |
| Smart occlusion | `overworld_occlusion.gd`: rect-anchored overlap at the player's feet, 128 px buckets so only nearby props are considered, enter/exit hysteresis (2 / 5 px), depth by role (vegetation 0.30, architecture 0.50, landmark 0.62, default 0.42). Wired into the controller and stepped once per frame. 22 runtime checks. |
| Traversability | `overworld_traversability.gd`: 0/1/2 walkability grid read from the live prop bodies, `PackedInt32Array` BFS with a head cursor (linear over ~73 000 free cells), `unreachable_endpoints()` with per-endpoint diagnosis, `nearest_free` / `nearest_free_position`. Wired in, invalidated when a shortcut opens. 26 runtime checks. |
| Hybrid asset pipeline | `overrides.py` (compose / list / report) + manifest with provenance per frame + `source_audit.py --check`. Deleting an override PNG restores the generated frame. |
| Manual overrides | `manual_landmarks.py` paints `lm_archive` and `lm_reliquary` — the two plainest exteriors, both on the critical path — each iterated four times against re-rendered native stations. |
| Verification | 13 gates / 413 checks green locally on a from-source Godot 4.7; 17-station capture and browser playtest run in CI. |

## What the systems found

Both new systems earned their keep before they were green:

* `d_crucible_cove` and `d_relay_shard` were buried under dead-tree colliders —
  visible rewards nobody could claim, because the bake checked the prop's anchor
  tile rather than the body it builds.
* A fresh character spawned inside the refuge tent, because `validate()` checked
  a hard-coded cell that had drifted from the world document's spawn.

## Not done, on purpose

* Combat, Heroes, RPG systems, progression, HUD and narrative: untouched.
* Dungeon interiors: untouched.
* Audio: untouched.
* No new landmarks, levels, mechanics or systems beyond the two the brief asks
  for (occlusion, traversability) and the pipeline that paints the world.
