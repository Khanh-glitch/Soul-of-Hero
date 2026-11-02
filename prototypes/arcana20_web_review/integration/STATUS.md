# ARCANA20 web integration — WORK IN PROGRESS, NOT PLAYTEST READY

The isolated reference-game derivative now has **experimental combat prototypes** for 20 Core items, but the requested complete build does not yet exist. **Do not publish a play-now link**: no P0 effects have been ported; the new attacks currently have no visible skill effect or telegraph. They are invisible damage and unsuitable for playtesting. There is no in-game distribution or selection path for these prototype items. Item icons reuse the original icon with numbered notches; they are not final Core art. No quality modes, validated world compositing, P0 parity or target-device performance results exist. This is not production SOH or approved game balance.

## Provenance and boundaries

The creator ZIP `soul-of-hero-game-development.zip` came from `references/gameplay-prototypes-20261102:reference_prototypes/20261102/`, Git blob `5a667c979a597d5d26e80453f7f16756db98f150`, SHA-256 `fa95538271fd46a70f5737b58b8671124e091e8f6196479950a25dca741a2403`. This project is an isolated TypeScript/React/Canvas derivative, not production authority. P0 reference commit `b9b8cfa904d8c4126da63bdfca41b38b0f4718eb` is a separate Godot renderer. `p0-catalog.json` preserves metadata only; its duration and climax can differ from actual fusion clocks. Preserve both #05 A/B and source-faithful D19 A: no alternate has been selected here. R32 concepts are not P0 or approved replacement assets. The one 200×200 island has multiple biomes and four starts, not multiple independent maps.

## Implemented so far

- `src/game/arcana20.ts`: 20 experimental timed impact plans, inspired by names/climax metadata, using circle, line, expanding ring and multi-hit patterns. Damage values, geometry and slow are newly proposed gameplay, **not P0 combat or game canon**. The use of catalog peak times is provisional and has not been synchronized to actual source/fusion visuals. Distinct patterns are not proof that the final skills have adequate individual identity or balance.
- `src/game/catalog.ts`, `sim.ts`: 20 real nonstackable charge-bearing Core items use the original hotbar/charge commit/cancel path; on release their actual player-owned scheduled collision volumes use the existing `damageCreature` path, not manufactured hit receipts. Pending volumes are scoped to the originating run. No loot/reward route, craft, test inventory UX or item balancing has been added.
- `art.ts`: temporary icon variants, not creator-approved art. `render.ts`: new hit volumes intentionally not drawn as fake generic P0 visuals. Until the genuine renderer is integrated, **casting is visually incomplete and dangerous**.

## Verification performed (limited)

- `npm test`: 36/36 passing (13 original, 23 new tests). The 20 parameterized tests insert items into inventory, initiate a cast via simulation input, verify charge consumption and advance the normal simulation clock to hit a stationary real engine creature. Other tests check bounded plans, cancel/spent charges, eventual cleanup and cross-run isolation. These are controlled fixtures, not a balance test or visual validation.
- `npm run build`, `tsc --noEmit`, and `node integration/check-catalog.mjs` pass.
- `scripts/arcana_combat_qa.mjs` test-only fixtures inserted each of the 20 items, exercised actual mouse casts in headless Chromium and observed 3→2 charges and no page errors. One earlier browser startup timed out waiting for the run; retry passed. The browser test does not verify enemy damage, visuals, biome adaptation or frame performance.
- Original four-Core baseline QA and 13 original tests passed previously. A prior uncontrolled 180-interval software/headless rAF sample was p50 16.7 ms, p95 16.8 ms, p99 833.3 ms, max 2216.6 ms; it is neither VFX-isolated nor target GPU performance. No smoothness claim can be made.

## Required before delivery

1. Port the actual P0 source-voted A/B/C/D algorithms, fusions and compositing to the browser; preserve #05 A/B and D19 A; synchronize gameplay with validated timing and correct caster/target placement. Original browser demos may help but alone do not prove fusion or P0 parity. No opaque black-background keying, prerecorded scene overlay, or generic placeholder may be presented as the final effects.
2. Validate full motion and fixed frames against P0 on actual terrain, camera and actor/occlusion paths, including normal/dim, OUT and multiple biomes. Maintain separate gameplay authority. Revisit all invented combat hitboxes, status effects and balance against what the visual action communicates.
3. Add deliberate user-accessible equipping/distribution in this isolated review build and appropriate final item art, without damaging original HUD or existing game systems. Avoid invisible attacks and preserve finite-charge custody.
4. Implement and test High, Balance and Performance tiers. High requires measured P0 visual fidelity, while other tiers may reduce detail; all must retain identical gameplay. Profile overlaps, CPU, GPU and frame timing on actual target devices. Do not claim 60 FPS based on headless CI.
5. Full real-input test for every Core, cancel/recast, charges, damage, cleanup, each quality profile and environments; only then provide a working play-now link. The current code is **not ready to test**.
