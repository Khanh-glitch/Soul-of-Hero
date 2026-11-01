# SOH — Gameplay × Map convergence brief R0 (2026-11-01)

> STATUS: **CONTROL-TOWER WORKING BRIEF / NOT NEW PRODUCT CANON / NOT OWNER DISPATCH.**
> The source of truth remains `docs/survival/CURRENT_PRODUCT_CONTRACT.md`, non-superseded `DECISIONS.md` D051–D074, `docs/survival/ACCEPTANCE.md`, `INDEPENDENT_DEEP_REVIEW_PROTOCOL.md`. Later direct creator decisions take precedence. `SOH_WORLD_FORMATION_BIBLE_V1_20261101.md` documents WORLD V3 **VETOED** as physical geography; W0→W1→W2 A/B/C lab is **paper-only** (A best candidate for deeper test, NOT approved). This brief defines cross-team proof requirements, not coastlines, XY, actor rules, drops or artistic selections.

## Mandate

**Gameplay Lead (one objective):** turn the promised 336-hour, quiet-melee-first, solo Last-Island-style SOH from fragmented owner modules into a causally connected, freely explorable Godot game with rich self-directed choices, persistent consequences and verified first-hour / multi-session / final72 / reset loops. Do not confuse owner green CI with game acceptance. Use `soul-of-heroes-DEPLOY-FIXED.zip` only as behavioral test reference (free-form room/door/path, cart, multi-stage POI, inventory/UI), never port its 96x96 TypeScript world, localStorage, pausing clock, free starter Core or synthetic sprites into the authoritative Godot game.

**Map Lead:** one accountable owner of physical terrain/watershed/biomes, historical plausible place/route geography, natural buildable/spawn/cargo traversability and coherent visual grammar; do not create a second A3 loot authority or invent recipe/drop prices/336h settlement.

**Critical convergence is W1 (survival opportunity surfaces) and W2 (physical route + multistage facility footprints) BEFORE map art finalization, then B0 SAME-SHA Godot native gameplay.** W0 terrain first is Map-led, Gameplay has veto against broken human agency/causal logistics; W1–W2 mutual review; A1 implements geography, A8 POI scene mechanics, A0 GameRoot/SaveService, A3 source/research/economy, A6 HUD, AVFX Gold, A7 independent certification. Neither Lead arbitrarily edits another owner's source.

## Shared product invariants — no premature coordinate quotas

1. **Free opening:** random geographically distributed safe spawn, knife/basic melee viable; useful low-risk food, water, wood/stone/roadside salvage without Core, mandatory quest, paid NPC or boss. Player can choose explore-first, home-first and scavenge-first. Safe means actually walkable, climate survivable and not softlocked by water/hazard/enemy. A first-session route need not be the same three named POIs for all players.
2. **Buildable real home:** three arbitrarily selected reasonable buildable spots must be possible with different benefits and liabilities; true ground collision, roof, door/egress, bed, chest, furnace, garden, station, repeatable return, same-run persistence. Base is not a map icon or mandatory center. Prototype's door/room/no-trapped-player tests are reference invariants only.
3. **Source economics:** every early resource node or roadside cache has stable `source_id`, physically legal stand/reach/collision, material kind, bounded claim/cooldown/replenishment, hazard and an A1 host attestation consumable by A3's `soh.economy.source_receipt.v1` 13-field contract. The visual prop is NOT evidence of collectible loot. Never spawn rare Core or special Ragnarok currency from a merely decorative source.
4. **Routes/cargo:** terrain grade, fords/bridges/ferry, foot-only passage and cart-passable old roads matter; at least one real faster/riskier vs slower/safer trip; cargo volume, stamina/condition, weather, retreat and return are measurable. No invented bridges in a PNG or teleport-as-route. The exact road network and crossing count remain Map decisions.
5. **POI loops:** at least two distinct non-boss deep sites (first composed examples can be Quarry + Orchard, but entire world must support non-central safe starts) with lawful exterior salvage, visible blocked paths, unique key/power/hazard/resistance or repair gate, prepared re-entry, optional path, legitimate one-time or cooldown reward, saved real visit state and natural world-entry/exit. A8 alone does not mint A3 stock/Skill Core. Other existing facility roles hydro, archive, customs are future meaningful depth candidates, NOT new fixed POI quota.
6. **Threat/home:** cold, heat, marsh slowdown, exposure, rain/night perception etc must provide visible forewarning and behavioral counterplay; real death bag/bed/recovery; ordinary monsters detect unexpired physical PLAYER footprints, NOT omniscient home coordinates; offline home/shelter damage bounded and repairable.
7. **Endgame topology:** 336h real UTC with offline continuation; days12–14 72h Ragnarok, six source-correct Elder manifestations and unique stones, but NO-BOSS evacuation and physical last72 chest→bag/cart→fixed secure deposit→continue or optional physical evac also viable. Bank/vendor/recycler and evac have real approached entrances/stands/routes, and no arbitrary global money minting. Run closure wipes run home/knowledge/items/Cores, preserves only achievements/history/secured deposited currency. Map must support alternate legitimate bank/evac risk, not necessarily six symmetric Elders sectors.
8. **Visual meaning:** true Godot 4.7 640×360 logical 1× framing with actual selected D051 Adventurer, source-backed pixel kit, readable land versus water and dynamic shelter/POI/loot state, day/night/hazard, no debug labels, no Pillow screenshot-as-production evidence. Gold telegraphs must fit camera/arena, not shrink original timeline by convenience.

