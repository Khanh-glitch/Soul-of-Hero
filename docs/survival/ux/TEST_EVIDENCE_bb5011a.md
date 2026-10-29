# Expedition Workspace V1 — latest exact-SHA evidence

**Tested code:** `bb5011a3bae4a038de45aaa39d1fa7035256fdc5`. The clean worktree stayed clean through all runs and capture regeneration. This follows `0addc5f` and its evidence in `TEST_EVIDENCE_0addc5f.md`; it adds a research-ready specimen in the **fake interactive demo**, tab-row left/right wrap neighbors, and focus fallback to retry or the active tab after dynamic controls are rebuilt. Production remains blocked on A0's verified input gate.

Godot `4.7.stable.official.5b4e0cb0f`; headless and Xvfb/Mesa llvmpipe GL-compatibility native, dummy audio. VSync and missing `libxkbcommon.so.0` warnings only; no script errors, ObjectDB/resource leak errors, assertion failures or nonzero test exits. Each suite run separately, native sequentially. Counts are checks, all failures zero:

| suite | headless | native 1280×720 | native 2560×1440 | native 3840×2160 |
|---|---:|---:|---:|---:|
| Journal / adapter | 21 | 23 | 23 | 23 |
| Planner / adapter | 28 | 33 | 31 | 31 |
| Composed workspace V1 | 70 | 76 | 72 | 72 |

Raw logs: `tests/survival/ui/evidence/v1-bb5011a-*.log` (12 files). Reproduction commands, capture paths, fixture limitations and platform details: `TEST_EVIDENCE_0addc5f.md` and `V1_WORKSPACE_CONTRACT.md`. Tests send synthetic arrow/accept actions and check focus on the two top tab rows and retry/refresh fallback; they do not prove every Tab/controller route or real device behavior. The UI consumes a GUI click before an `_unhandled_input` observer but does **not** gate polled build/combat input. UI/fixture tests cannot validate real recipes, transactions, beds, discovery, Gold VFX or persistence. Solid bright/dark backgrounds are not live-world screenshots. No human visual approval, production integration or PR claimed. `DOCS_SYNC_PENDING`.

**NEXT_ATOMIC_ACTION:** A0 supplies and verifies its real gameplay-input modal gate and native build/debit/combat/close regressions; A3/A1/A4 agree owner data and command contracts before any production wiring. Continue isolated usability, visual and source-coverage review as permitted; full original Atlas/trace takeover read and independent human review remain unproven. The latest exact-SHA results supersede the older check counts, not its safety caveats.
