# SOH — SURVIVOR SETTLEMENT CONTRACT V1 (15 Nov 2026)

**Status:** DESIGN_LOCKED_BY_CREATOR for direction A (living NPC settlement); CT-derived operational rules below are the minimal coherent implementation interpretation of Bible K1–K8. **NOT_IMPLEMENTED / NOT_PLAYABLE / NOT_VISUALLY_ACCEPTED.** All numeric rates, caps, drop rates and staffing efficiency are TUNABLE until Last Island evidence and native human observation. A source claim is not an engine feature.

**Authority:** `web/ref/bible.md` is the primary gameplay authority. This contract is the one detail specification for NPC encounters, recruitment, residence, work, defense and run completion. It may not supersede conflicting Bible rights, the 157-item/114-live-recipe master or the Last Island source-record caveats. Reference: `web/ref/last-island-copy-first/ITEM_CRAFTING_MASTER.{json,md}`. Do not create a second economy, quest framework or separate recipe registry.

## 0. Fantasy and nonnegotiable scope

- SOH is a free PvE survival sandbox. The player begins alone, scavenges and builds anywhere physically permitted; may meet, help, recruit, house, employ and protect **living survivors**. A community should create a home worth returning to, not compulsory management.
- Every core route remains viable **SOLO** (survival, crafting, research, base building, exploration, ordinary defense, non-boss Ragnarok cash path, evacuation). Recruitment is always optional; never a stage-gate, mandatory tutorial, daily quest or precondition for access to the ordinary 157-item economy.
- No settlement hub prefab, permanent village, required recruitment center, new terrain/biome, invented POIs, NPC recruitment-token item, morale currency, free companion summon, automatically successful remote missions or invisible random raids.
- The player builds the actual shelter and provides physical materials and time. Residents have identity, needs, autonomy, skills, tools, work and vulnerability; they do not become chests of loot or passive production buffs.

## 1. Retain Last Island's actual loot-source structure in parallel

**LI official version-specific benchmark:** 2022-11-09 notice `https://hero.yingxiong.com/info/2022/1109/13052.html` identifies six chest families (Supply, Toolbox, Military, Food, Medical, Harpoon) and 16 explicitly listed damaged/low/mid/high variants for the first five. Room green = 2 Low Supply + Low Toolbox + Low Military + Low Food + Low Medical (6); blue = 2 Mid Supply + Low Toolbox + Mid Military + Mid Food + Mid Medical (6); purple = 2 High Supply + High Toolbox + High Military + Mid Military + High Food + High Medical (7). Harpoon has no evidenced full grade sequence in this record; Airdrop is distinct. This is historical LI baseline, **not** a claim all Veyra rooms currently fit all fixtures.
- Preserve the distinct loot chest types and the above **source blueprint**; deep-room premium crates and Airdrops are never replaced by recruited people. Verify spatial feasibility/collision in existing buildings before claiming parity.
- Three roadside blue/yellow/red salvage barrels use multi-hit HP/material/capability interaction. Other one-click/open caches remain barehand-interactable; no damage grind. Tool-family efficiency on barrels shall be source-measured/benchmarked, not fabricated.
- NPC one-click item-giving uses the **same run-source stock, UID, atomic transfer and depletion ledger** as a loot grant, with a different actor/presentation. A unique `source_id` cannot pay out again after recruitment, scene change, restart or relocation. It is not a reason to remove chest instances or count an NPC as one of the 6/6/7 guaranteed LI room crates.
- **Source archetypes are orthogonal to roles:** a traveler with spare bandages is not necessarily recruitable; a recruitable mechanic need not carry a rare toolbox roll; no high-tier Core minted as joining bonus. Three legacy Field Core source pins/unique POI loot remain unchanged until independently authorized.

## 2. NPC kinds and identity

