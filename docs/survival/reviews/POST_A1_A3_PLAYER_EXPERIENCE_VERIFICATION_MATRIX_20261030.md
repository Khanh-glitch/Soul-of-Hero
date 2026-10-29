# SOH — Player-experience verification matrix after A1 / A3
**Control Tower | 2026-10-30 00:09 ICT | AUTHORITY: independent review protocol, not an agent dispatch, code approval, or scripted pass**.

**Companion source audit:** `docs/survival/reviews/POST_A1_A3_LAST_DAY_RULES_2019_2020_PRODUCT_RECONSTRUCTION_AUDIT_20261029.md` @ `0174f8fb940d01c35c32d8cdf2ce6e1e67f5580d`. Sources: original memory Google Docs tab02/03 (firsthand user experience and original direct quotations), immutable Atlas 2019–2020 source with `USER-JOURNEY01..12`, `DECISIONS.md` D021, D030, D033, D034, D043, `ACCEPTANCE.md`, A1 PR20 `df526cc`, A3 PR19 `18e7afc`. Engine test passes are **necessary but NOT sufficient**; false-positive prevention below applies to *every* scene and player cohort.

## 0 — Separation of evidence levels (mandatory)

`S0_ADMITTED_DESIGN`: source/user fit approved, no code.
`S1_PINNED_DATA`: authoring JSON and contracts pinned by SHA.
`S2_NATIVE_ISOLATED`: actual Godot 4.7 isolated tests run, no production Hero journey.
`S3_NATIVE_CONTINUOUS`: a single actual fresh-save production world executes entire loop via ordinary game input (automation allowed if explicitly labeled; no teleports, item grants, direct node invocation, manually advanced clock, graph reducer).
`S4_HUMAN_OBSERVED`: player independently discovers the options, can understand affordance/feedback and makes real choices; evidence includes observed friction and frustration, not just harness success.
`S5_LONG_HORIZON`: multi-session novice + optimizer evidence of distinct unfinished objectives, meaningful repeated expedition utility, and desire to continue/replay, without arbitrary time pad.

No stage may be inferred from the next; S2 tests do not graduate S3, automated input does not graduate S4; 14×45 minute modeled budget does not graduate S5. Source indexing `SOURCE_COVERAGE_TRACE.json` currently contains historic NOT_STARTED entries and must not be blindly used as current runtime evidence.

## B0 — first self-directed evening, two viable paths, no duplicate loot

**Sole owner:** A0 native integration; A1 PR20 rewards, A3 PR19 item authority; A6 owner read-only UX. **P0 stop gate** until item reward discrepancy resolved without changing paused A1/A3 source.

`B0-01 NEW SAVE`: start non-debug normal-game profile, note exact starting items/tool/HP. World cell and native visual frame recorded at 1280×720; user may choose (a) immediately build primitive shelter/storage or (b) approach safe roadside POI and return home later. Both must remain feasible; no forcing a single itinerary just to satisfy automation. Mark any material or time stipulation as a SOH design value, not original 2019 rule.

`B0-02 EARN`: input-driven Knight movement through actual collision from Refuge to a reachable real node; harvest scrap and oak and pick up outputs by real pointer/key. Negative: distant clicks (> actual interaction radius) must not harvest. Player slots/capacity, ordinary tool/resource source evidence, source provenance, held item before/after and last transaction ID recorded. No mocks/injected inventory or teleport.

`B0-03 LOCKER and LEDGER`: enter exact A1 Waystation footprint through its normal door with real movement; first `pry_locker` gives **cap_salvage + ZERO items**, ledger `cap_seal_1 + ZERO items`. No A3 provisional world-action reward hint (A3 old model gives 2 scrap+2 spares at locker). A6 hides undiscovered POI/rewards until relevant discovery. Reopen same action → ALREADY_APPLIED, no duplicate. Verify actual A0 `SaveService` receipts `a1slice:...` and live inventory/flags against physical scene.

