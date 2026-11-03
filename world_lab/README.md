# SOH Veyra World Lab

Deterministic GOLD-derived **world/art/authoring candidate** for Soul of Hero. This is a review lab, not a Godot gameplay scene and not a claim of native playability.

## Run

```bash
cd world_lab
npm install
npm run build          # legacy atlases -> compiled world -> POIs/ecology -> 10 REJECTED shots -> QA
npm run hero:build     # ONE provenance-backed Argus hero scene: ledger -> scene graph -> native render
npm run hero:test      # strict exact-SHA/rect/frame, palette, y-sort, shadow, verdict QA
npm run serve          # browser review/authoring tool on 0.0.0.0:3000
npm test               # legacy compiler/data QA from persisted data
npm run test:browser   # real headless-Chromium smoke test (server must be running)
npm run bench          # Node renderer/streaming benchmark
```

`npm run build` accepts `--edits=data/creator_edits.json`. The browser tool can save/export/import those edits and trigger the same rebuild from `/api/rebuild`.

**Current single visual candidate:** `screenshots/ARGUS_GREAT_LENS_HERO.png` (native
`640×360` 1×), exact crop ledger `data/hero_provenance.json`, tracked scene graph
`data/hero_scene.json`, full review `HERO_SCENE_REVIEW.md`, browser provenance view
`/src/app/hero.html`. The creator rejected all 10 legacy screenshots;
`screenshots/PAIRED_VISUAL_REVIEW.*` is audit-only and `paired` Greywater→Argus
remains only a traversal-route thesis.

## Honest status

- `SINGLE_PROVENANCE_BACKED_VISUAL_CANDIDATE_BUILT` for the one hero scene; `EXACT_SHA_RECT_FRAME_VERIFIED` by `npm run hero:test` (12/12).
- `TECHNICAL_PROVEN_LEGACY_COMPILER_AND_DATA_ONLY` for deterministic compile, source fingerprints, ID roundtrip and browser smoke tests — **not** visual approval.
- `LEGACY_TEN_SHOTS_REJECTED_BY_CREATOR`; no `READY_FOR_CREATOR_VISUAL_REVIEW`, no approval request for weak iterations.
- `PLAYABILITY_UNPROVEN`; `GAMEPLAY_INTEGRATION_BLOCKED`.
- No Godot 4.7 scene/import/runtime, owner A0/A1/A3/A8/Gameplay integration, C01–C24 same-SHA proof, 336h E2, independent playability, canonical HP/yield/loot/economy, or creator acceptance is claimed.

Read `HERO_SCENE_REVIEW.md`, `ASSET_LICENSES.md`, `THIRD_PARTY.md`, `ART_PIPELINE_REVIEW.md`, `SOURCE_MANIFEST.md`, `DESIGN_RATIONALE.md`, `HANDOFF.md`, `qa/HERO_TEST_REPORT.md`, `qa/TEST_REPORT.md` and `data/source_manifest.json` before treating any artifact as production input.
