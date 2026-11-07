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

### B04-P4 continuation (same session, PARTIAL — not DONE)

| ID | Continuation change | Evidence | Status after round |
|---|---|---|---|
| B04 airdrop lifecycle | Browser drive uses the real lifecycle (signal → descent → landing → locked → open → partial take via `move`), advanced through `tick()` + `stepAirdrops`; no hand-set phase. Browser-read phases: locked / open / partial. | `e2e/b04-p4-world.mjs` run, `results.json` (`airLocked/airOpen/airPartial.browserPhase`) | PARTIAL |
| B04 bear trap snap | `bearTrap.snapAt` validated (safe non-negative integer; absent stays valid). Spring-snap frame is a labelled frozen-clock fixture; live hit only proven by `tick()` test. | `persist.ts`, `b04-p4-world.test.ts`, `trapSnap` frame | PARTIAL |
| B02 IR sensor | Ready (antenna mast) and blocked (stone block with red marks) are distinct from detect at 640×360; driver asserts five distinct states off/unpowered/ready/detect/blocked. | `results.json` `irVisual`, `irBlocked` frame | PARTIAL |
| C Recycler | Metal Pipe → `X:pipe-v1` (SOH_PROVISIONAL): one carried pipe → one Refined Iron Ingot after 10 s. Stack qty>1 refused ("Split one Metal Pipe off the stack first"). Cancel returns the same UID. Workbench `pipe_recycle` removed. Driven through the real UI: select pipe → Recycle item… → Confirm recycle → output. | `b04-p4-world.test.ts` (Recycler), `recycler-*` frames, `results.recycler.640x360` = 1 refined_iron_ingot, 0 pipes left | PARTIAL |
| D P3 loot | New runs use grammar `b04-v1` (SOH_PROVISIONAL pools: toolbox metal, supply food, military med + arrow, advanced medical_high + ingot). `b01-v1` saves keep the B01 pools. Family sprites `loot_toolbox/supply/military/advanced`; container shows family · grade · role. No new Map POIs; no LI 2022 6/6/7 import. | `b04-p4-loot.test.ts`, `cache-*` frames | PARTIAL |

Full Vitest 68 files / 535 tests pass; `tsc --noEmit` exit 0; HTTP build exit 0. LI per-item recycler yield remains ORIGINAL_UNKNOWN; no LI Parts 1:1 claim. Unresolved: B04-P4 is not DONE until the owner reviews the frames and the Recycler/loot balance (SOH_PROVISIONAL) is accepted.

### B05 industrial + freight round (PARTIAL — not DONE; PR #44 draft/hold)

Scope actually delivered this round (visual/presentation gaps found by inspecting the existing chain; mechanics were already present and are not re-claimed as new):

| ID | Change | Evidence | Status |
|---|---|---|---|
| S04/S10 refinery visibility | Oil Refinery had **no sprite** (`A.st.refinery` unregistered → `render` returned early: an invisible station). Added idle + lit column sprites; lit only when `burn>0` and a job is queued (`refineryStateKey`). | `industrial-art.ts`, `art.ts`, `render.ts`; `evidence/b05-industrial/refinery-{idle,lit}-*.png` | PARTIAL |
| S10 lubricant identity | Machine Lubricant shared the oil/canister `can` icon; now a distinct `jug` icon. | `catalog.ts`, `b05-industrial-art.test.ts`; `inventory-lubricant-*.png` | PARTIAL |
| S09 vehicle facing/state (B4) | Bike was a rectangle cluster. Now three pixel views (side, mirrored for left; head-on down; tail up), ok/dead variants (dark lamp, dulled tank, rust), strapped cargo crate when loaded, 12-px fuel gauge. Facing already came from real travel (`atan2` in `sim.ts`); this round only changed presentation. | `drawVehicle*` in `industrial-art.ts`, `render.ts` vehicle case; `e2e/b05-industrial-visual.mjs`; `evidence/b05-industrial/bike-*` | PARTIAL |

Already present before this round and **not re-proven here** (see W07 / S10 / V17 handoffs): finite wreck salvage of Salvaged Oil, study→blueprint, furnace refining and the 3-oil + glass recipe, Oil Refinery single/batch/industrial/lube recipes (`balance.v1.json` `oilRefineryV1`), fuel canister into a motorbike tank (100 units per whole can, 300 tank), lubricant service halving wear for 12,000 px, cargo custody by UID, emergency bag unload.

Parity rows (numeric; SOH_PROVISIONAL unless stated; LI values ORIGINAL_UNKNOWN for this round — the Atlas v1–v11 transport/fuel numbers were not re-extracted in this round and no LI value is claimed):

| LI game/mode/version | LI mechanism | LI value / confidence | SOH equivalent | Locked constraint / adaptation | Current value | Delta | Consumer |
|---|---|---|---|---|---|---|---|
| Last Island 2019 standard (oil/fuel) | wreck → oil stock | ORIGINAL_UNKNOWN | wreck stock 8 × 35% oil | SOH_NEW_TUNED v1 | expected 2.8 oil / wreck | unknown | study → canister |
| LI (fuel recipe) | refine | ORIGINAL_UNKNOWN | furnace 3 oil + glass, 18 s + 18 fuel-s | SOH_PROVISIONAL | 1 canister | unknown | generator, motorbike |
| LI (refinery) | batch / lubricant | ORIGINAL_UNKNOWN | oil-refinery-v1 single 3 oil+glass 14 s; batch 5 oil+glass → 2 canisters 22 s; industrial 6 oil+glass → 2 canisters + lubricant 26 s; lube 2 oil → 1 lubricant 12 s | SOH_PROVISIONAL | as listed | unknown | motorbike wear, generator |
| LI (vehicle) | motorbike fuel/wear/capacity | ORIGINAL_UNKNOWN | tank 300, can +100, 0.05 fuel/px, rough ×1.5, load ×0.5; wear 0.002 HP/px; lube halves wear for 12,000 px; 12 slots / 80 kg | SOH_PROVISIONAL | as listed | unknown | movement, cargo |
| SOH locked | 336 h / 72 h, PvE, offline, reset, cash | locked | unchanged | Bible §0.2 / §8.8 | — | none | — |

