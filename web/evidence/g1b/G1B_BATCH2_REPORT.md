# G1B — corrective batch 2 report (room / floor / road ecology, icons, Core, sheen)

Authority: `approved/G1B_CREATOR_ROOM_DENSITY_AMENDMENT_20261116.md`. Base: `6008a20d`. PR #61 stays Draft.
Unchanged by this batch: the 16 pools, 219 positive item odds, quantities, exclusive Core outcomes, 14 Core BOMs,
12–72 h timers, no pity / caps, Core 300 / +75. `tests/g1b-roll.test.ts` still pins them to the approved contract.

Superseded: `G1B_IMPLEMENTATION_REPORT.md` wherever it treats 130 chests as the final placement.

## (a) Every physical space — `census/G1B_SPACE_TABLE.md` (readable), `census/G1B_SPACE_CENSUS.json` (data)

The census is taken from the compiled runtime plan of every site (rooms, yards, cellars, upper floors, roofs, with
real walls, doors, stairs and furniture), not from the POI list. 81 sites → **811 spaces** (ground 639, cellar 55,
upper 81, roof/top 36).

| kind of space | spaces | with a chest | chests |
|---|---:|---:|---:|
| room (ground, enclosed) | 190 | 177 | 231 |
| yard / working ground | 141 | 89 | 101 |
| cellar | 39 | 38 | 46 |
| upper floor | 41 | 39 | 42 |
| roof / top deck | 29 | 25 | 26 |
| circulation (lanes, landings, thresholds, catwalks) | 324 | 19 (round-1 chests) | 19 |
| Primordial combat floor | 12 | 1 (round-1) | 1 |
| vendor / evacuation / recycler shell | 35 | 1 (round-1) | 1 |

- Chests per space: 0 → 422 spaces, 1 → 326, 2 → 59, 3 → 1, 6–7 → the three card rooms.
- Each row of the table carries its reason (function word in the room name → family; danger + access cost → grade;
  size / danger → second chest; or why it has none).
- No chest was added in circulation, combat floors, shells owned by other systems, or spaces the walking flood
  cannot reach. 10 sites therefore have none: 5 recycler stations, 2 vendors, 3 evacuation points.
- Military (the Core-rich family) was added in three spaces only: Academy vault (hidden cellar), Archive sealed
  catalogue (card + power + mask), Necropolis guard chapel (one case; the second chest there is Supply).

Known exceptions, not fixed in this batch:
- 13 spaces wanted a chest and got fewer than wanted because no wall tile was free without moving furniture
  (e.g. Oasis cool store, four `rock_cut` shelters, several small aprons). Listed in the table as "left out".
- 30 spaces are not reached by the walking flood (7 are real closed rooms: Academy skybridge, Hook garden cottage,
  Gulfhead quay watch, Westmouth canal lodge, Sandgate repair, Confluence supply, Rapids wayhouse). They got no
  chest. Whether those rooms should be enterable is a map question, outside this batch.

## (b) Every road — `census/G1B_ROAD_TABLE.md`

88 GOLD roads (18,967 road tiles; 11,788 outside site footprints), plus 12 bridges, 27 landings and 22 forks found on
the real geometry. **Road chests 26 → 94** (cart 46, trail 22, fork 9, foot 7, landing 6, riverside 2, bridgehead 2).
44 of the 84 land roads carry at least one; the others lie almost wholly inside a site (served by that site's own
chests, never counted twice) or are too short. Spacing is a jittered interval per road type (cart ≈180 tiles,
trail ≈140), moved by the real verge — not a grid. Road chests are Damaged / Low only (raised one step on a remote
or harsh stretch). Not placed: 10 bridges and 21 landings (inside a site footprint or no free verge), 13 forks
(too close to another cache or to a site).

## (c) Economy before / after — `census/G1B_ECONOMY_BEFORE_AFTER.md` (+ `.json` per space)

Exact expectations from the approved pools; odds identical before and after.

| | before | after |
|---|---:|---:|
| chests | 130 | 557 |
| item units, one full sweep of the island | 1,176 | 4,464 |
| gear units, one full sweep | 30 | 107 |
| Creator Cores, one full sweep | 11.1 | 28.2 |
| of which Lv2 + Lv3 | 0.93 | 1.58 |
| Core chance per chest, averaged | 8.5% | 5.1% |
| Cores per game day if every chest were emptied on restock | 7.9 | 23.4 |

