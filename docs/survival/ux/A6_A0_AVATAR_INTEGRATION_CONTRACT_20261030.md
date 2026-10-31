# A6 → A0 canonical avatar integration contract (2026-10-30)

**Status:** owner-ready contract; **not mounted or production-tested**. This keeps A0 as the only owner of player choice, inventory/equipment, persistence, Hero lifecycle, physics, input and production mounting. A6 is a renderer of A0-projected state only. PR #24 must remain Draft/HOLD until A0 implements the mount and native acceptance below.

## 1. A0-owned player selection and persistence

- On a genuinely new campaign, A0's player-facing Home/New Game flow presents the canonical choices: **Male** (CraftPix 555940 base) or **Female** (CraftPix 419402 base). A0 writes the selected stable key through its existing SaveService in the same save transaction as campaign creation. A6 neither chooses a default nor writes a second copy.
- On continue/reload, A0 reads that saved key before spawning the Hero and supplies the corresponding appearance projection. On legacy/malformed saves, A0 owns migration or a player-facing repair choice; A6 must not infer a choice from Knight, equipped weapon, current scene, or command-line arguments.
- A0 derives `armor_grade` from its authoritative equipped inventory snapshot. A6 cannot equip/unequip or decide that an item is armor. Grades 1/2 remain source-blocked in this branch; if A0 projects one, A6 hides its own avatar render rather than showing stale grade-zero art or a different-character fallback.
- On death/recovery, A0 retains the saved identity and equipped state in its normal death/recovery/save path. On same-node respawn it updates the owner visual state as needed; if A0 replaces the Hero node, it calls `bind_owner` for the new node. After process restart, A0 rehydrates the exact same projection from its existing SaveService before presenting the player.

## 2. Versioned appearance projection

A0 supplies this read-only projection to A6 after load/selection and whenever relevant appearance state changes:

```json
{
  "schema": "soh.ui.avatar_appearance.v1",
  "provenance": "A0_OWNER_PROJECTION",
  "revision": "opaque-stable-appearance-revision",
  "appearance_revision": 0,
  "gender": "male",
  "armor_grade": 0
}
```

Contract:

- `gender` is derived from the A0-saved choice and is exactly `male` or `female`.
- `armor_grade` is an integer 0, 1 or 2 derived from A0 equipped state.
- `appearance_revision` is a nonnegative monotonic integer, incremented when gender/equipped visual state changes. It must not be reused for different gender/grade values. It remains stable for unrelated world/UI updates. A newer actor instance after respawn is rebound with `bind_owner` even if the appearance revision itself is unchanged.
- `revision` is a nonempty opaque A0 value, stable while this appearance revision is unchanged and changed with it. It is not a UI label or player-visible ID.
- A6 accepts only this owner projection. `update_owner_appearance()` ignores lower revisions, blanks the A6 visual on a same-revision payload conflict, preserves a valid newer revision watermark even when the rest of that payload is malformed, and fails closed if the selected source/grade is missing. A0 remains responsible for dispatching the newer projection; A6 does not poll SaveService.

The current private capture harness still passes gender from its CLI to a **preview-only test projection**. That is not saved identity, a new-game selection, a respawn guarantee, or production evidence.

## 3. Visual-only mount; preserve the game

A0 should mount the A6 `AnimatedSprite2D` as a sibling under the existing KnightController actor and hide only the legacy Knight render after a valid grade-zero owner projection has resolved. Keep the legacy `Sprite` node itself in place because KnightController's own action code expects its original animation names; A0 may continue updating that hidden node. Do not replace/reparent the `CharacterBody2D` or remove/alter its collision, hitbox, equipment visuals, camera, HUD, effects, health, controller, interactions, or save lifecycle.

A6 visual placement/filter:

