# SOH — NEW INDEPENDENT AGENT: GAMEPLAY EXTENSIBILITY / BIBLE-LOCKED COMPOSITION — 2026-11-02

**Status:** CT-issued **proposed new-agent mandate**; no new Arena run has been launched, no owner branch edited, no merge. This is a new independent architecture-and-native-playable assignment, **not** LW1/C08 reimplementation, not GP-B renaming, not a new game proposal. Creator specifically requires: **new map/item/activity can be filled into pre-established mechanics and make meaningful connections without cross-module patching**; use an entirely new strong executing agent, with hard evidence and high-reasoning task complexity.

## 0 — Truth pins and authority

- Repo: https://github.com/Khanh-glitch/Soul-of-Hero
- **Canon:** [830-line CURRENT_PRODUCT_CONTRACT](https://github.com/Khanh-glitch/Soul-of-Hero/blob/a8c718b55130cff29b3adc5e7c531f9211ca22df/docs/survival/CURRENT_PRODUCT_CONTRACT.md). Read §0.1a freedom law, §0.2 non-negotiables, §0.3 BUILD-0, §I K1–K8, §II J01–J20, §V A1 geographical interface, §VIII S0–S5, §11.3 C01–C24. Stale 77-line PR31 contract is NOT canon; donor ZIP contains older 829-line embedded Bible NOT canon either. Never redefine C registry or convert J into forced quests.
- **Current gameplay baseline:** [Draft PR31 GP-B A0×A3](https://github.com/Khanh-glitch/Soul-of-Hero/pull/31), observed code SHA `fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1`. It is **not production accepted**, A1 13-field source-host binding and actual authored-world player route incomplete. Refresh before implementation.
- **Preserve C08:** [Draft PR34](https://github.com/Khanh-glitch/Soul-of-Hero/pull/34), HEAD `05ff5a3df04c59abd964bf54bc705ff5618646bd`, native A/B/C K8 green at code `c7b1866b79018b17344701e3f54f614479d9ca9c` [CI 41434002200](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41434002200). C08 independent artifact/screenshots were opened; UX quality still HOLD; not merged. Do NOT rebuild its AI or use TS phôi's flawed follower.
- **Verified original source archive** [`soul-of-hero-game-development.zip`](https://github.com/Khanh-glitch/Soul-of-Hero/blob/references/gameplay-prototypes-20261102/reference_prototypes/20261102/soul-of-hero-game-development.zip) 727262 bytes SHA256 `fa95538271fd46a70f5737b58b8671124e091e8f6196479950a25dca741a2403`, Git blob `5a667c979a597d5d26e80453f7f16756db98f150`.
- [Five archived phôi manifest](https://github.com/Khanh-glitch/Soul-of-Hero/blob/references/gameplay-prototypes-20261102/reference_prototypes/20261102/README.md) and [donor gameplay-depth reuse ledger](https://github.com/Khanh-glitch/Soul-of-Hero/blob/references/gameplay-prototypes-20261102/reference_prototypes/20261102/SOH_GAME_DEVELOPMENT_GAMEPLAY_DEPTH_REUSE.md).
- **Existing owners:** A0 SaveService, RunLifecycle, WorldAuthority/Composition; A1 world geography/sources, A3 canonical catalog/work queue/stock/research; A8 POI geometry/access; A6 UI/HUD/art; AVFX Gold; A7 independent gates. The new agent is **composition/extension-contract owner**, not above or a replacement of any of these authorities.

## 1 — The real product problem

The creator expects frequent future addition of a fresh terrain/map, item, enemy, structure, source node, station/work activity, research recipe, environmental affordance or POI. If behavior is already an approved mechanic, authoring NEW CONTENT should be a controlled declaration in its canonical owner catalog/manifest plus authored-world placement; existing input, validation, receipt, world consequence, SaveService, runtime, HUD projections and test contracts should discover and connect it **without an ad-hoc patch per addition**.

**Important limitation:** a genuinely **new mechanic** will necessarily need reviewed typed handler/code, rules/owner decision and new negative tests. NEVER promise 'any future feature is data-only'; that is an irresponsible universal scripting engine. Distinguish:
1. DATA ONLY: new instance or variant using an existing capability and handler.
2. CAPABILITY COMPOSITION: combining several existing actions/effects with defined K/C permission; extension manifest and possible minor adapter.
3. NEW BEHAVIOR: requires new typed service/validator/effect executor, Bible/creator decision if rules missing and owner review.
4. RULE CHANGE: new product law, STOP + ask creator, never silently ship.
No giant untyped `execute_any(action:Dictionary)`, no eval/user script in JSON, no second ECS/world, no second SaveService, no cross-owner rewrite.

**Expected positive demo:** a QA-only source definition (or second authored instance of an existing legitimate source) + a QA-only additional item variant using an existing item capability + an existing craft/work order + an authored placement in two independent fixture regions; no editor-built phantom scene, no hardcoded ID in player/input/economy/HUD. Same Godot action pipeline uses the same authoritative transaction/receipt and physics; test absent asset/unknown ID fails closed, and run reset/relaunch is correct. QA-only content must NEVER contaminate shipping game balance.

## 2 — Grounded seams in current Godot

Inspect exact current SHA/callers before designing:
- `game/autoload/save_service.gd`: one K8 transaction/save authority, stable item IDs, currently pins A3 script SHA. No independent extension-state file; never edit pinned scripts casually or hide SHA drift.
- `game/survival/a0_world_authority.gd`: one authored-world A1 reader and streamer, stable world spatial contract; no "sidecar alternate map".
- `game/survival/a1_authored_source.gd`: A1 reader framed at 1024×768, 64-size chunk and tile 16; source must be A1-authored physical entity, not caller-reported location.
- `game/survival/economy/economy_session.gd`: `bind_authored_source_host(host:Callable)`, `harvest_authenticated_source(source_id, tool_instance_id)`, calls A3 source custody, **fails closed when source host absent**.
- `game/survival/economy/economy_service.gd` and `data/survival/*`: current A3 data catalogs, actual costs/queue; new defs must route through existing owner rather than copy into another catalog.
- `game/survival/survival_build_system.gd`: physical placement/rooms/collision, uses existing SurvivalService/SaveService, currently some hardcoded `BUILD_SLOTS` likely a content-extensibility smell, but **do not replace until owner and native proof justify**.
- `game/survival/economy/a0_economy_composition.gd`: single composition root and read-only A6 UI projection; preserve.
- `game/survival/c08_trace_source.gd` / `c08_trace_follower.gd` on PR34: known working K2/K5 C08 Causality; future environmental material source should plug into its existing K2 surface read, not author a second footprint engine.
- Review actual A1 source-host 13-field receipt contract and existing source identity; re-use read-only trusted projections + server-authorized/owner-authorized live state, not arbitrary UI strings or client dicts.

## 3 — Target: thin typed "Bible Contract Composition Layer" on existing owners

**Never develop a parallel engine.** Assemble a small set of versioned, validated abstractions *only where code audit proves duplication or hardcoding is blocking incremental content*, placed in narrowly owned neutral adapter/manifest paths. Keep old call sites working.

A) **Definition and capability schema** (canonical owner source, stable IDs, optional fields):
- reference to authoritative item/source/structure/recipe/skill/actor definition, world authored ID and version; no duplicate definition cache with editing authority.
- types K1 (definition vs instance, owner, container, durability, charges, tags, capability), K2 (surface/material/hazard, geometry and path), K3 (source/stock/recovery), K4 (recipe/station/work/knowledge), K5 actor/AI, K6 placed entity, K7 route/vehicle cargo, K8 run/profile/time.
- action vocabulary anchored in Bible `ACT_ON_TARGET / USE / DEPLOY / TRANSFER / TRANSFORM / EQUIP / RECLAIM` plus pre-existing native MOVE/WORK etc. A tool can have multiple target affordances (axe chops tree *and* fights), no false exclusive subclasses.
- unknown ID/missing author source/invalid capability/invalid field/schema mismatch -> **fail closed with actionable reason**. Unsupported new behavior -> extension handler with test, not arbitrary behavior from JSON.

B) **Physical interaction contract**:
`real input/actor pose + real A1 source/surface target -> capability and legality -> proposed costs/deltas -> A0 SaveService unique atomic commit -> physical spawn/collision/condition and A6 readonly result`.
Validation includes actor→target range+LOS, material/terrain, genuine station/owned site, tool wear/charges, stock, run identity, exact receipt/anti replay; no granting from UI metadata. Do not conflate successful VFX with engine effects.

C) **Effects and events**:
- small typed result/event vocabulary that maps **existing C01–C24**, not a competing C25+ registry: `source_depleted`, `item_transferred`, `structure_placed`, `job_paused`, `recipe_learned`, `trace_created`, `run_reset` are examples of existing law. Origin+source+real geometry+validated preconditions+cost+receipt -> observable effect; idempotent replays and offline chronology.
- avoid event-bus god object; effects are generated by each **owner** and projected to neighbors, never external "helper" that can mint loot. Typed handlers small and individually testable, with read models for HUD rather than HUD mutating state.

D) **Content composition and expansion tests**:
- map extension means new A1-authored **fixture/approved geographical dataset** through same reader/source host, not replacing 1024×768 production map; site and ground state valid before enabling props.
- item extension means add one QA-only defined item or variation with existing action capability to canonical A3 catalog, no edits to harvest target branch or UI to special-case ID. Inspect whether Godot content catalogs already support this. If yes, **prove by test, don't add registry**.
- station/activity extension: one QA-only work order uses existing queue, real cost, paid placed station and SaveService. Show offline/relaunch and reason paused if fuel missing.
- failure tests: duplicate ID, missing target, unknown capability, foreign run, missing real source, faraway harvest, false item source, 2PID double collection, multiple-item custody collision, invalid terrain, content version migration, replay after queue pruning, invalid run reset, missing art fallback (fail/placeholder without mint).
- performance: authored source spatial indexing where needed, bounded queries, no scanning all map entities for every interaction/AI tick.

E) **Read-side/UI and save governance**:
- UI should receive available actions + `reason_unavailable`, projected item/station/trace/world state from real authority. Do not style all A6 panels; propose only neutral read data interface with owner approval.
- new content versioned, stable identity/deterministic ID allocation, provenance manifest, migration compatibility, content missing after save should fail closed with named blocker; time, state and legitimate offline work reconstruct from one A0 clock and SaveService; run-local vs profile boundaries.
- test rollback/commit/restart and migration. Human visible source-to-consequence: no "it works" only fixture.

