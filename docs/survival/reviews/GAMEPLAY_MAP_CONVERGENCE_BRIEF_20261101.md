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


## GP0 — first executable gameplay-status baseline (2026-11-01; owner-verified evidence, NOT full E2)

**Execution record:** Read current product contract, D051–D074, current CT-GATE and acceptance, current inter-lead brief and `SOURCE_COVERAGE_TRACE.json` (the complete Atlas 1,355-line index). The historical trace has 108 entries: **44 SYS, 21 POI, 31 DEP, 12 JOURNEY**. Its existing `implementation: NOT_STARTED` fields are 2026-10-29 source-research snapshots, **not today's factual implementation verdict**. Neither those fields nor 118 A1 POI anchors can be used as an owner code audit. This status baseline is deliberately ***scoped***; individual 108 entries still need source/CI/normal-input mapping, not fake per-entry PASS/FAIL.

**Live branch snapshot verified this review:** PR21 A0 `04eacf62f1a3740a57e08691c3a9006d454aaa2c` draft; PR20 A1 `ce9d4ba2d3db153011874aa41b789fa8092be042`; PR19 A3 **still predecessor** `b751a29f213d3c934caa204eb8d2d86943f07b65`; separate A3 takeover `57577d0dff1a3e1ed7216d8cb538229a3cf305b1` owner-native CI `41242212204` green (3 jobs, 190 R13 checks); PR26 A8 `71e68f9c0b7844277139a489c316acea327699f9`; PR25 A7 `91ffe3ea833f202ae53468bc32fd803213ab46fa` paused; PR30 AVFX `e505173edd119fdd955cf6249511b575a5468440`. A0 old Factory 2PID `41269852926` native successful at code `e1e5d778` with historical A3 pin `b44e22df`, but captured entry ALL BLACK at 720/1440/2160 and return black at 720 despite compressed-file-size check; home/prepare show old Knight/legacy world. This cannot count as current product P1/P3/P7.

### P1–P8 source/owner/product separation

| Promise | Demonstrated in owner or historical composed CI | Not proven as one playable production experience | Consumer and owner |
|---|---|---|---|
| **P1 — Thế giới sống** | A1 map/chunk & A0 authored-continent route were native tested on separate composition; factory work used old-world legacy scene | **SAME composed world + latest A3, selected D051, physically sourced routes, playable random safe spawn and visual 1× NOT ACCEPTED** | A0+A1; Map W0→W2 |
| **P2 — Nhà đáng về** | A0 build/station/paid factory 2PID old owner pin verified; 1× home shows legacy Knight and old world | **Arbitrary home siting, 1-story room/roof/door/bed/chest/farm/defense and multiple spontaneous player choices NOT ACCEPTED** | A0; A1 legal build mask; A7 |
| **P3 — Khai thác / nghề / tri thức** | A3 takeover owner-native 190/190 2PID at 57577d0d; bounded random Spares/targeted/specimen; A0 factory old A3 pin can settle once | **29-file A3 adoption and 13-field A1 live source host on ONE Godot composed run, material value discovery, A6 collect NOT ACCEPTED** | A0 consumer, A1 host, A3 paused unless real integration defect, A6 |
| **P4 — Nguy hiểm công bằng / cứu đồ** | Contracts and owner-level survival/bed/respawn code/test exist; normal player causal loop not presented in reviewed same composed run | **Real overworld enemy and exposure, chosen preparation/retreat, natural death→bed→same physical bag and unexpired footprint-based threat NOT ACCEPTED** | A0+A1+A7; no Map XY locked |
| **P5 — POI sâu / quay lại** | A8 Quarry+Orchard isolated native physical/input fixtures passed; A0 authored walking route separately passed, A3 payout deliberately refused | **Source-authenticated rewards, key/power/hazard genuine prep, durable POI instance and revisits in latest A0/A3 composed tree NOT ACCEPTED** | A8 scene, A1 actual doorway/source, A3 reward, A0 mount |
| **P6 — Core và Gold** | Original Gold source and AVFX workstreams exist; no reviewed same-composed, source-genuine 1× full-cast proof for P6 | **Rare finite charged item from legitimate source, USE/KEEP/RESEARCH tradeoff, 93 skills authentic enemy/world effects in native production NOT ACCEPTED** | AVFX+A0+A3+A7 |
| **P7 — Nhân vật + UI** | A6 19 real GUI pointer tests at three resolutions with FakeHost; old A0 connected Factory frames shown UI but still Knight | **D051 true single selected male/female avatar in native world/combat, Vietnamese HUD/story/no debug; fix black entry/return captures; normal player affordances NOT ACCEPTED** | A6+A0; Map visual grammar dependent |
| **P8 — Nhiều phiên, khát vọng, reset** | A0 old factory 2PID worked 62+20 checks offline; A3 current own 2PID; locked 336h clock/last72 and run-local wipe documented | **Actual ordinary exploration aspirations, offline farming/homecoming, safe death and bank→evac→reset across 336h, 3 goals in 2 systems, human E2 NOT ACCEPTED** | A0+A1+A3+A6+A8+AVFX+A7 |

