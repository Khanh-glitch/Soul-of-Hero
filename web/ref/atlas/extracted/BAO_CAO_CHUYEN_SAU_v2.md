# LAST ISLAND / 文明重启 — MECHANICAL ATLAS v2
**Research date:** 2026-11-04  |  **Focus:** independent reconstruction; no comparison with any other game.

## Research method
Use graph traversal **product → ingredients → source acquisition → container type → POI access** and reverse lookup **material → products/technology functions**. All quantities are reported as source facts or as explicit arithmetic over reported recipes. Dates are retained as provenance, not used to discard mechanics. Do not invent rates when sources say probable/guaranteed without a numeric denominator.

## Size of structured research
- Recipes: **51** (from 19 in v1), split: ammunition=2, combat=16, construction=2, defense=2, electricity=5, energy=2, food=7, fuel=2, medical=3, metalworking=5, research=1, tools=2, transport=2.
- Direct item-to-container edges: **82**, representing **36** distinct item identifiers.
- Specializations: **17**; POI access edges: **19**; historical source records: **45**.

## 1. Industrial graph: intermediates and manufactured capabilities
The recurrent industrial intermediate sinks are metal blade, metal pipe, torsion spring, mechanical gear, iron plate, plus scavenged gun bodies / launcher mechanisms. Components are **not equivalent**: gear is a mechanical gate for vehicles, doors, ladders and traps; spring/pipe form a common firearm subgraph; electronic parts enable electricity and energy extraction. Some special components are acquisition-only in the current documentary dataset, intentionally remaining unexpanded in BOM.

**Electric Door**: direct ingredients = iron_ingot×50, electronic_parts×5, mechanical_gear×1, iron_plate×10. Fully expanded to known recipe leaves = electronic_parts×5, iron_ingot×100, parts×365, refined_iron_ingot×50. Sources: s_door.

**Motorcycle**: direct ingredients = refined_iron_ingot×200, vehicle_frame×1, mechanical_gear×30, iron_plate×30. Fully expanded to known recipe leaves = iron_ingot×1600, parts×2900, refined_iron_ingot×380. Sources: s_motor.

**Rocket Launcher**: direct ingredients = refined_iron_ingot×50, metal_pipe×6, torsion_spring×5, launcher_mechanism×1. Fully expanded to known recipe leaves = launcher_mechanism×1, parts×505, refined_iron_ingot×105. Sources: s_rocket.

**MG4**: direct ingredients = launcher_mechanism×1, refined_iron_ingot×80, metal_pipe×6, torsion_spring×5. Fully expanded to known recipe leaves = launcher_mechanism×1, parts×505, refined_iron_ingot×135. Sources: mg4_2019.

**AKM modified**: direct ingredients = rifle_body×1, refined_iron_ingot×50, metal_pipe×2, torsion_spring×4. Fully expanded to known recipe leaves = parts×320, refined_iron_ingot×80, rifle_body×1. Sources: akm_2020.

**Steel Folding Ladder**: direct ingredients = refined_iron_ingot×30, wooden_ladder×1, mechanical_gear×3. Fully expanded to known recipe leaves = iron_ingot×150, parts×195, refined_iron_ingot×30, rope×3, wood×300. Sources: foldladder_2019.

**Energy Ore Extractor**: direct ingredients = refined_iron_ingot×30, metal_pipe×5, electronic_parts×10, mechanical_gear×10. Fully expanded to known recipe leaves = electronic_parts×10, iron_ingot×500, parts×800, refined_iron_ingot×55. Sources: energy_2021.

### Raw-material expansion caveat
An expanded BOM is the hypothetical **self-craft all known intermediates** scenario. It is *not* an actual mandatory investment, because several intermediates may be directly scavenged/recycled. It also omits smelting/fuel/workstation construction and travel costs, where data is absent. Leaves such as `refined_iron_ingot`, `parts`, `rifle_body`, `launcher_mechanism`, or `electronic_parts` are *unexpanded*, not necessarily natural raw materials.

