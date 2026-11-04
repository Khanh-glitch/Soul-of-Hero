# M-CORE-03 — Gameplay checkpoint

Authority `web/ref/bible.md`; PR #44 remains DRAFT/HOLD. Preflight 2026-11-04:
local and fetched branch both `bfbf44df9ebf403290dce45ff197327947762e8e`;
Control Tower queued this session; no newer public branch commit or concurrent
claim observed. This file is an implementation handoff, not canonical law.

## A/B: source truth and E04

Before this task: physical UID/custody and finite wreck harvest, direct spares,
three research routes, reserve/cancel/refund jobs, player workbench levels and
output containers already existed. Do not count them as new.
`RecipeDef.tier` is discovery complexity; `stationLevel` alone is equipment
capability. `permitsDirectedResearch` and `requiredStationLevel` now explicitly
encode that independent contract in engine and UI, with no gate changes.
Known recipe + real ingredients + reachable station are independently required;
level 3 is not added. Random study excludes Cores until the non-Core unknown
pool is empty; directed tier 3 is refused; specimen study or a physical
blueprint remains available. A specimen is consumed into a timed physical
blueprint job; the blueprint must be retrieved and used.

| Tier-3 recipe | Original source / learning path | Materials → station / function |
|---|---|---|
| Ember Core | Found in keyed Foundry vault in shipping; study it, or a research-produced blueprint | 3 sulfur + 8 spares + 1 crystal → level 1 workbench; 3 fire charges |
| Quake Core | Shipping Foundry vault has its blueprint; study a found Core if obtained; random pool only when non-Cores exhausted | 3 iron ingots + 8 spares + 1 crystal → level 1 workbench; 3 earth charges |
| Storm Core | Shipping powered lighthouse Core, then study; or late random blueprint | 2 glass + 10 spares + 1 crystal → level 1 workbench; 4 chain-lightning charges |
| Rime Core | Shipping Halcyon Hull Core, then study; or late random blueprint | 3 crystal + 8 spares → level 1 workbench; 3 frost charges |
| Chitin Plate | Cinder beetle yields chitin and 30% horn specimen; study horn or random blueprint | 6 chitin + 2 leather → level 1 workbench; body armor 35% |

Crystals require ore-capable tool, snow/hill source; sulfur vent needs ore tool
or beetles, glass needs furnace, spares comes from industrial sources/crawler,
leather from hide and bench. This traces existing dependencies, not measured
route or player-time feasibility. Shipping statics are not Veyra LR02 POI
population; bounded Veyra windows currently have no authored loot/elder statics,
so the above original-item Core path is not asserted there. There is no reason
in existing data to convert tier to level 2; preserve it. Exact practical route
and rare resource population need playtesting and Map/Gameplay integration.

## STATUS: HOLD / PARTIAL — no merge

Branch `arena/d4bfcfff-soul-of-hero`, PR #44 **open, draft**. E04 code
checkpoint `9886233725192d1aff81f8d2317bfd4902fe7cfa`; E02 code `a85833130424ec26dbc6afecfbd28dcb559a872a`;
legacy-knowledge/interaction correction `375fd918a968d1ae2208a17e7c81558d9c682835`;
blocked-output regression `08e67ad7f6a65eb962238428e2e56de33d72b481`.
The evidence/handoff commit follows these. These are local agent results, not
independent Control Tower or CI acceptance. Keep the PR draft; **do not merge**.

## C: E02 physical circuit (provisional balance and placement)

* Every existing finite car wreck starts with stock 8, and each successful
  yield decrements stock and produces one scrap. The bonus table now rolls
  0.30 direct Spares (previously 0.70) and independently 0.20 Damaged Drive.
  Other listed bonus probabilities and other source tables are unchanged;
  adding an RNG roll can of course change individual seeded outcomes. No
  crafting recipe produces a drive. The new item is weight 3, stack limit 1,
  with normal inventory, drops, carts, death bags, UIDs and save custody.
