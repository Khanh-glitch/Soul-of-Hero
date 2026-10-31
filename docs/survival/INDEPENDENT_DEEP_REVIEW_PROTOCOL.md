# SOUL OF HERO — Independent Deep Review & Quality Gates (2026-10-29)

**Binding cross-agent review protocol. Design and implementation approval are not the same.** Applies retroactively as a *review requirement* to SURV-010/020 and prospectively to every A1–A8 delivery. Nothing here alone invalidates a previously documented native test; nor can CI success alone certify product quality.

## 0. What changed / why
User explicitly warns against **thin gates** and a reviewer who simply reads the agent's report, checks its green CI badge and approves. The reviewer must read the *actual source code and patch*, compare with the entire user research Atlas and established SOH architecture, inspect engine behavior, independently attempt to falsify the claim, and determine whether correct technical behavior also creates the intended survival RPG experience.

For SURV-010: scope-level native PASS at d3885226, 125 checks/12 cases on production chapter1_overworld.tscn remains historical evidence, but full construction/interiors, balance, gold skill loops and human experience have NOT been demonstrated. Read actual `game/survival/survival_service.gd`, `survival_build_system.gd`, `survival_state.gd`, `tests/survival_foundation_test.gd` and the relevant SaveService semantics; ask whether the tests exercise expected behavior through player-visible actions or shortcuts. New regressions and missing cases require *new* gates; do not retroactively claim 125 checks prove roof/crafting/balance.

## 1. Six-layer review, with independent written findings

### R0 — Primary-source intent, not paraphrased agent claims
- Reopen the **actual archived 1,355-line user Atlas** at relevant SYS/POI/DEP/JOURNEY headings; check original version/mode (2019–2020 vs later extension), detail and exceptions. Recheck `SOURCE_COVERAGE_TRACE.json` owner and disposition and `DECISIONS.md` LOCKED_USER.
- For every claimed feature map requirement-ID → source section → code path → user action → persistence/side effects → test → visual evidence. Missing mapping = **NOT VERIFIED**, never handwaved.
- For a substantial/new subsystem re-read complete source/architecture context, not just cached summary. Source conflict is marked, researched and resolved with explicit gate decision.

### R1 — Patch and dependency forensics
- Read the actual PR commits/diff and affected **entire methods**, not only descriptions. Compare before/after, search all callers, autoload wiring, code reuse, error handling, data IDs, license/source and migration boundaries. Check API type fidelity in Godot GDScript and any typed Array/Dictionary API interactions.
- Review CT-01..CT-12 cross-system effects: world ecology, recipe and item authority, build geometry/nav, Hero/Gold, UI interactions, existing chapter dungeon entrances, save migrations, regression/upgrade behavior and multi-agent ownership. Verify no hidden duplicated subsystem or side effects from a one-off patch.

### R2 — Test oracle scrutiny (independent)
- Read **test source**, not just test summary. Determine whether assertions are vacuous, use injected final state, skip the player input path, depend on test order/seed, or only check structure/count. Search for stale `last_result`, type-coercion mistakes, hardcoded expected constants copied from implementation, false-positive legacy fixtures.
- Negative tests, boundary states, crash/restart between debit and output, full inventories, invalid placement, world-state reload, seed changes, old save migrations, movement/physics, cancellation and duplicate transaction IDs are required when relevant.
- Add or request **independent adversarial test(s)** that try to disprove the claimed result using new fixtures, alternate seeds, deliberate repeated input and state mutation. Do not accept only tests authored by the implementing agent.

### R3 — Actual Godot & visual truth
- Check exact run SHA, GitHub Actions job steps and logs, engine 4.7 headless/Xvfb scene and exit code. A browser build successful ≠ survival interactions played in browser.
- Review native screenshots/capture of **real production scene**, character/world interactions, dynamic room/roof, skill on-enemy and terrain effects, UI legibility at integer 2K/4K, color/light contrast. Evaluate readability against world art, not only individual element render.
- A test pipeline that only imports/parses/reconstructs data cannot certify gameplay feel or top-down pixel clarity. Human usability/playtest status is explicitly flagged if not performed.

### R4 — System/value coherence and 14-day replay
- Functional depth: does the feature meaningfully affect at least two adjacent gameplay systems? A chest, road barrel, farm, power circuit or rare Core cannot exist solely as a menu demo. Check source→transform→sink→exploration or base/life-cycle effect.
- Play as new player and as expert if feasible. Examine onboarding, rewards, difficulty not artificial grind, preparation/retreat, death recovery, overlapping crafts, multi-stage POI curiosity and the user requirement: after long-form ~14-day-equivalent play, **many credible exciting objectives must remain**.
- Explicitly ask **"Why play this top-down pixel fantasy game instead of more photorealistic third-person shooter survival?"** Need different advantages (Hero combos/GOLD/terrain response, readable tactical combat, home specialization, solo agency), not a weaker imitation.
- For visually central claims require actual sensory evidence; for quantitative claims record measured values, hypothesis, sensitivity and data source.

### R5 — Binary verdicts and integration authority
Record separately:
`RESEARCH_PROVENANCE`, `ARCHITECTURE`, `CODE_RUNTIME`, `TEST_ORACLE`, `VISUAL_UX`, `SYSTEM_VALUE`, `SAVE_MIGRATION`, `INTEGRATION`, `BALANCE_REPLAY`, each `PASS / FAIL / NOT_TESTED / NOT_APPLICABLE` and evidence SHA/URL.
- **APPROVED_DESIGN** only when F0–F5 evaluate true with explicit reasons; `VERIFIED_IMPLEMENTATION` only when relevant *all required* gates PASS and independent tests/engine evidence exist.
- A real `FAIL` gets a concrete correction order and owner; `NOT_TESTED` is an evidence gap, NOT a midway approval. Not applicable must be reasoned.
- Preserve scoped successes without using them to claim full epic complete: SURV-010 native code loop PASS is compatible with SURV-020 roofs and beds NOT TESTED and total game NOT INTEGRATED.
- No automatic merging on "green CI". A0/integrator reviews exact PR SHA and relevant tests, then separately updates `STATE.json`, `WORKLOG.md`, Google Docs tab 04. Documentation updates alone NEVER count as gameplay.

