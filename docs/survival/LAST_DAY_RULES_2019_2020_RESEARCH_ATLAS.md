# SOUL OF HERO — LAST DAY RULES / CIVILIZATION RESTART 2019–2020: MECHANIC RECONSTRUCTION ATLAS
Research cut: 2026-10-29. Owner: Survival RPG / Issue #9.
**Status: primary/secondary source reconstruction + engineering decisions. NOT a runtime implementation and NOT an exhaustive original game data dump.**
**User priority:** preserve the whole 2019–2020 survival exploration/crafting/building/progression experience, now fused with Soul of Hero top-down Heroes, dungeon and exact Gold skill VFX. 14 days of play and only a few high-impact weapons/skills should leave lots of worthwhile unknowns; ability to restart a run must have meaning. These are explicit user requirements, not assistant guesses.

## 0. HISTORICAL IDENTITY / TIME BOUNDARY / WARNING AGAINST MIXING GAMES
2019 English Last Day Rules: Survival / later Last Island of Survival by Hero Entertainment corresponds to 王牌战争：文明重启 (Civilization Restart) ecosystem. Hero Entertainment's corporate timeline (S01) dates global Android release 2019-03-20, China-wide 2019-08-01 and global iOS 2019-12-06. Contemporary Chinese official docs (S02–S08) expose the mechanics missing from English reviews. The similar-named **Last Day on Earth: Survival** (Kefir) is a DIFFERENT game: NEVER merge its recipe counts, POIs or base rules into this evidence without explicit comparison labeling. **Rules of Survival** is also different.
Analyze three historical windows separately:
- **H1: Mar–Oct 2019 classic island/restart loop**. Best direct match to user's likely early play and primary default for recipes, keycards, loot and reset.
- **H2: Nov 2019–Jul 2020**. Same family with substantially reworked map/airport, level rules, tier-2 radiation and new environmental/vehicle systems. On 2019-11-01: airport area grew 4–5×, Avenger boss, nuclear underground area expanded to five connected sections (S13).
- **H3: Aug–Dec 2020**. Crucial evolution: **personal Action Base** introduced Aug 27 2020 as a never-reset private persistent home while repeated restart sessions continued; resource transport and long-term achievements across loops (S14). Distinguish this from 2019 wipe mechanics and do NOT conflate later 2021 'base mode' economy with 2019 standard modes.
- 2025/2026 guides, current Last Island, Rust and other survival games can help fill architecture ideas, but their specifics MUST NOT masquerade as verified 2019–2020 facts.

## 1. VERIFIED GAME PREMISE AND GOAL SYSTEM
[H1 HIGH: S02,S03,S04] EG anti-cancer vaccine experiment caused mutant infection/zombie pandemic. X Research Institute's 'Civilization Restart' program brings survivors to a large mysterious Pacific island. Compete to survive 15 real-world days; culminating 'restart badge' drops/escape contest. This is a game premise/justification for reset and urgency, not a complex quest-driven RPG main story.
[H1 HIGH: S03,S05] Normal/PvE/Guardian/Solo cycles: 15 days; intense battle: 7 days. At final ~76 hours, badge drops; protections end ~71 hours. There are world reset, character-specific state, distinct modes and conditions. 2019 official FAQ said a session normally hosts up to 100 and can dynamically expand to 200 late. Rare learned recipes and cosmetic/achievement entitlements can survive reset depending on mode/version; world structures and most items do not (S03). Unlearned blueprint in backpack can drop at death; learned recipes survive death (S03).
[H3 HIGH: S14] 2020 Action Base is personal persistent no-reset construction with dedicated warehouse/workshop/farm etc, transactions between longer-term base and limited-time sessions; crucial precedent for dual-layer progression.
[SYSTEM INSIGHT/USER] The compelling need to start again stems not simply from 'progress deleted' but large unrealized possibility space + early rare item thrill + knowledge retained + different choices per trip. Avoid content exhausted in one run. User's personal 14-day experience reached only a few guns, unopened card rooms and untouched bases.

