# MEC-01 R3 — Mechanics Depth & Causal Integrity Audit

Branch: `arena/a9d7aa20-soul-of-hero` · Baseline at R3 start: `6bcb712` (R2 checkpoint) · P0 commit: `df11d2f` · P2 commit: `4cf69ce`

**Scope frame (binding):** `shipping_fresh` is a TEMPORARY mechanical test world; findings are mechanical, not experiential. No claim in this document speaks to fun, excitement, engagement, retention or any human experience. No balance-superiority claim is made — integer-batch costs in R2 are "not worse than" anchors, never globally optimal sequences, and unpriced materials carry nonzero opportunity cost. Automated tests never assert experience quality.

**Authorities used, in order:**
1. **Bible (binding product law)** — `web/ref/bible.md` (+ `bible.base.md`), §0–§VIII incl. K1–K8, U1–U6, M01–M15 (legacy aliases, §§4/4.1), C01–C24 (§11.3 registry), B12–B15 (§11.6 paper gates; expected outcomes are NOT production-verified tests), §11.7 historical params (source-led, NOT SOH balance), §8.2–8.4 evidence tiers and the 01/11/2026 status snapshot.
2. **Atlas capability ledger (historical/provisional inventory)** — `docs/survival/gameplay-depth/CAPABILITY_LEDGER_W00.md` (214 provisional inventory IDs, SYS01–SYS18 + W-round notes) and `CAUSAL_GRAPH_W00.md`. **The creator’s v11 Atlas CSV is NOT in this checkout and was not re-validated row-by-row.** No XEDGE-001–104 is marked CLOSED anywhere in-repo. W00 ledger statuses reflect the `d73aa63` baseline; later rounds (B04-P4…W09) re-opened parts of SYS06–SYS13 and all of those remain **PARTIAL** (e.g. W07/W07-R offline power/turret parity; W08/W08-R combat-sound stimulus; W09 player-playable sound). It is used here ONLY to locate historical work and to flag missing/unproven topics — **never** as proof that a capability works, and **never** as a mandate to build.
3. **Implementation evidence** — engine (`web/src/game/*.ts`, read-only this round), tests (`web/tests/*`, incl. new `tests/mec01-r3-causal-integrity.test.ts`, 3/3 green), persisted-save validation (`src/game/persist.ts` `validate()` + `diagnoseInvalidState()`).

**Evidence-tier honesty (Bible §8.1):** nearly everything below is S0–S2-tier mechanic evidence (design + source + isolated fixture/integration tests). Nothing here elevates a system to S3 (same-build composed human run) for the FINAL map, to S4 (human observed) or S5 (replay value) — and nothing in this audit should be read as claiming them.

---

## 1. P0 — Test compilation validity (complete this round)

- `web/tsconfig.test.json` (new, strict; includes `src` + `tests` + `vite.config.ts`): **134 errors → 0 errors** (`npm run typecheck:tests`).
- `web/package.json`: added `typecheck`, `typecheck:tests`.
- `tests/mec01-c3-offline-resume.test.ts`: duplicate `node:fs` import removed.
- `tests/b03-return.test.ts`: **harness defect fixed** — `setup()` never returned the anchor `x,y`; the hidden-POI report-exclusion assertions ran against an `undefined` anchor (entities placed at `NaN`) and therefore passed vacuously. Setup now returns `x,y`; assertions are real (suite 9/9).
- All other P0 edits were cast-only/import/typing fixes in test code only; no engine changes.
- Suite at P0 commit `df11d2f`: **722 passed | 1 skipped** (identical to R2 baseline `6bcb712`). Logs: `/tmp/tsc-tests3.log`, `/tmp/r3-p0-suite.log`.
- **Standing rule after P0:** every PR touching `web/` must keep `npm run typecheck` and `npm run typecheck:tests` at exit 0.

## 2. P2 — Adversarial causal-integrity probes (this round)

Boundaries probed and the disposition of each:

