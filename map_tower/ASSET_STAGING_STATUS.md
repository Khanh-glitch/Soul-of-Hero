# Asset transfer ledger — 2026-11-02

- Source inventory: 43 CraftPix ZIPs previously fetched and visually catalogued; 5,783 readable PNGs in local review (48 bad PNG entries excluded across some packs). **This is NOT 5,783 files currently in Git.**
- SOH A1 original `assets/environment/survival_world/{terrain,props}.png` is already on historical A1 PR #20; verify presence on this branch before assuming bundled. The branch inherits the unified Bible source.
- In Git so far: `map_tower/assets/raw_packs/668008-bridges.zip`, `351300-island.zip`, `665131-fields.zip`, `200380-farm-plants.zip`, `574220-roads-reference-only.zip`. Road pack is reference-only, not primary material. Full 43 PNG library and curated 24-sprite pack **not committed** because large Git connector transfer failed; no silent Drive fallback permitted for final agent.
- 579 Veyra object art classifications from local review: 249 candidate, 127 depend on SOH atlas, 119 editor/vector symbols, 84 need further art. These are art readiness counts, not functional implementation.
- Existing pack IDs to prioritize for native scenes: 385863 trees; 141354 bushes; 974061 stone; 934618 ruins; 505052 Aion ancient trees; 639143 rocky escarpments; 266622 cave; 668008 bridges; 812442 large prefabs only at region scale; 160005 coastal water candidate. 351300 mini-game island **not approved as full-world base**.
- Missing verified coherent full-scene families: functional boat and piers, autotile-tested shore network, Surtur lava/obsidian, Anubis dune/oasis, Argus exterior/Atlas gateway, industry exteriors/vehicles. Use exact sprites if sourced or mark missing.
- Dependency: move all selected verified source pixels or prepared atlases into this SAME Git branch and verify Git tree by SHA before writing the final one-shot prompt. No agent dependence on Drive ZIPs.
- Legal clearance reported by creator via email; preserve source receipt and applicable terms in private provenance while making release/redistribution decision from actual granted scope. Do not claim license coverage based on a generic marketplace label.

**Status: STAGING_PARTIAL.** Never hand off as ready.
