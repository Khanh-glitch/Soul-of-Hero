# MEC-01 R4 / P3 — Offline Causal Defense: exact state-transition specification

Branch: `arena/a9d7aa20-soul-of-hero` · Round R4 P3 · Companion to `docs/survival/MEC01_R4_AUDIT.md` (single entry) · Bible law: K2 (traces are real terrain state), K5 (creature perception/path), K6 (structures, turret), K8 (offline clock), C08 (footprint → local lawful encounter, never home-GPS), C09 (unpaid upkeep, weather, real attack, real stock).

**Scope honesty (binding):**
- This document specifies **offline settlement only**. Online full actor simulation is unchanged.
- This is **NOT** a parity proof. It is an exact description of the intended and current lawful layer, plus executable negative tests proving the *absence* of fabricated outcomes, plus an explicit registry of combat-policy choices that are **deliberately unresolved** and are NOT to be guessed by anyone implementing from this file.
- **No detection or damage is invented here.** Every number referenced comes from shipped constants (BAL.*, CREATURES.*, DEF.*) at the named file/line; everything else stays `ORIGINAL_UNKNOWN`.
- No claim is made about human experience, difficulty, fairness, or final-map balance. `shipping_fresh` is a temporary mechanical world.

---

## 1. The only lawful offline path (existing code anchors, 2026-11-08)

| Stage | Mechanism | Anchor |
| --- | --- | --- |
| E0 Eligibility gate | `r.creatures.filter(m => m.offlineUnresolvedAt === undefined && !m.elder && ['idle','wander','track','chase'].includes(m.state) && (!m.knows \|\| m.knows.kind === 'trace') && (m.knows?.kind === 'trace' \|\| !!encounteredTrace(r, m, start)))` | `sim.ts:1080` |
| E0b Deferral sweep | Creatures knowing `sight`/`stimulus`, in `tell/attack/recover` complying states, or with knockback present ⇒ `m.offlineUnresolvedAt = start` (NOT simulated) | `sim.ts:1078–1081` |
| E0c Cap | eligible.slice(0, 24) walk; indices 24+ ⇒ `offlineUnresolvedAt = start` | `sim.ts:1082–1083` |
| E1 Trace discovery | `encounteredTrace(r, m, now)`: trace with `life > 0`, `tr.t <= now`, not in `m.traceIgnore`, within `BAL.ai.traceSenseRadius`, with `los()` line-of-sight → knowledge granted (aggro required to act) | `sim.ts:555` |
| E2 Traversal | `trackEvidence(gs, m, speed*k, dt, now)`: re-verify trace validity each step; `dist ≥ 7` ⇒ `steer(...)`; else `nextContiguousTrace()` chain selection within sense radius + LoS; else arrival bookkeeping → `barrier` resolution | `sim.ts:535` |
| E3 Depletion | Trace gone (`life<=0` or world-side expired) ⇒ clear `m.knows`, back to `wander`, receipt-free approach to `traceIgnore` marker | `sim.ts:537` |
| E4 Lawful encounter | `bashAhead()` is the ONLY offline bash site. Two lawful invocation paths, both audited: (a) `steer()` returns contact (`moveBody→hit` against a `block` structure) ⇒ bash commits at the ahead tile; (b) `traceBarrier()` (charge-style only, ray from the evidence point ≤18px, `entsAt` struct with `STRUCTS.block`, within ≤26px of the marker, `clearPhysicalLine(m→point, excludeEnd=true)`) ⇒ `moveBody` into the block; blocked ⇒ `bashAhead()` deals `CREATURES[m.type].dmg` per 900ms cooldown to the blocking structure ONLY | `sim.ts:484` (`bashAhead`), `sim.ts:528` (`traceBarrier`), `sim.ts:535–553` (`trackEvidence`), `sim.ts:470–476` (`steer`), `sim.ts:51–57` (`moveBody`) |
| E5 Offline bound | `pending.length && frames < 2400`; when `frames === 2400` ⇒ all remaining `pending` get `offlineUnresolvedAt = until`; each iteration re-evaluates dtMs in ≤50ms slices | `sim.ts:1101`, `sim.ts:1156–1165` |
| E6 Turret law | Turrets NEVER fire offline. Only a standby reservation report + fuel burn while armed/offlimits load still accrues. No projectile is created, aimed, or spent | `sim.ts:1094`, `sim.ts:1190`, `engine.ts:507–515` |
| E7 Impact reporting | Only structures with `owner === undefined \|\| 'player'` populate `impacts` (name, before, after, destroyed) — impacts report physical damage actually committed to state | `sim.ts:1084`, `bashAhead`/`triggerSpikes`/`triggerBearTrap` |
| E8 Traps | Spikes function on actual contact; Bear traps are **live-only** (`m.state==='dead'\|\|m.state==='sleep'` and `offlineImpacts` short-circuit) — trap commits are online-only | `sim.ts:499` (`triggerBearTrap`: `if (offlineImpacts \|\| ...) return`) |