- Existing A0 `Knight.tscn` visual anchor is `Sprite.position = (0, -31)` and remains A0-owned.
- The reviewed idle/walk source foot row is pixel `y=43` within a centered 64×64 cell, so the preview places the new sprite at local `(0, -11)` to align that baseline with the actor's ground origin. Retain this only after native visual review; do not change collision or physics to compensate for art.
- Set the new visual's `texture_filter` to nearest-neighbor and retain the A0 sprite z-index. Do not bake UI, selection, debug text, or duplicate HUD into the avatar.
- A6 maps the current pinned KnightController's `PlayerState`, `current_action`, `facing_direction`, `velocity`, `dead`, and action duration read-only. It presents only explicitly supported sword action IDs; `bow_attack`, `axe_*`, generic unsupported skills and other unmatched actions do not become a fake sword attack. Hurt follows A0 `current_action=hit`; death follows A0 `dead`/`PlayerState.DEAD`. Nonlooping source actions restart only on a new owner action instance and then retain their terminal frame; idle/walk/run advance at the recorded source rate.

The current A0 source pin used for the composition runner is `69070a1138730536050053c5aa47334b7b2c3836` (PR #21 at the live refresh). Comparison against the prior `5387bed6260cb7b9bd4d8229ee759dee08a0d918` showed the relevant KnightController, Knight scene, input bootstrap, SaveService, gameplay input gate, world scene, and project autoload files unchanged; `chapter1_overworld.gd` added an opt-in Waystation candidate gated off by default. The runner asserts the pin, paths, autoloads, Sprite anchor, PlayerState/action accessors and keyboard/mouse/controller bindings before importing. This is a stable reviewed pin, not a claim that the entire A0 branch can never advance.

## 4. Private lawful staging / product packaging

1. A0 operator supplies the two original ZIPs privately outside Git; the A6 stage tool verifies their pinned SHA and selected-member ZIP CRCs, directional alpha/frame grid, anchor evidence and Tiled timing, then extracts only the eight selected sheets per identity to ignored `private_art/a6_avatar/`.
2. The private composed preview clones exact A0 source, overlays A6-owned scripts and ignored sheets, imports them in Godot, runs the existing A0 overworld, and saves preview screenshots only under ignored `.artifacts/a6-avatar/`. The local ZIPs and uncompressed sheet sources must never be uploaded as public repository files or Actions artifacts.
3. CraftPix Freebie game-use terms support embedding the art as part of a game; raw/slightly modified art redistribution and user-facing art export remain prohibited, and §3.1.1 prohibits AI/ML use. A0's release owner must keep the sprites inside the playable game's normal asset bundle, with no separate sprite pack/export surface. No packaged binary/export mode has been validated here; platform-specific distribution/extractability remains unconfirmed.
4. A clean public clone without private staging remains fail-closed. Do not call that clean-clone state playable, and do not publish private images to make CI green. Native CI without the private handoff can validate source guards only, not the real sprite render.

## 5. A0 native acceptance after mount

A0 owner should run and visually inspect both selected identities through these real paths before removing the HOLD:

1. New-game male selection → save → spawn; new-game female selection → save → spawn. Confirm all four directions and ground alignment in the actual world at 1280×720, 2560×1440 and 3840×2160.
2. Keyboard WASD/arrows, actual mouse attack, and supported controller movement/attack; verify panels/modal focus block world actions, release cleanly, and do not break existing input. The direct A6 preview harness simulates semantic actions; it is not human/hardware acceptance.
3. A0-owned movement, named sword attack, nonlethal hit, lethal death, recovery/respawn, SaveService restart/reload, and visual rebind. Confirm identity never changes and the source hurt/death clips finish/hold without sprite-frame reset. Verify A0 Gold VFX remain unchanged and correctly composed; never automatically cast a Core to obtain a screenshot.
4. Equip/unequip only real A0-authoritative inventory items. A0 projection increments `appearance_revision`; grade-zero art restores correctly. Keep grade 1/2 blocked until lawful, matching, directionally aligned male/female layers exist.
5. Preserve all ten A0 dungeon routes/scenes, normal Hero physics, camera, HUD, survival systems, construction/storage, death/recovery, and save. Exercise no-Core and first-Core journeys; distinguish physical A3 Core custody/charges from learned recipe knowledge and A1 discovery-filtered world facts. A6 must not invent destinations, recipes, rewards, transactions, or replay receipts.

**Current production status:** none of these A0 selection/mount/reload paths has been delivered by PR #24. The A0 panel remains the only storage transfer controller; A6 storage stays read-only. A0—not A6—must own implementation and native acceptance of the selected-character save/lifecycle contract above.