## 4 — Vertical proof: BUILD-0 composition before generic system expansion

**P0: audit & seams, minimal proof** (no large rewrite): diagram current flow with exact method/file and owner; classify each potential extension: data-only / handler / new-rule. Identify 3 worst genuine hardcoding hotspots that currently obstruct adding a new source, item or work order; list what SOH already supports. No unbounded refactor.

**P1: working native extension seam**: Add 1–2 **QA-only content instances** in the *existing* catalog/authorized A1 test fixture, and demonstrate that they operate through the **unchanged** action/save/physics code paths: input→source→physical item inventory→paid work; change only definitions and test fixture for second variety. If impossible because specific auth seam absent, implement only the smallest A0/A1 approved host adapter; no bypass/mock trusted receipt. Unit + Godot real-input + 2PID tests. Negative tests prove not a scripting loophole.

**P2: real approved player loop**: New Game→avatar choice→free movement on A1-authorized world→finite wood/stone/salvage with real tool and wear→ paid house/chest/bed and station→leave via actual route→ legitimate hazard/C08 if available on same composition→ fuel-paid furnace or research queue→logout→second OS process→return physically and claim exactly once. Player may voluntarily deviate; no scripted quest gate. Native input at 1280×720 and 640×360, PNG inspected; identify A6 UI issues as separate owner follow-up. No made-up items, drop rates or prices.

