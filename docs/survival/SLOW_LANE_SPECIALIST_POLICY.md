# SOH — Six physical AI slots (two already active) + nonblocking specialist policy
**2026-10-29 latest user correction. THIS OVERRIDES earlier A9 visual-lab/S6 drawing assumptions.**

## Confirmed staffing truth and current limitations

The user has approximately **6 AI total**. Already commissioned:
- **Slot 1 — A0 Integration & Construction/SURV-020:** the first agent, finished SURV-010 native scope, now doing SURV-020 in Draft PR #11. "A2" denotes construction responsibility; a second A2 agent is not confirmed.
- **Slot 2 — A4 GOLD VFX IMPORT/PORT:** a pre-existing, independently commissioned agent from **before** the survival-redevelopment plan. Its mandate is to import user-authored external/Cocos-side combat VFX into an actionable source-faithful in-game skill library *ahead of demand*, including exact original Gold effect behavior, enemy impacts, world/terrain FX and timing, native runtime and honest parity. **Do not replace or re-prompt its active work.** User reports it is running. Git snapshots `feature/gold-venom-arcana-factory-20261028` and `feature/gold-93-skill-readiness-20261028` contain Godot-focused code/CI at 2026-10-28 snapshots; current Cocos-side pipeline progress is **NOT independently verified**. No Git branch of the reported agent was identified beyond those snapshots.

**This leaves approximately FOUR physical AI slots.** Slots in the table are proposed allocation; don't mark new agents RUNNING until the user sends the prompt and/or they push actual results.

| Slot | Workstream | Staffing/prerequisites |
| --- | --- | --- |
| 1 | A0 Integration + Construction, SaveService & reviewed merge | **ACTIVE**; don't modify its in-flight PR #11 |
| 2 | A4 Pre-existing Gold library VFX source-parity port | **ACTIVE, USER REPORTED**; protected original Gold workstream |
| 3 | A1 World & Region/POI geography | READY; consistent throughput, owns complete continent masterplan |
| 4 | A3 Economy/Crafting/Research & **physical Core item/recipe economics** | READY; persistent knowledge, charges/recipe catalog; no duplicate VFX implementation |
| 5 | A6 Survival UI/HUD, pixel clarity & asset/source due diligence | READY; use independent UI paths; no A0 construction HUD overwrite |
| 6 | **S6 / A5-DEEP — POI dependency/encounter design R&D** | READY OPTIONAL; scarce powerful model, little output each quota window, never any critical path |

A5-DEEP is a **specialized occasional designer**, not a seventh agent. This slot replaces the earlier A9 'invent some visual masterpieces' proposal: the user rightly rejected ungrounded decorative busywork. Its task is based on a real coverage weakness in the original Atlas: **the deep internal design of one memorable multi-stage POI**, linking access cards, power sources, environmental risk, bosses, valuable loot, research knowledge and multiple travel paths. See Atlas POI-05/08/09/10, DEP-03/04/05/31 and JOURNEY-11/12; use one coherent facility without pretending to copy an exact 2019 map.

## Why A5-DEEP merits a superior reasoning model
A good multilayer POI isn't merely a map or artwork. It must reconcile world geography/architecture, card and circuit state, threat visibility, early discoveries, role-based tactical Skill Core interactions, economic tradeoffs, failure and retreat/reentry, persisted state, plausible history and 2D art/level readability. Its mission/lock graph must avoid softlocks and support non-linear player strategy; both runtime and balance remain other agents' domains. Research in graph-based dungeon dependencies (e.g. `amidos2006/GraphDungeonGenerator` mission graph/geometry separation; academic controllable lock/key graph design), but inspect real source and license before code reuse.

**Critical-path firewall:**
- A1 authors the entire continent, 21 POI archetypes and planned route/resource graph **independently** of A5-DEEP; A5 chooses one already-known archetype for an optional exemplar, not the world's entire POI architecture.
- A3 authors the economy/keys/craft recipe contracts; it doesn't wait for the exemplar.
- A4 Gold ports source skills; A5 cannot edit the port or redefine the skill catalog.
- A0 owns runtime scene/SaveService/POI integration. Do not block construction or future playable POI implementation waiting for A5.
- A6 handles general POI/UI look and feel without relying on A5's bespoke concept.
- If this slot stops indefinitely, the game still progresses and ships using ordinary POI content. **A5 deliverables are exceptional additive enhancements ONLY, never mandatory schema/engine gates.**

**Micro-work protocol for short token windows:** On each session choose ONE self-contained action, make a small durable commit, write last completed step/next atomic step/risks in `docs/survival/poi_deep_lab/STATE.json` and LOG.md. Do not promise background work. Never leave another agent waiting. Possible increments:
1. Select one meaningful original POI archetype and explicit constraints, source/date and why it matters.
2. Draw and validate 8–15 room/mission nodes and 2+ viable progression routes.
3. Encode credential + independent power + hazard state machine and softlock counterexamples.
4. Design combat telegraphs/terrain-Core affordances and boss route tradeoffs.
5. Specify loot/research rewards, farming/repair economy and persistent resets.
6. Art/room readability guidance, player journeys and tabletop adversarial checks.
7. Final stand-alone exemplar package and authoring handoff; only then possible adoption into production after A0/A1 approval.

**Directory ownership:** `docs/survival/poi_deep_lab/**`, `prototypes/survival/poi_deep_lab/**` only. No edits to production `game/**`, `data/survival/world/**`, existing Chapter-1 dungeon levels, A1/A3/A4/A6 branches, project.godot or shared docs state. It is intentionally isolated.

## Who handles the other original workstream labels?

A2 construction remains A0 duty while SURV-020. A5 broad POI runtime is not a separately staffed AI yet; future integration by A0/regular agents as needed. A7 Balance tests are A3's automated balance fixtures plus **independent review of actual code/test/visual outcomes by coordinating reviewer**; no self-approval. A8 source/license research is continuously required of every agent, with A6 coordinating art/UX provenance. Existing issues #14 Gold/Core, #16 QA and #17 research remain historical/backlog work packets, not mandates to launch extra AI; reconcile them via explicit issue updates.

### Exactly what is not being claimed
No prompts for the 4 open slots have been sent yet according to user. A4's Cocos/import pipeline state cannot be inferred from a Godot branch snapshot. No new A5-DEEP agent is automatically running because an issue/branch is created. A1/A3/A6 runtime features not completed just because their prompt was authored.