| Boundary (P2 priority) | Disposition |
| --- | --- |
| Source depletion → loot → inventory → craft/recycle (K1/K3/K4 custody) | **Reused existing coverage; no new defect found.** `mec01-c1` (crate open→move→UID custody), `b01-industrial-loot` (incl. white-box reservation race + atomic output fit for FULL output container), `mec01-c3` (UID uniqueness across ALL custody slots; invalid-state save refused before write), `b02-bear-trap`, persist `validate()` rejecting duplicate UIDs and job reservations sharing an identity (`duplicate-uid`). |
| Competing consumers of the same Gear/Pipe/Blade/Spares UID | **Engine-enforced at queue time (custody-closed). New black-box probes added** (`tests/mec01-r3-causal-integrity.test.ts`): (a) two L2 benches race one gear — loser refused at `hasAll` before queueing; exactly one reservation across both queues; UID set conserved; (b) recycler holds the UID first — the bench craft is then refused; after settle the reserved UID completed exactly once; global UID uniqueness held; (c) white-box push-order variant already existed in `b01-industrial-loot` (line 130). |
| Research vs specimen vs Recycler | Same reservation discipline (`research.specimen` reserves at queue; `recycler` reserves at queue). `b1-integrity` (cancel refunds + replay safety), `b05-recycler-reload` (UID restored after cancel/reload), `progress­ion`/`b05` (replay guards) reused; no new distinct failure mode found beyond the above probes. **Fix not applied (see §4.4).** |
| Fuel shared by vehicle/generator/station | **Vehicle refuel exhausted-by-dispatch probed (new test):** one canister → one +100 tank refuel; second dispatch refused; pack never negative; no minting. Station fuel policy unchanged and pinned (`isStationFuel` mirrors `move` and UI; fuel canisters never burn station-side; wood/charcoal/coal/briquette only — `b05-station-fuel-policy`). Vehicle/generator sharing cannot double-spend by intent atomicity + `removeItem` custody. |
| Garden automation input/output + offline event order | **Code-verified, tests reused** (`home-production`, `b03-production`, `b03-return`): deterministic order harvest→plant→irrigate; `tenderFits` preflights FULL chest → no harvest, no fuel consumed, `storage_full` paused state persisted; fuel only spent on actual ops; barrel rain-refill bounded by `tenderBoundary`; state-change receipts only (no per-tick spam). No defect found. |
| Footprint perception → pursuit → walls | **Reused** (`b2-perception`): senses nothing through walls; skittish creatures do not flee the unseen through walls; collision-resolved emission only. Combined with `b2-chronology` (no replay of held movement; bounded event steps). |
| Cargo → death/reclaim/save/restart | **Reused** (`soh` C10 death bag unique + survives save/reload + stone conservation; `b1-integrity` lethal profiles incl. empty-inventory bag; `b1-storage` station destruction → bagged paid instances; `b04-vehicle-unload` (bag UIDs survive reload; old unload receipts not replayed)); **new probe**: global UID uniqueness after multi-system flows (see `mec01-r3-causal-integrity.test.ts` `allUidsEverywhere`). |
| Final72 cash → purchase → escrow → profile → new run | **Reused** (`soh` full E2 arc: zero-wallet → last72h finite cash → vendor escrow chest → atomic deposit → evacuate → run 2 spend; `escrow-route-physical` buy→build→deposit+validate; `b05-vendor-freight` secured-cash purchase decrements vendor stock + rejects insufficient funds + rejects intent replay; `progression` finalize-once + wipe + `LOCAL/UNVERIFIED` labeling). Zero → first deposit works on `shipping_fresh` today (works as PROPOSED C16 path; still PROPOSED pending creator lock — see G1). |
| Save editing / replay minting / invalid restoration | **Reused** (`b1-integrity` replay after run transition refused; `b05-oil-pump` reload + replay-tail idempotence; `b05-vendor-freight` replay refusal; persist layer refuses invalid snapshots before write; bounded diagnostics only). **Remainder documented (see §4.4).** |

**Adversarial outcome this round:** no engine defect found at the eight prioritised boundaries. One test-harness defect (b03-return, P0) was fixed and now genuinely verifies hidden-POI exclusions. Three new targeted negative/race probes were added where a distinct public-API failure mode lacked coverage (two-bench gear race; recycler-holds-UID vs craft race; one-canister vehicle refuel exhaustion). No Atlas XEDGE was closed this round; W07/W08/W09 remain PARTIAL exactly as previously reported (incl. offline turrets reserving power without firing — C09/K6 offline-defense NOT proven, intentionally).

## 3. P1/P4 — Binding coverage matrix

Legend: **v+** = implemented and verified by named tests · **pv** = partially verified / integration-dependent · **u** = implemented but not verified this round · **MISS** = genuine absence · **prop** = proposal/unresolved design, not implementable law.
Statuses are mechanic-level, not UX/experience-level. "Verified" = engine source inspected + tests green at the stated SHA.

