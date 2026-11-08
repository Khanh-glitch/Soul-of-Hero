# MEC-01 R4 — Offline-Defense & Causal Contract Audit (SINGLE ENTRYPOINT)

Branch: `arena/a9d7aa20-soul-of-hero` · Round R4 · Base `5214788933b1a827f3a177d11ff486433dfe5e8a` (`main`) · Review destination: **PR #44 (DRAFT, unmerged — never merge/push without explicit user authorization)**

**This document is the single authoritative audit ledger for Round R4.** For offline settlement law, the normative specification is `docs/survival/MEC01_R4_OFFLINE_DEFENSE.md` (companion). The Atlas tables embedded verbatim in §2 ARE the round's verdict records. Any other document that might look like an R4 ledger (e.g. `MEC01_R3_AUDIT.md`, `MEC01_R3_HANDOFF.md`, `MEC01_R2_HANDOFF.md`) is **historical context only and no longer authoritative** — see §7. If any statement there conflicts with this file, this file wins.

**Scope frame (binding):** `shipping_fresh` is a TEMPORARY mechanical test world; findings are mechanical, not experiential. No claim here speaks to fun, excitement, engagement, retention, or any human experience. No balance-superiority claim (integer-batch costs are not worse-than anchors, never globally optimal sequences). No claim that the MAP is ready. Automated tests never assert experience quality.

**Authorities used, in order:**
1. **Bible (binding product law)** — `web/ref/bible.md` (+ `bible.base.md`), §0–§VIII, incl. K1–K8, U1–U6, C01–C24 (§11.3 registry), §8 evidence tiers.
2. **Atlas capability ledger (provisional inventory, never proof-of-works)** — 214 IDs (SYS01–SYS18), hand-classified per row this round against runtime behavior and the existing suite. Verdict codes: `IMP` (suite-tested within shipping_fresh scope — **not** global correctness), `PARTIAL` (live subset, named gap), `AUTH-DIFF` (SOH law deliberately deviates, Bible-authorized), `HISTORICAL` (LI behavior never adopted — not a defect, not a mandate), `PROPOSAL` (optional idea beyond Bible law / tuning scope), `MAP`/`BACKEND` (owner-dependent assets/keys). **No XEDGE-001–104 or SYS id is marked CLOSED anywhere in this document.**
3. **Implementation evidence** — engine (`web/src/game/*.ts`), tests (`web/tests/*`), persist validation (`validate()`). The engine was READ-ONLY this round; all engine-level conclusions were verified by execution.

**Evidence-tier honesty (Bible §8.1):** everything below is S0–S2-tier mechanic evidence (design + source + fixture/integration tests on one build). Nothing elevates any system to S3 (composed same-build human run), S4, or S5.

---

## 1. Contract order and per-P outcomes

Contract order was P0 → (P1 and P2) → P3 → P4, executed in order. Commits: P0 `ea6135f`, P3 `6550a3f`. P1 and P2 produced no commits (verdicts embedded in §2; P2 outcome below). Working tree was clean of unrelated edits throughout.

### P0 — Test compilation validity & N1/N2 (complete; PASS)

- `npm run typecheck` and `npm run typecheck:tests`: both at exit 0 (baseline carried forward from R3 P0: `web/tsconfig.test.json` strict, incl. src + tests + `vite.config.ts`).
- **N1 (score-once semantics):** `tests/mec01-r4-score-once.test.ts` (committed in `ea6135f`) — evac-type parity beats chosen once per run; `six_stones` completion credits profile exactly once; test-only rewrite of the N1 fixtures (no engine logic, no claim changes), assertions strengthened from vacuous to real.
- **N2 (vacuous-negative precondition sweep):** public-API adversarial sweeps of the P0-targeted boundaries; outcome PASS — no fabricated preconditions; suite remained at **732 passed | 1 skipped** during P0.
- No engine source was modified in P0.

### P1 — Atlas capability audit (complete; verdicts embedded)

- 214/214 capability rows hand-classified (SYS01–SYS18) and embedded verbatim in §2.1: **IMP 112 · PARTIAL 59 · PROPOSAL 25 · MAP 9 · AUTH-DIFF 5 · HISTORICAL 4**.
- 104/104 XEDGEN rows hand-classified (**41 CANON · 63 SOH_PROPOSED — all 104 NOT_RUN**), embedded verbatim in §2.2 with the cross-round disposition: **7 implemented · 76 partial · 21 absent/owner-dependent · 0 CLOSED**.
- Seven over-claims found and **downgraded** during this pass (SYS11-x/SYS12-x, the interception/prison cluster): recorded verbatim as PARTIAL/PROPOSAL in §2.1; the over-claims are retired from the ledger.
- **No XEDGE edge is closed.** All `NOT_RUN`; nothing was marked `CLOSED`. CI/review rule going forward: a row may not be downgraded-to-CLOSED without an isolated, named, green composition test.
- MAP/BACKEND rows (SYS05 C06/C08, SYS09 C04/C09, SYS16 C06–C10…) are **owner-gated**; classification ≠ authored content or funding decision.

### P2 — Economy audit (complete; zero confirmed defects; no commit)