- `TRANSIENT`: a roadside person who may speak, trade, give/receive a finite physical item once, leave, or stay. No assumption of recruitability.
- `RECRUITABLE`: a named, run-unique actor with a plausible reason to join. Discoverable as an optional encounter on accessible existing roads/POI exteriors, not universally purple/boss locked. Not every positive interaction results in consent.
- `RESIDENT`: a recruitable actor who physically arrives, receives a valid home/bed, persists as a member of the player's settlement; retains a profession but may be idle.
- Existing `vendor` NPCs with real prices/stock continue as vendors, NOT automatic free-drop residents. Conversation, trade and recruitment rights are separate capabilities on one actor.
- Stable `survivor_id` for the entire run, independent of local-window entity allocation; identity, name, trade stock, starting equipment, ownership, condition, unique actions and remembered interactions are saved. On runtime reload or reprojecting the Veyra window, **reconstruct** the same actor; never create a second resident. NPCs are **NOT inventory items**, recipes, pets or cloned `Creature` aliases.
- Encounter sources should be authored by family/POI purpose and deterministic seed with exact physical coordinates; spawn in navigable cells that do not block stairs, doors, route clearance, vendor access or 640×360 interaction. No new geography needed.

## 3. Recruitment and movement state machine

`UNMET -> MET -> (UNWILLING | OPEN_TO_JOIN) -> FOLLOWING / WAITING -> ARRIVED -> RESIDENT -> (AWAY | LEFT | INJURED | DEAD | EVACUATED)`. Injury, inventory, trust/consent and work status are orthogonal, not extra quest checkpoints.
- Free conversation provides **observable information**. Item help, medical treatment or local machine fixes operate on existing entities and physical inventory. Completing the condition BEFORE speaking counts; no `quest_started` flag, fabricated accept/reward step or mandatory NPC dialogue.
- Recruitment requires expressed NPC consent, player opt-in, a reasonably viable destination and an actually viable physical route. A human may decline if protecting another person, seriously injured or unwilling to abandon a place. Not all NPCs can be recruited; no arbitrary affinity XP bar.
- Escort choices are **Follow / Wait / Release**. Resident navigation uses genuine path/collision/floor restrictions and weather/hazard costs where supported; player can interrupt without resetting progress. No NPC teleport home, no remote rescue from map menu, no NPC picked up in inventory or added to home on click.
- If the player dies, resident/escort remains at its last causally justified position or takes a **known legal** fallback; death respawns only the player. If crossing a window or offline boundary, preserve global coordinate, floor, planned path and progress; advance only with certified traversability and travel time. A blocked route pauses with an actionable explanation, not fabricated arrival.
- NPC ownership/control is voluntary companionship: `Release` and `Change Home` must be available with actual paths; NPC may physically leave under comprehensible conditions. No arbitrary kidnapping, NPC loot farming, vendor stock exploit or involuntary conscription.

## 4. Settlement eligibility and resident needs

- A settlement is a **player-built owned shelter anywhere K6 allows**; no cabinet or new special building required for first resident. Assign an owned intact `bed_straw` or later authorized real bed, in a sheltered/roofed enclosed reachable room. **One resident per dedicated sleeping slot**, player rest bed constraints unchanged; do not conjure extra sleeping slots. A cupboard/claim improves existing territory rules but does not become a recruitment gate.
- Home identity is a stable set of physically adjacent/accessible owned structures (bed, roof, door, station, containers). When a structure collapses, loses valid ownership or becomes unreachable, resident job/shelter eligibility updates; resident actor persists at its true location. No arbitrary reset/removal of occupants.
- Five **observable functional conditions**, not five monetized gauges: **Health**, **Food/Water supply**, **Rest**, **Exposure/Shelter**, **Safety/Threat**. Hunger/thirst and wounds must originate from actual consumption/events. Temperature/radiation/climate are the same K2/K5 laws as applicable, with proven differences only.
- Each resident consumes **actual eligible food and actual potable/charged water** from explicitly assigned supplies on a clocked schedule; no invisible global pantry. Personal carried rations may be consumed once. Work slows then stops as needs deteriorate. No unexplained starvation death on load, nor immortal invulnerability in real combat/hazard. At safely sheltered offline home, lack of supplies first produces a clear `UNFED/DEHYDRATED -> UNFIT_FOR_WORK` condition; any later critical harm/departure requires a documented causal timeline and advance warning, never a blind login punishment.
- Rest requires a valid assigned bed and enough scheduled time; sleeping/work/guarding cannot all occur at once. Residents have short idle/social/home animations whose physical state matches their actual action; no extra cosmetic NPC multiplying work.
- No complex global Morale, romance, marriage, taxation, reputation economy, personality leveling, infinite social gifts or base census minigame in V1. Social memory is a **bounded ledger of real events** (rescued, treated, invited, worked together, lost home, survived attack), not a mandatory affection meter.

