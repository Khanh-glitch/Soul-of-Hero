# S08: physical world-event perception and monster investigation — provisional Web adapter

**Status: implementation evidence, not natural-play ecology, stealth-path, or AVFX acceptance. PR #44 remains OPEN / DRAFT / HOLD / UNMERGED.** No external owner branch is modified. Implementing only the airdrop-landing stimulus branch of Atlas SYS08.

## Provenance and limits

- `web/ref/bible.md` K2/K3/K5/K6/K8 and the approved physical-footprint, creature-knowledge and offline-simulation laws are the current SOH design authority.
- Atlas v11 `02_FULL_DEPTH_CAPABILITY_LEDGER.csv` SYS08-C01/C02/C03/C04/C09/C10, SYS12-C07 and `17_EXPLICIT_CROSS_SYSTEM_NETWORK.csv` XEDGE-042/043/044/047/072 describe physically legitimate trace-based threat, weather-dependent decay, creature sight/auditory perception, doors/walls/collision, appropriate response, defensible offline simulation and airdrop sensory consequences. Atlas bundle: commit `5f4e6c443f723318ed32376acc558d031d333e76`, archive SHA-256 `8b4fdedaa9397baaa1bcb8ba58d5c95ca2e7cbdd679963c6d4177fc9ab861e98`.
- Atlas is research guidance only. No sound radius, hearing threshold or investigation duration is claimed as an exact Last Island parameter unless explicitly sourced. Unknown historical values are `ORIGINAL_UNKNOWN`; all new Web numbers are `SOH_PROVISIONAL` in `web/src/game/balance.v1.json` `worldStimulusV1`.
- This document covers **only the airdrop-landing perception branch**. It does not complete the entire SYS08 threat/defense system.

## Contract

### Versioned physical stimulus model

`web/src/game/core.ts` `WorldStimulus` `world-stimulus-v1`:

- `id = sourceId:landing`, `sourceId = airdrop:<index>:<entityId>`, `eventIndex`, `kind='airdrop-landing'`, `modality='sound'`, `eligibility='audible-landing-v1'`, world `x/y` = actual crate position, `at = landAt`, `expiresAt = at + BAL.worldStimulusV1.signalMs`, `range = 160`, `strength=1`.
- Stable identity derives from committed run/event/phase information; reloading does not recreate a new threat. `web/src/game/stimulus.ts` `landingStimulus` is the sole constructor.
- `RunState.worldStimuli` is bounded to at most one validated record; absent in legacy saves. Save validation in `web/src/game/persist.ts` binds ID, sourceId, eventIndex, coordinates, `at`/`expiresAt`, range and strength to the deterministic airdrop schedule and the live entity's phase/position. Malformed, forged or duplicate stimuli are rejected without weakening other checks.

### S12 connection

`web/src/game/engine.ts` `stepAirdrops` emits exactly one stimulus when a physical crate **successfully lands** (`phase locked` after clearance recheck). Skipped or aborted events (no candidate site, obstructed clearance) emit none. The source is the actual airdrop event, not the player. A short source-local beacon pulse during the landed window may exist if energy/timing rules are obeyed; current implementation uses a 4 s auditory landing impulse. A faraway sector report never alerts distant creatures; only physical proximity/geometry matters.

Source-local landing cue is also provided as a faint expanding ring rendered only when the player is within range and has line to the source, and a short low-frequency impact sound (`airdropImpact`) added to `web/src/game/audio.ts`.

### Creature-specific perception

`web/src/game/sim.ts` `noticeStimulus`:

- Only living, non-elder, eligible species may react. Provisional hearing multipliers in `balance.v1.json`: wolf 1, crawler 0.8, beetle 0.7, toad 0.55, boar/crab 0.
- Evaluated per stimulus: distance ≤ `range * hearing`, species capability, time since occurrence (`now` within `[at, expiresAt)`), existing knowledge/state, and `clearPhysicalLine` sound attenuation/occlusion from actual terrain and structures.
- `stimulusNearHome` (`web/src/game/stimulus.ts`) prevents the impulse from becoming an implicit home-raid order: if any player-owned structure is within `homeExclusionTiles * 16` of the source, no creature notices. No generator/workshop noise or general home-raid system is added.
- `stimulusApproach` selects a reachable cardinal adjacent cell to the physical crate via A* on the live `blockGrid`; the solid crate tile itself is never a goal. If no adjacent cell is reachable, perception fails.

