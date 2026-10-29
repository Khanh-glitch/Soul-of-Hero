# SOUL OF HERO — S6 / A5-DEEP
## SURV-POI-DEEP-001 — One Exceptional, Systemically Connected POI
**Issue #18: https://github.com/Khanh-glitch/Soul-of-Hero/issues/18**
**Independent branch:** `feature/surv-s6-poi-depth-001`
**Status: READY_TO_START, NOT ACTIVE.** The user has not yet assigned this agent. This is slot 6 of a total ~6; A0 Integration and independent Gold-import A4 are already active. No more bots are implied.

## 0. Why you specifically?
You are an unusually strong reasoning model with a **very limited token allowance per session**. We give you a small amount of genuinely demanding design work, performed occasionally, rather than a huge project requiring daily throughput. You should deliver **one small, high-quality checkpoint per token window**, then preserve exact durable continuation instructions and stop. Your work must be irreplaceable by a routine high-volume content generator: multi-layer causal design with unexpected but readable choices and deep world/economy/skill integration.

You are NOT assigned to plan the entire continent (A1), port Gold VFX (pre-existing A4), build Economy (A3), perform runtime integration (A0) or design all HUD (A6). You are NOT inventing a decorative sidequest to justify a powerful model. The original Atlas identifies real difficult gameplay: POI-05 Abandoned Institute, POI-08 2019-era Nuclear Plant, POI-09 Bunker, POI-10 Biochemical Laboratory; DEP-03 layered keycard, DEP-04 credential vs power, DEP-05 hazard vs protection, DEP-31 boss → access card → specimen → research; JOURNEY-11 and 12 rewards that affect future playing options. A flat dungeon with boss + chest would violate source intent.

## 1. Source and engine context you must actually read
Repository: https://github.com/Khanh-glitch/Soul-of-Hero
Read `AGENTS.md`, `docs/survival/START_HERE.md`, `docs/survival/DECISIONS.md`, `docs/survival/SYSTEM_FUSION_BLUEPRINT.md`, `docs/survival/INDEPENDENT_DEEP_REVIEW_PROTOCOL.md`, `docs/survival/SOURCE_COVERAGE_TRACE.json`, `docs/survival/MULTI_AGENT_EXECUTION.md`, and complete original `docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md` (SHA256 `b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157`). Read relevant source sections in full and ensure 2019–2020 mode facts are distinguished from later 2021–2026 examples and proposed SOH adaptations.

Inspect actual existing Soul of Hero dungeon/POI chapter designs, available tile/art kit, camera/hero movement, native scene and Gold skill constraints *read-only* so the proposed POI would actually be authorable in top-down pixel gameplay.

Research live sources throughout the assignment; e.g. mission graphs & spatial layout separation in https://github.com/amidos2006/GraphDungeonGenerator and controllable lock-key structures in https://researchportal.bath.ac.uk/en/publications/graph-based-generation-of-action-adventure-dungeon-levels-using-a/ . These are **ideas/research references**, not vetted drop-in Godot 4.7 modules or permission to copy sprites; verify license/source before reuse. New better sources may replace them.

## 2. Single optional commission: one layered POI, never critical-path

Select ONE meaningful POI archetype (suggestion: abandoned research complex with contaminated arcane power plant; choice must be grounded in source/atlas and SOH world context). Design its interior progression, 2D space and economic implications in extraordinary detail, but **do not commit a required location, region shape, item ID or skill ID that another agent must wait for**. Use parametric interfaces referencing A1's future region/POI anchors, A3's item/recipe IDs, A4's skill IDs, and A0's world/save/circuit APIs.

