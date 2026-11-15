# G1B — implementation report (runtime, not a lab)

Contract: `approved/APPROVAL_README.md`, `approved/G1B_CREATOR_APPROVED_DESIGN_20261115.md`, `approved/g1b-approved-runtime-contract-v1.json`.

## What a player can do in a New Game on Veyra
- Find 130 approved chests (85 at POIs, 26 on routes, 19 in card rooms: Green 6 / Blue 6 / Purple 7), 16 variants in 5 art families.
- Press F: the chest rolls once (anchor + weighted draws + equipment bonus + at most one Creator Core outcome), opens the normal container panel, stock is real and survives save/restart/window streaming.
- Emptied chest stays in the world as EMPTY, shows its restock timer (12–72 h, per contract) and refills exactly once per cycle, also while far away.
- Three access-card cases (Green at Kestrel, Blue at Freightyard, Purple at Slag): finite, never restocked. A card has 3 uses.
- Five sealed doors: Falls deep room (generator power), Academy green room (Green Card), Archive purple room and deep room (Purple Card + power + Filter Mask), Meridian blue room (Blue Card + power). A generator burns exactly one Fuel Canister for 180 s.
- Creator Core V2: no magazine. LMB spends Basic Energy from the pack, Q (Lv2) Refined Energy, E (Lv3) Refined Energy + Essence. Durability 300, repair +75, upgrade at a Workbench with the 14 approved bills. A Core from a pre-V2 save loads as Lv3 300/300 with the same UID; the energy already stored in it is spent first and can never be refilled.

## Evidence
- Tests: `tests/g1b-roll.test.ts` (9), `tests/g1b-geometry.test.ts` (4), `tests/g1b-lifecycle.test.ts` (11), `tests/g1b-core-v2.test.ts` (11); opt-in `G1B_RESOLVE=1 tests/g1b-resolve.test.ts` re-measures the world and reproduces `src/game/g1b-sources.generated.ts` byte-for-byte.
- Full suite vs the pre-G1B baseline, compared per test identity: 1277 tests, 1044 pass / 177 fail / 56 skipped; baseline 1241: 1009 / 177 / 55. One test failed that passed in the baseline: `arena1-round2-mechanics` "equips into slots 3 and 4…" timed out at 5 s under full-suite load (4.3 s in the baseline, passes when the file runs alone). One baseline failure now passes (`arena1-round2-newgame-routes` ROUTE OIL).
- Unedited 640×360 runtime screenshots: `screens/` with `chests-log.json` and `gates-core-log.json` (entity state, roll seed, receipts and toasts for every frame). Scripts in `capture/`. The player was placed beside each object by sliding the streamed window (the game's own continuity path); F, mouse and the panel buttons are real input. Items marked `qaGrant` in the logs were granted for the capture (1 Fuel Canister; Big Bang + energy + essence).

## Not done / blockers
1. **157-icon item atlas is not in the repository** (`web/public/assets` holds only `g1b/chests`). Item icons in the chest panel are the game's existing drawn icons. Nothing was substituted or claimed as the approved art. Next step: commit the atlas PNG + manifest under `web/public/assets/items/`, then map `ITEMS[key]` → atlas cell.
2. **Visual acceptance is the user's.** Chest scale, family colours and sheen follow §H but no claim of "visually accepted" is made.
3. **Not captured in screenshots:** Core upgrade/repair panel (needs a Workbench in reach; covered by tests only), Blue room, a refill observed in real time, a Core rolled out of a chest (covered by tests).
4. **Decisions taken that need creator confirmation**
   - Core durability 300 / repair 75 (handoff) rather than 100 / 25 (older §F body text).
   - §F cooldown/wear table is marked "proposed" in the design; implemented as written.
   - Core source policy is `BOTH` in code; `ITEM_CRAFTING_MASTER.{json,md}` was regenerated accordingly (7 Core rows CRAFT_ONLY → BOTH). The contract labels this `PROPOSED_BOTH_NEEDS_MASTER_REVISION`.
   - Shipping-layout unique Cores are now found at Lv1 with no pre-loaded Signature charges (`initialSignature` 3 → 0), because V2 has no magazine.
   - Chest tiles and their 4 neighbours are kept clear of procedural furniture: 95 fewer decorative props world-wide (`veyra-r2-closure/MAP_PROP_COMPLETENESS_TALLY.json` 14380 → 14285).
   - Geometry variances (9) are listed in `G1B_VARIANCES`: Veyra doors carry no native card/power contracts, so gates are enforced in the door intent; three gated rooms contain an internal stair; some chests sit where roads cross a POI footprint.
5. **Engine changes outside G1B proper:** G1B objects outside the window live in `run.g1b.far`, not in `veyraOffscreenEntities`, so structure scans during offline settlement keep their previous cost. Twelve older Core test files were moved from the magazine to the pack model (`tests/helpers/core-v2.ts`); their skill-effect assertions are unchanged.
