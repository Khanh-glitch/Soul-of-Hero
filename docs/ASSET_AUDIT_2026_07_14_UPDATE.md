# Asset audit update - 2026-07-14

New folders were found inside the project root: `Super Pixel Effects Gigapack
(Free Version) v2.6.0`, `VFX Free Pack`, `Martial Hero`, `GandalfHardcore
Archer`, `Free Bow and Crossbow Icons`, and `Waterfalls`.

Assets now copied or generated into production:

- `assets/vfx/sword/sword_crescent_wave.png` is the active Sword Crescent
  Recoil/Soul Echo wave: 128x128 RGBA, white semi-oval silhouette. It was made
  with Codex built-in image generation, chroma-keyed locally, and documented in
  `assets/vfx/sword/README.md` with the exact prompt and retained source path.
- `assets/vfx/untied/directional_impact_001_large_blue.png` remains staged but
  is no longer referenced by Sword; its burst silhouette and blue palette did
  not match the authored white swing frames.
- `assets/vfx/untied/spell_death_001_large_red.png` and
  `assets/vfx/untied/scifi_warp_003_large_blue.png` are staged as approved
  candidate VFX for vampire/death and relay/warp passes.
- `assets/vfx/untied/LICENSE_WILL_TICE_UNTIED_GAMES.txt` is stored locally.
  Required attribution: Pixel Art Assets - Will Tice / unTied Games.

Current visual debt after this update:

- Enemy telegraph geometry is still code-native for readability and timing, but
  damaging/projectile-style VFX should continue moving to asset spritesheets.
- Torch flame uses the existing dungeon torch frames and PointLight2D. If a
  higher-quality hand-held torch flame is needed, prefer CodeManu FastPixelFire
  or generate a tiny transparent spritesheet matching the dungeon palette.
- FreeKnight license and enemy source notices remain release blockers.