## 2. Detailed weapon manufacturing and sourcing
The reference uses **separate firearm body items** for pistol, SMG, rifle, sniper and shotgun families. Crafting a gun and finding a finished gun are different routes. 2019 official-hosted player guide lists 17 equipped weapons with direct container eligibility; 2020 weapon-cookbook community compendium supplies detailed recipes, allowing these to be joined by matching item identities. Source differences (e.g. FAMAS stats) are retained as contradictions, not reconciled by guess.

| Weapon | Workbench | Direct recipe | Loot sources / known gate |
|---|---:|---|---|
| Machete | 2 | iron_ingot×100, metal_blade×3 | advanced_military_box, supply_box, toolbox |
| Semi-auto Rifle | 2 | iron_ingot×450, refined_iron_ingot×30, torsion_spring×2 | military_box |
| Rocket Launcher | 3 | refined_iron_ingot×50, metal_pipe×6, torsion_spring×5, launcher_mechanism×1 | advanced_military_box, airdrop |
| Wooden Club | 0 | wood×300 | toolbox |
| Cleaver | 1 | iron_ingot×15, metal_blade×1 | supply_box, toolbox |
| Simple Revolver | 1 | iron_ingot×125, cloth×25, metal_pipe×1 | starter_quest_reward |
| Semi-auto Pistol | 2 | handgun_body×1, refined_iron_ingot×4, metal_pipe×1 | military_box, supply_box, toolbox |
| SMG | 2 | iron_ingot×30, refined_iron_ingot×12, torsion_spring×2 | military_box, supply_box |
| FAMAS modified | 3 | smg_body×1, refined_iron_ingot×15, torsion_spring×2 | advanced_military_box, airdrop, login_day3_reward |
| AKM modified | 3 | rifle_body×1, refined_iron_ingot×50, metal_pipe×2, torsion_spring×4 | advanced_military_box, airdrop, military_box |
| QBZ97 | 3 | rifle_body×1, refined_iron_ingot×50, metal_pipe×2, torsion_spring×4 | advanced_military_box, military_box |
| K31 Bolt-action | 2 | sniper_body×1, refined_iron_ingot×20, metal_pipe×1, torsion_spring×1 | advanced_military_box |
| M24 Bolt-action | 3 | sniper_body×1, refined_iron_ingot×50, metal_pipe×2, torsion_spring×4 | advanced_military_box, airdrop |
| Single Shot Shotgun | 2 | refined_iron_ingot×15, iron_ingot×30, torsion_spring×1, metal_pipe×1 | military_box, supply_box |
| Double Barrel Shotgun | 3 | shotgun_body×1, refined_iron_ingot×20, metal_pipe×2, torsion_spring×1 | advanced_military_box, airdrop |
| MG4 | 3 | launcher_mechanism×1, refined_iron_ingot×80, metal_pipe×6, torsion_spring×5 | airdrop |

**2020 field-guide cross-check:** a guided road-scavenging account explicitly recommends converting found gears/pipes/blades through the Recycler to get Parts and taking a shortcut to refined materials. It reports around 2 Parts from a barrel in that narrated scenario. Treat that as an observation, not a universal yield function. Source: recycler_story_2020.

## 3. Airdrop / item / container access graph
Official-hosted 2019 guide gives named loot channels; particularly **high-tier military boxes** and **airdrops** differ in firearms/ammunition. Airdrops have a reported six-hour recurrence, appear at named POIs, are visible on the map, and unlock for looting after ten minutes. Some reward routes (starter quest or day-3 login) must not be mislabeled as a crate.