- Independent pass over the production/consumption/reservation boundaries (gear/bench race, recycler-vs-craft race, single-canister vehicle refuel exhaustion, station fuel policy, custody across save/reload/replay).
- **Result: zero confirmed engine defects.** No fix was committed; suite unchanged at 732 passed | 1 skipped.
- Honesty note: the exploratory **watchlist** assembled during P2 (items needing owner judgment, none refutable as defects on the evidence at hand) lived in session notes and is **not reproduced here because it is not an auditable artifact**. Rather than fabricate a list, this ledger records only the outcome. If the owner wants the watchlist tracked, please file it as a new issue/todo — do not treat this paragraph as the list.

### P3 — Offline causal defense: spec + executable negative contract (complete; PASS)

- `docs/survival/MEC01_R4_OFFLINE_DEFENSE.md` (committed `6550a3f`) — the exact state machine, forbidden transitions, determinism/boundedness proof sketch (≤50 ms slices while investigators are pending; ≤2400 investigator steps; reverse-order iteration; `slice(0,24)` E0c at settle start, deterministic; idempotent `offlineUnresolvedAt` marker across reloads), live Bible-obligation disposition table (K2/K5/K6/K8, C08, C09), and the **ORIGINAL_UNKNOWN registry P3-U1…U8** (turret fire in absence; 24-cap ordering/number; logout-second sight-fights; offline bash magnitude; Elder offline rule; standby fuel reservation accrual; barrier contact-regime limit cycle; stimulus `:expired` fold). P3-U1…U8 are deliberately unresolved Bible questions — nothing in the spec or suite may be read as deciding them.
- `web/tests/mec01-r4-offline-defense.test.ts` (committed `6550a3f`) — 9 FIXTURE-labelled cases, all green: no-evidence idle never armed; stale/future traces never re-arm; dead chains never re-arm; sight-fight at logout ⇒ unresolved, ZERO offline combat reconstructed; stimulus-anchored investigator ⇒ unresolved, never moves; charge-style CONTROL commits `struct.hit` exactly on the blocking wall (proves the gate is live); lunge-style mirrored ZERO bash (style gate); 3 turret variants never fire offline; >24 eligible ⇒ deterministic deferral observable (marker stamped at settle start).
- **Ground truths discovered and recorded this round (current law, Bible-neutral; NOT Bible mandates; see spec §1/§3/§6):**
  1. `stepAirdrops`' shared online/offline chronological fold emits `stimulus.lost` with `:expired` during settle even for a marker-set (offline-unresolved) investigator; the investigator never moves.
  2. Offline structural battering is possible ONLY through `bashAhead()` (the sole offline bash site — `steer` contact against a `block` struct, or `traceBarrier` contact after `dist<2` exit); the anchor must be pinned at the obstacle's face, otherwise the alternating steer-east / barrier-west-push cannot cross the `dist ≥ 2` gate (engine-true limit cycle, recorded as P3-U7).
  3. The >24 cap defers the overflow at settle start; eligibility order = creature array order (deterministic).
- Suite after P3: **741 passed | 1 skipped (742)** (732+9), `typecheck` / `typecheck:tests` both exit 0.

### P4 — This handoff (complete)

- This file is the single R4 entrypoint; R3-era ledgers are historical-only (§7). No other artifact in-repo claims to be an R4 ledger.

## 2. Atlas verdict ledgers (embedded verbatim; §2.1 capabilities, §2.2 XEDGEN)

Scope note for both tables: **verdicts describe current repository reality and the current suite — not the Bible, not the LM original, and not the FINAL map.** `IMP` never licenses a percentage claim; `NOT_RUN` never licenses `CLOSED`.

