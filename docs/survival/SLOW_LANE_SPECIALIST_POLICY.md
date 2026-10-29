# SOH — Scarce High-Reasoning Model: Nonblocking Slow Lane / A9
Date: 2026-10-29. **DESIGN ASSIGNMENT ONLY — no A9 agent session has been launched.**

## Owner distinction: A0 is fixed, A2 is a responsibility, not confirmed another active agent
The **first already commissioned real agent is A0 (Integration Architect)**. It executed verified SURV-010 and is actively continuing SURV-020 on Draft PR #11 (`arena/54306b59-soul-of-hero`). SURV-020 includes A2 construction responsibilities, but **do not infer that a separate A2 agent exists or has been assigned**. Never reassign, reset, duplicate, or overwrite its task because of this routing correction.

## Correct interpretation of 'long term'
User has access to an unusually capable model that **runs out of available tokens quickly**. It may produce one tiny increment or stop in the middle of a large one, requiring manual re-prompt after quota resets. 'Long-term' means **low total workload, tiny intermittent units spread over a long calendar time** — NOT a big mission that the model works on continuously; NOT an agent that all project progress follows; NOT a model assigned a huge critical-path system.

All three hard requirements:
1. The work must genuinely benefit from exceptional visual/conceptual/technical judgment instead of routine coding.
2. Progress can be arbitrarily slow or interrupted after any increment **without blocking any other developer, contract, merge, runtime path, build gate or release milestone**.
3. Work is low total volume and modular: one exquisite isolated piece/research problem per mini-assignment, with a **crash-safe checkpoint** that another agent could adopt or disregard. No expectations of background/asynchronous work.

## Decision: A9 Masterpiece Visual R&D — optional excellence lane
**APPROVED DESIGN, NOT STAFFED; not an essential prerequisite.** Best-fit work is individual high-difficulty, unusually high-value art-direction/technical visual R&D commissions for Soul of Hero **without touching Gold source parity or production architecture**. Examples:
- A single landmark-quality top-down pixel-art environment/POI architecture study (such as an abandoned snowfield observatory or uniquely evocative flooded shrine), with original/pixel-native geometry, mood, composition, readable player silhouettes and world-storytelling.
- One high-quality modular micro-kit study or unusual environmental transition that could be adopted by A1/A6 as independent polish.
- A targeted, self-contained analysis/visual implementation of one difficult pixel-art readability problem with objective 1280×720 / nearest-neighbor 2K/4K comparative screenshots.
Choose **one** mini-assignment at a time; the original user wants striking visual identity and fidelity, not generic placeholder tiles or 'more of the same'.

### Isolation contract
- Own only `prototypes/survival/a9_visual_lab/<commission_id>/**`, `docs/survival/a9_visual_lab/**`, and optionally isolated tests under that same prototype directory. No modification of `game/**`, `data/survival/world/**`, `assets/**`, `project.godot`, `AGENTS.md`, `STATE.json`, SaveService, Gold VFX or A0/A1/A2/A3/A4/A6 branches.
- A9's output is an **optional, sidecar package**. A1/A6 may inspect it at any time; only integrate via a later independent licensing/visual/gameplay gate if/when finished. **World planning, economy, Core contract, UI integration, POI, QA and SURV-020 must progress without any A9 artifact**.
- No speculative future promise ("wait until A9 produces art") in mandatory acceptance. All gameplay has existing or bespoke baseline assets and can ship without A9's luxury contribution. If A9 is never resumed, the project loses only optional visual excellence.
- Any art/code must be original or have separately vetted code/art licenses; never redraw the locked Gold VFX and claim original parity.

### Minimal checkpoint protocol for short quota windows
Every mini-assignment has `BRIEF.md` (one small, tractable goal; existing scene/asset reference; desired player-facing difference; source/licenses), `STATE.json` (commission, exact last completed step, next atomic step, paths, validation, blockers), `LOG.md` (append-only outcomes), and isolated output assets/scripts. On token exhaustion or interrupted work:
1. Commit the useful partial artifact or clearly mark non-functional draft; never claim a pass without tests/images.
2. Record next **single small action** and exact inputs in STATE/LOG.
3. A later session reads those files and resumes; it does not repeat background research or need the project owner to re-explain.
4. No agent or release depends on its due date. Integrator can adopt only complete verified commissions.

### Fit comparison (corrected)
- **A1 World**: high reasoning, but **on the foundational critical path** for geography/POI/resources; assign capable model with sufficient uninterrupted throughput, not scarce slow specialist.
- **A4 Gold/Core**: very high source-fidelity reasoning, but Core contract and minimum native integration are required by downstream systems. Do not assign its *whole task* to scarce slow specialist; separate optional polished subtasks only after baseline A4 is independently staffed.
- **A7 Balance/QA**: analytically deep but continuous verification stream, not a once-a-month small micro-project; must start and keep pace with integration.
- **A9 visual micro-commission**: high difficulty, can be done in intermittent tiny units, completely nonblocking, optional, ideal for scarce exceptional model.

## Current dispatch reality
A1, A3, A4, A6, A7, A8 work orders and issue #12–#17 are READY but **the user stated none of these prompts were yet sent**. Do not mark them running merely because branches/issues exist. A0 is the active previously assigned agent. A9 remains planned only, with no task branch, issue or running process until user elects to allocate the model.