`B0-04 RENEWABLE RESOURCES`: one `cache_restock` claim gives **3 iron_scrap and 2 knowledge_spares**, key `a1slice:poi_crown_waystation:cache_restock:{claim_index}`; next claim blocked until 1,800 **actual active** seconds. One deadfall `gather_deadfall` grants **2 oak_wood**, next after 300 active seconds. Pause/reload/offline elapsed must not progress these cooldowns for free. Use source A1 `df526cc` as canonical; A3 `211349c` older model uses cache 3+1 and treats locker as loot; reject its mismatch as a SOURCE-PIN ERROR, not “approved average”. Negative full bag/invalid item/missing cap/out-of-range/replay/malformed data → reject with no grants or consumed cooldown.

`B0-05 RELAY`: real Knight reaches Relay stand cell, uses hand crank, atomically debits **2 iron_scrap +1 oak_wood**, grants `cap_power_1` and state `bus_powered=true`. Cannot repeat for another capability/reward. `copper_upgrade` stays disabled until canonical catalog admission; east shortcut remains `cap_filter` gated, novice safe route remains open. A *power flag* is not proof an actual electric door/room circuit works; label the later gate separately.

`B0-06 HOME IS A MACHINE`: return to chosen shelter. Build a valid enclosed foundation+wall+door/roof and functional chest; pay materials, inventory moves, place/get back kit via normal GUI/build pointer; genuine station starts a job on an A0-owned fixed-step clock with actual A3 queue/escrow; pause and reload retain exact state/outputs. Native roof occlusion and collision, bed/respawn and opening UI must not leak world pointer/combat or trap the Hero. At minimum one working furnace/research/garden next-stage interaction must be separately proved before claiming the home is a *production system*, not just workbench fixture. Main Gate B0 is not passed if only a hand workbench is reached.

`B0-07 FAILURE PATH`: death during outbound trip, body bag retrieval through real input and return to storage; no item duplicate, permanent recipe survives, pending job resumes or remains paused according to real session rules. Crash tests are stronger when actual separate OS process-kill/restore is used; same-process simulated reload is explicitly lower evidence. Test an alternate route when safe corridor is blocked; no off-map direct teleport/teleport-only helper as replacement for navigation.

**Product signoff:** A0 source and CI evidence alone yields at most S3. S4 asks a player: “What will you do tomorrow and why?” The observed answer should name a consequence from their actions and a discovered opportunity, not repeat tutorial text.

## B1 — risk, deeper POI, a rare Core that changes available actions

`B1-01 POI`: one authored mid-tier **interactable native** location with a real room, credential/key not identical to power, independent hazard protection or alternate traversal, optional boss/non-boss approach, retrievable reward and safe retreat from failed attempt. First observation reveals an enticing but currently inaccessible option, then preparation changes the outcome on revisit. A1 authored 106 other `SITE_CONTRACT_ONLY` are not substitutes.

`B1-02 OPPORTUNITY COST`: expose one rare finite physical Core in a source-approved loot event, show different real outcomes for USE (actual A4 Gold full timeline/enemy+world effect and finite debit), STORE (retained specimen for another choice), SACRIFICE (sample permanently consumed; recipe knowledge persists; replacement requires recipe+real reagents+station). Block claim until A4 Gold exact lineage and native A3/A0 owner integration proven. No fake yellow particle stand-in or instant spell counter as proxy for complete VFX.

`B1-03 ECONOMIC CAUSALITY`: at least one previously stored low-value item becomes an input to a newly unlocked real recipe that competes with another useful production sink; UI lets player look up where to obtain it and the recipe owner, without spoiling unvisited site. Record item source, storage, changed recipe demand, output actually used on next expedition. Fail if recipe is a detached collection badge with no changed player ability/route/production value.

`B1-04 RETURN-RISK`: compare a novice and a prepared second trip on the SAME dangerous route. Capture survival cost, consumed gear/food/medicine, toolkit durability, travel duration, net resources, death recovery, capacity and high-value items abandoned to make room. A 2.5D fantasy aesthetic alone cannot substitute causal risk.

