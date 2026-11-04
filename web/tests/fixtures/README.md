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
