# A6 player avatar consumer contract

**For:** A0 mount. **Owner of this document:** A6. **Implementation:** `game/survival/player/player_avatar_presenter.gd`.
**Audited against:** A0 `game/autoload/save_service.gd` at branch head `7359d5c4`.

This is the only interface A0 needs to satisfy to put the selected Adventurer on screen.
It is deliberately small: the consumer reads three things and writes nothing.

---

## 1. What A6 consumes, exactly

| surface | signature verified in `save_service.gd` | the consumer's use |
| --- | --- | --- |
| projection | `get_player_appearance_projection() -> Dictionary` | read on mount, on `player_avatar_changed`, on `save_loaded`, and on demand via `refresh()` |
| chosen identity | `get_player_avatar() -> Dictionary` | never read directly; it arrives inside the projection |
| change signal | `player_avatar_changed(snapshot: Dictionary)` | re-resolves when the identity changes; emitted by `set_player_avatar()` after a successful commit |

**The projection fields the consumer depends on**

```gdscript
{
  "schema": "soh.ui.avatar_appearance.v1",   # required, exact
  "provenance": "A0_OWNER_PROJECTION",        # required, exact
  "gender": "male" | "female" | "",           # "" means no identity yet
  "armor_grade": 0 | 1 | 2,                   # request, not a claim
  "revision": "player_avatar:<gender>:g<grade>:r<n>",  # identity key
}
```

`revision` is the identity key. Two projections with the same key must present the same
character, so the consumer will not restart a running clip for a commit that cannot
change the character (gold, quests, unrelated items). That behaviour is A0's stated
intent in `get_player_appearance_projection()` and the consumer implements it.

**The consumer never calls** `set_player_avatar()`. Identity is chosen in the menu
(`avatar_choice_screen.gd`, which writes through `/root/SaveService`) and nowhere else.

## 2. Mounting it

The presenter is already a child of both production actors:

- `game/characters/knight/knight.tscn` → node `AvatarPresenter`
- `game/ui/screens/home/home_actor.tscn` → node `AvatarPresenter`

Requirements for a new host:

1. The presenter's parent must be a `Node2D` (the actor), and that actor must own an
   `AnimatedSprite2D` named `Sprite` — the stand-in the presenter hides once a real
   identity exists.
2. Nothing else. There is no registration call and no ordering requirement; the
   presenter resolves the owner in `_ready()` and again on every signal.

Optional: `owner_source` points the presenter at a different owner object. Production
leaves it empty and the presenter resolves `/root/SaveService`. This exists so the
contract can be tested without a save file, not as a second authority.

## 3. The state machine

| status | when | what the player sees | what A0 should do |
| --- | --- | --- | --- |
| `NO_SAVE_SERVICE` | no owner node, or an owner without `get_player_appearance_projection()` | the authored actor, unchanged | nothing; this is a wiring fault, reported by name |
| `NO_IDENTITY` | `gender` is empty | the authored actor, unchanged | nothing; the player has not chosen a character yet |
| `SOURCE_BLOCKED` | an identity is claimed but its licensed art is not staged, or its record fails the license gate | **the proxy actor is hidden** and `NHÂN VẬT CHƯA CÀI ART (PRIVATE STAGING)` is drawn over the actor | stage the licensed packs, or accept the honest blocker; **never** substitute another character |
| `READY` | identity + licensed record + playable clips | the chosen character, animated from its own sheets | keep the projection stable |

`get_presentation_state()` always returns
`{status, ready, gender, armor_grade, reason, action, direction, appearance_gate}` so a
host can act on the answer without reaching into internals.

`appearance_gate` carries `GRADE_1_APPEARANCE_SOURCE_BLOCKED` /
`GRADE_2_APPEARANCE_SOURCE_BLOCKED` when the player wears something whose art is not
licensed yet. The consumer keeps **the same character** at its verified base appearance
and records the gate; it never dresses the player in unverified art and never swaps the
character.

## 4. Animation authority

A0's Knight animation state is the authority; the avatar mirrors it. The mapping is:

| host animation contains | presented clip |
| --- | --- |
| `death` | `death` (plays once, holds the final pose until respawn) |
| `hit` / `hurt` | `hurt` |
| an attack name (`attack*`, `sword_combo_*`, `heavy_attack`) | `attack`, or `walk_attack`/`run_attack` while moving |
| movement above the epsilon | `walk`, or `run` above the run threshold |
| otherwise | `idle` |

Direction comes from the actor's facing, with `front`, `side_left`, `side_right` and
`back` resolved from the same velocity A0 already computes.

A missing clip fails closed (`SOURCE_BLOCKED`, named reason) rather than freezing on the
last good frame.

## 5. Executable proof

| command | needs licensed art | proves |
| --- | --- | --- |
| `godot --headless --path . res://tests/survival/ui/player_avatar_consumer_contract_test.tscn` | **no** | the whole blocker matrix: absent owner, owner without the method, no identity, claimed identity without art, unlicensed garment grade, signal re-resolution, state shape |
| `godot --headless --path . -- --avatar-identity-test --avatar-phase=full --avatar-gender=male --avatar-expectation=blocked` | no | the production route fails closed with no Knight substitute |
| `--avatar-identity-test --avatar-phase=full` with sheets staged | yes | both identities animate: locomotion, attack, hurt, death, respawn, separate-process reload |

The first row runs in the public-clone CI job. The third runs in the
private-staged-art job. Frames from that run are published to
`docs/survival/reviews/native/avatar/` so they can be inspected rather than trusted.

## 6. What is still unresolved

**Licensed art for equipment grades 1 and 2.** The projection can request grade 1 or 2
from the equipped loadout, and the consumer will honour it the moment a verified record
exists in `avatar_art_manifest.json`. It does not exist: only grade 0 is licensed, so
grades 1/2 are a **source-approval gate owned outside A6**, not an API gap. The consumer
reports the gate by name and keeps the base appearance.

**Nothing else in this contract is outstanding.** All three A0 surfaces exist and behave
as this document requires at the audited SHA; the contract test passes on a public
clone. What remains is art sourcing above, and the HUD-side projections listed in the
Round 12 review (season clock, equipped tool and durability), which are separate APIs
A0 does not yet expose.
