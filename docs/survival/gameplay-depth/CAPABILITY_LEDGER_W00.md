# W00 capability ledger — 214 provisional inventory IDs

Baseline `d73aa63f9f7f98aa1f6c6a42211693c7710cf3c4` plus the W00 public-loot implementation. **This is a provisional agent-constructed inventory, not a verified one-to-one transcription of the Creator’s 214 enumerated topics and not a complete audit or acceptance. Do not use these IDs as a substitute for that mapping until reconciled against the exact originating enumeration.** PARTIAL means relevant source exists or some behavior has evidence, not that the whole topic works. MISSING means the requested complete capability was not found at baseline; O is a specific cross-owner integration/placement dependency; N is a candidate not approved as implemented. Category-level source pointers are starting points, not proof of each acceptance dimension. Further topic-specific adversarial audits remain required. No entry is marked ALREADY_PRESENT_VERIFIED merely from catalog presence.

Statuses: `ALREADY_PRESENT_VERIFIED`, `PARTIAL`, `MISSING`, `OWNER_BLOCKED`, `PROPOSED_NOT_CREATOR_APPROVED`, `REJECTED_BY_SOH_CANON`.

## SYS01 — Everyday tools and weapons
Evidence pointers: `web/src/game/catalog.ts`, `web/src/game/sim.ts`, `web/tests/soh.test.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS01-01 | Knife-first survival | PARTIAL |
| SYS01-02 | authentic contact geometry | PARTIAL |
| SYS01-03 | material-dependent tool power | PARTIAL |
| SYS01-04 | weapon/tool dual use | PARTIAL |
| SYS01-05 | wear and preserved UID | PARTIAL |
| SYS01-06 | field and station repair | PARTIAL |
| SYS01-07 | tool upgrades using existing chassis | PARTIAL |
| SYS01-08 | non-Core survival ranged weapons | PARTIAL |
| SYS01-09 | damage versus recoverable material yield | PARTIAL |
| SYS01-10 | equipment resistances | PARTIAL |
| SYS01-11 | death-bag recovery | PARTIAL |

## SYS02 — Metallurgy and intermediates
Evidence pointers: `web/src/game/catalog.ts`, `web/tests/economy-network.test.ts`, `web/tests/production-network.test.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS02-01 | finite ore extraction | PARTIAL |
| SYS02-02 | scrap as alternative | PARTIAL |
| SYS02-03 | fuelled smelting | PARTIAL |
| SYS02-04 | refined metal tier | PARTIAL |
| SYS02-05 | actual Mechanical Parts chain | PARTIAL |
| SYS02-06 | useful pipe/plate/gear-like intermediates only where justified | PARTIAL |
| SYS02-07 | alternate production routes | PARTIAL |
| SYS02-08 | smelting while away | PARTIAL |
| SYS02-09 | heat and processing hazards | MISSING |
| SYS02-10 | physical storage and transport | PARTIAL |
| SYS02-11 | measured source efficiency | PARTIAL |

## SYS03 — Recycler and reverse engineering
Evidence pointers: `web/src/game/wreck-economy.ts`, `web/tests/m-core-03r-economy.test.ts`, `docs/survival/M_CORE_03R_HANDOFF.md`.

| ID | Capability | Initial status |
|---|---|---|
| SYS03-01 | real physical Recycler | PARTIAL |
| SYS03-02 | paid processing and output | PARTIAL |
| SYS03-03 | unique UID consumption | PARTIAL |
| SYS03-04 | destructive specimen study | PARTIAL |
| SYS03-05 | item condition effects | MISSING |
| SYS03-06 | machine access/HP | PARTIAL |
| SYS03-07 | job queues and overflow | PARTIAL |
| SYS03-08 | research-versus-recycler choice | PARTIAL |
| SYS03-09 | buy/craft/recycle anti-arbitrage | PARTIAL |
| SYS03-10 | deterministic offline processing | PARTIAL |

