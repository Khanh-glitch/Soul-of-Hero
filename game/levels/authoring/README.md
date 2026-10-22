# Drag-and-drop map entities

`MapElementMarker` scenes are editor authoring proxies. They use art already in the
project for their viewport previews, but they never become gameplay instances.
At runtime `AuthoringEntities` and every marker are invisible and process-disabled;
the validated JSON remains the runtime source consumed by `game/main.gd`.

## Presets

The `presets/` folder contains one draggable scene for every entity type registered
by `LevelSchema`: player, all three enemies, coin, sigil, checkpoint, chest, bow
reward, exit gate, floor door, spikes, and torch.

Drop preset scenes below the level's `AuthoringEntities` node. Rename the instance
or set **Entity ID** in the Inspector. Enemy patrol distance and chest reward are
normal Inspector fields. For a floor door, drag its paired door node into **Door
Target Marker**; its destination then follows that marker automatically.

## Editor integration API

`MapEntityAuthoringSerializer` exposes static helpers for an editor dock:

- `deserialize_level_file(container, level_path, edited_scene_root)` replaces
  markers from a level JSON document and reconstructs paired door links.
- `serialize_level_file(container, level_path)` validates and writes markers back
  into the document's `entities` array.
- `serialize_container`, `serialize_level_document`, and `deserialize_entities`
  are available for UndoRedo-aware integrations that manage persistence themselves.

Serialization rejects duplicate IDs and validates the complete document with
`LevelSchema` before writing. Encounter Resources still identify enemy spawns by
stable entity ID, so changing an encounter enemy's ID also requires updating that
encounter data until encounter authoring is moved into the same visual dock.

Run `tools/run_map_authoring_tests.ps1` for the focused 50-check round-trip test.