| Container | Supported items (eligible, NOT a drop percentage) |
|---|---|
| advanced_military_box | akm, ammo_12g, ammo_12g_ap, ammo_556, ammo_556_he, ammo_762, ammo_762_he, ammo_9mm, double_barrel_shotgun, famas, handmade_explosives, improved_grenade, k31, m24, machete, mechanical_gear, military_c4, qbz97, refined_iron_axe, rocket_ammo, rocket_launcher |
| airdrop | akm, ammo_12g_ap, ammo_556_he, ammo_762_he, double_barrel_shotgun, famas, handmade_explosives, m24, mg4, military_c4, rocket_ammo, rocket_launcher |
| login_day3_reward | famas |
| military_box | akm, ammo_12g, ammo_556, ammo_556_he, ammo_762, ammo_9mm, barrel_bomb, dirt_grenade, handmade_explosives, improved_grenade, mechanical_gear, qbz97, semi_auto_pistol, semi_auto_rifle, single_shot_shotgun, smg |
| red_barrel | crude_oil, low_quality_fuel |
| starter_quest_reward | simple_revolver |
| supply_box | ammo_12g, ammo_556, ammo_556_he, ammo_762, ammo_9mm, barrel_bomb, cleaver, iron_axe, machete, mechanical_gear, semi_auto_pistol, single_shot_shotgun, smg |
| toolbox | ammo_12g, ammo_12g_ap, ammo_556, ammo_556_he, ammo_762, ammo_762_he, ammo_9mm, cleaver, iron_axe, machete, refined_iron_axe, semi_auto_pistol, wood_club |
| unspecified_loot_crate | steel_folding_ladder |
| yellow_blue_barrel | mechanical_gear, parts |

## 4. POI access as a directed route graph
The route is not a single linear quest. Green cards have many static spawn locations, Blue cards can appear on airport roof as a shortcut, some damaged crates may bypass a rung, and a high-risk biolab boss is another alternative. Colored rooms combine **card credential + power**, and an official-hosted 2019 player guide mentions a three-hour spawn for some Blue→Purple and EG mutant contexts.

| Where | Unlock/result | Condition | Evidence |
|---|---|---|---|
| supermarket | green_keycard | table spawn | authoritative-player-guide |
| gas_station | green_keycard | table spawn | authoritative-player-guide |
| abandoned_research_facility | green_keycard | roof spawn | authoritative-player-guide |
| port | green_keycard | roof spawn | authoritative-player-guide |
| nuclear_power_plant | green_keycard | roof spawn | authoritative-player-guide |
| airport | blue_keycard | roof spawn, enemies nearby | authoritative-player-guide |
| green_card_room | blue_keycard | powered + green card | guaranteed_in_source |
| blue_card_room | purple_keycard | powered + blue card, 3-hour refresh reported | guaranteed_in_source |
| abandoned_factory | green_keycard | roof spawn | authoritative-player-guide |
| biolab | green_keycard | toilet spawn | authoritative-player-guide |
| biolab | purple_keycard | defeat EG mutant, 3-hour spawn reported | secondary-guide |
| bunker | blue_card_room | powered door | authoritative-player-guide |
| airport | blue_card_room | powered door | authoritative-player-guide |
| nuclear_power_plant | blue_card_room | powered door | authoritative-player-guide |
| bandit_camp | purple_card_room | card + electric power, high infected pressure | authoritative-player-guide |
| biolab | purple_card_room | card + electric power, EG mutant | authoritative-player-guide |
| port | purple_card_room | card + electric power | authoritative-player-guide |
| damaged_box | green_keycard | described as likely (qualitative), may yield 2 cards | qualitative |
| damaged_box | blue_keycard | described as rare (qualitative), may yield 2 cards | qualitative |

## 5. Building, electricity and emergent construction
2019 construction treatise details square vs triangle foundations, roof/stair support, hidden storage and bases, and shows that a building is more than a HP object. Doors have ~one third HP of same-grade walls (community reported). Foundation count can raise territory cupboard upkeep. The grid can be combined to create maze traps, concealed turret fire lines, storage hiding and selective access. Electrical control supports generator, manual/pressure/infrared switches, electric doors and industrial lights; power-off doors close. These are **compositional mechanics**, not individually scripted prefab buildings.

