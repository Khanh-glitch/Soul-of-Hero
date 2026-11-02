# S6 TOKEN-BUDGET RECOVERY — 2026-10-29 (coordinator override)
**Status:** user has started S6 on Astra Max; visible local log stops at ~1m40, after full Atlas and broad repo/document ingestion, with NO confirmed `BRIEF.md`/commit. Git task branch `feature/surv-s6-poi-depth-001` still at initial work-order commit `a818042d31afbc11f0abbf945e4b8bac92e6109b` at last check. Do not infer the agent is still running, and do not infer it failed; quota and worktree state are external. **S6 is USER-REPORTED STARTED, DELIVERABLE NOT VERIFIED.**

## Resource diagnosis
The previous Unit 1 prompt told a rare, fast-quota-consuming model to read the **entire 1,355-line Atlas** plus the generic **new-chat bootstrap** (designed for a coordinator taking over 6 agents), generic AGENTS/CT docs, other 8+ large research files, and a full repo clone before selecting one POI. The visible log shows repeated large source reads but NO artifact. This is **a task-design error by coordinator**, not evidence of incompetent S6 reasoning. General long-context bootstrap is **WAIVED for S6's narrow micro-stage**, except the exact relevant contract constraints summarized below. Source-specific read is required but only relevant excerpts, not all 1355 lines each session.

## Model policy
- Default **Astra Medium**; try Astra Low for simple retrieval/git/checkpoint writes; elevate to Astra High for one clearly scoped causal-graph design issue. **Do not start routine onboarding/repo reads on Astra Max.** Reserve Max for a very narrow logic/design counterexample with an explicit output and minimal input, if measured benefits justify its scarce quota.
- Model/effort switch alone **does not restore exhausted shared five-hour usage**. Check current Settings → Usage and actual reset timestamp. The prompt cannot promise a reset or work in background.
- S6 remains optional noncritical-path, no other agent awaits its POI.

## Minimal Unit 1 input contract
The agent already has exact branch work order, repo and source paths. Use no more than:
1. `docs/survival/tasks/SURV-POI-DEEP-001_S6_WORK_ORDER.md` (skim **the specific Unit 1/ownership** section once if existing session context insufficient).
2. `docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md` **ONLY** relevant POI-05 / POI-08/09/10, DEP-03/04/05/31 and JOURNEY-11/12 headings/excerpts. These anchors identify historically relevant mechanics, not exact copyable maps.
3. Existing `docs/survival/poi_deep_lab/BRIEF.md` if present, and local git status to avoid overwrites. Do NOT reread full project bootstrap, full Atlas, whole CT documents, clone the repo again or search broad GitHub unless a specific design question remains blocked.

Locked facts for this stage: Soul of Hero is top-down Godot 4.7 pixel fantasy; actual user wants historical 2019–2020 Last Day Rules depth, no false historic claims, keyed access ≠ independent power ≠ hazard protection, interesting alternate routes/partial raid, different immediate loot vs research specimen vs future access, exact source-faithful Gold VFX handled by separate A4; A1 continent and A3 economy proceed independently. S6 edits **only `docs/survival/poi_deep_lab/**`** on own `feature/surv-s6-poi-depth-001` branch and never creates an integration dependency.

## Immediate single useful output, then stop
Write `docs/survival/poi_deep_lab/BRIEF.md` containing at most ~700 words:
- Compare **up to three** Atlas-supported POI archetypes in a concise evidence table (version/source anchors, likely standout mechanism, integration risk).
- Pick ONE and justify why an exceptional multi-stage mystery is possible in top-down SOH rather than merely more combat or pretty art.
- State 3–5 hard constraints, clear original fact vs SOH adaptation, and one `NEXT_ATOMIC_ACTION` (e.g. 8–12 node mission graph with two routes).
Add concise `STATE.json` (unit=1; done/remaining; next atomic step; source anchors; verification status) and `LOG.md` (one checkpoint) **only if time permits**; priority is one meaningful durable BRIEF artifact. Commit/push if possible. If blocked by quota, keep partial output and exact resumption pointer. Don't invent CI/native implementation; `DESIGN_ONLY`.

## Example paste prompt to SAME S6 agent after reset
> CONTINUE EXISTING S6 UNIT 1. The coordinator has narrowed the task due to scarce token budget; DO NOT restart repo onboarding or re-read all 1,355 Atlas lines. Read only the relevant POI/DEP/JOURNEY source excerpts (or reuse them if already in this session), then compare up to 3 candidates and choose one. Create `docs/survival/poi_deep_lab/BRIEF.md` (<=700 words) with grounded source anchors, hard design constraints and NEXT_ATOMIC_ACTION; commit/push on `feature/surv-s6-poi-depth-001` if available. Optional short STATE/LOG files if quota remains. Do NOT attempt Unit 2, do not touch production files, do not rerun wide searches or clone. Finish an artifact before more exploration. Mark DESIGN_ONLY, NATIVE_NOT_TESTED.

## Reviews and release
A coordinator should examine actual BRIEF and source anchors, not use the agent's summary, then decide CONTINUE/REVISION on Unit 2. No need to delay A0/A1/A3/A4/A6. Parent issue #18 is a design packet; the pre-existing work-order branch is not edited here while another agent may have it checked out.
