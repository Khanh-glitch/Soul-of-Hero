# Greywater POI Detail Pilot — INPUT HANDOFF

**State: INPUT BRANCH READY; BINARY PACKAGE NOT YET UPLOADED.** This is an isolated source-transfer branch. Do not merge it to main or production.

## Required binary file

- Repository: `Khanh-glitch/Soul-of-Hero`
- Branch: `input/greywater-poi-pilot-20261102`
- Required path: `SOH_Greywater_POI_Agent_Input_v1.zip`
- Archive size: **17,318,023 bytes**
- Archive SHA-256: `4fbf68d10d3627de15aada1bb324649a6232aea3eceb84cb1911728fbc606bb8`

This package has been assembled and validated in the original ChatGPT conversation. It is NOT implicitly accessible from GitHub until the binary is uploaded to this branch. Do not download or trust guessed sandbox paths.

## Package structure

```
01_original_prototype.zip                      # artistic/UX reference: art.ts, render.ts, world.ts
02_map_studio_v3.zip                           # actual Map Studio source to modify
03_existing_style_bridge_kit.zip               # experimental Bridge, reference only
04_map_studio_default_seed.sohmap.json         # default seed, not a custom user save
INPUT_SHA256.txt                               # inner SHA-256 custody
README_HANDOFF.md
AGENT_HANDOFF.md
```

## Agent acquisition

```bash
git fetch origin input/greywater-poi-pilot-20261102
INPUT_SHA=$(git rev-parse origin/input/greywater-poi-pilot-20261102)
git show "$INPUT_SHA":SOH_Greywater_POI_Agent_Input_v1.zip >/tmp/greywater-input.zip
echo '4fbf68d10d3627de15aada1bb324649a6232aea3eceb84cb1911728fbc606bb8  /tmp/greywater-input.zip' | sha256sum -c -
mkdir -p /tmp/greywater-input
cd /tmp/greywater-input
python3 -m zipfile -e /tmp/greywater-input.zip .
sha256sum -c INPUT_SHA256.txt
```

If the `git show` path fails, stop and report **INPUT_NOT_UPLOADED**; do not claim to have read the original prototype.

## Mission

Integrate one **Greywater POI Detail Layer** into the existing Map Studio without destroying geography or creating a disconnected viewer. Reuse original code grammar and layout rules from the original prototype. POI `foot` is a site boundary, not a complete internal settlement design.

Build deterministic POI building footprints, roofs, doors, paths, props and interaction anchors with manual edits, freeze, undo/redo, save/reload, and one traversable/interactive pilot.

Output exact source SHA, 1x screenshots, real playable run, editor save/reload evidence, tests, and an honest visual verdict. Stop after Greywater; do not merge into production.
