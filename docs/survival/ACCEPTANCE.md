# Survival RPG end-to-end acceptance — authoritative checklist

**Status:** TARGET, not a claim of implementation or passing tests.

**CURRENT USER-LOCKED SEASON/RESET/GUIDE OVERRIDE (D055–D057, 2026-10-30):** Each survival run ends after **14 real calendar days, including offline time**. At the next run ALL gameplay resets to zero: player/home/stored and carried items/Skill Cores/research and recipes/world/POI/quests/tutorial. **Only game-wide achievements and immutable results/history of each completed run persist** (with no granted power). The starter mission chain reappears each run; newcomers get practical guidance, returning players can pursue goals out-of-order and claim eligible A3-authorized quest rewards once per run. Old passages assuming persistent cross-run house/knowledge or separate optional expeditions are historical and explicitly superseded. Calendar countdown alone does not authorize background raids, hunger, production or other offline simulation. Accelerated/mock clocks are allowed for scoped tests only.

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

## Season closure and player guidance acceptance — D056–D057
- [ ] Expiry is 14×24 hours real calendar, including offline time. On next launch expired run is finalized once, with crash/partial-save protection; no ability to mutate expired world.
- [ ] Persist **only** general account achievements and a stable historical report for each completed run; save result before wiping world. Names/formula for single score and detailed statistics are CT proposals, not yet user-voted.
- [ ] A fresh run begins with **zero owned resources, house/bed/storage, Skill Core, blueprints/research, unlocks, POI/harvest/monster changes, discovered-fog progress, quests/tutorial status**. Run IDs and receipts cannot replay from the previous season.
- [ ] Newcomer sees a helpful starter-quest path, can use normal controls to perform it, gets properly authorized once-per-run rewards. The second-run player can ignore the suggested order, complete tasks ahead of time, or return later to claim legitimate rewards; no quest becomes an artificial prerequisite for exploration/production/Core that has a real physical source.
- [ ] Verify separate OS process, interrupted end-of-run commit, idempotent re-open of expired season, quest replay across runs but not twice within one run, and no account-record loss through migration.
- [ ] **No offline raid/damage/production/needs advancement** is inferred merely from the agreed 14-day wall-calendar countdown.

## Evidence package per milestone

1. Exact commit and branch, reproducible commands and test fixtures.
2. Machine-readable pass/fail with per-case identifier; distinguish unrun / blocked / failed / passed.
3. Native Godot screenshots (and full moving VFX comparison for Gold), not just a static renderer mock.
4. Browser normal user route proof, asset source+license list, performance evidence.
5. Honest fail list and next executable task in STATE.json/WORKLOG.md.

**Do not announce full game complete before the above is actually verified.**

## Long-run depth and replay experience (new MANDATORY gates, 2026-10-29)
The user LOCKED D055–D057 on 2026-10-30: one run lasts exactly 14 real-calendar days, including app-offline time; the next starts with fully reset gameplay (including research and tutorial quest progress), retaining ONLY account-wide achievements and historical result records; a new-run quest guide remains available but does not force returnees to play its order. The memorable goal is many unfinished discoveries on the same learnable map.
- [ ] `ACCEPT-REPLAY-01`: Over a representative **D055 14-day real-calendar season (offline time counts)**, a typical inexperienced player obtains **several individually exciting rare Core skills** and coherent progress; no first-session flood of interchangeable "rare" skills.
- [ ] `ACCEPT-REPLAY-02`: At the end of that sequence player can name ≥3 **distinct**, reachable future goals spanning at least two of exploration/research/building/combat, and still has a meaningful unopened POI or ability branch. Do not pass by making 1 recipe require 100,000 repetitive harvest actions.
- [ ] `ACCEPT-REPLAY-03`: After exactly 14 elapsed calendar days including offline, archive one immutable season result and any global achievements and start a fresh run on the SAME geographic map with **ZERO** home/structure, inventory, Core, research/learned tech, world/POI/harvest, quest/tutorial progress. No inherited account-wide power/blueprints. Valid alternate home-first/explore-first strategies, per-run quest reward uniqueness and previous-season history must all be real native/reload behavior.
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

## Coordinator acceptance rule — product reality outranks green CI (2026-10-29, user reaffirmed)

**Binding review instruction.** Neither passing CI, a large file/POI/recipe/skill count, an agent-written completion report, nor even correct isolated native fixtures are sufficient by themselves to approve a Soul of Hero gameplay milestone. Every independent coordinator verdict must read and trace the relevant locked user decisions in `DECISIONS.md`, the original immutable Atlas and `SOURCE_COVERAGE_TRACE.json`, the approved but not necessarily implemented `SYSTEM_FUSION_BLUEPRINT.md`, prior user/agent design discussions as captured in Control Tower/Google Docs, and this acceptance ledger. **Do not substitute a generic survival-game design checklist for the actual SOH design intent.**