## 2. WORLD STRUCTURE / ENVIRONMENT / MAP LOGIC
[H1 HIGH S02,S06] Large continuous island: beaches, desert, rainforest, hills, snowfields and islands; 2019 reporting notes rivers/lakes and day-night. Real-world material placement has geography and routes. Roads connect monuments/POIs, yellow/blue/red roadside barrels and tool/food/supply crates in junk piles; low-risk repeatable scavenging loop runs independent of big bosses.
[H1 HIGH S06,S07] POIs: supermarkets, gas stations, abandoned factory, abandoned research institute, port/containers, airport, nuclear plant, twin air-defense bunkers, biochemical laboratory, bandit camp, and some hidden caves/guarded structures. Each POI offers a role in resource loop rather than merely cosmetic building.
[H2 HIGH S13] Early 2019 world layout cannot be treated as static: Nov 2019 airport larger (hangars, crashed airliner, signal tower) and nuclear plant had four underground entrances/five zones, with new boss/radiation. Use one pinned layout epoch in SOH and copy mechanics, not geolocations/assets.
[SOH DECISION] Entire continent designed from the start, including all geography/biomes/POIs/resources; current ten Chapter 1 dungeon exteriors clustered within starting ~1/4. No four empty unbuilt zones. World travel gradually possible via danger/gear/route/world-state and occasional alternate difficult route. Random material speckles rejected; place quarry near bedrock, wetlands in drainage, camp by road, ruins by old pathways.

## 3. RESOURCE TAXONOMY AND SPAWNING
[H1 HIGH S07,S08] Raw: wood, stone, iron ore/refined iron ore, sulfur ore, hemp/nettle/cloth, wild fruit, mushroom, meat/animal resources. Higher tech: iron ingots, refined ingots, gunpowder/sulfur powder, wood, springs, pipes, blades, gun bodies, components/scrap, resistors. Source/processing constraints are what makes progression meaningful.
[H1 HIGH S08] Yellow/blue barrels: scrap/components/manufacturing pieces, red barrels: crude oil/low-grade fuel. Tool crates: better tools/melee and chance mask/low gun; supply crates: semi-finished materials and chance weapons/armor; food crates: prepared food. Armory and high-grade armory: weapon materials/advanced gear; airdrops: exceptional weapons and raid tools. Breakable roadside props need persistent node IDs, yields and respawn rules.
[H1 HIGH S09,S10] Airdrops/monuments/boss are alternative top-tier sources; not every rare item must come from a boss. Specific 2019 official player-feature reports roughly 6-hour airdrop at one of airport, bandit, research, nuclear, port; crate becomes interactable 10 min after landing (version-specific, not global law).
[RELIABILITY LIMIT] 2019 comprehensive official respawn timings for all resources are NOT proven. A 2021 Action-Base guide gives roadside 4h, nodes 15–30min, POIs 12h, mineral areas 8h; this is **2021 base mode**, not reliable H1 default. Never bake these as exact historical 2019 values. Implement tunable spawn tables to be empirically playtested.

## 4. RESOURCE CONVERSION / FABRICATION AND THE CORE ECONOMIC GRAPH
[H1 HIGH S11,S12,S15] Gather tree/ore -> refining/furnace with fuel/time -> metal/processed resources -> workbench tier + recipe learned + intermediate parts -> output equipment; scrap is the *knowledge/research/workbench currency*. Disassembler/recycler at named resource sites converts unwanted finds to components/scrap; this creates an economic reason to pick up junk.
[H1 HIGH S12] Workbench has basic/intermediate/advanced tiers gating weapons and ammo; research station or random research can uncover formulas; drawing/copy bench can consume original item plus scrap to yield its blueprint. Workbench = manufactures; Research Station = learn through investment/random selection; Drawing Bench = reverse-engineer existing specimen. Three different operations, not one craft button.
[H1 MEDIUM S16] An early first-person player account indicates workbench tier upgrade ~500 / 1500 scrap, blueprint research ~150/300/600 scrap; later sources show differing costs (e.g. 2020 upgrade 300). Therefore **costs conflict across versions; do NOT claim one canonical exact tier price**. The engineering principle (three tiers, sharply increasing costs) is HIGH, literal numbers remain source-tagged sample.
[H1 HIGH S17] 2019 Drawing Bench example recipe: 200 iron ingots + 75 components (historical player guide; check game build before hard-coding).
[H1 HIGH S03] Recipe knowledge persists through death, physical copies do not; duplicates can be shared/stored, but not relearned. This creates meaningful distinction among 'found object', 'found recipe item', 'recipe knowledge', 'crafting prerequisites', 'remaining durability'.
[H1 MEDIUM S16] Standard weapons can be repaired at workbench using materials; special premium/refined items may not be repaired in some old versions. **NOT ALL WEAPONS PERMANENTLY SHATTER AFTER USE**. SOH Core can have repairable ordinary class and irreparable exceptional prototype class, but preserve user insistence on finite-use found Core and recreate knowledge.
[SOH DECISION] Define Resource, Component, Refinery Process, Recipe Unlock, Recipe Instance, Workstation Tier, Item Instance, Quality, RepairPolicy, LootSource separately. Don't simply turn skill unlocking into an infinite cooldown-free spell.

