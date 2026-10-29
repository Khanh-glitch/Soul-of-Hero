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