## Three integration interfaces — not new serialization schemas

**I. WorldSpatial (Map/A1 → A0/Godot):** stable cell/chunk/world identity; walkable/buildable/shelter/roof/terrain/hazard/visibility; grade/slope/water/flood boundary; route foot/cart/boat semantics; spawn candidates and nearest safe retreat; biome/weather season; time/distance/travel friction; landmarks and POI exterior/door/instance coordinates; native collision and occlusion. Keep existing A1 contract; extend versioned only when there is a demonstrated consumer gap. Never allow "source map metadata says pass" to replace actual controller input.

**II. Source/POI evidence (A1/A8 → A3 via A0):** `source_id/instance_id/action_id/world_cell/physical stand/actor/tool/run/time/nonce`, current binding + owner live host validation, bounded stock/cooldown/entitlement, partial/perimeter access, key/power/hazard state. Reuse **existing A3 13-field receipt and A0 SaveService**, not a second bank/inventory. A8 owns physical gate, A3 pays rewards. Map Lead decides viable footprints and routes; Gameplay Lead determines meaningful economic access/risk and anti-farming acceptance.

**III. PlayerJourney evidence (all owners → A7):** one *composed* SHA and reproducible Godot scene log + input trace + two separate OS process receipts + native screenshots at 720/1440/2160 with decoded-black/variance verification, source provenance, actor D051, direct observation of actual player choice. Record action→cost→persistent effect→next goal and carry over false/blocked gates honestly.

## First common deliverable (not merely Waystation–Quarry–Orchard art)

A **single playable, representative first-hour region-network slice** drawn from a candidate physical map that has passed geographic review. It contains multiple geographically separated safe starts (validate four diverse candidates as samples, never force those four as canonical), different home-place options (validate at least three arbitrary reasonable choices), ordinary scavenging, a usable old-road vs offroad/foot/cart contrast, at least two non-boss POI approaches with genuine exterior payoff/blocked deeper route, a defensible retreat, one bed+death-bag recovery and one source-authenticated funded A3 station queue that survives close/relaunch and collects exactly once. The slice need not implement the entire 336h Ragnarok before B0, but must not contradict or softlock those future routes.

**Each journey is ordinary player input on the SAME Godot composed SHA**: 
- **J-A quiet knife/home-first:** random safe spawn→low-risk wood/stone/food→choose/build and leave a physical room→bed/chest/egress→roadside salvage→pay workshop→close→reopen→finished funded output→new reachable choice.
- **J-B explore-first:** another separated safe spawn→road salvage and clue→find physical perimeter POI→approach blocked power/key/hazard gate→partial benefit and genuine retreat→research/preparation→return later with durable state.
- **J-C risk counterfactual:** same intended objective by faster/high-exposure walk vs slower/safer road/cart with measured condition/time/volume and real consequences; includes underprepared refusal and same-bag recovery after genuine death (not scripted `kill()`).
- **Long-term trace (paper and later Godot):** home/farm/forge research payoff after downtime; rare charged Skill Core USE/KEEP/RESEARCH not automatically given; late72 physical rare chest→cargo/bag→fixed bank→evac with six Elder optional path; UTC reset and new-run semantic wipe.

For each named scenario record from both leads: player's actual choice, exact source and prerequisites, cost/route length/obstacles, what can fail, what is earned/learned, how it is preserved, and the next two credible optional goals. If no meaningful alternate action, fail the design before generating filler assets.

## Deliverables by Lead, in order

