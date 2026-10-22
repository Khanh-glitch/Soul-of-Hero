# Archer runtime sprite source

- Source pack: **GandalfHardcore Archer** by GandalfHardcore.
- Local vendor source: `GandalfHardcore Archer/GandalfHardcore Archer/`.
- Curated runtime files:
  - `archer_player_sheet.png` — base palette, playable Archer.
  - `archer_boss_sheet.png` — purple hostile palette, Level 5 boss.
  - `archer_arrow.png` — shared arrow projectile visual.
- Atlas layout: 64 x 64 cells, 11 columns x 5 rows. Authored row counts are
  idle 5, fire 11, run 8, hurt 5 and death 6. Runtime dash/roll reuse run;
  the death row is never used for a living reposition.
- License: commercial and non-commercial game use and modification are allowed.
  Resale, repackaging/redistribution as an asset, AI training, game-creation
  tools, NFTs and printed products are prohibited. See the original local
  `READ ME.txt` for the full author terms.
- These source images were **not** supplied to image generation. Generated
  Archer presentation assets use independent text-only prompts.

## Generated Archer Hero Soul

- Runtime file: `archer_hero_soul_icon_64.png` (64×64 RGBA).
- Raw and transparent intermediates are kept under `generated/` together with
  `archer_hero_soul_asset_report.json`.
- Generation used the built-in `image_gen` tool with a text-only prompt and no
  reference image. In particular, none of the GandalfHardcore files above was
  uploaded or supplied to the model.
- Chroma removal used the bundled imagegen helper, followed by a
  nearest-neighbor resize. Exact prompt, hashes and validation are recorded in
  `docs/GENERATED_ASSET_PROMPTS.md`.

## Generated KingdomArcher VFX

- Four transparent runtime textures under `generated/`: Quick Shot, Armor
  Piercer, Soul Mark and Phase/Poise burst.
- They were generated together from one text-only 2×2 atlas prompt, with no
  character or third-party image reference, then chroma-keyed, split and
  nearest-neighbor optimized.
- Runtime uses them for bow-local charge/muzzle release, the target-bound Soul
  Mark sigil, phase shift, poise break and death burst. KingdomArcher has no
  screen-wide line telegraph; physical projectile collision is authoritative.

### Motion-only refinement set

- `generated/archer_boss_quick_trail_vfx.png` — 96×32 cyan trail only.
- `generated/archer_boss_pierce_trail_vfx.png` — 128×48 violet/cyan trail only.
- `generated/archer_boss_mark_projectile_vfx.png` — 128×64 Soul Mark rune
  aura/trail with a separate magical identity.
- `generated/archer_boss_dash_trail_vfx.png` — 96×48 lateral foot-skid
  afterimage for escape/dash movement.
- All four came from one independent, text-only 2×2 chroma-key atlas. No
  existing project sprite, arrow, screenshot, or third-party image was used as
  a model input. The production outputs contain no baked arrowhead, complete
  arrow, character, UI panel, or text.
- Runtime keeps the physical arrow sprite separate: Quick/Pierce/Mark select
  their own motion-only trail and Escape selects the foot-skid.
- Fixed-quadrant extraction, chroma despill, hard alpha, nearest-neighbor
  resizing, exact output dimensions, SHA-256 hashes, and the verbatim prompt
  are recorded in `docs/GENERATED_ASSET_PROMPTS.md` as GEN-20260716-003.
