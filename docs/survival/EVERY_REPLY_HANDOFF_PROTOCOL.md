# Soul of Hero — Mandatory Handoff at the End of Every Coordinator Response
**User directive, 2026-10-29. This is the default for every substantive Soul of Hero coordination reply**, including independent audit, task assignment, progress review, branch / PR conflict, agent replacement, tooling blocker and acceptance result.

## Why
Chats and AI sessions can crash, run out of tokens or be replaced. A review that only says PASS/FAIL without actionable next steps or a durable handoff breaks continuity. ChatGPT internal memory and a local unfinished agent worktree are not reliable persistence. GitHub + Google Docs are the durable evidence layer, and each *reply's* final section is an immediately copyable handoff capsule.

## Required final section in every substantial coordinator reply
Use **`Handoff — paste into the next chat/agent session`** as the final artifact, preferably a single copyable prompt/writing block. Keep it concise but informative, with real changes for the present checkpoint (do not repeat a giant generic Atlas bootstrap each time):
1. **Role/mission/owner:** identify whether this is the coordinator handoff (new chat) or one existing agent to resume. Distinguish the two; never silently assign another agent's task.
2. **Verified progress:** exact branch/PR, SHA/run and links when independently verified; mark USER_REPORTED or NOT_VERIFIED for inaccessible local work. A docs-only commit is not gameplay progress.
3. **Decision:** CONTINUE / CONTINUE_WITH_CORRECTION / HOLD_INTEGRATION / REASSIGN / REPLACE, with a one-sentence reason. If the turn is informational/no operational change, state "no new decision; preserve prior verdict".
4. **Next atomic action:** one actionable first step plus conditions to advance, specific source/tests/visuals; who must perform it and who must wait, if anyone. Add a short executable follow-through instruction rather than only a summary.
5. **Cross-agent boundaries:** only the relevant other agent dependencies and blocked integration interfaces; existing A0/A4 branches and 6-total staffing preserved.
6. **Recovery refs:** `docs/survival/NEW_CHAT_BOOTSTRAP.md`, `docs/survival/CONTROL_TOWER_CURRENT.md`, relevant work order/review, live PR. New chat must refresh current refs and source rather than blindly trusting this timestamped capsule.
7. **Unknowns / risk / unfinished:** don't claim missing logs, images, source parity, agent push, or Git/Docs sync as complete.

### Two recommended prompt modes
**Agent-resume mode:** "Continue your EXISTING [AGENT] session on [branch]; do not restart. Verify live refs. At [SHA] [scoped finding]. Decision is [...]. Next concrete work is [...]. Preserve ongoing owner boundaries. Deliver exact code/tests/evidence and update docs."
**Coordinator-new-chat mode:** "Take over Soul of Hero as the six-agent Control Tower, not a seventh developer. Read NEW_CHAT_BOOTSTRAP and CONTROL_TOWER; compare latest PRs, Atlas, work orders, original Gold and exact evidence. Last checkpoint: [...]. Next priority: [...]. Do not assume existing agent sessions automatically receive comments. Report restored state, contradictions and next operational commands, then update durable docs."

A single reply can include **one compact handoff** by default; use separate agent and coordinator handoffs only when a real operational need warrants both. Avoid flooding the user with repeated multi-page prompts. If the request is trivial or not part of Soul of Hero operations, do not force an irrelevant huge handoff.

## Ongoing records and update behavior
- After any material evidence/decision/assignment: update `docs/survival/CONTROL_TOWER_CURRENT.md` + task review/work order, GitHub PR/Issue and Google Docs tab04, verifying readback. When docs access is unavailable write `DOCS_SYNC_PENDING` with the exact text needed.
- At the **end of every reply**, include the paste-ready handoff even if only a minor update occurred, with no invented Git commits or false progress claims.
- Avoid a new repo commit on every trivial chat message unless the underlying coordination state changed; handoff prompt is the immediate continuity mechanism, Git/Docs records are the permanent evidence.
- In a resumed chat, actually open current sources and resolve contradictions; **do not claim full restoration from the handoff prompt alone**.

## Snapshot when this policy was created
Latest reviewed agent: **A6**, USER_REPORTED_ACTIVE with a local-only unpushed Godot journal/satchel work increment `0bf9151d1346aaddb127bf8e7a7882fe9bf0e568`; no remotely accessible patch/PR/native log was available to independently verify. User-reported 21 headless + 23 native fixture checks at 3 resolutions. Decision `CONTINUE_WITH_CORRECTION`, preserve ordered two-commit patch first; keep developing isolated UI, do not wire to production until **A0** installs explicit modal input gating for `Input.is_action_just_pressed("build_place")` and tests no accidental paid placement. A0 SURV-020 Draft PR #11 remains WIP, active Gold/VFX A4 is separate; A1/A3/S6 operate on independent paths. See `docs/survival/reviews/A6_UX_LOCAL_CHECKPOINT_0bf9151d_COORDINATION.md`. Snapshot is not a live status guarantee.
