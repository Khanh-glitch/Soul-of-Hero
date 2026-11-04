# ACTIVE CURRENT SOURCE — WMP-04R1 ROCK/SNOW CORRECTION

Read `CURRENT_WORLD_MASTER.json` then `api/current.mjs`. **Snow 23.0058%**, rocks **510/510 restored**, inward snow tail removed beyond AU Y600. [Evidence & asset reuse decision](v4/r1/docs/ASSET_REUSE_AND_MAP_CORRECTION.md) · [before/after SVG](v4/r1/evidence/snow_and_rock_before_after.svg).

**Do not request new asset for snow/ice/cliff/water/stone/crops already rendered or drawn by SOH.** Native Web already contains `T.SNOW`, `T.ICE`, `T.CLIFF`, `S.snowpine`, `S.rock` etc. WMP-04R1 is static Map data, not gameplay or visual acceptance.

---

# CURRENT VEYRA WORLD MASTER — WMP-04 (creator geography update)

**Active source:** [CURRENT_WORLD_MASTER.json](CURRENT_WORLD_MASTER.json) → [WMP-04 manifest](v4/manifest.v4.json) → [current runtime read API](api/current.mjs).

**Effective design:** snow biome 24.0% of dry land; original desert+scrub +30.0% relative to baseline; western deadly sea/unique aquatic creature geography; Beacon Rock engine-out helicopter; hot Cinder strait; open-water free movement geography with fixed docks. [Before/after map](v4/evidence/biome_marine_before_after.svg) · [handoff](v4/docs/CONTROL_TOWER_HANDOFF.md).

**Read this first:** The WMP-01 text below is the *historical frozen source description*, not the active biome layer. WMP-02 and WMP-03 are preserved in their versioned folders. Consumer code must use `api/current.mjs` rather than direct historical WMP-03/EconomyMap for current geography. Marine dynamic gameplay (AI, watercraft, collision, thermal damage, loot and save) remains unimplemented. No claim of native visual/gameplay acceptance.

---

## Archived WMP-01 README (verbatim below)

# Veyra Physical World Master — WMP-01 / MAP-LR03 candidate

**Authority:** `MAP_DESIGNS_THE_PHYSICAL_WORLD__GAMEPLAY_POPULATES_AND_SIMULATES_IT`

This directory is a **self-contained physical world master candidate** for Veyra. It is
generated from `data/` only. It does **not** require GOLD, MapLab, `world_lab/`, the
Gameplay branch, `web/ref/bible.md`, git history, or network access for ordinary
compilation, inspection, queries, views, tests or later Map production.

Status: `MAP_MASTER_CANDIDATE_PARTIAL_BLOCKED`. **Not** `WORLD_MASTER_SEALED`,
`VEYRA_PLAYABLE`, `VISUAL_ACCEPTED` or `MERGE_READY`.

Final `manifest.v1.json` revision digest:
`8e3e76da5b7f8db35c66322b0236ef37599b4d2dfbe381ea7b2e5ae176d38e4f`
(`WMP_TESTS 75/75`, isolated clean-room `75/75`, identical digest).

## What is here

| Path | Purpose |
|---|---|
| `data/` | 117 embedded, SHA-256 pinned files: verbatim GOLD bytes, 12 canonical geometry collections, 21 GEO-01 rasters, 5 MapLab masks, LR01/LR02 artifacts, 6 genuine Web PNGs, `source_manifest.v1.json` |
| `migration/migrate.mjs` | The **only** GOLD/MapLab reader. One-time source-preserving migration, idempotent, never used by the clean room |
| `lib/wmp.mjs` | Clean-room primitives: typed I/O, digest verification, geometry, statuses |
| `build.mjs` | Deterministic compiler: `layers/*.v1.json` (12) + `rasters/*.u8` (32) + `manifest.v1.json` |
| `manifest.v1.json` | **One authoritative manifest** with full child digests, source integrity and gate references |
| `api/world.mjs` | Typed versioned queries: `groundAt`, `waterAt`, `terrainProfile`, `climateBaselineAt`, `traversalCandidateAt`, `resourceSiteCandidates`, `buildEnvelopeAt`, `poiGraph`, `habitatAt`, `visualSurfaceIds`, `chunkInfo`, `featureInfo`, `scaleInfo`, `endgameRoutes`, `decisionRegister` |
| `api/intake.mjs` | Chunk-aware Gameplay intake contract + bounded window projection (candidate geometry only) |
| `tests/run.mjs` | Gates M-G0..M-G5, 12 executed negative fixtures, generated gate/decision/blocker docs |
| `tools/views.mjs`, `tools/png.mjs` | Deterministic technical views (pure Node PNG writer), no browser/network |
| `evidence/views/` | 15 MAP-ANALYTICAL views + index |
| `evidence/web_real/` | 6 byte-preserved genuine Web runtime captures, classified separately |
| `evidence/windows/` | Chunk-aware window mask files produced by `projectWindow()` |
| `evidence/tests/` | Test results and executed negative fixtures |
| `evidence/artifact_index.v1.json` | Supplementary SHA-256 index of evidence/docs/code |
| `docs/` | Gates, blockers/owners, decision register, intake contract, views, clean room, final handoff |
| `reproduce.sh`, `clean-room.sh` | One-command reproduction and isolated no-GOLD reproduction |

## Commands

```sh
cd veyra-world-master
./reproduce.sh        # build x2 (determinism), views, tests, clean-room proof
./clean-room.sh       # isolated copy WITHOUT migration/ or any GOLD/MapLab source
node build.mjs        # deterministic compiler only
node tests/run.mjs    # gates M-G0..M-G5
node tools/views.mjs  # technical views
```

To query:

```js
import { createWorld } from './api/world.mjs';
const W = createWorld();
W.groundAt({ atAu: [790, 622] });
W.traversalCandidateAt({ atAu: [732, 652], bodyProfileId: 'BODY-CART' });
W.poiGraph({ poiId: 'po_academy' });
```

## Frame and facts

2000×1400 authoring units, 250×175 cells at 8 AU, 579 source feature IDs, 8 landmasses,
12 source biome codes (including three forest variants), 5 lakes / 17 rivers / 92 roads /
12 bridges / 27 docks, 81 POIs / 24 archetypes, 23 zones, 280 habitat markers, 6 distinct
Elder territories, LR01 210 rooms / 410 walls / 235 portals / 18 deep cases, LR02 463 solids /
169 openings / 16 spawn regions / 5151 eligible cells.

The authoring unit is **not** proven metres and the runtime scale is **UNDECIDED**.
Raw elevation bytes are not proven metres; raw slope bytes are not degrees. U=1.6 and
U=2.0 are diagnostic comparison profiles, not approved canon. The 200×200 Web window is a
`PLAYABLE_WEB_SLICE`, **not** the whole Veyra world.

## Explicit non-claims

No official temperature, damage, weather or seasonal rates; no loot, stock, yield, respawn,
free starter grant or Core reward; no official cart passability, approved vehicle dimension,
bridge deck bearing, ferry/boat rule or forced land connection; no runtime player buildings,
weather realization, thermal/season/survival consequences, stock/custody, economy, escrow,
save/offline, live AI, visual approval, continuous playable Veyra, or Gameplay runtime
modification. No Gameplay file was changed to manufacture a PASS.
