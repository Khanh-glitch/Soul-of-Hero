# MAP-LR02 — Veyra physical world production

Map designs the physical world; Gameplay populates and simulates it. LR01 is the
**pinned parent** (`world_lab/lr01/output/geography_package.v1.json`, digest
`e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63`) and is never
overwritten. Every coordinate stays in the original `2000×1400` authoring frame.

```
src/lib/lr02.mjs               pinned parent loader, constants, geometry helpers
src/lib/portal_geometry.mjs    reusable opening-aware static geometry compiler (M1)
src/lib/spawn_eligibility.mjs  deterministic geography-only eligibility compiler (M2)
src/lib/negative_tests.mjs     deliberately invalid inputs must fail explicitly
src/m0_greywater.mjs           EARLY bounded Greywater consumer package (M0)
src/test.mjs                   reproducible gates
reproduce.sh                   regenerate + test
docs/GAMEPLAY_HANDOFF.md       factual consumer handoff
output/greywater_spatial_patch.v1.json
```

Run:

```
cd world_lab/lr02
./reproduce.sh
```

The compiler reads LR01 `poi_layouts.v1.json`, canonical Veyra GOLD via pinned
git object, and GEO-01 `250×175` uint8 rasters. It clips continuous walls into
true solid spans, grounds each portal on the real wall/room boundary, and emits
static holes separately from Gameplay-owned dynamic door state. Open-air POIs
remain non-solid yards. All 81 POI layouts are exercised; vertical links are
reported as `UNRESOLVED` rather than fabricated into physical openings.

Statuses are kept distinct: `SOURCE_AUTHORED`, `DERIVED`, `PROPOSED`,
`VERIFIED`, `BLOCKED`, `UNKNOWN`, `UNRESOLVED`, `INVALID`. U=1.6 / U=2.0 are
**diagnostic same-origin projections only**; no world scale is approved.
