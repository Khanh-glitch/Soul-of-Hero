# Visual review — Fisher's Point before / after

Reviewed the actual PNGs in `evidence/before/` and `evidence/after/` at both resolutions,
in daylight and at night. This is a review of in-game screenshots with the real
character and HUD, not of a test report.

## Before (pristine PR #38)

- **Forest**: a single flat mid-green field of per-pixel noise; identical tree sprites
  on a uniform ground; no canopy shadow, no value clustering, no sense of depth.
- **Coast**: a thin, uniformly dotted sand strip; shallow and deep water are two flat
  blues with a repeating sine line; no foam hierarchy, no wet/dry sand separation.
- **Road**: a faint brown band, almost indistinguishable from the surrounding forest.
- **Night**: one circular light around the player over a uniformly dimmed green field;
  no environmental light sources, no landmarks, no reason to look anywhere.
- **Composition**: nothing marks Fisher's Point. The player cannot read where the coast
  is, where the road goes, or what is worth approaching.

## After (this patch)

- **Forest**: clustered 4×4 value blocks in a cooler, richer green ladder; canopy tiles
  darken under real tree positions; offset contact shadows and sparse leaf litter give
  a readable upper-left light direction. The Net Shed roof now sits in a real clearing.
- **Coast**: warm dune contours, a wet-sand band, broken waterline foam, layered sea
  with broad stepped swells and a shallow→deep value gradient. The beach reads as a
  place rather than a colour change.
- **Road**: clean compacted earth with a cool stone edge trim and periodic brass
  waymarks — a clear leading line from the spawn toward the lighthouse and the wreck.
- **Landmarks**: the lit Fisher's Beacon is visible from the spawn camera; cairns,
  lantern posts, standing stones, the stranded dory and the broken mast form a chain
  of silhouettes along the corridor. They y-sort correctly against the player.
- **Night**: four warm lantern pools plus the player's light, using the game's own
  `drawLight` VFX. Dark forest stays legible; the light sources give the corridor a
  destination. Compare `after/night-spawn-1280x720.png` to `before/night-spawn-1280x720.png`.
- **Native 640×360**: all authored pixels are integer-aligned on the 16px grid; no
  smoothing, no subpixel gradients. At 1280×720 the game's integer 2× scale keeps the
  pixel art crisp.

## What was deliberately fixed during review

Three defects seen in the first after capture were corrected and re-captured:

1. vertical "curtain" stripes where the engine blends ROAD into neighbouring tiles →
   removed per-tile rut stripes, kept only compacted earth + edge trim;
2. noisy, near-black water that read as static → replaced 4×4 hash clusters with broad
   low-contrast stepped sine swells, removed near-black bands, made foam shoreline-only;
3. orange "confetti" ground specks → cut leaf-litter / flower / shell / glint densities
   by roughly 4× and muted the glint colour.

## Remaining shortcomings

- The beach silhouette is still the world generator's tile-aligned edge; straight
  horizontal sand/forest boundaries remain in `day-walk-1280x720.png`.
- The engine's original animated water dashes still overlay the authored swells; the
  surf is busier than a hand-drawn tileset would be.
- Far-west lighthouse spit, the Dev Delta layout and the minimap keep original art.
- Decorative props are non-blocking scenery; the player can walk through the beacon.
- Night on the open water is quite dark (`dark = 0.774`); a faint cool moon glint would
  help the surf read after dark.

## Next single improvement

Build a tracked 16px `surf / dune / forest_floor` tileset PNG and load it through the
same `MAP_ART_SEAM_1` hook as a palette-indexed atlas (3–4 animated surf frames). That
fixes the blocky beach edge and the busy water in one art pass while keeping
`world.ts`, collision, economy and the renderer pipeline completely untouched.
