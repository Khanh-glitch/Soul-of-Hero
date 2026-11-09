# SOH UI/UX — Visual Overhaul Wave 4 isolated candidate

**Branch:** `uiux/visual-overhaul-wave4-20261110`  
**Branch base:** PR #47 Gameplay R12 @ `09e16cda752680c96c5f54f737c99bf950f4cbe6`  
**Creator ZIP:** `soul-of-heroes-visual-overhaul (10).zip`  
**ZIP SHA-256:** `9a1f0b3ddfe456ac67c7a5ce595dac94c7015305f51f5a6b7690f2a143a32237`

## Import safely (one-time)

The ZIP is attached to the creator's ChatGPT message and is **not yet in GitHub**. The repository does not receive chat attachment bytes automatically. This branch contains a reproducible import program instead of an empty claim that the ZIP is committed.

1. Download the *exact* ZIP from this conversation.
2. Checkout this UI/UX branch in a local Git clone.
3. Run:

```bash
git checkout uiux/visual-overhaul-wave4-20261110
python3 scripts/uiux/import_visual_overhaul.py "/path/to/soul-of-heroes-visual-overhaul (10).zip"
cd web/uiux/visual-overhaul
npm ci
npm run verify:assets
npm run typecheck
npm test
npm run build
npm run dev
```

4. Once verified, commit only the isolated subtree and push **the same branch**:

```bash
cd ../../..
git add web/uiux/visual-overhaul
git commit -m "uiux: import Creator Wave 4 source and recover 54 PNG assets"
git push origin uiux/visual-overhaul-wave4-20261110
```

## Why isolated, rather than replacing web/src?

The ZIP bundles a **full game** (engine, save/persist, sim, economy, geographic material, UI components), not just UI assets. Its original base predates active Gameplay R12. Overlaying the full contents of the ZIP on `web/src/` would silently regress authoritative gameplay.

The import is scoped to `web/uiux/visual-overhaul/`. It preserves the original code while making the presentation candidate independently runnable. It intentionally excludes the ZIP's legacy `docs/bible.md` so it cannot be confused with the only current canon at `web/ref/bible.md` and `web/ref/OPERATIONS.md`.

Relevant UI modules: `src/ui/hud.tsx`, `SurvivorScreen.tsx`, `BuildBar.tsx`, `dragSlots.tsx`, `ExperienceStage.tsx`, `EventExperiences.tsx`, `Game.tsx`, `Title.tsx`, `src/index.css`; optional render treatment in `src/game/render.ts` and `hero-art.ts`. Audit exact engine-facing props and intents before extracting them.

## Source repair

The supplied ZIP contains 54 `?url` imports for PixelFX PNGs, but no PNG bytes in source. Its `dist-qa/index.html` embeds exactly 54 PNG data URLs. The importer extracts them in manifest import order and regenerates all 54 original assets. The sampled recovered Git blob SHA-1 values match the existing repository's PNG blobs (e.g. ice lance `9c4c429bddce...`, arcane orb `815a529427ae...`). A full 54/54 source asset verification ran in the ChatGPT container. The importer produces a Git-blob SHA-1 ledger for independent review.

## CI acceptance

The dedicated CI workflow checks the imported subtree once it exists. Before import, CI must report clearly that the candidate has **not** been imported. After import, require:
- PixelFX 54/54, npm dependency installation, TypeScript typecheck, Vitest and production build
- Browser smoke test at 640x360 and 1280x720 with real user inputs; screenshot inspection, no console errors and no clipped overlays
- Survivor inventory + craft, drag/merge/quick transfer, build mode arbitration, stage/feed prioritization, opening/closing panels and Escape navigation
- Render/UX observations against the actual Gameplay R12 build, not QA staged samples alone
- Save isolation, item UID, replay, offline chronology, persistence and economy regression gates on any subsequent **integration** PR

**Status:** branch and importer committed; source ZIP not yet committed; no current cross-runtime, visual or human acceptance. No merge into gameplay or main is authorized by this setup.