A stimulus is never proof the creature has seen the player.

### Investigation-only knowledge

`Creature.knows` gains a third kind `stimulus` with `{sourceId, eventIndex, expiresAt, goalX, goalY}`. `stimulusIgnore` records the most recently sensed source so arrival/reload cannot retrigger the same impact.

- Distinct from `sight` and `trace`; never carries `traceId`/`chainId`.
- The creature may move toward its `goalX/Y` through existing collision and navigation at `0.7` speed.
- Investigation ends with `stimulus.lost` receipts: `arrived` (within 10 px of goal), `expired` (past `memoryMs`), `blocked`/`unreachable` (adjacent cell now blocked or A* fails, rechecked at most every 900 ms). No wall bashing for an event; route obstruction is terminal without damaging structures.
- Real `sight` (via `observePlayer`) **upgrades** stimulus knowledge immediately to `sight` at the observed player position using normal combat perception. A genuinely encountered contiguous identified footprint (`encounteredTrace` within `traceSenseRadius` and LOS) **replaces** stimulus with normal `trace` knowledge. Otherwise investigation continues until expiry/arrival/failure.
- The creature never updates its target to the player's current position without such a new physical observation. No teleport, through-wall attack, spawned ambush or endlessly renewed attraction.

### Real movement and encounter consequences

Uses existing `moveBody`, `steer`, `blockGrid` and `clearPhysicalLine`. Investigation respects trees, terrain, real walls/doors, collidable airdrop crates and species movement limits. Conversion to sight/trace occurs only at the point of observation.

### Save and offline chronology

Single 336 h run clock is preserved; S12 reward/custody unchanged.

- Event signals and creature memories carry correct `at`/`expiresAt` and provenance in receipts (`stimulus.emit`, `stimulus.notice`, `stimulus.lost`).
- Online/offline: events still occur and world-object state progresses normally via the same `airdropBoundary`/`stepAirdrops` chronological path. A creature never acquires player sight/footsteps that were never observed.
- `settle`/`advanceWorld` never invent a monster journey, kill, combat or newly witnessed trace. During offline settlement no new notices or investigation movement are simulated; existing investigation memory either expires once via `airdropBoundary` expiry (receipt `expired`) or remains to resume live without fabricated approach. Where physical movement cannot be reconstructed, the investigation stays at its last justified checkpoint until live play re-evaluates reachability.
- Expired stimuli cannot reactivate on reload. A creature's saved stimulus knowledge cannot become permanent because the simulation was paused.
- Previously established valid `sight`/`trace` knowledge migrates without loss. Old saves without stimulus fields remain valid; run wipe clears all run-local event and creature knowledge.

### World-space feedback

- Landing impact: source-local expanding ring (`web/src/game/render.ts`) and `airdropImpact` sound, both gated by player distance/geometry.
- Notice: a small `?` pixel-text above a nearby investigating creature, visible only when the player has clear line to that creature.
- Investigation: observable collision-constrained movement toward the source-adjacent goal.
- End: `lost` receipt and `fx('lost')` puff; creature returns to `wander`. No elaborate speculative VFX bypassing AVFX ownership.

## Player choices produced

- **Approach immediately:** nearby eligible creatures may still be at the fresh landing.
- **Wait:** the 4 s signal window and 24 s investigation memory expire; the crate's 90 min expiry continues and loot opportunity shrinks.
- **Avoid detection:** exploit real terrain occlusion and absence of footprints on the creature's route.
- **Fight:** if legitimately seen, existing combat takes over.
- **Ignore:** home production, farming, research and ordinary exploration remain valid. No quest objectives, mandatory battles or free rewards for investigation.

## Atlas capability marking

Implementing this branch is **not** completion of SYS08. Provisional ledger update for this PR only:

