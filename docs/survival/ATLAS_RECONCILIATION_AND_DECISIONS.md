# SOH — Atlas Reconciliation, Hard Decisions & Neglected Mechanics
Date 2026-10-29. Scope: Compare immutable 1355-line user research atlas against previous `START_HERE.md`, `CONTRACTS.md`, `DECISIONS.md`, `LAST_DAY_RULES_2019_2020_RESEARCH_ATLAS.md`, `ACCEPTANCE.md`, source repo. This file reports actual coverage gaps, user-approved design gate rulings and action owners. **Not code implementation.**

## 1. What the previous Git capture actually preserved
Previously covered: overworld designed end-to-end / ten Chapter 1 dungeons in first quarter, Gold VFX parity, physical finite-use Core and recipe knowledge, freeform roofed house, material/loot research, first-tier hazards/keyrooms, persistent save and 14-day unfinished replay target. This was NOT useless. Its issue: no exhaustive behavior trace or precise execution contracts for secondary and tertiary couplings. New Atlas has 44 subsystems, 21 POI exemplars, 31 dependency chains, 12 cross-system user journeys, 40 unknown original facts and 28 dated reference sources. New machine index is `SOURCE_COVERAGE_TRACE.json`. Never claim file has a verified exact original game build; original explicitly says it is independent research/modeling.

## 2. Missing and underestimated systems: gate outcomes