S-status after B05 (program names from V17): S02 metallurgy PARTIAL; S04 workbenches/production PARTIAL (refinery now visible; no power-network graph); S09 transport PARTIAL (vehicle presentation and fuel relationship exist; no certified Map road/bridge geometry; powered freight economics not measured); S10 oil PARTIAL — **salvage → study → furnace/refinery → canister → generator/motorbike is connected; oil extraction is NOT implemented**.

Not delivered in this round and why:
- **A1 oil extraction source adapter**: not built. No authorized oil node exists in the Map contract; the adapter would be a test-only fixture and was deprioritised behind the invisible-refinery defect. Next step: implement the pump/source adapter against a labelled temporary test source and ask the Map owner for authorized oil sites.
- **X:pipe-v1 and loot pool credibility (C4)**: not re-assessed in this round; both remain SOH_PROVISIONAL.
- Full physical-power integration (refinery as a load on the cable network) and a natural player journey through the refinery are not claimed.

Validation at the code SHA of this round: `tsc --noEmit` exit 0; full Vitest 69 files / 541 tests pass; HTTP build exit 0; browser proof `web/e2e/b05-industrial-visual.mjs` at 640×360 and 1280×720, no page errors (visual fixtures labelled in `results.json`). Owner review of art quality is still required; the side-view bike is small at 640 and reads close to a small car.

## B05-R round (Packages A–D) — partial, PR #44 remains DRAFT/HOLD/UNMERGED

Status: **Package A (oil pump/refinery) implemented to test + visual level; Packages B, C, D NOT done in this round.** Nothing is marked DONE. Owner acceptance is not claimed.

Implemented (A):
- `oil_pump` structure: pump jack, requires a level-2 workbench within 3 tiles and an **authorized oil source**. Production placement is refused (no production source exists; Map placement pending). Authority is the labelled `test-fixture-v1` only.
- `crude_petroleum` (drum icon, distinct from Salvaged Oil): produced only by `pump_crude` (no inputs, 12 s, fuelled with wood/fuel), one unit per cycle, source stock decremented in the same commit, output-fit checked first, nothing granted when the source is empty, output full, or fuel out.
- `refinery_crude`: 4 crude + 1 glass → 1 Fuel Canister, 16 s, on the existing refinery. Consumed by the existing generator/motorbike fuel paths.
- Validation: pump entities, pump jobs (canonical total, no reserved inputs), `oilSources` (key format, integer stock, only test authority).
- Pump states from real inputs (`pumpStateKey`): idle / run (two beam frames) / dry (source empty). Station UI shows the authorized source stock.

Tests: `web/tests/b05-oil-pump.test.ts` (13): authority refusal, no production source, conservation, fuel-out pause, output-full block, depletion after queueing, empty-source refusal, save/reload with a single grant, refinery crude path, and validation rejections.

Validation at SHA of the checkpoint: tsc exit 0; full Vitest 70 files / 554 tests pass. Visual: `web/e2e/b05r-pump-visual.mjs` (in-page fixture, disclosed), evidence `web/evidence/b05r-pump/` at 640×360 and 1280×720 (idle, run-a, run-b, dry, inventory). Inspected at native size: pump jack silhouette, head and lamp read at 640×360.

LI provenance (A): crude-to-fuel ratios, pump cycle time and fuel burn are **SOH_PROVISIONAL**; no LI value is claimed as confirmed. Recipe/timing values are in `balance.v1.json` under `oilPumpV1` and `oilRefineryV1.recipes.crude`.

Not done (next actions):
- B (motorbike/freight coherence): not changed this round. Next: compare vehicle vs hand cart vs walking traversal and carry limits in `motorbike.ts`, add a test for cargo UID/unload with crude.
- C (POI access, loot→industry audit, icon/UI audit at 640×360 for all new items): not done. Map placement for oil sources is a dependency.
- D (LI→SOH numeric parity table for industrial/freight mechanics): not done.
- Standalone build: not run this round.

## B05-R continuation (SOH gameplay tower review of 6b427c34) — PARTIAL, PR #44 DRAFT/HOLD/UNMERGED

Scope: fix the two verified Package A UI defects, then B (freight), C (loot/recycler), D (verification/handoff). Nothing marked DONE. No Map, AVFX, Godot or owner-branch edits. No Map POIs, roads or oil sites were invented.

### P0 fixes (done)
- Oil Pump is in `BUILD_ORDER` and the Work group (`BUILD_GROUPS`). It is shown **locked** with the reason "no authorized oil source (Map pending)" until a run holds an authorized source with stock (`buildLocked`, `anyAuthorizedOilSource`). Test: `tests/b05r-oil-ui.test.tsx`.
- `StationBody`: the source-stock line moved into the returned JSX (`data-testid="oil-source-stock"`). It reads "N Crude Petroleum left" and changes to "0 … — dry, cycles blocked" at zero stock. A pump with no authorized source says so. Tests assert the rendered text.
- Authority domain: `RunState.oilTestFixture` is set only by the test-only registrar. Without it, persist refuses any `oilSources` and the authorization gate ignores them. Production sources must later bind to a versioned Map site and map revision; that authority is not defined yet, so it is refused.

### B — freight (done in part)
- B1 integration (`tests/b05-freight-crude.test.ts`): authorized fixture → 4 pump cycles → crude UID stacks → inventory → motorbike cargo (existing `move`) → real motion under `tick()` until the bike's own fuel burn empties the tank → `vehicleUnloadBag` into a ground bag → bag → inventory → `refinery_crude` → 1 Fuel Canister. Crude is conserved at every checkpoint (4 → 0 consumed by the job) and the original UID survives to the refinery. Existing custody, movement and unload authorities were used; nothing was rebuilt.
- B2 measured comparison (`tests/b05-freight-compare.test.ts`, evidence `web/evidence/b05-freight/freight-compare.json`, SOH_PROVISIONAL balance readings, same Shipping road segment, path length not net displacement):
  - walk ≈ 92 px/s, no vehicle fuel or wear
  - hand cart empty ≈ 98 px/s, loaded ≈ 97 px/s, cart cap 240 weight / 24 slots
  - motorbike empty / loaded ≈ 125 px/s on road, ~75 fuel and ~3 HP per 12 s on road, cargo cap 80 weight / 12 slots
  - Tradeoff, not a universal winner: the bike is fastest and uses fuel and wear; the cart is nearly walking speed with no fuel; walking has no carrying limit beyond personal load.
