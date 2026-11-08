# MEC-01 R5 — Offline Defence Consequence: a player action creates a world that survives the night

Branch: `arena/a9d7aa20-soul-of-hero` · Round R5 · Companion to `docs/survival/MEC01_R4_OFFLINE_DEFENSE.md` (unchanged historical record) and `MEC01_R4_AUDIT.md` · Bible law: **K2** (footprints are terrain state), **K5** (creature perception & path), **K6** (structures, turret, power), **K8** (offline chronological clock), **C08** (trail-driven local lawful encounter — never home-GPS), **C09** (unpaid upkeep, weather, real attack, real stock).

**Scope honesty (binding):**
- This document is an engineering record of the **R5 mandated law change**: an armed, supplied, wired turret whose online-lawful target lawful target exists NOW fires during offline settlement. Before R5, offline turrets never fired (R4 E6, W07-R). R5 implements exactly the online law offline — no separate damage table, no probability, no spawning, no omniscience.
- `shipping_fresh` remains a temporary mechanical world; no final-map/economy/balance/experience claims. No Map/VFX/economy assets were touched; zero map-content edits.
- No claim of human enjoyment, difficulty, or fairness. Claims here are limited to **deterministic simulation semantics on the shipping engine**, demonstrated by the suite.
- Numbers not derivable from shipped constants are `ORIGINAL_UNKNOWN`. The two R4-era assertions that pinned the retired law are updated and listed (§3.3, §7) — nothing else was edited to make a gate pass.
- PR **#44 remains the sole review path** and is NOT touched by R5 (open, DRAFT, head stays `arena/d4bfcfff-soul-of-hero`).

---

## 1. Executive summary

Before R5, a returning player found an **already-battered home with no one to blame and no defence that answered**: the trail-driven boar could batter a wall via a base `traceBarrier` window of 18 px — a distance the market placement can make unsatisfiable — and then, if the player had built and fueled a turret, *nothing*. The offline world simulated pursuit and bashing but never fired a weapon. R5 closes that loop **through the online rules only**: a trail emitted by real player movement is discoverable offline by the shipped trace-search law (night aggro for boars; a damaged boar carries `prov`), leads the boar to the blocking structure, converts committed structure damage into `prov` (hostility toward the home), and — only then — makes the boar a lawful turret target under the identical range/LOS/cooldown/ammo law as live play. The turret spends real arrows. The generator burns real fuel (offline reservation from R4/W07 is unchanged). A destroyed structure is destroyed exactly once; a surviving one persists with its debited HP and can be repaired with real materials. Time-partitioned settlement and save→reload settlement reproduce identical outcomes (≤1e-6 HP noise from slice boundaries); replay with the same endpoint is a no-op.

**One coherent network, delivered as one mandate:** trail → pursuit → lawful contact (bash) → hostility flag → funded response (turret) → consequence that survives restart. It is a **conditional network, not a raid event**: whether any encounter occurs at all depends on a trail actually existing and being fresh enough to live.

---

## 2. Before / after — the mission TARGET matrix

| # | Mission TARGET (R5 contract) | Before R5 | After R5 (shipping engine @ `ce73f17`) |
|---|---|---|---|
| 1 | Real footprint trail ⇒ lawful pursuit | Partial — discovery existed; approach could live-lock ~182 px/frame oscillation (barrier scan ≤18 px found nothing; `dist≥2` steer loop ping-pong) | **Works** — barrier scan bounded at 4 tiles (64 px), terminal-bash branch resolved **before** the wobble steer; NATURAL tests show a trail laid by real movement being discovered and followed |
| 2 | Discovered trail + blocking wall ⇒ actual `bashAhead` | Broken at the limit cycle (never committed) | **Works** — NATURAL test: door HP 140 → destroyed exactly once; ≥3 `struct.hit` receipts (`…:boar:…`) |
| 3 | Powered+supplied turret, lawful target ⇒ real projectile, impact, ammo+power cost | **Forbidden by law** (R4 E6 W07-R) | **Works** — NATURAL test: `turret.fire` ≥3, arrows debited 1:1 with fire receipts, boar dies through the identical online law offline |
| 4 | Missing prerequisite ⇒ NO shot | N/A (no offline shots existed) | **Works** — 4 negative controls: unpowered / arrowless / sight-blocked by a wall / out of the 96 px engagement circle — all leave the turret silent, arrows unspent |
| 5 | Repeat settle/reload ⇒ no dup damage/ammo/death | N/A | **Works** — partition determinism, mid-absence save→validate→reload→settle equivalence (≤1e-6), replay-no-op idempotence |
| 6 | No-trail safety | Preserved | **Preserved and tested** — true negative: zero traces ⇒ zero discovery, zero bash, zero fire; boar unmoved |
| 7 | Lost/expired trail dead-ends | Ambiguous (pre-R4 decay existed; approach unproven) | **Works** — rain control (1000 s of footprint life drained): pursuit never starts; the shipped trace-life law (R4 §3.4) still governs |
| 8 | §3 limits respected — conditional, NOT mandatory raid | Yes | **Yes** — no spawn, no probability, no visit/η event; encounter only via existing trail+aggro laws; nothing is guaranteed to the player and nothing is guaranteed to the beast |

Every "works" above is an isolated green named test (§6). No experience, Map, balance or economy claim is made.

---