## 5. WHAT DO WE KNOW OF 'HOW MANY RECIPES'?
**No authoritative, dated, comprehensive 2019–2020 master recipe database/count was located in the accessible official sources. REPORT THE TOTAL AS UNKNOWN.** Different versions/modes/equipment rarity inflate count. Any single number claimed as the original game's exact total would be fabricated.
We can substantiate a **partial catalog**, NOT a total:
- [S18 2020-04-03 secondary] 3 named melee recipes/items (wooden club, kitchen knife, machete), 13 named gun variants across handguns/SMGs/assault/shotgun/snipers/launchers/LMG. Some gun lists contain more than one historical rarity variant, so distinct item definition counts may differ.
- [S19 2019-06-23] 8 ammunition recipe types: handmade 8mm, 9mm, 5.56mm, explosive 5.56mm, 7.62mm, explosive 7.62mm, shotgun shell, armor-piercing shell.
- [S20 2019-08-02] At least 5 food-processing recipes: canned meat, jam, fruit wine, mushroom soup, grilled mushroom.
- [S17] 1 documented Drawing Bench recipe; [S21] 1 documented motorcycle-frame recipe (not a count of vehicles/parts).
The examples from these sources **are overlapping samples and NOT mutually exclusive full inventory**. No total, no assertion that all were still valid in every version. Furniture/building, doors, traps, armor, consumables, stations, power, vehicle subcomponents and weapons attachments add further recipe families. The true content catalog should be built by a version-pinned readable archive/gameplay capture, not extrapolated from five guides.

## 6. VERIFIED HISTORICAL RECIPE EXAMPLES (VERSION-STAMPED; NOT SOH BALANCE)
[S19 | 2019-06-23]: Handmade 8mm ammo = 5 iron ingots + 3 gunpowder at basic workbench; 9mm = 10 iron + 5 gunpowder, basic workbench + learned blueprint; 5.56 = 10 iron + 5 gunpowder at mid bench + learned; explosive 5.56 = 10 iron + 20 gunpowder + 10 sulfur powder at advanced learned; 7.62 = 10 iron + 5 gunpowder at mid learned; explosive 7.62 = 10 iron + 20 gunpowder + 10 sulfur powder at advanced learned; 12g shotgun = 5 iron + 10 gunpowder at mid learned; armor-piercing 12g = 5 iron + 10 gunpowder + 20 sulfur powder at advanced learned.
[S18 | published Apr 2020]: Wooden club = 300 wood (no bench), kitchen knife = 15 iron ingot + 1 blade (basic + blueprint), machete = 100 iron + 3 blades (mid + blueprint); simple revolver = ~125 iron ingots + 25 cloth + metal tube (basic + blueprint); SMG = ~30 iron + 12 refined iron + 2 torsion springs (mid + blueprint); AKM = rifle body + 50 refined ingots + 2 pipes + 4 springs (advanced + blueprint). Original archive transcription has malformed/missing quantities in some other rows: **do not fabricate missing quantity**.
[S17 | Aug 2019]: Drawing Bench = 200 iron ingots + 75 components.
[S20 | Aug 2019]: Meat + tin can -> canned meat; fruit + cloth + can -> jam; fruit + can -> fruit wine; mushrooms + can -> mushroom soup; mushroom -> grilled mushroom. No trustworthy universal cook yield, time or fuel cost; do not invent.
[S21 | Jun 2019]: Motorcycle frame = 100 iron ingots + 30 refined ingots + 50 components, advanced bench and learned blueprint (historical guide).
Usage: these are **examples of graph constraints**, not values to copy literally into fantasy. A Core recipe should have biome-specific materials, intermediate parts, owned blueprint/knowledge, correct station tier and production time. Store each numeric formula with source, date, mode and confidence.

