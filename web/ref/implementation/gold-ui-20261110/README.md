# SOH Gold UI/UX → authoritative Veyra gameplay | Active integration handoff

**Current implementation branch:** \`integration/veyra-gold-uiux-20261110\` (Draft PR #53)
**Base:** \`main\` at merged R12 + Veyra HEAD \`82089fea0b28ad1662f9f04496271b92c74c03a7\`.
**Reference design:** PR #52 \`uiux/waymark-a-b-fusion-20261110\`, HEAD \`e982502d594bd2117f59a712ee3e3655785d1999\` with PR #50 \`uiux/final-experience-correction-20261110\` and prior Wave4 ancestors. The UI references are **not** authoritative gameplay engines.

## Already implemented in this branch
1. \`web/src/ui/GoldJourney.tsx\` and \`gold-ui.css\`: optional world-derived Waymark, a 7-goal read-only tracker, Expedition Ledger on \`J\`, known stones, real recent receipts, no forced quests and no fabricated cash.
2. \`web/src/ui/panels.tsx\`: real \`inv\` and \`eq\` custody displayed in a Gold 42px x 24-slot 640px panel. All slot movement, use, drop, split, sort and field repair go through existing \`dispatch\` intents. Legacy two-panel compact transfer remains for containers.
3. \`web/src/ui/Game.tsx\` and \`common.tsx\`: journey integration without hijacking \`M\` map or \`T\` husbandry. Danger collapses Waymark so bosses and tells remain readable.
4. \`web/src/ui/GoldFeedback.tsx\`: achievement/sideboss/Elder cues strictly from committed \`r.receipts\` with batch priority; no retroactive popup on reload, L5 shrinks during combat.
5. \`web/src/game/core.ts\` and \`persist.ts\`: additive \`uiWaymark\` preference on the **existing** run snapshot and bounded validation, not a second saved progression system.
6. \`web/src/ui/gold-ui.test.ts\` / \`web/tools/verify-gold-ui.mjs\` and \`.github/workflows/veyra-gold-ui-integration.yml\`: source/negative tests, real 640x360 and 1280x720 Chromium input smoke with save/restart, full R12 regression/build; UI evidence saved in Actions artifacts.

## Still NOT done (do not claim full Gold acceptance)
- Full source-fidelity migration of PR #50/#52 Gold HUD, entire Craft/Work/Build/Station panels, Field Chart wheel zoom and Field Notes, refined Offline Return severity and urgent Issues, full attention hierarchy/audio/visual flourishes, and all 54 verified PixelFX assets in real Veyra UI where they are not already present. Current map/skills/craft/build have new Gold **skin**, not exhaustive interaction parity.
- PR #52's full *optional* Fieldcraft/Day Waypoints / Chronicle progression is not imported. Avoid replacing free survival with mandatory quests, new economic rewards, replayable marks or divergent saves. If adapted, bind only authoritative receipts and persisted knowledge, with anti-replay, missing-day, rollback and offline rules.
- Source screenshot comparisons, 640px body-scroll/no clip and 1280px scaling, mouse/keyboard and all gameplay panels, sideboss/Elder 48-skill telegraph compatibility, full save/restart, performative feeling of the interface.
- Final 4 sideboss + 7 Creator Core VFX ZIP is not provided yet and belongs to a separate art/combat integration after the UI is coherent.

## Mandatory completion route
1. **Build on PR #53 rather than starting another UI application.** Source decisions must be compared against PR #52/50; do not wholesale port their \`game/engine.ts\`, \`core.ts\`, \`persist.ts\`, catalog, source map, save, economy or old tests into \`web/src\`.
2. Audit every reusable UI panel with end-to-end controls; reconcile real R12/Veyra panels, map 81 POIs and creatures, 6 Elder stones, 7 Creator Cores, husbandry, stations, death, offline-return, inventory UID and physics controls. No decorative fake buttons.
3. Investigate mismatches independently. Choose the strongest UX solution, preserve pixel alignment and meaningful 640/360 legibility; solve conflicting shortcuts without removing survival action keys.
4. Verify actual play in Veyra + Classic Island. Use 640×360 @1x and 1280×720 browser captures from the **real \`web/src\` app**, not the standalone \`web/uiux/visual-overhaul\` demo. Tests must include no-scroll 24/24 pack, actual move/split/use/drop/transfer, map fog, known cores/stones, combat warnings and full save/offline/restart.
5. Run npm typecheck, test typecheck, focused UI tests, whole repo Vitest, production singlefile build and composed Chromium; attach source+logs+artifacts at exact SHA. Godot = N/A.
6. Update PR #53 with exact remaining gaps. Do not merge without independent source+visual+playability acceptance.

**Aim:** one excellent, playable Gold user experience on the real Veyra game, not a second parallel proof-of-concept. **Partial UI stages are not final acceptance.**
