# SOUL OF HERO save schema V2

## Storage contract

`SaveService` writes `user://soul_of_hero_save.json`. A valid legacy
`user://living_arsenal_save.json` may be imported once. Each commit:

1. deep-copies, normalizes, and validates the candidate;
2. writes and flushes `.tmp`;
3. parses and validates that temporary generation;
4. rotates a valid primary to `.bak`;
5. atomically renames the temporary file to the primary.

Startup tries primary, backup, permanent pre-schema-v2 migration backup, then
safe defaults. Runtime objects (`Node`, `Resource`, `RID`, `Callable`, vectors,
scene references) cannot enter JSON.

The outer schema is `2`. Built-in migration is `v0 → v1 → v2`. Hero Soul rules
have a separate `inventory.hero_soul_rules_version = 2` marker so adding rarity
definitions does not require another outer schema version. Auxiliary equipment
uses its own `inventory.auxiliary_equipment_version = 2` marker for the
Vessel/Boots/Jewelry and upgrade-stone migration.

## Current outline

```text
schema_version: 2
revision: int

progression:
  campaign:
    chapter: int
    level: int
    unlocked_levels: Array[String]
    completed_levels: Dictionary[String, bool]
    optional_objectives: Dictionary
    completed_milestones: Dictionary[String, bool] # when present
  unlocked_heroes: Dictionary[String, bool]
  features: Dictionary[String, bool]
  player:
    level: int                         # 1..100
    xp: int
    stat_allocation: {hp, damage, mana} # `damage` là stable key của Power
    stat_economy_version: 2
    free_stat_reallocation_credits: int # 0..1; chỉ migration pre-Power
    skill_allocations:
      <hero_id>:
        normal_attack: int
        active_skill: int
        dash: int
        soul_ready_condition: int
        summon_skill: int
        departure_skill: int

soul_team:
  active_hero: String
  reserve_souls: Array[String]         # fixed capacity 2
  capacity: 2

currencies:
  account: int
  hero_materials: int
  monster_fragments: int

inventory:
  item_stacks: Dictionary
  hero_soul_rules_version: 2
  auxiliary_equipment_version: 2
  hero_souls: Array[HeroSoulInstance]
  auxiliary_equipment: Array[AuxiliaryEquipmentInstance]
  rarity_items: Array
  favorites: Array                     # legacy/general reserved storage
  locked: Array                        # legacy/general reserved storage

auxiliary_loadout:
  soul_vessel: String                  # equipped item UUID or empty
  soul_boots: String
  soul_trace: String                   # Jewelry; stable technical key

mastery: Dictionary
monster_parts: {owned: Dictionary, equipped: Dictionary}
mode_progress: {hunt: Dictionary, challenge: Dictionary, depth: Dictionary}
bestiary: {discovered: Array[String]}
tutorials: Dictionary[String, bool]
settings: Dictionary
applied_transactions: Dictionary
legacy_audit: Dictionary
  stat_allocation_pre_power: {hp, damage, mana} # khi profile được migration
  soul_focus_equipment_pre_v2: {items: Array, loadout: Dictionary}
```

## Persisted item shapes

Hero Soul:

```text
instance_id, hero_id, rarity(0..7), item_level, affinity, variant_id,
affixes[], monster_soul_id, locked, favorite, equipped, source_id
```

Each affix is normalized with `affix_id`, `field`, `unit`, `value`, `pool`,
`stacking_group`, `tags`, and `roll_multiplier` when the roll has one. This
preserves the maximum-two-per-stacking-group invariant across JSON reloads.
`monster_soul_id` is a reserved socket reference; Monster Soul runtime remains
hidden before Level 50.

Auxiliary equipment:

```text
uuid, slot, rarity, item_level, primary, affixes[], upgrade_rank, favorite, locked
```

The loadout stores UUID references rather than duplicate item dictionaries.
Unknown slots, missing references, cross-slot items, duplicate UUIDs, and equip
before the level 2/4/7 gates fail closed. Live slots are `soul_vessel`,
`soul_boots`, and `soul_trace`; `upgrade_rank` must be an integer from 0 through
5. Effective primary/affix values use `1 + 0.03 × upgrade_rank` without changing
the persisted original roll.