| Cores per full sweep | before | after |
|---|---:|---:|
| open sites | 6.45 | 21.02 |
| open roads | 1.27 | 3.10 |
| behind a card / power door | 3.34 | 4.03 |
| danger-1 spaces | 0.96 | 7.13 |
| danger-2 | 6.37 | 10.47 |
| danger-3 | 2.33 | 6.17 |
| danger-4 | 0 | 1.16 |

**Decision for the Creator:** total Cores per sweep rise ×2.55 because Low Supply (4%) and Low Toolbox (5%) chests
carry a Core chance and there are now many of them; 7.1 of the 28.2 come from danger-1 spaces. Nothing was nerfed,
capped or hidden. If this is too generous, the levers that stay inside the contract are placement ones (fewer
Supply / Toolbox chests in safe spaces, more Food / Medical, which carry no Core).

## (d) Saves, gates, floors

- **Old ids kept.** All 130 round-1 source ids are unchanged; 427 ids are added (`…:f0|b1|f1|f2.<room>.NN`, road keys
  `kNNNN` / `fork` / `head` / `ford` / `landing`). `G1B_LAYOUT_REVISION = 2` is stamped in the run.
- **Migration** (`tests/g1b-ecology-runtime.test.ts`): a save with exactly the 130 + 6 objects loads; every old chest
  (closed, partly looted, empty with its timer) is byte-identical afterwards; the 427 new ones arrive closed, empty,
  cycle 0; no item is created; loading again changes nothing. A save missing one of its own chests, a stamped save
  missing a source, a future layout, or a chest moved to another storey is refused.
- **Storeys.** A chest belongs to its storey: from the ground it is not solid and cannot be opened; on its own storey
  it is. Opt-in audit (`G1B_ECOLOGY=1`): all 427 added chests stand on a free tile with a reachable approach, at two
  window origins per site, furniture dressed.
- **Gates** (`tests/g1b-gates.test.ts`, all storeys, stairs included): with the door shut no tile behind it is
  reachable; with it open every gated chest is; nothing un-gated is trapped behind a gate.

  | gate | sealed tiles | storeys sealed | chests behind |
  |---|---:|---|---:|
  | Falls deep (power) | 140 | 0 | 1 |
  | Academy green (card) | 260 | 0, 1 | 8 |
  | Archive purple (card + power + mask) | 81 | 0 | 7 |
  | Archive deep (card + power + mask) | 321 | -1, 0 | 3 |
  | Meridian blue (card + power) | 142 | 0, 1 | 8 |

  The three internal stairs reported as variances in round 1 start and end inside the sealed volume, so they are
  not a bypass. The way out is the door's interior handle (no card, power or mask). The 5 road chests that sit
  inside a site footprint are unchanged from round 1.
- **Furniture.** Round 1 cleared four neighbours of each chest (14,380 → 14,285 props, −95). Now one approach tile
  is kept clear: with 557 chests the map has **14,295** props (−85 against the pre-G1B map; 10 restored).

## (e) Icons, sheen, Core

- **Icons.** The atlas index is the icon source for `<Icon>` / `iconUrl` everywhere in the UI (chest, pack, hotbar,
  tooltip, Core, Workbench). 157 frames; 156 are catalog items and all 156 were shown from the atlas in the real pack
  (`screens2/icons-*.png`, `icons-log.json`: 156 / 156, 0 drawn fallbacks); the 157th, `door_powered`, is a structure.
  - 25 catalog ids have no approved art and keep the drawn icon (tagged `data-icon="drawn"`): brick, coal,
    damaged_drive, fasteners, field_repair_kit, fuel_briquette, herb_roast, iron_sword, keycard, lubricant,
    mechanical_parts, raw_salt, root_broth, salted_meat, salvaged_oil, scrap, seed, stone_bog / frost / grove /
    magma / rust / tide, treated_canvas, vehicle_drive.
  - **Not met as written:** at a 640×360 viewport the slots draw icons at 16 px, so the 32 px art is shown at half
    size (nearest-neighbour, no blur). It is 1:1 only when the page is displayed at 2× or larger. Showing 32 px
    cells at 640×360 needs a slot-size redesign, not done here.
  - In-world sprites (dropped items, held item) still use the old drawn 16 px icons.
