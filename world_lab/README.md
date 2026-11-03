# SOH Veyra World Lab

Deterministic GOLD-derived **world/art/authoring candidate** for Soul of Hero. This is a review lab, not a Godot gameplay scene and not a claim of native playability.

## Run

```bash
cd world_lab
npm install
npm run build          # atlases -> compiled world -> POIs/ecology -> data -> captures -> QA
npm run serve          # browser review/authoring tool on 0.0.0.0:3000
npm test               # independent QA from persisted data
npm run test:browser   # real headless-Chromium smoke test (server must be running)
npm run bench          # Node renderer/streaming benchmark
```

`npm run build` accepts `--edits=data/creator_edits.json`. The browser tool can save/export/import those edits and trigger the same rebuild from `/api/rebuild`.

See `screenshots/PAIRED_VISUAL_REVIEW.png` and `screenshots/PAIRED_VISUAL_REVIEW.md` for the creator-selected paired visual candidate.

## Honest status

- `READY_FOR_CREATOR_VISUAL_REVIEW` for the paired spatial/art candidate.
- `TECHNICAL_PROVEN` for deterministic compile, source fingerprints, ID roundtrip, QA and browser-tool smoke tests.
- `PLAYABILITY_UNPROVEN`; `GAMEPLAY_INTEGRATION_BLOCKED`.
- No Godot 4.7 runtime, owner A0/A1/A3/A8 integration, native player journey, canonical HP/yield/loot/economy, or creator acceptance is claimed.

Read `SOURCE_MANIFEST.md`, `DESIGN_RATIONALE.md`, `HANDOFF.md`, `qa/TEST_REPORT.md` and `data/source_manifest.json` before treating any artifact as production input.