## SYS04 — Workbench and production
Evidence pointers: `web/src/game/catalog.ts`, `web/src/game/engine.ts`, `web/tests/b1-integrity.test.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS04-01 | Workbench I–III | PARTIAL |
| SYS04-02 | knowledge tier separate from station level | PARTIAL |
| SYS04-03 | atomic input custody | PARTIAL |
| SYS04-04 | fuel/time | PARTIAL |
| SYS04-05 | cancellation and input return | PARTIAL |
| SYS04-06 | full-output behavior | PARTIAL |
| SYS04-07 | genuinely useful Workbench III products | MISSING |
| SYS04-08 | contention between workstations | PARTIAL |
| SYS04-09 | power interruptions | MISSING |
| SYS04-10 | home production | PARTIAL |
| SYS04-11 | Garden Tender integration | PARTIAL |
| SYS04-12 | understandable crafting interface | PARTIAL |

## SYS05 — POI access
Evidence pointers: `web/src/game/world.ts`, `web/src/game/engine.ts`, `web/tests/poi-route-physical.test.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS05-01 | keycard tier chain where appropriate | PARTIAL |
| SYS05-02 | authenticated key provenance | PARTIAL |
| SYS05-03 | powered gates | PARTIAL |
| SYS05-04 | switches and timers | MISSING |
| SYS05-05 | environmental hazards | PARTIAL |
| SYS05-06 | physical door/room geometry | PARTIAL |
| SYS05-07 | enemies/security | PARTIAL |
| SYS05-08 | differentiated high-value rooms | PARTIAL |
| SYS05-09 | persistent POI state | PARTIAL |
| SYS05-10 | no-boss alternative routes | PARTIAL |
| SYS05-11 | informative failure response | PARTIAL |
| SYS05-12 | Map-owned spatial intake | OWNER_BLOCKED |

## SYS06 — Power and electronics
Evidence pointers: `web/src/game/engine.ts`, `web/src/game/sim.ts`, `web/tests/k6-power.test.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS06-01 | physical generator | PARTIAL |
| SYS06-02 | paid fuel burn | PARTIAL |
| SYS06-03 | real local power graph | PARTIAL |
| SYS06-04 | capacity and load | MISSING |
| SYS06-05 | relays/switches | MISSING |
| SYS06-06 | consequences of power loss | PARTIAL |
| SYS06-07 | electrical-water hazards | PARTIAL |
| SYS06-08 | turret energy | MISSING |
| SYS06-09 | powered workshop throughput | MISSING |
| SYS06-10 | maintenance | PARTIAL |
| SYS06-11 | chronological offline processing | PARTIAL |

## SYS07 — Building and upkeep
Evidence pointers: `web/src/game/engine.ts`, `web/src/game/sim.ts`, `web/tests/k6-spatial.test.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS07-01 | owned claim area | PARTIAL |
| SYS07-02 | foundations/walls/doors/roofs | PARTIAL |
| SYS07-03 | material tiers | PARTIAL |
| SYS07-04 | actual interior shelter | PARTIAL |
| SYS07-05 | structural damage/repair | PARTIAL |
| SYS07-06 | upkeep reserve cabinet | MISSING |
| SYS07-07 | size/material-based cost | MISSING |
| SYS07-08 | visible remaining-time forecast | MISSING |
| SYS07-09 | biome/weather wear | PARTIAL |
| SYS07-10 | offline upkeep | MISSING |
| SYS07-11 | future villager interface only | PROPOSED_NOT_CREATOR_APPROVED |
| SYS07-12 | full run wipe | PARTIAL |

