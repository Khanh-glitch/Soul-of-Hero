# A0 SaveService unique-token guard contract — SURV-030A E-01

Status: **A3 CONTRACT REQUEST / NATIVE NEGATIVES DEMONSTRATE A0 BLOCKER**. A3 did not edit SaveService. PR #19 must not be treated as production-safe unique-item integration until A0 implements and independently tests this contract.

## Token invariant

A3 unique equipment/Core instances are represented by two coupled records in the same SaveService document:

1. Physical token: exactly one `inventory.item_stacks` entry whose base item id is `soh_i_<counter12>_<hash8>`, `kind == "key_item"`, `quantity == 1`, and canonical stack key equal to the instance id.
2. Attribute record: exactly one `survival_economy.instances[instance_id]` with matching `instance_id`, a catalog item whose `storage == "instance"`, and `location == "bag"` while the physical token is in the bag.

While escrowed or terminal, the attribute record may exist with location `research:*`, `reconstruction:*`, `job_output`, `consumed_by_research`, `reconstructed`, or `dismantled`, but **zero physical tokens may exist in bag or home storage**. A3 fails closed on any violation; it does not silently grant, delete, normalize, or repair ownership.

## Required A0 generic-API behavior

A0 must guard every generic path that can move, remove, merge, split, equip, store, drop, loot, or reward an item stack, including at least:

- `add_items_to_candidate` / `grant_inventory_item`: refuse to add a `soh_i_*` id unless it is an A3-authorized creation/return path with exactly one matching attribute record and no existing token. Never merge a unique token into `quantity > 1` or an overflow stack.
- `remove_items_from_candidate` / `consume_inventory_item`: refuse generic consumption of `soh_i_*` unless called inside an A3 transaction that atomically updates the attribute record/escrow. Quantity must be exactly 1.
- `drop_inventory_item`: refuse direct drop of `soh_i_*` unless A0 first performs an atomic ownership transfer to a GroundLoot record that preserves the instance id and attributes, or explicitly converts it through an A3-approved terminal operation. No orphan attribute record and no duplicate GroundLoot token.
- `home_transfer_to_storage` / `home_transfer_to_bag` / `_home_transfer_item`: either refuse `soh_i_*` until A3 supports a storage location, or atomically update `survival_economy.instances[id].location` and preserve exactly one token. Current A3 only supports `bag` plus escrow/terminal states, so the safe default is refusal.
- Any container/chest/pending-reward/equipment/loot path: same one-token XOR escrow/terminal rule. A3 currently audits bag and home storage; A0 must extend the guard to every other physical container it owns.
- Save load/migration: preserve `survival_economy` additively. If a token/record pair is malformed, fail closed or quarantine with an explicit recovery UI; do not silently delete one side and leave the other spendable.

## Returned ownership / recovery

- Cancel/research/reconstruction escrow must remain recoverable after station removal, power loss, reload, or full inventory. A3 `cancel` + `collect` can refund ingredients/specimens even when the station resolver is empty; fuel already reserved is burned by design.
- A0 must not delete a station with unresolved A3 jobs unless it first exposes a recovery path (cancel/collect or relocation) that preserves escrow. Station revision changes must be stable and reported to the A3 time host.
- Generic drop/transfer/merge must be transactionally coupled to the attribute record. A UI preview or GroundLoot spawn is not ownership transfer until the SaveService commit succeeds.

## Native evidence in A3 tests

`tests/survival/catalog/economy_adapter_test.gd` deliberately uses the real SaveService to demonstrate the current blocker:

- quantity=2 and wrong-kind token corruption;
- orphan attribute record after generic `drop_inventory_item`;
- orphan physical token without attribute record;
- generic home transfer out/back;
- generic candidate merge into quantity=2;
- duplicate physical token while a specimen is escrowed;
- persistence of corruption after reload;
- A3 cast/repair/dismantle/wear/owned-instance reporting/inventory totals fail closed while corrupted.

These tests prove A3 refusal, **not** that SaveService is globally safe. A0 must add positive guard tests proving generic APIs refuse or atomically transfer unique tokens.

## Acceptance for A0 integration

- [ ] Generic drop/transfer/merge/equip/container/reward paths cannot create orphan token, orphan record, quantity != 1, wrong kind, or duplicate physical token.
- [ ] A3 ownership audit passes before and after every generic operation.
- [ ] Reload/replay preserves one physical Core and its attributes.
- [ ] Station removal/power/revision lifecycle exposes escrow recovery.
- [ ] Legacy saves without `survival_economy` remain valid; valid v1 namespace migrates to v2; malformed namespace fails closed.
- [ ] Independent reviewer runs native tests against A0+A3 merged branch.
