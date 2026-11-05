# CT — P0 deep-chain findings and falsification gates (2026-11-05)

**Scope:** exact Gameplay PR44 `b5c8004ca4e77be62484fb3cd296fe296d7de4c9`, Map LW-01 `b12d05866366de0d50e4d305ff7b72fcf36b4921`; source/test read. **Not a CI pass, real browser execution, visual inspection, or human approval.** Supplement to [214-row matrix](../reviews/CT_20261105_SOURCE_TO_EXPERIENCE_214.md). Don't duplicate Bible; Bible remains authoritative.

## P0-01 — Salvaged Oil source probability and hidden acquisition workload

Evidence read:

- [engine.ts lines 423–443](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/src/game/engine.ts#L423-L443): `harvestHit` decrements finite units, then rolls `SALVAGED_OIL_WRECK_CHANCE` only for wrecks with `sourceLayoutVersion===3`. Older layout is intentionally preserved; the source-definition `SOURCES.wreck.bonus` alone does **not** show oil.
- [catalog.ts line 302](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/src/game/catalog.ts#L302): `SALVAGED_OIL_WRECK_CHANCE=0.35`, `SOURCES.wreck.stock=8`. One wreck has **expected 2.8 oil**, but zero remains possible. The [V17 document](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/docs/survival/gameplay-depth/V17_HANDOFF.md) explicitly identifies this as `SOH_NEW_TUNED`, not Last Island verified.
- [catalog.ts recipe](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/src/game/catalog.ts#L194): fuel canister needs **3 Salvaged Oil + 1 Glass** and 18 seconds in furnace plus 18 fuel-seconds. A first specimen study of **one additional Salvaged Oil** costs 30 seconds and gives blueprint. Thus a truly *first-time* learner needs at least **four oil drops** for one canister by this route, not three. An 8-unit wreck yields four or more at probability ≈29.36%, assuming independent 35% per unit; expect to need a second wreck in most runs, without any legal travel assertion.
- [v17-oil-chain.test.ts](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/tests/v17-oil-chain.test.ts) loops through physical wrecks but teleports player directly to coordinates, zeroes creatures, creates a research station and furnace in test state, grants Glass, uses `harvestHit(...,{scrap:30})` rather than a naturally acquired tool. This **proves only scoped transaction/time rules**, not a player's 336-hour chain.

**Decision:** S10 salvage sub-chain = **CODE PRESENT / TEST-FIXTURE PRESENT / NATURAL SOURCE+STATION ACCESS NOT_TESTED**, petroleum extraction/refinery/vehicle/full trade-off **NOT_IMPLEMENTED or unproven**. Next natural gate: fresh Veyra & Shipping, no player relocation/grants/station fixture/clock shift; accumulate four genuine oil drops and glass, acquire research table and furnace lawfully, study, craft, fuel, open POI door, then verify save/reload and total time/route/risk.

## P0-02 — Seven Core bodies are not seven legitimate Veyra acquisition paths

- [creator-loot.ts](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/src/game/creator-loot.ts) contains **five** guaranteed Shipping/Dev physical crate selectors: Dragon, Meteor, Demon, Mjolnir, Elsa. Blast and Earthmother are **base recipes**, not guaranteed site rewards.
- [creator-contract.ts](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/src/game/creator-contract.ts) defines 7 Creator Cores and energy capacities **40 Basic / 12 Refined / 4 Signature**, but explicitly writes `wmpAccess:'owner-contract-missing'` for **every** Core.
- [v17-core-contract.test.ts](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/tests/v17-core-contract.test.ts) asserts current `wmp04r1-cinder-shore` has **zero matching Creator Core physical site selectors** and all seven WMP acquisition contracts are missing. This is a **verified source-coverage failure for that tested WMP scene**, not necessarily proof no Core can be crafted from any other WMP raw resource. Do not silently turn five Shipping source coordinates into WMP POIs.
- [V16 Core 7×17 matrix](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/docs/survival/gameplay-depth/V16_CORE_CAPABILITY_MATRIX.md) and 21 action flags remain separate from [AVFX 20-effect batch](https://github.com/Khanh-glitch/Soul-of-Hero/blob/6be8418273acb8c61a12aabac309637fbef04aa6/docs/vfx/ARCANA20_BATCH_STATUS.md). **Source / recipe / action mechanics / actual 1× Gold visuals / player choices** require individual evidence.

**Decision:** C03/C04/C05 natural acquisition and 7×17 **NOT ACCEPTED** on current WMP. Next owner boundary: Map author/source IDs and traversable site access, Gameplay-authored loot and rarity, AVFX action-frame licensed pixel chronology, A0 custody/persistence, A7 negative and real-input tests. Require for **each** Core at least one legal no-injection acquisition route, meaningful Q/E fuel source, cast/target/world reaction, interrupt, saved UID, and all timing gates at 640×360 and 1280×720.

## P0-03 — Physical Ragnarok Cash path is a conditional logistics test, not the first run

- [engine.ts lines 874–912](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/src/game/engine.ts#L874-L912) checks final72 for `openCash`, requires carried physical unsecured Cash to buy `escrow_chest`, then checks an **owned claim** before converting carried Cash to profile secured Cash. The item chest and claim remain run-local.
- [escrow-route-physical.test.ts](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/tests/escrow-route-physical.test.ts) sets `r.qaOffset=264*HOUR` (day 11 boundary), removes monsters and gives wood 10 + stone 5. It **does** walk via collision-resolved `tick` across a Shipping route and verifies 36 → chest price 30 → deposit 6; that is a valuable scoped logistics/transaction proof, but neither natural spawn nor no-boss 11-day survival, physical material collection, gamefeel, season economics, or re-entry to a second run.
- The real gate is **non-boss cash-positive first run with zero injected materials, no accelerated 264-hour fixture and no script walking paths based on hidden entity IDs**; measure reachability, hazards, stocking, costs, deaths and recovery.

**Decision:** C15–C18/C23 are **SOURCE_IMPLEMENTED / ASSISTED ROUTE / NATURAL FIRST-RUN, SECURITY AND LONG-RUN NOT_TESTED**. Prohibit any approval assertion that refers to 36→30→6 alone.

## P0-04 — Ordinary loot re-instance contradicts historical W00 MISSING entries

- [loot-respawn.test.ts](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/tests/loot-respawn.test.ts) tests **partial withdrawal retains the same source**, full withdrawal starts a typed cooldown, online/offline re-instantiation gives **new entity IDs, new container IDs, new UIDs**, unique blueprint/Cash excluded, and save migration is conservative. The fixture moves player to crate coordinates, so this is not exploratory gameplay proof.
- [engine.ts renewableLoot / stepLootRespawn](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/src/game/engine.ts#L351-L406) is code authority for ordinary-site lifecycle.
- Thus the W00 status **`SYS11-04 MISSING` and `SYS11-11 MISSING` is stale** as a blanket claim that ordinary respawn mechanics do not exist; mark **SCOPED NEW EVIDENCE** only, because full tier taxonomy, node density, player perceptibility, 336-hour economy and unique-supply security still lack evidence.

**Decision:** preserve W00 historical statuses, annotate refreshed delta; no destructive overwrite of baseline research.

## P0-05 — Electrical capacity status is not the same as industrial power network

- [engine.ts stepBasePower / upgradeGenerator](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/src/game/engine.ts#L252-L262) and [k6-power.test.ts](https://github.com/Khanh-glitch/Soul-of-Hero/blob/b5c8004ca4e77be62484fb3cd296fe296d7de4c9/web/tests/k6-power.test.ts) provide explicit one→two connected turrets and double fuel use under controlled setup.
- Old W00 marked `SYS06-04 capacity/load MISSING`, while V17 added **two-turret capacity**. This is a **partial subclass**, not general `grid + relays + industrial consumers + blackout progression`.
- The first total game loop that genuinely combines **oil→generator→industrial machine→recipe→item** is still unproved; claiming 2 turret outputs as full S06 would be a false positive.

**Decision:** S06 technical subclass **PARTIAL**, broad industrial network **OPEN**. Independent tests need load shedding, fuel depletion, production interruptions, resumed jobs, relay topology and offline idempotency.

## Ownership and release stop

All five findings require exact common composition and honest source/fixture distinction. **PR44 DRAFT/HOLD; no merge; no owner prompt sent; no new player-facing acceptance granted.** GitHub does not expose whether Arena agents are RUNNING, so no double-dispatch. Art, UX/gamefeel, 336h and unaware humans remain `NOT_OBSERVED`, not `PASS`. Next Control Tower step: test natural real-input paths and reconcile original 5,280-line Master and v7–v11 packages if recovered; otherwise retain `SOURCE_RECONSTRUCTION_PARTIAL`.
