# Clean-room proof — no GOLD, no MapLab, no network, no Gameplay write

## Design

`data/` is self-contained: 117 files, SHA-256 pinned by `data/source_manifest.v1.json`.
The **only** GOLD/MapLab reader is `migration/migrate.mjs`, which performed the one-time
migration. It is idempotent: a rerun reuses the embedded byte-identical GOLD copy and never
touches the pinned git object again (`gold.readCount=1`).

`build.mjs`, `lib/`, `api/`, `tests/`, `tools/`, `reproduce.sh` and `clean-room.sh` import
only from `data/`, `layers/`, `rasters/`, `manifest.v1.json` and each other. They are
statically scanned for GOLD commit, MapLab paths, `git show`, `child_process`, `execFileSync`,
`fetch`, HTTP(S), `../web/` and `bible.md` references (test `M-G1-01`).

## Isolated reproduction

`./clean-room.sh` creates a fresh temporary directory and copies **only**:

```
data/  lib/  api/  tools/  tests/
build.mjs  reproduce.sh  clean-room.sh  README.md  docs/
manifest.v1.json  layers/  rasters/  evidence/
```

It explicitly **excludes** `migration/`. In that isolated tree it runs:

```
node build.mjs
node tools/views.mjs
WMP_CLEAN_ROOM=1 node tests/run.mjs
```

and compares the isolated `manifest.v1.json` `revisionDigest` with the source tree's.
`WMP_CLEAN_ROOM=1` additionally asserts at runtime that `migration/` and `world_lab/` are
absent (test `M-G1-02`). No `git` command, no `gh` command and no network call is made by
any clean-room script.

## Results

`evidence/clean_room.log` and `evidence/tests/test_results.v1.json` are the artifacts.
`evidence/build_determinism.v1.json` records two consecutive `node build.mjs` runs with
identical `revisionDigest` values.

## Boundary

Clean-room proof shows this candidate compiles, queries, renders technical views and passes
its own gates without GOLD/MapLab/network. It does **not** show Gameplay runtime ingestion,
independent CI at an exact SHA, visual acceptance or playable Veyra. Control Tower
`6621099995` already noted that agent-run tests are not independent CI passes; that remains
true here.