## 7. MULTISTAGE KEYCARD / RADIATION POI GRAPH
[H1 HIGH S07,S22] Green chips found on gas station/supermarket table, roofs of abandoned research/factory/port/nuclear, biochemical lab; green door commonly yields blue chip; blue doors in bunker/airport/nuclear commonly yield purple chip; purple rooms in bandit camp/biochemical lab/port give the best crates. Green < blue < purple is a **treasure-depth progression**, not simply dungeon level.
[H1 HIGH S07,S23] Entry also needs a resistor/fuse to power damaged generator, activate switch and respect hazards; 2019 POI guides give route-specific machine locations, and a boss (EG mutant) in biochemical lab. Field preparation matters: anti-radiation mask, food, ammo, backup supplies, sleep bag.
[H1 MEDIUM S24] A 2019 guide states 3 uses durability per colored card, different refresh intervals, some contradictory POI locations; do not make exact count/global respawn immutable without version pin. Better implement card charge as configurable and ensure visibly understandable wear.
[H2 HIGH S13] Nov 2019 upgraded purple rooms with **tier-2 radiation** that previous ordinary mask cannot prevent: fresh defensive tier, repeated exploration, old POI with new inner layer. Strong evidence for environmental gating beyond damage sponge boss.
[SOH ADOPT] Access chain: observe POI outside → find clue/Key-I → prepare resistance → restore ward/energy conduit → reach Key-II → elite/puzzle → deeper vault/Key-III → Core/blueprint/rare recipe; room-safe respawn; backtracking and different branches. No meaningless uniform 10 doors. Colored access keys translated to ritual seals/inscriptions; physical logic persists.

## 8. BUILDING AS GAMEPLAY (NOT A MENU)
[H1 HIGH S25,S26,S03] Free placement/multi-material, foundation & walls/doors, skyward/high structures, waterfront bases and complex inner geometry. Central **territory cabinet** establishes building ownership/rights, upkeep scope and access. Placement choices affect protection and economy.
[H1 HIGH S26,S12] Roofs/ceilings, utility, containers, racks, password locks, trap layouts, layered defenses, turrets, bedrooms/storage, furnace rooms, recycling/workbench. Advanced materials improve health/durability. Compact layout reduces maintenance. This is part of a real build system, not prefab placement.
[H1 HIGH S03,S27] Beds/sleeping bags determine respawn location; absent active bag yields random respawn. Player items drop on death, death marker and retrieval. Learned recipes remain after death; bound items exceptional.
[H1 HIGH S03] Different materials affect durability; upkeep failure caused building decay, raiders could destroy defenses. **For offline SOH**, preserve meaning of structural integrity/repair/placement/functional building but do NOT copy offline grief or 15-day resets.
[H3 HIGH S14] Persistent Action Base introduced different rules: no raid, no reset, ruined storage disabled but contents not destroyed, place and repair to recover. An excellent original evidence-based model for fair single-player base persistence.
[SOH ADOPT] Per-cell foundation/wall/door/roof/storage/workstation and room graph; roof only fades for room player entered; collision/nav updates; atomic construction cost and inventory, demolition and upgrade; spawn anchor and chest recovery; stable IDs and save. Claim NOT implemented yet.

## 9. PLAYER SURVIVAL / PHYSICAL SYSTEMS
[H1 HIGH S03,S05] Health + fullness (satiety). Gathering, cutting wood and time lower satiety; berries/cooked foods restore. When health reaches zero after damage or starvation, downed/crawling state with possible defibrillator self-recovery, then death and full carried-loot drop. Animals/infected are threats even without PvP.
[H1 HIGH S03] Player outdoors persists when logged off (multiplayer), can die; sleeping at shelter is strategic. Offline SOH should freeze while game not running, except explicitly selected deterministic in-game clock advancement—never kill player offline by timer.
[H1/H2 MEDIUM S02,S13] Weather, day-night and snowy/desert/rainforest environments existed; exact debuff tables for 2019 cold/heat/water were NOT verified. Radiation clearly demonstrated, Nov 2019 higher tier existed. SOH weather/temperature equipment are user-suggested extension, not a proven identical system from H1.
[SOH ADOPT] Simpler metabolic pressure than forced maintenance; meaningful protection tiers, warning FX/feedback, protective recipes and terrain counterplay. Need separate acceptability gate on boredom/attrition so challenge remains rewarding.

