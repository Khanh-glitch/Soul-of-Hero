# Agent entry point — Soul of Hero Survival RPG

**MANDATORY: Google Docs design archive** — read `docs/survival/GOOGLE_DOCS_AUDIT.md` and Google Doc tabs 1, 2, 03 (requirement IDs), 04 (live journal). The Docs source contains valuable specifics omitted from earlier Git summaries. Write back to Docs tab 04 as well as Git state/log after implementation, and verify both; if impossible mark `DOCS_SYNC_PENDING`.

This file is the handoff contract for any AI coding agent taking over this branch. **Do not rely on chat memory.** Read these source-controlled files IN ORDER before editing:

1. `docs/survival/START_HERE.md` — user intent, scope and truths.
2. `docs/survival/STATE.json` — current machine-readable status / precise next task.
3. `docs/survival/DECISIONS.md` — locked / proposed / rejected decisions.
4. `docs/survival/CONTRACTS.md` — runtime ownership, save and gameplay contracts.
5. `docs/survival/SOURCES.md` — pinned external code/source and license boundaries.
6. `docs/survival/ACCEPTANCE.md` — executable end-to-end target.
7. `docs/survival/WORKLOG.md` — chronological commits, outcomes and blockers.
8. `docs/survival/CHANGE_PROTOCOL.md` — update / takeover rules.
9. GitHub issue #9 — master mission and open acceptance.

**First command in a new agent session:** independently inspect the current local branch, its HEAD, `git status`, upstream, `git log -5`, current CI, changed files and open issue #9; reconcile against STATE.json before working. If no terminal is available, inspect branch/ref and files through connected GitHub tools. Do not assume an old SHA still denotes HEAD.

**Owner boundaries:** Work on `feature/survival-rpg-foundation-20261029` or a new explicitly owned task branch based on it. NEVER force-push, rebase or modify `main`, `arena/54306b59-soul-of-hero`, `feature/gold-93-skill-readiness-20261028` or another agent's branch. Never merge an outside codebase wholesale. Pull upstream changes only after impact review and tests.

**Non-negotiable gameplay:** Entire world masterplan designed upfront; initial ~1/4 region contains the existing 10 Chapter 1 dungeon exteriors; other regions have real content but open through meaningful danger, equipment, environment, routes and world-state. Preserve original Heroes, dungeon scenes, combat/VFX and the user's source-locked GOLD procedural effects. Offline survival loop: gather → build → loot → research → craft limited-use Skill Cores → explore further. Genuine freeform top-down 2D houses, collision, per-room fading roof, storage, farming, beds. No random texture salad, fake blocked gates, claims of Gold parity without evidence, or user approval every tiny implementation step.

**Correctness:** SOH SaveService is authoritative; transactions must be idempotent and migration-safe. No item duplication/loss on death, loading, transfer, crafting, research or container closing. Distinguish code present vs native tested vs human visually reviewed. No fabricated proof or "everything passed" claims based on validator-only tests.

**At every handoff:** Commit tested code and evidence, append WORKLOG.md, update STATE.json/task statuses and any changed DECISIONS.md, include exact new HEAD + tests/CI URLs + known failures + next concrete command. A future agent must be able to resume **without reading this conversation**.

**If interrupted mid-task:** Leave a concise WIP log with branch, uncommitted files, last known test, failing command and the very next action. Do not mark complete.

**NEW REQUIRED READING — historical gameplay atlas and 14-day depth/replay:** docs/survival/LAST_DAY_RULES_2019_2020_RESEARCH_ATLAS.md, Google Docs tab 05 t.dg7e10u8in6k, Decisions D021–D031 and ACCEPT-REPLAY-01..06. User explicitly delegated binary gate-based design approval, not indefinite waiting. Preserve 2019/2020 source epoch, exact source-locked Gold, and clear difference between design approval and working native gameplay.

## MANDATORY FULL-ATLAS TAKEOVER (2026-10-29, user-requested)
The original user research attachment has been archived **verbatim** as `docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md` (SHA-256 `b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157`, 148205 bytes, 1355 lines). **No need to ask the user to upload it again.** Read every section when starting task design, and inspect relevant entire source sections (not only excerpts), and use `SOURCE_COVERAGE_TRACE.json` to track all 44 subsystems, 21 POI archetypes, 31 dependencies, 12 journeys, 40 unknown facts, 28 references. Preserve original as read-only.
Read `SYSTEM_FUSION_BLUEPRINT.md`, `ATLAS_RECONCILIATION_AND_DECISIONS.md`, `MULTI_AGENT_EXECUTION.md`, and `ECONOMY_AND_14DAY_REPLAY_BALANCE.md` BEFORE modifying gameplay. Agent work scopes A0–A8 and CT-01–CT-12 are binding unless revised through a recorded gate. A0 is sole integration/state/save owner.
**Google Docs source of truth:** https://docs.google.com/document/d/1q8Vevy4qx_6AFyfJodmsWAhdSBBumtx31hxXnWPelqo/edit . Read tab 06 archived source, tab 07 full architecture/agent instructions, tab 03 user requirements and tab 04 LIVE worklog, as well as original tabs 1, 2, 05. Update Git and tab 04 after every verified implementation. If Docs access unavailable, use Git archive and record `DOCS_SYNC_PENDING`.
**Design/implementation distinction:** All research and system architecture are approved through gate; gameplay SURV-010 and later remain NOT STARTED as of this context snapshot. GitHub Actions handoff validator is NOT native gameplay acceptance.
**Systemic change rule:** A change must name every touched CT-* contract, which other agent owns the coupled side, item/world/skill/schema/UX/safety repercussions, migration, regression tests, and user-value effect. Reject one-off patches that make a button 'work' while other systems disagree.

