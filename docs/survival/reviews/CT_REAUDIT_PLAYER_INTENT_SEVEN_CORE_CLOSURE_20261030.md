# SOH — Re-audit player intent and closure of seven core design dossiers
Date: 2026-10-30 | Scope: POST-Last-Island 2019–2020 pivot, newer user corrections prevail
Status: DESIGN RECONCILIATION / CLOSED_BY_PRIOR_USER or CLOSED_BY_DERIVATION, NOT CODE IMPLEMENTATION, NOT NEW USER VOTE

## 0. Method and authority
This ledger stops re-asking product questions answered by the creator. Priority: (1) direct user statements, including later corrections in the ongoing design conversation, (2) dated LOCKED_USER entries in `docs/survival/DECISIONS.md`, adjusted only by newer direct user directions, (3) original Google Docs user testimony and `CT_USER_DESIGN_REVIEW_ROUND1`, `CT_FINAL_FEATURE_BOARD`, (4) 1,355-line Atlas for historically situated system dependencies, (5) developer/CT hypotheses, which are never elevated into USER_LOCKED based on assistant repetition. The historical Google Docs transcript is mostly assistant-authored and incomplete; do not confuse it with verbatim votes.

Primary inputs:
- Google Doc `Soul of heroes`, tabs 1, 2, 03, 04, 12; https://docs.google.com/document/d/1q8Vevy4qx_6AFyfJodmsWAhdSBBumtx31hxXnWPelqo/edit
- `docs/survival/DECISIONS.md` D001–D061, especially D021, D055–D061
- `docs/survival/reviews/CT_USER_DESIGN_REVIEW_ROUND1_20261030_DUNGEONS_ROOF_REPLAY_MONSTERS_RESET.md`
- `docs/survival/reviews/CT_FINAL_FEATURE_BOARD_V01_USER_TASTE_DECISIONS_20261030.md`
- `docs/survival/reviews/POST_LAST_ISLAND_2019_2020_PIVOT_IDEA_RECONSTRUCTION_20261030.md`
- `docs/survival/reviews/CT_FIRST_CORE_DISCOVERY_AND_LOOT_SOURCE_GATE_20261030.md`
- `docs/survival/reviews/CT_OFFLINE_RETURN_JOY_WORLD_TIME_ECOLOGY_WEATHER_V01_20261030.md`
- `docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md` (44 SYS / 21 POI / 31 DEP / 12 JOURNEY)
- `docs/survival/ACCEPTANCE.md` and `CT_FIRST_FULL_EXPERIENCE_RELEASE_STRATEGY_AND_A8_ROLE_20261030.md`
- More recent live user choices in this conversation: last 3 days Ragnarok; 6 awakened elder bosses and stones; loot-only physical cross-season currency during Ragnarok; repeated custody-safe deposits; fixed vending/recycling machines; evacuation outcome distinct from bank deposit; manual leave/restart any time; 14-day max, not mandatory session commitment.

Taxonomy:
- **U** = CLOSED_BY_PRIOR_USER: explicit direction, no more product polling.
- **G** = CLOSED_BY_DERIVATION: constrained default from U, admissible as an evidence-based design gate, MUST be labeled as inference rather than a new user quote; reversible on counterexample.
- **T** = IMPLEMENTATION_TUNING: not an unresolved product decision and no user vote needed; require measured native tests.
- **H** = HIGH-IMPACT DESIGN AUTHORED NEXT: a concrete integrated scenario/data contract must be authored and internally reviewed, not another open-ended taste question.
- **Q** = GENUINE HUMAN CHOICE: competing product consequences that cannot be safely deduced. Ask only after developing a preferred complete option.

