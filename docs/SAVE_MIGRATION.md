# Save migration: schema v1 to v2

The v2 schema preserves campaign progress, tutorials that still apply, currency,
settings, accessibility, bestiary, mode progress, and idempotent transaction
history. It replaces player-facing weapon ownership/loadout with Hero ownership
and Soul Team data.

## Deterministic mapping

- `progression.unlocked_weapons.sword == true` ->
  `progression.unlocked_heroes.sword_hero == true`.
- Axe/Bow flags are copied only to `legacy.weapon_unlocks`; they do not unlock a
  Hero or appear in the production roster.
- `loadout.hand_weapon` and `loadout.spirit_slots` are copied to
  `legacy.weapon_loadout` for recovery/audit.
- New `soul_team.active_hero` defaults to `sword_hero`.
- New `soul_team.reserve_souls` defaults to an empty one-slot array until another
  approved Hero exists. A second slot is neither serialized as active content nor
  shown in UI.
- Old weapon/spirit tutorial flags are retained under `legacy.tutorials`; new
  Sword and Relay tutorial flags start from explicit safe defaults.

## Safety

- Loading v1 creates a normalized v2 candidate before replacing the primary.
- Existing atomic temporary-file verification and `.bak` rotation remain in use.
- Unknown future schemas are rejected rather than downgraded.
- v2 writes never use old fields as gameplay authority.