- Defect/observation (not changed, owner decision): `sim.ts` applies the cart's road factor (1.36 × base speed) without the `terrainSpeed` table that walking uses. A pulled cart on road is therefore only marginally faster than walking. Bike tank (300) lasts about 48 s of road driving at this rate. Both are noted as SOH_PROVISIONAL; balance was not changed arbitrarily.

### B3 — economy and loops
- **Defect fixed (free energy):** stations burned any item with a fuel value, including Fuel Canister (60 s). Since pump, refinery and furnace all produce canisters, a station could pay for its own output (for example a refinery burning one canister for about 4 cycles of canisters). Fix: stations never burn `fuel_can`; generators and motorbikes still use it. Tests: pump and refinery holding only canisters do not run.
- Per-canister cost (from balance): refinery 3 salvaged oil + 1 glass; batch 5 oil → 2 cans; industrial 6 oil → 2 cans + 1 lubricant (co-product, design intent, kept); pumped crude 4 crude + 1 glass per can, with 4 × 12 s of wood-fuelled pump time (≈2.4 wood). Trader oil costs 5 Spares per unit (stock 4). Wrecks yield salvaged oil at 35 % per stock unit in sourceLayoutVersion 3. No recipe creates oil or Spares from nothing; the pump is the only zero-input recipe and it requires an authorized source.

### C — loot, recycler, POI (partial)
- C2 done: `tests/b05-recycler-reload.test.ts`. An in-flight X:pipe-v1 job survives save/reload, completes exactly once, keeps the reserved pipe UID, and a second recycler or an off-site recycler is refused by validation (Map authority).
- C1 audit only: crude petroleum is never in loot or wreck tables; it is granted only by the authorized pump. No new loot was added. The W06/B04 pool-to-industry audit is NOT finished.
- C3 NOT done: POI access depth was not implemented. Reason: the authored POIs are Map-owned and the review asked for no new locations. Next executable task: compare `poiAccess` (balance) with v11 SYS05/SYS06 edges on the existing Lighthouse/Foundry/Delta Relay sites and add one causal feedback case only where an authored site supports it.
- C4 partial: pump sprite (idle/run two frames/dry, 20×24), drum icon, station source line, build-menu lock. The inventory crude slot was inspected at 640×360 but the icon is small; a close-up review is still required.

### D — verification (final SHA of this checkpoint)
- `tsc --noEmit`: exit 0.
- Full Vitest: 74 files, 569 tests passed (second run). The first full run failed 4 files (`b03-return`, `home-production`, `lr02-shipping-access`, `s12-airdrop`) on timeouts under load; all four pass in isolation (35/35) and in the second full run. Treated as load flakiness, not a logic regression, and still worth a CI check.
- HTTP build (`vite.http.config.ts`): exit 0.
- Standalone build (`vite build` singlefile, `NODE_OPTIONS=--max-old-space-size=3072`): **blocked**. Killed with exit 137 (out of memory) inside the sandbox; not run to completion.
- Visual: `web/evidence/b05r-pump/` (640×360 and 1280×720). Inspected: pump jack silhouette, head and lamp readable at native 640×360; the Crude slot in the inventory is present with a distinct item name, but its icon is small and needs owner review. Not inspected: cart and motorbike readability in new states, cargo transfer frames, Foundry Recycler UI, POI access feedback.

### Map requests (not blocking the mechanics)
- Authorized oil source sites with a versioned Map site id and map revision. Until these exist, the pump stays locked in production and is exercised only by the test fixture.

### Unfinished
- C3 POI depth, the full C1 loot audit, C4 visual audit, D1 LI→SOH table at full scope, standalone build.
- First next executable task: add the `map-site-v1` production authority shape as a refusal-only type with a Map request, then the C3 causal feedback on an existing authored site.

## B05-R final continuation (review 6700650523 of 893b9d9d) — PARTIAL, PR #44 DRAFT/HOLD/UNMERGED

### P0 fuel consistency (done)
- One policy: `stationBurnable(key)` in `catalog.ts`. A station burns any fuel item except `fuel_can`. Used by `stepStations` (burn), `move` via `isStationFuel` (deposit refusal with reason), `CraftPanel` readiness and `StationBody` legend.
- Old saves holding canisters in a station fuel input load unchanged. The canisters are not burned or converted and can be taken out to the pack. Generator and motorbike canister use is unchanged.
- Tests: `tests/b05-station-fuel-policy.test.ts` (6).

### C1 loot → industry (audited; one defect class fixed in tests)
- Evidence: `web/evidence/b05-loot/matrix.json`, test `tests/b05-loot-matrix.test.ts` (5).
- Matrix from live rolls (`lootRoll`) and real consumers (recipes, build costs, direct engine actions):
  - Metal Pipe: consumers 2 recipes (vehicle_frame_piped, iron_plate); sources toolbox pool, advanced pool, craft.
  - Iron Plate: consumer is the wall/door repair action (`repairStructure`), not a recipe. Source: toolbox pool, craft.
  - Mechanical Gear: 4 consumers; sources toolbox and advanced pools.
  - Refined Iron Ingot: 2 recipe consumers; fixed toolbox 1, advanced 2, furnace.
  - Mechanical Parts: 18 consumers; advanced W06 option only, plus craft from scrap.
  - Spares: 26 consumers; toolbox fixed 2, military option, vendor, wrecks.
  - Salvaged Oil: 5 consumers; wreck and vendor only, never a container.
  - Crude Petroleum: pump only; consumer refinery_crude.
  - Fuel Canister: consumers are generators and motorbikes (physical use), refinery output. Never a container reward.
