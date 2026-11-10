# Soul of Heroes — UI/UX Final Quality Pass (10 Nov 2026)

This is the **existing** survival-game React/Vite application from the Creator's `soul-of-heroes-ui-overhaul.zip`, amended directly. It is **not** a separate UI mockup or a replacement for the authoritative Gameplay R12 runtime. The source is complete, including the 54 PixelFX PNGs that were missing in the Creator ZIP.

## Run

Requirements: Node.js 22+, npm, browser with Canvas 2D/WebGL2.

```bash
npm ci
npm run verify:assets
npm run verify:final
npm run typecheck
npm test
npm run build
npm run dev
```

The Vite build creates `dist/index.html` as a single-file HTML release. `prebuild` prevents a build when the 54 binary PNGs are missing or damaged. The source verification is intentionally separate from the actual browser, full Vitest and gameplay acceptance gates.

## What is different in this final pass

- **Actual Offline Return classification** uses *confirmed* receipts and before/after changes rather than elapsed time. One routine event after 17 minutes is a digest, not a forced full-screen modal. Serious player danger, material loss, destroyed structures and run expiry remain high priority.
- **Offline read-model provenance** separates receipt-backed events, measured changes, and current live readings. Current vitals no longer masquerade as a new offline event or appear on both sides of the report. A compact digest surfaces confirmed events and current danger with different labels.
- **Field Chart** has cursor-anchored wheel zoom rather than jumping the hovered tile to the middle of the view. Empty Sites/Notes/Intel filters show their own meaningful explanations while discovered-only authorization remains unchanged.
- **Field Notes** now offer the natural next action (Map or Pack) for applicable contextual hints, in addition to dismiss/mute/review. Existing run-scoped guidance logic remains intact.
- **Inventory and HUD** retain the existing live move/swap, keyboard and protected quickbar contracts, while styles improve state distinction and pixel legibility. Major world announcements fall back to a slim alert during combat instead of a wide visual cut.
- **Assets**: restores 54 original PNGs and verifies their Git blob SHA-1 against the existing provenance ledger. No arbitrary recreated VFX.

## Honest verification

- 54/54 asset hash/manifest checks **PASS**.
- 169 TS/TSX modules (including tests) parse without syntax errors; 8 isolated Offline Return classification cases **PASS** using the actual compiled source function.
- Full `npm ci`/Vite/Chromium for this exact modified source **NOT VERIFIED** in the execution container: it cannot access the npm registry, and node_modules is not available. Do not call this product-accepted or visually certified until the actual build and browser review run.
- This candidate remains distinct from composed Gameplay R12, native Godot, long-horizon offline QA and Creator visual acceptance. Historical gameplay test failures were not silenced.

See `docs/FINAL_UIUX_AUDIT.md` for details and source ownership.