* Choice A: at a reachable, clear-line Workbench Lv1, reserve one carried
  drive and one scrap, run 12 seconds, then collect one Mechanical Parts from
  station output. The pre-existing option remains 2 scrap + 1 iron ingot for
  2 parts in 12 seconds. The new route is not a universal replacement: it uses
  scarce finite drive instead of smelted iron, and its travel/weight matter.
  Base recipe compatibility is effective on old runs without rewriting their
  stored knowledge or offering it as an unknown research target.
* Choice B: the **public Foundry Recycler** is a physical, colliding entity at
  an existing industrial POI, not a global crafting command or starter machine.
  For new `shipping_fresh` and `dev_delta_fresh` runs, the temporary Web-only
  adapter selects the Foundry floor tile `(factory.tx - 5, factory.ty + 3)`
  only if empty; the player must approach, have clear interaction and carry a
  drive. The machine reserves that exact UID, runs 12 seconds, then deposits
  two Spares in its 4-slot output. No fuel or owned base is required. Its panel
  states both options, has a queue/cancel button and output collection.
* The same drive cannot be used twice: both paths debit before a queued job;
  cancellation refunds the reserved physical input to inventory or a drop;
  finished jobs wait if output fills, and empty output after settlement cannot
  be replayed for duplicate products. Distance, walls, UID, queue, output,
  dead-player and serialization validation are checked. Online and offline
  settlement share job handling. `harvest.component` links source coordinates
  to the drive UID and `recycle.start`, `job.queue`, `job.done`, `move` and
  cancellation receipts show custody transitions. Outputs join normal fungible
  stacks: after a merge their individual provenance is no longer distinguishable.
* **Not universal availability:** old pinned layouts/saves are not silently
  remapped and have no added Recycler, while global wreck tuning/drive drops
  still apply to them. Veyra LR02 has no authored statics and gets no inferred
  machine. Thus this is PARTIAL and a material compatibility/Map dependency,
  not a claim of Map placement, world-wide coverage or old-run parity. Map owns
  any Veyra site decision; Gameplay must integrate and verify it separately.

## D: conservation and player tradeoffs

Per wreck yield the old expected direct Spares were 0.70. Here, if fraction
`f` of drives is actually recycled, expected Spares are `0.30 + 0.20 × 2 × f`:
0.30 at f=0, 0.50 at f=0.5, and at most 0.70 at f=1. This is an expectation,
not a guaranteed yield or claim that all drives reach a machine. One whole wreck
has at most eight independent drive opportunities; no renewable scrap→Spares
conversion was introduced. Recovering all drives instead adds 0.20 expected
parts/yield at a cost of 0.20 scrap/yield and forfeits up to 0.40 expected
Spares/yield relative to the all-recycling case. A drive weighs 3 kg versus its
0.6 kg recycled output or 0.5 kg parts output and occupies a whole slot; route,
POI risk, queue, custody, fuel-free machine, existing iron alternative, and
possible failure to reach it all affect value. The theoretical conservation
ceiling alone does not establish good economy, especially on old/Veyra runs.

* **Nomad:** can use the POI without a home; an assisted-input run reached it,
  but discoverability and risk for an unaided player remain to be judged.
* **Crafter:** recovery saves needing smelted iron but costs a unique drive,
  extra scrap, travel and a built bench; no measured balance verdict yet.
* **Researcher:** two recycled Spares are half the existing random-study cost
  of four, but this run did not actually spend them on research.
* **Freight/risk:** the 3 kg stack-one drive favors early processing or cargo;
  no real cart journey or encounter-cost measurement was performed.
* **Knife bootstrap:** the demonstrated drives came from finite wrecks using
  the starting knife; wood and stone for the claim/bench were also gathered
  with it. This is possible, not evidence that time/durability is well balanced.
* **Offline:** reservation and offline settlement/replay are automated test
  evidence; no separate-process natural run was stopped mid-job to time offline
  completion. **Exploiter:** test-only negative cases cover stale UID, distance,
  wall, death custody, no input, replay, full output at start and output filling
  after reservation, cancellation and save validation; these are not a human
  adversarial playtest.

## E: real-input browser evidence and boundaries

