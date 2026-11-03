# Latest exact-SHA Expedition Workspace V1 verification

**Tested source SHA:** `e467595f6c68adff4ba4c9be3ad457fc57865388`; worktree was clean before and after test runs, including captures. Ordered patch base `1ee7e43da22adb4b9ce1647efbcb1b07988ceaf7`. This supersedes earlier numerical results and adds visible source-container name filtering, retained search queries, and source-trace audit; all earlier production safety limitations continue to apply.

Godot `4.7.stable.official.5b4e0cb0f`, headless and Xvfb/Mesa llvmpipe GL compatibility, dummy audio; suite invocations run sequentially. All counts are checks and **all failures are zero**:

| suite | headless | native 1280×720 | native 2560×1440 | native 3840×2160 |
|---|---:|---:|---:|---:|
| Journal / adapter | 21 | 23 | 23 | 23 |
| Planner / adapter | 28 | 33 | 31 | 31 |
| Composed workspace V1 | 74 | 80 | 76 | 76 |

All 12 test processes exited zero. No script errors or ObjectDB/resource leak errors; native logs contain VSync and missing `libxkbcommon.so.0` warnings. The independent read-only source-integrity script passed for the pinned 1,355-line Atlas, 108 unique trace entries, 40 unknown facts, 28 citations and verbatim semantic fields; see `SOURCE_REVIEW_20261029.md`. Logs: `tests/survival/ui/evidence/v1-e467595-*.log` (13, including source audit). Reproduction, UI screenshots, known synthetic-action caveats and environment commands: `TEST_EVIDENCE_0addc5f.md` and `V1_WORKSPACE_CONTRACT.md`. The updated 1280 storage fixture image was visually inspected. Native resolutions reflect 2×/4×/6× project logical dimensions, not human readability certification or an end-to-end game test.

No real gameplay transaction, SaveService persistence, geography, hazard, bed, Gold VFX, physical Core behavior or production integration is proven by these fixture tests. Host capability and quantities must be authoritative; fixture capacity and rules are examples. GUI event interception cannot block separately polled gameplay input. A0 must provide and verify its production modal gate; other owner integrations require agreed contracts. No PR/push succeeded; `DOCS_SYNC_PENDING`. Independent human review, real-device/controller/keyboard traversal, localization and source-faithful visual polish remain open.

**NEXT_ATOMIC_ACTION:** A0 supplies and verifies the production modal input gate and real build/debit/combat/close regressions; A3/A1/A4 agree owner data and command contracts before wiring. Continue isolated UX polish and coverage only while those boundaries remain unmet. Do not claim production integration or task completion.