- SYS08-C01 physically legitimate trace-based threat — PARTIAL (stimulus path added; weather-decay of non-player traces still follows existing SYS08-C02 path only).
- SYS08-C03 creature sight and auditory perception — PARTIAL (sight unchanged; airdrop sound plus committed bow-release and melee sound, with provisional range/species table, geometry and timing; W08).
- SYS08-C04 physical doors, walls and collision — PARTIAL (investigation uses same live grid; arrival cell logic preserves collision).
- SYS08-C09 appropriate creature response — PARTIAL (distinct investigation lifecycle with expiry/arrival/blocked, now also for committed combat sound; no auto-ambush).
- SYS08-C10 defensible offline simulation — PARTIAL (no invented notices/movement/combat; expiry honoured; otherwise deferred to live).
- SYS08-C02 weather-dependent trace decay — unchanged (still governs real footprints, not a separate stimulus decay).
- SYS08-C07/C08/C11, SYS10/12 full system — still MISSING/OWNER-BLOCKED for general threat/defense beyond this airdrop branch.

No Map/AVFX certification or native acceptance is claimed. Imported Veyra/package maps remain disabled for the same reasons as S12: they require a certified `airdrop-landing-v1` (or equivalent) landing/perception adapter.

## Verification

- `npx tsc --noEmit`: pass.
- Production build `vite build` with `NODE_OPTIONS=--max-old-space-size=768`: pass.
- Focused `web/tests/s08-world-stimulus.test.ts`: **10/10**, plus S12 11/11 (total focused 57/57 across claimed modules). S08 tests cover: local landing impulse only, aborted no-op, eligible notice + movement + non-sight termination, species/range/wall/home exclusion, sight upgrade, synthetic encountered identified trace replacement (fixture only), blocked-route stop without damage, reload/re-settlement no reacquisition, forged save rejection, offline no-notice/no-motion and expiry.
- Full regression: **51 files / 364 tests passed** (`npx vitest run`).
- Production-browser fixture `web/e2e/s08-stimulus-fixture.mjs`: controlled clock, daytime-clear seed selection, one pre-existing wolf relocated with its home anchor and player; all other creatures retained; no monsters or loot spawned. Actual crate landing emitted `stimulus.emit r75 airdrop:0:e7t:landing@149,116`, wolf `m3j` emitted `stimulus.notice r76`, moved toward reachable approach cell `2408,1864`, and ended with `stimulus.lost r77 arrived` at `x≈2419 y≈1868` without acquiring sight/trace. Images `web/evidence/s08-stimulus-fixture/00-before-640.png` through `03-ended-640.png` (640×360) plus `trace.json` capture the sequence. Inspected: daylight, crate with parachute/lock, player and wolf both visible right-of-center; the `?` above the wolf and the brief source ring are subtle at 640 and require AVFX readability review — receipts and trace.json are the authoritative proof of legitimate knowledge acquisition. This is not proof of natural ecology, full stealth path or sustained combat.

Remaining holds: Map-certified landing/perception contract for imported worlds; AVFX owner integration for stimulus origin/radius/accepted triggers and marker readability; natural-play multi-site walk/drive and weather/structure variation review; native acceptance not sought.

## Files

- `web/src/game/stimulus.ts` (new) — stimulus constructor and home-exclusion rule.
- `web/src/game/core.ts` — `WorldStimulus`, `Creature.knows.kind='stimulus'` plus `stimulusIgnore`/`stimulusRouteAt`, `RunState.worldStimuli`.
- `web/src/game/balance.v1.json` — `worldStimulusV1` provisional tuning.
- `web/src/game/engine.ts` — landing emission, stimulus/knowledge expiry boundaries, receipt logging.
- `web/src/game/sim.ts` — species perception, investigation lifecycle, offline honesty, movement integration.
- `web/src/game/persist.ts` — strict stimulus and investigation save validation.
- `web/src/game/render.ts` — source pulse and creature notice marker.
- `web/src/game/audio.ts` — landing impact sound.
- `web/tests/s08-world-stimulus.test.ts` — focused invariants (10).
- `web/e2e/s08-stimulus-fixture.mjs` and `web/evidence/s08-stimulus-fixture/` — controlled production browser evidence.