**Terminal markers.** `m.offlineUnresolvedAt` is the only offline-unresolved marker; its meaning: the encounter is pending player attention — it was NOT simulated, resolved, rewarded or punished. It persists across save/reload and is validated by `persist.ts` (finite-integer check on `m.offlineUnresolvedAt`). Current-law detail, recorded for auditors: markers written by the E0b/E0c sweeps carry `start`, while survivors of the 2400-investigator-step bound carry `until` at the bound slice (an observable but meaningless-looking value ≈ `start + 120 s`); neither regime ever grants an outcome.

---

## 2. State machine (exactly these transitions; nothing else is lawful offline)

```
                         knowledge ∈ {$sight, stimulus} ∪ state ∈ {tell,attack,recover} ∪ knockback≠0
                                       │
              eligible pool ────────────┤   (E0b — no playback, marker set)
              (E0, ≤24 — E0c)          ▼
            ┌──────────────┐     ┌────────────────────┐
            │   DORMANT    │     │   UNRESOLVED (E0b)   │  marker: offlineUnresolvedAt=start
            └──────┬───────┘     └────────────────────┘
                   │ fresh trace in sense radius + LoS (encounteredTrace)
                   ▼
            ┌──────────────┐   evidence vanished   ┌────────────┐
            │  TRACKING    │──────────────────────▶│  WANDER    │
            │ (knows:trace)│                       │ (memory set)│
            └──────┬───────┘                       └────────────┘
                   │ arrives (dist<7) / re-senses chain
                   ▼
            ┌──────────────┐   charge-style + wall block ≤26px + LoS   ┌────────────────────┐
            │  BARRIER     │──────────────────────────────────────────▶│  ENCOUNTER         │
            │  (E4)        │                                          │  bashAhead cycles │
            └──────────────┘                                          └────────────────────┘
                   │                                                     structures lose HP
                   │ no barrier / no evidence / chain depleted          / impacts appended /
                   ▼                                                     destroyed → destroyStructure()
            mark unresolved or back to wander      (offline bound 2400 frames ⇒ UNRESOLVED, E5)
```

Forbidden transitions (no code path may introduce them without Bible decision):
1. DORMANT/WANDER → target player home by coordinates, proximity-to-bed, or "nearest claim cabinet" (location-based raid). **Never.**
2. Any creature kind (lunge/tongue/shoot/pinch/burrow/calm) except charge-style may bash structures offline. **Enforced** by `traceBarrier()` + `bashAhead()` style gates.
3. Non-trace knowledge (sight/stimulus) may be reconstructed into partial playback offline. **Forbidden** (E0b).
4. Turret may fire, despawn, or spend arrows offline. **Forbidden** (E6).
5. Any effect which requires the absent input stream (player aim, skill aim, Gold cast timing) may be simulated. **Forbidden** (E0b, E5).

---

## 3. Determinism & bounds (what the machine guarantees)

- **Bounded work:** the offline playback advances the world clock in slices ≤60 000 ms (50 ms while any investigator is pending) — at most 2400 investigator steps are committed; beyond that, survivors are marked unresolved and receive no outcome.
- **Fixed-order iteration:** pending investigators are iterated in reverse array order (`length-1 … 0`); creatures beyond 24 are deferred **at settle start** deterministically (array order = creature id order — deterministic across reloads).
- **No randomness in the playback path:** `traceOnly` consumes no RNG stream. Advancement depends only on persisted state (creature position/state/knowledge, trace chain, static geometry/doors, weather at slice boundary).
- **Idempotence by marker:** once `offlineUnresolvedAt` is set, later settles never pick the creature up again (E0 eligibility requires the marker to be `undefined`). No time-travel leakage, no double application of the 2400 budget.
- **Perception can return you:** if the player were visible during playback (never happens for the stationary body — the body is always in place; LoS/darkness/shelter logic could make the player visible mid-slice), playback aborts with marker set and NO combat is reconstructed.
- **Anchor placement decides survivability of an unfinished encounter (current-law observation, ORIGINAL_UNKNOWN whether intentional).** With a distant anchor the alternating `steer-east` / `barrier-west-push` cannot cross the `dist ≥ 2` gate: the creature oscillates at epithelial distance from its terminal footprint and never commits a bash — permanently, even over a 1 h settle. An anchor pinned at the obstacle's face (within ~2 px of its approach) exits to `traceBarrier()`; successive blocked westward pushes against the wall surface trigger `bashAhead()` contact. No law in K1–K8/C01–C24 pins either regime; both behaviors above are **ground truth of the current code**, documented here and covered by the suite, NOT a Bible mandate. See registry §6 P3-U7.
## 4. Disposition of existing Bible-law obligations (live table)

