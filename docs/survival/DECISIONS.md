# Design decision ledger

Each decision carries a state: **LOCKED_USER**, **ENGINEERING_DEFAULT_REVISABLE**, **OPEN**, or **REJECTED**. Agents do not silently upgrade proposed ideas into user-approved product requirements.

| ID | Status | Decision / constraint | Reason / provenance |
| --- | --- | --- | --- |
| D001 | LOCKED_USER | Design the whole world masterplan from the outset, player access expands gradually by in-world threats/gear/terrain/world-state | Explicit user clarification |
| D002 | LOCKED_USER | Keep exactly the current 10 Chapter-1 dungeon buildings within roughly the opening quarter; preserve dungeon interiors | Explicit user clarification |
| D003 | LOCKED_USER | Offline exploration, resource gathering, construction, crafting, loot and research should closely preserve the motivating Last Day Rules experience | Explicit user request |
| D004 | LOCKED_USER | Top-down building must create a usable shelter with true interior, storage and utility, not just upgrades via menu | Explicit user request |
| D005 | LOCKED_USER | Skill Core physical item finite uses; permanent learned reproduction knowledge; different world materials for new cores | Explicit user request |
| D006 | LOCKED_USER | Gold VFX must reproduce full original effect, including on enemies and environment, not approximated or stripped | Historical explicit rule |
| D007 | LOCKED_USER | Agent should work efficiently end-to-end; no approval request for each small internal step | Explicit user request |
| D008 | ENGINEERING_DEFAULT_REVISABLE | Use SOH as root architecture, reuse permissively licensed source modules as reference / selected adapter rather than migrating game onto FOG | Existing SaveService, VFX, Hero architecture |
| D009 | ENGINEERING_DEFAULT_REVISABLE | Use one authoritative SaveService transaction boundary and migration-safe new state domains | Prevent dupes, loss and save incompatibility |
| D010 | ENGINEERING_DEFAULT_REVISABLE | Keep user building geometry in separate dynamic world-state/chunks instead of editing baked static masterplan | Topology, saves, streaming |
| D011 | ENGINEERING_DEFAULT_REVISABLE | Base-building 2D cells with foundation/roof room model and click-drag ghost preview | Best fit for native SOH TileMap |
| D012 | OPEN | Exact Core depletion semantics: per successful cast vs channel time, ability family exceptions, repair possibilities | Requires gameplay design/balance testing |
| D013 | OPEN | Corpse bag expiration, difficulty modes and resource respawn frequencies | Requires playtest |
| D014 | OPEN | Art-kit choice for modular walls/roofs and final biome tile language | Inventory doesn't prove a complete coherent construction kit |
| D015 | OPEN | Final worldwide dimensions, region layouts and exact biome partitioning | Need travel pacing and density tests |
| D016 | REJECTED | Taking an unlicensed proprietary Last Island Unity source/asset dump to implement gameplay | IP/license risk; no authorized repository demonstrated |
| D017 | REJECTED | Labeling 93 registry entries as 93 working Godot skills | 0 native-ready at audited snapshot |
| D018 | REJECTED | Simple uniformly random scattering of materials and landmarks as world layout | User explicitly rejected this map design language |
| D019 | REJECTED | Wholesale import of a second SaveManager and inventory root from The FOG or other project | Source-of-truth conflict |
| D020 | OPEN | Extent of weather, crops/NPC automation and dynamic hostile raids in first production pass | Important long-term mechanics; calibrate scope after functional loop |

**Change policy:** if a LOCKED_USER item appears contradictory with a newly discovered technical fact, mark a conflict and propose alternatives in issue #9; do not silently change it. Record exact date, decision owner and code impact for any later resolution.

