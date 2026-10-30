# Survival RPG end-to-end acceptance — authoritative checklist

**Status:** TARGET, not a claim of implementation or passing tests.

A production-quality playable vertical slice must exercise the complete route in a fresh save, at normal input, in engine, and later the browser. Do not pass by injecting fake state in CI.

- [ ] New player spawns on intact Chapter-1 approach, sees legible routes and first resource nodes.
- [ ] Harvest tree and rock using tools; harvest changes physical node state, creates real inventory items, follows respawn rules.
- [ ] Place modular foundation, walls, door, room roof and interior storage with preview/grid validation; costs paid once; cannot block mandatory paths/spawn.
- [ ] Navigate into building, roof fades by room, player can interact with chest and bed; all collision, z-order and occlusion correct.
- [ ] Transfer stackable/unique items player ↔ chest without loss, overflow or duplication; stable IDs.
- [ ] Smelt ore, craft tools and building parts at correct workstation; expenses and output transactional.
- [ ] Loot roadside barrels/ruins and rare container; no repeated exploit of same container; appropriate reward tables.
- [ ] Loot a limited-use Skill Core and equip it; cast a **verified source VFX** with original enemy/environment lifecycle OR explicitly fail this Gold gate if no approved port exists; usage decremented exactly once.
- [ ] Research/recycle a Core at a research station; recipe unlock persisted permanently; crafting fresh Core uses specific resources.
- [ ] Environmental zone hazard/strong monsters genuinely deter early exploration; player can prepare resist gear, new route or skillful workaround.
- [ ] Player dies and respawns at placed anchor; carried loot recovery and owned structures work.
- [ ] Enter and return from real L01–L10 dungeon route without breaking other Hero/combat systems.
- [ ] Save, quit, reload in multiple interruption points; structures, roof, chests, ingredients, knowledge, Core uses, crops and harvestables are unchanged as intended.
- [ ] Collision/topology/regression, native screenshots and Web fresh-user journey (not `?ci_gameplay=1` shortcut) pass; no hidden fatal errors.
- [ ] Asset licenses for release art recorded; native visual human-readability review performed; measure load/memory/frame time across representative regions.

## Evidence package per milestone

1. Exact commit and branch, reproducible commands and test fixtures.
2. Machine-readable pass/fail with per-case identifier; distinguish unrun / blocked / failed / passed.
3. Native Godot screenshots (and full moving VFX comparison for Gold), not just a static renderer mock.
4. Browser normal user route proof, asset source+license list, performance evidence.
5. Honest fail list and next executable task in STATE.json/WORKLOG.md.

**Do not announce full game complete before the above is actually verified.**

## Long-run depth and replay experience (new MANDATORY gates, 2026-10-29)
The user experienced roughly 14 days of Last Day Rules and had only a handful of guns/recipes and unopened dangerous sites; that **desire to restart with unexplored possibility** is now a hard quality criterion.
- [ ] `ACCEPT-REPLAY-01`: Over a representative long-form sequence paced as ~14 day sessions (not necessarily 14 actual offline wall-clock days), a typical inexperienced player obtains **several individually exciting rare Core skills** and coherent progress; no first-session flood of interchangeable "rare" skills.
- [ ] `ACCEPT-REPLAY-02`: At the end of that sequence player can name ≥3 **distinct**, reachable future goals spanning at least two of exploration/research/building/combat, and still has a meaningful unopened POI or ability branch. Do not pass by making 1 recipe require 100,000 repetitive harvest actions.
- [ ] `ACCEPT-REPLAY-03`: Optional new expedition replay generates **materially different choices** in routes, hazards/loot/POI goals, with retained persistent base/learned knowledge. No forced full-world wipe, offline raid or copied competitive badge race.
- [ ] `ACCEPT-REPLAY-04`: Low-risk roadside scavenging/salvage and non-boss POI still provide economically meaningful progress; complex key/power/puzzle/strong-enemy areas reward planned return.
- [ ] `ACCEPT-REPLAY-05`: Provenance: any claim of "exact 2019 total recipes" must cite a complete build-specific original database; currently **not verified**. The 2019–2020 atlas provides sourced partial example recipes, not a full copy.
- [ ] `ACCEPT-REPLAY-06`: Gate approval must have documented F0–F5 outcome and evidence; implement failures are FAILED not quietly "pending".

## Source-coverage and systemic differentiation gates (Atlas 2026-10-29)
- [ ] `ATLAS-IMPL-01`: All 44 SYS records in `SOURCE_COVERAGE_TRACE.json` have implement/reject adaptation outcome, actual tested behavior where accepted; archive source hash must remain untouched.
- [ ] `ATLAS-IMPL-02`: Every 21 POI model is either deliberately adapted, redesigned as an archetype, or rejected with gate evidence; populated continent has no fake empty major biomes.
- [ ] `ATLAS-IMPL-03`: All 31 DEP chains have real data/actionable tests or a reasoned non-applicability ruling. At minimum core chains DEP-01..05,07,09,11,12,15,17..19,23,27,29,31 pass.
- [ ] `ATLAS-IMPL-04`: All 12 JOURNEY behaviors have native end-to-end test fixture and representative UX review (solo team-only JOURNEY-10 can be explicitly REJECT_NA with evidence).
- [ ] `ATLAS-IMPL-05`: Research source remains SHA256 exact; 40 original-build unknown facts are not invented as 2019 statistics; 28 references retained.
- [ ] `ATLAS-IMPL-06`: Unique SOH experience independently playtested: top-down readability, Gold on-enemy/world full cast, combat area/terrain synergy, fast solo planning, distinct rare Skill Core choices and 2K/4K pixel clarity.
- [ ] `ATLAS-IMPL-07`: Cross-cutting change audit: item/recipe, structure/collision, POI/hazard, AI, Gold, HUD, save and economy all use one source of truth; no isolated patches, corrupted migrations or dupe exploit.
- [ ] `ATLAS-IMPL-08`: Asset reuse and GitHub imports have explicit source SHA and permit code/art independently; Web compatibility tested for dependencies.
- [ ] `ATLAS-IMPL-09`: Parallel agents used as warranted with one owned path each; every merge includes parent SHA, tests, ownership compatibility and fail list; no unrelated branch overwritten.
**Documentation CI PASS only checks research integrity/coverage. The above are NOT RUN until real Godot gameplay is implemented.**
