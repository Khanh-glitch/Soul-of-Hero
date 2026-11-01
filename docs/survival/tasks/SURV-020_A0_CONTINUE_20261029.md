# A0 CONTINUATION COMMAND — SURV-020 / 2026-10-29
**For the SAME already working A0 in Arena branch `arena/54306b59-soul-of-hero`. This command CONTINUES, DOES NOT CANCEL, TRANSFER, RESTART, OR MERGE the task.**
**Issued by integration coordinator, not an autonomous background notification.**

Repo https://github.com/Khanh-glitch/Soul-of-Hero ; parent #9, Draft PR #11; tested partial SHA `77c639331d8d4b0c472e86e7538275e6778aa697` run `40849106485`, PR head at last audit `e038b64e46567ebd6413b9f500381643a18556f0`. Read the live refs before changing code. Your Arena fixed-branch restriction is accepted: don't create/switch branches or force push. Integration and merging are coordinator-owned.

## 0. State and reviewed findings: no more shallow acceptance
- SURV-010 foundation remains verified; 125 native checks at `d3885226`, PR #10 merged. Preserve it.
- Your SURV-020 **storage increment** (nonempty chest demolish refusal in SaveService transaction; repeated legitimate identical stash/take with monotonic `container_sweeps` and atomic v2 receipt) is **narrowly supported by Godot 4.7 Xvfb 132 checks**, not full SURV-020 verification. PR #11 remains DRAFT. Read complete independent review `docs/survival/reviews/SURV-020_STORAGE_77c63933_INDEPENDENT_REVIEW.md`, not only your WORKLOG, and original `docs/survival/tasks/SURV-020_WORK_ORDER.md`.
- **Identified corrections:** `docs/survival/STATE.json.phase` must not regress to `...IMPLEMENTATION_NOT_STARTED`; reference live integration HEAD before updating docs. Correct `next_action.parallel_start`: A6 cannot edit your build strip concurrently; six physical agents total; A7 is a distributed QA workstream.
- **Unverified limits:** the v2 monotonic sweep receipt distinguishes two legitimate identical sweeps but does **NOT** prove same-player-command idempotency because `deposit_all/withdraw_all` lack stable command IDs. Don't claim logical replay protection. Add explicit command token or accurately scope claim, plus adversarial native tests (empty chest demolition + reload, two chests, full bag, near-full chest, legacy counter missing with receipts, repeated sweeps across reload). Preserve changes that already work; do not spend unlimited time polishing storage instead of building shelters.

## 1. IMMEDIATE NEXT MILESTONE — bounded, native-tested room topology
**Move substantive SURV-020 work forward now.** A complete deterministic local construction room topology implementation, not a global-rectangle scan, no hardcoded one-room test map. Before writing new code, inspect current 16px one-piece-per-cell foundation, wall and chest placement; resolve the problem that furniture cannot currently coexist with foundations. Design authoritative cell/edge occupancy with doors as physical connectors and terrain/structure persistence as separate concerns, without sacrificing existing SaveService contracts.

Implement in production-owned `game/survival/**` and A0 tests, preserving ten existing Chapter-1 dungeons and Hero collision:
1. A local finite/bounded room detection model (connected-component/flood-fill with explicit bound, no potentially unbounded global world scan), strong deterministic IDs or recomputable equivalence.
2. Real authored placement of wall/foundation/door connectors and test geometry that supports enclosed nonrectangular room, incomplete perimeter, two adjacent rooms/shared wall, opened boundary, split/merge and demolition.
3. Topology recomputation only when needed (build/remove/restore), not per-frame full continent.
4. Prevent disconnected world structures causing enormous bounding rectangles; bounds, runtime complexity and memory measured. No false-positive room from diagonal corner contact or open roof edge.
5. Native Godot tests on **actual production chapter1_overworld.tscn**, using actual SurvivalService/world objects; validate state consistency across save and reload, no ghost collisions or free placement.
6. One **independent negative fixture** that was not in your initial tests (e.g. two structures separated by hundreds of tiles, or multi-room demolition while a chest remains occupied).

This is the first **checkpoint with a real deliverable**, not the endpoint of SURV-020. Push code, test, inspect native visual or spatial debug evidence and record exact SHA/Godot command/results.