**No independent human enjoyment or full E2 claim** from any of the above. No numerical "completion percentage": stacked passes from different SHA trees are not additive. The native screenshots black are an actual visual gate FAIL, not NOT_TESTED. Source handles and all player rewards must fail closed where host unavailable.

### Twelve original journeys — current solo-product adaptation and next required gate

| Source journey (historical Atlas) | Current SOH gameplay admission target (NOT implementation claim) |
|---|---|
| `JOURNEY-01` Buổi đầu tay trắng | B0: quiet knife, random safe spawn, acquire life necessities; source/native route partial, same player run not accepted |
| `JOURNEY-02` Thùng đồ và bất ngờ về tri thức | B0→B1: roadside salvage->Spares->unpredictable valuable research/Core opportunity; A3 owner proof only |
| `JOURNEY-03` Mở phòng xanh lá đầu tiên | B0: first lawful staged POI entry and partial loot; A8 isolated physical fixtures, payout closed |
| `JOURNEY-04` Lần thử thất bại tại vùng độc | B0: forewarned hazardous area, underprepared retreat/prepare, alternate route; no current composed proof |
| `JOURNEY-05` Thiết kế lại căn nhà theo vòng sản xuất | B0: real room+station layout changes paid work/homecoming; A0 old factory 2PID partial |
| `JOURNEY-06` Chuyến đi xa có tiền đồn | B0→B2: cargo cart + outpost alters net long-haul return, needs Map W1/W2; not accepted |
| `JOURNEY-07` Một chuyến loot lời nhưng không hiệu quả | B0→B2: measure expedition net value versus travel/tools/risk, not rewards alone; no composed proof |
| `JOURNEY-08` Công thức đồ mới làm thay đổi giá trị kho cũ | B0→B1: learned recipe revalues held scrap; A3 owner learning verified, user-facing revaluation not proven |
| `JOURNEY-09` Bảo vệ căn cứ khỏi một đợt tấn công có báo trước | B1→B2: fair warned trace-only home threat, walls/breach/repair; no current composed proof |
| `JOURNEY-10` Hệ công thức chia sẻ không đồng nghĩa công thức cá nhân | Historical social/team recipe sharing SUPERSEDED for solo game; adapt to run-local knowledge ownership and no leak on reset; not literal multiplayer requirement |
| `JOURNEY-11` Boss cho loot hơn một chức năng | B1→E2: true boss reward tradeoff and Core identity, no mandatory boss for normal advancement; unverified |
| `JOURNEY-12` Giai đoạn cuối nhiều phương án chơi | E2: optional multi-path final72 money/bank/evac and six-stone capstone vs UTC reset; locked design only |

**The other 96 Atlas anchors are not silently dropped:** 44 SYS, 21 POI *archetypes*, 31 DEP remain indexed verbatim in `docs/survival/SOURCE_COVERAGE_TRACE.json`; owner-level audit must attach a live exact-SHA file/test citation and current `CURRENT_PRODUCT_CONTRACT.md` adaptation for each candidate. Specifically `SYS-28 Operation Base persists forever`, `DEP-24 meta recipe after reset`, and social/PvP/land-grab anchors cannot be imported literally: D062–D074 require solo PvE with run-local house/knowledge wiping; historical source provenance retained for traceability. Priority cross-system adaptation anchors: `DEP-01/02/03/04/05/07/10/11/15/16/18/19/23/29/31`, not simply add more content.