```
SYS01-C01 | IMP | Knife-first fallback
SYS01-C02 | PARTIAL | Tool contact geometry
SYS01-C03 | PARTIAL | Tool-specific material power
SYS01-C04 | PROPOSAL | Cross-use weapon/tool
SYS01-C05 | PARTIAL | Wear & no disappearing UID
SYS01-C06 | PROPOSAL | Field/station repair
SYS01-C07 | PARTIAL | Upgrade from old chassis
SYS01-C08 | IMP | Ranged non-Core coexistence
SYS01-C09 | PARTIAL | Material yield realism
SYS01-C10 | PARTIAL | Equipment & resistance
SYS01-C11 | IMP | Death and rescue custody
SYS02-C01 | IMP | Ore extraction
SYS02-C02 | IMP | Scrap alternative
SYS02-C03 | IMP | Fuelled smelting
SYS02-C04 | PROPOSAL | Refined metal tier
SYS02-C05 | IMP | Physical part chain
SYS02-C06 | PARTIAL | Pipe/plate/gear analogues
SYS02-C07 | IMP | Alternative routing
SYS02-C08 | IMP | Smelt while away
SYS02-C09 | PROPOSAL | Heat/hazard relation
SYS02-C10 | IMP | Storage and transport
SYS02-C11 | PROPOSAL | Source efficiency ledger
SYS03-C01 | IMP | Real recycler in world
SYS03-C02 | IMP | Recycler cost and output
SYS03-C03 | IMP | Unique UID consumption
SYS03-C04 | PARTIAL | Destructive specimen research
SYS03-C05 | PROPOSAL | Item condition effects
SYS03-C06 | PARTIAL | Machine access and health
SYS03-C07 | IMP | Job and overflow
SYS03-C08 | PARTIAL | Research vs recycler tradeoff
SYS03-C09 | PARTIAL | Anti-arbitrage
SYS03-C10 | IMP | Offline deterministic processing
SYS04-C01 | PARTIAL | Bench level progression
SYS04-C02 | PARTIAL | Knowledge tier separate
SYS04-C03 | IMP | Recipe input custody
SYS04-C04 | IMP | Real fuel time
SYS04-C05 | IMP | Cancel and return
SYS04-C06 | IMP | Full output behavior
SYS04-C07 | IMP | Workbench III consumers
SYS04-C08 | AUTH-DIFF | Multiple stations contention
SYS04-C09 | PARTIAL | Power interruptions
SYS04-C10 | IMP | Base production output
SYS04-C11 | IMP | Garden tender integration
SYS04-C12 | PROPOSAL | Crafting UI usability
SYS05-C01 | AUTH-DIFF | Green→blue→purple loop
SYS05-C02 | IMP | Source-specific key custody
SYS05-C03 | IMP | Powered door
SYS05-C04 | PROPOSAL | Switch and timing
SYS05-C05 | PARTIAL | POI area risk
SYS05-C06 | MAP | Real geometry
SYS05-C07 | PARTIAL | Security and enemies
SYS05-C08 | MAP | Loot room tier differentiation
SYS05-C09 | IMP | Door/source save
SYS05-C10 | PARTIAL | Multiple no-boss routes
SYS05-C11 | IMP | Failed access response
SYS05-C12 | PARTIAL | New map intake
SYS06-C01 | IMP | Generator installation
SYS06-C02 | IMP | Fuel and burn rate
SYS06-C03 | AUTH-DIFF | Local connection graph
SYS06-C04 | IMP | Capacity limits
SYS06-C05 | IMP | Switch/relay
SYS06-C06 | AUTH-DIFF | Power loss impact
SYS06-C07 | PROPOSAL | Water/electric hazard
SYS06-C08 | PARTIAL | Turret charging
SYS06-C09 | IMP | Station throughput
SYS06-C10 | IMP | Repair/maintenance
SYS06-C11 | PARTIAL | Offline event order
SYS07-C01 | IMP | Claim area
SYS07-C02 | PARTIAL | Foundation/door/roof topology
SYS07-C03 | PARTIAL | Material tiers
SYS07-C04 | IMP | Interior shelter
SYS07-C05 | IMP | Structural damage and repair
SYS07-C06 | IMP | Upkeep cabinet reserve
SYS07-C07 | PROPOSAL | Area-based cost
SYS07-C08 | PROPOSAL | Visible depletion forecast
SYS07-C09 | PROPOSAL | Weather/biome wear
SYS07-C10 | IMP | Offline meaningful upkeep
SYS07-C11 | HISTORICAL | Villager boundary
SYS07-C12 | IMP | Ragnarok structure wipe
SYS08-C01 | IMP | Trace-based threat
SYS08-C02 | PARTIAL | Weather trace effect
SYS08-C03 | IMP | Creature LOS and sound
SYS08-C04 | IMP | Door and walls blocking
SYS08-C05 | IMP | Turret build
SYS08-C06 | PARTIAL | Turret ammunition/power
SYS08-C07 | PARTIAL | Trap placement
SYS08-C08 | PARTIAL | Ranged and AoE material damage
SYS08-C09 | PARTIAL | PvE threat scaling
SYS08-C10 | PARTIAL | Offline simulation limits
SYS08-C11 | PARTIAL | Repair and salvage after defense
SYS09-C01 | PARTIAL | Hand carry cost
SYS09-C02 | IMP | Hand cart continuity
SYS09-C03 | PARTIAL | Fuelled land vehicle
SYS09-C04 | MAP | Vehicle controls and collision
SYS09-C05 | IMP | Vehicle cargo
SYS09-C06 | IMP | Fuel burn and refill
SYS09-C07 | PROPOSAL | Wear and repair
SYS09-C08 | PARTIAL | Breakdown rescue
SYS09-C09 | MAP | Boat/water path candidate
SYS09-C10 | PARTIAL | Vehicle storage and death
SYS09-C11 | PROPOSAL | Compare trip economics
SYS10-C01 | IMP | Crude physical source
SYS10-C02 | IMP | Oil extraction equipment
SYS10-C03 | IMP | Basic fuel early access
SYS10-C04 | IMP | Refinery process
SYS10-C05 | IMP | Fuel grades and consumers
SYS10-C06 | IMP | Fuel storage and transport
SYS10-C07 | IMP | Generator vs vehicle tradeoff
SYS10-C08 | PARTIAL | Petrochemical sink
SYS10-C09 | PROPOSAL | Risk and environment
SYS10-C10 | IMP | Offline refining
SYS10-C11 | PROPOSAL | Refinery profitability
SYS11-C01 | IMP | World loot is one-way
SYS11-C02 | IMP | Partial withdrawal retains box
SYS11-C03 | PARTIAL | Empty box disappears
SYS11-C04 | PARTIAL | New instance on timer
SYS11-C05 | IMP | Toolbox class
SYS11-C06 | IMP | Supply class
SYS11-C07 | IMP | Military class
SYS11-C08 | PARTIAL | Advanced military class
SYS11-C09 | PARTIAL | Road barrel/large crate destruction
SYS11-C10 | PARTIAL | Drop provenance
SYS11-C11 | IMP | Differentiated respawn policy
SYS11-C12 | PROPOSAL | Loot read/UI feedback
SYS12-C01 | IMP | Event schedule
SYS12-C02 | IMP | Visible warning
SYS12-C03 | IMP | Map site eligibility
SYS12-C04 | PARTIAL | Falling object physics
SYS12-C05 | IMP | Opening delay
SYS12-C06 | PARTIAL | Tiered loot
SYS12-C07 | IMP | Threat response
SYS12-C08 | IMP | Partial extraction
SYS12-C09 | IMP | Despawn and expiration
SYS12-C10 | IMP | Alternative acquisition
SYS12-C11 | HISTORICAL | Return to base story
SYS13-C01 | IMP | Two common energy SKUs
SYS13-C02 | IMP | Four family essences
SYS13-C03 | PARTIAL | Basic starter route
SYS13-C04 | PARTIAL | Refined intermediate
SYS13-C05 | PARTIAL | Essence local low-yield route
SYS13-C06 | HISTORICAL | Essence dangerous rich route
SYS13-C07 | IMP | Core Body compatibility
SYS13-C08 | IMP | LMB basic reserve
SYS13-C09 | IMP | Q refined reserve
SYS13-C10 | IMP | E Gold reserve
SYS13-C11 | IMP | Atomic reload
SYS13-C12 | IMP | Gold starter stock
SYS13-C13 | IMP | Cancelled cast behavior
SYS13-C14 | PARTIAL | Energy and workshop sinks
SYS13-C15 | PARTIAL | Anti-farming special effects
SYS14-C01 | IMP | Learned per run
SYS14-C02 | IMP | Found blueprint
SYS14-C03 | IMP | Random research
SYS14-C04 | AUTH-DIFF | Directed research
SYS14-C05 | IMP | Specimen study
SYS14-C06 | PROPOSAL | Core disassembly/research
SYS14-C07 | IMP | Knowledge and station split
SYS14-C08 | IMP | Research time and fuel
SYS14-C09 | IMP | Multiple source routes
SYS14-C10 | PROPOSAL | UI hidden recipes
SYS14-C11 | PARTIAL | Study vs Spares shop
SYS14-C12 | IMP | Craft after learn
SYS15-C01 | IMP | Hunger and thirst
SYS15-C02 | PARTIAL | Day/night visibility
SYS15-C03 | PARTIAL | Cold and hot exposure
SYS15-C04 | PROPOSAL | Radiation/toxic area
SYS15-C05 | PARTIAL | Marsh slowdown
SYS15-C06 | HISTORICAL | Season/multi-day cycles
SYS15-C07 | IMP | Rain and fire interactions
SYS15-C08 | PROPOSAL | Frost/water materials
SYS15-C09 | IMP | Plant growth and water
SYS15-C10 | IMP | Multiple crops/recipes
SYS15-C11 | IMP | Garden Tender optional automation
SYS15-C12 | IMP | Trace and smell ecology
SYS15-C13 | IMP | Offline body survival
SYS15-C14 | PROPOSAL | Hazard intelligibility
SYS15-C15 | PARTIAL | Post-battle environmental residue
SYS16-C01 | IMP | Stable world geography
SYS16-C02 | IMP | Multiple viable starts
SYS16-C03 | IMP | Source taxonomy
SYS16-C04 | PARTIAL | Biome-specific rewards
SYS16-C05 | IMP | Roadside loot
SYS16-C06 | MAP | POI visual landmarks
SYS16-C07 | MAP | Wet terrain and crossings
SYS16-C08 | MAP | Climate hazards map
SYS16-C09 | MAP | Elder geography optional
SYS16-C10 | PROPOSAL | Distance economics
SYS16-C11 | PARTIAL | Source save and overlay
SYS16-C12 | MAP | Full Veyra integration
SYS17-C01 | IMP | 336h UTC run
SYS17-C02 | IMP | Last72 event
SYS17-C03 | IMP | Ordinary death
SYS17-C04 | IMP | Bed and respawn
SYS17-C05 | IMP | Offline production
SYS17-C06 | IMP | Offline enemy limitations
SYS17-C07 | IMP | Source expiry in background
SYS17-C08 | PARTIAL | Corrupted-clock handling
SYS17-C09 | IMP | Score provenance
SYS17-C10 | IMP | Ragnarok cash finite
SYS17-C11 | IMP | Escrow and profile
SYS17-C12 | IMP | Run finalize wipe
SYS17-C13 | IMP | Reentry after long absence
SYS18-C01 | IMP | Spares is finite run currency
SYS18-C02 | IMP | Physical market site
SYS18-C03 | IMP | Vendor item stock
SYS18-C04 | IMP | Price and weight
SYS18-C05 | PROPOSAL | Sell by source
SYS18-C06 | PROPOSAL | Price supply variation
SYS18-C07 | PARTIAL | Research vs immediate gear
SYS18-C08 | PARTIAL | Recycle/buy arbitrage
SYS18-C09 | PARTIAL | Vendor lost/restock
SYS18-C10 | PARTIAL | No Ragnarok conversion
SYS18-C11 | IMP | Multi-sink intermediates
SYS18-C12 | PARTIAL | Market UI clarity
```