## 1. Seven dossiers — closure status
### Dossier 01: Run life cycle / world reset
**Core rule CLOSED (U+G):** a run has a maximum 336 REAL UTC hours incl offline (D055), but the player may voluntarily discard/end a run and begin a fresh randomized run earlier. Closing the application is NOT manual reset; ordinary death and bed respawn are NOT season-end; depositing currency is NOT season-end. World, rooms, items, learned run-local recipes, Core, quests, site receipts and fog reset (D056, D057); profile retains global achievements, immutable completed-run history and NOW the separately secured cross-season currency balance (explicit newer supersession of D056, must publish). Voluntary abandon does NOT auto-grant evacuation victory, six-stone feat or value for unbanked stash. Run closure must settle durable receipts once before deletion; no physical currency auto-valued from chest. Old no-wipe X-23/D028 and separate persistent-base expedition D024 are superseded as default architecture.
**High-impact open detail (H/Q boundary):** exact semantics of SUCCESSFUL EVACUATION versus manual restart must be authored (recommended: actual evacuation resolves/ends the run immediately), but the statement 'player may leave server whenever desired' alone does not prove user chose instant end upon evacuation.

### Dossier 02: Ragnarok/endings
**Core rule CLOSED (U):** last 72 real hours; sealed weaker avatar/manifestation of boss can be encountered earlier; real awakened forms emerge in 6 boss regions; days 12–13 roaming and environmental escalation, last day island-scale devastation. Each elder holds one of six distinct achievement stones; 1..6 each meaningful, 6 ultimate. Stone path is optional; evacuation and nonboss currency/scavenging form legitimate competing objectives. Endings differ in meaningful gameplay outcome. Ordinary boss-avatar defeat does not necessarily negate awakened form. World run expires at 336h regardless of boss kill.
**G:** boss does not know home coordinates. A physical route can damage objects it really intersects; no teleport, omniscient path-to-house, surprise offscreen annihilation. Six stones should not become six identical DPS gates. Skill Core/gear/route/environment differ per region.
**H:** author an end-to-end evacuation encounter, the six distinct region/boss/stone consequences, place-specific physical hazards, optional ritual and reward-custody flow. Detail is CONTENT CONTRACT, not seven new questions.

### Dossier 03: Two-layer economy
**Core CLOSED (U):** ordinary materials, Spares, salvaging, recipe/recycler economy exist within one run. Physical CROSS-SEASON CURRENCY only becomes available from rare site treasure in last 72h, with especially high yield in six dangerous awakened boss areas. Player carries it and risks losing it; merely opening chest is NOT credit, physical treasure still at home at season end is NOT credit. Must deliver to a legitimate preservation endpoint and commit it to profile; may do repeated trips and continue playing. Currency carried into later runs is used VOLUNTARILY at spatially FIXED vending machines; recycling/disassembly machines also have legitimate item/salvage role. Player must choose journey/purchase, not receive item for free at spawn. Currency cannot be minted by repeated junk recycle/free conversion. A six-stone clear grants a major achievement/reward; evacuation is valuable independently.
**G:** finite identity-marked site sources, no save/reload duplicate, separate `unbanked_physical_currency` run inventory from `profile.secured_currency`; no generic conversion from all owned property. Vending purchase needs real availability/price/stock, no free top-tier Core replacing surprising discovery.
**H/T:** location and narrative of preservation nodes; exact escape rewards, stage 1–6 rewards, purchasable catalog, prices/limits/balance. User chooses EXPERIENCE goal; A3 authors measured economy. No invented exact cash amounts.

### Dossier 04: Continent, POI and exploration
**CLOSED (U):** a geographically coherent designed full-world masterplan; stable geography across runs; wide safe random spawn D058; strategic different home locations; useful roads and roadside finds even with basic melee/no Core; biomes/resources/hazards/POIs physically caused, not random tile confetti; visible difficult sites early with knowledge/gear-based later access; keyed/powered layered POI, retreat routes and reroutes; not a chain of mandatory dungeons. Under newer direct user correction inherited 10 dungeons are REUSABLE SOURCE, NOT all ten mandatory survival-map placements: supersede D002/D036/P0-10 literal geography when formalizing. Six elder zones must be organic territories with ordinary exploration value BEFORE apocalypse.
**G:** the same site remains meaningful pre-Ragnarok and post-awakening, not a freshly spawned unrelated arena. Loot source tier, protection and geographic opportunity cost are different axes.
**H/T:** approve area-to-POI access graph, source density, major exit/deposit stations and authored routes; map dimensions and art layout validated against travel/perf rather than human vote.

