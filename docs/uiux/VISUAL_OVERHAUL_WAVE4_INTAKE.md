# SOH UI/UX — Visual Overhaul Wave 4 isolated candidate

**Branch:** `uiux/visual-overhaul-wave4-20261110`  
**Branch base:** PR #47 Gameplay R12 @ `09e16cda752680c96c5f54f737c99bf950f4cbe6`  
**Creator ZIP:** `soul-of-heroes-visual-overhaul (10).zip`  
**ZIP SHA-256:** `9a1f0b3ddfe456ac67c7a5ce595dac94c7015305f51f5a6b7690f2a143a32237`

## Reproducible import from Creator ZIP (optional historical fallback; do not rerun on current branch)

The complete ZIP-derived source is **now committed to GitHub** on this branch: 247 files (193 text/source and 54 PixelFX PNGs) in commit `6a8b9bfcbd103b198e93c64e5f2d0243bb2ce547`. All 247 Git blob SHA values were checked against the source transport manifest before moving the branch ref. The importer remains a reproducibility/forensic fallback and must not be rerun over an existing subtree.

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

## Exact GitHub source intake and browser evidence — 10 November 2026

### Verified source custody
- Original source commit: `6a8b9bfcbd103b198e93c64e5f2d0243bb2ce547` (247/247 Git tree entries matched; 193 source/text and 54 original PNG blobs).
- CI source checkpoint: `650653181e294f1a3588da4f20219dcc2686a3c7`. No modification to gameplay R12, save, economy or UID authority.

### GitHub Actions on exact source SHA
- CI run: https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/42742397177
- Native Chromium artifact: https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/42742397177/artifacts/13729788227
- npm ci **PASS**; PixelFX 54/54 **PASS**; TypeScript **PASS**; Vite singlefile production build **PASS**; output check **PASS**; Chromium Ubuntu24.04 dependencies **PASS**.
- **BROWSER QA PASS:** Chromium 18/18 native PNGs, nine at 640×360 and nine at 1280×720. Independently downloaded artifact and verified all filename slots, dimensions, zero browser/page console errors, real item drag Hunting Bow → hotbar 7 and hover + 8 Salvager Pick → hotbar 8 at both resolutions. Captures include normal play, Survivor, dragging, inspecting, stations, craft-attempt state, build mode, build tool upgrade and build exit.
- **CRAFT NOT COMPLETED:** the selected sandbox has no eligible recipe in Work now, so `.sv-go` does not exist. Logged accurately, no fake craft, feed=0; separate natural craft test remains required.
- **FULL GAME REGRESSION FAIL:** 616/631 Vitest PASS, 15 FAIL across 11 files out of 85. Missing Stage1 geography payloads, B05/recycler version fixture changes and gameplay behavior differences are still open; overall CI intentionally remains FAIL. Do not weaken these tests or label total CI green.

### Independent visual evaluation (actual Chromium images)
- **1280×720:** HUD roles (survival top-left, time/weather top-right, hotbar bottom, home right) remain separated, no large outer-frame clipping in representative frames. Survivor split between inventory and craft is coherent; build mode displays a material/action affordance with explicit rejection reason.
- **640×360:** no major outer-frame clipping in tested screenshots, but inventory/craft text, item icons and action targets are very small and crowded. This is a visual/accessibility quality problem, not a passing final small-screen UX.
- Low-saturation pixel-art palette and gold interaction emphasis are internally coherent. The test is an isolated furnished QA sandbox, not native Godot, production R12 gameplay, full map nor Creator review.
- **Decision:** Source custody PASS; isolated real-browser interaction/screenshot matrix PASS; visual quality PARTIAL (640 readability and user review outstanding); full legacy game regression FAIL; production integration NOT TESTED. Keep PR #49 Draft, do not merge.