## 10. THREATS / COMBAT / RISKS
[H1 HIGH S02,S07,S09] Wildlife, infected, dangerous guards, periodic strong enemies, EG-mutant, bandit stronghold, airport soldiers; PVE exists independently of PvP. Better loot comes from riskier route. Weapons have ammo, condition, accessories/tiers, not just increasing damage.
[H2 HIGH S13] Avenger boss and nuclear basement elites and multilevel hazards. Seasonal airdrop and rare caches encourage exploration. A loot-and-retreat trip may be worthwhile without any boss.
[SOH ADOPT] Hero combat systems and GOLD full cast lifecycle remain. Physical Skill Cores act as weapons; core instances have uses and possibly quality; VFX cannot be faked; enemies get correct on-hit effects, terrain interaction and cleanup. Starter hero retains basic kit so a depleted Core does not softlock all combat.

## 11. FORMULAE ARE A GRAPH; NOT A LIST OF BUTTONS
Graph types:
A. Node gathering → raw resources (wood, ores, herbs, stones).
B. Salvage/scavenge → intermediate parts (blade, spring, body, pipe, shards, scrap).
C. Fuel+refinery+time → ingot/food/powder/refined materials.
D. Scrap+learnable blueprint specimen/research → permanent knowledge.
E. Workstation tier + knowledge + ingredients + production time → finished gear or Core.
F. Finished gear condition/uses, repair or disassemble → recovered components.
G. Protection+key+power+mob threat → deeper POI and new material/source.
H. Transport/base/inventory choices → time/capacity/risk constraints.
I. Sessions/endgame events → long-term knowledge and changing repeat-run choices (2020 persistent action base precedent).
A content-rich RPG requires graph branching and dependencies: a new ingredient is valuable if it enables a recipe, a machine, an access path OR makes an older mundane task more efficient. Avoid a linear 'one boss -> one resource -> next boss' checklist.

## 12. WORKING DESIGN TARGETS TO RECREATE THE 14-DAY 'UNFINISHED BUT HOOKED' FEEL
**User truth:** 14 days of original play, few guns unlocked, many POIs unopened, desire to restart and discover. This should be treated as a PRIMARY DESIGN QUALITY BAR.
[ENGINEERING GATE-APPROVED CANDIDATE] SOH uses two modes inside ONE product:
(1) **Persistent Living Continent / personal home**: no forced reset; player build, recipes and major map knowledge are saved. All biomes designed before release, first 10 dungeons in opening quarter.
(2) **Opt-in expedition cycles/scenarios**: finite escalating opportunities with procedural point-of-interest variations, limited supplies, hidden objectives, enemy/weather variance and meaningful unique rewards; restart with some retained knowledge and new expedition objectives. No copying the original 100-player PvP final-badge competition. This is a source-inspired feature design, not user-specified requirement to enforce a real-world 15-day timer. Keep design reversible/feature-flagged until playtesting.
[TARGET, NOT OBSERVED FACT] In a blind multi-session test paced like 14 days of normal play, a typical non-optimization player should complete several satisfying goals and acquire some distinct Core abilities, but still have **at least 3 credible self-directed goals in different systems**, unexplored major POIs and discoverable skill families. Exhaustion of meaningful content is a failure. Grinding meaningless duplicated materials to stretch time is also failure.
[TARGET] Every rare early Core must unlock visibly different tactical gameplay and a self-evident next goal: use now / research / source materials / new POI; do not flood inventory with 10 interchangeable bright icons in first session.
[TARGET] Fail if user can obtain all skill families and exhaust the first-quarter exploration without touching resource/research/build/travel decisions; also fail if after several sessions no meaningful rare discovery has occurred.
[TARGET] Resource pipelines change player behavior over time: first collect herbs in wild, then plant basic crops, then refine/automate ordinary inputs; exceptional core catalysts still send player out for exploration. Build != decorative storage-only.

