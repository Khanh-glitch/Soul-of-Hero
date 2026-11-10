# SOH Journey — A × B Fusion

**Authoritative donor UI direction: A (no number).** Not a cloned new game: `web/uiux/visual-overhaul` remains the only candidate app. Includes A Waymark, Ledger, world beacons, flares, cinematic and Daily Waypoints. B's selected practical ideas are integrated into the same UI: immediate goal switcher, one-click contextual action, HUD context strip during map/craft, robust save-state and achievement gallery.

## Inventory scrollbar correction

`sv-left` and `iteminfo` no longer scroll. The 24 slots remain a fixed grid and the responsive Pack pane is reflowed; long recipe catalogs remain wheel-scrollable without browser-native scrollbars (mouse/touch/keyboard still work). The CSS does not hide game content just to fake an all-fit screen; screenshot and DOM geometry acceptance is required at both 640x360 and 1280x720.

## Daily Waypoint fairness

Daily combinations are generated from *eligible* tasks in distinct categories with a score ceiling sufficient for the advertised Beacon milestone. Rerolls cannot make a previously reachable daily milestone mathematically unreachable. No synthetic points/items.

## Save custody

Journey v1 is serialized inside the same checksum/revision as GameState. The old `soh.journey.v1` key is migration-only, read once if the canonical profile has no journey. This avoids detached duplicate save authority. QA remains in-memory only.

## Verification

`npm ci && npm run verify:fusion && npm run verify:assets && npm run typecheck && npm run test:journey && npm run build && npm run qa:browser`.
Full historical gameplay regression is run separately and reported honestly. No merge into Gameplay R12 without integration-specific checks.
