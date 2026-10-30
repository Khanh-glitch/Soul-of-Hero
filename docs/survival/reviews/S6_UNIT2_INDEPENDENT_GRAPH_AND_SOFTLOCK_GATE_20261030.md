# S6 Unit 2 — independent Control Tower acceptance and adversarial gate (2026-10-30)

**Verdict:** `S6_UNIT2_ACCEPTED_SCOPED / S6_UNIT3_AUTHORIZED_DESIGN_ONLY / NATIVE_NOT_TESTED / PRODUCT_INTEGRATION_HOLD`.

## Exact inspected source
- Repo `Khanh-glitch/Soul-of-Hero`, owned branch `feature/surv-s6-poi-depth-001` remote HEAD **`2ee3c5145c51e8e1d6e8c07a397d7f2849498484`** (verified).
- Unit2 artifact `docs/survival/poi_deep_lab/MISSION_GRAPH.json`, blob `2f18dfceb8f1229ba954b0444541303c87787d7c`; BRIEF / STATE / LOG read.
- Compared Unit1 `1e67253675bba27c2b4b1901a7566e7060357d36` → Unit2 HEAD: exactly two commits, `MISSION_GRAPH.json` new and only `STATE.json` / `LOG.md` modified. **No production/A0/A1/A3/A4/A6 files changed.**
- Issue #18 user/agent report confirms design scope only. Source distinction: historical Atlas POI08/S08 and DEP03/04/05/31 versus novel SOH Whitewater proposal. No historical exact timers/costs asserted.

## Independently executed checks
The reviewer fetched the entire JSON **directly from the pinned Git SHA** and evaluated a separate in-memory JS validator rather than accepting the agent's self-reported assertions.

| Check | Independent result |
|---|---|
| 11 unique node IDs / 22 directed edge IDs / 13 action IDs | PASS |
| All edge endpoints, action nodes, unresolved-edge references exist | PASS |
| Route A actual ordered edges/actions: `boundary→walk→boundary`, safe ordinary salvage and clue | PASS |
| Route B actual ordered sequence (15 movements / 8 actions), including maintenance, drainage, gallery calibration, independent noncombat assay, ventilation, sample and return | PASS |
| Route B state delta from witness override: priming -2, protection -4, service_supplies -1, cargo_free -1; at exit carrying_specimen=true, recipe_known=false, egress_open=true | PASS |
| `F_power`, `F_lost_credentials`, `F_expired` structural escape chains | 3/3 PASS **at instantaneous abstract graph level only** |
| Independently reject insufficient power, assay, protection, priming without committing effects | 4/4 PASS |
| General physics/nav/temporal safety, reload/crash, all reachable state enumeration, actual human value | **NOT TESTED** |

**Boundary:** These checks establish a coherent authored conditional mission graph and two route witnesses. They do **not** establish that player movement, hazard exposure, death bag, native interaction, Godot runtime, economical balancing, Gold skills or the complete B0 loop works.

## Counterexamples and review findings for Unit 3 (mandatory)

1. **CE-01: actual directed graph softlock if escape is obstructed.** Player at `ww_annex`, `e18` blocked, `power=none`, `protection=0`: remaining exit `e17` requires ventilation and protection≥2. Independent edge evaluation finds **zero legal outgoing edges** and **no path to ww_boundary**. Thus the current escape guarantee is conditional, not universal. Unit3 must address blocked flap and power failure simultaneously, not test them only separately.
2. **CE-02: deep death/custody recurrence missing.** Player dies at `ww_collection` with finite unique specimen, all carried assay/maintenance credentials, protection and priming in a death bag. Graph has no bag or death transition and no proven outside replenishment: persistent `specimen_taken=true` prevents a second pickup. Must show a fair, concrete recovery route (or an explicitly communicated optional-loss branch with no global critical-path lock) without duplicating specimen, granting free gear, or erasing costs.
3. **CE-03: repeatable `calibrate` action currently lacks `gallery_record=false` precondition.** Recalibration after `gallery_record=true` can still debit protection. Assess whether repeat action is deliberate paid rework with distinct benefit, or enforce fail-closed/idempotent no-op to prevent accidental repeated spend. `reissue_assay` similarly can debit service supplies while assay=true; define UI/transaction policy.
4. **CE-04: egress exposure is assumed zero and dry.** The graph lacks travel duration, water rise/flood timing, agent hitboxes, death placement and collision. Structural escape must not be sold as physical escape.
5. **CE-05: startup/credential external sources are only witness overrides.** The `priming=2/protection=5/service_supplies=1` deep-route grant is **abstract prepared inventory**, not an obtainable native SOH recipe/loot source. Exhaustive depletion/reload and unavoidable lock analysis cannot assume infinite outside replacements.
6. **CE-06: power-mode switching spends priming and finite loot flags prevent infinite farming, but costs versus boss alternative and the separate residue/specimen opportunity cost remain unbalanced.** Keep as later product gate; don't invent numbers for original source.

## Decision
**PASS Unit2 at DESIGN/STRUCTURAL level** because it fulfilled its finite 8–12-node two-route conditional graph assignment, clearly recorded unresolved faults and preserved ownership. Authorize **ONE** S6 Unit3 focused on CE-01/02/03 and state-transition/death-bag recovery, explicitly nonblocking. This is NOT an unconditional safety approval. **Do not merge** S6 or alter A1/A3/A0/Gold; no Unit4 without a new independent gate. S6 UNIT3 may start **only when user pastes the explicit same-existing-session prompt**.

Other agents: A1 source-constrained canonical seam is separately proven blocked at legacy x369; a narrow A1 owner-compatible connector contract can be requested, independent from S6. A3/A6 remain paused; AVFX independently active; A0 owns native host and currently continues in a separate Arena session.

**Docs:** Git is the durable decision. Google Docs tab04/12 mirror readback is a separate sync action and must not be claimed automatically.