### 3.1 K1 Item (single object model, transfer-once custody)
Source of truth: Bible §K1, §11.3 C01–C07. Implemented in `src/game/{catalog,core,engine,persist,recycler}.ts`.
- Runtime: typed `Stack{uid,key,qty,dur?,charge?,meta?,reserves?}`; containers `inv/eq/drop/bag/cart/vehicle/loot/cash/chest/fuel/out/rest`; custody+reservation accounting in `addItem/removeItem/move/reserveInputs/portion/returnReservations`; transfers keep UID; partial paid stacks split with identity preserved (`portion`).
- Verification: `mec01-c3-offline-child` (parent-process reload, UID uniqueness), `mec01-r3-causal-integrity` (new), `soh` (death bag), `b1-integrity` (cancel refund, paid stack custody), `b05-*` (fuel/output policies), `persist.validate()` (`over-max`, `bad-qty`, `duplicate-uid`, reserved-share rejection).
- Status: **v+** for custody & movement · **pv** for "damage ≠ yield" edge confirmation in every ability profile (C05 property tests exist at tool/weapon level — `soh`, `b03` — but no audit enumerated every Gold event vs its mechanical delta; AVFX scope, owner A4).
- Known failure mode covered: crash mid-job → reservation stays custody-held, refund path exact (`b1-integrity`).

### 3.2 K2 Environment (terrain, weather, fire, traces)
- Runtime: `src/game/{sim,thermal,world}.ts`; bounded fire spread (`BAL.fire.maxSpreadDepth`), weather driver, terrain wetting.
- Verification: `b03-thermal` (bounded spread along materials; wet/dry), `b2-perception`, `b2-chronology` (bounded offline stepping), `soh` (C24 reachability).
- Status: **v+** mechanisms; **pv** at "weather meaningfully changes legal options across a full day" never claimed (no scripted experience claim); soil/climate heterogeneity for garden rates implemented (`gardenEnvironment`) with offline settle tests green (`b03-return`, `home-production`).

### 3.3 K3 Sources (finite loot + ledger)
- Runtime: `src/game/{world,loot-ecology,loot-source-spec,creator-loot,economy-adapter,wreck-economy}.ts`; source stock in `r.sources` with `stock/hp/burnt/regrowAt/fireSpreadAt/fireDepth`; `validate()` clamps stock/hp to def bounds.
- Verification: `b01-industrial-loot` (once-per-source grants, UID provenance), `sys11-*`/`m-core-03r` (finite unique loot), `b05-freight-crude`, `b05-oil-pump` (offline no-replay), `soh` (last72h cash chest finite).
- Status: **v+** mechanics; **pv** at Map population economics (respawn tables/loot tier rendering — MISSING SYS11-05…11 vs baseline, see §5; owned by Map/A3).

### 3.4 K4 Knowledge/work (study once-only, paid jobs)
- Runtime: recipes run-local (`r.knowledge.recipes`, `ALWAYS_KNOWN_RECIPES` migration idempotent); research station (`R:*` jobs — specimen: whole specimen UID reserved; directed/random: spares); bench jobs reserve inputs at queue (`reserveInputs`), refund on cancel (`returnReservations`), legacy `reserved===undefined` jobs safely refused (not credited) until resumed through the bag flow.
- Verification: `veyra-runtime` (validatable buildable?/output accounting), `gp10r-expedition-intel`, `b1-integrity` (refund exactness), `b05-recycler-reload`, `progression` (knowledge reset per run), new integrity probes.
- Status: **v+** custody semantics; **pv** at "learn once across every research path under every crash window" (crash-during-`research.specimen` queue window not independently re-proven this round; mechanism is the same `reserveInputs` gate).

### 3.5 K5 Actor/AI (HP, perception, creatures, elders)
- Runtime: combat (projectiles/hazards/elders `ELDERS` 6), stimuli (`stimulus.ts` world-stimulus-v1: footprints, combat sound, airdrop landing), creature memory with committed-emission binding + `stimulusIgnore`; offline ordering.
- Verification: `soh` combat, `w08-combat-sound`, `w08r-combat-provenance` (sound bound to committed emission; forgery classes rejected in `validate()`), `b02-*` (sensors, cards), `b7-hazard`? hazards validated structurally on load.
- Status: **v+** stimulus integrity (strong); **pv** at habitat-appropriate pursuit completeness across all creatures (W07–W09 PARTIAL), and at any human-observable perception quality (not testable by automation).

