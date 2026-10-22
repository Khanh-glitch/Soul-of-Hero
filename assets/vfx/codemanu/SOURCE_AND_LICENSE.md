# CodeManu VFX Free Pack - selected source sheets

Source archive: `VFX Free Pack.zip`, downloaded 2026-07-14.

- Author: CodeManu
- Source: https://codemanu.itch.io/vfx-free-pack
- Archive SHA-256: `D706FF61B7B72BA444A76916F74D1549A5AFEC573594BF656661E4187D1F118E`
- Imported variant: 30 fps spritesheets only.

The source page description and itch metadata disagree about public-domain vs
CC BY 4.0 status. This project follows the more conservative interpretation:
**CC BY 4.0, attribution to CodeManu**.

Imported sheets are retained unmodified so their provenance and authored grid
remain auditable. Runtime scaling uses nearest-neighbor filtering.

Runtime selection:

- `Effect_ElectricShield_1_265x265.png`: Soul Interception guard only.
- `Effect_BigHit_1_557x553.png`, `Effect_Impact_1_291x301.png` and
  `Effect_BloodImpact_1_69x60.png` remain available as audited source variants.
- `Effect_Wheel`, `Effect_Hyperspeed`, and `Effect_TheVortex` are repacked by
  `tools/generators/build_production_vfx.ps1` into the Axe cleave, Vampire
  tether, and fantasy portal production sheets.

`Effect_Anima`, `Effect_Worm`, and `Effect_Tentacles` are retained only as
auditable source files. Runtime code must not reference them: their white
claw/tentacle silhouettes were rejected for both combat and world feedback.

Colored authored sheets are converted to a neutral luminance mask at runtime
by `monochrome_tint.gdshader` when a gameplay family requires an ivory, bone,
spectral or accessibility-safe palette. The source PNGs are not modified.
