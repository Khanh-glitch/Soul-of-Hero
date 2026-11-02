# Control Tower independent multiaxial acceptance — A3 b44e22df vs A7 fe29d955 (2026-10-31)

**Decision:** A3 Round11 P1 `ACCEPT_ENGINEERING_SCOPE_ONLY / HOLD_PRODUCTION_INTEGRATION / NO_MERGE`. A7 Round10 `ACCEPT_DIAGNOSTIC_EVIDENCE_ONLY / STALE_COMPOSITION_NOT_CURRENT_ACCEPTANCE / CONTINUE_WITH_CORRECTION / NO_MERGE`. B0 `HOLD`, E2 `NOT_STARTED`. This report is NOT a human playtest and NOT an Arena dispatch. The attached work order below is **ready for user to paste into the existing A7 session**.

## R0 — product authority and qualitative promise

Source of truth: `CURRENT_PRODUCT_CONTRACT.md`, D062–D074, immutable 2019–2020 Atlas and `SOURCE_COVERAGE_TRACE.json`. Original Atlas USER-JOURNEY 01 (bare player → materials → tool → home/storage), 02 (Core use/store/research), 05 (topology → station throughput), 07 (net gain after tools/heals/travel, not gross loot), 12 (three sessions of non-dungeon progression), DEP-01, DEP-15, DEP-18, DEP-19. Latest product locks: quiet knife-first freedom, single-player solo, physical shelter, meaningful offline return, 336-hour max run, only three profile benefits survive reset, last-72h chest custody/deposit, distinct six Elders, full original Gold on enemy and terrain, no artificial grind.

A system PASS requires separate answers to **(a)** source fidelity, **(b)** correct code/transactions, **(c)** actual route reachable by a normal player, **(d)** credible meaningful decision, **(e)** alignment with locked emotional/product design. Neither models nor CI can substitute for human enjoyment judgement.

## R1 — current source / patch / cross-owner facts verified

- A3 PR19 `b44e22df3af40939069189be14afc23ee1ce21c4`, [hosted run 41164736315](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41164736315) SUCCESS for BOTH catalog/balance and native Save Adapter, including tool-use, offline, meta and second-process restart steps. `economy_tool_use_test.gd` now creates 30 actual inventory stacks and asserts failed plan, no save mutation/tool wear/yield; interrupted-write retry adds yield in same transaction. This remains a **fixture with direct candidate setup**, NOT ordinary UI gameplay. A3 baseline's generic Godot Runtime workflow has separate failure, not equal to the passing A3 scoped workflow.
- A7 PR25 `fe29d9558e15e43bfb0757c30bb1f17429ba2f23`, Round10 report `docs/survival/balance/ROUND10_SYSTEM_ACCEPTANCE.md`: tested composition `1d39e92e75d8` from A0 `84ac9c1a`, A1 `439d5ef1`, A3 `35214ed8`, A6 `3fa646cb`, A8 `3a7ab461` (AVFX excluded). Its independent source-level findings were substantive: stale item pin blocked A0 economy session, A0 profile-port missing production caller, post-expiry direct deposit accepted, A8 Godot array-typed entrance error, Mill readiness without producer, transparent gate, A6 source not staged. **Do not repeat those as current facts without rerunning.**
- Fresh owner refs on this CT check: A0 `86140e45c36d7e1d65cfafe8c5395c9489a51774`; A1 `9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf`; A3 `b44e22df3af40939069189be14afc23ee1ce21c4`; A6 `fbe8b2940adbf0ded5f2e009c09309b51a539eb4` (tested avatar code `19c9c787`); A8 `9d568e386f221f701361e64e6dce337ea6c8e4f8`; A7 `fe29d9558e15e43bfb0757c30bb1f17429ba2f23`; AVFX `8eb6b31c3c1ae51227f8b5079bf4fbbe966291a3`. REFRESH before executing.
- A0 `a0_economy_composition.gd` has actual production port bindings; `a0_v5_source_pins.gd` pins V7 owner SHA `35214ed8`; A0 native Round11 scoped report `docs/survival/reviews/A0_ROUND11_R5_NINE_GATE_20261031.md` says craft stone pick→mine real iron vein→persist cross-process works but no continuous rendered input and no actual damage source. A0 `apply_profile_delta()` currently has no explicit expired-run guard in its own method, so A7 should test exposed direct write and authentic source deposit after expiry separately, not assume already exploitable via normal player input.
- A8 latest native [run 41165239234](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41165239234) FAILED at `9d568e38`. Contract, transition, surface, Ragnarok, capture all PASS; **input journey FAIL** for Orchard boardwalk traversal/graft-mark action and Mill physical fastener access/retreat (4–5 failures in 291 assertions according to log). Legacy 22-failure diagnosis is no longer the latest verdict.
- The A6 native [41162133383](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41162133383) succeeded and CT downloaded/inspected the actual renders; prior A7 “source unavailable” was accurate ONLY at earlier A6 SHA. No new composited native proof with A0+A6+A3 is established.

