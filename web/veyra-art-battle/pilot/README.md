# VEYRA / Arena art — playable pilot, November 9, 2026

## Open and test (no Python or build step)

Open **`PLAY_VEYRA_ARENA_ART_PILOT.html`** in a desktop browser. Choose **New run → VEYRA U=0.5 / Unified World → Creator Inspect**. Inside the game choose **World Map → Creator Inspection**, select a POI, then **Inspect & Play at …**. Click **Exit Inspection** to return to normal modes. This is the actual VEYRA world runtime, not a static image gallery.

Best representative art QA: **Fracture Quarry**, **Aion Edge Sawmill**, **Falls Powerhouse**, **Charcoal Kilns**, **Delta Filter Station**. Also inspect **Drowned Pier** and **Ironholm Harbor**; the creator fixture for Ironholm starts in the tally court where the newly painted quay is out of view, so moving to the industrial quay is necessary to validate its art. See the before/after sheet and original-resolution screenshots in `EVIDENCE/`.

## What was actually integrated

The original standalone VEYRA game runtime + GOLD world + 78 authored architecture additions (missing authentic C03) remains intact. Eight call sites in the bundled game now invoke the real Arena `c04-art`, `c01-art`, `c02-art`, and `f03-art` sprite factories and material deck painters, loading `pixel-craft` and `surface-art`. The art is visible during game rendering, with the player and HUD, not reprojected into a separate gallery. A capped 16×16 surface tile raster cache reduces recurring costly pixel sampling.

This switches the custom painter for **F03 15 industrial POIs + nine C01/C02/C04 port POIs**, but it does **not** imply all 24 were individually art-accepted. No source layout/collision/POI ID or GOLD coordinate was changed. The remaining 48 location plans and six earlier authored locations are kept; their current art is not replaced by this pilot. C03 original source is missing; never count its three ports as validated.

One corrective art change was needed after native visual review: `po_filter` had a chessboard of open water rendered on walkable service corridors. `src/surface-art.ts` now uses **damp stone masonry on the walkable corridors**; water remains represented by physical filter-tank sprites. This is a visual-only change; gameplay geometry is unchanged.

## Actual QA

- Chromium rendered **seven pilot POIs** (`po_fracquarry`, `po_sawaion`, `po_falls`, `po_kilns`, `po_filter`, `po_ironharbor`, `po_dpier`) in Creator Inspection; all had no recorded JS page errors.
- F03 surface caches populated for the inspected camera (`po_fracquarry`: 405; `po_sawaion`: 285; `po_falls`: 540; `po_kilns`: 102; `po_filter`: 504). `po_dpier`: five; `po_ironharbor`: zero **at initial fixture camera**, meaning this screenshot must not be cited as visual proof of the quay art.
- Filter station: player was moved by real keyboard input; **E: floor 0 → −1 → 0** passed; screenshot of both states is present.
- Same-POI old/new camera screenshots are in the `EVIDENCE/` directory. Weather is stochastic; the side-by-side is for geometry/art inspection, not a pixel-for-pixel golden oracle.
- No save/reload, production server, C03 integration, or all-81 art quality approval is claimed.

## Technical handoff

`SOURCE_ART/` contains the six actual Arena TS sources used by the pilot, plus the pilot-only correction to the filter surface. `BUILD/build-live-pilot.cjs` reproduces this working standalone output from the included `BASELINE_78_POIS_NO_C03.html`. Running it requires Node.js and TypeScript (`npm install typescript` if absent). The patch intentionally fails if the eight expected runtime callsite anchors do not match the target bundle.

**Do not merge this directly as FINAL.** Real-game side-by-sides reveal widespread repeated planar structures from the existing layout and several textures that remain visually busy. This is the art integration proving ground, not creative or production acceptance for all 81 POIs.