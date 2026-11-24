# 03 — EIGHT DISTINCT AUTONOMOUS WORK LOOPS: PRODUCTION CONTRACT
**Baseline gate: PARTIAL; executor exists, natural cycles NOT proven.**
Sources: web/src/game/human-jobs.ts taskCandidates/planHumanOccupation/executeHumanWork; humanworld.ts planAutonomousWork/humanWorkTick/performHumanHarvest/depositHumanOutputs; engine.ts queuePaidRecipe/stepStations/repair/recycler/garden/power; existing catalog/BOM; Survivor Contract §25.4 and §15.
**All eight are OCCUPATIONS; Guard, Medic, Builder may output a healed/defended/repaired world state rather than an item. Different role DOES NOT imply distinct HP class.** Bandits/vendors/travelers are overlays, not ninth occupations.

## COMMON WORK TRANSACTION — BUILD ONCE
Worker goal known to actor and authorized by own community/standing order → priority vs hunger/water/rest/danger/companionship → known real object/item/source → floor/owner/station/power/skill/tools gate → global route search or explicit blocker → physical travel time and contact → source/UID reservation and input fetch → timed visible action → authoritative machine/work commit → claim/output/world mutation → carry to compatible owner store/recipient → exact receipt and retry/next unit.
States should be explicit and recoverable: SELECTED / ROUTE_SEARCH_PENDING / FETCHING / TRAVELING / EXECUTING / MACHINE_RUNNING / OUTPUT_READY / COLLECTING / DELIVERING / COMPLETED / BLOCKED / INTERRUPTED. A generic work task can carry role-specific action payload but every phase must have event ID and unambiguous success vs pending vs impossibility.
Standing orders are optional bounded permissions with max amount/time/emergency reserve; no perpetual unlimited order. A worker joins player => home work suspended, not simulated in duplicate. Work cannot begin while dead/downed; blocked/low resource cases return a recoverable causal result, not endless busy spin.
Use same K1 custody, K4 recipes, K6 structures, K7 movement and K8 receipts as player. Unreserved public/player station output is not NPC-paid output. The recent workerId/jobId claims MUST remain exact across interrupted work, station destruction, reload and concurrent user jobs. Output collection must use claim UID, not simply same item key. Maintain item conservation and one physical position.

## OCC-1 SALVAGER — HARVEST → RECYCLER → STORE
**Source:** distinct audited REGIONAL_HUMAN_ECONOMY salvage or lawful SHARED_HARVEST; never player G1B chest. Choose actual local wreck/abandoned machine/boat parts with anchored UID and allowed yield.
**Plan:** carry a real tool, route to source, spend extraction time/wear, debit exact stock, receive specific scrap UID, physically carry to active authorised Recycler with capacity and power/fuel rule, queue canonical recoveryPlan on exact item UID.
**Commit:** recycler reserves and consumes scrap once, actual queue time, worker-owned output UID with jobId, collect only matching lot, deliver to real store. Existing salvage result can feed Mechanic/Builder.
**Blocked:** no source/tools, depleted/claimed source, Recycler absent/unpowered/full, destroyed source, too-heavy cargo, player opens source first, worker injured while hauling. Cannot finish merely because Recycler exists while pack already contains an arbitrary fixture item.
**Proof:** natural New Game worker autonomously chooses and performs outdoor salvage + recycler + store; exact source pre/post, tool wear, UID ledger, interruption/reload and one blocked case.

## OCC-2 MECHANIC — REAL DAMAGED UID/BOM
**Source:** real damaged player-allowed/community-owned tool/device, not a constructed test-only UID. Recognize actual authorized repair right, existing repair plan and suitable workbench level.
**Plan:** select specific damaged UID, obtain exact materials from reachable owned store, physically carry item (or treat fixed machine at its location under valid repair law), travel to station, reserve BOM/time and safely handle original UID.
**Commit:** decrease actual BOM units once, repair existing UID condition, do not mint new replacement item; return to rightful owner/store. Prevent double repair of item already fixed by player or competing mechanic.
**Blocked:** item at max durability, missing parts, invalid bench/research, no ownership, destroyed workbench, item taken away during travel, disconnected floor.
**Proof:** naturally generated worn tool or equipment actually repaired, source-funded parts, same UID before/after, failure with missing BOM, interrupted save and pickup.

## OCC-3 COOK — GATHER → PAID RECIPE → FEED
**Source:** community legitimately sourced food, water, fuel and existing known canonical Campfire/food recipes. Recipes are actor-known where permitted, not player's research ledger by magic.
**Plan:** find shortage/meal need, fetch accessible exact input UIDs, transport to real station, fuel/ignite/pay once, queue a canonical paid recipe, wait or move on without magically creating output.
**Commit:** workerId+jobId output lot; collect own finite portion only; deliver to store or actual hungry recipient; NPC population consumes output physically. Preserve existing Cook executor test but add natural-selection/browser proof.
**Blocked:** recipe unknown, missing ingredients/fuel/water, incompatible station, full output, other player claim, interrupted queue, no delivery route. Avoid adding substitute recipes or item multiplier.
**Proof:** one naturally observed complete cooking cycle and one same item conserved across reload; sample recipe output used as actual food by a human.

