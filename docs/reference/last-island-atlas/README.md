# Last Island → Soul of Heroes — Mechanics Atlas v1–v11

This is a historical **source reference**, not a second gameplay Bible. The authoritative SOH rules remain in `web/ref/bible.md`.

## Origin and integrity

The creator-provided `atlas.zip` contains 26 top-level files including v10/v11 nested ZIP packages and original XLSX workbooks.

- Original size: 1,489,422 bytes
- Original SHA-256: `8b4fdedaa9397baaa1bcb8ba58d5c95ca2e7cbdd679963c6d4177fc9ab861e98`
- The original ZIP has passed a CRC integrity check.
- The `extracted/` directory contains the directly readable references **actually published to this branch**. It is not yet the complete original archive. Check the directory before claiming a source is available.

## Research map

| Version | Research focus |
|---|---|
| v1 | Recipes, loot, POI, initial source provenance |
| v2 | Source-to-recipe-to-consumer dependency graph |
| v3 | Quantitative harvesting, crafting, access and costs |
| v4 | Recycler, source constraints and historical mode differences |
| v5 | 18 systems, 51 recipes, 82 loot edges, 19 POI access edges and original pricing |
| v6 | Historic 405-entry audit and 104 historical closure gates |
| v7 | Weapon economy as the source model for Creator Core replacement |
| v8 | Core gameplay/action/VFX semantic interface |
| v9 | Historical Creator decision register |
| v10 | Source custody, numerical controls, owner work orders and input protocols |
| v11 | 18 systems, 214 capabilities, 214 source/process edges, 104 cross-system edges, 144 gates and 20 observational scenarios |

The 104 v6 gates and the 104 v11 cross-system edges are different things. Historical findings do not automatically prove the current build.

## How to apply these references

For each implementation/review: select SOH Bible K/C laws; read the corresponding original mechanics and numbers **with version/mode/source provenance**; inspect actual code and causal transitions; identify missing mechanics and legitimate player choices; implement source→action→physical output→consumer→consequence; then use proportionate targeted checks for economy, custody, clocks, replay and usability.

Do not elevate a failed scripted journey into a universal sandbox blocker without identifying a code-level cause. Agent implementation work should prioritize building connected mechanics over repeating long QA scripts.

Any source that is not in GitHub's extracted tree must be marked as unavailable there, rather than invented or claimed read. The original package remains separately preserved; exact ZIP bytes are not claimed to be committed in this tree.