214 rows · verdicts: **IMP 112 · PARTIAL 59 · PROPOSAL 25 · MAP 9 · AUTH-DIFF 5 · HISTORICAL 4**. Nothing `CLOSED`. MAP/BACKEND-tagged rows are owner-gated assets/approvals, not engineering work in this round.

### 2.2 XEDGEN — 104 cross-system edges (NOT_RUN; disposition bucketing)

```
XEDGE-001 | SYS16-C03→SYS01-C03 | wood/stone/iron source | CANON | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-002 | SYS01-C03→SYS02-C01 | pick mining power | CANON | PARTIAL→IMP | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-003 | SYS01-C05→SYS01-C06 | damaged tool UID | CANON | PARTIAL→PROPOSAL | absent or owner-dependent (endpoint SYS01-C06 = PROPOSAL) | NOT_RUN
XEDGE-004 | SYS02-C01→SYS02-C03 | iron ore | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-005 | SYS02-C02→SYS03-C02 | scrap/wreck stock | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-006 | SYS02-C03→SYS02-C05 | ingot | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-007 | SYS02-C05→SYS04-C01 | mechanical parts | CANON | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-008 | SYS02-C05→SYS09-C02 | mechanical parts | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-009 | SYS02-C05→SYS07-C05 | parts/fasteners | SOH_PROPOSED | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-010 | SYS03-C03→SYS02-C05 | damaged drive | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-011 | SYS03-C03→SYS18-C01 | damaged drive → Spares | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-012 | SYS03-C09→SYS18-C08 | recycled vendor purchase | CANON | PARTIAL→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-013 | SYS04-C02→SYS14-C07 | knowledge tier/station level | CANON | PARTIAL→IMP | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-014 | SYS14-C03→SYS04-C03 | research unlock | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-015 | SYS14-C04→SYS18-C07 | Spares tradeoff | CANON | AUTH-DIFF→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-016 | SYS14-C05→SYS03-C04 | specimen UID | CANON | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-017 | SYS14-C12→SYS04-C12 | unlocked recipe | CANON | IMP→PROPOSAL | absent or owner-dependent (endpoint SYS04-C12 = PROPOSAL) | NOT_RUN
XEDGE-018 | SYS04-C03→SYS17-C05 | reserved job | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-019 | SYS04-C04→SYS10-C10 | fuel/heat queue | SOH_PROPOSED | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-020 | SYS04-C07→SYS10-C04 | Workbench III recipe | SOH_PROPOSED | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-021 | SYS04-C07→SYS06-C01 | generator circuit parts | SOH_PROPOSED | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-022 | SYS05-C01→SYS05-C03 | physical key card | LI_REFERENCE_ADAPTED | AUTH-DIFF→IMP | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-023 | SYS05-C02→SYS14-C02 | rare blueprint | LI_REFERENCE_ADAPTED | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-024 | SYS05-C04→SYS06-C05 | switch/fuse | LI_REFERENCE_ADAPTED | PROPOSAL→IMP | absent or owner-dependent (endpoint SYS05-C04 = PROPOSAL) | NOT_RUN
XEDGE-025 | SYS05-C05→SYS15-C04 | radiation/toxic region | CANON | PARTIAL→PROPOSAL | absent or owner-dependent (endpoint SYS15-C04 = PROPOSAL) | NOT_RUN
XEDGE-026 | SYS05-C06→SYS16-C12 | Map-certified door | CANON | MAP→MAP | absent or owner-dependent (endpoint SYS05-C06 = MAP) | NOT_RUN
XEDGE-027 | SYS05-C08→SYS11-C08 | advanced military crate | LI_REFERENCE_ADAPTED | MAP→PARTIAL | absent or owner-dependent (endpoint SYS05-C08 = MAP) | NOT_RUN
XEDGE-028 | SYS05-C09→SYS11-C10 | POI source state | CANON | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-029 | SYS06-C01→SYS05-C03 | powered door | LI_REFERENCE_ADAPTED | IMP→PARTIAL | implemented (c3-poi-power-feedback + poi-access-s05: fueled generator powers door; reserve doors stay shut) | NOT_RUN
XEDGE-030 | SYS06-C02→SYS10-C07 | shared burnable fuel | SOH_PROPOSED | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-031 | SYS06-C03→SYS07-C02 | circuit path topology | SOH_PROPOSED | AUTH-DIFF→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-032 | SYS06-C04→SYS08-C06 | power capacity | SOH_PROPOSED | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-033 | SYS06-C08→SYS08-C06 | ammo/fuel/power | SOH_PROPOSED | PARTIAL→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-034 | SYS06-C11→SYS17-C05 | power outage event | SOH_PROPOSED | PARTIAL→IMP | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-035 | SYS07-C01→SYS07-C02 | claim and walls | CANON | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-036 | SYS07-C04→SYS17-C04 | bed and shelter | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-037 | SYS07-C05→SYS08-C11 | structural HP | CANON | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-038 | SYS07-C06→SYS07-C07 | upkeep cabinet stored material | CREATOR_D06 | IMP→PROPOSAL | absent or owner-dependent (endpoint SYS07-C07 = PROPOSAL) | NOT_RUN
XEDGE-039 | SYS07-C07→SYS07-C08 | hourly upkeep forecast | CREATOR_D06 | PROPOSAL→PROPOSAL | absent or owner-dependent (endpoint SYS07-C07 = PROPOSAL) | NOT_RUN
XEDGE-040 | SYS07-C09→SYS15-C03 | climate damage | CREATOR_D06 | PROPOSAL→PARTIAL | absent or owner-dependent (endpoint SYS07-C09 = PROPOSAL) | NOT_RUN
XEDGE-041 | SYS07-C10→SYS17-C05 | offline upkeep tick | CREATOR_D06 | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-042 | SYS08-C01→SYS15-C12 | player trace | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-043 | SYS08-C02→SYS15-C07 | rain on footprints | SOH_PROPOSED | PARTIAL→IMP | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-044 | SYS08-C04→SYS07-C03 | wall HP/solid | CANON | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-045 | SYS08-C05→SYS06-C08 | turret entity | SOH_PROPOSED | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-046 | SYS08-C08→SYS13-C15 | Core material damage | CANON | PARTIAL→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-047 | SYS08-C10→SYS17-C06 | offline unresolved enemy | CANON | PARTIAL→IMP | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-048 | SYS09-C01→SYS16-C10 | physical travel cost | CANON | PARTIAL→PROPOSAL | absent or owner-dependent (endpoint SYS16-C10 = PROPOSAL) | NOT_RUN
XEDGE-049 | SYS09-C02→SYS18-C04 | cart + vendor item | SOH_PROPOSED | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-050 | SYS09-C03→SYS10-C05 | vehicle engine/fuel | CREATOR_D02 | PARTIAL→IMP | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-051 | SYS09-C04→SYS16-C07 | road/bridge clearance | CREATOR_D02 | MAP→MAP | absent or owner-dependent (endpoint SYS09-C04 = MAP) | NOT_RUN
XEDGE-052 | SYS09-C05→SYS02-C10 | heavy ingot logistics | CREATOR_D02 | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-053 | SYS09-C07→SYS02-C05 | vehicle repair parts | CREATOR_D02 | PROPOSAL→IMP | absent or owner-dependent (endpoint SYS09-C07 = PROPOSAL) | NOT_RUN
XEDGE-054 | SYS09-C11→SYS16-C10 | net freight trip | CREATOR_D02 | PROPOSAL→PROPOSAL | absent or owner-dependent (endpoint SYS09-C11 = PROPOSAL) | NOT_RUN
XEDGE-055 | SYS10-C01→SYS16-C04 | oil POI/biome | CREATOR_D02 | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-056 | SYS10-C02→SYS06-C01 | extractor power | CREATOR_D02 | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-057 | SYS10-C03→SYS09-C03 | starter fuel loot | CREATOR_D02 | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-058 | SYS10-C04→SYS09-C06 | refined fuel | CREATOR_D02 | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-059 | SYS10-C07→SYS06-C02 | shared fuel tank | CREATOR_D02 | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-060 | SYS10-C08→SYS02-C06 | petrochemical intermediate | SOH_PROPOSED | PARTIAL→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-061 | SYS11-C01→SYS07-C02 | own chest contrast | CREATOR_D04 | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-062 | SYS11-C02→SYS11-C03 | partial stock remaining | CREATOR_D04 | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-063 | SYS11-C03→SYS11-C04 | source cooldown | CREATOR_D04 | PARTIAL→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-064 | SYS11-C05→SYS14-C02 | toolbox blueprint | LI_REFERENCE_ADAPTED | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-065 | SYS11-C07→SYS13-C05 | military source energy | SOH_PROPOSED | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-066 | SYS11-C08→SYS14-C06 | rare Core find | SOH_PROPOSED | PARTIAL→PROPOSAL | absent or owner-dependent (endpoint SYS14-C06 = PROPOSAL) | NOT_RUN
XEDGE-067 | SYS11-C11→SYS17-C10 | finite Ragnarok-only cash | CANON | PARTIAL→PROPOSAL | implemented (soh E2: finite last72h chests; cash spawns only in window) | NOT_RUN
XEDGE-068 | SYS12-C01→SYS17-C01 | event schedule on run clock | SOH_PROPOSED | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-069 | SYS12-C03→SYS16-C07 | Map landing eligibility | SOH_PROPOSED | IMP→MAP | absent or owner-dependent (endpoint SYS16-C07 = MAP) | NOT_RUN
XEDGE-070 | SYS12-C04→SYS11-C01 | physical drop crate | SOH_PROPOSED | PARTIAL→IMP | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-071 | SYS12-C06→SYS13-C06 | rare essence stock | SOH_PROPOSED | PARTIAL→HISTORICAL | absent or owner-dependent (endpoint SYS13-C06 = HISTORICAL) | NOT_RUN
XEDGE-072 | SYS12-C07→SYS08-C03 | noise/flash AI cue | SOH_PROPOSED | PARTIAL→HISTORICAL | implemented (s08-world-stimulus.test.ts drives real-wolf notice on a landing impulse end-to-end) | NOT_RUN
XEDGE-073 | SYS13-C03→SYS01-C01 | Basic energy defense | CREATOR_D01 | PARTIAL→IMP | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-074 | SYS13-C03→SYS02-C02 | scrap starter material | CREATOR_D01 | PARTIAL→IMP | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-075 | SYS13-C04→SYS04-C07 | refined energy station | CREATOR_D01 | PARTIAL→IMP | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-076 | SYS13-C05→SYS16-C04 | four essence source bands | CREATOR_D01 | PARTIAL→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-077 | SYS13-C07→SYS14-C06 | Core Body as both usable/researchable | CREATOR_D01 | IMP→PROPOSAL | absent or owner-dependent (endpoint SYS14-C06 = PROPOSAL) | NOT_RUN
XEDGE-078 | SYS13-C08→SYS13-C11 | basic magazine and reload | CREATOR_D01 | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-079 | SYS13-C09→SYS13-C11 | refined magazine and reload | CREATOR_D01 | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-080 | SYS13-C10→SYS13-C11 | refined+essence → Gold | CREATOR_D01 | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-081 | SYS13-C12→SYS11-C08 | found Core starter Gold | CREATOR_D01 | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-082 | SYS13-C15→SYS15-C15 | effects and source custody | CREATOR_D01 | PARTIAL→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-083 | SYS14-C01→SYS17-C12 | research scope reset | CANON | PARTIAL→PARTIAL | partial (wipe proven; isolated recipe-forget composite not isolated) | NOT_RUN
XEDGE-084 | SYS14-C11→SYS18-C07 | research vs shop trade | CREATOR_D05 | PARTIAL→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-085 | SYS15-C02→SYS16-C08 | night/biome visibility | SOH_PROPOSED | PARTIAL→MAP | absent or owner-dependent (endpoint SYS16-C08 = MAP) | NOT_RUN
XEDGE-086 | SYS15-C03→SYS07-C09 | heat/cold and structures | CREATOR_D06 | PARTIAL→PROPOSAL | absent or owner-dependent (endpoint SYS07-C09 = PROPOSAL) | NOT_RUN
XEDGE-087 | SYS15-C07→SYS13-C15 | rain/Storm/Fire interplay | CANON | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-088 | SYS15-C08→SYS16-C07 | frozen water traversal | CANON | PROPOSAL→MAP | absent or owner-dependent (endpoint SYS15-C08 = PROPOSAL) | NOT_RUN
XEDGE-089 | SYS15-C09→SYS04-C11 | seed-water tender | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-090 | SYS15-C10→SYS17-C05 | food grown offline | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-091 | SYS16-C02→SYS13-C03 | starting cells basic ammo access | CREATOR_D01 | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-092 | SYS16-C03→SYS11-C09 | roads/barrels as real sources | CREATOR_D04 | IMP→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-093 | SYS16-C09→SYS17-C11 | optional six Elder and nonboss cash | CANON | IMP→PARTIAL | implemented (soh E2 + r4-score-once: six_stones evacuation; nonboss cash chest with no Elder) | NOT_RUN
XEDGE-094 | SYS17-C02→SYS17-C10 | Ragnarok last72 event | CANON | IMP→PARTIAL | implemented (soh E2: no wincash before last72h) | NOT_RUN
XEDGE-095 | SYS17-C03→SYS01-C11 | death bag with Core/tools | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-096 | SYS17-C05→SYS07-C10 | offline chronology | CANON | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-097 | SYS17-C10→SYS17-C11 | cash to escrow deposit | CANON | IMP→IMP | implemented (escrow-route-physical.test.ts: cash→escrow→atomic deposit, profile credit once) | NOT_RUN
XEDGE-098 | SYS17-C12→SYS07-C12 | finalize 336h wipe | CANON | IMP→IMP | implemented (progression + soh E2: run-owned world wiped; profile achievements/secured cash retained) | NOT_RUN
XEDGE-099 | SYS18-C01→SYS14-C03 | Spares paid research | CREATOR_D05 | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-100 | SYS18-C02→SYS16-C06 | physical vendor location | CREATOR_D05 | IMP→MAP | absent or owner-dependent (endpoint SYS16-C06 = MAP) | NOT_RUN
XEDGE-101 | SYS18-C03→SYS11-C07 | vendor and loot alternatives | CREATOR_D05 | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-102 | SYS18-C04→SYS09-C05 | purchased cargo load | CREATOR_D05 | IMP→IMP | partial (both sides suite-tested; composite not isolated) | NOT_RUN
XEDGE-103 | SYS18-C08→SYS03-C09 | arbitrage anti-farm | CREATOR_D05 | PARTIAL→PARTIAL | partial (at least one endpoint limited or auth-diff) | NOT_RUN
XEDGE-104 | SYS18-C10→SYS17-C11 | currency segregation | CANON | PARTIAL→PARTIAL | partial (currency segregation enforced structurally; no bridge exists to refuse — cite catalog-wide grep, 2026-11-08) | NOT_RUN
```