## SYS08 — Defense and PvE pursuit
Evidence pointers: `web/src/game/sim.ts`, `web/tests/b2-perception.test.ts`, `web/tests/k6-power.test.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS08-01 | trace-based threats | PARTIAL |
| SYS08-02 | rain effects on traces | PARTIAL |
| SYS08-03 | creature sight/sound | PARTIAL |
| SYS08-04 | true wall/door collision | PARTIAL |
| SYS08-05 | real turrets | PARTIAL |
| SYS08-06 | ammunition/energy/power consumption | PARTIAL |
| SYS08-07 | trap geometry | PARTIAL |
| SYS08-08 | elemental damage against appropriate materials | PARTIAL |
| SYS08-09 | escalating but justified PvE threats | PARTIAL |
| SYS08-10 | offline enemy-simulation boundaries | PARTIAL |
| SYS08-11 | post-defense salvage and repair | PARTIAL |

## SYS09 — Transport and powered vehicles
Evidence pointers: `web/src/game/engine.ts`, `web/tests/logistics-garden.test.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS09-01 | carrying costs | PARTIAL |
| SYS09-02 | existing cart continuity | PARTIAL |
| SYS09-03 | fuelled land vehicle | MISSING |
| SYS09-04 | real vehicle controls and collisions | MISSING |
| SYS09-05 | physical cargo | PARTIAL |
| SYS09-06 | vehicle fuel consumption/refill | MISSING |
| SYS09-07 | vehicle wear/repair | MISSING |
| SYS09-08 | breakdown recovery | MISSING |
| SYS09-09 | water transport as a Map-dependent candidate | OWNER_BLOCKED |
| SYS09-10 | vehicle identity/storage/death | MISSING |
| SYS09-11 | comparative net-trip economics | MISSING |

## SYS10 — Oil and refinery
Evidence pointers: `web/src/game/catalog.ts`, `web/src/game/world.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS10-01 | physical crude source | MISSING |
| SYS10-02 | extracting equipment | MISSING |
| SYS10-03 | accessible early fuel route | PARTIAL |
| SYS10-04 | refining chain | MISSING |
| SYS10-05 | fuel grades and real consumers | MISSING |
| SYS10-06 | fuel storage and carriage | PARTIAL |
| SYS10-07 | generator-versus-vehicle fuel competition | MISSING |
| SYS10-08 | useful industrial byproducts | MISSING |
| SYS10-09 | environmental risk | PARTIAL |
| SYS10-10 | offline refining | MISSING |
| SYS10-11 | profitability measurement | MISSING |

## SYS11 — World loot
Evidence pointers: `web/src/game/engine.ts`, `web/src/game/persist.ts`, `web/tests/public-loot-lifecycle.test.ts`, `web/evidence/gameplay-depth-w00/loot-natural.json`.

| ID | Capability | Initial status |
|---|---|---|
| SYS11-01 | withdraw-only public loot | PARTIAL |
| SYS11-02 | partial stock persistence | PARTIAL |
| SYS11-03 | empty-source disappearance | PARTIAL |
| SYS11-04 | later re-instancing | MISSING |
| SYS11-05 | toolbox tier | MISSING |
| SYS11-06 | supply tier | MISSING |
| SYS11-07 | military tier | MISSING |
| SYS11-08 | advanced military tier | MISSING |
| SYS11-09 | road barrels/destructible sources | PARTIAL |
| SYS11-10 | authenticated drop provenance | PARTIAL |
| SYS11-11 | typed respawn policies | MISSING |
| SYS11-12 | clear loot UI | PARTIAL |

## SYS12 — Airdrop
Evidence pointers: `web/src/game/world.ts`, `web/src/game/sim.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS12-01 | world-event schedule | MISSING |
| SYS12-02 | observable warning | MISSING |
| SYS12-03 | valid landing site | OWNER_BLOCKED |
| SYS12-04 | falling-object lifecycle | MISSING |
| SYS12-05 | opening delay if justified | PROPOSED_NOT_CREATOR_APPROVED |
| SYS12-06 | tiered physical loot | MISSING |
| SYS12-07 | legitimate enemy reaction | MISSING |
| SYS12-08 | partial extraction | MISSING |
| SYS12-09 | despawn/expiration | MISSING |
| SYS12-10 | alternative acquisition | PARTIAL |
| SYS12-11 | return-trip economic value | MISSING |

