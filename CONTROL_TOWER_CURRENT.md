# SOUL OF HERO — CONTROL TOWER CURRENT / SINGLE LIVE EXECUTION PLAN

**Status:** EXECUTION AUTHORIZED · SOURCE/IMPLEMENTATION INCOMPLETE · PR44 HOLD MERGE  
**Creator decisions pinned:** 2026-11-08 D-FINAL-01..04. **Product-law source:** [one and only Bible](web/ref/bible.md) §0.1c, K1–K8, C01–C24, J01–J20. This file owns ONLY task execution, owner acknowledgments, evidence and final gates; it is **not** a second gameplay Bible. Replace/update this document in place. Do not launch another roadmap or duplicate registry.

## 0. Immutable scope and evidence baseline

- **Target**: deliver every Creator-approved Bible capability and each compatible Last Island mechanic selected from Atlas v1–v11, including source/versioned ORIGINAL numbers where actually verifiable, plus an evidence-backed superior SOH player choice/consequence. Atlas PROPOSED_NOT_APPROVED is not automatically a release obligation; do not accidentally re-import PvP, permanent home, LI 15d, pay-to-win, cross-run recipes.
- **Calendar**: 336 real hours including offline, last72 Ragnarok. About two in-game years as eight seasonal phases (Spring/Summer/Autumn/Winter twice; first implementation nominal 42 real hours per season). Day/night length and region climate tuning remain measured parameters. Skills cannot modify run clock.
- **Core input**: LMB basic, Q technique 1, E technique 2, F interact (including contextual vehicle/cart), R Core reload. Backward input intent and save compatibility; no lost research/cart function.
- **Core architecture**: seven Creator Cores F01–F03/N01–N02/W01/S01 × three actions = 21 action specs (not 21 FX), 2 universal energy categories + 4 essences; legacy-four UID/Gold migration, 244 PixelFX/20 ARCANA are independent presentation assets, not gameplay effect evidence.
- **Atlas evidence truth**: Historical original archive lives on docs branch `docs/gameplay-mechanics-first-policy-20261105` at `docs/reference/last-island-atlas/`; 13 Git-tracked parts restore exact ZIP via `restore_atlas.py --extract`, verify SHA-256 `8b4fdedaa9397baaa1bcb8ba58d5c95ca2e7cbdd679963c6d4177fc9ab861e98`. Do this **once** and reuse checked source; v11's 18 systems/214 capabilities/104 XEDGE/144 gates/20 observational journeys are a COVERAGE CONTRACT, not already implemented. 104 historical v6 gates are a DIFFERENT set and source recovery status must be proven, not invented.
- **Previous implementation**: PR44 R2 C1/C2/C3/B/D materially exists at fixture/integration level; R5/R5.1/R6.1 offline defense, source custody and save tests already exist; Web Chromium smoke also exists. Do NOT order recreation because a stale R4/W00 ledger says partial. R4 counted 112 IMP / 59 PARTIAL / 25 PROPOSAL / 9 MAP / 5 AUTH-DIFF / 4 HISTORICAL, **as a historical audit only, NOT current completion**; its 104 XEDGEs remain formal NOT_RUN unless individually tied to new receipts. Read the current code before declaring a gap.

**Dual authority/status per record, required:** `CREATOR_LOCKED / APPROVED_PRINCIPLE / LI_COMPATIBLE_SELECTED / PROPOSED_UNAPPROVED / REJECTED_CANON / HISTORICAL_REFERENCE` × `EXISTS_VERIFIED / PARTIAL / MISSING / OWNER_BLOCKED / INTEGRATED / PLAYER_PROVEN / CLOSED`. Every cross-edge references Bible K/C/J, canonical v11 SYS/XEDGE, source mode/version, code SHA/path, test SHA/receipt, player-choice consequence, owner and actual next code action. **Do not copy W00 synthetic IDs into v11 without reconciliation.**

## 1. Owner register — GitHub snapshot and file authority, NOT automatic agent ACK