### 3.6 K6 Building/POI (owned instances, HP, POI gates)
- Runtime: `build` consumes materials + creates run-local owned instance w/ receipt; reclaim checks `reserved` legacy guard → bagged custody; `claim`/Territory Cabinet upkeep (`planTerritory`); POI power (generator relay → doors, `poi.power.pause` intent), bonuses wired via `advancePoiAccess`; `escrow` (C17) with owned-territory requirement; `evac` beacon (C22 co-presence finalization).
- Verification: `territory-cabinet` (cabinet install/upkeep/coverage termination), `soh` C07, `c3-poi-power-feedback`, `expedition-intel`, `escrow-route-physical` (full physical chain), `soh` E2 arc.
- Status: **v+** custody/lifecycle; **pv** at "every POI in the FINAL map has correct gate/power wiring" (Map authority; the temporary world exercises the machinery, not the topology).

### 3.7 K7 Travel/freight (physical cargo, vehicles)
- Runtime: carts (load/weight/collapse, vehicle-unload bags on break), motorbike (`placeMotorbike/mount/refuel/repair/leave`, tank 300, canFuel 100, fuel burn on movement), road geometry via Map `economyMap.road` + `cargoPassable` mask.
- Verification: `b04-vehicle-unload`, `b05-vendor-freight`, `b05-freight-crude`, `mec01-c2-delivery` (accounted freight model on `shipping_fresh` v1: the bike never wins the 14 kg route — **recorded as R2 data; NOT a mechanics rejection** per R3 correction 1; travel economics of the temporary world are explicitly out of scope for tuning/rejection), `b7freight`? (route cost accounting covered by freight tests).
- Status: **v+** mechanics; **MISS** at (a) ANY tuned travel economy claim (forbidden by frame), (b) final freight topology & vehicle geometry (Map-owned; request R3-M4).

### 3.8 K8 Time/ledger (336h, last72h, finalize, profile)
- Runtime: `clock.simMs`, `startedAt/qaOffset`, `finalize` in `endRun` (idempotent), profile holds ONLY `securedCash/achievements/history`; run state wiped; `LOCAL/UNVERIFIED` labels; leaderboard backend absent by design (C21/E3).
- Verification: `progression` (wipe, one-finalize, history keep), `soh` E2 arc (dead→bag→evac→run2 spend), `b1-integrity` replay-after-transition, `wmp04r1-current` (finite signals over 336h), `b05-vendor-freight` (survival-safe early view), `mc-run-1`? (abandon path via `endRun('abandoned')`).
- Status: **v+**; **MISS** at C21 backend (correctly not built — owner request R3-O3); at score uniqueness enforcement **u** (see C20 note §4.2).