## B2 — long-form and non-dungeon life

**Only after B0/B1 native product gates:** novice, informed optimizer, and if possible a returning player, run 1h, 3h, 10h and multiple extended sessions. Record native telemetry, not fabricated `14×45` activities:
- first shelter, meaningful station, storage improvement, first failure/retreat, first POI clue and later revisit, first genuine Gold Core cast/sacrifice, first deep room unlocked, first route/resource upgrade;
- per-journey `V = resource rewards - consumables - repair - route burden - expected lost goods` with non-monetary learning/route/recipe value separately (not invented universal prices);
- `T_route` roundtrip before and after outpost/cart whenever those actually exist; an outpost with negative saved time and no other advantage is decorative;
- direct observed player confusion, readability at 720p and 2K/4K, possible meaningless travel, queue waiting with no decision, hazards unreadable or Core effects not worth charge;
- at end of extended play each player must independently explain **at least three credible, valuable future objectives across >=2 systems**, one still-interesting unopened POI/Core family, and a rational alternative play/replay route. Goals blocked by non-catalogged items with no playable source **do not count**.
- Three consecutive sessions of meaningful home/economy/exploration progress without entering a Chapter-1 dungeon; then one dungeon excursion improved by the earlier preparation. This avoids the false “all content funnel to dungeon XP” pattern.
- Keeping home/world permanent is correct; a *separate optional* expedition/reset season is allowed, never forced wipe of player's main home. Compare one alternate strategy rather than force a 15-day timer.

## 12-Journey status to use as initial scorecard, not final ratings

| Atlas J | Earliest actual evidence (A1/A3 / A0 contextual) | Current level / product decision |
| --- | --- | --- |
| 01 first home | A3 resource/cost/time model, A0 functional components; fresh-input gather only | S2 to partial S3; **NOT continuous** |
| 02 Core USE/STORAGE/SACRIFICE | A3 finite token/recipe/escrow fixture, A4 Gold outside this review | S2; EXPERIENCE HOLD |
| 03 card+power multistage vault | A1 Waystation/Relay caps/power flag | S1–S2 contract; no deep room |
| 04 hazard retreat and preparation | A1 risk route/cap-filter and A3 mitigation proposal | S1; no native counterfactual |
| 05 home refit + throughput | A0 physical paid stations and host fixture | S2, first input-driven placement currently FAIL at prior run |
| 06 outpost and route economics | authored A1 routes, A3 estimates | S1 model |
| 07 net expedition gains | formula and simulated time | S1, no sourced native telemetry |
| 08 stored-junk value shift | recipe/candidate catalog | S1/S2 logic, no player consequence |
| 09 optional AI base defense | optional design, pathfinding pending | S0/S1 |
| 10 group recipe licensing | solo optional, not critical | NOT_REQUIRED_SOLO |
| 11 Boss key+sample independent utility | A3 provisional specimen, A1 deep site contracts | S1, no native encounter |
| 12 long optional goals | A1 site contracts, five A3 prospective goals | S1 only; human longevity NOT PASSED |

## Existing A0 fresh-input CI truthful boundary, 2026-10-30 00:09 ICT