Evidence is under `web/evidence/m-core-03/`, 640×360 PNGs and JSON. Scripts
under `web/e2e/m-core-03-*.mjs` use keyboard/mouse and read-only state/grid
inspection; they do not inject inventory, positions, enemies, random seeds or
clock. They are staged, session-profile continuation scripts rather than a
single deterministic green test; `/tmp/m-core-03-browser-profile` is not a
portable committed fixture. Route planning and, for utility, inspecting
unopened crate contents are assisted/omniscient, **not blind human acceptance**.
NPCs and weather remained active.

1. `natural-recycler.json`, `wreck-0.png`, `drive-picked.png`,
   `recycler-world.png`, `recycler-panel.png`, `processing.png`, `finished.png`:
   a fresh shipping run harvested wreck `(117,108)` with the knife, picked up
   drive `s7n`, walked 48 route steps to the machine, queued it, waited 12s,
   and collected 2 Spares. Receipt `r5` associates source with UID, `r9`
   reserves it at `e2g`, `r10` finishes and `r11` moves output. An attempted
   explicit quit timed out because Escape first closed the panel; this failure
   remains recorded in the JSON. A separate Node **and Chromium process** then
   continued from autosave and verified the same Spares and receipts. This is
   real-input evidence of this one route, not downstream research use.
2. `recovery-gather-log.txt` documents separate continuing processes, including
   two failed attempts: a post-offline modal intercepted the first harvesting
   click; one rock could not be damaged from the selected approach and was
   skipped. Subsequent real inputs gathered 24 wood and 12 stone, harvested
   wreck `(141,91)`, picked up drive `sf3`, and paid for claim `(139,86)`.
   A script then timed out because Workbench is under the Build **Work** tab;
   the next process placed bench `(140,86)`. `claim.png` and
   `workbench-panel.png` show the actual UI.
3. `natural-recovery.json`, `workbench-processing.png`,
   `workbench-output.png`: another continued process used the visible Queue
   control, reserving `sf3` plus one scrap, and collected a 12-second job output
   of one part. `natural-utility.json` records transferring that part, combining
   it with two parts from a crate and an ingot from another, then paying for a
   real Lv2 bench upgrade (`r119`). These parts merged into one fungible stack;
   the upgrade consumed two of three, so it is **not possible to prove which
   individual part remained**. Loot routes used read-only contents inspection.
   `upgrade-before.png`, `upgrade-after.png` and `workbench-final-ui.png` show
   the game, the latter after the UI clarification. An explicit save/quit was
   followed by a fresh Node/Chromium process verifying Lv2, the job and upgrade
   receipts (`upgrade-relaunched.png`, `natural-utility.json`).
4. No demonstrated spending of the recycled Spares, no natural Core/Chitin
   source→learning→production→use journeys, no natural mid-job offline test,
   and no independent human review. Source traces and automated tests do not
   substitute for those required acceptance stories.

## F: verification, ownership and next CT action

At gameplay/test checkpoint `08e67ad7f6a65eb962238428e2e56de33d72b481`: `cd web && npm test` passed **26 test
files / 222 tests**; `npx tsc --noEmit`, `npm run build` and
`npm audit --audit-level=low` passed (zero reported vulnerabilities). Focused
`tests/m-core-03.test.ts` has six tests, including finished-output blocking;
`tests/technology-semantics.test.ts` tests the semantics. They use controlled
fixtures for edge cases. The browser failures above are not counted as passes.
The final visual clarification was separately opened with normal controls.

**Gameplay owner:** complete the missing genuine downstream research use and
all five E04 player journeys, verify interruption/offline with natural input,
review actual discovery, visual contrast/access and quantitative player-time
tradeoffs on multiple seeds/starts. Resolve old-save impact rather than assert
compatibility. **Map owner:** decide and author any Veyra industrial Recycler
placement/access without changing Map files from this branch. **Control Tower:**
review this evidence and provisional economy, decide whether to request a
corrective slice and assign Map dependency; keep HOLD until those gaps and an
independent review are closed. Nothing here grants merge or final acceptance.