### 3.9 C01–C24 registry roll-up (§11.3)
| C | Status | Evidence anchor (this round) | Notable uncovered failure mode |
| --- | --- | --- | --- |
| C01 | v+ | `soh` sources/harvest; `b01-industrial-loot` | Per-ability-profile yield=0 vs damage proof not exhaustively enumerated |
| C02 | v+ | `mec01-c1`, `b01-industrial-loot` | None known at suite level |
| C03 | v+ | `soh` cores/cast; charges debit at cast (`spirit-core`) | Cast-cancel edge vs partial charge consumption (Gold-dependent) |
| C04 | pv | Research specimen/directed/random reservation-at-queue; `progression` learn-once; `ALWAYS_KNOWN_RECIPES` migration | Crash between specimen queue and commit not independently re-proven |
| C05 | v+ | `soh`/`b03` combat; `b03-thermal` fire | No end-to-end proof damage≠yield on EVERY Gold event (A4 scope) |
| C06 | v+ | `home-production`, `b03-production`, `b03-return` | Barrel rain-refill during offline chunk in extremely long offline gaps (boundary math exists; long-gap parity = W07-class re-verification) |
| C07 | v+ | `soh`, `b1-integrity`, `b1-storage`, `b04-*`, `persist.validate` | Multi-station reclaim ordering under one queue per station (not probed) |
| C08 | v+ | `b2-perception`, `b2-chronology`, `w08-combat-sound` | Footprint decay under extreme rain-rate weather only spot-checked (`b03`/`b2`) |
| C09 | pv | `territory-cabinet`, `b03-hunger-shelter`, W07-R (turrets reserve, never fire offline) | **Offline turret firing is NOT proven and NOT claimed**; forecast UI (A6) absent by scope; upkeep offline partial |
| C10 | v+ | `soh`, `b1-integrity` | None known |
| C11 | pv | `c3-poi-power-feedback`, `expedition-intel`, `poi-access` | FINAL-map POI suite (power+hazard+retreat one build) is Map-dependent — R3-M3 |
| C12 | v+ | `progression` knowledge authority | Starter quests absent BY DESIGN (optional; not an absence of law) |
| C13 | v+ | `b05-vendor-freight`, `mec01-c2-delivery`, `b05-freight-crude` | No freight Superiority claim admitted (temporary world) |
| C14 | pv | `b03-thermal`, weather drivers | Regrow-under-weather cross-cycle invariants not fuzzed |
| C15 | v+ | `soh` (last72h-only cash, finite chest) | Source-topology on FINAL map = Map (R3-M3/M1) |
| C16 | prop | soh E2 buys first chest with UNSECURED cash (PROPOSED path WORKS today) | **First-chest no-deadlock FAIL-SAFE is PROPOSED, NOT CREATOR-LOCKED** — G1 |
| C17 | v+ | `escrow-route-physical`, `b05-vendor-freight`, `soh` E2 | Deposit atomicity across process crash mid-`removeItem` (single-threaded; low residual) |
| C18 | v+ | `b05-vendor-freight` | Vendor stock tuning balance — not claimed |
| C19 | pv | `ELDERS`(6) exist; combat + stones; `soh` six_stones award path | Arenas are Map content; awakened-form presence in shipping_fresh = partial |
| C20 | u | `score` field + history write exist; source receipts unique in `seenIntents/receipts` | **No per-source score-once adversarial test located** — R3 follow-up candidate |
| C21 | MISS | history labels `LOCAL/UNVERIFIED` correctly | **No backend ⇒ NO VERIFIED ranking exists; correctly unbuilt** — R3-O3 |
| C22 | v+ | `soh` E2 (beacon co-presence → `ending:'evacuated'`) | Beacon PLACEMENT on FINAL map = Map (R3-M2) |
| C23 | v+ | `progression`, `soh` E2 | None known |
| C24 | v+ | `soh` C24 (4 starts, BFS reachability, resource rings); shipping_fresh seeded-geographic-v1 spawnChoice contract validated in `persist.validate()` | Final safe-spawn proof at 6 elder-region scale = Map |

## 4. P3 — Gap disposition and §4.4 hidden-failure review

### 4.1 Ranked gaps (consequence order), with dispositions
1. **G1 — C16 first-chest no-deadlock fail-safety: PROPOSED, NOT CANON.** The Bible locks "no deadlock," but the resolution path (vendor accepting unsecured final72 cash for the first `Rương ký gửi`) is an open creator proposal (§11.3 C16 row: "unsecured-cash vendor path is PROPOSED pending creator"). The code path EXISTS and passes today; do NOT tune it, do NOT lock it, do NOT present it as settled law. **Owner request R3-O1** — creator to lock/reject at R4; interim status = works-but-proposed.
2. **G2 — C21 verified world ranking: MISS, correctly.** No trusted backend ⇒ no VERIFIED leaderboard can honestly exist (Bible §8.3 E3, §11.6 B14/B15 spirit). **Owner request R3-O3** — needs a server-side authoritative receipts/validation service; client edits are out of trust by design. Do NOT fake it with checksum claims.
3. **G3 — C20 score uniqueness unproven adversarially.** `score` exists; per-source+`run_id`+event-type credit-once enforcement lacks a located adversarial test (replay/farm of score events across deposit/evacuation/elder storms). Map-independent follow-up candidate (small, additive test + possibly a guard) — **next executable scope N1** (below).
4. **G4 — Offline defense causality (C09/K6, W07-R).** Turret consumption of arrows ONLINE happens; offline they reserve but never fire; home loss offline lacks the full "traces→pursuit→defense outcome" chain with real AI pathing (M11/B13-shaped risk). Genuine but bounded; implementing speculative offline combat would be creating a NEW subsystem, not a connection. **Owner decision required (R3-O2) + it is NOT map-blocking**; do not build until the creator picks the offline-consequence model. Recorded, not hidden.
5. **G5 — Ruin-city POI suite on the FINAL map (C11/C15).** Machinery (keycard/power/hazard/loot/retreat) is implemented and feedback-tested on `shipping_fresh`/`dev_delta_fresh`; the FINAL topology (layered exterior/deep rooms, ≥1 non-Elder cash route through an intact POI) is Map-owned. **R3-M3.**
6. **G6 — Atlas strata that are NOT Bible-binding.** SYS13 (core materials/essence industry 13 IDs), SYS12 world-airdrop network (8 IDs vs baseline), SYS18 vendor restock/variation (4 IDs), research-vs-market (SYS14-11) — historical Atlas topics without binding Bible hooks; building them now would be new standalone features. **Not scheduled; flag for creator triage at R4.**
7. **G7 — Map/A3 economy hooks (not building walls now):** SYS10 oil-source topology & refinery mandate (W-rounds implemented pump/refinery behind `authorizedOilSource` contract — correct strictness, stays), SYS11 loot tier tables/respawn policies (toolbox/supply/military — A3 catalog + Map placement), SYS09 vehicle geometry & net-trip economics (Map), SYS16 geography resources (Map), SYS12/13 above. **Requests R3-M1…M6.**
8. **G8 — `b03-return`-class harness fragility.** Any test whose setup is aware of the world anchor but doesn't expose it is a false-pass risk. **Next executable scope N2**: grep for remaining `expect(...).not.toMatch` assertions that depend on harness-provided anchors without exposure (mechanical lint-like sweep, no game-code changes).

