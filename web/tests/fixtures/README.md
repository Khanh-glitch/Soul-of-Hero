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
