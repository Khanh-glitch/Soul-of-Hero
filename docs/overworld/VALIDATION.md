# Hollow Marches — Validation

## Offline validator (runs anywhere with Python 3, no Godot required)
```
python3 tools/validate_overworld_topology.py
```
Checks:
- Exactly 10 landmarks, each with a unique world id and 1:1 mapping in
  `data/overworld/landmark_registry.json`.
- ≥3 camps, ≥3 discoveries, ≥3 shortcuts.
- Every landmark reachable from the refuge given the canonical shortcut
  unlock sequence (L5 → bridge, L6 → conduit, L7 → beacon road, L9 → valve).
- L1 reachable with zero shortcuts unlocked; L10 only reachable when every
  shortcut and prior level is open.

## Runtime tests (require Godot 4.7 headless)
```
# Unit / structural tests (standalone GDScript):
godot --headless --path . --script res://tests/overworld_integration_test.gd
godot --headless --path . --script res://tests/overworld_persistence_test.gd
godot --headless --path . --script res://tests/overworld_transition_test.gd
godot --headless --path . --script res://tests/overworld_provisions_test.gd

# End-to-end AppRoot entry test:
godot --headless --path . -- --overworld-entry-test
```
These exercise:
- Scene loads, all 10 gates spawn with correct IDs.
- ≥3 camps, ≥3 discoveries, populated TileMapLayers.
- L1 enterable, L10 locked at start.
- Provisions balance (caps, floors, burn times, safe/hazard/wild ordering).
- Persistence SaveService transaction surface.
- AppFlow routing surface (open_overworld / pending return / configure).

## Capture (requires a rendering driver; headless logs positions)
```
godot --headless --path . --script res://tools/captures/chapter1_overworld_capture.gd
```
Writes `.artifacts/overworld_<name>.png` for overview + each of the 10
landmarks when a rendering driver is available; on a headless build it logs
the camera positions instead (matching existing project convention).

## Manual visual QA checklist
1. Start game → Home → Campaign tab → "VÀO VÙNG BIÊN / THE HOLLOW MARCHES"
   button → enter.
2. Player spawns at Ashen Refuge; camera clamps to world bounds; HUD shows
   camp = camp_refuge, Provisions 80/100.
3. Walk the principal road north: visible stone path, no invisible walls.
   Western detour leads to Crypt (L1, ENTER) and Ossuary (L2); east leads to
   Archive/Reliquary/Crossroads camp.
4. Broken bridge west of Crucible (L5) is impassable and looks broken; upon
   defeating L5 the bridge visually fills in and becomes walkable.
5. Walking east from Crossroads reaches Relay (L6) and the powered conduit
   to the ridge (blocked until L6 clear).
6. Beacon ascent blocked by rubble until L7 clear; Ridge camp accessible
   after that.
7. Gate (L9) initially blocks access to the Citadel (L10).
8. Resting at a camp refills provisions, updates HUD camp ID.
9. Discoveries sparkle; interacting with one grants the advertised reward
    and provisions; second interaction does nothing.
10. Provisions decrease slowly while walking; standing at a camp doesn't
    drain. Zero provisions doesn't softlock the player.
11. Pressing Escape returns to Home. Entering a gate and aborting/clearing
    offers "VỀ VÙNG ĐẤT HOANG" (not Home) on the completion screen; returning
    lands you at the gate threshold on victory or at the last camp on
    death/abandon.
12. No visible unpainted void cells within the authored envelope; camera
    never pans outside the world bounds.