Stackable item:

```text
kind, quantity,
display_name?, icon_path?, rarity?, item_level?
```

The four optional presentation fields are written by physical in-run loot so
the live bag can retain its readable identity, transparent icon and strongest
rarity without waiting for a result screen. Legacy/campaign stacks that never
carried presentation provenance remain valid with only `kind` and `quantity`.
Upgrade stones use stable kinds `soul_upgrade_stone_<rarity>` and are consumed
only by the atomic auxiliary-upgrade API.

## Compatibility rules

- Six-tier Hero Soul rules v1 map rarity `0..4` unchanged and old Eternal `5`
  to current Eternal `7`.
- Known legacy affixes are retained deterministically up to the new rarity cap,
  without duplicates or more than two from one stacking group.
- A missing rules marker is interpreted as legacy only when the stored Soul
  shape proves it (legacy affix IDs or an old over-cap count). Current-looking
  Crystal/Mythic/Eternal data remains `5/6/7`.
- Obsolete weapon ownership/loadout/tutorial/mastery data is archived under
  `legacy_audit`; it never silently unlocks a SOUL OF HERO Identity.
- Economy Power giữ key JSON `damage` để save cũ và item consumer không bị đổi
  nghĩa kỹ thuật. Profile chưa có `stat_economy_version = 2` giữ nguyên build,
  archive allocation cũ và nhận đúng một credit phân bổ lại miễn phí. Migration
  idempotent: reload không thể mint thêm credit.
- Auxiliary equipment v1 được migration trước merge/sanitize. Vessel/Trace hợp
  lệ được giữ và nhận rank 0; mọi legacy `soul_focus` hợp lệ được archive dưới
  `legacy_audit.soul_focus_equipment_pre_v2`, bỏ khỏi loadout và đổi thành đúng
  một đá cùng rarity cho mỗi item. Trace/Jewelry cũ chưa đạt gate Level 7 được
  unequip an toàn nhưng không bị xóa.
- Marker equipment v2 làm migration idempotent. Focus/rank/reference malformed
  hoặc stack overflow fail closed thay vì tự sửa thành tài sản khác.
- `COMMON` remains a code compatibility alias for rarity `NORMAL = 0`.

## Main mutation APIs

- Atomic foundation: `transact_once`, `get_snapshot`, `get_value`,
  `save_now`, `reload_save`, `is_transaction_applied`.
- Player: `grant_player_levels`, `allocate_player_stat`, `reallocate_player_stats`,
  `allocate_hero_skill`, `respec_hero_skills`.
- Hero Souls: `grant_hero_soul`, `fuse_hero_souls`, `sell_hero_soul`.
- Auxiliary equipment: `grant_auxiliary_equipment`,
  `equip_auxiliary_equipment`, `unequip_auxiliary_slot`,
  `upgrade_auxiliary_equipment`,
  `sell_auxiliary_equipment`, `set_auxiliary_equipment_favorite`,
  `set_auxiliary_equipment_locked`.
- Team/tutorial/settings/reset APIs remain transaction-backed and store only
  stable IDs and JSON-safe values.

Reward/result keys must be deterministic and unique to the authored event, for
example `campaign:chapter_1_level_5:complete`. Never use a random value or
timestamp for a first-clear receipt.

## Verification

```powershell
.\tools\run_save_unlock_tests.ps1
.\tools\run_player_progression_save_tests.ps1
.\tools\run_auxiliary_equipment_save_tests.ps1
.\tools\run_auxiliary_equipment_upgrade_migration_tests.ps1
.\tools\run_save_compatibility_regression_tests.ps1
```

The compatibility suite covers legacy rarity migration, semantic affix
roundtrip, corruption rejection, auxiliary aliases/collisions, same-slot
replacement, durable favorite/lock protection, Focus-to-stone conversion,
rank cap, same-rarity stone consumption, rollback and retry idempotency.
