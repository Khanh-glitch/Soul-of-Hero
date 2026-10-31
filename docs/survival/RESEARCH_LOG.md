# Living research and external repository decision log

**Status: PERMANENT, APPEND-ONLY.** The 2019–2020 historical source Atlas is foundational; this document records continuing engineering/gameplay research for Soul of Hero. Existing repositories are examples, NOT an exhaustive or permanently approved list. Read [AGENTS.md](../../AGENTS.md), [SOURCES.md](SOURCES.md) and [MULTI_AGENT_EXECUTION.md](MULTI_AGENT_EXECUTION.md).

## Mandatory per-feature research and adoption protocol

For any material task, A0–A8 must inspect existing SOH functionality, search relevant external work proactively, and choose **REUSE_DIRECT / PORT_ADAPT / REFERENCE_ONLY / BUILD_BESPOKE / REJECT** with evidence. Reevaluate a prior choice when CI failures, integration overhead, new source candidates, gameplay limitations or engine changes warrant it. Do not search mechanically for trivial file edits where there is no architectural decision; don't use research as a substitute for implementing the approved plan.

Each research entry must contain:
- UTC date, agent, task/CT-* IDs and user goal.
- Search directions/terms and where searched (GitHub, Godot docs, gameplay case study, sample repo, art library).
- Candidates actually inspected with URL, exact branch/SHA/tag, relevant file paths, LICENSE (code and art separately), dependencies and Godot/Web compatibility.
- Behavior verified in source and any reproducible tests; separate documentation claims from code-level checks.
- Comparison of alternatives: functionality, integration effort/dependencies, maintenance/security, performance, source/copyright compatibility, original-game fidelity and SOH's top-down differentiation.
- **Explicit decision** `REUSE_DIRECT / PORT_ADAPT / REFERENCE_ONLY / BUILD_BESPOKE / REJECT`, with justification and downstream contract/interface effects.
- Next action, test/CI evidence, conditions that trigger re-search and links to relevant Git PR/issues.
- Final outcome after adoption, including fail and rollback if relevant.

Design autonomy F0–F5 applies. Never copy unauthorized proprietary code/art. The fastest correct approach is not necessarily the most code reused.

## 2026-10-29 — Baseline candidates (historical snapshot, NOT the only repos to inspect)
| Repo | Current direction from prior audit | Status |
| --- | --- | --- |
| https://github.com/furmonenko/the-fog | Selected crafting/research/loot source algorithms; art separately restricted | PRIOR_AUDIT; verify exact source/version when adoption |
| https://github.com/openclawaimac/godot-survival-core-lite | Gathering, survival and recipe model reference/adaptation | PRIOR_AUDIT |
| https://github.com/ppeck1/coheronia | Spatial/block placement ideas; side-view renderer not drop-in | PRIOR_AUDIT |
| https://github.com/peter-kish/gloot | Possible inventory UI adapter, not authoritative state | PRIOR_AUDIT |
| https://github.com/elliotfontaine/untitled-farming-sim | Farming ideas, older Godot compatibility requires tests | PRIOR_AUDIT |

**No new repository discovery is claimed in this entry.** Next agent should log newly found sources or a newly validated candidate when executing each actual feature task.

## Template for the next real entry

### YYYY-MM-DD — A# / TASK / CT-XX
**Question:**  
**SOH current behavior:**  
**Searches and verified candidates:**  
**Code/art license and import risk:**  
**Bench/test evidence:**  
**Decision:**  
**Cross-system API/save/Gold/world effects:**  
**Next action and reconsideration trigger:**  

## 2026-10-30 — A1 placement/hash seam research

- **REUSE_DIRECT:** existing SOH `OverworldWorld`, connector annex, real Knight 12×16 body, `PhysicsShapeQueryParameters2D`, `CharacterBody2D.test_move`, and ordinary movement actions. These match the production shape better than a new abstract actor; fixture still not production.
- **BUILD_BESPOKE:** small A1-only compiler for existing-cell BFS with conservative three-row clearance and zero-hazard ordinary paths, plus merged source `walk=0` collision rectangles. Required because A8 fixture pixels and local-slice routes are not canonical world sockets.
- **REJECT:** importing another navigation/world library, authoring a second six-territory model, treating A8 fixture coordinates as world cells, or equating payload-subset and whole-file hashes. No third-party code/art imported; approved atlas and licenses unchanged.
