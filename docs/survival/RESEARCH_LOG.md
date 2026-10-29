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

### 2026-10-29 — A0/A2 / SURV-020 / CT-02, CT-03, CT-07, CT-11 (in progress)
**Question:** What can safely support arbitrary player-built rooms and their roof visibility without replacing SOH's save, collision or Hero lifecycle?

**SOH inspection:** Existing pieces occupy entire 16px cells; furniture cannot currently share a cell with foundations. `SurvivalBuildSystem` materializes terrain-layer physics bodies and `SaveService.transact_once` commits inventory and survival state together. `Knight.respawn()` uses `GameSession.checkpoint`; dungeon checkpoints use the same lifecycle. Neither a topology/roof system nor bed integration exists at the verified A0 commit. Naively restoring an overworld bed checkpoint in a dungeon would be unsafe. Demolition previously erased nonempty containers, and repeated identical chest sweeps reused a permanent receipt.

**Search:** GitHub repository search `godot flood-fill`, `godot tilemap building`, plus previously identified Life After Death. Inspected source, not just README:
- [Life After Death](https://github.com/rumiazhari/life-after-death) commit `08dd648397305271345c4b25eab3d75d5e015cc9`: `scripts/world/room.gd` uses authored rectangular Area2D rooms and explicit door associations; `scripts/voxel/voxel_roof_occlusion_controller_3d.gd` uses a Node3D actor and stored building bounds, hides whole buildings. No clear code/art license in API. **REFERENCE_ONLY**: informative portal association but neither arbitrary derived 2D rooms nor independently cleared reuse; not imported. Web suitability not established.
- [godot_flood_fill](https://github.com/maidopi-usagi/godot_flood_fill) commit `00a1902e96acb0b270909d8fec2e28cac6ebf44e`, MIT: `jfa_impl/JumpFlooding.cs` and `flood_fill.glsl` implement image-oriented C# GPU compute. **REJECT** for room topology: image rather than authoritative wall graph, .NET/compute dependencies incompatible with this project's compatibility/Web target without further work. No external code/art copied.
- **BUILD_BESPOKE** is the tentative topology/roof direction, but not yet an approved or tested implementation. An initial local draft scanned a bounding rectangle spanning distant structures and could become unbounded; it was not connected to the game or included in the branch. Design must handle splits, merges, diagonal seals, shared boundaries, independently fading roofs and spatially bounded invalidation before integration.

**Storage decision:** keep `SaveService` as sole inventory authority; reject demolition of a nonempty container within the same transaction; distinguish legitimate repeat sweeps with a persistent monotonically increasing counter and receipt check. Scope does not add a second inventory, change outer schema or touch Gold. Native foundation test: [run 40849106485](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40849106485) at `77c639331d8d4b0c472e86e7538275e6778aa697` passed 132 checks, exit 0. Godot 4.7 Web compatibility of shelter remains unverified.

**Revisit:** investigate source/engine navigation and player physics when integrating doors, and re-evaluate the local topology approach once tested on complex layouts and large, separated bases.

### 2026-10-29 — A0 / SURV-020 / CT-07 & CT-11 follow-up

**Question:** How should dynamic player-owned walls/doors update collision and navigation safely in Godot 4.7 without a second physics authority? SOH currently projects each wall into `SurvivalBuildSystem._materialize` as a StaticBody2D; `Knight.respawn` uses `GameSession.checkpoint`, including dungeons. We must avoid changing that checkpoint to an overworld coordinate when inside a dungeon.

**Inspected primary source:** Godot 4.7-stable tag object `5b4e0cb0fd279832bbdd69fed5354d4e5ad26f88`, [`doc/classes/CollisionShape2D.xml`](https://github.com/godotengine/godot/blob/4.7-stable/doc/classes/CollisionShape2D.xml) says `disabled` should be changed with `Object.set_deferred`; [`doc/classes/NavigationObstacle2D.xml`](https://github.com/godotengine/godot/blob/4.7-stable/doc/classes/NavigationObstacle2D.xml) distinguishes obstacle avoidance from baked navigation meshes. These are engine API documentation (Godot documentation licensing), not imported code/art. Do not mistake avoidance-only obstacles for an updated baked path. **REUSE_DIRECT** existing SOH StaticBody2D ownership; **BUILD_BESPOKE** bounded room topology on SOH's authoritative records; no external library is adopted. Dynamic collision, navigation and bed location remain unimplemented and need native tests.

**Native result:** [40862246794](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40862246794) at `4afe3d94cea92be9cc2355f3fb8362ab358907f4` passed foundation 132 and topology 50 checks. Disconnected houses 5,000 cells apart scanned 66 cells; breaching one rescanned 34 with the other cluster cached. This is a spatial debug measurement, not a benchmark under thousands of concurrent bases or a roof screenshot. Revisit on dynamic door/pathfinding, large-base or performance failures. No Google Docs sync for this checkpoint.