## 2. Delivery review record required for every agent
`REVIEW_<TASK>_<SHA>.md` must include:
1. Versioned requirements, source anchors from 1,355-line Atlas and decision IDs, plus conscious exclusions.
2. Full changed-file inventory and methods inspected, cross-CT API/SaveService/scene effects, dependencies and source licenses.
3. Test list classified by **what action it truly simulates**, plus blind spots and new adversarial cases/reproductions.
4. Actual native/browser screenshots or explicitly `NOT_TESTED`; frame clarity and game-feel findings.
5. Economy/POI/knowledge/skill/14-day contribution and comparison to top-down USP.
6. R0–R5 + gate verdict table; precise blockers, fixes and residual risk.
7. Merge/ship outcome and which independent reviewer signed it. Implementer cannot unilaterally declare product quality PASS.

## 3. Continuous research
At each new problem, inspect internal SOH, search source repo/engine docs beyond the initial shortlist, evaluate actual code/art license and integration cost. Reopen research on bugs or evidence gaps. Log in role research plus canonical RESEARCH_LOG after integration. Never perform gratuitous searches as substitute for programming.

## 4. Parallel-work safety
A0/A2 has Draft PR #11 in progress; other agents A1/A3/A4/A6/A7/A8 only edit their prepared role branches/owned directories. Agent review may inspect any source read-only but no changes to other's working branch, shared SaveService, production overworld, `project.godot` or shared state without the integrator's permission and protocol.

## 5. Documentation at task issue and review checkpoints
At dispatch archive the COMPLETE prompt, branch, owner, why/which source, acceptance and code ownership (already required by CHANGE_PROTOCOL). At each meaningful commit the agent logs code/test/research and Docs tab 04 or DOCS_SYNC_PENDING. At **review** append independent deep-audit verdict, errors, source/code/test references, native screenshots and next correction task. Review is NOT skipped because the build is green or the implementing agent sounds confident.


## Visual art-direction competence gate — creator correction 2026-10-31

**Technical UI green is not artistic competence.** For every visually central A6/A1/A8/AVFX delivery, Control Tower MUST independently open and closely inspect real Godot screenshots/videos from the actual **tested commit**, including *actual staged assets* and real production scene, not merely source contact sheets, abstract stock imagery, file dimension/contrast checks, linter output, agent self-reports or labels. Review the UX at **1× real player viewing scale** at 720p and at 1440p/2160p; view separate major screens at native full size, not only a small collage. Check first impression, spatial composition/negative space, focal hierarchy and protagonist salience, typography/diacritics/legibility, controls and information density, asset-theme coherence, useful affordances, feedback and emotional/gameplay payoff. Independently inspect the before/after **matched gameplay state**, and compare against an approved coherent art direction or references and the locked product promise.

**Current adverse example:** The 2026-10-31 A6 screenshots contained oversized blank parchment gender cards with tiny characters; world HUD overlong illegible English Blackletter headline and microscopic badges; recipe sentences flattened into low-contrast mint-green buttons; return panels disconnected in a huge black void with no sense of rewarding homecoming; dark gothic title clashed with bright generic green buttons; Vietnamese combined marks were garbled. Real art provenance, 29 correctly sliced sprites, zero-overlap assertions and 12 valid render frames were real engineering achievements but DID NOT qualify as high-quality production UI. Public fail-closed avatar screenshots must not be confused with true staged-art captures, and an image query/illustration must NEVER be presented as evidence of actual game visuals.

**Separate verdicts (no averaging):** `NATIVE_TECHNICAL` (code/CI), `FUNCTIONAL_UX` (ordinary player can execute tasks and understand state), `VISUAL_CRAFT` (art direction, composition, legibility and cohesion), `EMOTIONAL_PRODUCT_FIT` (SOH's specific mood and desire-to-play), `HUMAN_PLAYTEST` (only when actually observed). A visual-craft FAIL is an independent veto on `VISUAL_UX_PASS` even if CI and layouts are green. Agent-authored `visual reviewed` is NOT independent CT approval.

**Competence/ownership rule:** If A6 delivers a source-valid/native-valid but low-quality art-direction pass, do not automatically issue another cosmetic polishing loop to the same agent. Inspect whether its failure is local implementation (A6 should fix) or global visual concept/information architecture (requires a stronger independent art-director/design pass and/or creator selection). After one cohesive correction attempt and independent re-inspection, repeated failure at the **same systemic visual issues** triggers an explicit `ART_DIRECTION_CAPABILITY_HOLD`: freeze broad artistic authority for that agent, retain it as a technical integrator, and compare alternative art-direction concepts/reviewers before further expensive implementation. The creator may select a direction at that point, but must not be forced to manually design every element. Do not interrupt an already-running agent merely because this gate was documented.

**Evidence ledger:** exact tested SHA, native screenshots (actual private art vs public fail-closed), named visual problems and screen coordinates/visual description, player-visible consequence, comparison to locked SOH product intent, recommended fix ownership, acceptance decision and whether a stronger design lead is warranted. Include links to authentic screenshots. Never claim `VISUAL_PASS` from screenshots just *existing*. Prioritize unresolved systemic layout/typography over producing another batch of textures.

