# 06 — REPRODUCIBLE ACCEPTANCE, REGRESSION, PERFORMANCE, BROWSER A–I, AND RELEASE
**This is the engineering acceptance method; NOT a reason to stop implementing and run tests for hours.**
Read Gameplay Bible §VIII evidence S0–S5 separately from Survivor Contract §10 implementation slices S0–S5. Creator subjective experience and art decisions are never bot-certified.

## A. EVIDENCE LEVELS / ACCEPTANCE MEANING
DESIGN LOCKED means Creator approved requirement; NOT code.
SOURCE IMPLEMENTED means traced actual production code and engine caller, not just declaration/interface.
ENGINEERING VERIFIED means same-SHA exact positive AND negative causal invariants with authoritative K1–K8 RunState state mutation, UID/stock/time/position/receipts; not forced fixture claiming natural gameplay.
BROWSER VERIFIED means real current production build entered through ordinary controls, action and actual resulting world UI, with unedited native 640×360 captures, no hidden mutable QA global; account for browser persistence.
CREATOR PLAYTEST REQUIRED means human-reviewed visual consistency, legibility, behavior feel and value of rescue. Not awarded by a bot.
Bible §VIII higher evidence tiers may separately demand natural live play and Creator replay; don't translate a passed unit fixture into experiential S4/S5.

## B. STAGED TEST EXECUTION — DO NOT SPEND EACH ITERATION ON FULL SUITE
During implementation, every coherent production change:
1. Run focused exact source/seam tests including a negative race/interruption/reload case.
2. Run relevant app/test TypeScript checks; keep compiler validation enabled, no exclusions or suppressed errors.
3. If feature is accessible, test one actual physical engine trajectory (ideally real browser).
4. Commit changed PRODUCTION behavior with evidence and update progress ledger.
5. Start next missing implementation dependency automatically. Do not stop and wait for Controller approval at internal milestones.
At integration milestones, run related suites and a representative browser scene; collect final-SHA evidence. At final release gate run FULL 197 executable test-file inventory, two TypeScript checks, build, migration, endurance, hardware-matched performance and A–I.

**Known prior test economics:** scripts/regression-shards.mjs inventories 197 files, four ordinary shards + separate new-game routes, two concurrent workers, 1,800s external watchdog each. A process running synchronous world work can ignore in-process Vitest testTimeout; watchdog must terminate process safely after diagnostic capture. Existing h336 P1-5 took ~1,024s (90s limit) on continuation, and isolated inherited ~93.7s in NON-matched environment. These durations do not validate acceptable runtime. Don't rerun unchanged 336h or massive route stress merely to reconfirm a known deficit. Profile a bounded 1h/8h/24h controlled scenario, implement hotspot fix, rerun unchanged long test at meaningful structural change. Never modify accepted timeout to turn pass green.
**Known five exact older baseline fingerprints:** WP3 retired damaged_drive (new-run retired item), MEC01-C1 missing crate c, W07 3 generator pack assertions. Proven inherited at exact older SHA, still UNREPAIRED or potentially obsolete; NOT blanket waiver for any regression. WP3 asks for retired item: do not revive retired loot; evaluate current FINAL_ITEM_SET legal replacement path, revise outdated assertion only with authoritative justification, and still verify the real natural salvage/recycler chain. All other failures require exact reproduction/classification.

## C. FULL REGRESSION CLASSIFICATION, FINAL SOURCE
First run exact source/test SHA fingerprints and list current failures. Classify each exact assertion:
- NEW regression introduced by current HumanWorld code; fix source.
- Known older source defect reproduced on a documented parent; decide whether essential final gameplay is blocked and repair it if so; historical label alone is not an acceptance waiver.
- OBSOLETE test conflicts with newer approved Creator law; cite source ruling, update test to assert approved gameplay, do not lower negative conservation invariants.
- TEST ENV / timeouts / unavailable services; repair harness, compare equivalent configuration and don't assume no defect.
- UNINVESTIGATED, explicitly NOT accepted; persist minimal reproducible details.
Run pass/fail/skips with full tests at final SHA; avoid stale checkpoints. Preserve test TS fingerprints and G1B 557→729 source migration, 16 pools, all approved recipes and old save UIDs. Never skip silently, condition tests on expected known failures without labeling, shrink gameplay/population artificially or claim build means content complete.