## 13. SYSTEMATIC GAME->SOH FUSION MATRIX (EVIDENCE / ACTION)
C01 World biomes and monuments (S02,S07): ADOPT as region authoring grammar, world designed upfront.
C02 Road barrel components + salvage (S08,S10): ADOPT with repeatable routes / dynamic loot nodes.
C03 Craft, smelt and fuel production chain (S11,S12): ADOPT via transactional SaveService.
C04 3-tier workstation (S12): ADOPT as typed station progression, costs SOH-balanced.
C05 Random research and reverse-engineer specimen (S03,S12): ADOPT both; ensure non-RNG deterministic route to key core recipes.
C06 Repeated blueprint unlocks persist through death (S03): ADOPT, knowledge independent from physical Core.
C07 Ordinary gear repair versus special finite gear (S03,S16): ADOPT distinction; exact Core use/repair numbers to tune.
C08 Green->Blue->Purple tiered key access and generator/switch (S07,S23): ADOPT functional graph, translate to fantasy ward seals.
C09 Anti-radiation and nested higher-grade hazards (S13): ADOPT tiered environmental protection.
C10 Authentic foundation-wall-door-roof rooms (S25): ADOPT freeform top-down + per-room roof hide.
C11 Actual territory/storage/utility economy (S25,S14): ADOPT base + workstations + chests + beds + crop beds.
C12 PvP raiding and online-only upkeep (S02,S03): REJECT compulsory offline equivalents; translate threat to authored PvE/survival events.
C13 Forced 15-day full-world wipe (S03): REJECT for permanent home; ADOPT optional replayable expedition logic grounded by H3 dual-layer.
C14 PvE monsters/elite/boss (S07,S13): ADOPT and preserve SOH boss/dungeon combat.
C15 Real-world card numbers and exact item recipe quantities: REJECT wholesale copy; preserve only versioned examples in research catalog.
C16 Exact total number of recipes in historical build: UNKNOWN → cannot certify; **decision is FAIL to claim numeric count** until original version-specific inventory verified.
C17 Cross-world permanent Action Base 2020 (S14): ADOPT as strong precedent for persistent SOH home.
C18 User's GOLD VFX: LOCKED; each Core needs source-verified actual Godot port, not static imitation.
C19 Public player's own 14-day partial discovery experience: LOCKED; long-horizon content/unknown-goals retention gate.
C20 Experimental weather, farm, NPC automation: ADOPT farm as user-requested economy; weather hazard selected as user-proposed; NPC auto-production is a later gated subsystem, not automatic full-scope done.
C21 Strong environmental and route logic (2019 map, SOH user): ADOPT no random speckle terrain and no arbitrary region boundaries.

## 14. BINARY DECISION GATES (AGENT MAY APPROVE, NOT PERMANENTLY LEAVE UNCLEAR)
- **F0 Identity/date:** direct 2019–2020 primary source or independently corroborated 2019 contemporary account? YES -> verified; NO -> label reference only, do not assert original fact.
- **F1 Player-value:** does mechanic advance exploration/building/knowledge/risk/long-run motivation? YES -> proceed; NO -> reject or defer OUT OF SCOPE with explicit reason (defer is not passive waiting, it is a decision).
- **F2 Port legality:** own work / licensed MIT code / separately cleared artwork? YES -> integrate; NO -> cannot copy, implement from behavior specification.
- **F3 SOH compatibility:** respects existing Hero/dungeon/VFX/SaveService/10-cluster/world fidelity? YES -> proceed; NO -> redesign to preserve.
- **F4 Complexity and reliability:** same contract IDs, migration, no dupes, native 2D usability, collision/perf and Web? YES -> implementation gate pass; NO -> fail + concrete fix.
- **F5 Experience:** rare skill dopamine + worthwhile endgame frontier after extended 14-session play and no forced mindless grind? YES -> production accept; NO -> revise economy/content placement.
Every feature outcome is **APPROVED_DESIGN, REJECTED, BLOCKED_EVIDENCE (specified missing source), VERIFIED_IMPLEMENTATION or FAILED_TEST**. 'Proposed forever' disallowed. Approved design is not equivalent to implemented code. Research uncertainty is a factual classification, not 'approval limbo'.

