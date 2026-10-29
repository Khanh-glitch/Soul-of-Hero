# Agent entry point — Soul of Hero Survival RPG

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