## 5. NPC occupation model — exact capabilities, inputs and blocked states

Every resident can have a profession and a single active assignment + bounded standby policy. A profession is an **affordance**, not an unlimited passive multiplier. Skills can affect **work handling time/accuracy within a measured baseline**, but not create output, skip recipe knowledge or violate durability/upkeep.

| Specialty | Physical assignment | Inputs and costs | Concrete outcome | When it stops |
|---|---|---|---|---|
| Salvager | Owned Recycler/authorized salvage bench | Specific item UID to recycle, station availability, allowed material semantics | Exactly one existing recycler yield, with recorded loss; never automatic Core/card/unique disassembly | No item, tool, station or authorized item class |
| Mechanic | Owned Workbench / repair-compatible station | Damaged tool UID + existing per-item repair BOM (e.g. Salvager Axe 1 Refined Iron +1 Parts) | Existing repair action completes, same durability and charge law | Missing tool, materials, bench, access, resident fit |
| Cook | Campfire/authorized food station | Existing recipe, food item stacks, real fuel/water/time and slot | Existing edible output physically occupies actual output slot | No fuel/food/slot, fire extinguished |
| Gardener | Owned reachable garden plots | Real seeds, water, climate, elapsed growth; individual labor time | Single manual plant/water/harvest step | Plant not ready, absent seed/water, work conflict |
| Medic | Accessible patient and clinic/bed area | Bandage/Medkit/Syringe etc. and valid treatment condition | Item heal effect / injury treatment to a physically present patient | No consumable, unreachable/ineligible patient |
| Guard | Assigned reachable patrol/guard post in owned home footprint | Actual weapon UID, durability, arrows/charges if relevant, rest, line of sight | Actual attacks against **observed** hostile actor, ammo and durability debited | No range/visibility/ammo, injury, retreat, rest |
| Engineer | Generator, electric network or valid industrial station | Real components/fuel/power/maintenance inputs; correct network/access authority | Existing electrical/maintenance or paid station job advanced legitimately | No connection/fuel/access, damaged device |
| Builder | Actual player-owned structure in reachable home | Existing physical repair materials debited; same HP & repair semantics | Repairs only after a committed paid repair task | Insufficient materials, unreachable/destroyed structure |
| Research aide (later V1+ capability) | Existing Research Table | Same authenticated Parts/specimen/blueprint and learning rules as K4 | Run-local single `learned_recipes` grant after true transaction | Knowledge already known, insufficient materials, tier gate |

**Hard rules:**
1. No NPC auto-harvest/loot/fight in unloaded distant POIs or conjure remote freight. Inside-base carrying must follow authorized custody and physical access; no pulling any item from any chest anywhere.
2. Station jobs use existing queue IDs, owner, input reservations, fuel/water/power and output slots. Player and NPC never both finish/pay the same job; output is not minted when job paused. Rev 6 item recipes and frozen old-job migration are untouched.
3. A resident may **queue**, **service**, **complete** or **maintain** a job only when that specific action is allowed by the ordinary player/station contract; do not bypass recipe-knowledge tier, station upgrade, power gate, per-unit batch cost or item uniqueness.
4. Auto-treatment of the player requires explicit opt-in and physical reach; by default medic treats legitimately assigned residents. Auto-repair of damaged structures is **intentional paid work**, not magic free regeneration after attack. Guard AI defends, not automatically raids/spawns opponents.
5. Work sharing at home is **local logistics**, not a separate clan shared-recipe system; the run's existing recipe knowledge ledger remains sole authority.

## 6. Resident priorities, workday and meaningful autonomy

