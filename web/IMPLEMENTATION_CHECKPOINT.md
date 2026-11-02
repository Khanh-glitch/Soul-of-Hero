# Implementation checkpoint — issue #37, Salt Shale → Salted Roast

**Scope:** one normal-player resource-to-workstation chain in the existing browser game. This is an evidence handoff, not a new specification. Canonical product contract remains authoritative: [`CURRENT_PRODUCT_CONTRACT.md`](../docs/survival/CURRENT_PRODUCT_CONTRACT.md). Review request: [Issue #37, Control Tower comment 6580050099](https://github.com/Khanh-glitch/Soul-of-Hero/issues/37#issuecomment-6580050099).

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

Review the linked screenshots and route log for product acceptance. Keep the branch focused; do not expand to another map, POI system, framework, or unrelated feature before this evidence is accepted. Original donor ZIP remains unchanged (SHA-256 `fa95538271fd46a70f5737b58b8671124e091e8f6196479950a25dca741a2403`).