## D. REQUIRED A–I HUMANWORLD BROWSER CAMPAIGNS
Perform all in SAME current compiled game and authoritative run logic; record seed/start location/controls, version, actor IDs/source IDs, initial and final inventory and receipts, actions, exact game clock and screenshots. Normal-control gameplay is mandatory for natural recruitment/work; controlled QA time acceleration allowed for long growth/Ragnarok only if disclosed, not as proof of manually spawned actor/benefits.
A **LIVING COMMUNITY:** launch New Game through normal controls; walk into functioning community. See distinct actors actually travel/work/eat/rest and mutate finite store, floor/door controls. A workplace must have real source→output→storage and visible action; shortages produce intelligible blocked state.
B **EIGHT OCCUPATIONS:** in the SAME source/build, each of Salvager, Mechanic, Cook, Gardener, Medic, Guard, Engineer, Builder autonomously initiates lawful job and completes with actual distinct input/output/state mutation, can be interrupted/blocked, persists. Need not complete all jobs at identical time or in one village, but no fixture forcing intents.
C **SOCIAL TRUST / RECRUIT:** meet ordinary actor, truthful talk/need, provide actual useful food/water/medicine or assistance via own inventory, observe authentic trust 50→55+ where policy allows, consent/refusal, follow across valid path/level, release, persistent pack.
D **BARTER / CRIME:** offer and receive multiple real UID/quantities with executable counteroffer, exact atomic custody, refusal without debit; then threaten/rob under believable risk, witness/grievance, physically possible retaliation/theft and unreachable negative case.
E **COMBAT / INJURY:** hostile human approaches and faces target with windup, K5 melee, actual arrow/projectile contact and cost/Core if sourced, humans/creatures mutual damage, DOWNED, medicine and treated/corpse custody; reload preserves history and no duplicate hit.
F **GLOBAL / OFFLINE:** leave actual inhabited community, travel across windows/floor, let legitimate real elapsed time advance and separate-process reload, return to same actor and stocks with lawful work/shortage/route/migration. No instant resource import or duplicate job.
G **RAGNAROK:** advance to h312 via disclosed time control, experience canonical Elder physical attack/contact on remote and active community, defense/medical/consequences and a failed/blocked case; correct defeat authority.
H **EVAC / OUTCOMES:** genuine three-site transport operation, board NPCs while player stays, actual vessel departure/transit, distinct defended survival and death, end at h336 with exclusive outcomes, run 2 K8 wipe, player solo evacuation branch.
I **FREEDOM / EXPERIENCE:** try alternate/non-NPC path, refuse recruitment, leave city, ignore quests, carry/no-carry, accessible doors, 640×360 art/HUD no overlapping prompts; all eight roles optional, rescue never forced; Creator validates human feel.

## E. PERFORMANCE BENCHMARK — EXACT MEASUREMENTS, NO MISLABELING
Baseline 60-frame SwiftShader browser smoke with anomalously large intervals occurred concurrently with test workload; INVALID as matched ≤10% NPC regression measurement. Compare official main/G1B/NPC under same hardware or emulation, renderer backend, browser/font/asset conditions, viewport 640×360, warm/cold state, human/creature/entity density and actual active settlement work. Report mean/median/P95/P99 frame time, sample count, long tasks, cpu, peak memory, render budget, route planning, current source/baseline SHA and scene. Do not change GPU target while comparing. Distinguish CPU endurance from live FPS.
Measure startup/build asset sizes and decode/texture uploads, steady settlement, crowd combat, world streaming, 336h offline settle, save stalls, Elders/evac. ≈≤10% frame-time regression vs matched G1B scene is engineering goal when feasible, not fabricated hardcoded PASS. If environment cannot support valid comparison, classify NOT VERIFIED; optimize from real hotspots and disclose inability to certify target.
No deleting humans or real economy; no disabling legitimate Core/VFX, lowering pixel art, reducing game resolution, freezing background, skipping legitimate events or invisible inventory mutation.
Optimization proof = before/after source + same benchmark + source functionality still intact.

## F. MUST-PASS CROSS-SYSTEM INVARIANTS
- A run UID uniquely identifies every living/dead/evacuated actor and item; zero duplicate source-claim, work-output, corpse, trade or boarding.
- Lawful physical location/floor and route/time for EVERY global movement/source contact (including offscreen and companions).
- PLAYER_EXPLORATION (all G1B + old caches) remains untouched by autonomous economy.
- All eight natural professions consume valid source/material/time and produce real outputs or world mutations.
- Continuous needs/work/weather and timed wounds across online/offline do not double settle.
- Player and human combat share damage, range, line, projectile, Core energy and wear; no second Elder authority.
- Exactly one Elder attack/contact event and exactly one surviving outcome per actor; distinct simultaneous evacuation and defense supported.
- Safe historical save migration without retroactive human/source mint; K8 clean new run.
- Solo player gameplay untouched; 640×360 input/art/UX functioning.

## G. FINAL PACKAGE AND RELEASE DECISION
At final SHA produce under web/evidence/npc-integration/final-acceptance/<SHA>/:
1. STATUS.md with Creator-ruling/source pointers, exact SHA, branch, date, stage labels, evidence location, limitations.
2. 81-POI physical census CSV with per-site bed, actual owned residents, source IDs, food/water need and production/import, route/access and Elder coverage; not a list of default 'NOT_VERIFIED' flagged PASS.
3. 8-occupation matrix for natural/blocked/interrupted/reload/offline with source/output UIDs and gameplay captures.
4. Global route/cargo clock evidence with resource conservation; negative cases.
5. Social/companion/combat/trade/retaliation/K5 proof including real player controls; no synthetic social state for natural recruitment.
6. Elder six-source/contact/defense ledger, three-site physical vessel/manifest/arrival, exclusive outcome K8 history, one same-run two-rescue demonstration.
7. Unedited native 640×360 screenshots/short sequences + asset provenance, normal controls and no page/runtime/request errors.
8. App/test TypeScript and full regression logs/fail classifications/final commands; historical migrations.
9. Representative 336h endurance and fair main/G1B/current same-scene performance graphs/numeric; separate invalid attempts and actual accepted comparison.
10. Vietnamese Creator walkthrough, exact New Game entry and paths including ordinary controls and legitimate ways to exercise systems.
11. Explicit gate table DONE/PARTIAL/BLOCKED with separate CODE/ENGINEERING/BROWSER/CREATOR; final Creator visual/experience remains REVIEW REQUIRED.
No preview screenshot or fixture is allowed to grant HUMAN EXPERIENCE acceptance. Do not merge production merely because tests pass.