> **2026-10-30 HISTORICAL EVIDENCE / SUPERSEDED CLAUSES:** This document remains useful as source/research/implementation history, but `docs/survival/CURRENT_PRODUCT_CONTRACT.md` and `DECISIONS.md` D062–D074 OVERRIDE ANY contrary persistent-home, optional-only replay, forced exact-ten-dungeon layout, no season-wipe, no secured currency, no Ragnarok, or no physical trading-machine assumptions. Do not dispatch gameplay based on conflicting older prose. Its native acceptance claims (if any) are valid only for their pinned SHA, not as product approval.

# SOH — Quantitative Economy, Exploration Depth and Replay Calibration

Status: **DESIGN GATE APPROVED, NUMBERS BELOW ARE SOH TEST TARGETS, NOT ORIGINAL 2019 GAME MEASUREMENTS.** Original atlas §46–48 supplies formulas and 2019–2026 dated examples. Never use its 2026 quota (40m / 28m, 30 chests, 80 electronics, 49 regions etc.) as historic 2019 facts, nor inject into SOH by default.

## A. Source-to-sink ledger: every resource must earn its place
Each world item needs `item_id, origin_classes[], processing_steps[], sink_recipes[], recycle_destination, rarity_tier, volume, risk_to_acquire, replenishment_policy`. No item is approved for shipping if it has zero source or zero purposeful sink, except explicitly marked collectible/story item with actual player feedback. Every base craft needs input provenance and at least one craftable/lootable subgoal path in the active world. A recipe gate without a valid acquisition path is SOFTLOCK FAIL.

Five economies co-exist and exchange value:
1. **Raw ecology:** trees, stone, veins, plants, hunt, food/water → basic tools, fuels, building and low-tier survival.
2. **Scrap/knowledge:** road barrels and recycling → Spares/Mảnh Tri Thức → station upgrades, research, select blueprints; ensures achievable solo progression without bosses.
3. **Industrial/intermediate:** ore → ingots; herb → essence; broken artifact → frame/spring → Core blank/ward part; workstation tiers and queue time constrain production.
4. **Access/territory:** colored seals, fuel, electricity/ward, resistance/POI bosses → new rooms, unique catalysts and transport routes; one discovered key changes world goals.
5. **Rare capability:** finite found Core → either use, preserve or research → permanent blueprint → repeated synthesis from ingredients; distinct Hero/skill roles and environmental counterplay.

Each tier has **two or more alternative meaningful activities**, at least one not exclusively boss-gated. Each rare material should generally serve **two distinct sinks** or one decisive high-value choice; distinguish intentional quest-key exceptions. Ordinary materials can become farmable, but rare catalysts still demand journeys.

## B. Economic measurements — implement instrumentation, not guesses

**Net expedition value (vector):** `net = output(useful items + learned recipe + access info + base expansion) - consumed tools/charges/meds/fuel - repairs - expected loss risk`. Do not collapse all outputs into gold because discovering a single rare Core can be more emotionally valuable than 1000 rocks. Record `game_minutes, route_distance, death_count, carried_slots_before_after, damaged_items, new_known_recipes, newly_accessed_poi, material_by_id, core_uses_consumed, return_success`.

**Route cost:** `T_home→POI→home` includes travel, hazard management, waiting, combat, loading/stash. Outpost advantage `ΔT = T_base_trip - T_outpost_trip - amortized_outpost_build_time`; an outpost with `ΔT ≤ 0` across all common routes needs a utility redesign. Route diversity is positive when one path is faster but exposed and another slower but safer, not when all are equivalent.

**Research opportunity cost:** `value = expected future usage × saved future acquisition cost - bench/scrap cost - specimen sacrifice - risk of securing recipe materials`. Recipe utility must include tactical behavior, not DPS alone. A rare Core of a new family adds movement/control/terrain utility; don't drop five mechanically identical rare cores in quick succession.

**Production throughput:** `useful_outputs / active_player_minute`, `queue_wait`, `idle_time`, `required_player_inputs`, `inventory_transfers`. Farm/workshop improvement passes only when it reduces repeated mundane labor or enables more planning choice, not solely increases resource count while consuming same clicks.

**Risk:** compare expected rewards and time-to-escape of POIs, costs of protection, ability to leave mid-run, death bag recovery probability and day/night traversal; avoid false risk from one-shot untelegraphed hazards. Difficulty can be deep without requiring 100 identical fetch cycles.

**Inventory revaluation:** at least one ingredient in each technology band should shift from marginal to important after learning a recipe; recipe UI and Codex must make this discoverable (Atlas DEP-11, JOURNEY-08). Logs must show player can exploit this without already memorizing the whole recipe list.