| Bible obligation | Status in law today | Anchor (code/test or registry §6) |
| --- | --- | --- |
| Creature may find home only via genuinely perceived trace | IMPLEMENTED & TESTED (online + offline paths share `encounteredTrace`); fresh-case negatives added this round | `sim.ts:555`; `mec01-r4-offline-defense.test.ts` (this round); `b2-perception.test.ts` |
| No location-based / random raid | Enforced by E0 eligibility + trace-approach + no coordinate indexing anywhere in playback; negative tests asserting zero home-proximate damage absent evidence | `mec01-r4-offline-defense.test.ts` cases 1–3, 6 |
| Physical obstacles determine consequences | `traceBarrier` checks real collision blocks (grid + `entsAt` + LOS); door left open is NOT a block | `sim.ts:520`; test case 8 |
| Ammunition determines turret consequences | Turret needs armed + powered (allocation) + arrows in its C-container + cooldown; firing happens online only; offline parity NOT PROVEN | `engine.ts:507`; §6 P3-U1 |
| Energy determines turret consequences | Same — power allocation is a fuel-consuming reservation; firing offline would consume untracked arrows; W07-R stands | `engine.ts:507–515`; `industrial-power.test.ts` |
| HP determines consequences | bash damage = `CREATURES[type].dmg`; destroyed structure handled via `destroyStructure()` (contents spill to bag); no silent deletion | `bashAhead`, `destroyStructure` |
| No fabricated kills/orders while player is away | `offlineUnresolvedAt` marker; cap 24; combat paths all defer by law; trap/bear-trap inert while offline | `sim.ts:486–499, 1090, 1163`; test case 4–5 |
| Unpaid upkeep is the ONE deductible clock | `territoryBoundary` integrated in the same solve; collapse with audit report; cabinet stock physically debited | `territory-cabinet`, `territoryBoundary` |
| Fires spread independent of player presence | `resolveFires` from material state; rain boundaries end diffusion slices | `resolveFires`; `b2-chronology`, `b03-return` |
| Sector expiry (336h) ends the run identically online or offline | `endRun(gs, 'expired', expiry)` on the same expiry timestamp; evacuation-type parity not claimed | `sim.ts:endRun`; `soh` E2 expiry test |

---

## 5. Executable negative test suite (this round)

`web/tests/mec01-r4-offline-defense.test.ts` — FIXTURE labels in every case (guardianship: no shipping_fresh content was edited; all placements are constructed fixtures).

| # | Case | What it proves (and what it explicitly cannot prove) |
| --- | --- | --- |
| 1 | Idle boar & wolf, no traces anywhere → settle 3h | No structure damage, no `struct.hit`, no movement, no unresolved marker for idle creatures (DORMANT never self-arms). Cannot prove "well-defended home" — only that unrecorded evidence never summons a raid. |
| 2 | Same, with all traces pre-decayed (`life=0`) + rain-cleared traces | Stale evidence never re-arms; discovery requires strictly `life > 0` at the slice. |
| 3 | Full-length trail chain with the player TRUE but all traces dead, then settle | No chain continuation after depletion; the wolf never arrives; nothing is committed to structures. |
| 4 | Wolf (style `lunge`, aggro) with sight knowledge + state `chase` at settle start | `offlineUnresolvedAt` set; NO offline combat is reconstructed; wall untouched; spike/projectile laws unchanged. |
| 5 | Stimulus-anchored investigator at settle start | `offlineUnresolvedAt` set; creature never moves; the investigation NEVER completes. BUT: the world-level stimulus expiry fold (`stepAirdrops`) is the shared online/offline chronological authority and DOES emit `stimulus.lost` with `:expired` during the settle, clearing the anchor knowledge — current law, Bible-neutral, NOT a reconstruction of the investigation. See registry §6 P3-U8. |
| 6 | Charge-style boar + provoked + fresh chain pinned at the wall's face | **POSITIVE CONTROL** paired with case 7: the creature exits the `dist ≥ 2` approach-drift into barrier contact; successive blocked pushes commit `bashAhead()`; `struct.hit` is emitted with the wall's id and the creature's type in the detail, HP is physically debited; positive proves the gate is live, not vacuous. |
| 7 | Wolf (lunge) in the same geometry with the same functioning trace | **Zero** `struct.hit` receipts; `bashAhead` style gate holds; non-charge predators cannot batter walls offline. |
| 8 | Unpowered / disarmed / empty-arrow turret ×3 | Zero `turret.fire` receipts; arrow stock unchanged; no "free defence" produced during absence. |
| 9 | More than 24 trace-eligible creatures seeded at settle start | At most 24 enter playback; remainder are marked unresolved at settle start — the compute bound is observable, deterministic, and order-stable. |