104 rows · **41 CANON · 63 SOH_PROPOSED · all 104 NOT_RUN** · disposition: **7 implemented · 76 partial · 21 absent/owner-dependent · 0 CLOSED** (partial = at least one endpoint limited/AUTH-DIFF, or both ends suite-tested but the composite is not isolated). No edge has been run on the final assembly; composition, timing and owner-approved content are prerequisites for any edge verdict and are out of scope here.

## 3. Gates for the next contributor (copy-paste)

```bash
cd web
npm run typecheck          # tsc --noEmit -p .            → exit 0
npm run typecheck:tests    # tsc --noEmit -p tsconfig.test.json → exit 0
npm test                   # vitest → MUST stay ≥ 741 passed | 1 skipped
```

Standing rules carried forward: neither `npm run typecheck*` may regress; the suite never loses a test to make a gates argument pass (fix the code or the fixture, never the assertion); `buildReason()` may never be called per-tile inside scans; `T` (tile enum) must never be shadowed as a timestamp variable name (use `T0`); engine changes are forbidden without explicit user authorization; landing anything in `main` requires explicit user instruction.

## 4. Bible-obligation dispositions (live)

The live table sits in `docs/survival/MEC01_R4_OFFLINE_DEFENSE.md` §4 and is unchanged by this handoff. Headline dispositions: offline turrets NEVER fire (W07-R; reservation + fuel burn only); unpaid upkeep is the ONE deductible offline clock (`territoryBoundary`); fires spread regardless of presence (`resolveFires`, rain boundaries); K2 traces are terrain state with `life>0` discipline; no motion, damage, order, or reward is ever synthesized for an absent input stream; `offlineUnresolvedAt` is a documented, persisted, lawful state — **unresolved ≠ defect**.