- A0 PR21 is actively advancing, at last Git `394d1ca2cb33805c2bc6b69ca670ce4666a69340`. Native [40914953517](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40914953517) `b797b9` PASS 11 ordinary-input checks through fresh spawn movement, scrap and oak, real GUI craft start and 8-second active wait, reload; no grants or teleport, but **no bench collection or placement at that SHA**.
- [40915975159](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40915975159) `8b5b3a4` FAIL 2/17 normal-input assertions: placement and durable-reload; independent station placement fixture PASSED 32, A0+A3 session PASSED 83, and source identity tests passed separately. *Continuous gameplay cannot borrow isolated fixture PASS*.
- [40916909329](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40916909329) `16ca551` FAIL same 2/17. Diagnostic `NORMAL_BUILD_TRACE` shows full-screen `ClickBlocker` hovered, cursor viewport inconsistent with planned world target and build preview (49,203) vs target (50,201); kit remains in inventory (kit=1). This is an **observed input routing/viewport bug**, not claim of placed workbench.
- A0 commit `394d1ca` changes `chapter1_overworld.gd` and `survival_build_system.gd` to explicitly tolerate build's own ClickBlocker while retaining GUI guards for other controls; test uses `Input.warp_mouse` so polled cursor is aligned with injected click. [40918666020](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40918666020) newest native CI was QUEUED when checked, **NOT GREEN CLAIMED**. Must check this run at exact SHA and a separate negative test: other GUI panels MUST NOT place world structures; blocker should block world combat, build should be intentional only. Do not waive old +45% performance gate from unrelated passes/failures. Distinguish automated normal input from human interaction.
- A0 old current worklog did not yet include this newest failure; inspect live Git/CI before any downstream prompt. A6 UI and A4 Gold remain dependent on owner-proven quality. A1/A3 are paused per user; no restart automatically from this protocol.

## Gate result and owner routing policy

`B0_NOT_PASSED`, `B1_BLOCKED_DEPENDENT`, `B2_NOT_TESTABLE_YET`. **No merge.** A0 is primary developer for physical native chain, A1 remains paused to fix only proven authored route/source geometry; A3 remains paused for proven material/reward source conflict once owner-approved; A6 currently working on read-only game UI; A4 Gold source faithful work independently. S6 optional premium POI; prototype issue23 R&D only. Only send a bounded patch to existing A0 when user authorizes active work, not a new phantom seventh worker. Coordinator verifies source and CI at exact SHAs; no CI success alone clears player-value gates.


## 2026-10-30 UPDATED CI EVIDENCE — native fresh-input paid bench placement FIX CONFIRMED (limited)

A0 PR21 source `394d1ca2cb33805c2bc6b69ca670ce4666a69340` passed exact [Survival A0 native run 40918666020](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40918666020), native job `123606293750`. The earlier two failures at `8b5b3a4`/ `16ca551` are now fixed in the tested path. Native log: `SURVIVAL NORMAL INPUT GATHER PASSED - 17 checks`; assertions include fresh-spawn normal movement to scrap and oak, ordinary world pointer harvest, real C craft UI and active-time queue, mouse-wheel selection, ordinary GUI collect, paid workbench placement and same-profile reload. The positive trace records planned target `(50,201)`, actual preview `(50,201)`, input kit count after placement 0; earlier failure had hovered `ClickBlocker` and preview `(49,203)`. Fix at `394d1ca` specifically authorizes build's own full-screen ClickBlocker to be ignored by *build-place* input while warping the real test cursor to calculated screen point. Isolated economic session remains 83 checks, other native station 32 and authority 124 in same run. This is **S3_PARTIAL_FRESH_INPUT_PRODUCTION_SEGMENT_ACCEPTED** only, no fixture inventory grants/teleport for that segment and no human player trial.

**Remaining adjacent negatives:** clicking outside/build tool while unrelated modal visible must not place; actual resource leaks logged on engine shutdown (`ERROR: 2 resources still in use`, 4 ObjectDB instances leaked) even though test reported success; native log needs dedicated leak lifecycle triage. Actual world A1 reward-source contracts and the old A3 simulation drift are untouched, no production POI mount. Not one enclosed shelter/bed and death→bag recovery, world Gold, A6 live modal or human signoff. Thus `B0_NOT_PASSED` remains and the A1/A3 pause is unchanged. A0 docs-only HEAD now `b06f60e6340723e53cc68195e7632aa25c43f750`; do not attribute any new functional test to that docs commit without evidence. Overworld/general CI may be pending or retain original-main baseline failure; no all-CI-green claim. Full acceptance waits for real source reward and multi-loop behaviors.