## R2 / R3 — nine binary gates

These are scope-specific, not a claim of the full game:

| Gate | A3 P1 | A7 R10 | basis |
|---|---|---|---|
| RESEARCH_PROVENANCE | PASS | PASS | source IDs, catalog, Atlas traces and exact commits |
| ARCHITECTURE | PASS | PASS | single A0 SaveService, owner boundaries, A7 composition read-only |
| CODE_RUNTIME | PASS scoped | PASS scoped historical / NOT_TESTED current | A3 native fixture green; A7 executed actual Godot at R10 refs |
| TEST_ORACLE | PASS scoped / independent new mutations NOT_TESTED | PASS scoped historical / NOT_TESTED current | A3 negative suite fixed; A7 independently falsified assumptions but not new refs |
| VISUAL_UX | NOT_TESTED (A3) | NOT_TESTED (A7 R10) | no real rendered current joined gameplay reviewed |
| SYSTEM_VALUE | NOT_TESTED / FAIL if claimed production | FAIL for joined gameplay at R10 / NOT_TESTED current | no independently demonstrated authentic full source→decision→consequence chain |
| SAVE_MIGRATION | PASS scoped | PASS scoped R10 | two-OS-process proofs, not full season reset + old-save migrations |
| INTEGRATION | FAIL as complete product | FAIL R10 / NOT_TESTED current | A0 recently mounted V7 but no current A7 joined acceptance; A8 input red |
| BALANCE_REPLAY | NOT_TESTED | NOT_TESTED | seven 336h strategies are AI projections not actual 14-day play or creator feeling |

## R4 — what must be made enjoyable, not just callable

Test a genuine 30–60 minute early-run analog and repeated independent short sessions with A0 native player input (not injected god mode): (i) safe random spawn; (ii) knife-only roadside loot has net usable value without Core or forced dungeon; (iii) choices of store vs spend, build and return materially alter next expedition; (iv) tool/harvest has meaningful durability/repair/capacity tradeoff rather than painless universal optimum; (v) paid station offlining yields a visible result exactly once; (vi) one POI offers alternate outcomes and physical safe retreat/revisit; (vii) Core can be found, tried source-authentically without prior research, stored or reverse engineered; (viii) death bag has threat and recovery; (ix) last-72 cash and reset obey custody. For each measure actions, time, tool wear, consumables, capacity, receipts, route, risk and **net** player benefit, not raw loot or test counts. Mark unavailable with exact missing producer; don't invent "fun" scores without human observation.

## R5 — decisions, ownership and next proof

1. **A3 P1** accepted as a reliable technical candidate at b44e22df. No merge; do not reopen solved parser/filter problems. Next A3 owner action only when A0/A7 produces exact current-composition mismatch or A8/A1 produces physical source/stand/anti-farm authorization; then validate bounded source economic value, price/cooldown based on measured traversal costs and one real sink. No invented Orchard yield.
2. **A7** is available for a new sustained Round11 cross-owner audit using exact latest refs. Rebuild immutable `r11_a0`, `r11_core`, `r11_full` with verified overlay precedence, detect content drift (A0 vs A3) rather than auto-repin, test false-green fixture routes and genuinely playable J01–J07. Repeat after A8 fixes input. Separate current regressions from inherited historical findings. Inspect real 720/1440/2160 frames in playable map; if inaccessible mark `NOT_TESTED` explicitly.
3. **A0** currently has real integration responsibilities; do not overwrite while its Round11 CI is queued. Its next acceptance is a physical, continuous player-input J01/J03, no injected completion; run clock/offline/return and expiry direct-write guard as applicable.
4. **A8** own the remaining native Orchard/Mill physics blockers, no A3 reward grant before legitimate physical source proof. A1 geography must authorize access/stand. A6 must use actual owner data/real avatars, not return fixtures. AVFX remains authority for Gold, no imitative cast. E2 still hold.

**Shipping/merge:** all PRs remain independent until current composed runtime, player controls, save, Gold and visual gates pass; one green CI, one native pass or favorable model is not E2 acceptance.