### Dossier 05: Home, survival, weather, offline, threats, logistics
**CLOSED (U):** own usable one-floor roofed home, doors, real room opacity/shelter, chest/bed/workshop/production/garden; base is enjoyable home and preparation engine rather than a score building. World time proceeds online/offline with honest bounded production (supplies, fuel, capacity, season end) and potential joyful return: harvest grown, furnace finished, research complete, when paid. Sheltered offline starvation floor 1 HP D059; risk outside remains. Physical climate, weather, biome hazards, day/night require real environmental mitigation, not dummy bars. Ordinary monsters discover house only by actual detectable footprints/trace D061; may path around, breach, repair follows; do not spawn director-knowledge/offline raid. Ragnarok path damage has separate physical origin with advance warning and non-irrecoverable offline consequences. Cart logistics and meaningful pets/mounts accepted long-horizon direction; not merely decorative boosts. No PvP grief.
**G:** every system must benefit during days 1–11 independently of apocalypse, then have a second credible consequence during last 3 days. Do not force house build to access basic road loot or mandatory boss path; solo low-risk exploration must stay fun.
**T/H:** time conversion/world climate cycles, hunger/thirst/calibration, safe downtime scope, boss offline damage boundaries, crop/forge time, cart cargo physics, pet acquisition must be concretely specified and tested but do not need new vote about whether they should exist.

### Dossier 06: Combat, Core, research
**CLOSED (U):** weak/basic melee is viable for safe scavenging; physical rare charged Core = found firearm analogue, immediately exciting to own and try (do not require storage or research before first use). USE / STORE / RESEARCH are real competing actions; learned recipe and physical specimen distinct; 3 research pathways (random Spares, directed, specimen reverse engineering) should function with different costs; ordinary crafted replacements require genuine resources/reagents/station/time. Run-local knowledge is reset in next run, NOT account-wide. Full original Gold animation, enemy interaction, environmental cues and source effect are required native; terrain synergy only where original supports, not invented source alteration. After a season, plenty of still-rare skills/rooms/objectives remain (D021). Not a forced 6-boss ladder.
**G:** Core source distribution mixes rare surprise in eligible supply-source class and intentional deeper POI research alternatives; not all roads contain high-tier Core; weapon choice/utility must affect later expeditions and Ragnarok, not only damage color.
**T/H:** A4 Gold source semantics per-cast charges/repairs, skill family identity vs 93 entries, slot budget, economy source rates and native end-user fun; do not ask user for unsupported numeric choices yet.

### Dossier 07: Story, player experience, playtest
**CLOSED (U):** player-first pleasure hierarchy: free choice and meaningful quiet scavenging; home and rewarding returns after offline; exciting rare Core ownership; glimpsed danger and voluntary later mastery; high-consequence but legible loss; a vast world with competing incomplete goals, no fake grind; 11 days of genuinely meaningful life that cause genuine advantage in three days of Ragnarok; a purposeful terminal event known from early game, not an arbitrary end-day boss-only UI; survivors can scavenge, evacuate, or chase 6 stones; new run currency buys agency, not automatic infinite power. Tutorial helpful first season, later optional/out-of-order with per-run rewards. FIRST USER FULL PLAYTEST only when E2 complete integrated experience rather than a fake prototype; internal B0/B1/G-R tests continue.
**G:** success is demonstrable player choices/outcomes across counterfactual routes, not numbers of POIs, skills, fixtures or CI passes.
**H:** write sample no-spoiler 1h/3h/10h, full-season online/offline, pre/post-Ragnarok, manual restart, evacuation, 1-stone and 6-stone, two-run economy journeys and acceptance. Human emotion can only be certified in actual human play.