## 15. WHAT TO BUILD NEXT / RELATION TO EXISTING ISSUE #9
**Research phase result:** historical replay + dual persistent-base mechanism has strong first-party confirmation. Transition to actual implementation after archival sync.
1. Contract: static full continent world blueprint + dynamic persistent construction and resource nodes + loot/research/recipe item graph, based on SOURCE-OF-TRUTH SaveService.
2. SURV-010 begin harvest → item inventory → paid build placement → save/reload and topology/collision proof. Not a milestone for release, just engine first integration.
3. SURV-020 roofed base/chests/bed/respawn/farming; SURV-030 tiered research/crafting/loot; SURV-040 limited uses Core with exact source-verified Gold; SURV-050 complete continents/POIs/progressive access; SURV-060 long-run + repeat expedition + playtest. These tasks must converge into full game rather than endless demo.
4. Add explicit **14-DAY DEPTH / REPLAY GATE** to ACCEPTANCE and `STATE.json`: scenario matrix from start through multiple long-form sessions, count meaningful unopened POIs/recipes/Core families, non-repeat fetch goals, and prove deliberate rerun strategies.
5. Never claim run/test or code done from this research artifact. CI handoff validator alone ≠ gameplay.

## 16. SOURCE INDEX: PUBLISHED DATE / SCOPE / CONFIDENCE
S01 [official corporate 2019 timeline] https://www.hero.com/p/story.html
S02 [official game premise/biomes] https://hero.yingxiong.com/index
S03 [2019-07-30 official FAQ, also mirrored 4399 2019-08-01] https://hero.yingxiong.com/info/2019/0730/6973.html
S04 [2019-08-07 official game mode/restart] https://game.xiaomi.com/viewpoint/1103968488_1565170379066_13
S05 [2019-08-15 official story/endgame] https://game.xiaomi.com/viewpoint/1103968488_1565851573016_16
S06 [2019-08-20 world coverage] https://shouyou.gamersky.com/news/201908/1215063.shtml
S07 [2019-08-07 official 3-key-card POI locations] https://hero.yingxiong.com/info/2019/0807/7028.html
S08 [2019-06-20 resource spawn crate categories] https://shouyou.3dmgame.com/gl/133819.html
S09 [2019-09-27 official showcased player weapons and loot-source listing] https://hero.yingxiong.com/m/info/2019/0927/7249.html
S10 [2019-08-02 roads, lab, hidden boss guide] https://www.gamersky.com/handbooksy/201908/1209408.shtml
S11 [2019-06-19 practical player gathering/cabinet/research] https://www.taptap.cn/moment/15201304955586452
S12 [2019-08-01 starter, repair, smelting/research/raiding] https://www.gamersky.com/handbooksy/201908/1208859.shtml
S13 [2019-10-31 official 2019-11-01 patch: new map, airport, nuclear rooms and tier-2 hazard] https://hero.yingxiong.com/info/2019/1031/8033.html
S14 [2020-08-26 official 2020-08-27 Action Base 'never restart', logistics/warehouse/research/farming] https://hero.yingxiong.com/info/2020/0826/10634.html
S15 [2019-06-27 material and recycler/scrap] https://www.9game.cn/daihaoyingxiong/3280240.html
S16 [2019 player guide version for recipe/research costs/repairs, unverified anecdotal] https://www.ourplay.net/find/detail/84467
S17 [2019-08-17 drawing station recipe] https://www.9game.cn/news/3483752.html
S18 [2020-04-03 dated item/weapon recipe examples, community post] https://www.dlyybbs.com/t28
S19 [2019-06-23 ammunition recipe table] https://www.9game.cn/daihaoyingxiong/3254982.html
S20 [2019-08-02 food recipes] https://www.9game.cn/news/3416705.html
S21 [2019-06-26 motorcycle frame recipe] https://shouyou.3dmgame.com/gl/135015.html
S22 [2019-08-14 card location + charges, contradictory by map variants] https://www.9game.cn/daihaoyingxiong/3470386.html
S23 [2019-09-02 official card/key generator switches walk-through] https://hero.yingxiong.com/m/info/2019/0902/7090.html
S24 [2019-10-17 map resource distribution] https://www.3h3.com/news/200253.html
S25 [2019-07-31 official freeform building and infected] https://hero.yingxiong.com/info/2019/0731/6999.html
S26 [2019-08-01 early base and storage design advice] https://www.gamersky.com/handbooksy/201908/1208859.shtml
S27 [2019-07-30 death/bedroll] https://m.4399.cn/news-id-895194.html

