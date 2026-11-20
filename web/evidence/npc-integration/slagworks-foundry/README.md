# Slagworks: warehouse component → worker-owned recycler job → warehouse ingot

## Controlled queue interruption and reload

The regression uses the shipping site, its generated salvager and the community warehouse. It supplies a two-pipe warehouse stack and puts the worker at the store for the first fetch. It uses the navigation graph and validates each step to the Foundry and back, stepping the machine directly rather than waiting for the autonomous scheduler. A JSON save is validated mid-job after clearing the actor's task; the worker must rediscover the reservation, not start a replacement. The deposited ingot's ledger entry identifies the station and paid pipe UID. Negative cases cover wrong-floor contact, a substituted input UID, reserved cargo, intact tools and player actions on claimed goods.

From `web/`: `npm test -- --maxWorkers=1 tests/{npc-foundry-salvage,npc-paid-work,b05-recycler-reload,sys03-recycler}.test.ts` (20/20 passed). The separately included `wp3-veyra-recycler-integration.test.ts` failed at line 303: it expects at least three natural Damaged Drives, while `wreckBonuses` intentionally removes that retired item. No loot rule or assertion was weakened for this change.

## Natural New Game: observed, not fixture-supplied

`tests/npc-natural-foundry.test.ts` starts the normal `veyra05-world` geographic spawn at seed 7606 with the full population (286). No creator landing, worker relocation, starter component, warehouse enlargement, forced action, station step or chosen harvest roll. Only the simulation clock advances. This is a reproducible trajectory, not a guaranteed drop on every seed.

| Stage | Observed in this run |
|---|---|
| Field extraction | Worker `h3e`, road salvage bale at (2357,1843), stock 3 → 2. Final cut: knife `s1wo` durability 297 → 296. |
| Store and fetch | One `metal_pipe` (`s36q`) deposited in warehouse `c1w0`, fetched back into pack `c1wm` with the same UID. |
| Paid job | Foundry `eh` accepted `s36q` for `j38v`, version `X:pipe-v3`. One payment, one finish after 10 seconds. |
| Delivery | Worker collected one `refined_iron_ingot` (`s398`) and delivered it to the original store. Final ledger points back to `j38v`, `eh` and `s36q`. |

[Captured simulation receipts and warehouse rows](natural-7606.json). The controlled capacity regression fills the pack so only the base yield would fit: two attempts neither damage nor drain the bale or knife, then admitting the complete lot releases one stock unit. Reload is tested by the separate controlled queue regression above, not inferred from this natural run.

Reproduce from `web/` (6 files, 23 tests passed):

```sh
npm test -- --maxWorkers=1 tests/{npc-natural-foundry,npc-salvage-capacity,npc-foundry-salvage,npc-harvest-transactions,npc-paid-work,global-source-ledger}.test.ts
```