**Default deterministic priority (within observed world state):** immediate physical danger/escape > urgent injury/triage > maintain own safety/seek valid shelter > scheduled sleep/meal > already-paid job > assigned maintenance/patrol > idle/social interaction. The user may configure guard duty and emergency policies without forcing suicidal behavior.
- Work is action-based: resident walks to target, visibly performs an animation, settles an existing mechanical action/receipt; a station can continue a **pre-funded autonomous device job** only when that station's actual rules allow it, independently of NPC presence.
- Shift timings, hunger/water per hour, walk speed, job handling speed, healing time, max community size and preferred standby radius remain **SOH_PROVISIONAL/MEASURED**. Never invent “LI official” values for these new NPC systems. No worker-cap rigidly tied to arbitrary new progression level; bed/food/workspace/path capacity are natural constraints.
- UI: tap/press F on resident -> small context panel `Talk / Trade (if capable) / Follow / Wait / Home / Assign Work / Equipment / Release` filtered by valid state. No multi-screen mandatory recruitment flow. Settlement summary shows residents, assignments, supplies, blocked reason and known threats, never psychic enemy intel. Render at native 640×360; no clipped panels or non-interactive portraits.

## 7. Guard and creature perception — absolute no-raid contract

- Residents may fight only by physically plausible action range, aim, damage, stamina/durability/charge and real hitbox, same combat source authority as K5. Guard can see/hear/observe within documented senses, patrol locally with actual collision, stand watch, respond to visible enemy or confirmed trail/stimulus, and physically retreat/seek shelter if overmatched. No guard `DPS buff aura`, ghost ammo or shoots through roofs/doors/floors.
- Hostile creatures keep their authored habitat, detection and trace epistemology. A resident visible to a creature can be spotted by **real line of sight**; any NPC-generated traces, if implemented, require real footsteps and lifetime/weather like player traces. **No "has residents -> roll invasion chance", no "NPC working -> magically spawns raiders", no omniscient location alert.**
- Player-placed turret and resident guard are independent: turret consumes funded power/ammo, resident consumes their weapon/ammo and time. They can defend together without double-counting one hit or sharing the same arrow stock.
- If a structure/guard/resident is harmed while online, actual attack and damage receipt required. Offline combat/hazards can be resolved **only** from known physical initial conditions, path, detection and discrete event ordering; if engine cannot prove consequences, preserve a named unresolved/pending threat, do not synthesize a dead resident or free safe state. No full 60FPS rendering while offline.
- Resident death is **final within the run** after actual damage/status and any physically valid rescue window; downed/injured state permits medical treatment using real items. On actual death, equipment/inventory becomes one recoverable physical custody bag; no duplicate gear/recruit instance. Player death does not automatically kill, despawn or revive residents.

## 8. Player-death, owner-loss and Ragnarok continuity

- Player death and respawn remain in the **same run**; surviving residents remain wherever they physically are. A repaired bed can still serve as player respawn if K6/K5 allows; resident beds do not multiply player respawn.
- If home loses cabinet coverage, roof, bed, door or workstation, apply K6 structure rules. Residents stop unavailable jobs, can move to reachable safe areas and are not magically erased or teleported. If stranded, report a recoverable blocked state.
- Run persists for **336 real hours**, last **72h Ragnarok**. Unpaid/unfunded work does not complete by simply waiting or logging out; offline simulation ordered by credible event chain and actual inputs.
- At finalize/abandon/expire/evac, erase all resident actors, inventory, work/bed assignments and NPC settlement ledger from the live run **exactly as other run-local holdings**. A physically completed optional rescue/evacuation of residents may register a uniquely sourced historical achievement, **no extra Ragnarok Cash or online score without separate approval**. An NPC evacuation doesn't force player run-finalization; no immortal permanent companion or cross-run weapon source.

## 9. Accessibility, physical-world and source conservation gates

- No NPC source, recruitment, room rewards or new item IDs required for basic New Game bootstrap, source availability or recipe functionality. The basic bound Stone Axe rescue-loop decision stands separately; recruiting villagers does not solve missing stone/card/item-source bugs.
- NPC encounters and chests have independent `source_id`, world position, family, stock and replenishment. A chest remains a chest; a survivor is not one of Last Island's mandatory card-room chest count. No gratuitous new special terrain, new POI or mandatory underground dungeon.
- No extra free items when joining; NPC carried gear is exactly the already-authored physically owned gear. Trading transfers custody one time; equipment is not duplicated on join/release/death. Characters never mint Parts, cards, Core charges, fuel or food from a conversation.
- Existing owner semantics of a bed/chest/station/cabinet are reused; player can revoke assignment and use station normally after committed job settles/cancels with proper refunds. Non-resident visitor has no implicit permission to consume home stock.
- Keep 157-item master and Rev 6 recipe integrity; any later gameplay-driven item/recipe changes require separate Item V2 revision and migration, not hidden within NPC feature work.

