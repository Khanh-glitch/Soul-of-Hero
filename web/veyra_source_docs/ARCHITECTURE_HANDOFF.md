# VEYRA LANDMARKS — implementation handoff (v8)

## 1. What changed in the playable game

| Area | Change |
|---|---|
| `src/veyra05/arch/plan.ts` | Rebuilt compiler. A **structure** is one building mass; **rooms** are named spaces inside it, so neighbours share a wall instead of being sealed by two. Explicit **partitions** are the only interior walls, `barrier` structures (flood wall, gate pylons, perimeter) are never validated for doors, `carve` rooms (crawl, skybridge, catwalk, conveyor, culvert) are corridors cut through their own mass. |
| `src/veyra05/arch/plan.ts` | **Compile-time circulation proof** — per structure per level, a flood fill (doors passable, as they open in play) must reach every room, door, stair landing and cache; every main/service door must have an interior side and open onto paved ground; every stair must have floor beside both landings; every cache must stand on floor. Failures are returned as `issues` (and shown in the Inspector), never hidden. |
| `src/veyra05/arch/sites.ts` | All three compounds re-authored to the new DSL, grounded on the real sampler: Greywater village paving `1586,1160 → 1663,1208`, Argus academy paving `1842,502 → 1907,553`, Ironholm works paving `2348,2552 → 2409,2591` (all confirmed dry in the Node land test). |
| `src/veyra05/arch/interior.ts` | Auto-partitions removed (they could seal a room). Piers removed from walkable floor. Furnishing now skips circulation decks (catwalk, bridge, conveyor, deck, lane, avenue, quad, yard, spur). |
| `src/veyra05/floors.ts` | Authored caches are a separate `lootStatics` fixture list installed **only for Creator Inspection** (`r.qaUsed`) — no unauthorised survival loot. |
| `src/game/render.ts` | Storey lighting: cellar = soot with warm lamp pools; upper = cool daylight shafts; off-plan terrain 78–92% scrim; upper-storey roofs at 0.55 alpha so masonry stays readable; railings on every open elevated edge. |
| `src/veyra05/decor-client.ts` | Ground decor and biome landmarks are suppressed on non-ground storeys (no grass tufts floating in a cellar). Door leaves are passable for the inspector's route finder, matching the fact that a player presses **E**. |
| `src/game/persist.ts` | Door/generator matching is now storey-scoped for `veyra05-*` layouts, so a save on an upper floor validates. |
| `src/game/engine.ts` | `startRun(inspectAt)` places the inspection camera at the nearest legal walkable tile to the chosen landmark and marks the run QA; live runs are untouched. |

## 2. The three landmarks

**Greywater Hamlet** — village green, north cart lane, east drying yard, lake path; flood wall with a single cart gate (barrier, purposeful); longhouse hall + west wing with a sleeping loft; fisher's cottage with a net room; granary with grain store, drying loft and roof lookout reached by an **outside stair**; smithy with a forge yard; boat shed. Beneath: longhouse cellar → smugglers' crawl → cottage smoke cellar, with a second street-level exit via the cottage ladder. Four levels.

**Argus Academy** — ceremonial forecourt and gate pylons; cloister quadrangle; T-shaped great hall (nave, transept, vestry) with an upper gallery; library reading room + stacks with a map room above; a **skybridge** linking gallery and map room across the quadrangle; three-stage observatory tower with an open deck; paved service yard and generator shed; sealed archive under the vestry plus an **archive service corridor** exiting through a yard hatch. Four levels.

**Ironholm Foundry** — cut gate and rail spur; ore yard and tipple tower (base → screen floor → head deck); conveyor bridge; casting hall with a furnace row and a **crane catwalk loop** with two stairs; pay office (clerk's floor → foreman's floor); flooded pump adit under the hall with a pump house and a river culvert that loops back to an ore-yard hatch. Four levels.

## 3. Verification — only what was actually walked

`scripts/qa-arch.mjs` drives the built single-file HTML in Chromium with real `keydown`/`keyup` and `E`. Player coordinates are never written by the harness.

`evidence/arch-report.json` — **stair transitions reached physically (latest complete run)**

| Site | PASS | Not reached in that run |
|---|---|---|
| Greywater | cellar 0→−1; cottage exit −1→0 | loft 0→1, granary loft 0→1, roof deck 1→2 |
| Argus | gallery 0→1; gallery down 1→0; archive 0→−1; service exit −1→0; observatory drum 0→1; deck 1→2 | vault walk (door not opened by the harness) |
| Ironholm | catwalk 0→1 | south stair, adit, yard exit, tipple, head deck (harness stalled after the catwalk; a manual debug run proved north→south catwalk travel works) |

`tests/veyra05-architecture.test.ts` — 10/10: **0 compiler issues** for all three compounds, all floor on dry canonical land, ≥4 stairs and ≥3 levels each, rooms retain identity inside shared structure walls.

**Honest status:** the compiler now proves every authored staircase, cache and room is connected on paper, and Argus was fully traversed vertically in the browser. Greywater's loft/granary and Ironholm's secondary verticals are **authored, validated and rendered but not yet demonstrated end-to-end by the automated browser walker**. That is a harness/route-selection gap, not a claimed success — see `evidence/shots/arch/*FAILURE*` if present.

## 4. Evidence files
- `evidence/shots/arch/` — 72 native 640×360 PNGs (+ 1280×720 browser views) per site: arrival, interiors, vertical transitions, discovery routes.
- `evidence/arch-report.json` — per-step route record.
- `SoulOfHero-Veyra-Landmarks.html` — standalone build, open directly; it inlines all JS/CSS/art (no server). Limitation: ~30 MB, Chromium/Firefox recommended, and Creator Inspection is an isolated fixture that deliberately does not write the player save.

## 5. Next required action
Give the automated walker per-leg validation and a door-aware planner, then re-run all 18 vertical legs; if a leg still fails, the plan must be corrected rather than reported as complete.
