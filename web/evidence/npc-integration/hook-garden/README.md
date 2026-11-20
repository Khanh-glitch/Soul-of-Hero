# Hook Village — one physical Sunroot harvest

Geographic New Game, seed 7606, no inspection landing. `tests/helpers/hook-garden-run.ts` advances the normal simulation clock and validates a JSON save while the first plant is growing. It does not set growth, give seeds, fill a flask, move a resident or assign a task.

| Simulated time | Observed on South Garden Plot `e2th` (2586, 696, floor 0) |
| --- | --- |
| +29.301 s | `hn` plants lot `hj2uh` with one Sunroot seed from `s1b7` in pack `c1b5`. |
| +30.000 s | Reload at 0.23% growth, preserving the plot and lot. |
| +30.801 s | `hn` waters with carried flask `s1b8`; three charges remain. |
| +584.915 s | `hn` harvests three Sunroot and one seed. |
| +600.099 s | The village store receives both stacks (`s3ed`, `s3ee`) with the original seed payment on both ledger entries. |
| +825.501 s | Another gardener, `hq`, sows lot `hj3lr` using seed from `s1bl` in their own pack. This is **not** reuse of `s3ee`. |

[Observed simulation receipts and ledger](natural-7606.json). The plot and two extra empty slots in the existing Hook store are New Game infrastructure, not a load-time refill. A first run with the ten-slot store demonstrated why space matters: the first crop did not complete delivery. The positive evidence above is for the twelve-slot store only.

The separate custody fixture controls position, maturity and capacity to check stale work, substituted flasks, blocked cargo and save validation. It is not evidence of autonomous behavior. To run from `web/`:

```sh
npm test -- --maxWorkers=1 tests/{npc-natural-hook-garden,npc-hook-plot-custody,logistics-garden}.test.ts
```

Verification: 20 distinct tests passed across the three suites above plus `npc-paid-work` and `npc-mechanic-fetch`. `npm run typecheck:tests` and `npm run build` passed (Vite chunk-size warning).

### Does the first garden lot reach a cook?

[Kitchen custody audit](kitchen-7606.json), current geographic New Game seed 7606. This is a fresh trace; runtime IDs are not taken from the historical garden run above. At +600.072 s `hn` delivers **3 Sunroot**, lot `s3eg`, to `c19v`. The stack retains its harvest UID and the harvest cites the planted seed `s1b7`. From +630 through +840 s, at each 30-second observation, all three units are still in that warehouse. Both Hook cooks (`hl`, `hm`) know **stew** and have a listed community campfire (`e1ad`). Each has access to 3/2 Sunroot and 4/1 herb across pack and authorized stock, but **0/1 meat**. The recipe bill is therefore not payable by either cook at those samples; no stew made from this lot is demonstrated. This does not establish permanent scarcity, nor is it a claim that route, queue, fuel and demand would all be ready if meat arrived. No item, recipe or job was added to obtain this result.

Reproduce: `npm test -- --maxWorkers=1 tests/npc-hook-kitchen.test.ts` from `web/`.

### Player-assisted follow-up: one boar, one stew

[Verified custody trace](boar-stew-7606.json). A fresh New Game on `veyra05-world`, seed 7606, delivers the same first Sunroot lot `s3eg`. A player-input driver pursues a wild, full-health Bristleback Boar, kills it and picks up its two raw meat. **Only arrival at the village is staged**: the driver shifts the active region and places the player beside the pantry. It does not demonstrate a continuous journey, autonomous hunting or NPC freight. No goods, NPC orders, loot or damage are injected.

One meat leaves the player’s stack and enters Hook’s existing 12-slot warehouse. To free the slot, the pantry consolidates two compatible herb lots and records both UIDs. Cook `hl` withdraws two of the three Sunroot, the contributed meat and one herb, pays once at campfire `e1ad`, and picks up the one finished stew in pack `c1ax`. The active queue survives a save round-trip. Evidence stops at pickup, not a warehouse delivery or a meal eaten.

From `web/`: `npm test -- --maxWorkers=1 tests/{npc-hook-boar-stew,npc-kitchen-contribution}.test.ts`. The second test uses controlled stock to exercise refusal/ownership rules; it is not hunting evidence.

### Return trip: reached the pantry, no transfer

[Return-attempt trace](pantry-return-7606.json), rerun from geographic New Game 7606 with the same controlled player arrival as above. Before the routing change, the carrier repeatedly tried the crowded shortest approach and was observed three tiles from the pantry, still carrying the stew. On a blocked approach the carrier can now plan another nearby lane; this neither moves another villager nor bypasses the normal per-step collision checks.

The fresh run uses first crop `s3eg` and the boar meat again. Its stew UID is `s3kd` (the previous trace's `s3ke` is not an input to this run). At +701.1 s `hl` is at `(2586,655,0)`, one tile from the store, with `deliveryWait` for `c19v`. All 12 slots are occupied. After a save round-trip and another 30 simulation seconds the stew is still in `c1ax`, claimed to `j3jw`; there is no warehouse lineage for that job. This is a failed unload, not delivery, loss, or consumption. No bin was emptied to pass this test. Reproduce with `npm test -- --maxWorkers=1 tests/npc-hook-boar-stew.test.ts` from `web/`.