**Evidence conflicts and unresolved fact boundaries**: conflicting 2019/2020/2021 station upgrades and respawn clocks; changes across H1/H2/H3; exact recipe total unavailable; 2019 source publication and actual client build may not exactly align; no original proprietary code/build inspected. They do not block approving behavior-level design, but block assertions of precise numbers/version truth.


## 17. ADDENDUM: UNDER-DOCUMENTED MECHANICS FOUND IN CONTEMPORARY 2019 SOURCES
[S28 | 2019-05-25 player 'cold facts'] **Structural support**: very tall/complex structures cannot be placed without sufficient foundation / load-bearing wall or door/beam reinforcement. Height and connected foundation matter. Door health was reportedly far below full wall health; multi-layer walls and partitions matter. Regular beds/storage can be destroyed with melee, roadside camping bags can be deployed near monuments to shorten recovery, and swappable ammo/weapon accessories exist. Some of these are personal guide heuristics rather than immutable rules. SOH must translate load-bearing constraints into top-down legal footprint, support graph and stair/upper-floor segments, not create unsupported floating floors. A playable shelter is a functionality requirement; fully multi-storey structures belong to a tested construction extension.
[S28] **Biome→resource ecology**: desert sulfur richer, snow iron richer, forest berries/mushrooms richer, wolf groups in packs; unnamed shacks, camps and caves can contain damaged rare crates. This is crucial for the user's causal non-random map rule: biome should shape resource economics and enemy ecology.
[S28] **Production behavior**: item manufacture does not always require remaining beside workbench during countdown; splitting furnace inputs into multiple stacks can accelerate processing. Do not interpret this as a universal crafting speed formula—implement queue and concurrent batch semantics only where defined. Card attempt without powered circuit can still consume charge: a salient "prepare before using rare key" risk, but in SOH ensure clear UI warning to avoid unfair irreversible loss.
[S28] **Quest interface**: survival manual beyond tutorial need not be mandatory, strengthening self-directed open exploration model. Also automatic use of heal/food via health/hunger indicators was available.
[S29 | 2019-09-27 official] In-session vending machines/trade coupons and persistent cross-session trade currency were already emerging in **2019**, distinct from later 2020 Action Base. For offline SOH, this suggests economic sinks, merchants, wandering buyers and exchange systems as functional counterparts to multiplayer market rather than leaving all sellable junk valueless.
[S14 | 2020-08-27 official] Personal Action Base explicitly introduced **plantable crops in tens of varieties with distinct growth times** and *dozens of cooking recipes*, separate from 2019 baseline food examples. No verified full enumeration/total for each. Action Base bounty board supports gathering, hunting, leisure objectives and rewards; stations have upgrade queue and unlock functional limits, storage/workshop quotas and bound transport between personal base and time-limited battle. Original 2020 base was not purely decorative.
[S14 | 2020-08-27 official] Base durability zero can cause facilities to stop functioning but NOT spill their contents; a fair repair recovery rule—prefer this as SOH offline default over destructive upkeep that deletes loot.
**Extra evidence**
S28 [2019-05-25 deep player mechanics] https://www.taptap.cn/moment/15218919606324324
S29 [2019-09-27 official economy update] https://hero.yingxiong.com/info/2019/0927/7231.html

## 18. COMPLETE BEHAVIOR TRANSFER IS BROADER THAN JUST FEATURE NAMES
A near-complete gameplay reconstruction must specify **verbs** (equip/repair/disassemble/copy/research/refine/harvest/place/rotate/demolish/upgrade/store/transfer/charge/unlock/power/switch/fail/recover), **prerequisites** (station tier, known recipe, raw + intermediate components, fuel, access credential, environmental resistance, spatial support, ownership), **persistence** (item instance, recipe, crafted workstations, protected home, visited POI, last container, expiring expedition, bag/death), **risk and reward** (loot tier, rarity, used card durability, attrition, death recovery, PvE) and **frequency** (replenishing roadside nodes vs high-value vault cooldowns vs one-time world discoveries). The acceptance matrix must prove these combinations via actual actions. The user explicitly prioritizes this behavioral near-parity, with top-down skill fantasy as the main medium shift—not a few loosely inspired mechanics.