## 2. Duplicate 'questions' that are CLOSED and should NEVER be asked again
- Is survival interesting without PvP, boss or mandatory dungeons? YES. (U)
- Can melee-only looting be satisfying? YES, it is a first-class play path. (U)
- Must each of days 1–11 be a prescribed preparation quest? NO; independent free play worth doing, transferable player knowledge and situational leverage. (U+G)
- Does base matter? YES, tangible owned shelter, storage, useful industry, garden, return anchor, expedition logistics. (U)
- Should all ten inherited dungeons occupy the first world quarter? NO, latest user overrules older placement. (U)
- Is there mandatory PvP or forced offline raid? NO; PvE risk has physical origins. (U)
- Does offline pause world chronology? NO. (U D060)
- Should the player be forced to remain in a run until day 14? NO; may choose restart anytime. (U)
- Does physical cash become permanent on mere chest opening or sitting in a house chest? NO. (U)
- Does depositing cash itself force ending the run? NO, repeatable deposit allowed, continued play. (U)
- Must six stones be collected for normal success? NO, alternate ending and currency path. (U)
- Are all Gold 93 IDs independently playable mastered skills by default? NO, requires A4 evidence. (G)
- Does a high run score automatically pay cash or pass physical assets to the next run? NO. (U)
- Must the new-run player visit a physical vendor and decide purchases? YES. (U)
- Is the endgame just a boss spawned at hour 336? NO, 72h evolving regional apocalypse. (U)

## 3. Deliberate non-questions: agent-owned concrete specs
A0: one SaveService schema/ledger, run lifecycle incl voluntary end, death and eviction independent, idempotent `deposit` and `season_finalize`, offline safety chronology and no money dupe. A1/A8: actual 6 elder regions + POI state transformations + physical deposit/evacuation approach + no empty content, alternate access. A3: regular material economy, revenue/sink, full machine inventory, late currency drop custody/anti-farm, rarity and cost sensitivity. A4/AVFX: authentic Gold lifecycle + skill differentiation, actual status/terrain when source supports. A6: player guidance, world/risk/clock/secured vs physical money, return-home/offline report, route/ritual/end UX. A7: multiple route counterfactuals, physical fail cases, and neutral sourced release assessment. Gold source-asset rights stay private and scoped.

## 4. Truly high-impact unresolved design work — not seven independent human ballots
**H1: Detailed evacuation/season-resolution specification.** Need exact world-fiction rationale, physically navigable escape mechanisms, success and departure point; distinguish player manual abandon from evacuation success; specify eligibility 72h and precise post-success state. Creator has NOT explicitly voted that successful evacuation must immediately terminate run, only that manual run restart is allowed anytime. Default recommendation: successful physical evacuation terminates run, but reserve that one consequence for informed confirmation after a complete player journey is authored.
**H2: Six-stone final ritual and reward topology.** Six distinct memento/boss identities, ladder 1–6, major capstone, and its relation to evacuation/cash. Can be independently drafted under user-approved constraints; no content art/name vote needed now. Show creator one integrated proposed story only when strong.
**H3: Currency custody physical graph and early-run shop economics.** Physical safe transfer point identity, route/cost, chest contents, secured ledger, vending stock/rarity; draft and measure rather than ask 20 price polls.
**H4: Ragnarok × offline physical destruction/fairness.** Model timed boss locality, hazard effects, warnings, damage bounds, recovery paths. Nonnegotiable solo fairness from user. Exact quantitative cap cannot be asserted from currently nonexistent native play.
**H5: E2 scope/production proof and multi-session density.** Distinguish approved P0/P1/P2 earlier classifications from latest mandatory long-horizon weather/cart/pet/trail/season objectives; do not label source plans human-accepted. Multi-week realistic timing and genuine first-user E2 full-playtest scope need test evidence, not high-level art counts.

These FIVE are remaining authored **integration work packages**, NOT five human questions. Only the narrow consequence in H1 is currently potentially human-dependent; the others should be designed from evidence and shown as concrete completed proposals, not repeatedly handed back as open-ended preference polls.