## C. Content-depth model vs artificial time padding

User's experience: after ~14 days in original, only a few guns unlocked, many unopened bases/locked rooms, compelling desire to restart. This is a HARD experience goal, not a mandatory 14-real-day countdown for every solo session.

**Mandatory test cohorts (proposed test methodology, not player population facts):**
- Blind novice run and informed optimizer run; distinguish 1h, 3h, 10h and long-form multi-session outcomes.
- Record first built shelter, first return trip, first uncommon item, first used rare Core, first recipe learned, first layered keyroom entered, first failure/retreat, second meaningful biome and first optional expedition repeat. Do not pre-decide universal hours; use observed distributions.
- At first rare Core, ask whether it changes *what the player can do*, not merely increases damage by N%. If no distinguishable affordance within one short combat/interaction trial, **FAIL** skill-rarity delight.
- At long-form test end, ask player to independently name ≥3 credible goals across ≥2 systems and identify at least one still-interesting unopened POI/skill family. These are SOH target thresholds; number 3 is designer's measurable gate, not reported original statistic.
- At replay: different route/recipe/POI strategies give qualitatively distinct plans while **permanent home and core knowledge** survive. If an expedition is trivialized by a warehouse of fully crafted endgame Cores, restrict loadout transfer by transparent expedition rules and allow at least one early meaningful choice.
- Failed runs produce recoverable knowledge or a real strategic lesson; no deliberate opaque RNG blocking the only path.

## D. Exact catalog and version discipline
The research atlas contains:
- 44 subsystem sections SYS-02..45 with dates/mode caveats, not 44 2019 features.
- 21 POI templates, including 2021/2023/2025 extensions; their map placement cannot be reverse-inferred from study.
- 31 dependency-test seeds, 12 cross-domain journeys; 40 questions whose literal original facts remain UNVERIFIED; 28 linked sources.
- Quantitative examples: 2019 7/15 day cycles; 2020 base heat cap 40 and logistics caps; 2021 7000m map/8 POI; 2023 device quotas; 2025 24 minute instance; 2026 49 plots. These are all **different builds/modes**. Never combine into a single "original game balance".
A fully enumerable **SOH** Recipe Registry can be produced and counted once authored; the exact original game's total recipe count cannot be honestly claimed without version-pinned full data/UI evidence.

## E. Required analytics schemas
`GameplayEvent(event_id, player_id_or_local_id, session_id, source_id, region_id, tick, operation, input_items, output_items, before_revision, after_revision, result, duration_ms)`; do not include private personal data in game analytics. `ExpeditionSummary` records net gains, successful returns, discoveries, new learned recipes, Core family first-use, visited/unopened POIs, travel and downtime. `WorldGraphValidation` records shortest route, hazard classification, key/power access dependencies, reachable primary landmarks and alt paths. `SkillGoldParity` records skill ID, expected source and native trace, frame/tick accuracy including environmental cues and enemy impact.

## F. Binary balance gates
- BG-01: **Material availability**: every essential recipe has a feasible source (non-boss for starter, not circular behind its own unlock); all input/output quantities and ID references validate.
- BG-02: **No free-value loop**: craft → repair/salvage → craft cannot yield increasing infinite material/charges.
- BG-03: **Worthy scavenging**: low-risk road loops produce research progression but not high-tier Core duplication without POI danger/materials.
- BG-04: **Base usefulness**: home/outposts/farm reduce travel/prep cost and increase expedition scope (measured), not cosmetic.
- BG-05: **Key/energy/hazard**: at least one layered POI route solvable while other routes remain visible but constrained, without impossible key depletion.
- BG-06: **Fair risk**: environmental and enemy cues visible at top-down camera; death bag persistent; novice can recover from an early mistake.
- BG-07: **14-day depth**: 3 meaningful self-chosen future goals in at least 2 systems, unvisited POI/skill family, with no mandatory pointless grinding.
- BG-08: **Hero/Core distinction**: Hero remains playable when Core depleted; rare Core changes tactical/terrain capability, Gold VFX source parity intact.
- BG-09: **Same-source truth**: catalog data, item UI, loot, crafting, research, SaveService and Codex all reference the same IDs/recipes; no divergent agent copies.
- BG-10: **Readable pixel presentation**: building/interior + Core cast/hazard/loot visually distinct at native and integer-upscaled 2K/4K, enemy attacks never drowned by random terrain detail.
Each gate outcome recorded `PASS` or `FAIL` with specific test evidence. `NOT_RUN` means not shipped, NOT a binary pass. Factual 2019 unknowns stay labeled unverified without blocking SOH design choices.
