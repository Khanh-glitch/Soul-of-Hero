# S6 — SURV-POI-DEEP-001 / Unit 2: Whitewater Assay Works mission graph
**Issue:** https://github.com/Khanh-glitch/Soul-of-Hero/issues/18
**Own branch:** `feature/surv-s6-poi-depth-001`; verified UNIT1 SHA `1e67253675bba27c2b4b1901a7566e7060357d36`.
**Authorization:** Unit1 ACCEPTED_SCOPED by Control Tower; **Unit2 allowed AFTER user pastes the same-session S6 continuation prompt**. No claim of automatic agent execution. Optional specialist, never blocks the product critical path.

## Read (token-efficient, context-loss resistant)
- First check your OWN branch `git status --short`, `git rev-parse HEAD`, `git log -3`, and inspect any existing `MISSION_GRAPH.json` before overwriting. If already ahead, reconcile.
- Read own `docs/survival/poi_deep_lab/BRIEF.md`, `STATE.json`, `LOG.md`; `docs/survival/S6_QUOTA_RECOVERY_20261029.md` on integration branch if needed; this explicit work order. The prior Unit1 698-word brief is already source-audited.
- Source anchors: original immutable Atlas `docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md` **ONLY** relevant POI08/DEP03/04/05/31/JOURNEY11/12 sections. For an agent with truncated context, read these sections and the brief; do NOT waste quota reading full 1355-line Atlas and generic architecture again.
- Independent coordinator review: `docs/survival/reviews/S6_UNIT1_WHITEWATER_ATLAS_PRODUCT_AUDIT_20261029.md` on integration branch, commit `32daddfa40c0e68bd1b423330dbf042e46488c6d`. Source review verified historic S07/S08 claims and clearly distinguishes proposed Whitewater fiction.

## Mission and exact deliverable
Produce **one machine-readable design graph**: `docs/survival/poi_deep_lab/MISSION_GRAPH.json`, with **8–12 semantic nodes** and directed conditional links. Optional tiny `MISSION_GRAPH_NOTES.md` only if essential; update own STATE.json and append LOG.md, commit/push in same branch and update Issue18. No runtime, tiles, production, Code IDs, A0/A1/A3/A4/A6 files, map coordinates, or Gold changes.

Each node must use local proposal IDs, class/role, discoverable clue, entrance/retreat affordance, meaningful optional reward or unlock, and relevant hazard. Edges must explicitly state `credential` (maintenance/assay), `power_allocation` (`none/drainage/ventilation`), `exposure` (prepared/unprepared with known route risk), lock feedback and local state changes. Never conflate keys, power, hazard or boss progression. No consuming credential if required power is unavailable.

Show at least **two complete entry→exit routes** as ordered node IDs with exact preconditions/effects:
- Safe novice sortie: dry approach → legitimate limited salvage and a clue → unpowered exit, **no top-tier item or mandatory credential**.
- Prepared deep expedition: purposeful protection or timed traversal, maintenance authorization, distributor tradeoff, ventilation/drainage choice, nontrivial assay access, distinct physical specimen and future research/access reward → reachable exit.

Explicitly test the model in reasoning for: switching distributor multiple times (why not free grab-both?), lost or consumed credential, death bag inside dangerous area, power failure with player in deep wing, no combat ability, exit/reentry and attempted key use before power. Add an `unresolved_edges` array for any cases that cannot yet be proven from a semantic graph; don't claim Unit3's exhaustive softlock validator completed.

Ensure reversible distributor switching changes **legible** risk/cost/space, rather than a permanent arbitrary lock or invented source timer. Make noncombat authorization route meaningful without trivializing boss. Distinguish normal salvage, rare one-time specimen, recipe knowledge and access unlock (A3 must later approve any item IDs). No Core required or Gold skill invented.

## Acceptance/test/output
Check parseable JSON, IDs unique, links refer to existing nodes, route traces reach a real exit without invented prerequisites, visibly separate `HISTORICAL_ATLAS` vs `SOH_PROPOSAL`. If possible add a tiny self-contained source-owned validation script, but Unit3 still owns full state-machine exhaustive reachability; don't burn scarce quota on making a native Godot scene now.

Update `STATE.json` with Unit2 COMPLETE vs DRAFT, current next action Unit3 state machine, exact PUSHED SHA if known, `DESIGN_ONLY / NATIVE_NOT_TESTED` and Docs sync status. Update Issue18. **Stop after completing Unit2**; do not begin Unit3 without assignment. If quota exhausted before complete, push a clearly DRAFT partial with precise resumption pointer.

**Decision boundary:** This is an OPTIONAL SOH layered-POI reference. A1 placement, A3 loot/recipe/unique IDs, A0 host/navigation/save and A6/UI remain OWNED elsewhere. No merge approval or human playtest claim.
