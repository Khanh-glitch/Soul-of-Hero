# Campaign Hero progression contract

Status: Level 5 Archer recruitment implemented; Chapter 2 canon locked (2026-07-16)

This document separates level completion from Hero ownership. The typed content
plan is `data/content/progression/soul_hero_campaign_plan.tres`; it records the
future Wizard pickup milestone and intentionally contains no Axe recruitment at
Level 15. The detailed Level 5 contract is `docs/ARCHER_LEVEL_5_DESIGN.md`; the canonical Chapter 2 contract is
`docs/CHAPTER_2_COMPLETE_DESIGN_2026_07_16.md`.

## Universal recruitment rule

Except for the explicitly authored starter Sword, a Hero is never granted merely
because a Player Level, campaign slot, boss-death flag, or level-clear receipt
exists. Recruitment requires an authored enemy encounter and a successful
physical Hero Soul pickup:

`hostile Hero → defeat → physical Soul drop → player interaction → Soul enters
inventory with no effect → explicit Equip → exact Soul/Hero/effects activate immediately`

Boss death may spawn a drop but cannot commit Hero ownership. Level completion
may grant economy/progression but cannot synthesize a missing Hero Soul.

## Approved milestones

| Campaign slot | Boss event | Durable result | Status now |
| --- | --- | --- | --- |
| Level 5, Chapter 1 | Defeat KingdomArcher (`hooded_archer_miniboss`), then physically collect its drop | One Normal item-level-1 `archer_hero` Soul; `soul_hero`; `soul_relay`; no automatic Reserve assignment | **Content ready:** boss, drop, pickup authority, encounter objective and separate transaction are wired |
| Levels 5–10, Chapter 1 | Post-recruitment escape phase | Sword + Archer establish the close/ranged Soul Relay partnership | **Partial:** Level 6 copy/objectives are retargeted; remaining story presentation may still need polish |
| Level 15, Chapter 2 | Force `axe_soul_boss` to the exact 50% retreat threshold | Story receipt `axe_survived_coven` and non-Soul key item `fractured_axe_insignia`; no death, Soul or `axe_hero` ownership | **Canonical design:** Axe escapes; real recruitment is deferred until an authored defeat-and-pickup encounter |
| Level 20, Chapter 2 | Defeat `wizard_hero_boss`, then physically collect its Wizard Soul | One Normal item-level-20 `wizard_hero` Soul; no automatic Active/Reserve assignment | **Canonical design:** boss death, physical pickup and level first-clear remain independent transactions |

Level 15 is global campaign slot 15 and therefore belongs to Chapter 2. Its
stable level ID remains `chapter_2_level_15`. Reaching 50% emits a retreat event,
never `died` or `enemy_killed`; therefore it cannot satisfy the universal Hero
recruitment rule. Existing Axe data remains save-compatible but is not proof of
new-profile ownership.

Level 20 uses stable level ID `chapter_2_level_20`. Its Wizard pickup transaction
is `campaign:chapter_2_level_20:wizard_soul_pickup:v1`. The pickup grants
`wizard_hero` to inventory only; explicit Equip remains the sole activation
trigger. `mage_hero` is a legacy alias that must migrate one-way to
`wizard_hero`, not a second identity.

## Level 5 has two independent receipts

### Physical Archer Soul pickup

Transaction:
`campaign:chapter_1_level_5:archer_soul_pickup:v1`

The Level 5 special runtime is the only authority for this transaction. It is
allowed only after the live boss dies and the player interacts with the spawned
pickup. The grant is:

- Hero ID `archer_hero`;
- Normal rarity (`0`), item level `1`, affinity `ranger`;
- source `chapter_1_level_5_archer_drop`, deterministic seed `15005`;
- feature IDs `soul_hero` and `soul_relay`;
- `assign_to_first_reserve = false`.

Pickup ownership only adds the Soul to inventory: it does not change Active or
Reserve and applies no Hero/Soul effects. The player must explicitly press
**Equip** on that exact Soul in the wardrobe. Equip is the activation trigger
and takes effect immediately, including during the current run when the wardrobe
is accessible; it is not gated by starting another run.

### Level completion reward

`chapter_1_level_5_reward` contains account currency, Hero Materials, Monster
Fragments, one Player Level and the Blood Crucible blueprint. It contains no
Hero Soul grant. Therefore completion reconciliation cannot accidentally recruit
Archer when the physical pickup receipt is absent.

## Encounter and replay boundary

The exit requires all three objectives: clear the level, defeat the exact Hooded
Archer and record `archer_hero_soul_collected`. Boss death alone leaves the exit
closed and ownership unchanged.

On replay, an existing pickup receipt restores the collection objective and
suppresses a duplicate Soul drop, while the boss-death objective still requires
the real encounter. Repeated death signals, reloads and duplicate callbacks must
remain idempotent.

`CampaignProgressionService.apply_boss_defeat()` must not be activated as an
alternate Level 5 recruitment path. Its milestone-completion model cannot prove
physical pickup and would violate the Hero unlock rule.

## Save and migration rule

Legacy Axe weapon/Soul data remains archived or compatible and is never converted
into Archer ownership. Raw legacy weapon IDs (`bow`, `axe`) are not proof of Hero
ownership. Migration may repair data only from the exact physical-pickup receipt;
it must never infer `archer_hero` from Level 5 completion, Player Level, unlocked
levels, or old Axe entitlement.
