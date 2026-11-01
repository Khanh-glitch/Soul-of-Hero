# A6 SURV-UX-010A — Independent checkpoint review (2026-10-29)

**DECISION: CONTINUE_WITH_CORRECTION. A6 task NOT COMPLETE, not an overall FAIL.** User reports A6 has started and made local code changes; no actual A6 implementation/CI/fixture image supplied to coordinator for independent audit.

## Git truth vs agent report
- User-reported: isolated Godot journal with scrollable satchel, item inspect, placement rejection and material shortfall, discovery-filtered resource hints, read-only SOH catalog adapters. No A0 HUD/SaveService or A4 Gold changes claimed.
- User-reported: Godot 4.7 passed 21 headless checks and 23 native fixture checks at **each** of 1280x720 / 2560x1440 / 3840x2160. Screenshot is a fixture, not gameplay. Nothing verified against actual logs or source here.
- Local SHA: 0bf9151d1346aaddb127bf8e7a7882fe9bf0e568. GitHub commit lookup failed (not found); the dedicated A6 task branch has only work-order commits. No A6 PR. User sees links to a two-commit patch, but bytes/screenshots have not been provided in this chat. **Do not call that local implementation VERIFIED until the patch is retrieved and inspected.**
- Agent disclosed Atlas/trace was truncated; full-source requirement unfulfilled. It also disclosed disconnected Google Docs (DOCS_SYNC_PENDING) and missing GitHub push credentials. Do not mark complete.

## A0-side input integration flaw: source inspected directly
On A0's live arena/54306b59-soul-of-hero source:
- game/overworld/chapter1_overworld.gd: _process() calls _handle_survival_input(), which uses Input.is_action_just_pressed("build_place") and then survival_build.try_place(survival_build.preview_cell()).
- game/survival/survival_build_system.gd: _build_hud() creates a full-screen blocker with Control.MOUSE_FILTER_STOP, intended to suppress Knight._unhandled_input attack events.
- **Input event consumption and per-frame action polling are separate mechanisms.** A UI-click can reach action polling even when Control consumed the event. A0 must add an explicit gameplay-modal input gate before placement/cost debit; A6 must not edit A0's controller.
- Potential second bug to **test rather than assert**: _handle_survival_input() handles ui_cancel in build mode, while outer _process() checks the same ui_cancel and might also trigger _retreat_to_home() in the same frame.

## Immediate A6 continuation (same agent, same local work)
1. **Preserve unpushed work first.** Try authorized push to existing A6 owned branch. If no credentials, export complete ordered two-commit git-format patch with base SHA, both commits, path manifest, test commands and results; save externally and provide to user/coordinator. Do not reset or clean local work before patch backup. No false PR/push claim.
2. Continue independent journal and other A6 UX components in owned isolated UI paths, but **do not production-wire while A0 modal input gate is missing**. Provide simple read-only modal-open signal/state contract and isolated mock/fixture tests. Do not implement another inventory manager.
3. Re-read relevant missing Atlas and source-trace UX segments using paginated local reads; audit source anchors honestly. Inspect actual 1280p and integer 2K/4K fixture screenshots visually, not just tests, and later repeat in production world.
4. Prepare adapters for A3 crafting/research/Core data and A0 build/bed, but mark unavailable producer APIs NOT_IMPLEMENTED until verified. Continue full original A6 work order; do not stop with satchel.
5. Hand off patch/source/tests/screenshots so coordinator can independently read diff/actual code/test oracles before APPROVE and submit eventual PR.

## A0 cross-agent interface task (not to delay bounded topology)
A0 owns production modal gate in chapter1_overworld.gd:
- Define explicit versioned gameplay-input-blocked state/API for A6 journal and build overlay; require event-order correctness.
- Gate polled build_place before try_place and inventory debit when journal modal active.
- Test in actual native production scene: build active + journal open + satchel click => zero placement/zero charge; close journal + world click => exactly one charged placement; ui_cancel => close modal without unintended retreat; Knight combat not leaked through UI.
- Keep A0 SURV-020 room topology/roof/bed task primary; implement gate before A6 is wired, not prematurely halt all code.

## Cross-agent routing
A1 continent independent; A3 future recipe/research/Core economy provides authoritative read-only UI contract, no production module duplication; A4 original Gold visuals unchanged; S6 optional POI microstudy irrelevant to modal input; A0 solely owns build input and SaveService. Coordinator owns independent audit and integration veto, not A6 working tree.

## Gates
| Gate | Status |
| --- | --- |
| Fixture UI implementation | USER_REPORTED_PARTIAL; actual patch unavailable |
| 21 / 23 x3 engine checks | USER_REPORTED_PASS, NOT INDEPENDENTLY VERIFIED |
| Visual screenshot quality | NOT_REVIEWED (fixture screenshot only) |
| Live production UI integration | NOT_DONE |
| Modal build-input safety | REAL A0-SIDE INTEGRATION BLOCKER |
| Complete crafting/transfers/map/hazards/bed/Core UX | NOT_DONE |
| GitHub push/PR | NOT_DONE |
| Full Atlas source audit | NOT_DONE by A6 |
| Overall task | CONTINUE_WITH_CORRECTION, not final PASS/FAIL |

**UI button choice: "Tiếp tục làm việc".** No reason to replace A6 on this first honest checkpoint.