| Domain / obligations | Responsible owner lane | Verified GitHub reference (2026-11-08) | Rule |
| --- | --- | --- | --- |
| Web mechanics K1–K8, action/intent, Core, climate engine, source/POI transactions, late-run Web ledger | **Gameplay MEC-01** | PR [#44](https://github.com/Khanh-glitch/Soul-of-Hero/pull/44), branch `arena/d4bfcfff-soul-of-hero`, initial pinned HEAD `c831385643c21aca3fd366c324f8ef7e1dcd1610` | Only source-owned Web mechanics; preserve R2–R6.1; no Map/UI redesign; DRAFT/unmerged |
| Native SaveService, authoritative clock, offline/order/replay, integration state | **A0** plus integration owner | PR [#21](https://github.com/Khanh-glitch/Soul-of-Hero/pull/21), integration [#31](https://github.com/Khanh-glitch/Soul-of-Hero/pull/31) | Require durable state parity and migration; branch pins are references, not claimed live owner ACK |
| Material sources, recipes, sinks, Spares/cash balance, paid research/processing | **A3 / Web economy contract** | PR [#19](https://github.com/Khanh-glitch/Soul-of-Hero/pull/19), A0+A3 [#31](https://github.com/Khanh-glitch/Soul-of-Hero/pull/31) | Canonical economy source/version & deterministic receipt; no independent conflicting marketplace |
| Actual terrain, biome/temperature/moisture, physical POI/roads/oil authority, collision | **Map / Veyra owner** | staged H01 [#45](https://github.com/Khanh-glitch/Soul-of-Hero/pull/45) | Other workstream builds geography; MEC-01 requests typed site/season/climate data only; staging is NOT final-map acceptance |
| PixelFX, Core Gold cues, authored cast event/VFX and source identity | **AVFX** | PR [#39](https://github.com/Khanh-glitch/Soul-of-Hero/pull/39) and other AVFX drafts | Presentation cannot grant damage; source-to-event 21 action handoff + native trace proof needed |
| UI/UX/HUD/input hint/controls presentation and Godot native visual adapter | **A6 / separate UI owner** | historical PR [#24](https://github.com/Khanh-glitch/Soul-of-Hero/pull/24) | F/E/R visual/key hint migration and 640×360 readable actual UI; **MEC-01 no polish** |
| Independent conformance, cross-owner acceptance, anti-exploit, actual playable Godot gate | **A7 / QA** | PR [#25](https://github.com/Khanh-glitch/Soul-of-Hero/pull/25) | Independent K/C/J & SYS/XEDGE receipt at same integrated SHA; NO acceptance by unit-tests alone |
| Native POI content, world interactions and associated art/scene binding | **A8** | PR [#26](https://github.com/Khanh-glitch/Soul-of-Hero/pull/26) | Source IDs/geometry must come from Map, law from gameplay; no duplicate POI authoring |
| Verified optional worldwide score / anti-cheat | **Online trust/backend owner — NOT YET ASSIGNED** | No proven production backend on current Web PR | Control Tower must name a supported owner and review anti-fraud design before claiming verified leaderboard; local score stays LOCAL/UNVERIFIED |
| Scope, priorities, collision resolution, promotion / merge decision | **Control Tower** | this file; Bible §0.1c | Owner acknowledgment and SHA required; never equate a GitHub comment with Arena running |

## 2. 18-system non-omission contract (no new total or fake percentage)

| v11 systems | Scope to reconcile and close | Responsible lane |
| --- | --- | --- |
| SYS01 everyday tools/weapons | knife-first, dual use, wear, field repair, death bag, actor/material hits | Gameplay + A3 |
| SYS02 metallurgy/intermediates | legitimate ores, smelt, competing intermediates, heat/fuel | A3 + Gameplay |
| SYS03 recycler/R&D | physical paid recycler, condition/version/UID, research-vs-recovery | A3 + Gameplay |
| SYS04 workstation/production | Workbench I–III, queue, pause/full output, autonomy vs manual choice | A3 + Gameplay + A0 |
| SYS05 POI/gates | physical card/power/collision/retreat, no-boss access | Gameplay + Map + A8 |
| SYS06 electricity | generator/wiring/consumers, fuel/capacity/offline, useful alternatives | Gameplay + A3 |
| SYS07 housing/upkeep | build, shelter, typed reserve/repair, home choice & offline consequences | Gameplay + A0 + Map |
| SYS08 pursuit/defense | real trace → AI → bash → lawful traps/turret → physical drops | Gameplay + A0 + A7 |
| SYS09 freight/vehicles | optional foot/cart/motorbike freight + physics/economy; R2 fixture path EXISTS | Gameplay + Map + A3 |
| SYS10 oil/refining | salvage already exists; production pump source is fixture-only until Map authorizes actual oil site | A3 + Gameplay + Map |
| SYS11 loot/source ecology | typed source roles/tiers, inventory custody, finite/renewable, refresh/withdraw-only | Gameplay + A3 + Map |
| SYS12 airdrops | authenticated schedule, landing, access, reward, expiry/replay | Gameplay + A3 + Map |
| SYS13 Core energy | 7 cores × 3 actual Gold actions, 6 resource SKU, terrain/target effects, migration | Gameplay + A3 + AVFX |
| SYS14 knowledge/research | recipe learning, specimen, random/directed Spares choice, no permanent recipe | Gameplay + A3 |
| SYS15 survival/ecology | hunger/thirst/thermal/toxic/marsh/fire/water/weather/2-year seasons/garden | Gameplay + A0 + Map |
| SYS16 geography/resources | world source IDs, multiple safe spawns, lawful alternative physical routes | Map + Gameplay |
| SYS17 run/offline/Ragnarok | 336h, last72, Elder optional, cash/escrow, evacuation, run wipe, second run | Gameplay + A0 + A3 + A7 |
| SYS18 market/scarcity | run-local Spares trader, profile-secured Ragnarok currency, finite shop, optional ranked score | A3 + Gameplay + online trust |

**Closing rule:** For each approved/selected capability, formal code + sources + cost/UID + meaningful consumer/alternative + offline/save + correct native/binding + real player opportunity. A tested subgraph can close a bounded row; NEVER mark SYS DONE from one route or 775 tests.

## 3. Execution DAG — progress toward FINAL, not another audit treadmill

**F0 — one source/baseline reconciliation (start immediately, does not block mechanics):** Pin PR HEAD and authorized owner sources; restore original Atlas once; crosswalk every v11 row against Bible K/C/J and *latest* Web/native code evidence. Update statuses in this existing plan and the single already-established W00/v11 trace ledger **in place**, marking where W00 IDs differ; do not create another Bible, do not claim unverified LI numbers. Issue implementation packets simultaneously for clear missing source-backed mechanics. Record LI ORIGINAL_UNKNOWN as a research debt; source-verifiable parity cannot be claimed complete until investigated.

**F1 — player agency + Core contracts [GO NOW]**: gameplay owns canonical LMB/Q/E/F/R action/intent mapping; ship F01 actual pick→use→reload and physical effects, backed by 6-SKU source/cost (A3) and Gold event contract (AVFX). Preserve old 4 Core UIDs/charges and existing non-Core knife/repair/research/cart. Gate: real K1/K3/K4/K5 choice, UID/cancel cost, Q/E targets, same-process then reload; next seven-Core action matrix only after genuine F01 proof, no artificial request for cosmetics from MEC-01. Do not restart R2 vehicles.

**F2 — seasonal ecology [GO IN PARALLEL AT OWNER INTERFACES]**: A0 calendar/versioned time contract; Gameplay engine two years/eight seasons with deterministic online/offline settlement; Map supplies climate/biome ground truth, A3 garden/survival multipliers. Phase is nominal 42h/season and cannot touch 336h/72h run clock. Demonstrate spring→summer→autumn→winter→repeat crossing a save/reload, differentiated weather/soil/trace/thermal consequence, no impossible deaths from invented weather. Day/night timing separately tuned, not arbitrary canon. No Map/HUD redesign by mechanics owner.

**F3 — Ragnarok no-boss and world lifecycle [NEXT HIGH IMPACT]**: finance C15/C16/C17/C18/C20/C21/C22/C23: genuine last72 finite cash → legal physical first-chest purchase at zero wallet → owned home deposit positive cash → optional evacuation → reset → second run physical purchase. In parallel Elder 1–6 and authenticated leaderboard score events. Refuse score→cash and any silent profile item carry-over. Bring existing implementation to natural/long-run proof instead of rewriting. Online verified status remains BLOCKED_OWNER until backend named.

**F4 — close remaining explicit 18×214 and 104 cross-links, bounded packets**: no work repeated just for a status. From each `PARTIAL/MISSING` record pick the highest player-consequence gap with exact code SHA, owning file and one before/after action; implement and close bounded link, then advance to next gap. Existing R2 C1/C2/C3/B/D and R5–R6.1 are prior receipts not automatic reassignments. Map/UI deficiencies become typed integration packets to their owner, not Web mechanics redesign.

**F5 — compose original product**: A0/A3/Gameplay/Map/A6/A8/AVFX integrate on one pinned native Godot 4.7 code SHA, own save source, real inputs/collisions/assets. A7 independently checks K/C/J and the selected v11 gates, including both boss and no-boss branches. Web passes ≠ Godot passes. Keep all PRs unmerged until provenance/owner consent + QA and Creator review.

**F6 — actual 14-day world value**: test 336h/last72 chronological edges, no-boss and Elder routes, multiple spawns, death/bag, stay/offline/return, first chest/positive deposit, season loop, score anti-farm and true second run. Native real-input and visual, human strategic-choice/return value, long-run balance vs verified LI original. Fix repro defects, not imaginary regressions. Then Control Tower proposes final merge to Creator, not before.

## 4. One-way anti-loop rules (binding)

1. A new task needs **reproduced bug** (SHA + input + expected/actual), or **proven missing approved/LI-selected capability**, or **typed cross-owner contract blocker**. No other reason to reopen a completed packet.
2. Every work order specifies owner, exact file boundary, physical player before→after, real costs, relevant LI provenance, affected cross edge and stop condition. QA coverage must target the change; do not run endless suites to avoid implementing player value.
3. States: `NOT_CHECKED → CODE_PRESENT → MECHANIC_PROVEN → COMPOSED_PLAYER_PROVEN → CREATOR_ACCEPTED → CLOSED`; `BLOCKED_OWNER` and `ORIGINAL_UNKNOWN` remain explicit. An earlier `CODE_PRESENT` does not count as `CLOSED`.
4. One current authoritative execution file (this file). Existing `CAPABILITY_LEDGER_W00.md` and historical audits remain supporting evidence, not a rival TODO authority. Update this plan when a milestone closes; do not create R8/R9 status plans.
5. Never fabricate missing Last Island values; investigate archive and authoritative dated sources. If a material original cannot be sourced, surface precise source/date/mode gap for a Creator scope exception decision; no silent "100% LI numeric parity" certification.
6. Map/UI/HUD/art are separate owner workstreams. Do not silently ship placeholders as final; do not delay independent mechanics implementation for visual polish.
7. **No agent starts just because a GitHub comment exists.** Owner needs actual prompt/session acknowledgment. No uncontrolled parallel edits, unapproved PR, force-push or production merge.

## 5. Immediate work orders and handoff contracts

**WO-GAME-01 — Gameplay PR44, now:** Verify current SHA, keep already complete R2–R6.1. Audit exactly one current input seam (Game.tsx uses Q/E for existing Creator Core and F/E interact fallback; R loads Core but also accesses research), then implement the decided F contextual + E technique + R Core reload law, **without losing research/cart/ordinary tool**. Scope is gameplay input/intent adapter, not layout redesign. Add/repair only affected regressions and backward save contract. Then implement one REAL F01 item→source→load/cast→impact consequence sequence; reuse existing Core if true, do not create duplicate or collapse 21 action meanings. Coordinate A3 six-SKU and AVFX Gold event IDs via typed interface; mark blocked edges precisely. Push substantive code, report an exact SHA and next missing Core action.

**WO-CLOCK-01 — A0/A3 interface, concurrently:** publish one typed `world_calendar_v1` contract: 336h unaffected, 8 persisted season phases anchored to run start, online/offline chronology, calendar migration semantics for existing saves, clean day/night parameter awaiting tuning; A3 ties crops/fuel/resource hazards to phases. This is a cross-owner request; do not edit PR44 simultaneously without branch coordination.

**WO-MAP-01 — Map owner, no geometry changes by MEC-01:** supply season-ready typed biome/temp/moisture fields and authorized POI/first-cash/oil locators with source IDs from the actual integrated map; can be delivered later, independent Web mechanics proceed.

**WO-FXUI-01 — AVFX and UI owners, separate:** typed 21 Core skill event/Gold cues and menu hints showing LMB/Q/E/F/R at native final; no unauthorized Gameplay visual redesign.

**WO-QA-01 — A7:** define independent acceptance vectors for F/E/R collision, 2×4 seasonal boundaries, nonboss escrow and run reset, and multi-owner native combined SHA. Do not make full-run integration a blocker to write the first F01 intent code.

**WO-TRUST-01 — Control Tower:** locate/assign backend owner for verified leaderboard; document trust protocol separately from local score, never mark server verification done without working backend.

**Next dispatch is WO-GAME-01, not C1/C2/Motorbike.** When implemented, close exact sub-gates and advance. Remain PR44 DRAFT/UNMERGED, native/Map/UI owner branches untouched.