### 4.4 §— hidden-failure review (why NO engine change for the save-laundering class)
A `reserved:[legal stack]` forged into a station job on load passes `validate()` if keys/qty/UIDs are legal (multiset vs recipe is checked only for `oil_pump`/`refinery`/recycler-recovery paths). Two positions were considered:
- **Fix (strict reservation-vs-recipe binding for ALL stations):** rejected — it hardens one laundering vector a local editor bypasses trivially by editing `custody` directly; it does not close save editing (explicitly out of trust scope; Bible §8.3 E3 handles trust via backend). Changing load validation also risks rejecting legitimate historical jobs for zero player-value gain.
- **Chosen:** no engine change; document the boundary here (P2 lists "invalid state restoration" as an adversarial hunt target — this is a *restoration* class we're naming, not silently dropping). **Owner request R3-O3** (C21) is the actual trust answer.

### 4.5 P3 implemented changes this round
**None in game code.** Reasons: (a) no map-independent binding gap found that admits a lawful implementation without inventing semantics/balance (G1, G4 need creator input; G3/G8 are tests/docs work — recorded in next scope); (b) every mechanism gap of consequence is either Map-authoritative (G5–G7), owner-gated (G1, G4), already PARTIAL-with-evidence (W07–W09), or Atlas-proposal stratum (G6). Implementing standalone features now would violate the R3 discipline (connections-first; no standalone mechanics; no invented geography/IDs/balance).

## 5. Atlas roll-up (historical status; baseline `d73aa63`, no v11 CSV in checkout)

Per-SYS keyword tallies (MISSING/PARTIAL) — W00 snapshot, **not re-validated per row this round** (except where a W-round later re-opened the topic; those stay PARTIAL, never CLOSED):
SYS01 0/11 · SYS02 1/10 · SYS03 1/9 · SYS04 2/10 · SYS05 1/10 · SYS06 4/7 · SYS07 4/7 · SYS08 0/11 · SYS09 7/3 · SYS10 8/3 · SYS11 6/6 · SYS12 8/1 · SYS13 13/1 · SYS14 1/11 · SYS15 0/15 · SYS16 0/11 · SYS17 0/13 · SYS18 4/8.
W07/W07-R (twice-corrected offline power/turret accounting), W08/W08-R (combat-sound provenance classes closed at the validator), W09 (sound + build-time events) — all **PARTIAL by explicit ledger decision**; no XEDGE closed.
**Honest summary:** the runtime mechanics core SYS01/08/15/16/17 (tools, combat, survival, geography, run) is mostly PARTIAL-with-real-integration; the heaviest absences are SYS13 (Atlas-proposal spectrum), SYS12 (world event network), SYS10–11 (Map/A3 authority), SYS09 (geometry authority).

## 6. Map / owner dependencies (recorded, NOT blocking)
| ID | Dependency | Request precision | Owner |
| --- | --- | --- | --- |
| R3-M1 | Oil source geometry + authorization contract for `pump_crude` jobs | Specific tiles + source IDs + extraction radius + depletion semantics per source, in the FINAL map package | Map (A1) + A3 |
| R3-M2 | Evacuation beacon site(s) on FINAL map (currently one beacon on shipping) | Exact tile, co-presence radius, multiple non-Elder routes to it, POI↔beacon road cost budget | Map (A1) |
| R3-M3 | Final72 money CAS: ≥1 non-Elder physical route incl. POI exterior→deep access, gate stack (keycard/power/hazard), retreat | POI IDs, room layers, power source topology, loot deposit ledger IDs | Map + A8 + A3 |
| R3-M4 | Vehicle geometry + road/bridge/cargoPassable masks for the FINAL map | Lane width, bridge stress, parking footprints, per-vehicle collision contract | Map (A1) |
| R3-M5 | Safe-spawn selection proof (C24 multiple regions incl. elder-region edge cases) | SpawnEligible mask, validated region list, seeded-geographic-v1 contract preserved | Map (A1) |
| R3-M6 | Loot deposits + finite-source IDs for tiered loot (toolbox/supply/military) + respawn policy types | Per-site source IDs + stock + policy rows; A3 validates against economy | Map + A3 |
| R3-O1 | Creator decision: lock or amend C16 first-chest unsecured-purchase PROPOSED path (deadline: before any escrow tuning) | Bible §11.3 C16 row + §8.4 "ĐỀ XUẤT CẦN NGHIỆM THU" list | Creator |
| R3-O2 | Creator decision: offline-consequence model for homes (B13 dilemma) and offline turret truthfulness (W07-R standby power question) | Either accept current rule (offline parity online rule, turrets idle) as LAW or spec the offline pursuit path | Creator + Gameplay |
| R3-O3 | Ranking end-to-end: trusted backend for VERIFIED world results (receipts/replay validation) or drop to personal-only permanently | C21/E3; interim = LOCAL/UNVERIFIED label (already honoured) | Owner/Backend |
| R3-O4 | Frontend/A6: logout 24h forecast + tender state display (C09 row; purely UI over existing state machine) | Do NOT change mechanics; wire `tenderState()`/clock into exit UX | A6 (UX) |

## 7. Next executable scope
- **N1 (small, map-independent, additive):** C20 adversarial score-uniqueness test — drive deposit/evac/elder/stones in one run and across a crash window; assert per-`run_id` score credits cannot double-mint; if a gap is found, fix at the smallest layer (guard or receipt binding), never by weakening the test.
- **N2 (mechanical sweep):** harness-anchor exposure lint — locate `not.toMatch`/`toBeNull` assertions whose premises come from setup() anchors; convert to honest exposure or delete; no game-code behavior change.
- **N3 (after R3-O1/O2 land):** implement the offline-defense truth model (if approved) starting from W07-R's corrected accounting; re-audit B13 then.
- **N4 (Map-gated):** once R3-M1…M6 are answered, rerun the full C11/C13/C15/C22/C24 matrix against the FINAL map build; the matrix cells already name exactly what to re-verify.
- **N5 (R4):** creator triage of G6 Atlas strata (SYS12/13/18/14) — accept, reject, or re-scope into Bible § revision (Bible §8.5: only in-place edit, never a parallel file).

## 8. Deliverables cross-references
- Handoff: `docs/survival/MEC01_R3_HANDOFF.md` (exact SHA, logs, this matrix, next scope).
- P0 commit: `df11d2f`; P2 commit: `4cf69ce`; P3/P4 commit: this document batch.
- Logs: `/tmp/tsc-tests3.log` (typecheck:tests = 0), `/tmp/r3-p0-suite.log` (P0 re-run 722|1), `/tmp/r3-p2-suite.log` (full suite incl. new probes), `web/evidence/mec01-c2/delivery.json` (R2 C2 evidence, unchanged; still a temporary-world result).

**Final position:** the binding Bible network is mechanically present and custody-closed at the points the R3 probes attacked; the honest absences are backend ranking (by design), offline defense parity (owner decision), first-chest legality (creator decision), Map-authored topology/sources, and Atlas-proposal strata — none of which may be invented into existence by code this round.
