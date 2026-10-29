# Independent deep review — SURV-020 storage-safety increment (A0, 2026-10-29)

## Verdict (strictly scoped)
**SURV-020 COMPLETE? NO.** The PR remains DRAFT and must not merge as a completed shelter. **Storage-safety increment: CODE-AND-NATIVE EVIDENCE SUPPORTS THE NARROW FIX**, conditional on review points below; no human or independent new end-to-end playthrough is claimed.

- PR [#11](https://github.com/Khanh-glitch/Soul-of-Hero/pull/11), work branch `arena/54306b59-soul-of-hero`, WIP head `e038b64e46567ebd6413b9f500381643a18556f0`.
- Exact tested code `77c639331d8d4b0c472e86e7538275e6778aa697`, [workflow 40849106485](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40849106485): `SURVIVAL FOUNDATION PASSED - 132 checks`, 12 named cases, Godot 4.7 Xvfb exit 0. Both `SURVIVAL STATIC CONTRACTS` and `SURVIVAL NATIVE RUNTIME` jobs completed successfully. [Overworld regression 40849106597](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40849106597) reported green. **No survival-specific Web or shelter screenshots**.
- PR patch was actually inspected, including full `remove_structure` and `_transfer_all` implementations, `SurvivalStateData.sanitize`, SaveService `transact_once` / `_commit_candidate` and `add_items_to_candidate`/ `remove_items_from_candidate`, test case 07 and reload cases. This audit did **not** initiate an independent Godot process or simulate a real person using the game. Original 1355-line Atlas / CT-02/03/07/11 are the source contract, not an assumption that storage safety equals an inhabitable base.

## What passes under code and source review
1. `remove_structure(entity_id)` checks persisted `containers[entity_id]` **inside** the candidate mutator, before deleting the structure, and returns `false` for nonempty contents. SaveService `transact_once` copies state and only commits when the mutator returns true. This correctly guards against the previously identified *direct* loss of contents on chest demolition. It is **refusal**, not refunding/evacuation/storage pickup; do not conflate.
2. Previous sweep receipt depended on item quantities and prevented a legitimate identical later deposit. Replacing it with a committed `survival.counters.container_sweeps` and `survival.transfer.all.v2.*` receipt allows distinct repeated sweeps; storing the counter inside the same candidate as the transfer is the appropriate atomicity seam.
3. The previous projected chest slot check used `projected_slots + planned.size()` while also checking a loop; the new explicit increment per new item aligns planning with slots already reserved and can admit a valid additional item.
4. Existing source test **case 07** now checks a nonempty-chest demolition rejection with document equality and repeated identical deposit/withdrawal through the actual `SurvivalStructure.interact(player)`. CI log contains named checks. Case 08 and 12 retain save/reload foundation tests.

## Required corrections and independent falsification cases
**D-01 / Document integrity (fix before PR merge):**
PR `docs/survival/STATE.json` changes `phase` from `SURV_010_MERGED_SURV_020_USER_REPORTED_IN_PROGRESS` back to `SYSTEMIC_FUSION_SPEC_APPROVED_MULTI_AGENT_READY_IMPLEMENTATION_NOT_STARTED`. This is a **wrong high-level status regression** (even though individual SURV-010 is still VERIFIED, SURV-020 IN_PROGRESS). Correct to an accurate merged/WIP phase and reconcile against integration HEAD, which has advanced with parallel-agent documentation.

**D-02 / Ownership contradiction (fix before integration):**
PR's `next_action.parallel_start` directs A6 to "replace ... the build strip" while active A0/A2 owns the construction HUD. A7 as a separate agent is also outdated under six total AI staffing. Resolve by preserving per-agent file ownership; A6 may implement independent new-path UX, no shared build-strip edits without explicit contract.

**T-01 / The same logical action vs a legitimate new sweep:**
`deposit_all(container_id)` and `withdraw_all(container_id)` have **no caller-supplied stable event/operation key**. The new sequence gives each successful call a fresh receipt, so it solves the *false duplicate of distinct actions*, but **does not distinguish retry of the same input event from a new intended action**. The current tests run two complete cycles with intentional separate interactions; they do NOT exercise duplicate delivery of one event after a crash/reconnect. Before claiming idempotent player actions, define an optional stable request key (or equivalent de-bounce/atomic command identity) and test (a) replay same logical key rejected/no-op, (b) separate keys with identical quantities allowed, including across save/reload, (c) no item loss on commit rejection. If intentionally deferred, explicitly limit the guarantee to atomic stock conservation and receipt uniqueness, not replay identity.

**T-02 / Missing negative coverage of new cases:**
Add at least (a) empty chest can be demolished and disappears from save + scene after reload; (b) two different chests with independent contents; (c) bag full prevents withdrawal without loss; (d) chest at or near slot capacity, several new item IDs, projected slot accounting; (e) legacy survival doc lacking `container_sweeps` while receipts exist, and receipt skip; (f) sequential valid sweeps **after** save/reload preserve counter; (g) malformed/orphan container data and no silent disappearance. Tests should use production-world APIs and vary state, not pre-write expected final state. These are unverified **gaps**, not claims the implementation currently fails.

**T-03 / Long-run storage and receipts:**
SaveService appends an `applied_transactions` record per successful sweep and rewrites save snapshots. Verify throughput/size and acceptable performance over many real 14-day-play-style actions when relevant, rather than claiming long-run stability from two cycles. Not a blocker to this first small increment; material for future balance/reliability.

**P-01 / SURV-020 full product acceptance still NOT TESTED:**
Bounded room topology (nonrectangular, adjacency, splits/merges), per-room roofs, usable open/closed doors with true traversability, bed/death/respawn and collision-safe spawn, persistence and legacy migration, actual complete player sequence, native before/inside/adjacent screenshot and 2K/4K readability, survival-specific browser test, human playthrough. No roof/bed feature exists in PR #11; a green foundation suite does not pass them.

## Review verdict by axis
| Gate | Result | Basis |
| --- | --- | --- |
| Research/provenance | PASS limited scope | Code and research-log inspection of 2 vetted concepts; no external code imported |
| Architecture/Save authority | PASS for this incremental change | Same SaveService, candidate mutation, add-only counter; no second manager |
| Native execution | PASS scoped | Workflow 40849106485 at exact code SHA; zero exit and 132 test assertions |
| Test oracle | PARTIAL | Two rounds + document equality; missing logical action replay/edge/legacy-counter tests |
| Visual UX | NOT_TESTED | No shelter screenshots nor human walkthrough |
| Systemic gameplay value | POSITIVE prerequisite; SURV-020 NOT_TESTED | Real preservation of scavenged items, no room/bed logistics yet |
| Save/migration | PARTIAL | Existing old-save tests, not new counter continuity and receipt-skip test |
| Integration/merge | NOT_APPROVED | PR #11 is draft and base outdated; state+ownership corrections needed |
| Balance/14-day | NOT_TESTED | Two cycles do not prove long-run usage, travel/storage value or engagement |

## Next decision
**Accept the value of this partial engineering increment without accepting SURV-020 or merging Draft PR #11.** Continue A0 on the fixed Arena branch (no force-push or unsafe branch switch), first bounded topology, then integrated roof/door/bed/death flow. Add missing storage negative tests and repair docs phase/ownership. Require native **visual** and true playable acceptance, then independent code/test review again before marking SURV-020 VERIFIED.

Google Docs tab 04 must be updated by the coordinator in a connected session; if readback passes, mark this **audit's** Docs sync complete while leaving A0's original disconnected-session log as historical fact.