- No orphan loot item after counting direct consumers (repair, field repair kit, bow ammunition, eat, Creator Core energy). A first test run flagged iron_plate, field_repair_kit, arrow, berries and energy_basic as orphans. Each was a false positive from recipe-only counting, and each has a real consumer in code (references in the test).
- Findings, retained (no source-supported change): the toolbox B04 pool hands out finished Metal Pipe, Mechanical Gear and Iron Plate (finite, 24 h per site). This removes some manufacturing and is kept as B04 design, SOH_PROVISIONAL. Recycling a pipe returns 1 ingot, less than the pipe costs to craft (2 ingots + 1 Mechanical Parts), so there is no free-resource loop. Containers never emit Fuel Canister, crude, cash or blueprints.

### C3 POI access feedback (done for the powered gate)
- `poiPowerMissingReason` in `poi-access.ts`: OFF with N s banked → "use E on the generator to resume; no can needed"; ran out → "add 1 physical Fuel Canister"; empty → same add-can instruction. Used by the Lighthouse door refusal. Refusals consume nothing (checked).
- Tests: `tests/c3-poi-power-feedback.test.ts` (3, including empty, resume, and depleted negative cases). Existing S05 suites pass (`poi-access-s05`, `poi-route-physical`).
- Not done: a combined card-plus-power reader (not authored on any map, per S05 limitations); new POIs or geometry (Map-owned).

### C4 pixel/UX (partial, honest)
- Inspected at native size: Oil Pump idle/dry (`evidence/b05r-pump/`, 640×360 and 1280×720). The pump silhouette and lamp state read at 640×360.
- NOT confirmed: Crude Petroleum inventory icon at 1280×720. The crop shows item slots but the crude slot could not be identified reliably. Also the crop shows a test-fixture overload warning ("Load 267.5/60 kg, slowed") from the fixture, not a shipping state. Owner review required; this is an open defect in evidence, not a claimed pass.
- Not inspected in this round: refinery working state, motorbike vs cart silhouettes in the world, recycler operating frames, POI access frames.

### D1 parity (NOT completed)
- Atlas v10/v11 and surviving v1–v6 reference material was not read in this session, so no LI row was written. No historical value was taken from memory. Remaining obligation: build the source-scoped table (LI year/mode/source → rule → confidence → SOH value → adaptation → code → gap) from `docs/reference/last-island-atlas/` on the reference branch, marking unavailable values ORIGINAL_UNKNOWN.

### D verification at final SHA
- `tsc --noEmit`: exit 0.
- HTTP build (`vite.http.config.ts`): exit 0.
- Full Vitest: 77 files, 583 tests passed in one run.
- Standalone build: not repeated after the earlier OOM (exit 137, 3 GB heap). Blocker: sandbox memory; not solved in this round.
- Flakiness: an earlier full run on 029db4a0-series showed 4 timeout failures under load that passed in isolation; this final run passed. Treat as load-sensitive, not reproducible here.

### Status
- S03: not changed this round. S04: partial (fuel policy, canister consumers). S05: powered-gate feedback added; card and gate remain as in S05 doc. S06: unchanged. S09: partial (B1 chain, B2 measurements from earlier). S10: partial (refinery crude; no production source). S11: not touched. S14: not touched. Nothing marked DONE.

### Next executable action
- Read Atlas v10/v11 (reference branch) and write the D1 source table into this ledger; then inspect the crude inventory icon at 1280×720 with a close crop and redraw the drum if it is not distinct.

## D1 — LI → SOH parity table (B05-R next step)

Source read this round: Atlas on `docs/gameplay-mechanics-first-policy-20261105` (commit `5f4e6c44`; read via git object, branch not checked out). Files: `extracted/atlas.json`, `extracted/BAO_CAO_CO_CHE_CHUYEN_SAU_v4.md`, `extracted/v11/07_SOURCE_AND_RECOVERY_LEDGER.csv`, `extracted/v11/02_FULL_DEPTH_CAPABILITY_LEDGER.csv`.

Source tiers, as recorded in v11 ledger: SRC08 (LI official 2019 loot/airdrop), SRC10 (2019 POI card-electric gate), SRC12 (2020 heat/refinery/vehicles), SRC13 (2020 Operation Base/trade) are `LI_OFFICIAL_VERSIONED`, `CROSS_CHECKED`, `SOURCE_READ`. The text of those official pages is not in the repo, so no official number is quoted here. Numbers in `atlas.json` come from community wiki pages with no mode or version scope, so they are `SECONDARY_LOW_CONFIDENCE`. v4 explicitly marks yields, furnace capacity and per-item probability as `[CHƯA BIẾT]` (ORIGINAL_UNKNOWN).

Row format: LI source/version/mode → original rule/value → confidence → SOH current value → deliberate adaptation → code → remaining gap.