## 3. Law changes delivered this round (exact)

### 3.1 Engine (`web/src/game/sim.ts`, all online-identical semantics)

1. **`traceBarrier` scan window 18 px → 64 px** (`sim.ts:521`). A footprint's direction may lead to a physically adjacent blocking structure. The old 18-px ray almost never resolved a natural foot-to-wall gap; the bounded 4-tile scan finds the first blocking cell along the evidence ray. Deterministic, allocation-free, unchanged semantics for hits inside the old window.
2. **`trackEvidence` terminal branch reordered** (`sim.ts:538`). The `traceBarrier` check is now evaluated **before** the `dist ≥ 2` wobble steer. If a barrier is found, the creature faces it and steps forward; `moveBody` contact commits `bashAhead`. The old order let the creature oscillate forever at epithelial distance from its terminal footprint.
3. **`bashAhead` now marks `prov`** (`sim.ts:484`). Committing structure damage is hostility toward the home — deliberately symmetrical with the existing `damageCreature → prov` eligibility source, which turrets consume. This makes an actual, committed, physical bash the *event* that legitimizes household defense. **R5 law, documented as intentional.** Online turrets are affected identically (they now also fire at batterers). This is not an isolated question; it is the design law the mission asked for.
4. **`turretTargets` / `turretContactWindow`** (`sim.ts:781` / `sim.ts:785`) — one targeting law, copied nowhere. `tickTurrets` (`sim.ts:~789`) delegates to `turretTargets`; the offline defense-contact window drives the same functions.
5. **Offline defense-contact window in `settle()`** (`sim.ts:1108`, `1129`, `1175`): while a player-from projectile is in flight or a Ready+supplied turret can legally see a target, settlement slices drop to 50 ms (capped at 14,400 defense frames **per absence window, persisted in `clock.defenseFrames` across time partitions and reloads — §16**) and call `tickTurrets` + `tickProj` with the same dtMs — identical range/LOS/cooldown/arrow-cost semantics as online. Outside the window, slices decrement `turret.cooldown` by the full (≤60 s) slice — identical accounting, no double count.
6. **`traceOnly` knockback integration** (`sim.ts:600`): a knockback impulse is an impulse, not a state — it is now integrated (`moveBody`) and decayed (0.82/tick) exactly as live play does. **Bug fixed: before R5, any projectile impact made the creature permanently offline-unresolved (`|kbx|+|kby|>1` forever — nothing decayed it offline).** This is the only R5 change that repairs a *crash-of-progress* class defect in the offline path itself.
7. **`settle()` return report** (`sim.ts:1226`): the "you were away" summary now states the true law (an armed, supplied, wired turret engages lawful targets offline — same sight, range, cooldown, arrow cost), replacing the false "turrets do not fire while away" sentence.

### 3.2 Player-facing copy (`web/src/ui/panels.tsx:165`)

The turret panel no longer claims "Turrets never fire while you are away". It now states the offline law (reservation kept; lawful targets engaged; same sight/range/cooldown/ammunition). **UI text only — no rules, no art, no VFX.**

### 3.3 Law supersessions (R4-era assertions updated — the two and only)

| File:line | Retired assertion (R4, W07-R era) | New assertion (R5 law) |
|---|---|---|
| `tests/w07-power-offline-parity.test.ts:72` | return report claims "turrets do not fire while away" | report states engagement of lawful targets; behavioural no-fire check (no lawful target ⇒ zero `turret.fire`) kept verbatim |
| `tests/k6-power.test.ts` (`offline burns only finite fuel…`) | "never invents a shot, kill or ammo spend" (0 arrows spent) | with a lawful, in-range Wolf: ≥1 `turret.fire`, arrows debited exactly `4 − fires`, fuel burned to 0, Wolf damaged — under the identical online law |

No other assertion was edited. The offline **no-fire-without-a-lawful-target** negative contract remains fully intact in both files and in R5's controls.

---

## 4. The lawful offline path, now (R4 table, amended — everything else still binding)

E0–E5, E7, E8 are **unchanged** from `MEC01_R4_OFFLINE_DEFENSE.md` §1 (≤24 pending; 2400 investigator steps; sight/stimulus/tell-recover are never reconstructed; tractility/lock-out laws; ±24 cap; marker discipline across saves). Only E4/E6 changed:

| Stage | Before R5 | After R5 |
|---|---|---|
| E4 Lawful encounter | barrier ≤18 px; bash reached only from pinned anchor | barrier ≤64 px; barrier branch precedes wobble steer; bash contact commits; committed bash sets `prov` |
| E6 Turret law | NEVER fires offline; standby report + fuel burn only | Fires offline **iff** the exact online predicate holds: enabled + generator-type `base_generator` owned + connected + `hasPowerFuel` + allocation includes turret + arrows ≥1 + LOS-clear lawful target in range (60/72/96 px fog/storm/clear) + cooldown elapsed + muzzle cell free. 1 arrow & 16 dmg per shot, `cooldown` 1000 ms. Reserved fuel burns identically online and offline |
| E0b knockback | `|kbx|+|kby|>1` ⇒ marker (freeze forever) | integrated + decayed like live play (0.82/tick); no longer an E0b producer |
| E5 defense window | (no such window) | ≤50 ms slices while `PROJ(from==='player')` in flight or `turretContactWindow(r, t)` true; cap 14,400 frames **per absence window, persisted in `clock.defenseFrames`** (validate accepts integer 0–14,400, fail-closed); beyond the cap the world continues in coarse slices with cooldown swept in bulk — one authority, no freeze, no double count |