## OCC-4 GARDENER — SEED/WATER/GROW/HARVEST/REPLANT
**Source:** actual owned plot, real seed UID, water vessel/barrel/source, soil/climate/season and canonical garden grow laws.
**Plan:** when plot empty obtain exact seed; reach plot; plant/pay; during growth identify water/climate constraints, fetch/charge water and tend physically; wait until ready under real time; harvest permitted yield and returned seed as canonical (no seed multiplication); deliver and replant under funded order.
**Commit:** exact plot/growth/water state and UID, time/catch rules identical active/offscreen; harvest can feed Cook and village.
**Blocked:** no seed/water, drought/frozen/unsafe plot, plot owned by someone else, harvest not ready, full store, patient/guard emergency interruption, plot destroyed.
**Proof:** plant→grow→tend→harvest→deliver→replant under real season/clock, not instantly setting growth=1.

## OCC-5 MEDIC — DETECT PATIENT → TREAT → RECOVER
**Source:** physically injured/bleeding/downed member in same accessible world, personal/community authorized medicine, actual medical affordance.
**Plan:** observe/report real injury (no omniscient global patient list where not known), choose triage priority, obtain medicine and reach patient by door/floor/route, spend treatment duration and maintain patient eligibility/LOS.
**Commit:** debit exact bandage/herb/medkit as defined, stop bleeding/stabilize, bounded HP recovery, patient retains identity/wounds and does NOT instantly gain all HP/gear. Record actual patient/source event.
**Blocked:** unreachable/higher floor without stair, death before arrival, another medic already treated, no medicine, attack interrupts, wrong item or full trade.
**Proof:** real combat-induced DOWNED → patient discovered → real medic treatment → preserved status across reload; demonstrate no treatment with no medicine.

## OCC-6 GUARD — PATROL/OBSERVE/DEFEND/REST
**Source:** actual protected store/door/road/people and physical known threat, own weapon/armor/arrow/Core; risk policy and fatigue.
**Plan:** patrol authored reachable posts, visible walk and scan, acquire hostile by LOS/range/perception, choose interpose/fight/retreat/assist based on gear and conditions. No magical far-off threat detection.
**Commit:** real K5 projectile/melee contact, actual ammo/Core/stamina/wear, injury, optional capture/rescue, report/witness and move back to post or bed/rest with consumed supplies.
**Blocked:** no arrows, locked door, missing weapon, exhaustion, superior threat, target lost, protect-friend conflict, guard DOWNED.
**Proof:** real guard versus creature/player hostile with movement/aim/contact/damage, ordered defense and retreat, save/reload; not merely lastWatchAt updated.

## OCC-7 ENGINEER — SOURCE-FUNDED POWER/DEVICE
**Source:** real generator/network/device, fuel/components held in authorized storage, actual generator operation and powered downstream machinery.
**Plan:** detect unpowered/dirty/damaged system, fetch and transport actual fuel/parts, reach generator, verify owner/controls, spend time/materials, apply existing power/fuel/device condition rules. A new generic “enabled=true” is not sufficient.
**Commit:** paid fuel unit charged, generator consumes it over time, actual workbench/turret/door/circuit gets valid power, maintenance prevents actual fault only while materials permit. Record supply depletion and downstream state change.
**Blocked:** disconnected circuit, no fuel, missing components, destroyed generator, wrong owner, unauthorized card/power gate.
**Proof:** observe genuine powerless→fuel delivery→power on→downstream work, then fuel-out/power-off; save/reload parity.

## OCC-8 BUILDER — SOURCE-FUNDED STRUCTURE
**Source:** real permitted K6 structure damaged or actual authorized building work with blueprint/space/terrain/ownership. Contractor must not repair arbitrary lore props.
**Plan:** identify structure HP/repair BOM or new authorized structure site, get exact material UIDs and tools, route to build location and spend work time.
**Commit:** debit paid quantities, modify original structure entity HP/creation in existing build authority with one receipt; power/shelter/defense collision update if applicable. Avoid free new structure and invisible full repairs.
**Blocked:** unowned target, no material, already max HP, path blocked, invalid terrain/footprint, destroyed/removed target, Elder attack interruption.
**Proof:** natural damaged wall/bed/defense repair, same UID and correct HP increment; lost supplies interrupt; repaired shelter visibly affects needs/defense.

## CROSS-ROLE ACCEPTANCE AND COVERAGE
Construct an eight-row evidence matrix with actor/source anchor, source-before, route/floor, input UID+quantity, station/event, time, output UID/world mutation, destination receipt, saved/reloaded outcome, interrupted and blocked case, observed browser scene.
Demonstrate real coupling:
Salvager spares → Mechanic repairs tools → Gardener supplies produce → Cook processes produce → Medic heals injured → Guard protects route → Engineer powers station → Builder repairs shelter. Not a scripted quest; the mechanics must interact freely, not require all these jobs in fixed order.
Run organically from New Game: agent may instrument/observe authoritative state and accelerate time only for long growth, but cannot inject task intent, materials, full Trust or output as proof of natural planning. Unit fixtures with forced inputs remain unit evidence only. Cases should include several settlements and at least one remote worker.
**DONE:** all eight naturally select distinct feasible work, physically execute/settle, store/carry consequences, resume across window/reload, and demonstrably block under real constraints. Label any executor-only path PARTIAL.