## PERMANENT POLICY — Living Research and Repo Discovery (2026-10-29)
Research is **not a completed phase**, historical report, or a frozen list of repositories. All agents A0–A8 MUST independently and continuously discover, study, compare, and revisit relevant external codebases, gameplay implementations, graphics/asset kits, UI/UX patterns, technical articles and Godot 4.x engine documentation **throughout implementation, integration, testing, balancing, and optimization**. The initial atlas and current SOURCES.md are starting points, not the limits of available solutions.
At **every material subsystem/task decision**:
1. First inspect SOH's current code/assets and the current Atlas; establish requirements and CT interfaces.
2. Proactively search GitHub and other trustworthy technical sources for existing solutions **beyond** the repositories already listed. Search by feature and behavior (e.g. save atomicity, roof occlusion, tile building, loot graphs, research queues, streaming), not merely by game name. Verify source implementation rather than trusting README.
3. Compare `REUSE_DIRECT / PORT_ADAPT / REFERENCE_ONLY / BUILD_BESPOKE / REJECT` using Godot 4.7 & Web compatibility, engineering fit, actual implementation depth, maintenance, dependency weight, license separation for art/code and end-to-end integration cost. Fastest sustainable solution wins; not automatically "write all" or "clone all".
4. Record selected AND rejected candidates, exact URL/commit/license/evidence, reason and cross-system consequences in `docs/survival/RESEARCH_LOG.md`, with pointers to source contracts and task. New information may supersede earlier choices through F0–F5.
5. Re-research when a blocker, unexplained regression, performance/design limit or better available library changes the decision. Avoid repetitive searching when there is no real decision to improve; research must produce actionable evidence, not delay code.
6. Implement and verify. Record real benchmark/test/CI outcome. Update source ledger and live Google Docs tab 04; if Docs unavailable mark `DOCS_SYNC_PENDING`.
Passing a one-time research gate does not exempt any future agent from this protocol. **Knowledge evolves with the project.**

## Task-dispatch documentation rule — user-mandated (2026-10-29)
**At the moment an agent task is issued, before it finishes:** save the complete work order in `docs/survival/tasks/<TASK_ID>_WORK_ORDER.md`, record the assigned owner/task/dependencies/acceptance in `STATE.json`, append `WORKLOG.md`, and update Google Docs tab 04. A chat prompt alone does **not** count as a durable assignment. Keep user-reported active vs actual committed progress vs verified tests distinct. This rule applies to all A0–A8 and successor agents. If agent is already running when a documentation omission is discovered, correct Git and Docs WITHOUT overwriting its worktree and explicitly note it may not yet have seen the corrected doc. Verify Google Docs readback; otherwise mark DOCS_SYNC_PENDING.


## LIVE COORDINATION SOURCE OF TRUTH (2026-10-29)
At every agent handoff, agent start, PR review, independent native test or merge decision **read `docs/survival/CONTROL_TOWER_CURRENT.md` and current GitHub refs before relying on any chat prompt or older snapshot**. This file records real six-agent seats (A0+A4 already active), current exact code/CI status, boundaries, 1,355-line Atlas product intent, decision `CONTINUE/HOLD/REASSIGN/REPLACE`, required next command and cross-chat takeover route. Update it together with role work orders, review records and Google Docs tab04 when material changes occur. A report/green CI without code/test-oracle/native/source fidelity and a **next action** is not a complete coordination result. This is **not** automatic background monitoring or guaranteed chat memory. Do not modify another agent's active code branch just to keep the log current.


## First action in any new ChatGPT conversation or agent/coordinator takeover
**Open and execute `docs/survival/NEW_CHAT_BOOTSTRAP.md` BEFORE making new project status assertions, approving or dispatching a task.** It requires primary Atlas re-reading, live Git PR/CI/test code inspection, six actual AI owners, cross-system contract map, contradiction detection and **actionable next operational prompts**. Then refresh `docs/survival/CONTROL_TOWER_CURRENT.md` and Google Docs tabs 04/12 with evidence. Neither ChatGPT memory nor a stale timestamped summary is a reliable substitute for these durable sources. Never mark a worker active or a gameplay feature verified simply because a documentation branch/issue exists.


## Every Soul of Hero coordinator reply MUST end in an immediately usable handoff
User mandate (2026-10-29): at the end of **every substantive project-coordination response**, include one concise, copyable **Handoff** prompt for the same agent to resume or a new coordinator chat to take over if the session drops. Include the latest decision, evidence/uncertainty, precise next atomic work, agent ownership/dependencies, and Git live recovery links. This is **in addition to** (not a substitute for) source-to-code reviews and durable Git/Google Docs updates. Rules and template: `docs/survival/EVERY_REPLY_HANDOFF_PROTOCOL.md`. Never rely on chat internal memory, never invent progress, and never drown the user in a repeated full project history for each handoff.

## SELF-SUFFICIENT CHAT REENTRY POLICY (user correction 2026-10-29)
A short `HEAD / verdict / next task` capsule is **NOT** a standalone new-chat handoff. Every new coordinator conversation must first read `docs/survival/NEW_CHAT_BOOTSTRAP.md` in full, then `docs/survival/CHAT_REENTRY_HANDOFF_CURRENT.md`, `docs/survival/CONTROL_TOWER_CURRENT.md` and the actual Atlas, decisions, Blueprint, acceptance and Google Docs according to the bootstrap order, and independently re-fetch live PR/CI source. It must produce a verified restoration ledger **before** any new approval/merge/task dispatch. A resumed agent with scarce quota uses only relevant source excerpts and its own verified branch/work order, but does not assume the old conversation survived. Use the detailed modes/mandatory fields in `docs/survival/EVERY_REPLY_HANDOFF_PROTOCOL.md`. The user will not have to repeat lost context simply because a handoff was too vague.
