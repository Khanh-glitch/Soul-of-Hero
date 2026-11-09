# VEYRA — independent 81-POI art-battle workbench

**Branch:** `game/veyra-81-poi-art-battle-20261109`

This branch is isolated from production. It inherits the validated H01 source baseline (`cc85379e58e724de3ff6d1df46bc0669d1ab7765`) and stages the later C04, C01, C02, F03 remake and REST48 authored module source, plus the full human-facing asset audit and 81-POI visual critique.

## Status — important

**SOURCE STAGING / INTEGRATION HOLD — NOT A CERTIFIED FULL 81-POI RUNNABLE BUILD.**

The cumulative 81-POI release delivered in ChatGPT was an **installer** that requires the user's original `VEYRA_C03_BREAKTHROUGH_PLAYABLE.html` (or cumulative derivative), not a premerged 81-POI game. That exact C03 source/HTML was not accessible at branch creation. The original C03 bespoke authored plans and C03 procedural sprite source cannot be recovered from the source branch alone. **Do not substitute synthetic C03 tests or claim 81/81 runnable until actual C03 is re-imported and the whole branch builds and boots.** Do not overwrite the existing H01/flagships, the world GOLD reader or native production game.

## What is staged

- `web/src/veyra05/arch/{c04,c01,c02,f03,rest48}.ts` — authored location plans; `waterfront.ts` is a shared water-edge helper.
- `web/src/veyra05/{c04-art,c01-art,c02-art,f03-art}.ts` — the creator's **rejected/unapproved** procedural art, kept for provenance, comparison and replacement. These files are not an approved art canon.
- `web/veyra-art-battle/audit/` — inventory, sources, and point-by-point critique. The creator specifically says the F03 remake assets are ugly, mismatched with the game's visual style, and should be redesigned by an art-focused Arena agent.
- `web/veyra-art-battle/roster/` — 81 original GOLD POI IDs and REST48 roster.

## Arena handoff

1. Obtain the true original C03 Breakthrough game/source from the creator, or trace a verified canonical source recovery. Stop short of final-81 claims if unavailable.
2. Wire all authors into the runtime registry, floor streaming, authored colliders, scene and renderer; do not merely leave source modules on the branch. Preserve every one of the 81 canonical IDs and coordinates; verify H01, F02 (C01–C04), F03 and 48 remaining.
3. Build a browser-runnable **standalone world game** on THIS BRANCH, not an archive of documents and not a new repo. Run real Vite build and Chromium Creator Inspection of representative sites, test stairs, returns and save behavior as applicable.
4. Analyze existing actual SOH-approved pixel assets, palettes, outlines, scale, pixel snapping, lighting and perspective at normal 1×. Improve art in a recognizable SOH style, prioritizing the creator-rejected F03 artwork. **Preserve exploration flow and gameplay authority.**
5. Check representative scenes and all 81 entries, with before/after evidence, then offer the creator a playable bundle and exact commit/PR. No self-merge, no false DONE.

**Not native Godot integration:** this is an independently isolated browser VEYRA workbench inside the same Soul-of-Hero repository.


## Arena art pilot — real-game runtime (2026-11-09)

See [`pilot/README.md`](pilot/README.md). Six Arena-created TypeScript art modules replace the old custom sprites/ground painters. A source-level integration helper (`pilot/build-live-pilot.cjs`) was exercised against the previous full-world standalone runtime. Five F03 sites and two ports were rendered in actual Creator Inspection; filter stair `0 → -1 → 0` was controlled with E. The modified standalone playable HTML and same-camera screenshots were delivered to the creator in the ChatGPT conversation, **not committed as a large binary here**. The real C03 source is still missing. The standalone is a **pilot, not native 81-POI production acceptance**, and this branch's Vite source still needs proper native module wiring/build validation before merge.