### 4.1 State machine delta

```
TRACKING ──dist<7 / re-sense──▶ (barrier found ≤64 px?) ──yes──▶ ENCOUNTER (bash cycles, 13 dmg / 900 ms cd)
        │                                                          │
        │ no barrier                                                ▼
        ▼                                                  bash commits → m.prov = true
   back to wander / chain depleted                                │
                                                                  ▼
                                                armed+supplied+wired turret + LOS + range + cd ready?
                                                                  │ yes
                                                                  ▼
                                              tickTurrets → tickProj (16 dmg) → killCreature
                                              (drops on the ground, +2 combat skill — the online law, verbatim)
```
Forbidden transitions are **unchanged** (no GPS raid, no reconstructed player-combat, no offline raid events, no spawns). R5 adds exactly one edge to the law: **committed bash → prov → turret engagement may terminate the encounter**. Anything else (sight-known fights, Ragnarok cascades, elder mechanics) remains explicitly unresolved offline.

---

## 5. Determinism & bounds — what the machine guarantees now

- **Bounded work:** ≤2400 investigator steps (50 ms each) **plus** ≤14,400 defense-contact frames (50 ms each) **per absence window** — the budget is persisted in `clock.defenseFrames`, shared across time partitions and reloads of the same absence, and reset only by online presence (`tick()`). Worst-case added offline work ≈ 12 minutes of fine simulation per absence, only while something is actually being defended — then the bound hard-closes and coarse time resumes.
- **No randomness in the playback path** — unchanged. The turret path consumes no RNG except what the online law consumes at identical timestamps (kill-time drop rolls, as online).
- **Order:** same pending reverse-iteration order; defense contact evaluated per slice, before the 60 s coarse slice.
- **Idempotence:** marker discipline unchanged; `settle()` replay at the same endpoint is a strict no-op (asserted). Reload mid-absence resumes at the persisted `clock.lastSimAt` and reproduces outcomes ≤1e-6 HP (float slice-boundary noise only — asserted equal at 1e-6).
- **Integrity across save/reload:** `serializeSnapshot` → `selectSnapshots` → `validate` round-trip asserted on the R5 scenario (fails closed with "Refusing to save invalid game state" if anything goes stale — this caught two fixture-legality defects during development, see §8 decision log).

---

## 6. Scenarios proven (test map, all at `web/tests/mec01-r5-offline-defense.test.ts`, SHA `ce73f17`)

| Label | Test (verbatim name) | Proves |
|---|---|---|
| NATURAL | real footsteps emit a connected trail into the homestead — before any settlement | Real `tick`+`right:true` movement on shipping_fresh, collision-resolved, snow-surface chain (11 traces, connected `prevId`), no fixtures |
| NATURAL | a trail discovered after logout leads the boar back home: it tracks the path and batters the door | Zero knowledge injected; night (t=0.8) boar aggro discovers via `encounteredTrace`; door damaged/destroyed exactly once; ≥3 bash receipts; boar advanced; player unharmed (offline never fabricates melee) |
| NATURAL | powered, supplied, wired turret fires during settlement — real arrows, real order: bash (prov) precedes fire | Causal ORDER enforced: first `struct.hit:door` index < first `turret.fire` index; arrows debited exactly `8 − fires`; ≥3 fires; boar dead; door survives (home defended) |
| NATURAL | the same lawful outcome offline and live-online | Same player actions, same seed, same world: live `tick` vs `settle`. (Wander-law paths diverge pre-discovery by design — asserted: bash in both, prov-before-fire in both, arrows 1:1 in both) |
| CONTROL | armed and supplied but UNPOWERED — never fires | prerequisite: fuel ⇒ no shot; door falls (lawful), exactly once |
| CONTROL | armed and powered but ARROWLESS — never fires | prerequisite: ammunition ⇒ no shot |
| CONTROL | armed, powered, supplied but SIGHT-BLOCKED | LOS is law; a wall denies the shot; pursuit/bash unaffected |
| CONTROL | armed, powered, supplied but OUT OF RANGE | 96 px engagement circle is law; beyond it, silence |
| CONTROL | no trail anywhere (true negative) | zero traces ⇒ zero discovery, zero bash, zero fire, boar unmoved |
| CONTROL | the trail is rained away before logout | lost/expired scent dead-ends; 1000 s of rain-drained footprint life |
| INTEGRITY | a single 6-minute settlement equals two 3-minute settlements | partition determinism (≤1e-6) |
| INTEGRITY | save → reload mid-absence → resume settles to the identical outcome | no double damage, no double ammo, no double death (≤1e-6) |
| INTEGRITY | settle() replayed with the same endpoint is a no-op | replay idempotence |
| AFTERMATH | the battered door can be repaired with real materials, debited once | `repairStructure` online law restores `ceil(maxHp/4)`; cost from `structureRepairCost`; receipt `structure.repair` |
| AFTERMATH | destroyed wreckage is accounted exactly once — repair refuses a vanished structure; second settle credits nothing new | destroy-once; no phantom resurrection; no re-credit on replay |

