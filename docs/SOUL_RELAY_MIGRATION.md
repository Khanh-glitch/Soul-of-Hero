# SOUL OF HERO - migration from LIVING ARSENAL

Status: migration foundation retained; recruitment milestone updated 2026-07-16

The current Archer contract in `docs/ARCHER_LEVEL_5_DESIGN.md` supersedes the
older milestone notes below wherever they conflict.

This document records the product pivot before runtime code is moved. The newest
`SOUL_OF_HERO_SWORD_RELAY_IMPLEMENTATION_PROMPT_EN.md` is authoritative wherever
it conflicts with the older Living Arsenal prompt.

## Product decisions

- The game identity is **SOUL OF HERO**.
- The playable unit is a **Hero**, not a weapon form.
- The party has one Active Hero and one visible Reserve Soul. The data model may
  hold a second reserve later, but no second-reserve control or slot is exposed.
- `Q` is **Soul Relay**. It never means weapon swap.
- Sword and Archer are the production Hero pair in the current release slice.
- KingdomArcher is the hostile Level 5 boss. Defeating it only spawns a physical
  Normal Level-1 Archer Hero Soul; the player must collect that drop before
  `archer_hero` ownership and Soul Relay are granted. Pickup only adds the Soul
  to inventory: it never auto-fills Reserve or activates effects. Opening the
  wardrobe and pressing **Equip** on the exact Soul is the sole activation
  trigger and applies immediately, including in the current run when available.
- Axe Warrior is an approved **future Hero recruitment** at a later, separately
  authored defeat-and-physical-pickup milestone. Level 15 of Chapter 2 only
  forces Axe to retreat at 50% HP; it never grants Axe ownership. Existing Axe
  data remains compatible, but no new profile receives Axe by completing Level
  5 or Level 15.
- Sword's approved permanent Active Skill is **Soul Echo**. Its normal Skill
  button and cooldown are player-facing.
- Axe remains intact under legacy ownership so prior work/save data is not lost.
  The Bow weapon ID is an internal compatibility adapter for playable Archer;
  possessing legacy `bow` data is not proof of `archer_hero` ownership.
- A Relay Test Dummy is developer-only and must never appear as player content.

## Old-to-new ownership map

| Living Arsenal concept | Soul of Hero replacement | Migration action |
| --- | --- | --- |
| `WeaponDefinition` | `HeroDefinition` | New resource contract; do not extend weapon data |
| `WeaponManager` | `HeroSoulManager` | New explicit Relay state machine |
| hand weapon | Active Hero | Player-facing terminology removed |
| Spirit weapon slot 1 | Reserve Soul | One visible reserve only |
| Spirit trigger progress | Soul readiness | Threat-event driven for Sword |
| weapon swap | Relay takeover | Ownership transfer only during takeover window |
| weapon hand skill | Hero Active Skill | Sword dùng Soul Echo; Skill button và cooldown hoạt động bình thường |
| weapon spirit action | incoming Hero Summon Skill | Belongs to incoming reserve |
| swap exit effect | outgoing Hero Departure Skill | Belongs to replaced active Hero |
| Bow runtime | Archer combat adapter | Internal implementation; player-facing identity is Archer Hero |
| Axe runtime | compatibility prototype | Retained for old data/tests until a future true defeat-and-pickup recruitment milestone is authored |

## Runtime cut-over sequence

1. Add `HeroDefinition`, `HeroSoulManager`, Sword resources, and isolated tests.
2. Add typed melee-threat events and make Sword readiness event-driven.
3. Route the existing Knight scene through the Sword Hero combat adapter.
4. Replace the 3-step weapon combo with the approved 4-step Sword sequence and
   implement its data-driven Soul Echo mirror.
5. Add Soul Interception, takeover windows, Relay ownership transfer, Returning
   Blade, and support-only cooldown rules.
6. Replace HUD/Hub/tutorial copy and controls with Hero/Soul language.
7. Migrate save schema, keeping a recoverable copy of the last v1 document.
8. Move old weapon runtime content behind `legacy/` after all scene references and
   tests no longer require it for the production boot path.

## Compatibility policy during implementation

- The old input action names may temporarily remain as non-visual aliases for
  MCP/script compatibility. Production code consumes `soul_relay_1`.
- Old save fields are read only by the v1-to-v2 migration. New writes use Hero
  fields exclusively.
- Legacy tests may continue to instantiate Axe in isolation. Production tests
  must prove Archer is absent before the Level 5 physical pickup and available
  for explicit team building only after its exact pickup receipt exists.
- The one-visible-Reserve migration target above describes the Chapter 1 release
  slice only. The canonical Chapter 2 late-game contract is one active Hero plus
  two directly selectable Spirit/Soul controls, as specified in
  `docs/CHAPTER_2_COMPLETE_DESIGN_2026_07_16.md`; do not use this legacy note to
  suppress the Level 10/11 second-Spirit entitlement.
- No destructive asset deletion is part of this migration.

## Completion gates

- Project boots and the training arena is playable after each phase.
- No player-facing `weapon`, `hand weapon`, `Weapon Spirit`, `Linh Khi`, or swap
  wording remains in the release path.
- Sword combo timings, multipliers, continuation timer, dash preservation,
  pass-through/recoil/pursuit fallbacks, and input buffering are tested.
- Readiness is earned from unique melee-threat events without taking damage.
- Q support can complete unused, Relay only works inside takeover frames, and
  cooldown semantics match the prompt exactly.
- Debug panel exposes state, readiness, takeover window, cooldown, Active Hero,
  and Reserve Soul; the dummy remains debug-only.
- Damage numbers, combo UI, impact overlay, hit stop, and screen shake respect
  accessibility/settings gates. Audio cue contracts remain available while
  runtime playback is intentionally muted.
- Save migration, MCP bidirectional state/action flow, and full headless regression
  pass before the old runtime is archived.
