# Cross-chat, cross-agent and crash recovery protocol

## One reliable source of truth

**Git commits + this branch's docs + issue #9**, NOT the AI's internal memory. All session claims are reconstructable from code, git SHA and test reports. Store only project decisions/technical state; NEVER store passwords, private tokens, personal secrets or customer data in repository.

## Takeover in any conversation

1. Open https://github.com/Khanh-glitch/Soul-of-Hero/tree/feature/survival-rpg-foundation-20261029 and issue https://github.com/Khanh-glitch/Soul-of-Hero/issues/9.
2. Check current GitHub branch HEAD, CI and working tree first; inspect diff since last verified log entry.
3. Read `AGENTS.md` and the eight `docs/survival/` files in the order given there. Read actual code at the task seam, not only the summaries.
4. Cross-check `STATE.json` against GitHub commits/CI. If stale, update with real findings before implementing.
5. Claim **one task ownership** in issue comment or own named branch; multiple agents must not modify the same integration paths concurrently.
6. Implement, run native and headless tests, obtain screenshot evidence where visual, commit to *owned* branch, update state/log. No auto-merge or force push.
7. When updating integration branch, keep fast-forward with `expected_sha`/lease and verify resulting HEAD. If another agent advanced it, inspect and integrate safely.
8. End each session with: current HEAD, changes, verified tests, blockers, next task (file/command/path) and link to CI artifact.

## Status semantics

`not_started` = no implementation; `in_progress` = work started but not verified; `blocked` = cannot execute due explicit dependency; `implemented_unverified` = code exists, lacking required runtime tests; `verified` = exact evidence attached to source SHA. Research and design docs do NOT count as gameplay implementation.

## Agent session log format (append-only in WORKLOG.md)

- UTC timestamp + agent/task ID
- Branch, base SHA, final SHA
- Changed paths + code behavior (not adjectives)
- Commands/tests + exact outcomes/CI URLs
- User-visible screenshots/artifact URLs
- Known failures, data migrations and licenses
- Next one runnable task, precise entrypoint
- Explicitly classify any uncommitted changes

## New chat bootstrap message

"Continue Soul of Hero Survival RPG from GitHub branch `feature/survival-rpg-foundation-20261029`, issue #9. Read AGENTS.md, docs/survival/START_HERE.md, STATE.json, DECISIONS.md, CONTRACTS.md, SOURCES.md, ACCEPTANCE.md, WORKLOG.md and CHANGE_PROTOCOL.md. Verify current branch HEAD, diff and CI. Continue the next executable task; commit tested results and update the handoff files. Do not overwrite other branches or fake Gold/native readiness."

Use this paragraph verbatim when switching agent or starting new chat if the new agent cannot see the project conversation.

## When agents disagree

Record observable evidence and open a short issue comment referencing the exact code/commit. Prefer native gameplay observation and reproducible tests over another agent's assertion. Do not silently erase previous failed tests or decisions.