## SYS13 — Core energy industry
Evidence pointers: `web/src/game/catalog.ts`, `web/src/game/core.ts`, `web/src/game/sim.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS13-01 | two generic energy materials | MISSING |
| SYS13-02 | four family essences | MISSING |
| SYS13-03 | starter Basic route | MISSING |
| SYS13-04 | Refined processing | MISSING |
| SYS13-05 | safe low-yield essence route | MISSING |
| SYS13-06 | dangerous rich-yield route | OWNER_BLOCKED |
| SYS13-07 | Core Body compatibility | MISSING |
| SYS13-08 | LMB Basic reserve | MISSING |
| SYS13-09 | Q Refined reserve | MISSING |
| SYS13-10 | E Signature reserve | MISSING |
| SYS13-11 | atomic reload | MISSING |
| SYS13-12 | initial Gold charge on found Core | PARTIAL |
| SYS13-13 | cancel behavior for new aimed actions | MISSING |
| SYS13-14 | multiple industrial sinks | MISSING |
| SYS13-15 | anti-farming for material-generating magic | MISSING |

## SYS14 — Knowledge and research
Evidence pointers: `web/src/game/catalog.ts`, `web/src/game/engine.ts`, `docs/survival/M_CORE_03R_HANDOFF.md`.

| ID | Capability | Initial status |
|---|---|---|
| SYS14-01 | run-scoped learned recipes | PARTIAL |
| SYS14-02 | found blueprints | PARTIAL |
| SYS14-03 | bounded random research | PARTIAL |
| SYS14-04 | directed research | PARTIAL |
| SYS14-05 | specimen research | PARTIAL |
| SYS14-06 | Core analysis/disassembly | PARTIAL |
| SYS14-07 | separation of knowledge tier and station level | PARTIAL |
| SYS14-08 | paid research time | PARTIAL |
| SYS14-09 | multiple valid unlock paths | PARTIAL |
| SYS14-10 | hidden/unlearned recipe UI | PARTIAL |
| SYS14-11 | research-versus-market choice | MISSING |
| SYS14-12 | actual production after learning | PARTIAL |

## SYS15 — Survival and ecology
Evidence pointers: `web/src/game/sim.ts`, `web/src/game/engine.ts`, `web/tests/home-ecology.test.ts`, `web/tests/b2-chronology.test.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS15-01 | hunger/thirst | PARTIAL |
| SYS15-02 | day/night visibility | PARTIAL |
| SYS15-03 | heat/cold exposure | PARTIAL |
| SYS15-04 | toxicity/radiation | PARTIAL |
| SYS15-05 | marsh slowdown | PARTIAL |
| SYS15-06 | seasonal cycles | PARTIAL |
| SYS15-07 | rain/fire effects | PARTIAL |
| SYS15-08 | ice/water material rules | PARTIAL |
| SYS15-09 | paid crop growth/watering | PARTIAL |
| SYS15-10 | meaningful crop alternatives | PARTIAL |
| SYS15-11 | optional Garden Tender | PARTIAL |
| SYS15-12 | tracks/ecology | PARTIAL |
| SYS15-13 | offline bodily survival | PARTIAL |
| SYS15-14 | understandable hazard UI | PARTIAL |
| SYS15-15 | long-lived environmental aftermath | PARTIAL |

## SYS16 — Geography and resources
Evidence pointers: `web/src/game/world.ts`, `web/src/game/world-economy.ts`, `docs/survival/GAME_LR02_VEYRA_HANDOFF.md`.

| ID | Capability | Initial status |
|---|---|---|
| SYS16-01 | stable world geography | PARTIAL |
| SYS16-02 | multiple viable spawn regions | PARTIAL |
| SYS16-03 | natural/artificial/rare source taxonomy | PARTIAL |
| SYS16-04 | biome rewards | PARTIAL |
| SYS16-05 | roadside loot | PARTIAL |
| SYS16-06 | visually recognizable POIs | PARTIAL |
| SYS16-07 | waterways/crossings | PARTIAL |
| SYS16-08 | climate and hazard geometry | PARTIAL |
| SYS16-09 | optional Elder geography | PARTIAL |
| SYS16-10 | route distance economics | PARTIAL |
| SYS16-11 | versioned source saves/overlays | PARTIAL |
| SYS16-12 | actual integrated Veyra world | OWNER_BLOCKED |

