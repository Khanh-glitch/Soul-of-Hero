# SYS03 — Real Recycler and condition-based recovery

Implementation on the existing web Gameplay branch. **HOLD, not natural-play, Economy-owner, Map, A3 or native acceptance.** This is a curated SOH policy, not an exhaustive Last Island item table.

## Sources and provenance

The canonical `web/ref/bible.md` K1/K2/K4/K6/K7/K8 establishes physical instances/custody, production, world access and one run clock. Atlas reference archive is [revision `5f4e6c4`](https://github.com/Khanh-glitch/Soul-of-Hero/blob/5f4e6c443f723318ed32376acc558d031d333e76/docs/reference/last-island-atlas/README.md): v3 `BAO_CAO_DINH_LUONG_v3.md` CF04/P0 Q01; v4 `BAO_CAO_CO_CHE_CHUYEN_SAU_v4.md` II; v5 `LI_MASTER_RESEARCH_REPORT_v5.md` S03/D01; v6 `SOH_LI_DEEP_AUDIT_REPORT_v6.md` G-S03; v10 source/custody and economy contracts; and v11 ledger SYS03-C01–C10, XEDGE-005/010–012/016/103. Historical sources include the [2019 Recycler overview](https://shouyou.3dmgame.com/gl/135248.html), [2020 route/item guide](https://news.4399.com/zhytgz/xinde/m/895633.html), and a [2022 base-mode account](https://www.taptap.cn/moment/319544097008257214). Their different dates/modes do **not** establish exact per-item or durability yields in this game; v3 explicitly warns against universal 50% claims. The v11 obligations are NOT_RUN acceptance requirements, not evidence of completion.

**ORIGINAL_UNKNOWN:** output ratios, precise original condition effects, times and UI capacity. New numbers in `web/src/game/balance.v1.json` `recyclerV1` are **SOH_PROVISIONAL**, not historical facts. `X:recover-v1` is a pinned recipe version: future retuning must add a new version rather than changing queued v1 behavior. Existing `X:drive` remains 12 seconds, one finite drive → two Spares, unchanged for old/new jobs.

## Implemented choices

At the already authorized Foundry machine, E/F opens the panel. Choose a carried instance by name/UID/slot; see condition, exact outputs, time, available output capacity and irreversible confirmation. Protected/unlisted items—including Cores, cash, access cards, Elder stones, and generic rare rewards—are rejected; no automatic class-wide eligibility. Keep/use and existing paid Workbench repair remain alternatives; a valid Iron Sword may instead be reserved and destroyed for research, or dismantled at a Workbench under its existing rule. The machine checks real proximity and unobstructed interaction; no portable menu, new map geometry or Veyra machine is introduced.

All new equipment inputs require one exact UID with numeric durability within its item maximum. All take 15 seconds. Threshold comparisons use the saved current durability: **below 25%** = base; **25% to below 75%** = base + mid; **75% or above** = base + mid + high. Missing or invalid condition is rejected, not silently restored. Percentages and quantities below are provisional.

| Input, real source / composition | Base | Mid addition | High addition |
| --- | --- | --- | --- |
| Iron Pickaxe / Iron Axe: craft at Workbench (3 iron ingots, 2 wood, 1 leather); finite vendor offer also exists | 1 Scrap Metal | 1 Iron Ingot | 1 Wood |
| Iron Sword: learned Workbench recipe (5 iron, 1 leather); specimen/research choice | 1 Scrap Metal | 1 Iron Ingot | 1 Leather |
| Salvager Pick / Axe: level-2 Workbench upgrade of corresponding iron tool + 2 Mechanical Parts + 2 Spares | 1 Scrap Metal | 1 Iron Ingot | 1 Mechanical Parts |
| Reinforced Spear: level-2 Workbench (2 iron, 1 Mechanical Parts, 2 wood) | 1 Scrap Metal | 1 Iron Ingot | 1 Mechanical Parts |
| Damaged Drive: finite car-wreck salvage | **2 Spares, fixed legacy job** | — | — |

Outputs already have meaningful consumers: iron for repairs, vehicle parts, generator and cable; scrap/iron for Mechanical Parts and fasteners; Mechanical Parts for vehicle and tool repair/upgrades; wood for constructions/fuel; leather for equipment; Spares for existing research/trade. No new virtual balance, material, factory, quest or global generator is added. A physical test crafts an iron pick, recycles it and spends the returned iron on an existing iron-axe repair. It uses a controlled workbench location/material fixture, not a natural survival journey.

## Transactions, time, save

`recycler.ts` provides the explicit versioned whitelist/preview and a complete output-capacity simulation. `engine.ts` reserves the exact carried item without splitting it, checks all output slots jointly, starts one existing station job and records `recycle.start`. A user action/research/repair cannot also use the reserved UID. Cancellation returns the same instance and durability to inventory or existing physical drop fallback. The existing `stepStations` and `advanceWorld` process the bounded job at its chronological completion; full output means a zero-left job remains reserved and blocked, **no** outputs are written, and capacity is checked again before committing the entire set. A new `recycle.finish` receipt identifies input UID and output quantities; the existing `job.done` still records completion. Repeated settlement/replay does not reissue outputs.

`persist.ts` validates the version, duration, singleton reserved UID, eligible item and condition using the same rule; old drive saves keep their preexisting validator/contract. Output slots and UID uniqueness remain under the existing shared custody validator. Offline settlement uses existing event boundaries, not speculative frame replay, and cannot start a job before its real input transaction. S05 access, S06 wiring and W07 vehicles are not reimplemented.

## Anti-arbitrage audit

New equipment rules produce **no Spares**. Every direct iron-tool craft→recycle cycle loses at least two of its three iron ingots; sword loses at least four of five; spear loses at least one of two plus wood. Industrial upgrades also lose the prior iron tool's net iron, at least one of two parts and both Spares. Scrap is a real additional material, but mechanical-parts crafting still consumes two scrap **and** an iron ingot, so these recovery/craft chains require a net external iron/wood/parts/time supply; repairing an item first costs additional iron/parts, rather than making a free cycle. Existing finite vendor offers consume Spares and there is no generic item→Spares Recycler rule or selling path to refund that currency. Existing fixed drive→2 Spares is preserved; there is no drive crafting recipe and wreck sources/respawns are governed by their existing finite, run-pinned policies. This is a direct rules/loop audit and focused tests, not a proof about every unrelated world economy loop or future content.

## Inherited seven save failures — traced, narrowly fixed in fixtures

Instrumented a clean archive of pre-S06 `897e28f2827119542bcf4217c27cf421f9cf4011`: a representative in each of `emergent-fire`, `home-ecology`, `home-production`, and all seven failures, first rejected the source-authenticity check limiting each remaining public loot stack to its authored base plus `lootRoll(run.seed, site, cycle)` (current `persist.ts`, public-loot per-slot `left < 0` guard). These fixtures changed `run.seed` **after** initial deterministic loot had been rolled, so stored loot no longer matched its seed. Classification: synthetic inconsistent source/seed representation, not demonstrated mechanics-produced state. Fixtures now choose the desired weather/fire seed on a disposable probe and create the actual run with that seed before rolling loot. No identity digest, source authenticity or physical custody validation was weakened. All 24 tests in those three affected files passed after the correction.

## Verification and boundaries

- TypeScript and focused SYS03/legacy recycler/progression/custody/S05/S06/motorbike/loot suite: 9 files, **81 tests passed**. `sys03-recycler.test.ts` checks tiers, protected classes, UID/cancel/replay, output all-or-nothing after reload, exact chronological event time, research exclusivity, real craft→recovery→repair, malformed reservations and direct-cycle economics.
- `web/e2e/sys03-recycler-fixture.mjs` and `web/evidence/sys03-recycler-fixture/`: inspected 640×360 preview, irreversible confirmation, processing and three-output frames. Controlled location beside the already-authored Foundry machine, creatures suppressed, a 300/350 iron sword granted; real E, dropdown and button inputs and real 15-second processing. This does not prove acquisition, gate travel, natural play or final visual approval.
- Final commit verification commands and full-suite result are recorded in the PR handoff. Balance tuning and broad long-run economy stress remain open.
- Imported Veyra has no invented Recycler: deployment requires authenticated Map-owned machine placement/access/geometry and route contract. A3 economy acceptance, native simulation/save/UI adaptation, UI art/readability review and natural-play/cross-owner acceptance remain separate HOLD gates.
