# Baseline reconciliation — corrective pass on Veyra

## Exact Git state

| item | value |
| --- | --- |
| repository | `Khanh-glitch/Soul-of-Hero` |
| working branch | `arena/103e4440-soul-of-hero` (session branch; branch switching is not permitted in this environment) |
| corrective base | `94172974a90165012c860493a16fd112c5707c72` (the implementation under correction) |
| staging head read | `19d8c6ec` — `origin/map/veyra-gold-asset-canon-20261102` (fetched, **not** merged over the pilot) |
| GOLD source imported | `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json`, taken from the staging head |
| GOLD SHA-256 | `88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256` |
| GOLD payload | identical to the copy the pilot used (`tools/world/data/veyra_gold_map.json`, same SHA) |

Because this environment may not create or switch branches, the corrective work is committed on
the session branch on top of `9417297` instead of on a new branch cut from the staging head. The
staging head's only relevant artefact is the GOLD JSON, which was imported byte-for-byte and is
now the compiler's single source. Merge or cherry-pick this branch's commit onto the staging
branch at review time; nothing in the working tree depends on the branch name.

## Files imported from the staging head

- `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` — canonical map (immutable; never edited).

## Files preserved from the pilot (`9417297`)

- `world/web/index.html`, `world/web/game.js` — walk-test shell and runtime.
- `tools/world/walktest.mjs` — headless logic test (corrected).
- `world/assets/hero_walk.png`, `hero_idle.png` — D051 walk / idle sheets (unchanged).
- `tools/world/data/veyra_gold_map.json` — retired as a source, kept as a hash witness.

## Files rewritten by this pass

- `tools/world/art_registry.py` — **new**. Curated, Git-relative, SHA-pinned sprite registry.
- `tools/world/veyra_compile.py` — rewritten (v2): 4 px/unit visual raster, 32 px ground grid,
  16 px collision grid, real bridge spans, real piers, sub-tile rivers and roads, deterministic
  hashing, no external paths.
- `tools/world/audit.py` — **new**. GOLD → world coverage audit and build gates.
- `tools/world/materials.py`, `world/README.md` — superseded; see `world/README.md`.

## Conflicting assumptions resolved

| assumption | resolution |
| --- | --- |
| pixel art from the Drive packs (pilot) | **removed**. The vault is gone from this environment; the order requires a Git-only pipeline. All art now comes from tracked files in `assets/environment/`. |
| 16 px art grid over 500×350 cells | replaced by **32 px Cainos art over 250×175 cells** (1 GOLD cell = 1 art tile) with a **16 px collision grid** (500×350) so a 10 px river cannot block a 32 px tile. `px_per_gold_unit` stays 4. |
| "GOLD declares zero bridges" (pilot README) | **wrong**. GOLD declares **12**; all 12 are compiled with measured spans, load class and deck collision. |
| flat sampled water colour | retained only as a labelled stand-in; recorded as `ART-001` in `map_tower/assets/UNRESOLVED_ART_GAPS.json`. |
| `hash(p["id"])` for placement | replaced by `blake2b`-based `h32()`; two clean builds now match byte-for-byte. |
| `/home/user/asset_vault/x` default | removed. Every source path is repo-relative. |

## Build and test commands

```bash
/tmp/venv/bin/python tools/world/art_registry.py     # curated registry + map_tower/assets/VEYRA_ART_MANIFEST.json
python3 tools/world/veyra_compile.py                 # out/world.png, out/world_meta.json, out/solid.npy  (~9 s)
python3 tools/world/audit.py --gates                 # Gate A + Gate B evidence (docs/map_tower/*.json)
node tools/world/walktest.mjs http://127.0.0.1:8011/web/   # Gate C logic test (needs the static server)
python3 -m http.server 8011 --bind 0.0.0.0 --directory world
```

`Pillow` and `numpy` are required; the compiler does not need network access at build time.
