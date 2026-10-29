# Offline Expedition Workspace V1 — exact-SHA verification

**Tested code:** `0addc5fbd6eaa367ec24cf20488337fa2e7f644f`, parent `82496ac4ea4f3e7b8182ee8613bed85a26c43eb2`; ordered patch base `1ee7e43da22adb4b9ce1647efbcb1b07988ceaf7`. At test start the worktree was clean; it remained clean after all tests, including their deterministic captures. Godot `4.7.stable.official.5b4e0cb0f`, Linux Xvfb, software Mesa llvmpipe GL compatibility, dummy audio. Native VSync and missing `libxkbcommon.so.0` warnings appear in logs; no script errors, failed assertions, ObjectDB/resource-leak errors or nonzero test exits. Test cleanup waits for project UI sounds before exiting.

| suite | headless | native 1280×720 | native 2560×1440 | native 3840×2160 |
|---|---:|---:|---:|---:|
| Journal / adapter | 21 | 23 | 23 | 23 |
| Planner / adapter | 28 | 33 | 31 | 31 |
| Composed workspace V1 | 58 | 64 | 60 | 60 |

Numbers are checks; all failures **0**. Raw exact-SHA logs: `tests/survival/ui/evidence/v1-0addc5f-*.log` (12 files). Captures produced in these runs: `v1_workspace_map_{1280,1440,2160}.png`, `v1_workspace_core_{1280,1440,2160}.png`, `v1_research_confirmation_1280.png`, `v1_recovery_1280.png`, `v1_workshop_{bright,dark}_1280.png`, plus standalone journal/planner fixture captures. These are fixture views against solid colors, not production world/combat footage; 1280/2560/3840 are 2×/4×/6× the project 640×360 logical viewport. I visually checked V1 map, Core, research confirmation, workshop, recovery, journal and storage at 1280 and map at 2560. Readability at physical display sizes, noninteger scaling, accessibility and source-faithful visual approval are not established.

Headless: `godot --headless --path . --script res://tests/survival/ui/{ui_test,planner_test,workspace_v1_test}.gd` **one script per invocation**. Native example:

```sh
xvfb-run -a -s '-screen 0 1280x720x24' env LIBGL_ALWAYS_SOFTWARE=1 \
  godot --audio-driver Dummy --path . --rendering-method gl_compatibility \
  --resolution 1280x720 --script res://tests/survival/ui/workspace_v1_test.gd -- 1280
```

Repeat with `--resolution 2560x1440 -- 1440` or `--resolution 3840x2160 -- 2160`, matching Xvfb screen; run the other two test scripts identically. Execute native tests sequentially because the project's local bridge may bind a shared port. First import project assets using `godot --headless --editor --path . --quit` when needed.

These are behavioral UI/fixture tests, not SOH transactions, persistence, live geographic data, release-frame/gameplay polling protection, or production integration. The fake host's specimen consumption, capacity and idempotent receipt logic exist solely to test the interface. Synthetic button signal activation is used in many checks; native GUI mouse routing and keyboard Escape are separately exercised. Controller neighbor traversal and real input polling remain untested. A0 owns and must verify the production modal gate; this work cannot substitute GUI event handling. No production PR/integration/approval claimed. Google Docs tab 04: `DOCS_SYNC_PENDING`.

**NEXT_ATOMIC_ACTION:** A0 to supply/review the real modal gameplay-input gate and run the specified build/debit/combat/close regressions; A3/A1/A4 owners to agree versioned DTO/commands and provide actual recipe/Core/geography/Gold data. Until then, continue isolated UX/focus/visual work only; do not wire to the production overworld. Full Atlas/trace takeover read and independent human review remain open as noted in `CONTINUATION_20261029.md`.
