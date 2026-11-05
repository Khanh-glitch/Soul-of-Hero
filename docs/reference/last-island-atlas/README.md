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

Some sources are not directly indexed in `extracted/`, but all original source bytes are now recoverable from the tracked multipart archive described below. Read the actual files from the verified reconstruction, not inferred summaries.

## Full original archive now recoverable from GitHub

The exact original `atlas.zip` **is present as 13 Git-tracked Base64 source parts** in `source/`. This preserves the complete 26-entry source package, including all original XLSX workbooks and the nested v10/v11 ZIPs, without depending on external Drive access.

To restore on a checked-out docs branch (Python 3 standard library only):

```bash
python3 docs/reference/last-island-atlas/restore_atlas.py --extract
```

The script reassembles `atlas.zip`, checks its byte length and SHA-256 against `SOURCE_MANIFEST.json`, verifies all top-level ZIP CRC checksums, and writes the extracted top-level files to `extracted_full/`. The v10 and v11 packages inside may then be unpacked as needed. Do not confuse directly tracked `extracted/` (selected readable text subset) with `extracted_full/` (the verified full source, generated locally).

**Source verification:** all 13 GitHub blob SHA-1 objects and sizes were compared against the local parts generated from the source ZIP. Their bytes match. The complete joined archive was verified locally against the original ZIP and SHA-256:
`8b4fdedaa9397baaa1bcb8ba58d5c95ca2e7cbdd679963c6d4177fc9ab861e98`.

If you are working from PR #44, fetch `docs/gameplay-mechanics-first-policy-20261105` as a **read-only reference branch**. Do not reset, rebase or overwrite active Gameplay work just to access the source.
