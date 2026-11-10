# Journey, Waymark & Attention — Soul of Heroes

Branch: `uiux/journey-attention-system`, based on `uiux/final-experience-correction-20261110` @ `974b050`.
App: `web/uiux/visual-overhaul/`. This builds on the existing Event Feed, ExperienceStage, Field Notes, UrgentAlerts and audio. It adds no parallel notification system.

## What was built
| File | Role |
|---|---|
| `src/game/journey.ts` | Data model and rules for Fieldcraft, Daily Waypoints, milestones, Wayfarer Marks and the Chronicle. Ingests receipts with a cursor. |
| `src/game/attention.ts` | Assigns each cue a feedback level (1–5), merges cues from the same batch, and derives Standing Issues from live state. |
| `src/ui/Waymark.tsx` | Smart tracker, day dial, world beacon, L3 flares, L5 cinematic and the Issue rail. |
| `src/ui/Journey.tsx` | Expedition Ledger [J]: Fieldcraft trail, Waypoints, Chronicle. |
| `src/ui/journey.css` | Art direction for all of the above, including reduced-motion rules. |
| `engine.ts` | One added audit receipt, `creature.kill`. Gameplay outcomes are unchanged. |
| `audio.ts` | Sound ladder: `jtick` → `jstamp`/`jmilestone` → `jcapability` → `jrelic` → `jepic`. |

## Authority and anti-exploit rules
- Progress comes only from committed engine receipts, plus two observed persisted sets: `poiSeen` and the UIDs of Creator Cores in custody.
- Each run keeps a cursor (last receipt `seq` processed), so each receipt counts once.
- Completions use stable ids (`fc:<lesson>:<step>`, `daily:<date>:<obj>`, `milestone:<date>:<id>`) stored in `claimed`. Replaying or reloading cannot pay twice.
- The journey store is written to storage **only after the game save succeeds**, so after a crash it can never be ahead of the world.
- Variety goals count distinct keys. Building on the same tile again, moving items between containers, or opening panels counts for nothing.
- Receipts more than 5 s old are treated as "away" (offline settle or a hidden tab). They count only for objectives the player set in motion (`offlineOk`: station jobs, smelting, research). They are grouped into one quiet record, never shown as a parade.
- On first sight of a run: Cores already in custody and places already discovered are baseline, not discoveries. A resumed run gets no retroactive daily credit.

## Daily Waypoints
- **Selection:** 4 objectives from 4 different categories (Gather, Craft, Build, Explore, Endure, Hunt, Produce), seeded by `date + profile salt`. Objectives are gated by capability, e.g. rest needs a bed and knowledge needs a research table. Each day's set includes at least one easy (◆) and one demanding (◆◆◆) objective. Once a day you may swap one untouched objective.
- **Points:** 10 (light) · 15–20 (standard) · 25–35 (demanding). A typical day offers 55–95.
- **Milestones:** Ember 25 · Hearth 50 · Beacon 75. Each grants +1 Wayfarer Mark, a profile record with no economic value. Ranks: Castaway → Forager → Pathfinder → Wayfarer → Warden of Veyra.
- **Beacon reward is PENDING:** a "Supply Requisition" needs an engine intent (`journeyRequisition`), a `BAL.journey` table, a receipt and save validation. It is recorded but not paid.
- **Reset:** at local midnight, and missed days cost nothing (no streaks). If the clock moves backwards, daily progress freezes rather than regenerating. Scores are LOCAL/UNVERIFIED, like the existing score.

## Five accomplishment levels (warnings are separate)
1. **Routine:** feed line merged ×N, pickups shown in the world, and a tick on the Waymark.
2. **Guidance / waypoint complete:** a wax seal stamps into the Waymark, with a soft chime, and is recorded in Fieldcraft.
3. **Capability** (first station, first smelt, new recipe, station upgrade, daily milestone): a flare rises from the actual station or spot. Station upgrades were moved down from the old full-screen ceremony.
4. **Rare** (Creator Core, vault, first deposit): the existing centre reveal, with a distinct relic sound.
5. **Journey-defining** (Elder falls, Ragnarok, Elders wake, evacuation, Crown of Six Stones): a letterboxed cinematic with a hushed world, staggered title, rays and motes. During combat it shrinks to a strip.

**Merging in one batch:** `job.done` + `first_ingot` → one "First Smelt" flare at that furnace. `elder.defeat` + `elder_1` → one cinematic. `six_stones` absorbs `evacuated`. The `ragnarok` achievement is absorbed by the phase cinematic.

## Attention policy
- **Safety** (top-left): UrgentAlerts plus **Standing Issues** (No Fuel, Output Full, Severe Damage, Upkeep Due). These are derived from state, persist until resolved, show direction and distance, and can be snoozed until their state changes.
- **Deferral:** L2–L4 wait while combat (an Elder in range, Core aim, HP < 35), a full-screen surface, or death owns the moment. The Chronicle records them immediately, and sound plays when the visual plays.
- **Waymark modes:** *glyph* in danger, *compact* while exploring, *open* at the relevant station, during a build step, or on peek [T].
- **Beacons** mark only legitimately known targets: your own structures, or a source already in view.

## Verified (real Chromium, real keyboard and mouse)
1. Fresh run → suggested Landfall → beacon on an Oak → LMB harvest → "Gather by hand" stamped → tracker advanced to "Shape a tool". The daily Forage goal advanced from the same receipts.
2. Ledger → Waypoints → **track** Fell timber → Waymark switched in place, and the beacon retargets.
3. Timber 12/12, eat/drink 4/4 (quickbar + LMB), hand-craft 3/3 → 30 pts → **Ember** → +1 Mark.
4. Autosave → reload → Continue: points, milestones and claims identical (claims 4 → 4 and 6 → 6). No re-stamp, no double Mark.
5. QA Sandbox at 640×360: Core pickup and a real engine Ragnarok fired together → L5 played first, L4 deferred and played afterwards. Chronicle correct.
6. Screens checked at 1280×720 and 640×360: spawn, beacon, progress, stamp frames, milestone, peek, ledger (all folios), crowded frames. Evidence is in `evidence/`.

## Bugs found and fixed during testing
- The beacon hid during stamps, which interrupted navigation. It now stays.
- Cores placed by a sandbox preset were recorded as discoveries. They are now baseline.
- Missing `gear` icon. Replaced with real item icons.

## Not fully verified / limitations
- No real Elder fight was played end to end. The L5 Elder path is unit-level wiring only (`elder.defeat` receipt → cinematic). The sandbox's "defeat" is a staged preview with no receipt, so it is deliberately not used as proof.
- No dedicated offline-return pass on the final build. The away rule (receipt older than 5 s) is in code, but the sandbox's 6.5 h settle was not re-run.
- The Waymark hides while docked panels are open. It does not dock inside the Survivor screen.
- Water and death-bag beacons are not implemented, so those steps give text guidance only.
- The repo's pre-existing TS6133 unused-symbol diagnostics remain. There are no new semantic TypeScript errors.
- The repo's vitest suite was not run in this environment.