| # | Mechanic | LI source / mode | LI original rule / value | Confidence | SOH current value | Adaptation | Code | Gap |
|---|---|---|---|---|---|---|---|---|
| 1 | Vehicle Frame | atlas `s_frame`, bench 3, unscoped wiki | 100 Iron + 30 Refined Iron + 50 Parts | SECONDARY_LOW_CONFIDENCE | 3 iron ingot + 2 mechanical parts + 2 spares, workbench L2, 25 s (SOH_PROVISIONAL) | SOH uses its own part economy, not LI counts | `catalog.ts` `vehicle_frame` | LI counts unverified; not copied |
| 2 | Motorcycle | atlas `s_motor`, bench 3, unscoped wiki | 200 Refined Iron + Frame + 30 Gears + 30 Plates | SECONDARY_LOW_CONFIDENCE | motorbike_kit: frame + drive + 2 iron + 2 fasteners, workbench L3, 40 s (SOH_PROVISIONAL) | Drive component added; gear and plate not in kit | `catalog.ts` `motorbike_kit` | Vehicle structure differs; no LI number is a SOH target |
| 3 | Iron Plate | atlas `s_plate`, mid workbench | 5 Refined Iron + 30 Parts | SECONDARY_LOW_CONFIDENCE | 2 refined ingot + 1 metal pipe + 1 parts → 2 plates, L2, 18 s | SOH chains plates from pipe | `catalog.ts` `iron_plate` | Conflicts with row 4 source |
| 4 | Metal Pipe | `s_pipe` (2023, rocket-launcher context) vs v4 TapTap 04/08/2022 | 5 Refined Iron + 30 Parts (2023); Medium Workbench, 3 s (2022) | ORIGINAL_UNKNOWN (sources conflict by year) | 2 refined ingot + 1 parts, L2, 18 s; Recycler `X:pipe-v1` returns 1 ingot in 10 s | No single LI value can be selected | `catalog.ts` `metal_pipe`, `recycler.ts` | Year and mode conflict; keep ORIGINAL_UNKNOWN |
| 5 | Oil Refinery | `s_refinery`, unscoped wiki | iron 500 + wood 200 + Low Quality Fuel 250 | SECONDARY_LOW_CONFIDENCE (scale unexplained) | iron 4 + parts 3 + spares 5 + brick 6 + glass 2 | Different economy scale; no copy | `catalog.ts` `refinery` | LI scale unverified |
| 6 | Refinery process | `s_fuel` | Low Quality Fuel = 3 animal fat + 1 cloth | SECONDARY_LOW_CONFIDENCE | 3 Salvaged Oil + 1 glass → 1 Fuel Canister, 14 s (`refinery_fuel`); 4 crude + glass → 1 can, 16 s (`refinery_crude`) | SOH oil from wreck, vendor and authorized pump; no animal-fat route | `catalog.ts`, `engine.ts` `stepStations` | Animal fat not in SOH; no LI rate |
| 7 | Fuel Generator | `s_door`, bench 3 | 20 Refined + 100 Iron + 30 Electronic Parts + 100 Parts | SECONDARY_LOW_CONFIDENCE | base_generator: 3 iron + 3 parts + 4 spares + 6 wood | No electronic_parts item in SOH | `catalog.ts` `base_generator` | Electronic parts absent |
| 8 | Loot classes and per-item odds | SRC08 official 2019 + v4 | Guarantee categories described; per-item percentage `[CHƯA BIẾT]` | ORIGINAL_UNKNOWN | W06 fixed + option rolls; b04-v1 role pools (SOH_PROVISIONAL) | SOH rolls are deterministic and sourced; no LI odds | `loot-ecology.ts` | Per-item LI odds unknown |
| 9 | Recycler output | v4 `[CHƯA BIẾT]`; PvE 2020 (4399) says Gear, Pipe, Blade disassemble to Parts | yield per item unknown; disassembly to Parts confirmed in the guide | ORIGINAL_UNKNOWN for count; ORIGINAL_CONFIRMED_IN_GUIDE for the route | pipe → 1 refined ingot, 10 s (`X:pipe-v1`, SOH_PROVISIONAL) | SOH returns refined iron, not Parts; deliberate adaptation to keep one physical sink | `recycler.ts` | Count unknown; route differs |
| 10 | Oil source | LI red barrel (crude + low fuel), oil_base POI "open fuel resource zone", SRC12 | Red barrels roadside; base is open zone | SECONDARY_LOW_CONFIDENCE for placement | No production oil source; crude only from authorized test fixture | Map placement not invented; POI-level source pending Map | `engine.ts` `authorizedOilSource` | Map site + revision needed |
| 11 | Pump rate | none in repo | ORIGINAL_UNKNOWN | ORIGINAL_UNKNOWN | 12 s per crude, wood fuel, `maxSourceStock` 200 (SOH_PROVISIONAL) | — | `balance.v1.json` `oilPumpV1` | No LI value |
| 12 | Powered gate / card | SRC10 (2019) green/blue/purple; card uses `[CHƯA BIẾT]` | card tiers and uses not in repo | ORIGINAL_UNKNOWN for uses | 3 uses (SOH_PROVISIONAL); powered window 180 s; door 15 s (SOH_PROVISIONAL) | colored tiers not authored in Map; combined reader not implemented | `balance.v1.json` `poiAccess`, `poi-access.ts` | LI uses and window unknown |
| 13 | Vehicle speed, fuel, cargo | v11 SYS09 rows NOT_RUN; no LI numbers in repo | ORIGINAL_UNKNOWN | ORIGINAL_UNKNOWN | road 125, ground 52 px/s; 0.05 fuel/px; tank 300; cargo 80 (SOH_PROVISIONAL) | measured in `b05-freight-compare` | `balance.v1.json` `motorbike`, `sim.ts` | No LI numbers to compare |
| 14 | Cart | none | ORIGINAL_UNKNOWN | ORIGINAL_UNKNOWN | road ×1.36 without terrainSpeed table; 240 weight | observed quirk, not changed | `sim.ts:347` | Owner decision |
| 15 | Furnace capacity / refined ore rate | v4 `[CHƯA BIẾT]` | ORIGINAL_UNKNOWN | ORIGINAL_UNKNOWN | smelt 10 s / 20 s (SOH_PROVISIONAL) | — | `catalog.ts` | No LI value |

Locked SOH rules not changed by this table: 336 h / 72 h, PvE, offline and reset, Creator Core, K1–K8.

Result: no LI number was promoted to canon. Rows 1–7 and 10 are the only ones with a non-ORIGINAL_UNKNOWN LI value, and all are SECONDARY_LOW_CONFIDENCE or conflicting by year. SOH values stay SOH_PROVISIONAL. Remaining obligation: obtain versioned LI text for SRC08/10/12/13 (outside this sandbox) before any row can be promoted above SECONDARY.

### Crude icon (C4 follow-up)
- Redrawn the crude drum (`drawCrudeDrum`): rounded silhouette, light rims, dark label with sheen, tap. Tests pass (`b05-industrial-art`, `b05-oil-pump`, 25/25).
- Inspected at 1280×720 native, zoomed ×4: the slot now shows a banded dark object with a tap. It is still box-like at 16 px. The round belly and the crude sheen are not clearly readable. **Not accepted**; remains an open C4 defect.