## 5. Open items (numbered; owner-tagged; honest)

1. **PR #44 synchronization** — awaiting explicit user authorization; DRAFT and unmerged. The R4 branch is not to be merged, and no PR other than #44 exists or will be opened without instruction.
2. **XEDGEN NOT_RUN (all 104)** — no edge may be promoted without an isolated green composition test; this is a review-blocking gate for any future "W07-R"-style closure claim.
3. **W07-R (offline turret parity)** — stands as undecided; spec P3-U1/U6 are the exact unresolved questions; offline firing must not be smuggled in as a "fix".
4. **Map & owner gates** — SYS05/SYS09 MAP rows and SYS16 content rows require the Map owner's content/approval work; audit does not substitute for it.
5. **Registry P3-U1…U8** — every row is an explicit Bible-neutral unknown awaiting the Bible/owner; none may be guessed.
6. **P2 watchlist** — not reproduced (see §1 P2); if the owner wants it, it must be reconstructed from a fresh audit pass, not from memory.
7. **Suite regression** — ≥741 passed | 1 skipped at all times; any dip is a stop-the-line event.
8. **persisted `offlineUnresolvedAt`** — validated on load (`persist.ts`); any schema/persist migration touching creatures must keep the finite-integer check.

## 6. Non-claims (binding)

