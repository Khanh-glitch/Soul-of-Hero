# Ironholm mechanic — a funded workbench repair from New Game

`npc-natural-mechanic.test.ts` starts a normal geographic Veyra run (seed 7606). It lets the full simulation choose the task and route, serializes the game while the mechanic is working at the bench, validates that save, and advances the loaded run. No inspection landing, forced assignment, supplies, station or damage were added.

The generated mechanic `hf` retained their original stone pickaxe `s19g`. Its starting condition was 150/180. At the community warehouse `c18q` the mechanic fetched one stone and one wood, with each draw traceable from the warehouse stack to the smaller stack in pack `c19h`. Work order `hw2tx` resumed at the authored Ironholm workbench `e198`. It consumed those two carried UIDs, and restored the same equipped pickaxe to 180/180. See the [observed transfer and repair receipts](natural-7606.json).

A separate controlled test checks goods withheld by another claim, a pack with room for just the first material, an already repaired tool, a workbench which changed owner and an unconfirmed route. No partial withdrawal or payment on failure. A pending route is not travel: the mechanic only starts moving once the search returns a path.

From `web/`:

```sh
npm test -- --maxWorkers=1 tests/{npc-natural-mechanic,npc-mechanic-fetch,npc-paid-work,npc-foundry-salvage}.test.ts
```

This covers personal equipment and regional warehouse materials. It does not demonstrate borrowing another resident's tool, nor a recycled ingot moving between settlements.

Verification: all 13 tests in the four files above passed; the separate `npc-natural-foundry` New Game regression also passed. `npm run typecheck:tests` and `npm run build` exited 0 (Vite reported its chunk-size warning).
