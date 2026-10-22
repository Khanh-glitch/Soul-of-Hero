# Sword VFX assets

## `sword_crescent_wave.png`

- Purpose: Combo 3 Crescent Recoil projectile and Soul Echo's mirrored wave.
- Generated with Codex built-in image generation on 2026-07-15.
- Final runtime asset: 128x128 RGBA PNG with transparent corners.
- The chroma-key source is retained at
  `.artifacts/imagegen/sword_crescent_wave_chroma.png` and is not referenced by
  Godot.

Prompt:

> Create exactly one standalone 16-bit pixel-art sword-energy wave shaped like
> a semi-oval crescent / half ellipse, travelling left to right, with a thick
> middle and sharply tapered tips. Use an ivory-white core and bright-white
> highlights matching the Knight's authored sword-swing trail. No blue/cyan,
> character, weapon, impact burst, particles, text, or watermark. Render on a
> flat solid #00ff00 chroma-key background for local alpha removal.

The runtime scene owns scale, tint, and orientation. Keep this bitmap neutral
white so both the real Sword wave and the reduced-alpha Soul Echo wave share the
same authored silhouette.

## Soul Echo production strips

- `sword_pursuit_marker_24x24_6.png`: the readable ground/target lock for
  Pursuit Execution.
- `sword_echo_anchor_32x32_8.png`: one short white anchor flash at activation
  and at the start of a mirrored attack.
- `sword_echo_ribbon_48x24_6.png`: a compact ivory path ribbon derived from the
  approved crescent silhouette.

These strips are local repacks, not image-generation outputs. Their exact
sources and deterministic rebuild command are recorded in
`assets/vfx/PRODUCTION_REPACK.md`. Soul Echo still uses the delayed translucent
actor itself as the primary read; the strips do not add floating swords or
additional damage owners.