### D1 update: official text read (this round)
- Read the two official-site pages directly (fetch, not the sandbox network):
  - `hero.yingxiong.com/info/2020/0108/8968.html` (official 2020-01-08 update notice). It mentions 炼油机 (refinery) and 燃油发电机 (fuel generator) as heat sources (heat value up to 40, needs a territory cabinet). It gives **no recipe, cost, input count or rate** for the refinery, the fuel generator or Low Quality Fuel. Therefore atlas numbers for rows 5–7 are **not** supported by this official page. They stay SECONDARY_LOW_CONFIDENCE and unscoped.
  - `hero.yingxiong.com/info/2019/0805/7010.html` (player guide 情兽, hosted on the official site, 2019-08-05). Supports the following qualitatively, with no numbers: an electric resistor door opens only when **both** its power switch and its resistor wire are present; resistor wire is scarce; a timer shows how long the door stays open; a green room always yields a blue card; a blue room yields a purple card only sometimes. Rows 12 and 13 of the table are consistent with this, but the guide provides **no numeric card-use count or timer length**. Those stay ORIGINAL_UNKNOWN.
- Revised tier labels: the 2019 player guide is `LI_OFFICIAL_HOSTED_COMMUNITY_GUIDE` (qualitative only). The 2020 notice is `LI_OFFICIAL_VERSIONED` for its own statements, with no recipe numbers.
- No D1 row was promoted above SECONDARY_LOW_CONFIDENCE. No LI number was copied into SOH.

## B05-R PRIORITY 1 — Vendor freight (Mirela parcel)
- Mechanic: a Profile-secured vendor good (`VENDOR_SECURED`) bought with `buy {freight:true, id}` debits secured cash and vendor stock exactly once, then spawns a physical parcel (kind `bag`, `parcel:{purchaseId,item}`) beside the trader holding one UID stack. Pack room is never needed, so a full pack cannot refuse or destroy a paid item.
- Reused custody: `move` (reach 2.8 tiles, slot rules, motorbike weight cap), `grabCart`, `placeCart`, `useItem`, `pruneEmptyBag`. Cart weight is the existing soft overload (slows, warns), unchanged.
- Negatives covered: replay or duplicate purchase id, insufficient secured cash, out-of-stock good, full pack, out-of-reach load, save/reload, and a crafted save with a duplicate purchase id (rejected by `validate`).
- Tests: `web/tests/b05-vendor-freight.test.ts` (6). Fixture: secured cash granted for affordability only.
- Visual: parcel sprite `drawParcel` (16×16 crate). **Not yet inspected at native size; the browser click proof did not complete** (interaction target did not resolve in driver run). Status: PARTIAL.

## B05-R Vendor Freight — product closure (UI + persistence + parcel art)
- Real browser path (headless, `web/e2e/b05-vendor-freight-visual.mjs`): stand tile beside Mirela → real mouse aim → real `Trade with Mirela` prompt → real E → VendorPanel → real Parcel click (cash 20→16 once, stock 4→3, no pack medkit) → real prompt `Open Parcel · Field Medkit` → real E → ParcelPanel → real `Load into this cart` → cargo in cart with the same UID, parcel removed, pack still full (24/24). Passed at 1280×720 and 640×360.
- Fixtures disclosed in results.json: stand tile (accepted only on real prompt), secured cash grant, pack filled with stone, cart deployed via real `placeCart`.
- Persistence invariants (`persist.validate`): one stack of the purchased good, qty 1, unique UID across custody, matching `spend:` receipt with the exact price, unique purchase id. Tests: `b05-parcel-persistence.test.ts` (7).
- Open: a "Save failed" toast appeared in the headless browser after the purchase. localStorage and IndexedDB both wrote in the same browser; the serialize path passes in Vitest. Cause not isolated. Save/reopen is NOT claimed as browser-proven.
- Parcel sprite revised (light kraft box, white tape and label). Native frames inspected at 1280×720 and 640×360: distinct from the brown loot bag. Still small at 640×360.
- Not done in this round: C4 motorbike, refinery, Oil Pump, recycler, Lighthouse visuals; D1 LI 8968/7010 rows beyond the qualitative note above.


## B06 Gameplay Tower round — world boundary, presentation cues, feasibility (PARTIAL — not DONE)

Full detail: `docs/survival/gameplay-depth/B06_WORLD_BOUNDARY_CUES_FEASIBILITY.md`.

- System-level reconciliation of the 18 SYS sections against code: done. The 214-capability / 104-edge v11 audit is NOT complete.
- Large-world seam (pure, not wired into runtime): `web/src/game/world-window.ts`, 8/8 tests. Two live windows and traversal are NOT implemented.
- Presentation cue contract from committed receipts: `web/src/game/presentation-cues.ts`, 4/4 tests; 18 receipt kinds mapped; station/motorbike/door/cart cues still need new authoritative state.
- Persistent-world feasibility (A/B/C): design comparison only; canon 336h/72h unchanged; creator decision pending.
- Not done this round: Core 21-action effect audit, offline chronology audit, POI reusable mechanisms, full Vitest, HTTP build, browser proof.


## W07 Network A — offline power allocation parity (IMPLEMENTED, PARTIAL network)

