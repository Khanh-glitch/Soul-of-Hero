# SOUL OF HERO — Home Map flow

## Product flow

```text
Loading
   ↓
Home Map (free movement)
   ├─ Campaign Gate → Campaign / Training → Details → Gameplay → Results
   ├─ Soul Shrine   → Hero Roster
   ├─ Trial Master  → Modes
   ├─ Chronicler    → Bestiary
   ├─ Caretaker     → Settings / New Profile
   └─ Memorial      → Credits
```

The old Title → five-tab Hub path is retained only as compatibility source
content. `AppRoot` now preloads the Home scene during Boot and calls
`AppFlow.open_home()` with no function selected. Boot only reports completion
after the Home `PackedScene` is valid; slow storage keeps the loading state
visible instead of switching to a blocking 100% screen.

## Interaction contract

- Keyboard/controller movement uses the existing semantic `move_*` actions.
- `interact` opens the closest destination inside its radius.
- Mouse/touch ground input starts lightweight auto-walk.
- Mouse/touch on a destination auto-walks to its interaction radius, then opens
  the destination.
- Manual movement immediately cancels both auto-walk and its pending destination.
- If the viewport changes while auto-walking, the destination approach point is
  recalculated from the new responsive layout.
- The contextual prompt follows the most recent touch, gamepad, or
  keyboard/mouse input modality.
- Opening a function stops auto-walk and disables only the Home player. It does
  not pause the SceneTree.
- `Esc` closes an open panel; from the free map it opens Settings.
- Function Back clears the function scene and restores movement at the same
  world position.
- Function scenes are loaded on demand when selected; Home does not preload all
  five feature panels during Boot.

## Route compatibility

- `AppFlow.open_home(function_id)` is the canonical route and publishes `home`.
- `AppFlow.open_hub(tab_id)` remains a compatibility alias that opens Home with
  the matching function panel.
- `AppFlow.abort_to_home()` clears a run and returns to the free map.
- `AppFlow.abort_to_hub("hero_roster")` remains supported for the Results shortcut.
- Standalone Settings/Credits routes return to the free Home Map.

## Visual composition

Home now uses the authored Cainos v1.2.3 demo instead of reconstructing a map
from unrelated atlas crops. The user-supplied archive contains
`Scene Overview.png` plus the complete `SC Demo.unity` source (nine Tilemaps,
prefab placements, shadow sprites and three elevation layers). The exact
1200×1200 overview is rendered 1:1 by `home_map_canvas.gd`, with nearest texture
filtering and an integer camera offset.

The native logical viewport remains 640×360 and scrolls across the demo world.
All six Home destinations use open foot-anchor positions checked against the
source scene. Player movement and click-to-walk use a 271-cell connected region
exported from `Layer 1 - Grass` with `Layer 1 - Wall` removed, so every function
is reachable from the demo's original spawn without crossing the gray backdrop
or taking false shortcuts between elevation layers. The persistent chrome stays
limited to the slim profile header and one contextual prompt.

Source, archive hash and redistribution notes live beside the imported demo at
`assets/environment/cainos_demo/THIRD_PARTY.md`.