## 2026-10-29 — Explicit user delegation and historical research gate results
User has granted autonomous authority to **approve or reject designs via evidence-based gates**; no indefinite 'proposed but nobody decides' state. See [2019–2020 Atlas](LAST_DAY_RULES_2019_2020_RESEARCH_ATLAS.md) §14 for F0–F5. The agent must decide a passed idea while preserving authority boundary: **APPROVED_BY_GATE ≠ APPROVED_BY_USER ≠ CODE_IMPLEMENTED**.
| ID | Verdict | Decision / why |
| --- | --- | --- |
| D021 | LOCKED_USER | Preserve the 14-day incomplete-yet-exciting original experience: only a few rare skill/weapon unlocks, many unopened bases/rooms/formulas, strong replay curiosity; **deep content instead of artificial grind**. |
| D022 | LOCKED_USER | User delegates gate-based design approval to implementation agent; no indefinite undecided ideas. Failed gate -> reject or name explicit missing evidence and test; do not silently shelve. |
| D023 | APPROVED_BY_GATE | Historical reference pinned to 2019–2020 China 王牌战争：文明重启 / global Last Day Rules, with H1=2019 main, H2=Nov 2019 revamp, H3=Aug 2020 persistent Action Base. Do not confuse Last Day on Earth or latest Last Island. Evidence S01–S14. |
| D024 | APPROVED_BY_GATE | Hybrid **persistent home + optional repeatable expedition scenarios** (not forced wipe), directly grounded in official Aug 2020 Action Base. Subject to gameplay and user-value gates; reversible until native prototype passes. |
| D025 | APPROVED_BY_GATE | Retain road-barrel salvage, tiered loot, recycler scrap loop, station tiers, blueprint reverse-engineering, card/key + power/switch multistage POIs, hazards and repair classes. Translate to fantasy semantics without dropping functionality. |
| D026 | APPROVED_BY_GATE | Keep physical limited-use Skill Core and permanent learned blueprint distinct; reconcile repairable ordinary vs irreparable exceptional prototype; no single hardcoded 2019 firearm durability value. |
| D027 | APPROVED_BY_GATE | Uncluttered resource causality, farm/production to replace mundane repeated gathering, while rare catalysts still drive expeditions. |
| D028 | REJECTED | Force-reset persistent SOH home after 15 days, copy paid multiplayer monetization and offline raid; defeats solo player's ownership and original 2020 persistent-base precedent. |
| D029 | REJECTED_EXACTNESS_CLAIM | Claiming a precise original total number of craftable recipes, numerical POI respawn timers or research prices from merged years. Published sources differ; only source/date/mode-stamped recipe samples are admissible. |
| D030 | APPROVED_BY_GATE | Explicit long-form acceptance: after an extended multi-session ~14-day play journey the player has gained meaningful rare abilities but still ≥3 distinct valuable next objectives and major unfamiliar POIs. Test boredom vs artificial scarcity; numbers are new product gates, not original 2019 stats. |
| D031 | KEEP_OPEN_AS_FACT_NOT_DESIGN | Exact 2019 item/recipe full count requires version-pinned dataset/game client source. Research claim FAILS without evidence; behavior-level design can proceed. |