For each claimed milestone, the review must identify and explicitly separate:

1. **Promise and purpose:** which `LOCKED_USER` decision, historical gameplay behavior, DEP/JOURNEY/POI/SYS chain, CT contract, and distinct *player-facing value* it is supposed to realize; what the player can choose or experience that they could not before. Preserve the source's nuance and separate historical facts, design proposals, and verified SOH implementation.
2. **Real implementation:** precisely what changed at a pinned commit, what is source-proven, what only exists in a static authored plan or isolated fixture, what is actually connected to the live Godot Hero/world/save/UI/combat path, and which critical systems remain mocks/temporary adapters.
3. **Systemic consequence:** prove the real inbound/outbound links (world ↔ resources ↔ economy/research ↔ construction ↔ POIs/hazards ↔ Core/combat ↔ UX/save) rather than merely confirming that each subsystem has a callable API. Check authority, atomicity, persistent state, player agency, counterfactual paths and anti-exploit behavior.
4. **Actual gameplay/visual quality:** when relevant, test normal player input and native moving gameplay; inspect readability, depth, route/hazard viability, architecture/room utility, Gold *entire-cast* enemy/environment fidelity, UI interaction and 720p/2K/4K sharpness. Fixture results are scoped engineering evidence, not a played experience. A human playtest is indispensable for emotional engagement, satisfaction, repetition, and long-form pacing; explicitly mark `NOT_HUMAN_PLAYTESTED` until such evidence exists.
5. **Long-run design test:** cross-check D021/D030/D033/D034 and `ACCEPT-REPLAY-01..06`/ `ATLAS-IMPL-01..09`. A long-lived base, meaningful low-risk salvage, consequential rare finite-use Cores, distinct accessible POIs, recipe discovery/research, nontrivial preparation, multiple surviving goals after a ~14-day-equivalent journey and optional replay **must emerge from real interactions**, not from artificially slow counters, an empty continent, manufactured 45-minute session budgets, or huge arbitrary grind.
6. **Gate decision and continuation:** record `ACCEPTED_SCOPED`, `CONTINUE_WITH_CORRECTIONS`, `HOLD_INTEGRATION`, `REJECT`, or `ACCEPTED_PRODUCT` with evidence, known untested or failed dimensions, priority, ownership, dependency and exact next executable action. Design approval ≠ authored data ≠ fixture PASS ≠ native integrated ≠ human-validated product. Keep PR merge independently gated. A new user-facing Arena prompt must improve a demonstrated missing product capability, not only increase test counts.

**Review format requirement:** Every substantial coordinator response includes a direct comparison to the relevant product intent, a scoped technical verdict, a product/experiential verdict, explicit reasons for any prompt being issued/withheld and a short durable handoff. Commit the checkpoint to Git, append Google Docs tabs 04 and 12 and read them back; if an update fails, mark `DOCS_SYNC_PENDING`, never claim sync. This rule reinforces, does not claim completion of, any unchecked acceptance criterion above.

## Binding player-experience veto — no technical-only acceptance (2026-10-30)

**The SOH promise is the actual playable feeling of its connected survival/exploration/research loops, not CI success or the sheer amount of content.** This is a *mandatory decision filter* for the Control Tower, independent of who implemented the code. Preserve the full original 1355-line 2019–2020 research Atlas, 44 SYS / 21 POI / 31 DEP / 12 JOURNEY cross-index, D001–D047 and dated historical distinctions. For each reviewed scope, explicitly list supported experiences, missing experiences, and the next action most valuable to the player **before** discussing counts of passing tests.

A green native fixture may justify `ACCEPTED_SCOPED_ENGINEERING`. **It cannot by itself become `ACCEPTED_PRODUCT` or `B0_PASS`.** A scripted route that knows item locations, buttons and optimal build cells is not proof that an ordinary player discovers or enjoys the sequence.

### Eight player-facing promises to veto against