| Connected foundation count | Reported extra upkeep |
|---:|---:|
| 0+ | +0% |
| 24+ | +30% |
| 28+ | +60% |
| 32+ | +100% |
| 36+ | +140% |
| 40+ | +190% |
| 44+ | +230% |
| 48+ | +275% |

## 6. Defense, chemistry and ammunition
12-gauge and armor-piercing 12-gauge shotgun ammo both power the shotgun turret; the latter additionally needs sulfur powder and a higher bench. Other turret types differ in accuracy, rate and tactical positioning. A bear trap requires manual rearm; spikes persist while durable. The ammunition recipes stop at gunpowder and sulfur powder because their own sources/formulas remain unresolved. No incomplete chain is silently closed.

## 7. Medical, food and fuel
Food preparations have material combinations using tin, cloth, berries, meat and mushroom. Medical chain: cloth→bandage; needle tube + fuel + iron → syringe; syringe×2 + fuel + wood + iron → medkit. The exact recipe numbers here come from a **2025 compilation**, rather than 2019 testimony; no release is discarded, but every numeric fact retains provenance. Fuel routes include red barrels for crude/low-grade fuel, animal fat + cloth as low-grade fuel, and an oil refinery for processing crude. Precise refining ratios/times remain open.

## 8. Survival and real-time structure
2019 Q&A says 15 real days; day/night need not track real life. Mode rules include PvE with temporary PvP restriction that lifts near the end; it is not a permanent solo game. During logout player body remains exposed; death drops carried items; learned recipes persist in that source model while unlearned blueprints drop. Territory cupboard maintenance decays unattended buildings. This describes a **coupled economic+temporal** system with reasons for beds, defenses, food, upkeep and safe logout.

## 9. Top unresolved technical facts for targeted archival research
| ID | Missing measured relationship | Required evidence |
|---|---|---|
| U01 | Exact per-item Recycler return (metal blade, can, pipe, gear, firearm bodies, etc.) | Recorded recycler screen/video or legacy item tables |
| U02 | Per-item exact drop rates/stack counts from barrel, toolbox, Supply, Military, Advanced Military and Airdrop | Official table or repeated unedited opening footage with denominators |
| U03 | Ore/wood yield per tool hit, time-to-break, rare refined iron probability by tool tier | Tool info screens with impact + controlled comparative videos |
| U04 | Ore→Ingot yield ratio, furnace fuel/time, large furnace throughput | Furnace UI/old patch notes/recorded craft queue |
| U05 | Respawn intervals for every crate type / static POI across modes | POI refresh guides / video elapsed world timer |
| U06 | Craft quantities for ammunition per recipe and repair cost by remaining durability | Workbench screenshots with output counts |
| U07 | Energy ore extraction throughput and energy consumer registry | Energy-device UI + guide with downstream items |
| U08 | Absolute upkeep cost formula by material/footprint/size | Territory cupboard readouts and comparison table |
| U09 | FAMAS contradictory damage/fire-rate/magazine figures across source snapshots | Official item stat screen original version |
| U10 | Gunpowder and sulfur powder full material recipes | Combat crafting recipe tables and item information screenshots |
| U11 | Vehicle fuel use, speed, storage, wear/repair and spawn-position distribution | Vehicle guides + item stats + map locations |
| U12 | Damage/status/armor values for all hazards and creature types | In-game stat cards and observed damage tables |

## 10. Disputed / provenance facts
**FAMAS:** 2020 community book lists damage 65 / rate 625 / mag 25, while a June 2020 republished guide shows damage 45 / rate 667 / mag 40 with the same recipe. These cannot be merged into one trusted stat profile. Atlas preserves both as variant source records.

**Qualitative loot:** “guaranteed”, “likely”, and “chance” are categorical findings; the dataset does **not** translate them into fabricated percentages. The 2 Parts/barrel remark seen in another guide is a contextual observation, not a universal guaranteed quantitative rule.

