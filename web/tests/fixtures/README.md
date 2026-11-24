# Original gameplay save fixture

`3b37ae9-legacy-pair.json` was generated with the actual `web/src/game` modules at
`3b37ae90601dee098066cbc4cf465552f1eb6f04`. It contains two complete raw v3
snapshots from the same seeded run (female, region 0, seed 123). The fixture seeded
17 secured cash and used the original dispatcher to create an earlier abandoned run.
A research table and 15 spares were placed as a test fixture, then the original `dispatch` queued
`bow` research, consuming its inputs as the original code did. The `earlier`
snapshot was serialized; the original `tick` then advanced 50 ms and saved the
`later` snapshot. The two have the same original revision but distinct simulation
clocks and an old-style queued job without `reserved`. This is a deterministic
state fixture, not a normal-input browser journey or player-acceptance evidence.

`7b9805b2-shipping-v3.json` is an actual unmodified shipping run produced and
serialized by the archived `7b9805b2ff276d07121063b6dfb2f68a902605db` engine:
male, region 0, seed 555, at 2026-11-01T00:00:00.001Z. It records the old
starter geometry and source identity before fresh-layout spawn removal. Tests
clone this real historical snapshot when exercising v1/v2 compatibility rather
than changing the identity of a new run. It is not a browser playthrough.

`7b9805b2-veyra-v3.json` was made by the archived `7b9805b2` engine from a
normal seeded U=2 Greywater LR01 start and serialized before LR02 integration.
It proves the old distinct layout and digest remain loadable, not that the old
unpatched POI geometry was complete.

`pa1-rev1-queued-jobs.json` is the PA1 P0b pre-cutover fixture: a real run captured by the engine at
`023ec62`, AFTER the recovered-paper recipe cutover landed in the catalog but BEFORE that engine knew
anything about recipe revisions. Nothing in it was hand-authored into a queue: a paid level-2 Workbench
was upgraded, a revision-1 Metal Pipe was crafted, collected and then eaten by a revision-1 Iron Plate,
the retired bench Fuel Canister formula was learned from a real blueprint bought with 9 Spares, and three
paid jobs plus one in-flight study were left unfinished when the snapshot was taken. The `earlier`
snapshot is mid-flight; the `later` snapshot is the same run after that engine's own 60-second settle,
which is what lets `tests/pa1-rev1-queued-jobs.test.ts` compare two engines over the same window. The
saving engine had no `rv` field at all, so the absence of a per-job stamp in this file is a property of
the capture, not a mutation — and it is asserted as such. `source` records the capture recipe, the
paid bills and the reserved stack UIDs. Reproduce it with `../tools/PA1_REV1_CAPTURE.md`; do not edit the
JSON to make a test pass, and do not replace it with a save built by the current engine.