Player decisions must have genuine consequences:
- Multiple approach routes and cues that tell a story, at least one safe partial raid and a higher-risk deep route.
- Lock/key access tiers and an **independent** powered circuit: possession of key ≠ sufficient electric power.
- Real hazards with preparation/retreat/alternative strategy; readable top-down 2D warnings.
- Revisitable vs one-time loot with separate supply value, rare specimen, permanent knowledge and world access rewards; no fake infinite stock.
- Enemy/boss encounter uses different tactics and, where optional, Core × terrain response rather than a generic giant HP pool.
- More than one credible goal/motivation after first departure, with connections to surrounding economy and long-term replay.
- The space must be navigable on a top-down camera, no opaque room entrances, no untelegraphed lethal traps or inevitable softlocks.

## 3. Tiny, explicitly resumable work increments — DO ONLY ONE AT A TIME
**Unit 1:** Choose & justify one atlas-derived POI, design constraints and 2019 source provenance; compare alternative archetypes; make `BRIEF.md`.
**Unit 2:** Draft a compact mission graph with ~8–15 semantic nodes (approach, hub, branch, partial loot, circuit, key, hazard, boss, research sample, optional exit); prove at least two viable journeys; write `MISSION_GRAPH.json`.
**Unit 3:** Describe power/key/hazard state machine and player error/retreat recovery; add small explicit reachability/softlock validator or exhaustive table of state constraints.
**Unit 4:** Specify encounter placement, telegraphs, environmental affordances and Core optional utility; preserve original Gold behavior by referencing verified catalog IDs only.
**Unit 5:** Design rewards + economic provenance with 3 categories (immediate consumables, recipe knowledge/specimen, future world access) and progression not forced into a linear boss ladder.
**Unit 6:** Author one tile/camera-scale room brief, landmark silhouette and optional top-down spatial sketch with real existing art constraints; pixel readable at native and 2K/4K integer scaling.
**Unit 7:** Run a tabletop multi-route test: unprepared novice, careful explorer, optimizer, interrupted power, death/reentry, card depleted; document concrete fail states and redesign.
**Unit 8:** Package the finished optional reference as a clear `POI_EXEMPLAR.md` + machine-readable contract/test; offer to A1/A0 for consideration. Not a compulsory merge/release gate.

Each session can finish just one atomic step. **The user may have to manually resume you after token reset.** Do not promise or imply you work while absent. When interrupted, commit the last *useful* checkpoint even if the big mission is unfinished and record an exact next smallest action.

## 4. Hard nonblocking file/branch firewall
Edit **ONLY** `docs/survival/poi_deep_lab/**` and `prototypes/survival/poi_deep_lab/**` and the work order on your own branch. Never edit production `game/**`, `data/survival/world/**`, dungeon scenes, SaveService, current Gold files, `project.godot`, other agents' branches, shared STATE.json or WORKLOG.md. Your POI is optional excellence content that A1 can ignore without losing geography and A0 can ignore without blocking a fully playable POI baseline.

Keep:
- `docs/survival/poi_deep_lab/BRIEF.md` — one concise present problem and exact source anchors.
- `docs/survival/poi_deep_lab/STATE.json` — current micro-stage, last commit, next smallest action, known blockers.
- `docs/survival/poi_deep_lab/LOG.md` — append-only completed experiments and evidence.
- `docs/survival/poi_deep_lab/` additional data/diagrams/tests only as you actually create them.

At every checkpoint commit and push your own branch, preserve partial artifacts with **DRAFT** status if unvalidated, and update issue #18. Google Docs tab 04 if connected, else record `DOCS_SYNC_PENDING`. If a future version is never completed, the game still proceeds without penalty.

## 5. Deep acceptance rather than superficial success
Explicitly evaluate source fidelity vs inferred SOH invention; mission graph reachability and alternate routes; power/credential independence; softlock/respawn/death recovery; reward and crafting value; semantic 2D camera readability; replay incentives. If there is no actual native implementation, state **DESIGN_ONLY / NATIVE_NOT_TESTED**; don't call it a finished in-game POI. Reviewer must inspect real graph/data and attempt independent counterexamples before recommending adoption.

**START with Unit 1 ONLY**. Produce a small but exceptional checkpoint. Do not overrun your context attempting to complete eight units in one session.