| GAP ID | Prior blind spot | New source anchors | Binary design result | Owner and required proof |
| --- | --- | --- | --- | --- |
| GAP-A01 | Three separate knowledge states, learnable vs specimen vs recipe ownership scope | SYS-11,17,18,26; DEP-02,11,28 | ACCEPT_CORE | Economy: save/load scope, recipe permission & specimen sacrifice |
| GAP-A02 | Three research operations are not the same: random R&D, targeted learning, reverse engineering | SYS-12–14,18; DEP-01,02 | ACCEPT_CORE | Economy: deterministic unlock route + optional random bonus |
| GAP-A03 | Old materials can become suddenly valuable when recipes unlock; shared intermediate part scarcity | SYS-15,16; DEP-06,11; JOURNEY-08 | ACCEPT_CORE | Balance/Economy: bidirectional recipe/source index and rebalance test |
| GAP-A04 | Production fuel/time/queue, furnace and workshop throughput, recovery on interruption | SYS-19,25; DEP-19,29 | ACCEPT_CORE | Economy: queue, reserve/finish/refund and reconnect crash tests |
| GAP-A05 | Territory cabinet/ownership, construction permissions, structural support and independent outposts | SYS-20–23; DEP-08,10,20 | ACCEPT_CORE_SOLO_ADAPT | Building: region limits, support/placement, owner/heart authority |
| GAP-A06 | Energy circuits: generator, fuel, switch, sensors, trap and powered vault | SYS-24; DEP-04,09,21 | ACCEPT_CORE | Building/POI: complete circuit persistence & no-power safety |
| GAP-A07 | Roof/room, door interactions, collision/nav, construction upgrades/demolition | SYS-20,22,26; DEP-27; JOURNEY-05 | ACCEPT_CORE | Building: per-room transitions with real collision and save |
| GAP-A08 | Base construction spatial blueprint **≠** item recipe knowledge | SYS-26; DEP-07 | ACCEPT_EXTENSION | Building/Economy: typed data separate and apply/validate ghost layout |
| GAP-A09 | Player bases vs outpost vs fixed POI vs land capture are different entity classes | Atlas Part II intro, POI-21, SYS-43; JOURNEY-06 | ACCEPT_DISTINCTION | World: owner/spawn/loot lifecycle each correctly separated |
| GAP-A10 | Home/battle transport quota, cargo/route friction and economy of return | SYS-29,40; DEP-10,12,16; JOURNEY-06,07 | ACCEPT_CORE_SOLO_ADAPT | World/Economy: outpost utility measured in return-time saved |
| GAP-A11 | Comfort/heat, HP/hunger/water/downed states, repair and dropped bag | SYS-27,32–34; DEP-18 | ACCEPT_CORE_LIGHT_SURVIVAL | Gameplay: survival pressure adjustable, bag and bed reload |
| GAP-A12 | Trading post, currency exchange, bounty board and vendor inventory | SYS-31,44, POI-13; DEP-24 | ACCEPT_SOLO_ADAPT | Economy: NPC buy/sell sink and persistent demand; no real-money |
| GAP-A13 | Plants and cooking beyond decorative farm: maturation, multiple growth times, daily bounty | SYS-30; DEP-15,29 | ACCEPT_CORE | Economy/Building: production under constraints, preparation time reduced |
| GAP-A14 | Pets, vehicles, logistics and mobility can alter effective map radius | SYS-39,40; DEP-16,25 | ACCEPT_EXTENSION_WITH_GATE | World/Gameplay: travel vs cargo utility measured, no 3D ports |
| GAP-A15 | Creature siege must target owned structures, respect dynamic walls and pathfind after destruction | SYS-36,37; DEP-21,22; JOURNEY-09 | ACCEPT_PVE_ADAPT | AI/Building: target priorities, wall damage, anti-stuck tests |
| GAP-A16 | Blueprints, crates, power, hazards and card/room layers produce cross-POI goals, not 1 large chest | SYS-05–09, POI-01–21; DEP-03–05,31 | ACCEPT_CORE | World/POI: softlock-free access graph and real multistage puzzle |
| GAP-A17 | Map documentation and UX Codex reveal partial knowledge and support expedition planning | SYS-45; DEP-23; JOURNEY-08 | ACCEPT_EXTENSION | UI: fog-of-knowledge not full spoilers, recipe reverse lookup |
| GAP-A18 | Metagame cycle, player permanent home, reward carryover, repeated expedition choice design | SYS-28–29,41–44; DEP-12–14,24,30; JOURNEY-12 | ACCEPT_SPLIT_PERSISTENCE | Meta: first-run and replay tests; never force wipe |
| GAP-A19 | Economy metrics: loot net value, travel time, safety, expected loss, recipe utility, base throughput | §46–48, JOURNEY-07 | ACCEPT_TEST_HARNESS | Balance: telemetry metrics and reports against thresholds |
| GAP-A20 | Source date 2019–2020 vs 2021–26; newer mode quotas and recipes are not H1 historical truths | §01,23,37,42,43,47,48,51 | ACCEPT_SOURCE_PROVENANCE_GATE | Research/QA: mode+date for numeric claims; 40 unknowns are not certified |
| GAP-A21 | Different source of friction: solo offline cannot replicate multiplayer supply/risk blindly | SYS-35,36; DEP-22; source §00 | ACCEPT_TRANSLATION_ONLY | Gameplay: meaningful PvE risk, never artificial online grief |
| GAP-A22 | Skill combat should be distinct from realistic shooter while still preserving source item use/decay | SYS-38; DEP-02,26; user Gold rules | ACCEPT_DIFFERENTIATION_GATE | Skill agent: exact on-enemy/world Gold plus readable top-down combat |
| GAP-A23 | Building/UX pixel clarity, roof occupancy and HUD interact state not adequately differentiated | SYS-20,27,45,50; JOURNEY-05 | ACCEPT_UI_GATE | UI/Art: 2K/4K sharp, hover zones, not buried under map noise |
| GAP-A24 | User request to use many specialist agents with clear module ownership and entire-system thinking | Direct user request 2026-10-29 | ACCEPT_PIPELINED_PARALLEL | Tech lead: file ownership, shared interfaces, integration tests |
| GAP-A25 | Full original research source not in repository | Entire user file | CLOSED_SOURCE_ARCHIVED | Full immutable file SHA-256 validated in source_archive; cross-index to 108 units |

**Accepted core ≠ all done.** This gate admits the behavior into master design backlog. Production gate requires actual code/test. Every secondary extension must be included in a planned milestone with capability owner, not silently omitted.

## 3. Mechanics the gate deliberately does NOT clone literally

| Ruling | Source system | Why | Equivalent preservation |
| --- | --- | --- | --- |
| REJECT literal | Forced real-time 15-day server wipe / contest for multiplayer badge | Solo home persistence & user agency | Optional finite expedition with persistent long-term knowledge/home and rare replay rewards |
| REJECT literal | PvP raiding/offline player grief, team/clan requirements | Other human players not present and repetitive NPC pretending PvP is shallow | Predictable PvE camp/convoy events, active base defense, faction occupation |
| REJECT literal | Cash shop, skin monetization, loot-box paid keys, daily-life forced login | Does not add core gameplay; compulsion | Codex, recipes, appearance earned from exploration |
| REJECT default | 2023 quota 40m/28m, 2026 49 plots, 2025 24-min island, card/boss respawn fixed values | Wrong source epoch, mode- and build-specific numbers | SOH benchmarks determine quotas; optional later content identity |
| REJECT as confirmed | Exact original total recipe count, all item HP, drop percentages, live historical maps/seeds | Source atlas explicitly lists them as unknown | Complete internal SOH recipe dataset with exact testable counts; original facts stay UNVERIFIED |
| REJECT naive | "All fantasy skills are gun projectiles with a charge counter" | Violates SOH hero/VFX differentiation | Skill geometry/control/terrain synergy and full Gold parity |
| REJECT architecture | Whole The FOG imported as SOH, another SaveManager replacing own one, C# 3D building imported verbatim | Violates contracts and compatibility | Pin, adapt MIT algorithm, keep SOH state authority |

