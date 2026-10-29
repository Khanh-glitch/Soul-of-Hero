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
