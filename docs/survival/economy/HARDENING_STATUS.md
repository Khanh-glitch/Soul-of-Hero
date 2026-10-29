# SURV-030A PR #19 adversarial hardening status

Code SHA: `17e0358bf388680312789caecc7d26f3779aafb1` (docs handoff may follow; code unchanged).
PR: https://github.com/Khanh-glitch/Soul-of-Hero/pull/19 — **OPEN, NOT APPROVED FOR MERGE, no self-merge**.

## Evidence

- Push CI: https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40878087266 — SUCCESS.
- PR-side CI: https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40878096753 — SUCCESS.
- Python: 10 tests PASS; catalog validator PASS (56 items / 36 recipes / 5 technologies / 36 sources / 7 stations; 0 production cycles); balance model conservation PASS, `NOT_HUMAN_PLAYTESTED`.
- Native Godot 4.7 real SaveService adapter: **362 checks / 20 cases PASS** (CI notice annotation).
- Native save-growth micro-measure: 30 transactions, no new `commands` growth, collected job escrow compacted.
- Serialization model: `save_growth_report.json`; 14-session model 2,801 transactions / 173 terminal instances, schema-2 compacted 843,308 bytes vs legacy duplicate commands 1,252,253 bytes.

## Finding status

| finding | status | A3-owned result | external gate |
|---|---|---|---|
| E-01 unique physical token | PARTIAL / A0_BLOCKED | Fail-closed ownership audit gates cast/repair/dismantle/research/wear/grant/collect/advance; owned-instance reporting and totals exclude invalid tokens; native negatives prove generic SaveService drop/transfer/merge can still corrupt state and A3 refuses. | A0 must implement `A0_SAVE_SERVICE_GUARD_CONTRACT.md` across generic SaveService APIs. |
| E-02 trusted production time | PARTIAL / A0_BLOCKED | Caller ticks removed; injected `soh.economy.active_tick.v1` host; duplicate/no-elapsed/forged/stale/session/quantum negatives; pause/rebaseline/reload/queue fairness/escrow recovery tests. | A0 must provide authoritative active-session host and station/power/condition/removal lifecycle. |
| E-03 real A4 attestation | PARTIAL / A4_BLOCKED | Strict `soh.economy.skill_attestation.v1`; synthetic ready rejected; wrong version/id/source/boundary/context/instance/revision/token rejected; production catalog Cores remain BLOCKED_PENDING_A4. | A4 must supply real Gold/source-backed verified binding and authoritative gameplay commit producer. |
| E-04 A1 reconciliation | PARTIAL / A1_APPROVAL_PENDING | 7 direct mappings preserved; 8 aliases individually reviewed, all provenance_equivalent=false and UNRESOLVED_PENDING_A1_PR20; 12 MISSING explicit; smallest conditional split proposal frost_resin/venom_sac/peat. | A1 PR #20 must approve/reject aliases and confirm source provenance/sinks. |
| E-05 edge cases / save growth | DONE_A3_SCOPED | Instance output qty=1 enforced; malformed/legacy namespace tests; v1→v2 migration; collected/terminal job compaction; commands growth stopped; measured serialization model and native micro-measure. | A0 receipt/terminal-instance retention policy and native long-session disk benchmark remain open. |

## Overall gate

**NATIVE_FIXTURE_PASS / WORLD_NOT_INTEGRATED.** This is an authored economy/adapter safety milestone, not production station placement, A1 spawning, A4 Gold casting, or human balance approval.

## NEXT_ATOMIC_ACTION

Independent reviewer/coordinator: audit PR #19 at the final head against E-01…E-05 and the new native negatives; then route `A0_SAVE_SERVICE_GUARD_CONTRACT.md` + `A0_ACTIVE_TICK_HOST_CONTRACT.md` to A0 as the next integration implementation task. Do not merge PR #19 solely because CI is green.
