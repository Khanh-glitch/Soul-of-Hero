# A7 limitations — what this checkpoint does not prove

Every item below is `NOT_TESTED` unless stated otherwise. Nothing in this list is "probably fine"; it is
unknown, and no artifact in this repository should be read as claiming otherwise.

## Where the player-readiness claims stop

- **Static reads only.** `results/product.json` is computed from 18 sha256-pinned files plus a tree-wide index.
  "Mounted" means a production scene references the file; it does **not** mean the scene runs, draws, accepts
  input or survives a reload. Every such question is `NOT_TESTED`.
- **The product snapshot can go stale.** It pins A0 `9d287f33` and A6 `8bc561df`; if either owner moves, the
  audit describes the pinned commits, not their head. Re-run
  `python3 tools/survival/balance/build_product_snapshot.py` to move the pin deliberately.
- **Two blockers depend on assets A7 cannot see.** The locked avatar bodies (Craftpix 555940 / 419402) and the
  gender-matched armour-1/armour-2 stages live in the user's Drive folder. Their absence from production code is
  verified; their *existence and licensing* is not, and the armour stages are `SOURCE_BLOCKED` rather than
  assumed.
- **Five blockers are not a complete bug list.** They are the observations that stop a player today. Fixing them
  makes the loop reachable, not good: feel, pacing, readability at 720p–4K and whether a Core is exciting stay
  unmeasured until a human plays.

## Engine / native

- **No Godot run.** No scene, no `SaveService`, no inventory, no death, no station, no POI interaction was
  executed. `ANALYSIS_COMPLETE` describes the analysis, not the game.
- **No native loot pickup, container open, chest transfer, or reload test.** Duplication is prevented *in the
  model*; A0 still has to prove it in the real save.
- **No collision or topology validation.** A1 polylines are treated as walkable. Cliffs, props, water and
  collision gaps outside the graded corridors are not modelled.
- **Boat speed is `NOT_AUTHORED`** in A1; the tool uses foot speed as a lower bound and says so in every
  artifact. Two edges are `boat`/`pass` mode.
- **No performance or memory measurement.**

## Human

- **No playtest.** Comprehension, fun, curiosity, "is a Core exciting", readability at 720p/2K/4K and session
  pacing are all unmeasured.
- **The "unlucky player" is a probability, not a person.** 16.6% of claims missing both knowledge items is
  arithmetic; whether that feels bad is unknown.
- **The 6-trips-per-45-minutes figure is accounting**, not observed cadence: combat, reading, planning, menus,
  death and recovery are excluded from the model and listed as `unmodelled_time` in every trip row.
- **A3's 14-session model is not a human sequence.** It is a sparse scenario/conservation model; this checkpoint
  never treats it as evidence of engagement.

## Data the model deliberately refuses to invent

- **Core drop rates: absent.** No authored table can emit a `core`-tagged item; there is no rate to measure.
  The probability grid is labelled `HYPOTHETICAL_NOT_A3_TUNING` and its "eligible containers today" input is
  derived as `0`.
- **Death chance for band-labelled risk:** unmodelled. `early/mid/late` carry no severity, and A3's death keys
  cover 6/130 edges. Rows show `null` instead of assuming 0.
- **Cargo recovery:** A0's death-bag behaviour is not native-accepted, so 0/50/100% retention hypotheses are
  reported side by side instead of one chosen number.
- **Item prices / gold value:** the economy has no currency; usefulness is expressed structurally (does a unit
  feed an authored recipe/technology, or is it terminal-use), never as a price.
- **Combat duration and enemy density:** absent from A1/A3; no combat-time or risk-weighted loot value is
  produced. "Risk" is only reported as the declared label plus, where available, A3's per-traversal death
  assumption.

## Scope edges

- Only **2 loot tables** and **36 sources** exist; a table's behaviour outside those is unknown.
- "Reachable" = reachable in the authored route graph under the stated capability set. A POI being reachable
  does not mean it is enterable in a build, spawnable, or populated.
- The **10 legacy dungeon POIs** are outside the new route graph (no node). Their loot is Chapter-1 existing
  rewards, which are `LIVE_EXISTING_REWARDS`, not A3 loot; the tool keeps them on a separate ladder.
- **Interpretation risk:** A3's JSON does not state whether `rolls` are with or without replacement. The tool
  uses with-replacement and reports the without-replacement reading beside it, because the gap is material
  (e.g. `P(≥1 spare)` 0.657 vs 0.856).
- The **snapshot** is a point-in-time copy. If A1/A3 push new heads, `run_analysis.py --check` will not detect it
  by itself — `verify_upstream` will, on any machine where those commits are fetched, and the manifest must then
  be re-pinned deliberately.
- **Docs sync is partial.** Google Docs tab 04 was written and read back on 2026-10-30; the GitHub Issue #16
  status comment is `DOCS_SYNC_PENDING` because the session's integration returns
  `Resource not accessible by integration` on issue writes (see `DOCS_SYNC_PENDING.md`).

## What would change the conclusions

| If this becomes true | Then this changes |
|---|---|
| A1 binds the 16 loot sources to real POIs | F-01 closes; §9 becomes measurable rather than hypothetical |
| A native, non-loot source of `knowledge_spares` exists | F-02 closes; the native ladder can reach research |
| `risk` is separated into severity + band | F-03 closes; cargo-loss expectation becomes computable everywhere |
| A1 authorises reward quantities (or A3 stops assigning them) | F-04 closes |
| An L1-S supply-container class is authored and placed | §9 becomes a real probability question; this tool already accepts the table |
| A0 proves partial cargo recovery | death rows collapse to one hypothesis |
| A4 attests a Gold cast | Cores can be discussed as usable skills instead of catalog entries |
| Any human plays it | everything above about feel/pacing is still unknown until then |
