# UI asset presentation rules

The production UI uses authored textures for visible frames, panels, buttons, bars, focus rings, overlays, and touch controls. Runtime code may bind live data and responsive layout, but must not draw those visuals with `_draw()`, `draw_*`, `StyleBoxFlat`, gradients, polygons, or flat `ColorRect` panels. Presentation structure belongs in `.tscn` scenes: data-driven lists instantiate authored row, text, action, and card components instead of constructing `PanelContainer`, `Label`, `Button`, or overlay nodes in gameplay scripts.

## Asset hierarchy

- TravelBookLite supplies book pages, popup/card surfaces, button states, slots, focus frames, bars, fills, markers, and touch-control art.
- Free Inventory supplies inventory cards and slot frames.
- RPG Arsenal supplies equipment and item illustrations.
- Dungeon and chapter artwork supplies full-screen backdrops and modal dim textures.

## Equipment transparency rule

An equipment illustration keeps its transparent silhouette in a grid slot, world drop, quick icon, and rarity presentation. Do not add an opaque background directly behind every equipment icon. A panel background is allowed only when the whole item is being presented as a readable card or detail row; in that case the icon sits above a separate authored slot or rarity frame. Rarity is communicated by the slot/frame tint, glow, label color, and VFX—not by flattening the item artwork onto a colored rectangle.

## Regression guard

Run `tools/run_ui_asset_backed_contract_tests.ps1`. It scans `game/ui` and runtime objective HUD sources and fails if procedural UI visual primitives return.
