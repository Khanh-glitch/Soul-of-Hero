# Production VFX repack

The PNGs under `assets/vfx/axe`, `assets/vfx/sword`, `assets/vfx/enemy`, and
`assets/vfx/world` are the small runtime sheets. Rebuild them deterministically
from the local source packs with:

```powershell
powershell -ExecutionPolicy Bypass -File tools/generators/build_production_vfx.ps1
```

The generator uses nearest-neighbour sampling, fixed crop rectangles, fixed
frame lists, and no network or generative service. Gameplay timing, collision,
telegraphs, and safe-position correction remain code-owned.

| Runtime sheet | Grid / frames | Source and recipe | Runtime use |
| --- | --- | --- | --- |
| `axe/axe_spin_32x32_8.png` | 32x32 / 8 | Existing `fantasy_icons.png`, Axe cell `(10, 5)`, eight pre-rendered 45-degree rotations | Axe throw and follow-through body |
| `axe/axe_charge_64x64_12.png` | 64x64 / 12 | unTied `scifi_charge_up_001_large_yellow`, nearest downsample | Charge stages |
| `axe/axe_cleave_64x48_6.png` | 64x48 / 6 | CodeManu `Effect_Wheel`, frames 18-23, masked to a forward 150-degree sector | Charged cleave and X cross-cut |
| `axe/axe_trail_32x16_6.png` | 32x16 / 6 | unTied directional white smoke, selected frames | Outbound and return trail |
| `sword/sword_pursuit_marker_24x24_6.png` | 24x24 / 6 | unTied charge-up, vertically compressed and neutral-masked | Combo-4 pursuit target |
| `sword/sword_echo_ribbon_48x24_6.png` | 48x24 / 6 | Existing Sword crescent wave, six fixed scale/alpha keys | Delayed Soul Echo path read |
| `sword/sword_echo_anchor_32x32_8.png` | 32x32 / 8 | unTied round sparkle, eight selected frames | Echo activation/start anchor |
| `enemy/reaper_disc_48x48_8.png` | 48x48 / 8 | Bright sickle arc isolated from `enemies-skeleton2_attack.png`, neutral mask, eight rotations | Spectral disc body |
| `enemy/reaper_trail_32x16_6.png` | 32x16 / 6 | unTied spell absorb, selected/downsampled frames | Disc conjure and flight |
| `enemy/vampire_blink_departure_48x48_10.png` | 48x48 / 10 | unTied red warp plus red burst splatter | Lunge departure |
| `enemy/vampire_blink_arrival_48x48_10.png` | 48x48 / 10 | Same sources, reversed warp and rotated splatter | Lunge arrival |
| `enemy/vampire_tether_32x16_4.png` | 32x16 / 4 | CodeManu `Effect_Hyperspeed`, central horizontal band | Confirmed leech tether |
| `world/world_smoke_32x32_8.png` | 32x32 / 8 | unTied directional white smoke, eight selected frames | World and combat dissipate puff |
| `world/interaction_sparkle_32x32_8.png` | 32x32 / 8 | unTied round sparkle, eight selected frames | Pickup, torch, checkpoint, recall |
| `world/fantasy_portal_64x64_12.png` | 64x64 / 12 | CodeManu `Effect_TheVortex`, every second frame, nearest downsample | Exit and floor transition |

Licensing and attribution remain attached to the original providers:

- unTied Games / Will Tice: see `assets/vfx/untied/LICENSE_WILL_TICE_UNTIED_GAMES.txt` and `SOURCE_AND_USAGE.md`.
- CodeManu: conservative CC BY 4.0 handling; see `assets/vfx/codemanu/SOURCE_AND_LICENSE.md`.
- Character/icon-derived sheets inherit the provenance requirements of their
  existing source assets and must not be redistributed as a standalone pack.

Forbidden runtime sources: `Effect_Anima`, `Effect_Worm`, and
`Effect_Tentacles`. They are not inputs to this production repack and must not
be used for combat or world manifestations.