- **Sheen** (`src/game/g1b-art.ts`, `tests/g1b-sheen.test.ts`): computed per sprite pixel from the mask — R material
  (metal flashes white, timber / paint only warms, outline never lights), G plane (lid and front are crossed at
  different angles), B bevel, A object mask; three flat steps, nearest-neighbour, nothing outside the object.
  `screens2/sheen-sweep-sheet-x4.png` (rest + 4 moments; High Supply Crate, Low Food Cooler — the only two rows where the camera was fully still; other variants are covered by the test, not by a capture). The render clock was pinned for these frames
  because headless capture is slower than the 0.9 s sweep; pixels are the game renderer's.
- **Core.** Cast with less durability than the skill's wear is refused before ammunition, cooldown, wear or effect
  (`tests/g1b-core-v2.test.ts`; `screens2/core-svc-6-q-refused-too-worn.png`). Pre-V2 loaded energy is converted on
  load into an explicit `owed` list on the Core and paid back into the pack once, with a receipt per transfer; it is
  never cast from. A legacy Core still lying in a loot site or box keeps its `owed` until the player carries it (no
  other container is written to). Core UID is preserved.
  - Found while capturing and fixed: the Core service card was missing from the main Survivor screen (I), so a
    player at a Workbench could not reach Upgrade / Repair. It is there now; at 640×360 the card is reached by
    scrolling the left column.
  - Big Bang's description still spoke of "reload each reserve"; corrected.

## Captures — `screens2/` (640×360, unedited; logs beside them say what QA did)

| what | files | QA help used |
|---|---|---|
| Core rolled by a chest of this run | `core-roll-1…3` | none (the run's own cycle-0 roll was looked up, then opened with F) |
| Upgrade Lv1 → Lv2, same UID | `core-svc-3…5` | bill items and a packed Workbench granted; bench level set to 2 |
| "Too worn" refusal, then Repair +75 | `core-svc-6`, `-7` | durability set to 3 |
| Owed energy paid back into the pack | `core-svc-8` | `owed` set by hand to what the loader writes; the pay-out and its two receipts are the game's (loader path itself: tests) |
| Blue room: refused, card, generator, open, inside, upper storey | `blue-1…8` | 1 Fuel Canister granted; player placed beside each object |
| Refill while offscreen | `refill-1…5` | wait shortened 24 h → 6 s; settlement is the game's own |
| Upper floor, cellar, roof chest | `eco-upper-*`, `eco-cellar-*`, `eco-roof-*` | placed beside the real stair; floor change is a real F press |
| Room, kitchen, yard | `eco-room-*`, `eco-kitchen-*`, `eco-yard-*` | placed beside the chest |
| Road wreck, trail, fork, bridgehead, landing | `eco-road_*` | placed beside the chest |
| 156 atlas icons in the pack, hotbar | `icons-*` | items placed in the pack by hand (this makes that run's save invalid; evidence only) |

Travel between sites in all captures is by QA window shift, not by walking.

## Tests

- Full suite on this batch: 1,296 tests, 1,060 pass, 178 fail, 58 skipped (base: 1,277 / 1,044 / 177 / 56). Compared
  by test identity, two failures were new and both were caused by this batch; both are fixed and their files re-run:
  - `pa1-rev1-queued-jobs` — the first version of the legacy pay-out wrote energy into unopened loot sites holding a
    pre-V2 Core, which made the save invalid. Pay-out now goes to the pack only (new test).
  - `audit-closure` P0-1 — timed out because settlement walked all 563 chest objects every slice. It now walks only
    opened / restocking ones (3.4 s against 4.0 s on base).
  The full suite was **not** run again after these two fixes; re-run: the G1B files, `creator-core-foundation`,
  `pa1-rev1-queued-jobs`, `audit-closure` (its one remaining failure, P0-4, is in the base too).
- `tsc` clean; production `vite build` succeeds (it failed mid-batch on the atlas import, fixed).

## Not done / open

- Card-room traversal was proved on geometry (flood over all storeys) and by the round-1 door tests; there is no
  capture of a failed roof / stair bypass attempt, and only the Blue room was re-captured in this batch.
- No capture of a round-1 save being loaded into layout revision 2 (tests only).
- One capture run showed "Save refused: integrity check" once after Take all at the Academy toolbox. Two other
  occurrences were traced to the capture script (it selected a backpack slot as the active hotbar slot). The
  Academy one was not reproduced in 30+ later opens and is unexplained.
- `CoreStackV2.reserves?` is still declared in `g1b.ts` (unused by V2 logic).
- 13 "left out" spaces, 7 unreachable closed rooms, 13 forks / 10 bridges / 21 landings without a cache (above).
