# unTied Games Super Pixel Effects - production selection

Source folder: `Super Pixel Effects Gigapack (Free Version) v2.6.0`.

License: see `LICENSE_WILL_TICE_UNTIED_GAMES.txt` in this directory. Shipping
credits must include **Pixel Art Assets - Will Tice / unTied Games**. Do not
redistribute this selection as an asset pack and do not use it as AI training
material.

Only the following authored spritesheets were copied into the production
asset path. Matching `.txt` files preserve the original frame rectangles.

| Runtime file | Grid | Frames | Runtime purpose |
| --- | --- | ---: | --- |
| `directional_impact_001_large_blue.png` | 64x64, 1 row | 7 | Echo directional hit/X execution |
| `directional_smoke_burst_001_small_white.png` | 32x32, 1 row | 21 | Dash/projectile/world smoke |
| `directional_splatter_001_small_red.png` | 32x32, 1 row | 8 | Vampire/flesh hit |
| `round_sparkle_burst_001_small_blue.png` | 32x32, 1 row | 14 | Pickup/checkpoint/recall sparkle |
| `spell_absorb_001_small_violet.png` | 64x64, 1 row | 31 | Vampire leech/death |
| `stylized_skull_smoke_burst_001_small_white.png` | 32x32, 1 row | 12 | Skeleton/Reaper death |
| `symmetrical_impact_001_small_yellow.png` | 48x48, 1 row | 7 | Blade/Axe/bone impact |

Godot uses nearest filtering. Runtime monochrome tinting changes palette only;
hitboxes, telegraph timing, collision sweeps and safe-position correction stay
code-owned and independent of animation frames.