| Promise | Non-negotiable player experience | Failing evidence, even with green CI |
|---|---|---|
| P1 — World as a living cause-and-effect network | Authored continent planned across biomes and regions; the original 10 Chapter-1 dungeon exteriors survive in the opening ~quarter; terrain/roads/POIs/resources/enemy threats have geographic and economic reasons. Accessible routes are physically traversable and remain useful on return. | Beautiful isolated maps, 106 unmounted POI anchors, random filler, inaccessible landmarks or teleport-as-route |
| P2 — A home worth returning to | The player chooses/builds a paid, physical, roofed, furnished safe home with real room visibility, doors, bed, chest, storage throughput, preparation and save/reload; it changes the range, risk and profitability of later trips. | A construction GUI, fixture-granted house, one useless storage loop, unsafe exits or arbitrary unselective custody treated as finished UX |
| P3 — Scarcity, crafting, knowledge and revaluation | Safe roadside salvage is worthwhile; biome/POI goods have tiered sources and sinks; workstations transform real owned inputs under time/fuel/capacity; blueprint/specimen/learned recipe/unique Core are distinct; acquiring knowledge changes what previously ordinary material is worth. | Phantom loot, circular free-value recipes, fake timed queues, an isolated 'research unlock' with no reason to venture |
| P4 — Fair danger, death and recovery | Player recognizes warnings, has meaningful choices to prepare, sneak, fight, retreat or take alternate routes; actual enemies/exposure can kill; a placed bed and the same physical death bag lead to a fair but costly recovery, no dupes or softlock. | Test-driven `kill()`, dungeon-only damage incorrectly described as overworld threat, penalty-free/free-grant rescue, one unavoidable unfair death |
| P5 — Layered POIs and meaningful returns | Waystation/Relay and later higher tiers exist **in the mounted world**, with keys/capabilities, real power, hazards, repair/research, optional rooms and understandable reward trade-offs, exact persistent/cooldown receipts and a playable return. | JSON-only locations, anchor-only Waystation proof, A3 hypothetical locker rewards, pre-loaded capability, reachability missing exact interaction stand |
| P6 — Distinct Skill Cores and source-authentic Gold | Finite-use physical Core and permanent recipe knowledge are separate; rare skills are truly distinct in movement/control/terrain tactics; entire Gold source timeline, enemy-on-hit and external environment/terrain VFX survive the actual native cast with high-contrast legibility on bright maps and sharp 720p/2K/4K pixel rendering. | '93 skills' from registry only, edited/substituted spectacle, missing enemy/environment cues, numeric damage with no tactical novelty or blurry high-resolution output |
| P7 — Character and interface are the game, not debug fixtures | Exactly two chosen player avatars Male/Female Adventurer can be selected and genuinely represent survival **and** combat (D045/D046); controls, HUD, crafting/recipe/loot/storage, modal input, camera, directionality and feedback are comprehensible without a test script; do **not** invent a dedicated shooting animation requirement. | Knight graphic as final protagonist, debug/test-only Web entry, UI that requires knowing hidden bindings or cannot selectively manage stored items |
| P8 — Long-term aspiration, not manufactured grind | A D055–D057 14-day calendar season has abundant competing region/Core/POI/build/economy goals impossible for the typical player to exhaust; its result becomes a durable account-wide record (one proposed scalar + transparent activity breakdown), and new seasons reset ALL gameplay, including research, Core, house and guide quests. Returning players freely choose another strategy and can re-earn guide rewards once per new run. | False no-reset carryover, missing historic result, mandatory starter-tutorial sequence on repeat run, quest double-grant or stale season receipt, 14×45-minute simulated grind mistaken for user enjoyment |

### Decision rules by scope

- **B0 (first playable survival experience)** must demonstrate one real **continuous normal-input native fresh-save journey** crossing at least home / resource / real A3 work / canonical A1 two-POI trip and return / genuine threat–death–bed–same-bag recovery / disk rebuild. Test meaningful **home-first and explore-first** alternatives and one prepared vs underprepared counterfactual. Never substitute death fixtures or teleports for the real route. Do not demand the entire continent and every Gold skill for B0, but record B1/B2/Gold blockers separately.
- **B1 (SOH differentiation)** adds source-authentic full Gold Core + useful terrain/enemy effect, layered higher-risk POI, research and real preparation/alternate strategy, meaningful encounter choices and visual readability native on real maps.
- **B2 / full product depth** requires representative novice/human play, actual multi-session resource economy, discovery and desire-to-continue, ≥3 future goals, and intentional decisions or grounded not-applicable outcomes for all 44 SYS, 21 POI, 31 DEP and 12 JOURNEY anchors. Not every Atlas archetype requires a literal copy.
- Every acceptance response shall place **player-experience verdict and next user action first**, followed by compact proof and technical/CI details. If the actual player-visible experience is missing, output **PRODUCT_HOLD / REASON / THE NEXT ACTION**, even when every scripted test passes. Keep screenshots at native scale and human observation distinct from automation. Maintain engineering truth rather than rejecting genuine scoped progress.
- Agent output, docs sync, design approval and successful GitHub CI **do not constitute game acceptance**. An authorized pilot or a new prompt is not evidence that a running game has that feature. Mark `NOT_TESTED`, `BLOCKED` or `FAIL` specifically; never promote any automatically.

**Control Tower product question for every milestone:** *What does the player actually choose, do, feel, gain, lose, learn, and want to do next?* Trace those answers through the original Atlas and current running Godot implementation, not through checkboxes.