### Which Gameplay work actually starts NOW while Map Lead designs geography

**GP0 immediate work package (this document is its first audited result, not a completion certificate):** enumerate direct owner source, real product consumer, saved authority, false or missing oracle for P1–P8 and all 12 adapted journeys; classify remaining 96 Atlas source anchors as candidate behavior/adaptation/superseded, attach exact current CI where available. Exit condition: one actionable gameplay backlog where every task has *actual player action→price/risk→persisted result→next choice*, owner and evidence. Avoid inventing a second source-of-truth document for game design.

**GP1 now, no Map wait:** turn 47 test behaviors of `soul-of-heroes-DEPLOY-FIXED.zip` into strictly **reference tests**, not TS port: (a) free-form single-storey home/roof/door/egress/chest/repair, (b) cart capacity/physical obstacle/return, (c) external POI benefit then key/power/hazard deep return, (d) readable inventory, same physical unique Core, fair death bag and one-time collect. Inspect Godot owner implementation before adding anything. **Never** import its 96×96 procedural map, localStorage save, tab-paused game time, free camp Fire Core, copied sprites or raid-that-always-knows-home.

**GP2 now at data/contract level:** source/sink knowledge graph and measurable `ExpeditionSummary` e.g. useful materials, new capability, tool/charge/fuel cost, time/route, death risk, next 2 independent goals; A3 genuine source/cost ID, A0 durable physical item ledger. Do not decide biome resource XY/hydro/crossing quantity for Map. Provide Map Lead requirements for early resources, 3 arbitrary build sites, at least 2 physical POI approach/return opportunities and alternate cart/foot routes with actual measured travel economics.

**GP3 production integration MUST precede new gameplay bloat:** update old PR19 ref by **authorized non-force fast-forward** to green A3 takeover, then A0 integrate exact 29-file A3 contract + live A1 13-field host + A8 POI scene + A6 actual LẤY + D051 player; fix all-black image false-pass by decoded pixel validation, input Event reuse and old merged controller drift; pass one exact native Godot composed SHA with ordinary source→paid craft→quit→new OS→collect once plus authored walk, two-site physical entry/retreat/revisit, genuine hazard→death/bed/same-bag, home-first and explore-first choices. A7 certifies only exact new composed tree, and creator vetoes unacceptable art. **This is B0 internal**, never first full creator E2 playtest.

**GP4 after B0, already protected by canon:** full charged rare Core/Gold, weather/farm/forge/research/home return, trace-only hostile physical footprints, cargo and layered POI variety, 336h real UTC run and last72 source-only physical Ragnarok chest→bag/cart→fixed bank→optional evacuation (no required bosses), six true source-correct Elder stones/capstone, wipe run-local state and retain only deposits+achievements/history. No duplicate currency, lifetime permanent house or forced tedious cooldowns.

### Cross-team boundary / next acknowledgment

Map Lead is currently authoring W0 **independently**, no final terrain approved: Gameplay must **not** wait to do GP0/GP1/GP2/GP3 old code seams, and **not** preempt W0 coastline/height/XY. First meaningful Map input needed at W1: physically viable random spawn/buildable samples and authenticated reachable source/route logistics. At W2: cart/foot crossings, site entrance/stand/retreat geometry and endgame no-boss bank→evac routes. Receive candidates with **PROPOSED vs NATIVE_VERIFIED** statuses, return player choice/value/refusal/return acceptance; do not invent POI counts. Current World V3 physical geography was explicitly rejected; paper A/B/C do not silently become canon.

**Decision:** current next Gameplay action is ACTUAL GP0/GP1 code-to-behavior audit and A0 integration custody coordination; NOT a new extra agent, not another 3-site scenery project, not ask creator for unnecessary map decisions. No Arena dispatched/ACK and no merge/ref mutation by this write.
