# Map Agent packages

Add a `*.json` `RuntimeMapPackage` (schema and validation in `../game/map-package.ts`) here and rebuild the Web app. Valid packages are discovered and selectable in the real runtime; invalid packages produce diagnostics on the selection screen. Do not alter the owner’s geometry during import. This directory intentionally contains no invented alternate map.

The current runtime requires exactly 200×200 tiles of 16 pixels, its existing terrain and 16 zone codes, and six existing Elder IDs. `geometry.economy` and world rasters must describe the same map; use JSON arrays, not serialized typed-array objects. Author the physical statics, masks, road/bridge widths, protected critical paths, POI access and finite loot, cash/vendor/evacuation and build/loading sites. The loader checks raster widths and physical entity references but does **not** prove swept turning clearance, POI reachability or gameplay balance.

Each unique `id@revision` may coexist; never replace or remove a released revision while saves may reference it. Changed geography, contents, seeds or source rules require a new revision and preservation of the old version, or a separately tested migration. See `docs/survival/WORLD_ECONOMY_CONTRACT_FOLLOWUP.md` for the exact handoff, save policy and remaining blockers.