## 10. Implementation acceptance slices — no global redesign

**S0 DESIGN/ARCHITECTURE:** document actual engine seams and Veyra coordinates, show unchanged solo New Game/loot/POI/recipes, one sample survivor source authority, and authored job ownership model. No new geometry.
**S1 ENCOUNTER + CUSTODY:** one transient and one recruitable at existing accessible coordinates, genuine one-click speak/trade with exact stock receipts, save/reload idempotency and no chest replacement. No long NPC AI.
**S2 FOLLOW + HOME:** one NPC consents, follows/halts along actual traversable route, home assigned to roofed bed; controlled reload, window switch, player death and bed-destruction behaviors all preserve identity/position.
**S3 LABOR:** mechanic repairs an actual damaged Stone/Iron/Salvager tool at legitimate station using real input stacks; cook executes a food job; prove online/offline conserved inputs/outputs and no double claims. Add other specialties by the same mechanism.
**S4 DEFENSE + NEEDS:** guard with real Bow+Arrow observes one roaming creature, shoots with actual ammo loss, rests/retreats when blocked; food/water/rest consumed; demonstrate no fabricated raid when no physical stimuli.
**S5 PRESENTATION + PLAY:** human-driven route (not simulated forced quest): New Game->scavenge->meet person->optional offer->escort->bed->work->logout/relaunch->return and see earned output/causal blockade. Confirm no scroll clipping at 640x360 and actual native visual acceptance; no false conclusion from headless scripts.

Minimal deterministic tests per risky seam: `unique_actor_after_reload`, `single_gift`, `refusal_stays_optional`, `escort_blocked_no_teleport`, `bed_loss_no_despawn`, `double_queue_no_mint`, `food_water_supply_consumed`, `guard_real_sight_and_ammo`, `no_trace_no_raid`, `offline_event_order`, `run_finalization_wipes_npcs`, `solo_path_untouched`. Static checks for item IDs and source crosswalk, **not** a 157-item auto-play tour; runtime code is not accepted without human observations.

## 11. Design examples (not required quests)

- Roadside mechanic with broken Cart: actor has owned cart/actual missing Gear and no desire to join automatically. Player can help before speaking, trade, leave or invite if consenting; no spawned Parts from dialogue. If brought home, mechanic can take paid tool-repair work, not teleport a repaired vehicle from the POI.
- Field medic outside an infirmary: the normal Medical Crates remain in the LI chest pool at that site's access grade. One real patient can be treated with real Bandage; medic may remain or agree to join; no compulsory rescue flag for opening the medical room.
- Guard near a purple-card compound: all seven historical-model room chests remain authorized where physically possible. Guard may have their own motive, may provide information, may refuse. Helping them does not replace High Military crate or grant a rare Core. Their later defense uses actual weapon, senses, path and ammunition.

## 12. Reserved tuning / no additional creator questions needed

**LOCKED NOW:** living community A; voluntary optional recruitment, home in player-built base, genuine work/needs/defense, physical escort, actual item/input economy, offline causality, run-local reset, full chest preservation, no new map terrain mandate.
**MEASURE LATER:** encountered NPC density, unique count per run, bed-to-worker limits beyond one bed each, hunger/thirst per hour, work shifts, job-time adjustments, senses, guard retreat thresholds, escort speed/spacing, rescue time window, rarity per source, source refresh, whether resident rescue grants *any* score (default NO), optional wider personality/social arcs.
**NOT SCOPE V1:** city management or immigration waves, romance/marriage/children, NPC expeditions to unopened far-world POIs, unconstrained autonomous mining, AI freeform chat, fully simulated offscreen large-scale tactical combat, permanent cross-run companions, PvP human factions, extra maps/biomes, new resource IDs.

**Closure rule:** this contract is SPEC_LOCKED, not code acceptance. No agent may report a real resident economy, home guard, survival AI or offline functionality as implemented without exact code SHA, physical source custody proof, focused tests and native/human observation.