## SYS17 — Run, death, offline and Ragnarok
Evidence pointers: `web/src/game/engine.ts`, `web/src/game/sim.ts`, `web/tests/b2-chronology.test.ts`, `web/tests/b1-storage.test.ts`.

| ID | Capability | Initial status |
|---|---|---|
| SYS17-01 | 336-hour real run | PARTIAL |
| SYS17-02 | last72 event | PARTIAL |
| SYS17-03 | ordinary death | PARTIAL |
| SYS17-04 | bed/respawn | PARTIAL |
| SYS17-05 | offline production | PARTIAL |
| SYS17-06 | realistic offline enemy boundary | PARTIAL |
| SYS17-07 | source expiry/respawn | PARTIAL |
| SYS17-08 | device-clock abuse handling | PARTIAL |
| SYS17-09 | score/event provenance | PARTIAL |
| SYS17-10 | finite Ragnarok Cash | PARTIAL |
| SYS17-11 | legal owned escrow | PARTIAL |
| SYS17-12 | full run-finalize wipe | PARTIAL |
| SYS17-13 | returning-player experience after absence | PARTIAL |

## SYS18 — Run-local market and scarcity
Evidence pointers: `web/src/game/catalog.ts`, `web/src/game/engine.ts`, `docs/survival/ECONOMY_NETWORK_ROUND2.md`.

| ID | Capability | Initial status |
|---|---|---|
| SYS18-01 | finite Spares currency | PARTIAL |
| SYS18-02 | physical trader | PARTIAL |
| SYS18-03 | real vendor stock | PARTIAL |
| SYS18-04 | prices and carry weight | PARTIAL |
| SYS18-05 | legal sold-item provenance | PARTIAL |
| SYS18-06 | bounded restock/price variation | MISSING |
| SYS18-07 | research-versus-purchase economics | MISSING |
| SYS18-08 | recycle/buy arbitrage protection | MISSING |
| SYS18-09 | vendor depletion and return | MISSING |
| SYS18-10 | currency isolation from Ragnarok Cash | PARTIAL |
| SYS18-11 | intermediates with multiple sinks | PARTIAL |
| SYS18-12 | readable trading UI | PARTIAL |

## B04-P4 round notes (2026-11-06) — provisional, no status promoted without evidence

Creator policy applied: `web/ref/bible.md` §8.8 (mechanics first; mechanics and pixel UX ship together). Evidence: `web/tests/b04-p4-world.test.ts`, sprite keys in `web/src/game/art.ts`.

| ID | B04-P4 change | Evidence | Status after round |
|---|---|---|---|
| SYS02-02 | Metal Pipe gained a workbench recycle option (`pipe_recycle`, 1 pipe → 1 Refined Iron Ingot, net loss; SOH_PROVISIONAL, no LI source) alongside craft into Iron Plate / Utility Frame | `pipe_recycle` test in b04-p4-world | PARTIAL (unchanged label; one more source-authenticated alternative) |
| SYS12-02 / SYS12-04 | Dedicated airdrop crate sprites (locked/open); the drop is physically visible in camera | render `case 'airdrop'`; `airdrop_locked` / `airdrop_open` sprites | PARTIAL — screenshots pending in this round |
| SYS12-08 | none | — | unchanged |
| B02 IR sensor | Five physical sprite states (off, unpowered, ready, detect, blocked) from `irSensorVisual`; F1 fix: downstream count limited to the sensor's own generator network | `irSensorVisual` + F1 tests | PARTIAL |
| B02 bear trap | Four physical states plus a 0.4 s live snap frame from `bearTrap.snapAt`; live contact through `tick()` | live-contact test | PARTIAL |
| Map/LI parity | LI Metal Pipe = 5 refined ingot + 30 LI parts (ATLAS_v4 / atlas.json, `s_pipe`); SOH recipe is 2 ingot + 1 SOH Mechanical Parts (SOH_PROVISIONAL). No 1:1 claim. | Atlas restored and checksummed (`8b4fdeda…`) | PARTIAL |

Not in this ledger round: Map-owned loot sources, AVFX, native, and Gold work remain outside the branch.