**Gameplay Lead:**
- GP0 **Depth-to-runtime matrix** covering P1–P8 and 44 SYS / 21 POI / 31 DEP / 12 journeys: `concept_locked / source_present / native_owner_pass / composed_usable / experience_accepted / blocker / next owner`. Keep source/proof exact; no false "done".
- GP1 **Prototype behavioral port decision**: track 47 original tests to Godot analogs, prioritize room/egress/storage/repair, cart physical capacity/path, layered POI economic choices and item feedback, discard duplicate world/save/clock/Core.
- GP2 **Economy/agency graph**: early source→meaningful sinks→knowledge→travel permission→home productivity→later risk and reward. Coordinate A3 with Map source ecology; no arbitrary rebalancing before real route-cost data.
- GP3 **Composed B0 acceptance**: A0 fix black screenshot oracle, authorized PR19 fast-forward and latest A3 29-file adoption, real A1 receipt host, A8 physical doors, A6 truthful UI, D051 real; one exact SHA and A7 native+visual+systemic certification. Owner CI alone insufficient.
- GP4 **B1/B2/E2 backlog**: threats/weather/death and offline/homecoming, Core+full Gold and research, cargo+deep POI choices, 72h/currency/bank/evac/six Elder, whole 336h reset; include counterfactual human enjoyment gates.

**Map Lead:**
- MP0 **W0** source elevation, watersheds/lakes/tributaries, ecological variation, natural shores, physical cliffs/water and candidate build/spawn areas with no misleading illustrative XY presented as physics.
- MP1 **W1** publish *physical opportunity mask + scarcity hypotheses*: walk/build candidate samples geographically dispersed, source proximity and travel friction, climate warnings, animal trace ecology; co-audit with Gameplay and only pass A3 real source IDs once authorized.
- MP2 **W2** publish real route graph with cart/foot and bridge-width/grade/return-cost probes; POI exterior/door footprints and source stands; at least one no-boss bank/evac path reserving later mechanics without fabricating currency.
- MP3 **Source-art native readability** using selected authorized assets/actual D051 on one representative native Godot slice, day/night/marsh/forest/snow/ash and meaningful POI visual states, with human visual veto. Do not freeze 11 regions or 192 chunks art as canon before W0/W1/W2 validated.

## Preconditions and independent acceptance

**Can act NOW:** the canonical gameplay contract, Godot owner source and CI, A3 owner-native 190/190 pass on `57577d0d`, A8 native two POI fixture, old A0 factory2PID source evidence, and prototype 47 behavior tests exist. Map A/B/C W0–W2 paper lab can be audited but NONE is creator-approved geography or native scene.

**Must NOT wait for:** complete art of 192 chunks, all six boss scenes, or full E2 to design/implement B0 scaffolding.

**Must be actually ready BEFORE same-composition gameplay PASS:** A0 player authored-world native mount, no black screenshots, A1 physically validated source+route/bridge+random safe spawn, A3 latest 29-file code adopted (PR19 old b751 still not updated at prior snapshot), A6 truthful UI and actual D051, A8 two physical POI entrances, one durable SaveService and 2PID restart, A7 independent check. Never mix separate owner's CI into a fake product pass.

**CT decisions by scope:** B0 passage requires real authored controller input, two-POI travel, free-build home, funded source economy, fair threat/death/bag, restart, **home-first and explore-first** alternatives and one underprepared counterfactual. B1 adds full Gold / novel Core/higher POI. B2 full multi-session alternatives and 3 independent next goals across >=2 systems. E2 only first full creator human playtest after six Elders, physical final72 currency, fixed banks, legitimate evacuation, full reset. A failing or visually unattractive pilot cannot be promoted by static quotas.

## Immediate inter-lead exchange

Gameplay Lead asks Map Lead for ONE work-in-progress `W0/W1/W2` **source+graph bundle** (not a finished scenery render) containing:
1. physical elevation, coast and catchment proposal with four geographically distributed sample safe spawn tests and three candidate home sites;
2. bounded early source/road/foot/cart geography, risks and route costs;
3. two physically staged non-boss POI outside-to-interior approach/exit paths, including clue/key/power/hazard;
4. at least one optional last72 physical rare-chest→fixed-bank→evac route avoiding mandatory boss kills;
5. honest proposed vs verified flags and pointers to actual Godot scene artifacts where available.

Gameplay Lead returns a **mechanical scenario acceptance sheet** mapping each of the above to playable legal acquisition, economic opportunity cost, preparation/retreat/revisit/death, one SaveService receipt, and no-boss/optional Core endgame. Need creator decision ONLY where geography and gameplay goals produce a truly unresolved tradeoff. No artificial exact XY or new POI quota.

No Arena task was dispatched, no new owner appointed, no source edit/merge or approval of any V3 or A/B/C map is implied by this brief.