**Armor, ore, map:** More specialized subgraphs remain open (exact mining yield/time, refinery mass balance, damage tables, drop rates). The unresolved table explicitly records the evidence needed.

## Sources — original and expanded
- **akm_2020** — 2020-06-28: [AKM recipe, loot and weapon stats from 4399](https://a.4399.cn/gl/020918173_115226.html)
- **ammo_2019** — 2019-06-28: [Shotgun turret uses 12-gauge, ammo and armor-piercing ammo recipes](https://www.9game.cn/daihaoyingxiong/3279791.html)
- **coldfacts_2019** — 2019-05-25: [Community cold facts: bench distance after queueing, foundation support, decoy construction, biomes](https://www.taptap.cn/moment/15218919606324324)
- **drawing_2019** — 2019-10-29: [Drawing bench formula 200 iron +75 Parts, original-object copying mechanic](https://www.9game.cn/news/3786502.html)
- **energy_2021** — 2021-08-09: [Energy refinery and specialized extractor recipes; material source paths](https://www.biubiu001.com/wpzzwmcq/38708.html)
- **foldladder_2019** — 2019-08-08: [Steel folding ladder: 30 refined iron + wooden ladder + 3 gears; parent ladder recipe](https://www.9game.cn/news/3442605.html)
- **food_2019** — 2019-08-02: [Food recipe names and conceptual inputs (some quantities not stated)](https://www.9game.cn/news/3416705.html)
- **house_2019** — 2019-09-25: [Deep player house construction treatise with maintenance thresholds, structures, turret behavior, circuit](https://www.9game.cn/daihaoyingxiong/3660151.html)
- **loot_2019** — 2019-08-14: [Road yellow/blue guaranteed Parts; Supply probable parts; recycling old items](https://www.9game.cn/daihaoyingxiong/3467983.html)
- **maintenance_2019** — published 2022, 2019 adjustment described: [Territory cupboard maintenance 1000wood/30min baseline vs 3000wood/day revision; 25m area](https://www.aspxhome.com/youxi/2022/399674.htm)
- **med_2025** — 2025-01-14: [Food and medical explicit ingredient amounts, syringe and medkit health impact](https://www.9game.cn/news/10769547.html)
- **mg4_2019** — 2019-06-25: [MG4 recipe, station and stats](https://www.9game.cn/daihaoyingxiong/3270545.html)
- **official_poi_2019** — 2019-08-07: [Official-hosted POI guide: card spawn, colored doors, three-hour refresh, generator/resistor dependency](https://hero.yingxiong.com/info/2019/0807/7028.html)
- **official_weapons_2019** — 2019-09-27: [Official-hosted player weapon source matrix, ammunition and explosives; airdrop six-hour period](https://hero.yingxiong.com/info/2019/0927/7249.html)
- **pois_2020** — 2020-09-26: [Hidden damaged crates, keycards, named POI and lab boss](https://game.xiaomi.com/viewpoint/1127866428_1601132863008_16)
- **qa_2019** — 2019-08-01: [Launch Q&A: 15-real-day run, modes, hunger, death, persistent learnt blueprints, offline danger, level 100](https://news.4399.com/zhytgz/zixun/m/895413.html)
- **recycler_story_2020** — 2020-06-24: [Guided scavenging route: 2 Parts/barrel anecdote; reverse engineering refined axe; recycler of gears/pipes/blades and refined metal shortcut](https://news.4399.com/zhytgz/xinde/m/895633.html)
- **research_2021** — 2021-08-25: [Research bench random draw 1000 Parts example and destructive sample drawing](https://hero.yingxiong.com/m/info/2021/0825/6977.html)
- **s_2019community** — undated: [2019 community source families and green-blue-purple cards](https://www.taptap.cn/moment/15201304955586452)
- **s_2019poi** — undated: [POI crate counts and enemies, 2019-06](https://www.hackhome.com/info/483950.html)
- **s_2020pve** — undated: [2020 PvE beginner experience and recycler loop](https://news.4399.com/zhytgz/xinde/m/895633.html)
- **s_2022future** — undated: [Updates to crate tier segmentation](https://hero.yingxiong.com/info/2022/1109/13052.html)
- **s_axe** — undated: [Refined Iron Axe recipe, tool source, craft time and durability](https://www.9game.cn/daihaoyingxiong/4515476.html)
- **s_blade** — undated: [Blade 30 Iron + 15 Parts, mid Workbench](https://www.9game.cn/daihaoyingxiong/3294352.html)
- **s_cards** — undated: [Developer-published 2019 location/keycard gate source](https://hero.yingxiong.com/info/2019/0807/7028.html)
- **s_door** — undated: [Electric Door + generator + multiple control recipes](https://www.9game.cn/news/3336352.html)
- **s_frame** — undated: [Vehicle Frame 100 Iron + 30 Refined Iron + 50 Parts](https://shouyou.3dmgame.com/gl/135015.html)
- **s_fuel** — undated: [Crude oil refinery and low-quality fuel from fat+cloth](https://www.9game.cn/news/3448709.html)
- **s_gear** — undated: [Mechanical Gear 50 Iron Ingots + 65 Parts, mid Workbench](https://www.9game.cn/daihaoyingxiong/3279007.html)
- **s_ironaxe** — undated: [Iron Axe 75 Iron +100 Wood, basic Workbench](https://www.aspxhome.com/youxi/2023/397622.htm)
- **s_loot** — undated: [2019 item categories for barrel/crate types](https://shouyou.3dmgame.com/gl/133819.html)
- **s_machete** — undated: [Machete 100 Iron + 3 Blades, mid Workbench](https://www.9game.cn/daihaoyingxiong/3298149.html)
- **s_motor** — undated: [Motorcycle 200 Refined Iron + Frame + 30 Gears + 30 Plates](https://www.9game.cn/news/3676549.html)
- **s_official2022** — undated: [Official 2022 crate tiers and card-room composition](https://hero.yingxiong.com/info/2022/1109/13052.html)
- **s_pipe** — undated: [Rocket launcher raw recipe and Pipe material 5 Refined Iron + 30 Parts](https://www.aspxhome.com/youxi/2023/388245.htm)
- **s_plate** — undated: [Iron Plate 5 Refined Iron + 30 Parts, mid Workbench](https://www.9game.cn/news/3334146.html)
- **s_poicensus** — undated: [POI crate and keycard rooms by place](https://m.duote.com/tech/wmcq/135559.html)
- **s_recycler** — undated: [PvE recycler, refined iron, iron barrels and source traversal](https://news.4399.com/zhytgz/xinde/m/895633.html)
- **s_refinery** — undated: [Oil Refinery crafting requirements and low-grade fuel inputs](https://www.9game.cn/news/3448709.html)
- **s_rifle** — undated: [Semi-Auto Rifle 450 Iron +30 Refined Iron + 2 Springs](https://www.9game.cn/news/3425504.html)
- **s_rocket** — undated: [Rocket Launcher 50 Refined +6 Pipes +5 Springs +Launcher mechanism](https://www.aspxhome.com/youxi/2023/388245.htm)
- **s_spring** — undated: [Torsion Spring 5 Refined Iron + 65 Parts, mid Workbench](https://www.9game.cn/news/3305575.html)
- **source_forge_2019** — 2019-09-28: [Motorcycle BOM, refined ore and multi-channel frame/gear/plate](https://www.9game.cn/news/3676549.html)
- **trap_2019** — 2019-10-21: [Wood spike and bear trap recipes; durable/rearm behavior](https://www.onlinedown.net/article/10012371.htm)
- **weapon_cookbook_2020** — 2020-04-03: [Weapon recipe and stat compilation including handgun/rifle bodies and refined metal parts](https://www.dlyybbs.com/t28)

---
**Research status:** This is a significantly expanded *source-indexed mechanical reconstruction*, not a claim of a complete datamined database. No implementation instructions or game-to-game comparison included.