**P3 only after P1/P2**: choose one genuinely valuable [K4 research specimen→blueprint] / [K7 cargo route] / [K2 weather→job/trace] connection with source and owner authorization. Do not start all three, no new mechanics that Bible leaves [CẦN ĐO]. Source archive can inspire interactions, but Godot remains authority.

## 5 — Donor source: what to learn vs reject

`git fetch origin references/gameplay-prototypes-20261102 && git show 'origin/references/gameplay-prototypes-20261102:reference_prototypes/20261102/soul-of-hero-game-development.zip' > /tmp/soh-depth.zip && sha256sum /tmp/soh-depth.zip`. Expected `fa95538271fd46a70f5737b58b8671124e091e8f6196479950a25dca741a2403`.

Read:
- `src/game/engine.ts:222–241` harvest/tool/material law.
- `src/game/engine.ts:527–613`, `src/game/sim.ts:466–580` offline furnace, research, gardens and time.
- `src/game/sim.ts:135–190` cart and real freight; `sim.ts:77–135` environmental effects.
- `src/ui/Title.tsx` for A6 only, `tests/soh.test.ts` for hypotheses not native acceptance.
- [full donor ledger](https://github.com/Khanh-glitch/Soul-of-Hero/blob/references/gameplay-prototypes-20261102/reference_prototypes/20261102/SOH_GAME_DEVELOPMENT_GAMEPLAY_DEPTH_REUSE.md).
- Other 4 verified original ZIPs on same branch may be consulted only to **fill a proven test gap**, not to consume all agent context.
Reject donor: weak C08 nearest/newer trace AI, 30-tile offline creature freeze, recent-400-intents dedup, browser IndexedDB, 200×200 map, Gold VFX substitutions and unapproved balances; donor's embedded older 829-line Bible is stale.

## 6 — Owner/branch policy and phased deliverables

Create **new independent Arena agent** assigned this work, not old LW1, not PR31 owner. If session pinned to `arena/<id>`, fork from latest verified composed *code* baseline respecting C08 ancestry or create separate feature branch from exact allowed SHA. Do not force push, change owner branch, merge, or silently integrate PR31/PR34. The 830-line canon and reference donor branch must be accessible separately via read-only fetch. A0/A1/A3 need review when seams cross. If no writable branch/PR rights, preserve patch/commit and state clearly rather than claiming pushed.

Deliver:
1. **Baseline architecture inventory (source evidence)**: exact caller, existing owner, current tests, actual missing seam per K/C.
2. **Minimal RFC** comparing (i) reuse existing catalog and adapters, (ii) typed thin facade above owners, (iii) giant new entity/event framework — choose smallest that supports data-only additions; explicit rejection of overengineering with reasons.
3. **Playable slice** with two configurations from same authorized Godot pipeline, no manual per-item hack; scenarios also leave player free to do other things.
4. **Contract/gate ledger** C01,C02,C04,C06,C07,C08,C09,C10,C13,C24 as relevant; positive + negative; same exact SHA run.
5. **Two-PID, run reset, 1× screenshot opened**; schema migrations and performance.
6. **Owner handoff**: branch, HEAD, draft PR, CI URL, source SHA, files changed, real gameplay result, failures, blockers, next exact command, potential A0/A1/A3/A6/A7 reviews.

**STOP CONDITIONS:** never skip the 13-field A1 physical source host by injecting static fixture receipts; never trade proven C08 for a new AI; never create unapproved maps, gameplay law, item/cash catalogs or default buffs; never add data-driven root that bypasses Godot type checks; never claim new map/item/activity is data-only if it requires new mechanics. Distinguish SPEC_READY / SOURCE_INSPECTED / NATIVE_UNIT_PASS / SAME_BUILD_INPUT_PASS / TWO_PID_PASS / HUMAN_VISUAL_REVIEW / PRODUCT_ACCEPTED; only evidence advances gates.

**ANTI-LIMIT:** short atomic increments, push every meaningful seam, update a takeover doc + PR comment **before** each expensive CI run, exact SHA/log/output/blocker + next shell command; new session resumes without re-reading everything. Remain productive if ZIP unavailable locally (it is on Git), or Godot missing locally (native Actions already works). No background work or fabricated native/visual passes.

## 7 — Definition of DONE for new agent

A new A1-authored site + K3 source or K1 item variant using an *existing* capability and approved data **actually becomes interactive** in the SOH Godot pipeline without editing per-item branches in player/controller/SaveService/UI; transaction remains authentic, costs real, object persists and works after restart; independent negative tests refuse counterfeit content and grants. Meanwhile a genuine human could enter game, make several meaningful choices, produce something at home and return after offline. No fake quest/progression lock, no second subsystem, no silent law change. Full-SOH 14-day replay/boss UX acceptance is a later S4/S5 matter, not falsely implied by P1.

**FIRST ACTION:** refresh exact PR31/PR34 HEAD/CI, source-map existing content paths and validate ZIP SHA. Then implement the thinnest evidence-backed extension seam and 2 content variations, before broadening gameplay.