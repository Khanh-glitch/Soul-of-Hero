# Handoff / current verdict

## What is ready

- **ONE rebuilt Argus / Great Lens hero scene**: `npm run hero:build` regenerates `data/hero_provenance.json` (155 exact real crops, 8 sheets, SHA/rect/frame per frame), `data/hero_scene.json` (explicit 40×23 16px tile map, 2 mosaics, 21 y-sorted objects, 7 emitters) and `screenshots/ARGUS_GREAT_LENS_HERO.png` (native 640×360 1×, 36-colour strict palette). `npm run hero:test` verifies 12 strict checks. Review: `HERO_SCENE_REVIEW.md`; browser view: `/src/app/hero.html`.
- Reproducible `npm run build`: **legacy** compiler path — atlases, compiled GOLD world, POI overlays, two ecology variants, JSON data, 10 **REJECTED** 640×360 1× captures and compiler/data QA. Kept for regression only.
- Browser review/authoring tool at `npm run serve` with same-origin data and the **same shared ES-module renderer** used by Node captures: day/night/dusk, A/B variants, exterior + 3 Argus levels, camera presets, WASD movement, collision/grid/source-ID/resource/POI/route overlays, GOLD tile inspector, overview minimap, edit/lock/export/import/save/rebuild. It now also presents the single hero scene and its provenance.
- `data/hero_provenance.json`, `data/hero_scene.json`, `data/hero_derived_notice.json`, `qa/hero_results.json`, `qa/HERO_TEST_REPORT.md`, `qa/hero_render_stats.json`, `ASSET_LICENSES.md`, `THIRD_PARTY.md`, `ART_PIPELINE_REVIEW.md`, plus legacy `data/source_manifest.json`, `SOURCE_MANIFEST.md`, `data/build_fingerprint.json`, `qa/results.json`, `qa/TEST_REPORT.md`, `qa/browser_results.json`, `qa/browser_app.png`, `qa/benchmark.json`, `screenshots/capture_manifest.json`, `screenshots/PAIRED_VISUAL_REVIEW.png` (audit-only).

## Verdicts

- `SINGLE_PROVENANCE_BACKED_VISUAL_CANDIDATE_BUILT` + `EXACT_SHA_RECT_FRAME_VERIFIED` — 12/12 new hero-scene QA checks.
- `TECHNICAL_PROVEN_LEGACY_COMPILER_AND_DATA_ONLY` — 10/10 legacy compiler/data tests and headless-Chromium browser checks pass; these are not visual or creator approval.
- `LEGACY_TEN_SHOTS_REJECTED_BY_CREATOR` — no `READY_FOR_CREATOR_VISUAL_REVIEW`, no approval request for weak iterations. `paired` Greywater→Argus remains only a traversal-route thesis.
- `PLAYABILITY_UNPROVEN`; `GAMEPLAY_INTEGRATION_BLOCKED`.
- The one hero landmark is `AI_DERIVED_HERO_PROP_NOT_REAL_ASSET`, never real-asset proof.
- No `ACCEPTED_FOR_NEXT_STAGE`, no Godot-native claim, no creator acceptance.

## Creator edit loop

1. Open the browser tool, choose a preset and debug overlays.
2. Paint a tile or place a prop; lock the last edit or the visible 12×12-tile region.
3. **Save** writes `data/creator_edits.json`; **Export JSON** downloads a portable copy; **Import JSON** restores it.
4. **Rebuild with edits** calls `POST /api/rebuild`, which runs `node src/compiler/build.mjs --edits=data/creator_edits.json`, regenerates captures/QA and reloads.
5. Tile edits preserve `base` material; prop edits and locked regions are merged deterministically into variant B. GOLD IDs are never rewritten.

## What remains before production / Godot integration

- Creator visual review, corrections and explicit approval of the **single rebuilt hero scene** (none requested yet; weak iterations must not be sent).
- A current native Godot 4.7 scene/import/captures/test for this exact same-SHA kit, plus native lighting/collision/player-input integration.
- A0/A1/A3/A8/Gameplay owner commitments for `WorldSourceCandidate`, `WorldTraversal`, `BuildSiteSample`, `POIAccessGraphCandidate`, `WorldTimeHazardCandidate`, `RagnarokRouteCandidate` and all economic/AI/loot/HP semantics.
- Godot 4.7 import at the same SHA, native `TileMapLayer`/scene/lighting/collision/player-input integration, four distinct spawn walks, three player-selected build positions, 2+ POI access/retreat routes, no-Elder bank trip, Elder/nonboss comparison and 640×360 1× legibility proof.
- Source-ledger evidence for C01–C24; B01–B15 are expected outcomes, not verified production tests; 336h E2 remains HOLD.
- Private `APEX-CHAOS` controlled storage and Godot/browser production test targets were not accessible. Browser/node evidence here is not a substitute.

## Branch / delivery

All work is committed on the active branch `arena/2e3cfbd2-soul-of-hero` only. No PR was opened, no merge/close was performed, and no other branch was created. If push/remote visibility fails, reconnect GitHub in Arena rather than sharing credentials.