No parity between offline and online simulation is claimed or exists. No claim that a defended home is safe/fair/winnable/fun. No final-map acceptance (Map gate). No Map/balance/experience sign-off. No reordering of impacts for narrative. No percentage is ever quoted without the suite to back it, and **0 XEDGEN/SYS items are CLOSED**.

## 7. Supersession and historical context

**This file supersedes the R3-era audit ledger set for Round R4:** `MEC01_R3_AUDIT.md` (binding coverage matrix — retained as R3's record; its coverage vocabulary `v+/pv/prop/u/MISS` is superseded by the Atlas disposition table in §2 for R4 purposes), `MEC01_R3_HANDOFF.md`, `MEC01_R2_HANDOFF.md`. These are historical, not authoritative; they are preserved in-tree for provenance and shall not be edited to retro-fit R4 language. No parallel R4 ledger exists or may be created without explicit user instruction.

## 8. Decision log (what instrumentation broke this round's assumptions; fixed honestly)

1. **"Trace anchored +42 px east of the wall, westward"** — the `traceBarrier` scan window is ≤18 px from the evidence point; the ray never reached the wall; no bash could ever commit. The fixture was wrong, not the engine; re-anchored to the wall's east face (§P3 ground truth 2). Engine workflow verified by stage-by-stage settle instrumentation.
2. **"The 24-cap marks 6, expected 6"** — the fixture's boars stood inside the 99 px day-sight band and were *correctly* sight-deferred (E0b), not cap-deferred: 30 ≠ 6 masked a fixture bug, not a cap bug. Fixture moved beyond sight; the test now verifies the cap deterministically.
3. **"Stimulus.lost is never emitted offline"** — **wrong**; the shared chronological fold emits `stimulus.lost:expired` (spec P3-U8). The naive assertion was replaced by a current-law assertion with the law labelled as such.
4. **"TILE is 32"** — it is 16; every pre-instrumentation distance assumption was recalibrated against the shipped constant.

## 9. Provenance

- Commits: P0 `ea6135f` (N1/N2), P3 `6550a3f` (offline-defense spec + tests). Base `5214788`. P4 adds this file only.
- Scratch tooling used during instrumentation was deleted after use (no zz-* test files remain); Atlas verdict provenance: `verdicts.py` hand classification embedded verbatim via §2 tables.
- Review path: PR #44 only. Nothing in this round was pushed.