## 2026-10-29 — Gated decisions after complete user-supplied 1355-line study
This user research file was provided to preserve nuance and enable systemic rather than one-off changes. A0 is delegated design authority under gates, while status 'design approved' cannot be confused with a native gameplay success.
| ID | Status | Decision and why |
| --- | --- | --- |
| D032 | LOCKED_USER | Preserve full uploaded research text in Git and Google Docs, including 44 mechanisms, 21 POIs, 31 dependencies, 12 play journeys, 40 factual unknowns and 28 references. Never ask user to attach it again just to reacquire context. |
| D033 | LOCKED_USER | Every feature is a systemic modification connected with world, inventory/recipe, base, exploration, combat, save and UI; no patchwork independent functionality. |
| D034 | LOCKED_USER | Top-down pixel SOH with Skills must have its **own superiority** versus a prettier realistic shooter: native visual skill spectacle, readable tactical information, meaningful Core × environment agency, good offline pacing. |
| D035 | LOCKED_USER | Use parallel specialist agents with reusable repository algorithms, not white-page reinvention or indiscriminate mass cloning. |
| D036 | APPROVED_BY_GATE | Continuous authored full-continent masterplan, 10 existing Chapter 1 dungeon exteriors in starter ~quarter and in-world access; `CT-01`. |
| D037 | APPROVED_BY_GATE | CT-01..CT-12 connected domain architecture with sole owner of state/save/inventory, agent ownership A0..A8. |
| D038 | APPROVED_BY_GATE | Separate POI, player home, outpost and territory capture semantics. Grade keys + energy + resist + alternate paths; no literal 2026 POI coordinates. |
| D039 | APPROVED_BY_GATE | Distinguish Recipe Knowledge, physical blueprint, physical item, Core instance, spatial construction blueprint, unlock scope; atomic operations and absence of infinite salvage loop. |
| D040 | APPROVED_BY_GATE | Sources: SOH direct; The FOG selected MIT code logic (separate licensed art); Survival Core Lite gather/needs/recipe adapter; Coheronia placement logic; GLoot optional UI; Seasons Gone farming ideas. No competing SaveManager or 3D building import. |
| D041 | APPROVED_BY_GATE | Preserve user Atlas original 2019–2020 emotional core but analyze later 2021–2026 cases as dated optional extensions only, never masquerading as 2019 facts. |
| D042 | REJECTED | Isolated agent patches without shared CT schema, migration, runtime test, owner and connected economic/gameplay effects. |
| D043 | APPROVED_BY_GATE | Binary gameplay acceptance and long-form core content/replay experience; measure actual net-expedition value, rarity satisfaction, economic sink, POI depth and setup productivity. |

| D044 | LOCKED_USER | Research and proactive GitHub/tool/asset discovery are **permanent engineering requirements across all agent sessions**; prior research and repository lists are foundational but never exhaustive/frozen. Each material decision must have an evidence-backed choice to reuse, adapt, build or reject and be revisited when relevant new facts emerge. See AGENTS.md and RESEARCH_LOG.md. |


## 2026-10-30 — User locks both Adventurer player avatars, no Knight sprite fallback

| ID | Status | Decision / implementation boundary | Reason / provenance |
| --- | --- | --- | --- |
| D045 | **LOCKED_USER** | SOH must present **exactly two selectable initial PLAYER AVATARS**: Male Adventurer from `The Male adventurer - Free.zip`, and Female Adventurer from `The Female Adventurer - Free.zip`. The choice is at character creation; both are the actual player character in **survival AND combat**, not optional NPC skins, not merely a separate civilian body with a Knight permanently standing in for combat. **Knight sprite art is no longer the intended default protagonist appearance.** Keep useful existing controller, Hero Soul/Skill Core mechanics, collision/weapon authority and Gold VFX systems as implementation assets, not a mandate to retain the original Knight artwork. | Explicit user selection after examining both uploaded sprite packs. |
| D046 | **LOCKED_USER** | Reuse/repurpose the packs' existing directional `Idle / Walk / Dash / Jump / Death` animation repertoire across ordinary survival, chopping, mining, interactions, crafting, melee and skill actions instead of blocking product choice for a complete per-action animation library. Use appropriate directional facing, timing, contact VFX and sound to communicate actions; don't falsely claim the packs include dedicated attack/cast/harvest animations. **Shooting is the explicit exception**: implement a recognizable dedicated gun-shooting action/animation with weapon aim and firing feedback, to be authored/adapted separately because it does not exist in the two supplied packs. Preserve exact original Gold full-cast, enemy-body and environment effect fidelity. | Explicit user instruction, rejecting the prior assistant's proposed requirement to retain old Knight graphics or extensively reanimate every activity. |

**Implementation scheduling and evidence:** This is a locked **PRODUCT VISUAL/AVATAR DECISION**, **NOT** user approval to interrupt the already-running A0 prompt `84519`, modify active agent branches, claim working gun animation, import assets now, or merge PRs. Do not dispatch an unprompted model migration during A0 work; keep A1/A3 paused and A6 production hold. The two uploaded files do not by themselves establish commercial-use license or author attribution; independently verify source/license before release, and validate actual Godot 4.7 animation extraction/import, weapon overlays, six-direction mapping, feet anchors and 720p–4K pixel clarity in a separate planned integration. If legal restrictions arise, report precisely instead of silently reversing D045.
