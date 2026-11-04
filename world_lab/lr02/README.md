# MAP-LR02 — Veyra physical world production (M0–M5)

Map designs the physical world; Gameplay populates and simulates it. LR01 is the
**pinned parent** (`world_lab/lr01/output/geography_package.v1.json`, body digest
`e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63`, whole-package
SHA `ac9317ae385d47327f02765e4b2e8ca8465c504f3c7146737ab3ff9b91952eb4`) and is
never overwritten. M0 revision 1 is also immutable
(`db5bcc3dcf28210fa63e9a68cdf2128a7f76213bead7d1e975bbb901b50cfe1a`); the generator's
default `GUARD` exits 2 rather than rewriting it. Every coordinate stays in the
original `2000×1400` authoring frame.

```
src/lib/lr02.mjs                 pinned parent loader, constants, geometry helpers
src/lib/portal_geometry.mjs      reusable opening-aware static geometry compiler (M1)
src/lib/spawn_eligibility.mjs    deterministic geography-only eligibility compiler (M2)
src/lib/negative_tests.mjs       deliberately invalid inputs must fail explicitly
src/lib/world_architecture.mjs   transport / bridge / dock / region evidence (M3)
src/m0_greywater.mjs             bounded Greywater consumer package (M0, --verify)
src/m1_portals.mjs               all-81 POI static geometry (M1)
src/m2_spawn.mjs                 whole-Veyra eligibility + build envelopes (M2)
src/m3_architecture.mjs          broader physical architecture (M3)
src/m3b_regions.mjs              region static geometry + cellIndices export (M3b)
src/m4_visual.mjs                Web-language portable art layers + 640x360 pairs (M4)
src/m5_package.mjs               source-preserving v2 package + inputs + docs (M5)
src/test.mjs                     46 reproducible gates
reproduce.sh                     regenerate + test
docs/GAMEPLAY_HANDOFF.md         precise factual consumer handoff
docs/EVIDENCE_M1_M5.md           M1–M5 evidence
docs/MILESTONE_M4_VISUAL.md      visual production method + classification
output/greywater_spatial_patch.v1.json   M0 published rev1 (immutable)
output/portal_geometry.v1.json            M1
output/spawn_eligibility.v1.json          M2
output/world_architecture.v1.json         M3
output/region_static_geometry.v1.json     M3b
output/resource_inputs.v1.json            M5
output/population_inputs.v1.json          M5
output/geography_package.v2.json          M5 (embeds full LR01 v1 verbatim)
output/visual/                            6 real Web screenshots, 6 SVG wall layers,
                                         6 native 640x360 before/after pairs
```

Run:

```
cd world_lab/lr02
./reproduce.sh      # EXIT=0, LR02_TESTS 46/46
```

The compiler reads LR01 `poi_layouts.v1.json`, canonical Veyra GOLD via pinned
git object, and GEO-01 `250×175` uint8 rasters. It clips continuous walls into
true solid spans, grounds each portal on the real wall/room boundary, and emits
static holes separately from Gameplay-owned dynamic door state. Open-air POIs
remain non-solid yards. All 81 POI layouts are exercised; vertical links are
reported as `UNRESOLVED` rather than fabricated into physical openings.

M2 supplies bounded AREAS and `cellIndices`, never a runtime spawn point. M3
reports measured bridge/road/dock evidence with explicit `PROPOSED`,
`UNRESOLVED`, `UNKNOWN` and `BLOCKED` statuses; no width, swept clearance or
cart-passability rule is canonized. M3b exports roof polygons as `UNRESOLVED`
because LR01 has only coverage descriptors — no invented canopy. M4 preserves
the original Web pixel art (no third-party sprites) and clearly separates
(1) real Web screenshots, (2) Map-only analytical previews and (3) Web-rendered
integration proof (`NOT_AVAILABLE__GAMEPLAY_OWNED`). M5 embeds the complete LR01
v1 package verbatim with all LR02 additions in a separate namespace.

Statuses are kept distinct: `SOURCE_AUTHORED`, `DERIVED`, `PROPOSED`,
`VERIFIED`, `UNKNOWN`, `UNRESOLVED`, `BLOCKED`, `INVALID`, `UNDECIDED`.
U=1.6 / U=2.0 are **diagnostic same-origin projections only**; no world scale,
playable Veyra, final world or creator approval is claimed.
