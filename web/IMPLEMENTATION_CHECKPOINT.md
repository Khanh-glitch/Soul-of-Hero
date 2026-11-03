# Implementation checkpoint — issue #37, Map/POI milestone and prior Salt chain

## Map/POI milestone — recorded technical evidence; product review pending

Control Tower accepted only the focused Salt Shale → Salted Roast checkpoint and ordered this prototype-first follow-on; PR #38 remains draft/unmerged. The current changes add a typed `schemaVersion: 1` content-pack model in `src/game/content.ts`, a selectable development layout, and a data-authored multi-stage POI, reusing existing door, keycard, generator, fuel, container, inventory, save and rendering systems. There are no POI-ID-specific controller branches.

- `shipping` has an empty additive content pack: no terrain, POI, road, or fixed placement overlays are added to the canonical seeded island. Its existing geography and coordinates remain unchanged.
- `dev_delta` adds a ridge layout with two passable gaps and the Delta Relay: exterior keycard/fuel cache → lawful keycard gate → fuel-powered generator → power gate → finite, useful vault loot.
- Layout selection is available on the ordinary New Run screen. New runs persist `layoutId`; a legacy in-progress save without the additive field resolves to `shipping` without bumping the save format.
- Content-pack tests cover supported versions, invalid dimensions/terrain/loot/geometry, old geography/POI stability, layout selection and run association. Local result: `npm test` 20/20, `npx tsc --noEmit`, `npm run build`, `node --check e2e/map-poi.mjs`, and `git diff --check` all pass.
- [Actions run 41567023346](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41567023346), attempt 1, at `a70c9141920b13b93d651754182c05bfdb1d3c9a`, passed all three jobs: Salt journey, shipping Lighthouse and dev Delta Relay. This was merged by PR #40 into the primary Web branch at `3b37ae90601dee098066cbc4cf465552f1eb6f04`; it does not establish a separate CI run at the merge SHA.
- Independent **local precommit** production-preview runs passed lawful access, physical loot, exit/re-entry and same-profile page reload + Continue: shipping `run_abqeh`, seed `17343593`; dev_delta `run_eltb8`, seed `24532388`. Their loot-panel screenshots at both 640×360 and 1280×720 were opened and inspected: see [`evidence/map-poi-local/`](evidence/map-poi-local/README.md). These local logs say `local-uncommitted`; do not conflate their seeds or images with CI's. CI artifact downloads were unavailable, so CI screenshots have **not** been independently opened here.
- Waypoints were selected by test-side BFS and movement/interactions used ordinary inputs. This is not blind discovery, separate browser-process persistence, universal seed robustness, or human/product acceptance. The broader HOME → OFFLINE → RETURN E2E campaign is on HOLD per [Control Tower](https://github.com/Khanh-glitch/Soul-of-Hero/issues/37#issuecomment-6594382124).

Historical evidence below records the earlier Salt checkpoint. A reviewer flagged a seed mismatch between its narrative and committed run log; treat that seed as unresolved, not as Map/POI provenance.

**Historical scope:** one normal-player resource-to-workstation chain in the existing browser game. This is an evidence handoff, not a new specification. Canonical product contract remains authoritative: [`web/ref/bible.md`](ref/bible.md) (byte-identical to the Issue #37 pinned canonical contract). Review request: [Issue #37, Control Tower comment 6580050099](https://github.com/Khanh-glitch/Soul-of-Hero/issues/37#issuecomment-6580050099).

## Gate result

**Automated normal-input journey: PASS for this chain. Visual capture: PASS and inspected at both requested sizes. Human/product acceptance: still pending review.** The latest screenshots and successful journey came from GitHub Actions run [41474530720](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41474530720), at branch commit `c21c8b5bf4738e69d590bb0414a9372a9155ded3`. That commit only refreshed this checkpoint over gameplay build `ecbee9c52545de4d38a6df17fdb8339cc92ddb93`; no gameplay source changed between those SHAs. The screenshots and run log were published as evidence commit `607005626b3c465c417b953c381b782d3382c1d6`.

The browser runner used real Chromium and Playwright keyboard/mouse input for New Game, walking, searching containers, harvesting, crafting, building, fueling, queueing, collecting, save/relaunch and eating. It did **not** teleport, inject inventory, call gameplay dispatch, accelerate time, or step the station directly. The `window.__soh` QA hook is used only for read-only state assertions and route observation; all state-changing actions go through the normal UI/input path.

## Recorded journey and costs

Run seed `48028268`, landing at Fisher’s Point:

1. Searched the Fisher’s Point starter crate: meat ×2, rope ×2 (plus its ordinary bandage loot).
2. Used the survival knife to harvest Oak at `(77,168)` and `(77,170)`, carrying wood ×9. Walked to Pinewatch in 114 map tiles, searched its Ranger Cabin crate for stone ×4, then walked back in 111 tiles.
3. Hand-crafted one Stone Pickaxe at the ordinary recipe cost **wood ×3 + stone ×4 + rope ×1**. Before crafting: wood 9, stone 4, rope 2. After: wood 6, stone 0, rope 1.
4. Equipped the crafted pickaxe via Inventory UI. Mined Salt Shale at `(88,179)`; the source changed to stock 2 / HP 6 and yielded Raw Salt ×2. Mined Rock at `(82,176)` for stone ×4.
5. Paid for and placed a Campfire at `(81,176)`, exact build cost **wood ×5 + stone ×3**. Immediately after placement: wood 1, stone 1. Transferred the final wood into the fuel slot; the live station showed **burning ~19.7 seconds**.
6. Queued Salted Roast through the campfire recipe UI, exact inputs **meat ×1 + Raw Salt ×1** (inventory changed from 2/2 to 1/1). The output appeared after **10.0 seconds of live browser time**; no time shortcut was used. Collected the physical output to inventory.
7. Waited for the normal save interval, reloaded the browser, continued the run, verified the Salted Roast remained in inventory, then used it through the inventory UI. The item was consumed and hunger rose to approximately 100.

The full state/route log is [`evidence/salt-chain/run-log.txt`](evidence/salt-chain/run-log.txt).

## Real-browser visual evidence

These are screenshots of the running production build—not mockups or source-rendered icons. Each file was opened and visually inspected. PNG headers were checked for the exact dimensions.

- **1280×720:** [title](evidence/salt-chain/01-title-1280x720.png), [crafted pickaxe](evidence/salt-chain/04-stone-pickaxe-crafted-1280x720.png), [campfire queue](evidence/salt-chain/06-campfire-queued-1280x720.png), [after save/relaunch](evidence/salt-chain/08-after-relaunch-1280x720.png).
- **640×360:** [new run](evidence/salt-chain/02-new-run-640x360.png), [wood gathered](evidence/salt-chain/03-wood-harvested-640x360.png), [mined salt and stone](evidence/salt-chain/05-mined-salt-and-stone-640x360.png), [meal collected](evidence/salt-chain/07-salted-roast-collected-640x360.png), [meal eaten](evidence/salt-chain/09-salted-roast-eaten-640x360.png).

## Validation and verification

`validateGameplayCatalog` now rejects zero/negative recipe inputs and validates catalog references, station definitions, placement terrain/chance, and terrain placement collisions. The invalid `antirad` zero-cost `water_flask` input was removed; it was not consumed by gameplay. Coverage includes malformed input quantities, missing recipe/source item references, invalid station, terrain and chance, placement conflict, valid positive mutation, legacy migration effects (profile retained, incompatible old run closed with a note), and the cooking-save serialization round-trip.

Latest successful workflow run executed the raw commands below from `web/`:

```sh
npm ci
npm test                 # 18/18 tests passed
npm run build            # passed
npx tsc --noEmit         # passed
npx playwright install --with-deps chromium
node e2e/salt-chain.mjs  # complete journey passed in real Chromium
```

Local syntax check also passed: `node --check e2e/salt-chain.mjs`. The CI run used Vite production preview at `http://127.0.0.1:4173`; local launch remains:

```sh
cd web
npm ci
npm run dev -- --host 0.0.0.0 --port 5173
```

## Next step

Keep PR #38 draft and unmerged. The next authorized action is the gameplay audit, not the held HOME → OFFLINE → RETURN campaign; its handoff is in [`docs/survival/WEB_GAMEPLAY_AUDIT_3b37ae9.md`](../docs/survival/WEB_GAMEPLAY_AUDIT_3b37ae9.md). Preserve the existing Salt and Map/POI tests and evidence. Original donor ZIP remains unchanged (SHA-256 `fa95538271fd46a70f5737b58b8671124e091e8f6196479950a25dca741a2403`).
