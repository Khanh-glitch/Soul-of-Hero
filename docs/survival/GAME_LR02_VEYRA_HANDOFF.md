# GAME-LR02 — bounded Veyra Web integration handoff

**Status: partial / draft / not accepted / do not merge.** Gameplay runtime and
browser evidence milestone `e0294889ad522ded3b42e92cfea197c057344afc`; the
handoff/evidence refresh is a later commit on the same branch. Draft PR #44.
This remains the existing SOH Web game, not a new game, a full-world streamer,
or an approved Veyra scale. Player-visible quality and design acceptance still
require Creator/independent review.

## Provenance and ownership

- Stage 1: Map branch `arena/2e3cfbd2-soul-of-hero` at
  `74062a5baf2731451fad9638c4243c7459ce8e24`, source
  `world_lab/lr01/output/geography_package.v1.json`, schema
  `soh.map.lr01.geography_package.v1`, v1/r1. Raw SHA-256
  `b4cc77228caf847d1ad0d8a680457ca65731202513a047826e8bd973662e19ad`;
  insertion-order `JSON.stringify(body)` digest
  `e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63`;
  canonical GOLD SHA-256
  `88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256`.
  `web/geography/veyra-lr01/README.md` lists the exact 79 payloads, 21 rasters,
  schema and integrity method. Independent intake validates these without
  treating the mixed gameplay handoff as geography-only.
- Greywater M0b: Map commit `3c073d9da07b0ad936a57293a51dbba968a885dc`,
  unchanged `greywater_spatial_patch.v1.json`: raw SHA-256
  `2a9cfcc4360cd62088c4e938fa04f53a99aae6c0a8f2749580453869c502be78`,
  body `db5bcc3dcf28210fa63e9a68cdf2128a7f76213bead7d1e975bbb901b50cfe1a`.
  Map-owned proposed static walls/openings and 107 eligible source cells are
  kept distinct from gameplay's sampling, terrain collision and dynamic states.
- M2: Map HEAD checked at `05f25672da61b4009f38c9a963e2652004dbdf51`,
  unchanged `spawn_eligibility.v1.json`, schema
  `soh.map.lr02.spawn_eligibility.v1`, r1. Raw SHA-256
  `377d5452579d638711bb41fbedcab5dafc98af2c17327a90ec954b8c277a19b9`,
  body `637dd4e8706133773d1fe58643b74386a3832f7acbe5d00b5ec91ecc7a1573fc`.
  The 16 regions / 5,151 source 8-AU cells are static candidates only.
  LR01 parent/canon, checksums, membership, uniqueness, bounds and version
  are checked before projection. Oasis gates runtime safety on these cells.
- Map HEAD also provides `portal_geometry.v1.json`, `world_architecture.v1.json`,
  and `region_static_geometry.v1.json`; **these newer M1/M3/M3b outputs are
  not consumed**. Their reported proposals, vertical-link exceptions, bridge
  conflict and missing roof polygons must not be represented as shipped runtime
  functionality. See Map's files at that exact SHA for their own evidence.

## Gate status