**Fixture vs NATURAL discipline.** Every NATURAL case seeds the world ONLY by: starting a run, clearing creatures, overriding a patch of terrain to snow/grass (same class of move as R4's `placeAtBuildablePatch`), placing the homestead/turret structures directly, and — critically — **spawning the boar with no knowledge at all** (its eyes come from the shipped laws). Structures and positions are placement-only fixtures; knowledge injection is never used. The rain control uses R4's accepted `decayTraces` idiom. FULL independence from Lua/GDScript: nothing here reads Godot state.

**Live-build note.** A real-browser pass of the build was not possible in this sandbox (Playwright's CDN is unreachable from the network allowlist; no system browser exists). `scripts/e2e-r5.mjs` encodes the full live sequence (real movement → Escape → Save & quit to title → reload → Continue) for any browser-enabled machine; it was not run here and no claim about it is made. The current build is served for human play at the attached live preview (`vite preview --host 0.0.0.0 --port 4173`), and the identical engine paths are exercised through the shipped Continue → `settleWithReturn` code by the suite above.

---

## 7. Known consequences & intentional law changes (numbered, explicit)

1. **R5 law: bash ⇒ prov.** Any committed structure damage by a creature (charge-style trackers / elders) now marks `prov=true`, online and offline. Online turrets therefore also fire at batterers — intended symmetry, not a regression. Suites covering this (R4 offline-defense PASS unchanged).
2. **Two R4-era assertions superseded** (§3.3): k6-power offline-no-fire and w07 parity report string. Documented here; both files retain the no-lawful-target negative contract.
3. **Turret kill = online-identical rewards**: `skills.combat += 2` and physical ground drops (meat/hide/boar tusk) — accepted as the identical online law, NOT new economy (killCreature untouched).
4. **Fuel reservation semantics unchanged** (R4/W07): armed+supplied turrets already reserved and burned capacity/fuel offline; only the *firing* is new. An enabled-but-targetless turret still burns idle fuel exactly as before; disarming frees capacity.
5. **In-flight projectiles at save boundaries** persist via existing `r.combat.projectiles` round-trip (`persist.ts`). If a projectile is mid-flight at the exact moment of the save, it resumes after reload exactly as the online law resumes it — no duplicated arrows (asserted by INTEGRITY partition/reload tests), no re-fire cooldown teleport.
6. **Knockback now decays offline** (bug fixed, §3.1.6): behavior change limited to the physics mirror of live play; previously affected creatures merely resumed tracking — no balance implication.
7. **The away-report and turret panel text changed** (§3.2) — any external document quoting the old "turrets never fire" sentence (including archived audits) is superseded here for the turret-law question only. The R4 claim "TRACE-grounded safety = no encounters at all" was already removed by R4 (trace pursuit is lawful); R5 removes the turret half.
8. **`traceBarrier` 64-px window** may return a barrier across a gap where the old 18 px window returned none; only blocks charge-bash targets, only against `block` structures without open doors — attack surface unchanged.
9. **Rain is still faster on Floor/Bridge (2×) and traces on grass die in ~3 minutes** — long absences with no trail still produce nothing (verified); snow gives 15 minutes — the lawful window for a real walk home followed by some minutes away.
10. **The 2400-step bound is unchanged**: a long siege can still legitimately end with the boar unresolved (trail followed, knocked-back) rather than resolved. Unresolved ≠ defect (R4 law, retained).

---

## 8. Decision log (what instrumentation broke this round's assumptions)

1. **"The boar discovers the trail at noon."** Wrong — `CREATURES.boar.aggro=false`; at darkness ≤0.45 a noon boar never hunts. Fixed by the shipped night law (in-run midnight, `qaOffset=12 min` ⇒ t=0.8 ⇒ darkness ≈0.76), NOT by injecting prov on the test boar. Learned `dayLengthMinutes` is 24 in-run minutes, not hours.
2. **"Refusing to save invalid game state"** in the reload proof — two fixture-legality defects: (a) `arrow_turret`/`base_generator` ammo/fuel stores must be kind `chest` (shipped build rule; validator enforces), (b) `basePower.capacity` must be exactly 2 (or omitted). Fixed the fixture; the validator did its job.
3. **"The turret fired once, then went silent."** Instrumentation showed `m.kbx≈80` after the arrow (online `knockback: 80` — unchanged), and the offline eligibility gate `Math.abs(kbx)+|kby|>1 ⇒ 'defer'` **permanently** marked the boar `offlineUnresolvedAt`. Nothing decayed it offline. Fixed by §3.1.6. This was the single most valuable defect this round surfaced.
4. **"6:00-minute reload equal to the original at float precision."** Not true at the 1e-14 level — partition boundaries split fuel drain differently. Outcomes are equal at 1e-6; the assertion now quantizes there and says so, rather than pretending bit-equality of a physically continuous integration.
5. **"Online vs offline must match hit counts beat-for-beat."** Not lawful to assert: the online-only random-wander law (`m.t % 500` wander re-target) steers the pre-discovery approach differently by construction. Law parity asserted instead (bash in both, prov-before-fire in both, arrows 1:1 in both) — plus exact determinism within the offline partition/reload family, which IS assertable.
6. **"Outcome survives destruction" protected perfectly.** No code change needed — `destroyStructure` removes the entity; both-known charges idempotently (asserted). No assertion of this kind required touching engine code, which was correctly left generic.

---

## 9. V1–V11 comparison (declared reading; unknowns explicit)

**Provenance note (explicit):** no ledger named "V1–V11" exists in the verified original Atlas extracts (`/tmp/atlas-ref/.../extracted_full` v5/v6/v11 packages), in the repository tree, or in the R-series audits. The scheme below is the R5-mandate's own eleven verification obligations, numbered V1–V11 for this document; it is declared here as the operative reading. If a different V1–V11 ledger is intended by the owner/control tower, it is **ORIGINAL_UNKNOWN** and this table must be re-derived against it.

| V | Obligation (R5 mandate wording, condensed) | Original (LI) status | SOH status after R5 (`evidence`) | Unknown |
|---|---|---|---|---|
| V1 | Real trail ⇒ pursuit | LI: footprint scent (documented v5/v6; UNDOCUMENTED numeric scent values) | **IMP** — `r5-offline.test: NATURAL` (real movement chain 11 traces) | scent numeric radius/decay on final Maps — UNVERIFIED |
| V2 | Trail discovers → follows barrier | LI: documented as target-seek by scent (LI v6 acceptance **NOT_RUN**) | **IMP** — same test; KNIGHTS-style oscillation removed | barrier geometry semantics on non-wall obstacles — UNVERIFIED |
| V3 | Wall gap forces bash, not walk-through | LI: wall collision vs pathing (MAP-dependent) | **IMP (fixture geometry)** — NATURAL door test; movement blocked ONLY by `struct.block` grid | door-vs-wall hit eligibility nuance — as coded |
| V4 | Powered/supplied turret ⇒ offline fire | LI: turrets & traps (v5 S10, acceptance **NOT_RUN**) | **IMP** — NATURAL turret test; exact arrow accounting | turret damage/cooldown on final balance — UNVERIFIED (uses shipped 16 dmg / 1000 ms) |
| V5 | Fuel/power drain really paid | LI: undocumented numbers | **IMP** — fuel-wood→energy burn in 60 s slices proven; reservation unchanged | fuel rate on full-size homesteads — not asserted |
| V6 | Missing prereq ⇒ no shot | implied by LI law (no ammo⇒no fire), acceptance **NOT_RUN** | **IMP** — 4 INDEPENDENT negative controls | — |
| V7 | No double damage/ammo on repeat settle | no LI record | **IMP** — partition/reload/replay INTEGRITY tests | — |
| V8 | No-trail safety | LI: C08 trail-grounded safety (canon intent) | **IMP** — true negative + R4 suite (9/9) still green | — |
| V9 | Expired/lost trail dead-ends | LI: weather/rain intent (v6 NOT_RUN) | **IMP** — rain-drain control | snow-life surface tuning on final Maps — balance, out of scope |
| V10 | Online/offline outcome parity | no LI record | **IMP (law parity, not float identity)** — same outcome laws both worlds; float equality not claimed | — |
| V11 | Repair/aftermath after the consequence | LI: repair stations (v5, acceptance NOT_RUN) | **IMP** — `repairStructure` online law demonstrated on the battered door | wreckage-bag economy for bash-destroyed doors — none exists (doors carry no contents by design) |

**LI values taken as verbatim law:** none — every number in R5 comes from shipped `BAL.*` (sightNight 70, traceSenseRadius 20, boar aggro law, grass/snow trace life 180/900 s, bash dmg 13 / cd 900 ms, turret 16 dmg / 1000 ms, engagement circle 96 px). Anything not in the shipped source is marked unknown above.

---

## 10. XEDGE status (evidence-bound)

Named XEDGE watch set from the R5 work-order: **042, 043, 044, 045, 032, 033, 037, 041, 047, 096**. All remain **NOT_RUN**. None of them is satisfied by this round's evidence, and none is claimed. The adjacent, previously-recorded PARTIAL edges most related to this work (`XEDGE-096` offline chronology; `XEDGE-085` night/biome visibility; `XEDGE-087` rain/storm/fire; `XEDGE-093` cash-chest no-Elder; `XEDGE-097` escrow deposit; all per `MEC01_R4_AUDIT.md §2`) remain PARTIAL/NOT_RUN — R5 did not isolate any composite edge. **This round produces evidence relevant to, but not closure of, those edges.**

Evidence cited: R4 audit §2 tables (v6 gates all NOT_RUN, all 104 v11 gates NOT_RUN); R5 suite (15/15 green); `ce73f17`. No edge may be promoted without an isolated green composition test plus owner sign-off — unchanged rule.

---

## 11. What blocks the *complete* network (honest list)

1. **Homecoming is not a raid and cannot be forced.** If the player walks with a bike, rolls, or never lays a fresh trail, nothing happens — by law and by design. The network proves causality, not visit frequency.
2. **Combat cannot occur offline while the player is home-ish.** The moment the boar can see the body (LOS, incl. through a doorway breached by its own bash), playback defers; the player's HP is never touched offline. The full "defend the household with your body" fantasy exists only online — this is Bible-law (K5/K8), not a bug.
3. **Ragnarok-scale multi-beast assaults** (several prov boars + elders) are expressly out of scope; the defer/cap rules correctly refuse them. A funded home tested against a *wolf pack* while the player is away is honestly unresolved offline.
4. **Weather dependence of the window** — a storm-heavy absence drains scent faster than the defense can organize; nothing prevents that outcome, and nothing should.
5. **No Map/owner sign-off** — the mechanism exists; whether shipping_fresh→final Map shelters the same lawful geometry (doorways that block LOS, corridors that carry traces, turret sightlines) is the Map gate, untouched here.
6. **An absence longer than ~24 in-run minutes** may expire or stale the whole interaction chain; the world moves on, lawfully, without the player.
7. **Live-browser proof of the 6-hour absence** could not run in this sandbox (no Chromium; CDN blocked). `scripts/e2e-r5.mjs` is filed for a browser-enabled machine; the human preview is attached. The user can reproduce the sequence manually (walk → Escape → Save & quit → reload → Continue) and see the persisted trail survive.

---

## 12. Godot / native integration contract (A0/A3/A6/A7/A8 — declared reading)

**Provenance note (explicit):** only **A0**, **A3**, **A8** have repository referents (A0 — fixture contract tradition from PR #10 cited in `WEB_GAMEPLAY_AUDIT_3b37ae9.md`; A3 — value-source custody contracts `R13_A3_*`; **A8** — Map-side integration gate per R3-M3's "Map + A8 + A3" row). **A6** and **A7** have no repository referent found; the conservative engineering readings below are declared, and if the control tower's A-registry differs, A6/A7 are **ORIGINAL_UNKNOWN**.

- **A0 — Save/dispatch integrity (native):** the native save must round-trip `offlineUnresolvedAt` (finite-int), in-flight `PROJ` (x/y/vx/vy/life/dmg/from/kind/r), `traceWalk`, `traceIgnore`, generator fuel + reservation allocation, and the defense-window marker discipline (or equivalents). Invariant: reload-before-settle ≡ reload-after-settle on the INTEGRITY suite. Native validator must fail closed (no "best effort" saves).
- **A3 — Value custody (native/economy):** an offline turret kill commits **no** economy receipts — no cash, no escrow, no score mint, no loot-box creation. The only lawful outputs are (a) creature drops as physical ground entities, (b) `skills.combat += 2`, (c) `turret.fire` receipts + `struct.hit`/`struct.destroyed` receipts. Anything else requires its own Source custody contract — not here.
- **A6 — Performance bound (declared reading):** native settlement must keep the R5/R5.1 bound: ≤2400 investigator steps AND ≤14,400 defense-contact frames per **absence window** (persisted via `clock.defenseFrames`), both in 50 ms slices, worst case ≈ 12 minutes of fine simulation, hard-close afterwards. No per-creature ASTAR budget may exceed the online equivalent; allocation discipline must not be worse than online per tick.
- **A7 — Determinism audit (declared reading):** the partition-split law (a settle cut anywhere reproduces the same end-state at ≤1e-6) and replay idempotence (same endpoint ⇒ zero new receipts) must be encoded as native invariants with a failing-fast test; RNG stream position for kill-time drops must be persisted at save boundaries. **R5.1 evidences the budget axis of this invariant in Vitest: continuous == split == separately reloaded at the 14,400 cap (§16).**
- **A8 — Map integration (repo evidence):** the mechanic is map-agnostic but geometry-bound — it requires at least one corridor an unoccluded trail can be laid in, a LOS-blocking blocking structure class, and a turret placement with legal LOS. The Map owner must certify the homestead mock geometry (or shipping_fresh's analogues) on a final map before any "defense holds" claim leaves the prototype phase. **No final-map acceptance is claimed here.**

---

## 13. Next most consequential network

**The loot-survival round-trip of an offline kill (delivered as R6, §16.7).** The turret kill currently ends the network at `killCreature`: physical drops land on the ground inside/near the breached homestead, and the player's return discovers them through the existing loot filesystem. The next round should prove end-to-end: offline kill → physical drops persist across the save boundary → the player walks in, interacts, takes the drops with real custody moves → drops debited/transferred exactly once → nothing mints. It is the natural closure of *"a player action creates an authentic world consequence that survives offline settlement and restart"* — the last mile from consequence to reward, with the same discipline (no shortcuts, no minting, real inputs). Secondary: multi-attacker defense (two boars, one around the back through a different door) vs turret capacity — only if the Map gate advances first.

---

## 14. Gates, provenance, PR state

```bash
cd web
npm run typecheck          # exit 0 (2026-11-08)
npm run typecheck:tests    # exit 0 (2026-11-08)
npx vitest run             # 756 passed | 1 skipped (was 741|1 at R4) — 2026-11-08
# after R5.1 (§16): tsc --noEmit exit 0; npx vitest run # 770 passed | 1 skipped — 2026-11-08
```

- Commits (this round): **`ce73f17`** (SIM + tests + UI copy). Base `a82fbb0` (R4 P4, pushed earlier). PR **#44** is the sole review path — **untouched** (DRAFT, open; head unchanged at `arena/d4bfcfff-soul-of-hero`).
- Suite files: `tests/mec01-r5-offline-defense.test.ts` (new, 15/15), `tests/k6-power.test.ts` (superseded assertion only), `tests/w07-power-offline-parity.test.ts` (superseded assertion only).
- Live build for human reproduction of the player-facing sequence: `vite preview --host 0.0.0.0 --port 4173` against this branch (the attached preview). Headless browser proof is impossible in this sandbox (§11.7) — no claim is made that it ran.
- Owner/Map inputs used in R5: **none**. `shipping_fresh` world data unmodified; only test-side terrain overrides (declared fixture law).
- No force-push; nothing outside `arena/a9d7aa20-soul-of-hero` was committed or pushed.

## 15. ORIGINAL_UNKNOWN registry (this round)

Zero **new** ORIGINAL_UNKNOWNs were created — R5 introduces no gameplay-rule numbers beyond shipped constants, and the one legal extension (bash ⇒ prov, §3.1.3) is an explicit R5 design law, documented as intentional, not a guessed default. R4's `P3-U1…U8` registry changes as follows, everything else unchanged:

- **P3-U1 (turret fire during absence) — SUPERSEDED by the R5 mandate.** Offline turret firing is now lawful under the identical online predicate (R5 design law; see §3). The retired W07-R disposition no longer binds; the k6/w07 assertions were rewritten as documented supersessions (§3.3).
- **P3-U7 (barrier-contact vs distant-anchor limit cycle) — PARTIALLY RESOLVED by R5.** The `traceBarrier` window widening (18→64 px) and the terminal-bash-before-steer reorder eliminate the permanent oscillation at epithelial distance from a barrier along the evidence ray. The general unpinned-anchor regime (trail direction not toward a blocking cell; dist ≥ 2 wobble) still exists as documented and is deterministic; the Bible remains silent, so no Mandate is claimed beyond what R5 changed.
- P3-U2, U3, U4, U5, U6, U8 — unchanged.

*This document is the R5 record. `MEC01_R4_*` is preserved unchanged as history.*

---

## 16. R5.1 — Corrective amendments (2026-11-08, branch `arena/a9d7aa20-soul-of-hero`)

Response to the source-based corrective review (Control Tower, comment 6721750194 on PR #44 — **PARTIAL ACCEPT concept and targeted implementation; HOLD promotion/merge**). All P0 items were reproduced on this branch, fixed with the minimal production change, and proven by `web/tests/mec01-r51-corrective.test.ts` (14 tests, all NATURAL/FIXTURE/CONTROL/PROCESS labelled; fixture placement is lawful for injections and is always declared). Full regression after the changes: **tsc exit 0; `npx vitest run` → 770 passed | 1 skipped (was 756|1 at R5).**

Labels here mean: **NATURAL** = real `tick()` movement only (shipping_fresh geometry; **REAL_MOVEMENT_ON_FIXTURE_GEOMETRY** — never natural map play or human gameplay); **FIXTURE** = placement-only injection (a creature, structure, projectile, impulse or cooldown placed by the test); **CONTROL** = one lawful prerequisite removed or one hostile category substituted; **PROCESS** = an independent JS module registry playing the part of a fresh browser process.

### 16.1 P0-A — Continue / projectile binding (fixed)
`settle()` now calls `bindCombat(r)` at its top, exactly as `tick()` does. Before R5.1, a fresh browser process (load → Continue) settled with `PROJ` detached from `r.combat`; persisted projectiles were never stepped offline and post-settle shots could vanish. Receipts: exactly-once arrow debit + impact preserved online and offline. Proven by two PROCESS tests — persisted bow arrow at logout lands exactly one impact; an arrow in flight at the settle endpoint survives Continue and lands exactly once later (independent module registry both legs).

### 16.2 P0-B — Turret cooldown freeze in non-contact slices (fixed)
Every chronological slice now advances each turret cooldown by exactly its own span, once: contact slices run the full online law (`tickTurrets` + `tickProj` + budget debit); all other slices take the single bulk debit (including budget-exhausted 50 ms slices — previously a freeze). Test: `cooldown: 1000` injected at a homestead with a bashing boar and no target yet → the first post-bash shot fires with a fully drained cooldown, and fire latency ≈ the online 1000 ms law.

### 16.3 P0-C — Pre-existing knockback vs unresolved marker (fixed)
One authority: a creature selected into `pending` at the start of the absence is playback-eligible, **knockback included** (an impulse is not a state). `offlineUnresolvedAt` is stamped **only on creatures NOT selected into playback**; death stops everything before any impulse branch (a corpse never advances). Marker and membership now agree by construction. Tests: an impulse present at logout is integrated (`|kbx|+|kby| ≤ 1`) and decayed inside playback, never marker-frozen mid-impulse; a turret-killed boar leaves playback without a marker or a corpse advance (`is dead` short-circuits the impulse branch).

### 16.4 P1-D — Committed projectile class at the boundary (policy defined)
At the settlement boundary, **hostile instruments are discarded, never stepped, never re-armed**: hostile `HAZ` (`offline.hazards_cleared`, pre-R5.1) and hostile `PROJ` (**new**: `offline.projectiles_cleared`, in-flight and delayed) are spliced at the top of `settle()`, committed to the receipt stream and honestly reported (widths and wording chosen so the report can never claim a strike that did not happen — the lethal instrument is deliberately not attributed). Player-origin instruments (including delayed spell projectiles) run the full online law offline — stepped, swept, impacting exactly once, `explode()`-safe. Tests: parked hostile arrow + delayed hostile fireball on the absent player — incremental HP cost **exactly zero** (control-absence comparison), boundary receipt `'2'`; a delayed player fireball detonates offline — boar 40→10 HP, player untouched; the player's own hazard persists unadvanced (b2-perception updated to this policy, §16.6).

### 16.5 P1-E — Partition caps persisted; aggro-wolf no-trail scope (fixed)
`clock.defenseFrames` persists the 14,400-frame fine-defense budget **across time partitions and reloads of one absence**; it resets only on online presence (`tick()`). Same-checksum continuous == split == separately-reloaded runs produce identical budget, shots, arrow debit and survivor HP at the cap (asserted `toEqual` across three legs, plus a weather-aligned 6/15-minute split and an independent-process leg C). Persist validator fail-closed on corrupt values (−1, 10,000,000, 3.5 rejected; 14,400 accepted). The no-trail negative (non-aggro boar) is kept but no longer generalized: an **aggro wolf with no trail is a lawful offline target** — proven by the open-field siege fixture (unkillable wolf, guaranteed Ready turret, 180/180 arrows, cap reached and persisted in all three partition legs).

### 16.6 Related changes required by the same mandate
- **Player-projectile body sweep (§16 discovery):** offline 50 ms slices step a 260 px/s arrow 13 px per slice, stepping *over* small bodies (a wolf 16 px away was stepped across). The 2 px substep sweep that already existed for walls now also tests creature bodies for **player-origin** projectiles, with byte-identical damage semantics (same `damageCreature`, knockback direction, 80-unit impulse, Elsa freeze roll) — applied online **and** offline. It is not a separate damage function and does not alter online behaviour for any crossing an arrow previously survived. (The review's "preserve the shared lawful turret arrow hit code" mandate is honoured in effect: one hit law, one damage path, now without the coarse-slice miss artifact.)
- **`tickProj(..., { inertEnemy: true })`** for hostile projectiles during settlement: aged (own life/delay) but never moved, never detonated, never reach `hurtPlayer()`.
- **Online-parity note (documented, not changed):** hostile projectiles remain fully lawful online; the policy binds settlement only.
- **`tests/b2-perception.test.ts` updated to the R5.1 policy** (its two assertions encoded the pre-R5.1 parked-instrument premise). Its `fresh()` helper now detaches through `bindCombat(gs.run!)` instead of raw `PROJ/HAZ.length = 0` — the globals are shared with the bound run's `combat` object; raw wipes destroyed committed instruments. The persisted-projectile round-trip assertions are preserved with a player-origin hazard and an enemy bolt (discarded, receipt `'1'`).
- **NOT generalizable / not claimed:** no browser/human proof; no final-map sign-off; the R5 NATURAL suite is REAL_MOVEMENT_ON_FIXTURE_GEOMETRY (not natural map play); `scripts/e2e-r5.mjs` remains an unrun smoke; the 336-hour run wall applies unchanged.

### 16.7 R6 — Player consequence closure (2026-11-08, `web/tests/mec01-r6-homecoming.test.ts`)
The end-to-end law, proven end to end in one NATURAL/PROCESS test (**REAL_MOVEMENT_ON_FIXTURE_GEOMETRY** — fixture geometry, real movement, never natural map play or human gameplay; the absent-homestead fixture is declared):

1. **The absence** — homestead, real `tick()` movement to it, door closed, funded turret, a boar injected at the pasture edge walks in and bashes; `settle()` (the Continue path) kills it: fire receipts ≥ 3 (40 HP ÷ 16 dmg), creature row `warn`, event-sourced (`receipts.length ≥ 1`).
2. **The logout save round-trips** — `serializeSnapshot` at departure; an independent JS module registry (**PROCESS**, the closest a unit test has to a fresh browser) `selectSnapshots([logout, null])` → `validate` passes → `settleWithReturn(restored, …)` is the Continue button's exact path.
3. **The absence report is honest** — it states only receipt-verifiable evidence: the creature-death row is present, event-sourced and toned `warn`; the serialized report contains **no** `meat`/`hide`/`boar_tusk` (no reward is claimed before pickup — the drops are ground entities, not the player's inventory); `summary` contains no invented obligation. The drops exist as physical entities with UIDs in the restored run (`kind: 'drop'`, burst-decayed position, containers in the custody ledger).
4. **Real movement + pickup** — the door is opened from inside, real `tick()` steps walk the player through the doorway to each drop (greedy axis walk toward the nearest drop each step, no teleporting); auto-pickup fires on arrival; the drop entities are destroyed (`Object.values(entities)` no longer contains them); inventory gains exactly the dropped meat/hide; exactly one `pickup` receipt per drop (details `meatx2`, `hidex1`; at most one additional tusk) with the monotonic run sequence — **never replayed**; the persisted custody ledger (`r.custody`) is conserved one-for-one across the ground → inventory transition (drops count as custody while on the ground and are struck from the ledger on collection).
5. **A second Continue mints and replays nothing** — no drop reappears, no pickup receipt re-appears, the death is not re-reported for a deathless window.

What R6 does not claim: it is fixture geometry and fixture creature injection (a boar injected at the pasture edge, a homestead placed by the test); no human play was measured; the tusk (30% roll) is handled as a dynamic expectation, not a required outcome; the 336-hour wall applies; no browser E2E has been run for this closure. The **return report honesty property now has a regression test**, not just an inspection.

*This section is the R5.1 record. Everything in §1–§15 stands except where §16 states otherwise; `MEC01_R4_*` remains unchanged history.*
