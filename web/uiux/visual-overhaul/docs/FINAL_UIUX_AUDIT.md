# SOH UI/UX — Final audit and corrective pass
**Date:** 2026-11-10  
**Source:** Creator-provided `soul-of-heroes-ui-overhaul.zip`  
**Verdict:** Source corrected, reproducible asset gate PASS; actual final browser visual acceptance **OPEN**.

## Audit of submission

1. **Source custody broken:** original ZIP contains 0 PNG while `pilot.ts` and `owner-vfx.ts` import 54 PNG files. The historical handoff describes a release ZIP and built HTML that are not in this upload. Original package.json had no verification command. Restored all 54 byte-identical assets from the previous Wave4 source package and validated the original `PIXELFX_RECOVERY_SHA1.txt` Git hashes.
2. **Offline Return over-escalated:** `classifyOfflineReturn` treated 15 minutes away or one minor receipt as a full-screen notable report; `quiet` was only set for under 4 seconds, regardless of actual production/loss. Also, the `vitals` snapshot was classified as both a delta and current state, and already-unfunded cabinets were counted as noteworthy changes. Fixed these distinctions in `src/game/return-report.ts` and `src/ui/ReturnChronicle.tsx`. Real loss/death/danger remains high priority. No rewards or offline milestones invented.
3. **Map interactions:** scroll-zoom snapped the cursor's world position to the viewport centre; now zooms around the actual cursor position. Sites, Notes, Intel filters no longer show an inexplicably blank directory. Discovery checks, Core target safety, notes persistence and death-bag checks remain in place.
4. **Field Notes:** live situational text had only dismiss/mute/review actions; for death bag, Spirit Blink, beginning crafting, worn tools and hunger/thirst the player can now jump to real Map/Pack panels through the same Game controller.
5. **HUD conflict:** world-cut announcement could still cover combat despite `combatFocus`; switched to a compact non-modal high-contrast alert during combat. The event remains sourced from the same receipt/phase and still auto-expires.
6. **Visual density:** native 640×360 source has many 7–9 px labels and tightly packed map/return controls. Scoped CSS improves legibility, focus/drag/active states, map directory hierarchy, warning prominence and reduced-motion support without replacing source sprites/tiles.

## Changed files
- `src/game/return-report.ts`
- `src/ui/ReturnChronicle.tsx`, `ExpeditionMap.tsx`, `FieldNotes.tsx`, `ExperienceStage.tsx`, `Game.tsx`
- `src/index.css`
- `tests/ui-5pillars.test.ts`
- `tools/verify-assets.mjs`, `tools/verify-final.mjs`
- `package.json`, `package-lock.json`, `README.md`
- 54 PNG binaries restored under `src/game/pixelfx/**` (hash-identical originals)

## Actual verification
- `node tools/verify-assets.mjs`: PASS 54/54 original Git blob SHA1 + 54 source imports.
- `node tools/verify-final.mjs`: PASS 169 TS/TSX AST parse checks and 8 return-severity behavioral cases against the compiled `classifyOfflineReturn` function; map, chronicle patch presence.
- **Not run:** full npm dependency install, `tsc --noEmit`, complete Vitest, Vite build, 640×360/1280×720 new-source screenshot matrix, natural gameplay and save/restart. The sandbox npm registry DNS/network is unavailable. These gates are OPEN, not presumed PASS.

## Remaining product-quality items
- Verify source in CI with Node 22: `npm ci && npm run verify:assets && npm run verify:final && npm run typecheck && npm test && npm run build`.
- Open the **new** built `dist/index.html` in Chromium; test Map, Notes, Inventory and Return in genuine interaction at 640×360 and 1280×720, in both empty/rich states. Inspect the images before calling an art improvement successful.
- Test return receipt replay, save history across process restart, item UID custody, Core targeting, all map fog negative controls.
- Compare visually with the current Gameplay R12 UI before extracting any changes; no self-merge into main.

**Correct claim:** corrected playable *source candidate*, not yet a certified final standalone build. Keep Creator acceptance open.