| Gate | Evidence and remaining gap |
|---|---|
| G0 | Independent LR01/M0/M2 intake and negative corruption tests pass. Source artifacts are copied unchanged; runtime saves pin the chosen commits, hashes, origin, and U. |
| G1 | Greywater bounded `[640,440]` AU origin at U=1.6 and U=2; Oasis `[400,840]` at U=2. Each is an independent 200×200 gameplay window into the 2000×1400 source frame, not a scaled fake world or a full-world runtime. Tiles map source land/lakes/rivers/roads, 8-AU biome/elevation raster and IDs. 9-AU analysis stroke and biome/height interpretation remain provisional, not Map-approved physical width or height. |
| G2 | Existing sprites, trees, waves, HUD and character render in real browser game frames; `compare-*.png` compares against archived `b76d4091` shipping game, at both viewports. Images are different spawn locations, not matched canonical viewpoint. Greywater POI walls rasterize into noticeable stair-stepped tile segments and roofless rooms; this is not a claim of architectural visual quality or art-direction approval. |
| G3 | Run-seeded distinct positions, membership in Map candidate area, dynamic blocking/creature/hazard and nearby survival/build access checks. No `sp_*` spawn authorization, four fixed starts, starter compound/crate or forced corridor for new runs. Default respawn resamples; paid owned bed preferred with physically safe fallback. Genuine historical shipping and Greywater v3 snapshots and old fingerprints remain loadable. Oasis uses separate M2 eligibility and all windows preserve their own identity. |
| G4 | M0's 15 clipped solids physically block movement/LOS; 8 openings remain holes, not invented dynamic doors. Controlled collision ticks enter all six room centres at both U values and negative LOS is checked; real browser keyboard from seeded starts also reaches the Map entrance and one source room, saving and reloading. Player-built enclosure/roof, local generator/turret and authoritative build/upgrade/repair/device wall access retain K6 regression tests. Map-specified partial canopy has no polygons: no whole-footprint roof invented. No proof of all door clearances, vehicle widths or other POIs. |
| G5 | 640×360 and 1280×720 new run, movement, save/reload: Greywater both scales and Oasis. Natural U2 runs use read-only BFS and actual keys/mouse, with NPC/weather active: bush stock 3→0 and no extra yield; harvested two oaks and one rock, paid a 10 wood/5 stone claim, reloaded; separately walked to freshwater and used E for a persisted `drink` receipt. Data/screenshots under `web/evidence/veyra-lr02/`. A controlled paid-bed wall fixture and portal room test are explicitly not natural play. These automated routes are not an independent human sandbox/enjoyment test. |
| G6 | Oasis adds a distinct biome/geographic window and M2 candidates. There is **no cross-window transition, shared world identity/source authority, seam traversal, source de-duplication across windows, continent streaming or world-scale lifecycle proof**. Do not claim whole Veyra or duplicate-free transfers. |

## Browser and performance evidence

`web/e2e/veyra-terrain-smoke.mjs`, `veyra-poi-natural.mjs`,
`veyra-natural-harvest.mjs`, `veyra-natural-build.mjs`,
`veyra-natural-water.mjs` and `veyra-comparison.mjs` record real browser UI
and screen pixels. The route planners inspect live state without changing it;
the actual actions are keyboard/mouse. The portal trail's minimum sampled
entrance distance was ~1.54 AU / ~1.60 AU in the latest two runs. Screenshots
are evidence, not Creator acceptance; one claim frame still has build mode
active and an exhausted-source toast.

Latest sequential headless Chromium stationary-rAF samples (1.5 s warmup, 5 s
measurement, on sandbox; page-to-run includes networkidle):

| viewport | preintegration | U=1.6 | U=2.0 |
|---|---:|---:|---:|
| 640×360 FPS / start ms | 60.21 / 2315 | 60.06 / 4674 | 60.24 / 3634 |
| 1280×720 FPS / start ms | 60.17 / 2233 | 60.13 / 3482 | 59.84 / 3375 |

Not a gameplay/GPU benchmark, matched camera comparison or scalability claim.
Comparison needs the archived pre-integration server at port 4193; current
scripts default to 4191. Supply `CHROMIUM_PATH` and library paths as needed.

## Regression and review risks

- `npm test`: **24 files, 215 tests passed**; `npx tsc --noEmit`, Vite build
  and `npm audit --audit-level=low` pass; no audit vulnerabilities. Build
  output 3,389.33 kB / 648.53 kB gzip is a bundled single HTML, not committed.
- Starting knife gained global `stone:1` power to resolve a stone-pick bootstrap
  deadlock. It takes 18 contacts to deplete a six-stock rock, consumes
  durability and does not harvest ore. This changes balance on all layouts and
  explicitly needs gameplay review; it is not a Map decision.
- Existing K1–K8, economy v3 custody, local 336h/Ragnarok, Garden Tender,
  ecology/fire and bounded trace/AI suites are regression-tested, not proof of
  online multiplayer or every possible emergent case. Turret online tests do
  not imply invented offline kills/ammo.
- Road/rivers' physical width, bridges, ferry, cargo clearance, static door
  behavior, exact roofs, elder territory and source-region architecture need
  their respective owners' contracts and integration. In particular, M3's
  proposed bridge deck is not applied.
- Review spawn diversity at more seeds and different ecological states; a
  temporarily blocked map can honestly refuse respawn. Check roof semantics,
  native visual quality, UI readability and actual human play; test remote
  device performance and any proposed future cross-window save migration.
- The prior `veyra-oasis-u20` diagnostic ID remains valid; new starts move to
  the distinct M2-pinned Oasis ID. Old LR01 Greywater IDs remain loadable and
  migrate only *new* starts, not saved runs.
