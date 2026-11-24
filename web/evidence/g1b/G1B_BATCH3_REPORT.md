# G1B — corrective batch 3 report (physical room placement, road density, save triage, visuals, handoff)

Authority: Control Tower audit 2026-11-16 (PR #61 comments `6905971603`, `6906037713`). Base: `e35863e87`.
PR #61 stays **Draft**, unmerged. The 16 loot pools, 219 positive item odds, 14 Core BOMs, Core 300 / +75,
12–72 h timers, no pity / caps are **unchanged** and still pinned by `tests/g1b-roll.test.ts`.

This report separates three things, as the Creator's rule requires:
- **ENGINEERING VERIFIED** — objective invariants, with evidence.
- **DESIGN CANDIDATE** — the placement the agent derived from physical constraints; **not** accepted for enjoyment.
- **CREATOR PLAYTEST REQUIRED** — density, exploration feel, danger, reward value, UI/UX, art.

---

## 1. Room placement — physical model (DESIGN CANDIDATE)

The round-2 heuristic (`danger=1 → exactly one chest`, keyword exclusions) was replaced by a **physical capacity
model**. The generator (`tests/helpers/g1b-ecology.ts`) now, for every space, computes:

- **Wall-backed pockets** — standable tiles with a solid orthogonal neighbour (a chest stands against a wall,
  cover or furniture), grouped into pockets (tiles within 2 of each other are one pocket). A chest is only placed
  on a pocket tile, and `keepsJoined` proves the chest never plugs the lane.
- **Area** — standable tiles reachable from the open ground on the space's own storey.
- **Real hazard / access** — the site's deep-core ring, authored hazard, storey, hidden room, card / power door.
- **Function** — the room's name and building name (guard / strong room / workshop / store / kitchen …).

`want` is then derived, with **no fixed quota and no `danger=1 → one` rule**:

| space | capacity rule |
|---|---|
| room / cellar / enclosed upper / roof | `max(1, round(usable/180))`, +1 if `danger+access ≥ 4` and ≥2 pockets, +1 if `danger ≥ 4` and ≥400 tiles and ≥3 pockets, capped by pockets and at 5 |
| working yard / open roof / upper deck | `min(pockets, max(1, round(usable/260)))` |
| general open ground (paving / green / common / square) | 0, or 1 only if ≥2 pockets and `danger ≥ 3` (one cache against cover; the rest is crossed) |
| transit lane | only inside a genuine wall pocket / alcove / platform (≥2 solid sides); `min(pockets, round(usable/420))` and only if the name is a real stop (platform, landing, shelter, dock, wall, bridge, fork …) |
| arena (Primordial floor) / vendor·evac·recycler shell / unreachable | 0, always |

**The round-2 pass runs first and is left untouched**, so every batch-2 source id and tile is preserved; the physical
pass only **adds** chests where the geometry allows more. Military (the Core-bearing family) is kept to danger-3+
sites or gated / hidden / climbed rooms, one case at most in an ungated low-danger room.

Result: **729 chests** (130 round-1 + 599 added: 516 POI, 5 CARD_ROOM, 78 ROAD) across 811 spaces.
**24 non-card spaces now hold ≥3 chests** (was 0); chests per space: 0 → 344, 1 → 357, 2 → 83, 3 → 15, 4 → 4,
5 → 5, 6 → 1, 7 → 2. The spaces the audit named specifically:

| space | storey | kind | usable | danger | chests (before → after) |
|---|---|---|---:|---:|---:|
| Ironholm Harbor — Ore Separation / Twin Mill | 0 | room | 335 | 1 | 1 → 2 |
| Sandgate — Counterweight Flood-Gate Assembly | 0 | room | 329 | 1 | 1 → 2 |
| Aion Sawmill — Main Crosscut Sawhouse | 0 | room | 282 | 1 | 1 → 2 |
| Hall of Eyes — Elevated Eyes of the Watchers | 1 | yard | 1522 | 4 | 0 → 4 |
| Typhon's Fracture — Broken Skybridge Above the Rift | 1 | transit | 937 | 4 | 0 → 2 |
| Necropolis — Processional Avenue | 0 | transit | 1172 | 4 | 0 → 0 (open span: no wall / alcove / platform — the lane stays clear) |

The two transit spaces that got chests (Broken Skybridge) have real wall pockets; Processional Avenue has none, so it
stays clear — a physical assessment, not a keyword exclusion.

## 2. Omitted / unreachable spaces (ENGINEERING VERIFIED — categorised, not hidden)

30 spaces are not reached by the walking flood. They were **categorised**, not deleted or given a chest:

- **14 "no walking route"** — disconnected from the open ground in the compiled runtime: Academy Skybridge,
  Hook Garden Cottage, Drowned Pier (3 spaces), Gulfhead Quay Watch (+apron), Westmouth River Gatehouse,
  Sandgate Tidal Sluice Repair Shop, Lantern Instrument & Record Hall / Upper Gallery / Signal Perch,
  Confluence Travelers Supply Shelter, Rapids Wayfarer Shelter.
- **16 "no standable tile"** — the compiled runtime has no free tile in the space (geometry / furniture / collision):
  Oasis Laundry & Bath Shed (+apron), Westbank Two-face Wharf, Drowned Pier Tide Rake, Ironholm Ore Transfer
  Platform, Ember Outer Stack Transfer Stage, Sandgate Repair Apron, Pumphouse Reservoir Gatehouse (+threshold),
  Lantern Lightkeeper Store (+approach), Lanternstn Field Records Annex (+approach), Confluence Shelter approach,
  Beacon Signal Relay Cabin.

**No source was hidden by deletion** — none of these 30 received a chest in any batch. Whether a given room is an
intentional locked room or a map path / collision bug is a **map-owner decision** (the map code is read-only here);
the categorisation above is the objective input for that decision. The 7 "closed room" cases the audit listed are
among these 30.

## 3. Road chests (DESIGN CANDIDATE)

The road model was re-derived from each road's real length, harsh-ground share, remoteness and features:

- Interval per road type lowered (cart 180 → 150 tiles, trail 140 → 115, riverside 170 → 150, other 150 → 130),
  still jittered ±25% and moved off the grid by the real verge.
- A **military_low patrol cache** on the most remote stretch of any road > 450 tiles; grade raised one step on
  remote (> 220 tiles from any POI) or harsh ground.
- Bridgeheads, docks and forks searched over a wider offset ring (up to 20 tiles) with a smaller min-gap.

**Road chests 68 → 78 added** (94 → 104 total). 44 of the 84 land roads carry at least one. Roads that lie almost
wholly inside a site footprint still get none (the site's own chests serve them; never counted twice). The road
network and per-road rationale are in `census/G1B_ROAD_TABLE.md`.

## 4. Economy — arithmetic only (ENGINEERING VERIFIED / DESIGN CANDIDATE for the Creator)

Exact expectation from the approved pools; odds identical before and after. Full table: `census/G1B_ECONOMY_BEFORE_AFTER.{json,md}`.

| | before | after |
|---|---:|---:|
| chests | 130 | **729** |
| item units, one full sweep | 1,175.7 | 5,786.5 |
| gear units, one full sweep | 30.4 | 141.5 |
| Creator Cores, one full sweep | 11.06 | **35.42** (L1 33.70, L2 1.70, L3 0.03) |
| Core chance per chest, averaged | 8.5% | 4.9% |
| Cores / day ceiling (every chest emptied on restock) | 7.91 | 30.39 |

By zone: CARD_ROOM 24, POI 601, ROAD 104. By storey: ground 567, upper 77, cellar 51, roof 34.
By risk: danger-1 335 chests / 10.70 Cores, danger-2 183 / 11.71, danger-3 73 / 6.83, danger-4 33 / 2.44, road 104 / 3.60.

**The 11.06 → 35.42 full-sweep Core figure is a static theoretical maximum** (open every chest once across the whole
island). It is **not** a playtest result and **not** a claim that the game gives too many Cores. Per chest the added
sources are Core-poor (4.9% vs 8.5%); the total rises purely because there are more chests. **No odds, cap, pity or
diminishing return was changed**, and no Supply/Toolbox was swapped for Food/Medical to lower it. Whether the total
is right is a **CREATOR PLAYTEST** decision.

## 5. Save integrity — `Save refused` triaged (ENGINEERING VERIFIED)

**Root cause found.** The "Save refused: integrity check" seen in a capture run was **not** caused by the Take All at
the Academy toolbox. The icons capture wrote stacks straight into the pack with `mkStack(r, key, 1)`, bypassing
`addItem`; for the `blueprint` item that mints a stack with **no recipe meta**, which violates the save invariant
`stack(): a blueprint must name a real recipe` (`src/game/persist.ts`). The state was invalid from that step on; the
later Academy Take All only **observed** the already-invalid state (the harness's one-shot DIAG had already fired, so
no second diagnostic was captured for that shot).

- Reproduced exactly: `mkStack(r,'blueprint',1)` → `validate` returns null, `diagnoseInvalidState` returns
  `blueprint-without-recipe:none` (new test `tests/g1b-save-triage.test.ts`).
- **A clean Take All at the Academy toolbox saves fine** (real `move` intents, player beside the crate) — proved by
  the same test.
- `diagnoseInvalidState` was upgraded to name the **exact** failing stack rule via a new exported `stackInvariant`
  (shared with `validate`), instead of a generic `other`. Future refusals will name the invariant.

## 6. Visuals (ENGINEERING VERIFIED for the channel; CREATOR PLAYTEST REQUIRED for acceptance)

- **Icons in slots**: the 32 px atlas art now fills the cell — pack / chest grids 24 px cells with 20 px icons,
  hotbar 23 px cells, crisp nearest-neighbour (`img.px { image-rendering: pixelated }`). At 640×360 the icon is
  shown at ~60–65% of source size; **full 32 px would need larger cells that do not fit 640×360** — a layout decision
  for the Creator, not claimed as done.
- **In-world drops and held items** now draw the atlas cell (`atlasIconCell`) for every mapped id, falling back to
  the procedural icon only for the 25 ids without approved art and while the atlas is still loading (`src/game/render.ts`).
- **Sheen on all five chest families**: `screens2/sheen-sweep-sheet-x4.png` — one row per family (supply, toolbox,
  military, food, medical), rest + 4 sweep phases. Every sampled frame differs from rest (the sweep changes pixels).
  The render clock was pinned because headless capture is slower than the 0.9 s sweep; pixels are the game renderer's.
- **UI overflow** (objective bounding-box check at 640×360, `screens2/ui-overflow-log.json`): inventory, chest-open
  and hotbar panels — **no element extends outside the 640×360 stage**.
- **Not claimed**: that the icons / sheen / UI are beautiful or accepted. That is the Creator's verdict.

## 7. Tests (ENGINEERING VERIFIED)

- All G1B files pass: ecology (frozen + survey), ecology-runtime, gates, core-v2, sheen, roll, geometry, lifecycle,
  item-atlas-157, save-triage, economy — **55 passed, 1 skipped** (the opt-in survey).
- `tsc` clean. The full suite is re-run at the final SHA (see §8).
- The frozen ecology is re-surveyed from the compiled runtime (`G1B_ECOLOGY=1` / `G1B_WRITE=1`) and reproduces byte-for-byte.

## 8. Open / not done

- **Full suite at final SHA**: run in progress; the delta against the inherited ~177-failure baseline will be reported
  in the handoff. Only **new** failures (by test identity) are attributed to this batch.
- **7 unreachable closed rooms / 16 no-standable spaces**: map-owner decision (§2). Not fixed here (map code read-only).
- **Icon size at 640×360**: 20 px in 24 px cells; full 32 px needs a slot-layout redesign (§6).
- **25 catalog ids without approved art** keep the drawn icon (tagged `data-icon="drawn"`); listed in the batch-2 report.
- **No authentic walking journey capture**: all captures use QA positioning / window shifts, disclosed per shot. The
  Creator plays the real journey; the agent does not judge it.
- **`CoreStackV2.reserves?`** is still declared in `g1b.ts` (unused by V2 logic).
