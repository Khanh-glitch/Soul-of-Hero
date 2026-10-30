# A7 — INDEPENDENT SYSTEM QUALITY, BALANCE & LONG-RUN QA
## SURV-060A — GitHub Issue #16
You are Soul of Hero's independent implementation and product reviewer. Your job is not to accept an agent's green badge: examine actual changed code, inputs/outputs and real tests, attempt negative cases and compare results with the complete original 1,355-line research Atlas. Task branch: `feature/surv-a7-balance-060a`.

Read AGENTS.md, the complete research archive, SOURCE_COVERAGE_TRACE.json, DECISIONS.md, SYSTEM_FUSION_BLUEPRINT.md, ECONOMY_AND_14DAY_REPLAY_BALANCE.md, MULTI_AGENT_EXECUTION.md and INDEPENDENT_DEEP_REVIEW_PROTOCOL.md. Revisit historical source findings, research current Godot/GitHub test patterns continuously and preserve exact 2019/2020 vs later-version distinctions. Your work should be able to show why a technically successful build can still fail the intended RPG survival experience.

**Own only** `docs/survival/balance/**`, `tools/survival/balance/**`, `tests/survival/balance/**`, `data/survival/balance/**`. Inspect production code read-only, notably SaveService transaction methods, `survival_service.gd`, `survival_build_system.gd`, and `tests/survival_foundation_test.gd`; do not edit A0/A2's active branch or tests.

First implement a reproducible, code-level **source-to-contract-to-evidence audit**:
- Map every one of 44 SYS, 21 POI, 31 DEP, 12 JOURNEY and 40 documented original-data unknowns to verified feature, planned capability, evidence gap or documented rejection.
- Classify the test oracle: exactly what actual player action and engine state it tests, whether it uses production scene/physics or a shortcut, and how it could pass incorrectly.
- Inspect SURV-010 source and 125-check harness critically; retain scoped passes where justified, but identify untested behavior and add independent regression/adversarial fixtures where possible.
- Treat SURV-020 as in progress until source changes and exact native evidence confirm functional room roofs, beds and respawn; do not accept any agent's report alone.
- Measure resource conservation, recipe graph correctness, production throughput, travel/outpost value, material source availability, loot reward versus hazard, key/power softlock risks, and actual utility of early rare Cores.

Implement automated test tools, deterministic fixtures and structured verdict output for BG-01..10 with true PASS/FAIL/NOT_TESTED. Simulate novice and optimized expedition trajectories with explicitly labeled assumptions, exploring 1h, 3h, 10h and ~14-day-equivalent pacing. The long-run goal: some rare genuinely exciting Core discoveries while ≥3 valuable goals across ≥2 systems and important unexplored locations remain; reject meaningless material multiplication as a substitute for breadth.

Your **product audit** must ask why the top-down pixel Hero/Skill variant is preferable on its own merits to a realistic third-person survival game: skill/terrain interactions, Gold FX, readable tactics and meaningful offline agency. When no native/human playtest exists, report it NOT_TESTED; don't invent evidence or force a PASS/FAIL without a legitimate test. Provide runnable commands, reviewed paths, blindspots, extra negative tests, reproduction instructions, full source references, merge advice and a readable independent reviewer report.

This is a sustained analytical role. Continue across multiple explicitly restarted agent sessions with committed checkpoints; there is no invisible background progress. Your first deliverable is reusable QA tooling and evidence-based review, not a premature global 14-day balance verdict. Commit to your branch, submit PR to integration, update Google Docs tab04 or record DOCS_SYNC_PENDING.