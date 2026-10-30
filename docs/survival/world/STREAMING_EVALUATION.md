# A1 streaming / chunk-integration evaluation

Decision: **DEFER a streaming rewrite for the first-hour corridor; keep the bounded static one-chunk annex.** Re-evaluate true 2D `TileMapLayer` chunk windows only when A0 native profiling shows a concrete need.

## Current SOH code inspected

- `game/overworld/overworld_world.gd` decodes baked RLE into three `TileMapLayer`s (`Ground`, `Detail`, `Solid`) and a y-sorted prop tree. It keeps authoritative solid/detail copies for traversal/build validation.
- `game/overworld/overworld_tiles.gd` builds one atlas `TileSet` from the shipped SOH atlas; collision is attached only to obstacle frames.
- `tools/survival/worldgen/compile_connector.py` composes the pinned legacy bake + exact ridge delta + unchanged `chunk:6:3` into a fail-closed 448×256 pilot. Unsupported annex padding is solid.
- The corridor checkpoint adds only a detail overlay, eight inherited props, and three container bodies inside that same chunk. It does not import 192 chunks.

The current pilot is small enough that a streaming lifecycle would add mount/unmount, save-window, nav-rebuild and camera-boundary risk without demonstrated benefit.

## Compatible OSS reference

Candidate: `gdquest-demos/godot-procedural-generation`, pinned `19c98cee16ed18e642b3ce178f4c649d56b334b2` (2026-06-26). GitHub's license API reports `NOASSERTION`, but the actual `LICENSE` file was read: **source MIT ©2020 GDQuest; art/audio CC-BY 4.0**. Decision: **REFERENCE only** for code pattern; no GDQuest art imported.

Relevant file inspected: `godot4/infinite_space/persistent_world_generator.gd`. It keeps a `_modifications` dictionary separate from generated sectors, maps a global position to a sector, and regenerates sectors while preserving player modifications. The useful SOH lesson is not infinite procedural planets; it is the separation:

```text
immutable static chunk truth + durable per-instance mutation log + active window
```

That matches A1's existing rule: static world plan/chunks are immutable; A0 SaveService owns mutations; source instances have durable IDs.

## When true 2D TileMapLayer streaming would help

Consider a chunk-window implementation only if A0 measures one of these on the target native/Web build:

1. more than the current one-chunk annex must be active for a connected route;
2. full-map decode/paint or prop count causes unacceptable load time/memory/frame time;
3. southern A8 sites or additional canonical chunks become production-mounted while the legacy inset remains active.

If triggered, the narrow design is:

- one `TileMapLayer` set per 64×64 chunk, or a small ring of chunk nodes around the camera;
- load/unload by chunk coordinate, not by arbitrary pixel rectangles;
- keep collision/nav local to active chunks and rebuild only touched chunks;
- keep POI/container/claim state in SaveService keyed by `poi_id` / `si:*`, never by node instance path;
- preserve global pixel coordinates and camera limits derived from the canonical frame;
- fail closed outside loaded/authored chunks, as the current annex padding already does.

## Rejected alternatives

- 3D streaming modules / GPU heightmap stacks: wrong dimensionality and unnecessary dependency for a 2D top-down RPG.
- Importing all 192 chunks now: violates the bounded connector scope and risks replacing the legacy map before A0 production gates.
- Rewriting `OverworldWorld` before profiling: gratuitous architecture churn while the first-hour corridor still fits one chunk.
- Treating A8's isolated 960×600 scenes as overworld chunks: they fail the authored footprint and need an explicit shell/interior decision first.

## Handoff

A0 owns any production streaming mount and profiling. A1 will supply chunk-window contracts and deterministic load/unload negatives if the measured trigger is met. Until then, the corridor remains a static overlay on the already-tested connector annex.
