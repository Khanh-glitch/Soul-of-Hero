# A6 → A0 player identity integration handoff (2026-10-30)

Status: **IMPLEMENTED IN ISOLATED A0-BASED CANDIDATE, AWAITING A0 REVIEW AND NATIVE EVIDENCE CLOSURE.**
Base: A0 PR #21 branch `arena/dea2428e-soul-of-hero`, live HEAD `51225718`
(re-verified 2026-10-30; the work order's `7f3ca17` is an older ancestor).
Candidate branch: `arena/05e0328d-soul-of-hero`.

## What the player can see and do

1. Boot → the authored profile choice (`TIẾP TỤC` / `CHƠI MỚI`).
2. `CHƠI MỚI` keeps A0's safe progression reset, then opens a new authored
   identity step: **NAM • 555940** or **NỮ • 419402** (authentic CraftPix base
   characters), with a live idle preview when the licensed sheets are staged.
3. Choosing writes the identity through `SaveService` and enters Home. The Home
   actor and the real Chapter 1 overworld player are drawn with that character
   instead of the Knight: four-direction idle / walk / run, sword attack,
   hurt, death and respawn.
4. `TIẾP TỤC` and a second, independent process restore the same character.
5. With no private art staged, the game **fails closed**: the Knight is not used
   as a stand-in, a diagnostic label identifies the missing private staging, the
   identity is still saved, and no item, currency or reward is granted.

## Ownership boundary

| Concern | Owner | Notes |
| --- | --- | --- |
| Chosen identity, revision | **A0 SaveService** | `player_avatar` section + `get_player_appearance_projection()` |
| Equipment appearance request | **A0 SaveService** | derived from `auxiliary_loadout` Vessel/Boots/Trace |
| Sheet → `SpriteFrames` conversion | A6 pipeline (unchanged) | `game/survival/ui/avatar_sprite_pipeline.gd` |
| Which clip is played | A6 presenter + A0 actor state | reads A0 animation/velocity/facing only |
| Physics, combat, hitboxes, VFX, Gold, dungeons | **A0 (untouched)** | presenter never writes gameplay state |
| Art bytes | private staging only | `private_art/` is git-ignored; no ZIP/PNG committed |

## Files

Added:
- `game/survival/player/player_avatar_presenter.gd` — the only bridge; hides the
  Knight art when an identity is presented, restarts a clip only on a real host
  re-trigger (no per-frame reset), listens to `player_avatar_changed`/`save_loaded`.
- `game/survival/ui/avatar_sprite_pipeline.gd`, `avatar_appearance_adapter.gd`,
  `avatar_art_manifest.json` — A6's reviewed, SHA-locked pipeline reused verbatim.
- `game/ui/screens/avatar_choice/*` — authored identity screen (authored nodes
  only; no code-drawn UI, no code-created controls).
- `tests/survival/ui/avatar_identity_native_test.gd`,
  `tests/survival/ui/a6_avatar_visual_capture.gd`,
  `.github/workflows/a6-native-avatar-validation.yml`.
- `tools/stage_a6_avatar_art.py` — A6's SHA-256-verified private staging tool.

Modified (minimum surface):
- `game/autoload/save_service.gd` — `player_avatar` section, sanitizer, revision,
  `set_player_avatar()`, `get_player_avatar()`, `has_player_avatar()`,
  `get_player_equipment_grade_request()`, `get_player_appearance_projection()`,
  `player_avatar_changed` signal.
- `game/app/app_flow.gd` — `AVATAR_CHOICE_SCENE` + `open_avatar_choice()`.
- `game/ui/screens/title/title_screen.gd` — New Game routes through identity.
- `game/characters/knight/knight.tscn`, `game/ui/screens/home/home_actor.tscn` —
  one `AvatarPresenter` child each, with the host's own visual foot line.
- `tests/startup_profile_choice_test.gd`,
  `tests/survival_normal_entry_home_restart_test.gd` — journeys now include the
  identity step.

## Save shape

```json
"player_avatar": {
  "schema": "soh.player_avatar.v1",
  "gender": "male",            // "" until the player chooses; invalid values sanitize to ""
  "equipment_grade": 0,        // recorded baseline; grade 1/2 art stays source-blocked
  "revision": 3,               // monotonic, bumped on every identity commit
  "selected_at_unix": 1790000000,
  "selection_source": "avatar_choice"
}
```

`get_player_appearance_projection()` returns
`{schema: "soh.ui.avatar_appearance.v1", provenance: "A0_OWNER_PROJECTION",
gender, armor_grade, craftpix_id, revision: "player_avatar:<gender>:g<grade>:r<rev>"}`
which is exactly what A6's `avatar_appearance_adapter` demands.

## Equipment grade 1/2 (honest gate)

`get_player_equipment_grade_request()` maps the equipped Vessel/Boots/Trace
loadout to grade 1 (any) or 2 (all three). No licensed grade-1/2 source art has
been selected or verified, so:
- the presenter attempts the requested grade first;
- if that grade has no verified record it draws the **same chosen character** at
  its verified base appearance and records
  `appearance_gate = "GRADE_<n>_APPEARANCE_SOURCE_BLOCKED"` in its state;
- nothing claims grade 1/2 shipped, and no other character is substituted.

## Reproduction

```bash
# 1. Private art (never committed), archives stay outside the repo:
python3 tools/stage_a6_avatar_art.py --male-zip /path/555940.zip --female-zip /path/419402.zip

# 2. Import + native identity gate (real engine, headless):
godot --headless --editor --path . --import --quit
SOUL_OF_HERO_SAVE_PATH=user://a6_male.json godot --headless --path . -- \
  --avatar-identity-test --avatar-phase=full --avatar-gender=male --avatar-expectation=ready
SOUL_OF_HERO_SAVE_PATH=user://a6_male.json godot --headless --path . -- \
  --avatar-identity-test --avatar-phase=verify --avatar-gender=male --avatar-expectation=ready

# 3. Visual captures (needs a display; software GL is fine):
xvfb-run -s "-screen 0 1280x720x24" godot --path . --resolution 1280x720 \
  -- --avatar-visual-capture --avatar-gender=male --capture-dir="$PWD/.artifacts/cap720"
```

## A0 integration handoff

1. Review the five modified A0 files; they are additive and guarded by
   `has_method`/`has_signal` checks so an older SaveService still boots.
2. Accept `player_avatar` as an A0-owned section (schema above) — no other
   subsystem may write it.
3. Keep `player_avatar` reset by `reset_progression_keep_settings()` (defaults to
   "no identity"), which is what makes New Game ask again.
4. Do not publish `private_art/**`; keep the staging step in local tooling and
   the CI runner only.
5. Re-run the two native gates before claiming completion.