## 2. Continue SURV-020 all the way to its original acceptance
After bounded topology passes:
- **Roofs:** real per-enclosed-room roof surface/visual, outside visible and only current occupied room fades/hides. Adjacent and unrelated rooms unaffected, no flicker at doorway, correct layering, pixel readable native/2K/4K.
- **Doors:** physical open/closed collision and reliable input interaction; player actually moves through the door; no opening/closing that strands the Hero or permanently blocks mandatory routes. No disconnected script mock.
- **Living shelter:** indoor chest operation and separation of distinct storage inventories, furniture occupancy and costly bed/activation. Reuse existing `GameSession.checkpoint` / `Knight.respawn` lifecycle safely, checking dungeon-vs-overworld ownership; don't install overworld bed as a global dungeon checkpoint in the wrong scene. Missing/destroyed bed => safe spawn outside all colliders.
- **Transactions & saves:** one authoritative SaveService with exact-once physical item accounting, paid build/removal rules, old save migration, repeated cross-engine restart and death/recovery consistency.
- **Playable automation:** Spawn → harvest → build closed multi-room house → roof and door behavior → stash/take → activate bed → die → safe respawn → reload → re-enter restored home. Capture **real** Xvfb/native outside/inside/multi-room frames, check original dungeons, overworld and Hero combat regression. Survival-specific Web manual/automated steps if feasible; otherwise mark NOT_TESTED and do not claim Web survival PASS.
- Compare visual and gameplay against Atlas/source/CT-07+11, not merely code unit checks. No fake native PASS from a parser or SVG.

## 3. Interaction boundaries with ALL other agents (six total)
- **A1 World (#12):** authors `data/survival/world/**` and world source/POI graph, owns neither your existing production overworld controller nor your local build/physics APIs. You provide read-only spatial contract, not wait for its full continent to finish.
- **A3 Economy (#13):** authors recipes/items/research/physical Core *economy*, not Gold VFX. You provide structure/station footprint and SaveService transaction interface; use already existing four build costs until A3 integrates validated balance. A3 owns automated economy checks; never let a preliminary price proposal override live construction without review.
- **Pre-existing A4 Gold/VFX:** running on separate Arena branch `arena/c7b0c4e8-soul-of-hero` as of last Git inspection. Gold native differential has failed for Venomwright #13/#15/#16 in a recent run; a later run was queued at audit. Do not copy or touch its Gold/skill code, assume full parity, or require it to finish before your shelter. A3 may define Core economy by stable abstract skill identifier; native integration waits for proven per-skill readiness and versioned API.
- **A6 UI/UX (#15):** creates independent `game/survival/ui/**`/docs/assets, **must not replace your active build strip or HUD**. You provide read-only build state, costs, invalid reason, room/door/bed status; integration only after A0 reviews code and visual.
- **S6/A5-DEEP (#18):** optional high-reasoning single POI exemplar, can take indefinitely and **must never block you, A1, A3, A4 or A6**. Do not make its mission graph a required POI schema.
- **Coordinator (this ChatGPT + user):** owns independent gate review, cross-PR compatibility and final merge decisions, not your in-flight branch. Check `docs/survival/CONTROL_TOWER_CURRENT.md` for latest status when available.

## 4. Stopping rules, risk and return format
- Keep working to **SURV-020 as assigned**. An incremental checkpoint is required to prevent data loss, but it is NOT permission to close task or claim completed.
- If your Arena execution/token budget forces a stop after an increment, commit/push honest WIP and write an exact `NEXT_ATOMIC_ACTION` with affected file, test and blocker. Do not waste a session repeating plans or storage-only work.
- A serious ownership conflict, unvalidated destructive save migration, all Gold/hero state regression, or non-atomic inventory corruption => **STOP affected integration path and report**. Other independent work continues.
- If successive check-ins again produce only peripheral fixes without bounded topology, the coordinator will reassess your ownership; no automatic firing for honest partial work.
- Every checkpoint: `DONE / NOT_DONE / BLOCKED` by subsystem, source/code method, source Atlas/CT anchors, changed files, run SHA+URL and actual logs/screenshots, negative tests, regressions, effect on A1/A3/A4/A6/S6, precise next step, branch and PR. Keep `code_claims.survival_system_integrated=false` until full independent acceptance.
- Sync Google Docs tab04 if connected; otherwise mark DOCS_SYNC_PENDING in Git, not a success claim. The coordinator has independently synced the **last** A0 WIP and review to Docs but this does not auto-sync future commits.

**ACTION:** Reopen your existing SURV-020 task, repair doc-state/ownership regressions, implement+test bounded room topology, then proceed with roofs/doors/bed and full native player sequence. Do NOT open a new task, do NOT merge Draft PR #11, do NOT pause awaiting another agent.