## 4. Five decisions previously left in limbo — now closed by explicit gate

**Q1 Map architecture: APPROVED_CONTINENT_SYSTEM.** A continuous, authorable full world with regional ecological and economic logic, not literal four empty quadrants nor one finished region plus placeholders. Name/size/POI count can be authored using constraints; does not require user to choose old option A/B/C. Necessary gates: POI causal location, 10 buildings in opening region, region-level progression routes, screenshot legibility, running memory.
**Q2 Construction: APPROVED_2D_FREEFORM.** No prefab-only house. Grid-aligned foundation, walls/doors/windows, room roof occlusion, real chest/bed/stations and structure durability. The type of visual building kit remains an art selection task, not a reason to block code.
**Q3 Progression and replay: APPROVED_DUAL_PERSISTENCE.** Main home/world permanent; self-contained repeatable expeditions optionally reset their own run state. Access to big zones comes from hazard, monsters, materials, route/world-state; no unconditional level walls, no mandatory wipe.
**Q4 Skill Core: APPROVED_PHYSICAL_TEMPORARY_PLUS_KNOWLEDGE.** Limited-use found item and persistent recipe are separate; reverse-engineering consumes specimen for the applicable class. Ordinary Core may be repairable for materials; exceptional Core might not. Determine exact costs/charge semantics from skill family tests, not guessed shooter clip size.
**Q5 Solo pressure: APPROVED_HAZARD_AND_PVE.** Resource scarcity, weather, knowledge, transport, deliberate siege events and exploration substitute gameplay function of human adversaries. Hunger/thirst should be meaningful yet not annoying real-time ticking when user closes game. Hardcore is optional.

## 5. Source-data quality and possible errors in the user-supplied study

- The source is a **modeling synthesis**, not an authorized data dump or in-game build replay. It names 28 sources and tags A/B/C/I/?. Its 2026 modes are sometimes juxtaposed with 2019 source facts, but labeling and careful rechecking are needed before using a numerical mechanic.
- Recipe total is explicitly unknown and sample lists are not a complete recipe DB; no misleading promise to have "everything" at 1:1 original content fidelity.
- 2019 global international and China game mode patch timelines are not automatically identical; features like Operation Base and research room variants might differ by region.
- Multiple POI archetypes are newer game editions; treat as candidate content schema, not 2019 coordinates.
- Many DEP descriptions and journey logs repeat a template phrase; source remains valuable for graph semantics but **not every DEP is a finished design**. Agents must instantiate actual item IDs, conditions, failure states, UI and tests—not rubber-stamp the template.
- The 40 unanswered factual questions need original build or visual evidence for reliable exact values. **Decision is fact unverified; NOT "everything paused."** Choose original-equivalent design behavior while keeping numeric implementation tuning local and documented.
- Source document's terminology *Operation Base* vs old *Action Base* refer to the 2020 personal persistent base; treat names as version/translation variants until provenance. Do not silently invent two separate base systems.

## 6. Required sign-off criteria per system
GATE-SOURCE: specific source version/mode + original atlas anchor, or clearly marked SOH innovation.
GATE-DESIGN: passes player utility, connected dependency graph, top-down differentiator.
GATE-LEGAL: permissive code and separate art license or original implementation.
GATE-API: schema/authority/ownership/source of truth, failure semantics, save migration.
GATE-IMPLEMENT: headless, native and Web behavior/tests as appropriate, no regressions.
GATE-LONGEVITY: rare early skill excitement and ≥3 meaningful unfinished goals after long-form 14-day-style pacing; no artificial fetch grind.
For FAIL, write concrete blocking evidence and next fix. Never leave a proposal as undated "maybe".
