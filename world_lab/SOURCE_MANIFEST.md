# Source manifest / exact fingerprints

Active work branch: `arena/2e3cfbd2-soul-of-hero`, local HEAD `5214788933b1a827f3a177d11ff486433dfe5e8a`.
Machine-readable manifest: `data/source_manifest.json`; exact GOLD/prototype file trees: `data/source_tree_gold.txt`, `data/source_tree_prototype.txt`.

| Source | Exact ref / SHA-256 | Local authoritative copy |
|---|---|---|
| GOLD map branch | `map/veyra-gold-asset-canon-20261102` @ `19d8c6ec820f324a6ac12733165e43b5e2c6eab2` | — |
| GOLD JSON | `88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256` | `src/gold/VEYRA_GOLD_MAP.sohmap.json` |
| Conversion contract | `a16deb29f27ad33a7e1788d52aa5bd7e27d36c0c4ecdcee9a4b76ee990e688d1` | `src/gold/REAL_MAP_CONVERSION_CONTRACT.md` |
| Asset staging status | `4ad5b4dca3bf3df18f695b41bdd21d3df49ea57eb312c2465d063d20ed5ff4f5` | `src/gold/ASSET_STAGING_STATUS.md` |
| Asset inventory | `020112bea49d4541cc687aa138d2b0f4500167aaf3bbdb044fdff82483453094` | `src/gold/EXISTING_ASSET_GIT_SOURCES.json` |
| GOLD README | `730d2a5245eb1d619cda456fda33b7bc5935417ae5a7cb978a10eaf7c8d93faf` | `src/gold/MAP_TOWER_README.md` |
| Canonical product Bible | commit `a8c718b55130cff29b3adc5e7c531f9211ca22df`; SHA `ab02f994af371e7386e9403dff5cdb3673412cd99b0e250f13b2201077d1e8ac` | `src/gold/CURRENT_PRODUCT_CONTRACT.md` |
| Prototype branch | `references/gameplay-prototypes-20261102` @ `7a1c53acfc5b7cda6cb34ea3f348b4e100744354` | — |
| Original prototype ZIP | `fa95538271fd46a70f5737b58b8671124e091e8f6196479950a25dca741a2403` | `src/gold/soul-of-hero-game-development.zip` |
| Prototype reuse analysis | `2793366a10316cbfd49f014cbd2e3db60a7c17ed4cec647c547542538a868c0b` | `src/gold/PROTOTYPE_REUSE_ANALYSIS.md` |
| Prototype `world.ts` / `art.ts` / `core.ts` / `render.ts` | source hashes recorded in `data/source_manifest.json` | `src/gold/prototype/` |

Raw experimental donor-pack SHA-256 (hashes recorded, ZIPs were not committed): `200380` `ed98e53cea1bb597cde92e68e3d8a4fe0cc41115d400bf642e0299a9e53284c4`; `351300` `0b436bf4193dd116bb1b16c084f4df5bcaa4d284d33655e49b98e8fffeb3d59b`; `574220` `302e8fa1da79163d2cd9da5ddfd7610bb0186b16de7f959b7d9a09ee4763e43c`; `665131` `697a7addd4503a3d3d2feb5c23bba5b3d4b9dac66db3e709cb4217595d3c7242`; `668008` `ad6d46007fea5972794a26d190879d9049405fa3baf1c17874991a634d875e86`.

Selected public-branch donor sheets and license/readme files are staged under `assets/source/`: CraftPix `200380` plants, `668008` bridges/water, `574220` roads reference-only, `665131` fields, Cainos tiles/plant/struct sheets and `cainos_THIRD_PARTY.md`. Creator confirmed relevant asset rights; these are experimental donors, not production authority. Private `APEX-CHAOS` blobs were inaccessible with current auth (`403`); the inventory says 42/43 CraftPix packs were found there, with `695666` missing. No private blobs are claimed or duplicated.

Prototype reuse is selective: deterministic-timing/depletion/tool-wear and paid-queue/fuel/output/offline ideas were audited; the prototype's AI, save/map/art/balance, 400-ID receipt dedup and whole-game screenshot proof were rejected. Embedded `ref/bible.md` in the prototype ZIP is not canonical authority; the staged product Bible is.

All generated outputs are reproducible from the staged GOLD JSON and `src/compiler`/`src/render` code. `data/build_fingerprint.json` records exact output hashes; `data/creator_edits.json` preserves empty creator edits by default.
