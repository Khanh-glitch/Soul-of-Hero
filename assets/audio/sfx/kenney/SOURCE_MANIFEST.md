# Kenney audio production manifest

Imported and license-reviewed on 2026-07-15. Source archives are deliberately
not stored under `res://`; preview tracks, promotional URL files and unused
one-shots were excluded.

## RPG Audio

- Source: https://www.kenney.nl/assets/rpg-audio
- Archive: `kenney_rpg-audio.zip`
- Archive SHA-256: `6DBEAF8544DA958D8F2ADCB4A4A4B76C1ADE34A05F8AB9EDCCD327DA7375F38B`
- Project directory: `rpg_audio/`
- Selected files: 34 OGG one-shots

Production routing:

- Weapon motion: `chop`, `knifeSlice`, `knifeSlice2`, `drawKnife1-2`.
- Generic movement variation: `footstep00-09`.
- Cloth/roll/relay body: `cloth1-4`, `clothBelt`.
- Dungeon doors: `doorOpen_1-2`, `doorClose_1-2`, `creak1-2`.
- Reward/world UI: `handleCoins`, `handleCoins2`, `metalClick`, `metalLatch`.
- Codex/page UI: `bookOpen`, `bookClose`, `bookFlip1-2`.

The belt, leather, pot, book-placement, third draw-knife and redundant door
variants remain outside the project.

## Impact Sounds

- Source: https://www.kenney.nl/assets/impact-sounds
- Archive: `kenney_impact-sounds.zip`
- Archive SHA-256: `029D734AF1582474EDF3A694D1B0CEBC97C1C152F2F39FA34D4C2BAFC5DE77F8`
- Project directory: `impact_sounds/`
- Selected files: 49 OGG one-shots

Production routing:

- Floor material: all five `footstep_concrete_000-004` and all five
  `footstep_wood_000-004` variants.
- Light/default hit: `impactGeneric_light_000-002`.
- Weapon/armor: light, medium and heavy `impactMetal_*_000-002`.
- Flesh/body: medium and heavy `impactPunch_*_000-002`, optionally layered
  with medium/heavy `impactSoft_*_000-002` at lower gain.
- Wood/chest/door: light and heavy `impactWood_*_000-002`.
- Stone/bone-heavy accent: `impactMining_000-002`.
- Shield/plate armor: medium and heavy `impactPlate_*_000-002`.

Do not play every layer simultaneously. Pick one body layer plus at most one
short transient, randomize within the family, and keep pitch variation subtle.
Concrete and wood footsteps are complete five-sample cycles; combat families
use three selected variants each to limit import and memory churn.

## Runtime routing

`res://game/feedback/combat_audio_router.gd` loads both `AudioStreamWAV` and
`AudioStreamOggVorbis`. It caches decoded stream resources by full `res://`
path, selects randomly inside each cue family, and excludes the immediately
previous index for that cue.

- `footstep_stone` and `footstep_wood`: complete five-file floor pools.
- `axe_cleave`: curated chop/slice motion; `axe_hit/impact/heavy`: heavy metal;
  `axe_catch`: medium metal.
- Generic `hit_confirmed`/`sword_hit` may route through bone, flesh, metal, wood
  or stone when the presentation context supplies `material`.
- Chest/door/coin/torch and optional book cue IDs use the RPG Audio Foley.
- Existing Sword/Soul WAV cues remain available through the same public helper
  and stable cue IDs for backward compatibility.