- Source evidence: `engine.ts powerAllocation()` excluded armed turrets when `online=false`, so `stepBasePower`, `basePowerBoundary` and `powered` (shared `advanceWorld`) diverged from online for the same state. Proof: `tests/w07-power-offline-parity.test.ts` (2 active armed turrets, capacity 2, 25 s): online energy 13750 ms vs offline 15000 ms before the fix.
- Fix: one allocation rule online and offline (armed, supplied, wired turret reserves capacity whether or not the player is online). Firing stays online-only (`tickTurrets`). Offline defense now costs generator fuel and can unpower a workbench or door, the same trade-off online.
- Also fixed: `advanceWorld` fuel boundary used any fuel item (including Fuel Canisters) while `stepStations` refuses canisters. Now both use `stationBurnable`. Pinned by a canister-only furnace test (no burn, job intact).
- Superseded encodings updated with W07 notes: `s06-circuits` (armed turret offline now keeps the door unpowered), `k6-power` (5 s × 2 active loads drains 10 s of fuel).
- Atlas IDs (mapped from the PR44 correction's listed network, CSV row text not re-read this round): SYS06 power/SYS04 workbench/SYS17 offline; XEDGE-030 (shared fuel consumers), XEDGE-032 (production vs defense allocation), XEDGE-034 boundary (already present), XEDGE-096 (single chronology) — partial.
- Status: ENGINE_IMPLEMENTED, connected through `advanceWorld` (online and offline paths share it), tested by focused and regression tests. NOT verified: browser/human experience; refinery/pump offline interaction with generator is unchanged (refinery burns non-canister fuel inside `stepStations`, not audited against Atlas XEDGE-018/019 this round).


## W07-R — offline defense value (PARTIAL; corrects the W07 accounting)

Corrections to the W07 entry above (the earlier wording overstated closure):
- XEDGE-030 (shared fuel consumers) is generator/vehicle shared fuel and was already present before W07; W07 did NOT newly complete it.
- XEDGE-032 (production vs defense allocation) gained OFFLINE ALLOCATION PARITY only. It is not total closure.
- XEDGE-034 (outage/chronological job pause) is NOT proven complete by W07.
- XEDGE-096 (unified chronology) is broader than the 25-second allocation comparison; only the power-allocation and station-fuel boundary parts are covered.
- No full v11 edge is marked CLOSED here: the CSV row text was not re-validated in this round.

Offline turret combat — BLOCKED (not implemented, no fabrication):
- Technical limit: `tickTurrets` requires live creature positions (`offlineUnresolvedAt===undefined`, live `dist` to the player and the turret) and `tickProj` requires live projectile sweeps with `clearPhysicalLine`. The offline path (`settle`) resolves only trace-based playback for at most 24 creatures; combat, sight and knockback checkpoints are marked unresolved, not simulated.
- Gameplay limit: no offline projectile hit can be established from evidence, so offline firing would invent kills. Bible K5/K6/K8 and C08/C09 require physical causes; C09 allows an optional powered turret to influence offline outcomes only through real, evidenced contact.
- Consequence kept honest: an armed, supplied, wired turret with arrows reserves generator capacity and fuel while the player is away, and does NOT fire. Disarming it stops that draw. The return report now says so (`settle` line, derived from the allocation at settlement start).

Refinery / pump chronology (W07-R proof, `tests/w07r-refinery-chronology.test.ts`):
- Same funded `refinery_industrial` job (3 wood fuel, 6 salvaged oil, 1 glass, level-2 bench): online 1 s steps and one offline settlement produce identical fuel, burn, job, output and receipts at 40 s (job completes: 2 Fuel Canisters + 1 Lubricant; salvaged oil consumed once).
- Fuel exhaustion (1 wood = 20 s, job needs 26 s): both paths pause at the same boundary (`fuel_out`), output stays empty, and the job completes after a real refill online.
- Finding: refinery chronology is ALREADY CORRECT for these cases; no production change was required.

Atlas status for this round: ALREADY_PRESENT (refinery chronology, XEDGE-019 fueled refinery cycle, for the tested cases); NEWLY_IMPLEMENTED (truthful standby report line; panel text correction); PARTIAL (XEDGE-032, XEDGE-096); CAUSAL_CHAIN_CLOSED: none; CREATOR_DECISION_PENDING: whether an idle armed turret should draw standby power offline at all (current rule = online rule, kept for consistency).

## W08 — PvE sensory ecology: committed bow release as a world sound (IMPLEMENTED, PARTIAL)

- Causal chain: a committed bow release (`sim.ts resolveSwing`, the point where the arrow is removed and the projectile is created) emits one `combat-sound` `WorldStimulus` at the player's release position and tick time. Melee swings in the same commit path emit a quieter `audible-melee-v1` source. Empty bows and aborted actions emit nothing.
- Identity (corrected in W08-R): `sourceId = combat:<seq>`, where `seq` is read from the `stimulus.emit` receipt AFTER `receipt()` advances the sequence. The receipt detail is `ranged:<x>,<y>` or `melee:<x>,<y>`. `eventIndex` equals the receipt sequence. The earlier W08 code predicted the sequence before the increment; the W08-R test pins the exact agreement.
- Ranges (`balance.v1.json worldStimulusV1.combatSoundRanges`, SOH_PROVISIONAL, ORIGINAL_UNKNOWN, no Last Island numeric claim): ranged 150 px, melee 36 px. Lifetime `signalMs` 4 s; knowledge `memoryMs` 24 s; bounded list `combatSignalCap` 32 (oldest unexpired entries dropped, never replayed).
- Creature response, existing path only: `noticeStimulus` (species hearing table: wolf 1, crawler 0.8, beetle 0.7, toad 0.55, boar and crab deaf), `clearPhysicalLine` obstruction, `stimulusNearHome` exclusion (sounds within 8 tiles of player-owned structures are ignored, as before), `investigateStimulus` moving to the sound point using `astar`, arrival/expiry/blocked/unreachable endings through `endInvestigation`.
- Hearing without sight: a wolf's day sight is about 132 px (110 × 120%); its sound range is 150 px. A wolf at 140 px hears the shot and cannot see the player; the test pins this.
- Player choice: the creature learns only the sound point. Moving away does not update it. Sight (`observePlayer`) and encountered trace (`trackEvidence`) rules override it normally when they actually occur.
- Persistence (W08-R): versioned `combat-sound` branch in `persist.ts`. The airdrop branch is unchanged, and at most one airdrop entry is allowed. Combat sources must match `combat:<index>` with `1 <= index <= r.seq`, exact range and lifetime, in-bounds coordinates, and a live timestamp window. When the receipt for that sequence is still in the bounded log it must be exactly that `stimulus.emit` (kind, time and `ranged|melee:x,y` detail). Knowledge must also match any live signal at its own coordinates and time, and its approach goal must be a tile-centred 4-neighbour of the source tile. Known limit: once a receipt has been evicted from the 250-entry log, the save can only be checked for internal consistency. A hand-edited save can still fabricate a self-consistent expired source. Cryptographic authentication of saves is outside this round and needs a Creator/architecture decision.
- Offline (scope stated exactly): `settle` creates no sound emission, no sound notice, no creature movement and no sound-caused hit. Existing offline survival, upkeep and decay rules are unchanged and still apply; this round did not change them. Existing offline investigators keep their conservative state.
- Tests: `tests/w08r-combat-provenance.test.ts` (14, W08-R) and `tests/w08-combat-sound.test.ts` (9, W08): bow release exactly once, invalid release none, melee short-range only, nearby wolf hears and investigates the source without tracking the player, out-of-range/deaf/walled do not, wall-blocked route ends `blocked`, expiry clears, save/reload no duplicate and forged rejection, offline no invention. `tests/s08-world-stimulus.test.ts` (10) still passes.
- W07-R follow-up done: turret panel now states that disarming frees reserved capacity, that an enabled generator may still burn idle fuel, and that switching it off stops fuel use but removes power from connected devices. Balance and the fuel model are unchanged.
- Atlas (cited IDs; the v11 CSV is not present in this checkout, so row text was not re-read): SYS08-C03 PARTIAL (now bow and melee sound, in addition to the airdrop source); SYS08-C09 PARTIAL (investigation lifecycle, now also for combat sound, still no auto-ambush); SYS08-C01 PARTIAL unchanged; XEDGE-042/043/047 referenced, NOT newly closed; XEDGE-072 (airdrop sound) NOT newly claimed complete.
- NOT done: Core Signature sound source (not added this round); audio presentation consuming committed events (Visual Arena; no gameplay sensing in audio); browser proof (none claimed); no creature spawning, relocation, home or wealth targeting, or sound-triggered raids; ammunition cost and Gold skill unchanged.
- Next missing causal slice: Core Signature commit as a major loud source, then a separately approved audio presentation adapter.

## W08-R — independent corrective acceptance of W08 (PARTIAL; corrects the W08 entry above)

Corrections found by the review and fixed in code, not just described:
- P0 identity: the W08 emit path formatted `combat:${r.seq}` before `receipt()` incremented the sequence, so the receipt named the previous sequence. Fixed; detail no longer carries a predicted sequence. Test: receipt id, seq, detail, sourceId and eventIndex agree after a save round trip.
- P0 provenance: the W08 validator accepted any `combat:N` with N <= r.seq and any coordinates. Now: a present receipt for N must be exactly that emission; live signal and knowledge must agree; the goal must be an adjacent tile-centre; N beyond the committed sequence is refused. Adversarial tests: unrelated receipt sequence, forged knowledge coordinates, forged live coordinates, fake goal, wrong eligibility, sequence beyond committed. Legit knowledge still loads after its receipts are evicted (test).
- P1 cap eviction: the W08 cap sliced the combined list and could evict a still-valid airdrop. Fixed: overflow evicts only the oldest combat entries, never an airdrop. Regression test: an airdrop stays present through 40 combat pushes; combat stays at the cap of 32.
- P1 timing: the 4 s signal window (`signalMs`) bounds detection; the 24 s investigation memory (`memoryMs`) starts at the emission time and outlives the signal. Test: no notice is possible after the signal expires; a notice made in the window keeps memory until emission + 24 s.
- P1 home acoustics (findings, no new Creator rule made): `stimulusNearHome` is the inherited blanket 8-tile exclusion from the airdrop landing rule and applies to combat sound. Tested cases:
  - Shot within 8 tiles of a player-owned structure, unobstructed wolf at 140 px: no notice, structure not struck.
  - Shot in open terrain, structure 12 tiles away: heard; investigation goes to the emission point; structure not struck.
  - Creature learns only the emission point, not the player's later position.
  - Creature-side outcome of the Creator decision below.
- Creator decision (NOT silently made): the inherited 8-tile rule is a home-protection policy, not physics. Consequence: a fight at the base is silent to creatures next to it, while a shot 9 tiles away can still pull a creature to within about 9 tiles of the base. Compatible options for the Creator: (a) keep the blanket exclusion as an explicit home-protection policy, which is the current behaviour; (b) physical hearing everywhere, with investigation allowed near homes but never attacks on structures (K6), which increases home exposure through sound and needs explicit approval. Recommendation: (a) for now, documented as a policy; decide before any combat-sound expansion.
- Timing and coexistence: airdrop and combat signals share the list with the airdrop intact. The airdrop branch of `persist.ts` is unchanged, and the existing airdrop stimulus tests pass.
- Offline wording corrected: no sound-caused combat, no movement and no sound notices offline. Existing offline survival, upkeep and decay rules are not claimed to be absent.

Other observed (not changed in W08-R): `observePlayer` sight uses the terrain grid through `los`. Wandering creatures can still see the player around built walls, because wall entities are only checked by sound's `clearPhysicalLine`. This is pre-existing sight behaviour, not a new sound rule. Recorded as a follow-up; not fixed here.

Atlas (cited IDs; CSV not present in this checkout; repo SYS08 document as source):
- SYS08-C03: PARTIAL (airdrop and bow/melee sound, corrected identity and provenance). Not DONE.
- SYS08-C09: PARTIAL (investigation lifecycle with signal and memory timing). Not DONE.
- SYS08-C10: PARTIAL (offline boundary stated exactly above). Not DONE.
- SYS08-C01: PARTIAL, unchanged.
- XEDGE-042 / 043 / 047: referenced, NOT closed.
- XEDGE-072 (airdrop sound): NOT newly claimed complete. Airdrop noise pre-existed.
- No SYS08 or XEDGE is marked DONE.

Verification at this checkpoint: see the W08-R handoff for the exact SHA and gate results.