---

## 6. Registry of deliberately unresolved combat-policy choices (NOT to be guessed)

| Id | Choice | Current behavior | Bible law bearing | Required owner |
| --- | --- | --- | --- | --- |
| P3-U1 | Turret fire during absence | Forbidden (W07-R); reserved+fuelburn only | C09 (real armed defence) — but offline firing reconstructs aim from absent input stream; silently picking fire-timing would fabricate | Creator (W07-R disposition) |
| P3-U2 | Eligibility cap 24 — the ordering and the cap number | `slice(0,24)` in entity order | None (engineering bound, documented here); changing it is a balance/UX decision | Creator + QA |
| P3-U3 | Whether LAST-OUTSTANDING sight-fight at exact logout second deserves 0/1/several online-consistent hits | Strictly marked unresolved; ZERO offline damage | C08/C09 don't forbid the design; they forbid fabrication — "1 free hit" is also a policy | Creator |
| P3-U4 | Bash damage magnitude offline vs online | Online melee uses attack profile & knockback & cooldown; offline bash uses `CREATURES[style=charge].dmg` flat with 900ms cd | K5/C09: law counts HP deltas committed physically; the offline magnitude is a simplification only valid for display of the wall's HP trajectory | Creator (or mark permanently as approximate, documented) |
| P3-U5 | Elder offline behavior | Elders excluded from eligibility (E0); sight-fight deferral marks; otherwise inert | K5 (Elder Law: six encounters, lawful anchors); Bible provides no offline rule for Elder | Creator |
| P3-U6 | Whether turret fuel reservation should ACCRUE permanently while away while upgrade/retire happens mid-absence (intersection of power allocation and inventories) | Current behavior: standby reservation burned at departure evaluation only; `powerAllocation` silently capped by remaining fuel | C07/C09 no contradiction; the reservation's exact interplay with out-of-fuel branches is **undefined in Bible** | Creator |
| P3-U7 | Barrier-contact regime vs distant-anchor alternating limit cycle — whether an unfinished barrier encounter can be REGENERATED or MUST stall forever at epithelial distance | Distant anchor ⇒ permanent oscillation, zero offense, no unresolved marker of the limit cycle itself; face-pinned anchor ⇒ contact + bash | K1–K8/C01–C24 silent; the Bible demands what happens to a BASTIONIZED home under charge, not HOW MANY frames it takes to register. The current lawful layer satisfies K2/K6 while this regime is undecided | Creator |
| P3-U8 | Whether `stepAirdrops' chronological expiry fold` should clear stimulus knowledge of an offline-unresolved investigator — and emit `stimulus.lost:expired` — mid-absence | Always folded during settle; investigator never moves; marker retained; the expiry receipt is written | K2/K5 demand decay and honest expiry records online; Bible says nothing about WHEN the fold may happen while the investigator is unresolved. Current behavior is deterministic and honest (it records physical reality of time passing), but it is NOT a Bible mandate | Creator |

**Anything not listed above and not in K1–K8/C01–C24 is out of scope and shall not be added.**

## 7. What this analysis does NOT claim

- NO parity between offline settlement and online actor simulation (none exists and none is claimed).
- NO claim that a defended home is safe, fair, fun, or winnable — this document is not experiential.
- NO claim of final-map acceptance of any kind (Map owner's gate, see R4 audit §dependencies).
- NO claim that unresolved events are errors; **unresolved is a documented, persisted, lawful state.**
- NO reordering of offline impacts to suit a narrative — impacts report physical truth or they do not exist.
- NO claim that any Bible-undetermined scenario here was decided; §6 registers every open policy choice — nothing in this file or its suite may be read as resolving them.