## 5. Supersession corrections to stage separately (DO NOT silently modify historical locks)
1. D055: 14 real days becomes maximum run lifespan; explicit voluntary earlier season abandonment/restart. The 14-day UTC expiry still exists.
2. D056: profile persistence adds banked cross-season currency, strictly separate from run-only items/recipes/Core/structure/POI/quest. No automatic inventory/score conversion.
3. D002/D036: legacy 10 dungeon source retained; inclusion/placement within survival geography is authored selection, not a forced 10-in-quarter count.
4. D028/X23/D024/P2-22: old rejected mandatory wipe vs persistent base/optional extra expedition is obsolete as default. Main product now run-reset model.
5. FB31/P2-20/SYS31: fixed physical vending + recycler/disassembler and optional trade are user-selected functions, not unapproved generic NPC trader. Bounty boards/market extras NOT automatically ratified.
6. Weather/cart/mount/pet/dynamic structure-aware monster behavior: latest direct human priority supersedes earlier 'maybe decorative P2' rejection; implementation ordering remains engineering-dependent.
7. ATLAS/ACCEPTANCE P8/E2: add Ragnarok 72h, 6 bosses, physical cash, repeated safe bank, meaningful escape, early reset, post-reset purchase, offline catastrophe safeguards. Remove legacy 'all 10 mandatory survival dungeons' and 'no account currency' checks.
8. Gold: source parity and actual 2 selectable body sources require same-game production acceptance, not registry/test-only claim.

## 6. Acceptance scenarios that close semantic cross-system gaps
J1: novice with knife -> roadside finds real useful loot -> build small home -> remain successful without dungeon, boss, Core.
J2: early rare Core seen/found/used with Gold full effect -> optionally store/research -> death bag + recovery or legitimate loss -> different next goal.
J3: hazardous perimeter visible -> learn protection via research/farm/POI -> revisit prepared -> new room loot; full route measured.
J4: load off while furnace fueled/crops planted/research funded -> honest finish/delta, hunger shelter floor -> no duplicated batches.
J5: ordinary tracked monster finds player-owned home ONLY after real trace sensing, rain erases another unused trace; no omniscient raid.
J6: Ragnarok day12 vault chest physical currency, region boss roaming -> escape with cash -> bank once -> reopen process -> cash persists; repeat trip.
J7: die with unbanked money -> same death bag token or loss -> no profile credit; offline-to-day14 expiry loses only unsettled loot.
J8: player kills one awakened boss -> receives one unique stone/milestone -> either escape or continue, no forced complete six.
J9: player acquires six distinct stones -> executes physically meaningful final path and reward, replay no duplication.
J10: evac route completed -> distinct reward / history; voluntarily abandon fresh run day2 -> no evac, no bonus.
J11: expiry at 336h offline triggers one settled season + profile balance, no extra drop/payout or runtime exploitation.
J12: new run geographically broad safe spawn -> zero inherited gear/knowledge/home -> visits fixed vending machine -> uses only legitimately banked currency -> basic scavenging still appealing.
J13: in endgame compare two 11-day strategies (farm+logistics vs exploration+combat): both yield differentiated viable outcomes, not one mandatory optimizer path.
J14: two game clients at 720/1440/2160, actual source Gold and native visuals, readable elemental hazards/loot/trace and native input across Web/desktop.

## 7. Gate decision and status
- User-purpose design: substantial COMPLETE at PRODUCT-INTENT level, ~7/7 dossiers have sufficient conceptual direction. This is NOT a claim that detailed balancing, narrative content or gameplay exists.
- Product-rule closure: 7/7 can be scaffolded in code/contracts; no new generalized preference poll required. Some authored concrete contracts H1-H5 remain; one possible human-dependent consequence H1.
- Implementation: separate, incomplete. A0/A1/A3/A4/A6/A7/A8 current PR/source progress and CI must be independently verified at exact head; no engine or full playtest accepted by this ledger.
- Do not send Arena agent prompts solely from this research note; stage a versioned `design_core.v1` brief and owner/acceptance mapping after creator review. Keep docs-only branch isolated from running owner PRs.

NO new user decisions invented; derived defaults shown as G not U.