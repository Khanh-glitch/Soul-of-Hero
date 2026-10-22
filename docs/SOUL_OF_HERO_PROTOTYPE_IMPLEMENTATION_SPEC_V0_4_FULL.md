# SOUL OF HERO — PROTOTYPE IMPLEMENTATION SPEC V0.4

**Target engine:** Godot 4.7  
**Current production state:** Chapter 1, Level 1–5 playable; Sword Hero; Skeleton Swordsman, Bone Reaper, Blood Vampire; no production boss; encounter data exists but runtime still spawns directly from JSON; victory is currently Sigil collection + exit portal.  
**Production gate:** complete Chapter 1 as a coherent 10-level product slice before authoring Chapter 2–10 content.  
**Long-term target:** 10 chapters / 100 levels.

---

## 1. Core stat progression

**Recommendation:** retain three investable stats—HP, Damage, Mana—with 5 Stat Points per player level, a 200-point cap per stat, diminishing point returns after 100, and automatic milestone perks.

**Status:** IMPLEMENT NOW.

### Base formulas

Use three allocation values:

```gdscript
hp_points: int
damage_points: int
mana_points: int
```

Each is capped at `200`.

```text
HP points 1–100:     +8 Max HP / point
HP points 101–150:   +5 Max HP / point
HP points 151–200:   +3 Max HP / point

Damage points 1–100:   +0.45% Core Damage / point
Damage points 101–150: +0.25% Core Damage / point
Damage points 151–200: +0.15% Core Damage / point

Mana points 1–100:   +3 Max Mana / point
Mana points 101–150: +2 Max Mana / point
Mana points 151–200: +1 Max Mana / point
```

At level 100 the player has approximately 500 total Stat Points, so the 200-point cap prevents a one-stat allocation and forces at least a two-stat build. Diminishing returns prevent `200/200/100` from becoming automatically inferior to a more balanced build while preserving extreme specialization.

### HP milestone table

| Invested HP points | Permanent milestone bonus |
|---:|---|
| 10 | +5% Max HP |
| 20 | +5% Defense |
| 30 | +10% healing and HP-pickup effectiveness |
| 40 | +10% stagger resistance |
| 50 | +5% Max HP |
| 60 | +5% damage reduction while below 40% HP |
| 70 | +10% shield effectiveness |
| 80 | +5% Defense |
| 90 | +10% healing received from Hero skills |
| 100 | **Last Soul:** once per level, lethal damage leaves the player at 1 HP and grants 0.8 seconds of invulnerability |
| 125 | +5% Max HP |
| 150 | +5% damage reduction against elites and bosses |
| 175 | +15% stagger resistance |
| 200 | **Relay Guard:** after Q2 Relay, gain a shield equal to 8% Max HP for 3 seconds; 12-second internal cooldown |

### Damage milestone table

| Invested Damage points | Permanent milestone bonus |
|---:|---|
| 10 | +2% Critical Chance |
| 20 | +5% Attack Speed |
| 30 | +10% Critical Damage |
| 40 | +5% Active Skill damage |
| 50 | +5% Core Damage |
| 60 | +6% Summon Skill damage |
| 70 | +6% Departure Skill damage |
| 80 | +5% armor penetration |
| 90 | +8% damage against elites and bosses |
| 100 | **Relay Overdrive:** after Q2 Relay, +12% damage for 4 seconds; 10-second internal cooldown |
| 125 | +5% Attack Speed |
| 150 | +4% Critical Chance |
| 175 | +15% Critical Damage |
| 200 | **Execution:** +15% damage against enemies below 25% HP |

### Mana milestone table

| Invested Mana points | Permanent milestone bonus |
|---:|---|
| 10 | +1.5 Mana regenerated per second |
| 20 | -5% Active Skill Mana cost |
| 30 | +5% Active Skill cooldown recovery |
| 40 | +5% Max Mana |
| 50 | +1.5 Mana regenerated per second |
| 60 | -5% reserve-Soul support cooldown |
| 70 | +8% skill area and effect duration |
| 80 | +5% global skill cooldown recovery |
| 90 | Q2 Relay restores 8% Max Mana |
| 100 | **Flow State:** Q2 Relay removes 15% of the active Hero Skill’s remaining cooldown |
| 125 | +5% Max Mana |
| 150 | -8% all Skill Mana costs |
| 175 | +5% global skill cooldown recovery |
| 200 | **Soul Reservoir:** the first Active Skill used within 4 seconds after Relay costs no Mana; 15-second internal cooldown |

### Global caps

```text
Total cooldown reduction: 35%
Total dodge chance: 25%
Total damage reduction: 50%
Total bonus attack speed: 60%
Total critical chance: 60%
```

These caps include stats, milestones, Hero Souls, equipment, and later Monster Souls.

---

## 2. Skill Point ownership and rank gating

**Recommendation:** Skill Points belong to one global account pool, while allocations are stored per Hero Identity—not per Hero Soul copy and not per loadout.

**Status:** IMPLEMENT NOW.

### Rules

- Gain `5 Skill Points` per player level.
- One point raises one skill track by one rank.
- Every skill track has a maximum rank of `20`.
- A Hero Soul copy inherits the skill ranks of its Hero Identity.
- Finding a better Sword Hero Soul does not require leveling Sword again.
- Skill Points may remain unspent indefinitely.

### Six standard skill tracks per Hero Identity

1. Normal Attack / Hero basic mechanic
2. Active Skill
3. Dash
4. Soul Ready Condition
5. Summon Skill
6. Departure Skill

Each Hero therefore requires `120 points` to max all six tracks.

### Player-level rank gate

```gdscript
max_skill_rank_allowed = clampi(ceili(player_level / 5.0), 1, 20)
```

Examples:

| Player level | Maximum rank of any one skill |
|---:|---:|
| 1–5 | 1 |
| 6–10 | 2 |
| 21–25 | 5 |
| 46–50 | 10 |
| 71–75 | 15 |
| 96–100 | 20 |

This preserves the user rule “1 point = 1 skill level” while preventing one Hero from reaching Rank 20 early. At level 100 the player has enough points to strongly specialize roughly four Hero Identities, but not an unlimited roster.

### Respec

- Free until player level 20.
- Afterwards, respec is performed per Hero Identity.
- Cost:

```gdscript
respec_cost = mini(2500, 100 + player_level * 25)
```

- Refunds every point spent on that Hero Identity.
- Respec is available only outside combat.
- No premium currency.

---

## 3. Rarity ladder

**Recommendation:** use the eight Dungeon Quest names and order as the prototype’s linear Hero Soul grade ladder, while implementing Soul of Hero’s own rules.

**Status:** IMPLEMENT DATA NOW; activate higher tiers progressively.

### Final order

| Index | Rarity | UI color |
|---:|---|---|
| 0 | Normal | Gray |
| 1 | Magic | Blue |
| 2 | Rare | Yellow |
| 3 | Epic | Orange |
| 4 | Legendary | Red |
| 5 | Crystal | Cyan |
| 6 | Mythic | Purple |
| 7 | Eternal | Green |

The Dungeon Quest community reference lists those eight names/colors in that order from worse to best. Dungeon Quest itself also treats Crystal and Mythic as special item/affix states, with Mythics created through Mythstones; Soul of Hero intentionally normalizes the names into one data ladder for clarity and fusion compatibility rather than copying those original crafting rules.

### Content access gates

| Rarity | Earliest normal campaign access |
|---|---:|
| Normal | Level 1 |
| Magic | Level 1 |
| Rare | Level 3 |
| Epic | Level 8 |
| Legendary | Chapter 2 |
| Crystal | Chapter 4 |
| Mythic | Chapter 5 / Monster Soul era |
| Eternal | Chapter 9 |

All eight definitions exist in data from the beginning so save data and fusion logic never require a schema migration.

---

## 4. Hero Soul affix system

**Recommendation:** a tagged affix pool with Universal, Affinity, and Soul-Action families. No Quality stat. Each affix rolls independently inside the range allowed by rarity.

**Status:** IMPLEMENT NOW for Normal–Epic; definitions for all tiers now, high-tier special affixes LATER.

### Affix count

| Rarity | Standard affixes | Special property |
|---|---:|---|
| Normal | 0 | None |
| Magic | 1 | None |
| Rare | 2 | None |
| Epic | 3 | None |
| Legendary | 4 | One affix must be Soul-Action or Affinity |
| Crystal | 4 | +1 Crystal property |
| Mythic | 4 | +1 Mythic rule property |
| Eternal | 5 | +1 Eternal rule property |

### Rarity roll multipliers

Each `AffixDefinition` stores a base range. Apply:

| Rarity | Min multiplier | Max multiplier |
|---|---:|---:|
| Magic | 0.75 | 1.00 |
| Rare | 0.90 | 1.15 |
| Epic | 1.05 | 1.30 |
| Legendary | 1.20 | 1.50 |
| Crystal | 1.35 | 1.65 |
| Mythic | 1.50 | 1.85 |
| Eternal | 1.70 | 2.10 |

Example: an affix with a base range of `+4–6% Max HP` rolls `+3–6%` on Magic and approximately `+7–13%` on Eternal after rounding.

### Roll weights

For a Hero Soul with an Affinity:

```text
35% Universal pool
45% matching Affinity pool
15% Soul-Action pool
5% off-Affinity pool
```

At Legendary and above, off-Affinity weight becomes 10% by reducing matching Affinity weight to 40%.

Rules:

- No duplicate affix ID on one item.
- Maximum two affixes from the same stacking group.
- Affix generation respects global stat caps.
- Affixes that refer to unavailable mechanics are excluded by tags.
- Sword Souls may not roll projectile-only affixes unless a Variant or Monster Soul gives Sword the required tag.

### Universal affix pool

| ID | Effect | Base roll |
|---|---|---:|
| `max_hp_pct` | Max HP | 4–6% |
| `core_damage_pct` | Core Damage | 3–5% |
| `max_mana_pct` | Max Mana | 5–8% |
| `defense_pct` | Defense | 4–7% |
| `movement_speed_pct` | Movement Speed | 2–4% |
| `attack_speed_pct` | Attack Speed | 2–4% |
| `crit_chance_pct` | Critical Chance | 1.5–3% |
| `crit_damage_pct` | Critical Damage | 8–12% |
| `cooldown_recovery_pct` | Global skill cooldown recovery | 2–4% |
| `mana_regen_pct` | Mana regeneration | 5–8% |
| `dodge_chance_pct` | Dodge Chance | 1–2% |
| `healing_received_pct` | Healing received | 5–8% |

### Warrior Affinity pool

| ID | Effect | Base roll |
|---|---|---:|
| `melee_damage_pct` | Melee damage | 4–7% |
| `defense_while_attacking_pct` | Damage reduction during non-Dash attack animations | 2–4% |
| `stagger_resist_pct` | Stagger resistance | 6–10% |
| `low_hp_defense_pct` | Defense below 40% HP | 5–8% |
| `melee_threat_shield_pct` | Shield gained when a melee-threat Ready Condition activates | 2–4% Max HP |
| `close_range_damage_pct` | Damage within close range | 4–7% |

### Ranger Affinity pool

| ID | Effect | Base roll |
|---|---|---:|
| `projectile_damage_pct` | Projectile damage | 4–7% |
| `projectile_speed_pct` | Projectile speed | 6–10% |
| `dash_cooldown_pct` | Dash cooldown recovery | 4–7% |
| `post_dash_damage_pct` | Damage for 3 seconds after Dash | 5–8% |
| `move_attack_penalty_reduction_pct` | Reduces movement penalty while attacking | 10–20% |
| `execute_damage_pct` | Damage to enemies below 30% HP | 5–8% |

### Magician Affinity pool

| ID | Effect | Base roll |
|---|---|---:|
| `active_skill_power_pct` | Active Skill damage/effect | 4–7% |
| `active_mana_cost_pct` | Active Skill Mana cost reduction | 4–7% |
| `active_cooldown_pct` | Active Skill cooldown recovery | 3–5% |
| `summon_cooldown_pct` | No-Relay Summon cooldown recovery | 3–5% |
| `effect_duration_pct` | Skill effect duration | 5–8% |
| `area_size_pct` | Skill area size | 4–7% |

### Soul-Action affix pool

| ID | Effect | Base roll |
|---|---|---:|
| `active_power_pct` | Active Skill power | 4–7% |
| `summon_power_pct` | Summon Skill power | 5–8% |
| `departure_power_pct` | Departure Skill power | 5–8% |
| `relay_shield_pct` | Shield after Q2 Relay | 2–4% Max HP |
| `ready_window_seconds` | Extends Q-ready reaction window | 0.10–0.18 sec |
| `no_relay_refund_pct` | Refunds support cooldown when Q1 does not become Q2 | 4–7% |
| `relay_arrival_speed_pct` | Attack and movement speed after Relay for 3 sec | 3–6% |
| `departure_distance_damage_pct` | Departure bonus at maximum configured Relay distance | 5–10% |
| `relay_mana_restore_pct` | Mana restored on Q2 Relay | 2–4% Max Mana |
| `summon_multi_hit_cooldown_pct` | Summon hitting 3+ targets reduces support cooldown | 4–7% |

### High-tier property scope

- Crystal property: strong numeric modifier or one additional skill tag.
- Mythic property: changes one action rule.
- Eternal property: build-defining rule with an internal cooldown.

Create the interfaces now, but author the actual Crystal/Mythic/Eternal property library only after Chapter 1 balance is stable.

---

## 5. Auxiliary equipment

**Recommendation:** three account-level equipment slots shared by both equipped Hero Souls.

**Status:** IMPLEMENT NOW.

This matches the fiction that one player Soul Core inhabits different Hero Souls and prevents the inventory from becoming six separate armor sets.

### Slots

| Slot | Fantasy | Main stat groups |
|---|---|---|
| `Soul Vessel` | The container that stabilizes the player’s soul | HP, Defense, healing, stagger resistance |
| `Soul Trace` | The movement imprint left by the soul | Movement, Dash, Dodge, Relay distance/arrival |
| `Soul Focus` | The mental focus controlling skills and Souls | Mana, regeneration, cooldown, Active/Summon/Departure power |

Rules:

- One item per slot.
- Shared by the active and reserve Hero.
- Does not visually replace Hero sprites in the prototype.
- Uses the same eight rarity definitions.
- No Hero Identity, Variant, or Monster Soul socket.
- One guaranteed slot-specific primary stat plus rarity-based affixes.
- Slot-specific pools prevent every item from rolling every stat.

### Chapter 1 unlock cadence

- Level 2: Soul Vessel.
- Level 4: Soul Trace.
- Level 7: Soul Focus.

### Drop principles

- Normal enemies: low chance.
- Chests: equipment-focused loot.
- Elites: at least one equipment or Hero Soul roll.
- Chapter boss: guaranteed Hero Soul plus one equipment item.
- First-clear rewards are deterministic; replay rewards are random from visible tables.

---

## 6. Selling and guaranteed fusion

**Recommendation:** rarity-scaled formulas tied to item level, guaranteed 3-to-1 fusion, no failure.

**Status:** IMPLEMENT NOW.

### Sell value

```gdscript
RARITY_WEIGHT = {
    NORMAL: 1,
    MAGIC: 3,
    RARE: 9,
    EPIC: 27,
    LEGENDARY: 81,
    CRYSTAL: 243,
    MYTHIC: 729,
    ETERNAL: 2187
}

hero_soul_sell_value =
    roundi(10.0 * RARITY_WEIGHT[rarity] * (1.0 + 0.01 * (item_level - 1)))

aux_gear_sell_value =
    roundi(hero_soul_sell_value * 0.60)
```

### Fusion recipe

```text
3 Hero Souls
+ same Hero Identity
+ same rarity
+ Gold cost
→ 1 Hero Soul
  same Hero Identity
  next rarity
```

Result rules:

- Item level becomes the highest item level among the three inputs.
- All base stat bonuses and affixes reroll under the target rarity rules.
- Variant chance is checked if the target rarity is eligible.
- Fusion never fails.
- Eternal cannot fuse upward.
- Equipped, favorite, locked, or Monster-Soul-bonded items cannot be consumed.

### Gold cost

```gdscript
fusion_gold_cost =
    roundi(2.0 * (
        sell_value(input_1)
        + sell_value(input_2)
        + sell_value(input_3)
    ))
```

The opportunity cost is therefore the three consumed Souls, their possible sale value, and additional Gold.

### Anti-inflation and soft-lock rules

- The first tutorial fusion is free.
- Campaign completion never requires fusion.
- Every required Hero Identity has a deterministic free source.
- Standard level Gold target:

```gdscript
base_level_gold = 10 + 3 * level_number
boss_level_gold = base_level_gold * 3
```

- Gold sinks in the first release: fusion and skill respec.
- Affix reroll is not enabled until later chapters.
- Selling is always available outside combat.
- The game must warn before selling the last owned copy of a Hero Identity.

---

## 7. Hero Variants

**Recommendation:** a Variant is a distinct authored kit profile inside one Hero family, not a random affix and not a full new Hero.

**Status:** IMPLEMENT SCHEMA NOW; CONTENT LATER.

### Eligibility threshold

```gdscript
variant_min_rarity =
    min(ETERNAL, hero_identity.minimum_rarity_index + 4)
```

Examples:

| Hero minimum rarity | Earliest Variant rarity |
|---|---|
| Normal | Legendary |
| Magic | Crystal |
| Rare | Mythic |
| Epic or higher | Eternal |

### Sources

- Direct boss/Hunt drop.
- Eligible fusion result.
- Story reward in rare cases.
- Never exclusive to paid random summoning.

### Fusion Variant chance

| Target rarity | Base Variant chance |
|---|---:|
| Legendary | 5% |
| Crystal | 8% |
| Mythic | 12% |
| Eternal | 20% |

Each eligible failed fusion adds `+5 percentage points`; the fifth eligible fusion is guaranteed to produce the Variant if the Hero has one.

### Production limit

- Chapter 1: no Variant content.
- 100-level prototype: maximum one Variant per Hero Identity.
- Initial production goal: two Variants total—Sword Variant and the second Hero Variant.

### Kit change budget

A Variant changes:

- Exactly two major modules among Normal Attack, Active Skill, Dash, Ready Condition, Summon Skill, Departure Skill.
- One minor passive or presentation rule.
- VFX/palette and descriptions.

It should reuse approximately 60–70% of the original animation and core architecture.

### Relationship with affixes and Monster Souls

- Variants roll the same rarity and affix systems.
- Monster Souls modify action tags rather than hard-coded Hero names.
- Unsupported Variant/Monster Soul combinations are blocked in UI rather than producing broken fallback behavior.

---

## 8. Monster Soul

**Recommendation:** one bonded Monster Soul per Hero Soul, unlocked at Level 50; mechanical changes are authored through a bounded mutation profile.

**Status:** DATA INTERFACES NOW; RUNTIME AND CONTENT LATER at Level 50.

### Unlock and source

- Unlock after the Chapter 5 boss at Level 50.
- First Monster Soul is guaranteed.
- Later sources: chapter bosses, elite Hunts, visible fragment rewards.
- No paid-only source.

### Socket

- One Monster Soul socket per Hero Soul.
- Socket is hidden before Level 50.
- Monster Soul cannot be installed during combat.

### Mutation profile

Each Monster Soul contains:

1. Stat package.
2. Normal/Active modifier.
3. Summon modifier.
4. Departure modifier.
5. VFX/audio theme.
6. Required and forbidden action tags.

To control production cost:

- Every installed Monster Soul affects the Hero’s overall presentation and stats.
- It mechanically rewrites a maximum of three kit modules.
- Other kit modules may receive only numeric or cosmetic changes.
- No Monster Soul requires a wholly separate animation set for every Hero.

### Preview and training

Before permanent bonding:

- Show every changed action in a comparison panel.
- Provide a training-room preview using the exact selected Hero Soul.
- Require explicit confirmation.
- Auto-lock the resulting Hero Soul against sale/fusion.

### Permanence and safety valve

- Bonding is permanent by default.
- A rare deterministic `Soul Severance` item can remove it.
- Severance returns the Hero Soul but destroys the installed Monster Soul.
- At least one Severance is obtainable through gameplay in Chapters 6–10.

### Duplicates

- Duplicate Monster Souls convert into family-specific `Monster Essence`.
- Three Essence upgrade that Monster Soul from Rank 1→2 or 2→3.
- Ranks improve only numeric values, never add another mechanic.
- Maximum Rank 3.
- No random upgrade failure.

### First recommended Monster Soul

`Reaper Monster Soul`, guaranteed at Level 50, because Bone Reaper already exists in production and provides a clear throw/return/spectral theme.

---

## 9. Second production Hero: Axe Hero

**Recommendation:** Axe Hero, using existing/legacy free asset work only after its commercial-use license is verified; otherwise use an original generated placeholder until a cleared asset exists.

**Status:** IMPLEMENT NOW for Chapter 1.

Axe contrasts Sword through area control, charge commitment, and outbound/return geometry while reusing existing Axe VFX work.

### Affinity and minimum rarity

- Affinity: Warrior.
- Minimum rarity: Magic.
- Level 5 grants one deterministic Magic Axe Hero Soul.

### Normal Attack — Heavy Chain

1. `Hook Chop` — 100% damage, short diagonal cleave, pulls small enemies slightly inward.
2. `Back Cleave` — 120%, broad reverse arc, moderate stagger.
3. `Execution Cleave` — 180%; hold Attack to charge up to +60% damage, area, and stagger. Movement slows while charging.

Combo reset window: 2.2 seconds.

### Active Skill — Throw & Recall

- First press throws the Axe through enemies to the chosen point.
- Player may move and Dash while Axe is away.
- Second press or timeout recalls it to the player’s current position.
- Each path damages once.
- An enemy hit on outbound and return receives `Cross Cut`: +50% of the return hit and strong stagger.
- The skill cannot pass through impassable world geometry.

### Soul Ready Condition — Crowd Pressure

Q becomes ready when:

- At least three hostile enemies are inside the configured radius, and
- At least one of those enemies is in an active attack/telegraph state against the current Hero.

The opportunity ends when the crowd count or threat requirement is no longer met.

### Summon Skill — Reaper Drop

1. Axe Soul lands at the densest valid enemy cluster.
2. Performs a 360° sweep that pulls small enemies slightly toward the center.
3. Performs an overhead cleave toward the cluster center.

Takeover windows:

- Early: on landing.
- Mid: during the pull sweep.
- Late: immediately after the overhead cleave.

No-Relay support cooldown: 12 seconds.

### Departure Skill — Last Orbit

When Axe is replaced:

1. Axe Soul performs one wide spin at the old position.
2. Throws the spectral Axe in a straight line to the new active Hero.
3. Damages enemies along the line.
4. Disappears on arrival.

### Two-way Relay combo with Sword

**Sword → Axe**

- Sword gets surrounded.
- Axe Q1 drops into the cluster and gathers it.
- Q2 transfers control to Axe.
- Sword uses Returning Blade from the old position to Axe, cutting through the gathered group.
- Axe follows with charged Execution Cleave or Throw & Recall.

**Axe → Sword**

- A melee threat triggers Sword Q.
- Sword intercepts and pursues the attacker.
- Q2 transfers control to Sword.
- Axe uses Last Orbit at the original cluster, then throws toward Sword.
- Sword begins its four-hit movement combo through the same line.

---

## 10. Campaign and level structure

**Recommendation:** chapter-map progression with instanced, replayable mobile levels—not open world and not one giant connected map.

**Status:** IMPLEMENT NOW.

This matches the current level-based project, scales to 100 levels, respects short mobile sessions, and still supports a coherent story through chapter maps and cutscene/story nodes.

### Structure

- 10 Chapter Definitions.
- 10 Level Definitions per chapter.
- Each level is a 3–6 minute instanced dungeon map.
- Normal level: 2–4 encounter groups.
- Boss level: 5–8 minutes.
- A Chapter Map presents nodes, story, rewards, replay, and boss gate.
- Replay is available from any cleared node.
- Hunt uses a shorter encounter or boss-only version after first clear.

### Runtime migration

Replace direct JSON spawning with:

```text
ChapterDefinition
  → LevelDefinition
      → ObjectiveDefinition
      → EncounterDefinition[]
      → RewardBundleDefinition
```

Existing JSON may be migrated into Resources or retained as authored source files, but gameplay runtime must ask an `EncounterRunner` to execute validated definitions instead of spawning enemies directly from level scripts.

### Objectives

Sigil collection becomes one objective type, not the universal victory rule.

Prototype objective types:

- `ELIMINATE_ALL`
- `COLLECT_SIGILS`
- `ACTIVATE_OBJECTS`
- `DEFEND_TARGET`
- `DEFEAT_ELITE`
- `DEFEAT_BOSS`
- `REACH_EXIT_AFTER_OBJECTIVE`

A level wins only when its primary ObjectiveDefinition is complete and the exit rule, if any, is satisfied.

### Rewards

Each level has:

- `first_clear_rewards`
- `repeat_rewards`
- `optional_challenge_rewards`
- `boss_rewards` where applicable

A RewardBundle may contain:

- Gold.
- Player XP.
- Guaranteed Hero Soul.
- Hero Soul loot roll.
- Auxiliary equipment roll.
- Stat/Skill tutorial unlock.
- Feature unlock.
- Story flag.

### Boss gate

- Level 9: gate/miniboss level.
- Level 10: chapter boss.
- Level 10 unlocks the next chapter.
- Bosses have visible first-clear and repeat loot tables.

---

## 11. Content matrix: 10 chapters / 100 levels

**Recommendation:** each chapter adds one spatial rule, two new base-enemy archetypes, one champion/elite, one boss, and at most one major progression system.

**Status:** CHAPTER 1 IMPLEMENT NOW; CHAPTERS 2–10 LATER.

Old enemies remain in approximately 30–40% of later encounters with new modifiers, preventing content from becoming disposable while reducing asset cost.

### Chapter 1 — Levels 1–10: Crypt of the Broken Oath

**Biome:** torch-lit crypt, sealed chambers, bone halls, blood vault.  
**Production roster:** Skeleton Swordsman, Bone Reaper, Blood Vampire.  
**New Hero:** Axe at Level 5.  
**Boss:** Vampire Castellan at Level 10.  
**Story:** the Sword Soul awakens inside a crypt where a cult is binding fallen Hero Souls; the player follows stolen Sigils to the Castellan.

| Level | Title | Objective and encounter | Main teaching/reward |
|---:|---|---|---|
| 1 | The First Sigil | Sword tutorial; Skeleton Swordsmen; collect one Sigil and reach exit | Guaranteed Normal Sword Soul; core movement/combat |
| 2 | Torchless Halls | Activate two braziers while fighting Skeletons | Unlock Soul Vessel |
| 3 | The Returning Disc | Bone Reaper introduction; avoid outbound/return projectile; collect two Sigils | Stat allocation tutorial; Rare drop becomes possible |
| 4 | Blood in the Vault | Blood Vampire introduction; defeat a marked Vampire and open the vault chest | Unlock Soul Trace |
| 5 | The Grave Cleaver | Defeat KingdomArcher, then physically recover the Archer Soul | Guaranteed Normal Archer Hero Soul; two-Hero loadout |
| 6 | Two Souls, One Path | Destroy three Soul Anchors using Sword↔Archer Relay | Skill allocation tutorial and respec access |
| 7 | The Failing Beacon | Defend a Soul Beacon through mixed waves | Unlock Soul Focus |
| 8 | Hall of Echoes | Choose Reaper or Vampire branch; elite chest at branch end | Full Hero Soul/gear inventory, sell flow, Epic drops |
| 9 | The Crimson Gate | Collect three Gate Seals; fight Crimson Reaper elite | Guaranteed Rare Hero Soul; boss gate |
| 10 | Lord of the Sealed Crypt | Vampire Castellan, two phases: blink/leech melee pressure, then Reaper-disc and summon patterns | Guaranteed Epic Hero Soul, Fusion, Chapter 2, Hunt replay |

### Chapter 1 boss recommendation — Vampire Castellan

Use Blood Vampire as the visual base plus bespoke boss overlays.

Phase 1:
- Telegraphed blink lunge.
- Leech tether.
- Blood arc melee.
- Summons Skeleton guards.

Phase 2:
- Adds a returning spectral disc inspired by Bone Reaper.
- Creates temporary blood zones.
- Has a short vulnerability after failed blink or caught disc.
- Tests Sword melee-threat Q, Axe crowd Q, Q2 position Relay, and Departure paths.

### Chapter 2 — Levels 11–20: Xưởng Hắc Phù / Coven Foundry

> **Superseded detail:** the authoritative Chapter 2 production contract is
> `docs/CHAPTER_2_COMPLETE_DESIGN_2026_07_16.md`. The former Ash Thrall, Forge
> Archer, Iron Husk and Soulforged Colossus roster is retired.

| Field | Canonical content |
|---|---|
| Stable internal theme | `chapter_2_ashen_foundry`; display name Xưởng Hắc Phù |
| Biome | Ash mire, broken witch gates, alchemy wards and an artificial-Soul foundry |
| New regular family | Coven Wraith with base, venom and Spirit-disruption profiles |
| Elite | Hexwing Familiar / Flying Demon |
| Midboss Level 15 | Axe is forced to 50% and escapes; no Axe Soul or ownership |
| Boss Level 20 | Hero Soul Wizard; true death followed by a mandatory physical Wizard Soul pickup |
| Unlock arc | Second-Spirit onboarding, Forge, Hunt, Salvage/Crafting, Challenge, then Depth |
| Story | The coven stitches bodies, dissolves memories and extracts will to manufacture Hero Souls |
| Anti-boredom | Ten distinct objective verbs, bounded spawn budgets and geometry-driven combat |

### Chapter 3 — Levels 21–30: Moonlit Wilds

| Field | Content |
|---|---|
| Biome | Ruined forest and moon shrines |
| Spatial rule | Ambush foliage and temporary poison zones |
| New base enemies | Feral Stalker; Spore Witch |
| Elite/miniboss | Moonfang Alpha |
| Boss | Moonfang Matriarch |
| Unlock | Magician build expansion and visible affix-reroll preview; the first Magician Hero is Wizard in Chapter 2 |
| Story | Natural spirits are being corrupted into unstable Souls |
| Anti-boredom | Open arenas, pursuit, and zone denial contrast enclosed dungeons |

### Chapter 4 — Levels 31–40: Drowned Archive

| Field | Content |
|---|---|
| Biome | Flooded library and submerged vaults |
| Spatial rule | Water currents alter movement/projectiles |
| New base enemies | Drowned Guard; Ink Oracle |
| Elite/miniboss | Tide Archivist |
| Boss | Keeper of the Deep Index |
| Unlock | Crystal rarity; controlled affix reroll |
| Story | Records reveal the origin of Hero Soul binding |
| Anti-boredom | Directional movement and projectile redirection change Relay positioning |

### Chapter 5 — Levels 41–50: Hollow Cathedral

| Field | Content |
|---|---|
| Biome | Cathedral, ossuary, soul-chain sanctum |
| Spatial rule | Temporary anti-Relay zones and breakable soul chains |
| New base enemies | Penitent Knight; Soul Binder |
| Elite/miniboss | Chain Confessor |
| Boss | Reaper Sovereign |
| Unlock | Monster Soul system at Level 50; guaranteed Reaper Monster Soul; Mythic access |
| Story | The Reaper Sovereign reveals how monster essence can overwrite Hero Souls |
| Anti-boredom | Directly challenges dependency on Relay and introduces build mutation |

### Chapter 6 — Levels 51–60: Frostbound Citadel

| Field | Content |
|---|---|
| Biome | Frozen fortress and ice bridge |
| Spatial rule | Breakable ice walls and short sliding zones |
| New base enemies | Frost Knight; Ice Wisp |
| Elite/miniboss | Glacial Marshal |
| Boss | Winter Regent |
| Unlock | Hero Variant system; Sword Variant target |
| Story | A possible future version of the Sword Hero is found frozen in memory |
| Anti-boredom | Terrain changes paths and creates new Departure lines |

### Chapter 7 — Levels 61–70: Shattered Skyforge

| Field | Content |
|---|---|
| Biome | Floating forge, wind bridges, storm chambers |
| Spatial rule | Wind lanes modify projectile and movement vectors |
| New base enemies | Sky Lancer; Storm Turret |
| Elite/miniboss | Tempest Smith |
| Boss | The Broken Artificer |
| Unlock | Crystal/Eternal preparation; advanced Hunt tiers |
| Story | The source of artificial Soul equipment is uncovered |
| Anti-boredom | Strong vector manipulation rewards precise Summon and Relay placement |

### Chapter 8 — Levels 71–80: Plague Metropolis

| Field | Content |
|---|---|
| Biome | Abandoned city, laboratories, quarantine plazas |
| Spatial rule | Enemies mutate when exposed to temporary infection fields |
| New base enemies | Plague Hound; Red Alchemist |
| Elite/miniboss | Quarantine Warden |
| Boss | The Red Physician |
| Unlock | Second major Monster Soul family; second Hero Variant target |
| Story | Monster Soul experiments are being applied to living Hero vessels |
| Anti-boredom | Enemy behavior changes during encounters rather than only scaling stats |

### Chapter 9 — Levels 81–90: Astral Labyrinth

| Field | Content |
|---|---|
| Biome | Fractured reality and mirrored halls |
| Spatial rule | Rooms rotate between two rule modifiers, clearly telegraphed |
| New base enemies | Rift Walker; Mirror Adept |
| Elite/miniboss | Astral Twin |
| Boss | The Paradox Keeper |
| Unlock | Eternal rarity; Challenge mode |
| Story | Parallel Hero Variants and the true cost of Soul Relay are revealed |
| Anti-boredom | Alternating rules force loadout adaptation without changing controls |

### Chapter 10 — Levels 91–100: Throne of Echoes

| Field | Content |
|---|---|
| Biome | Soul throne, collapsed memories, remixed chapter spaces |
| Spatial rule | Curated combinations of prior mechanics, never more than two simultaneously |
| New base enemies | Echo Knight; Soul Devourer |
| Elite/miniboss | Fallen Hero Pair |
| Boss | The Nameless Sovereign |
| Unlock | Depth/endless mode and final 100-level completion rewards |
| Story | Final confrontation with the entity consuming Hero identities |
| Anti-boredom | Mastery exam of the full system, remixed enemies, multi-Hero Relay pressure |

### Reusable chapter pacing template for Chapters 2–10

| Level within chapter | Function |
|---:|---|
| 1 | Introduce biome and spatial rule |
| 2 | Introduce enemy A |
| 3 | Introduce enemy B |
| 4 | Mixed objective and first elite |
| 5 | Hero/system/reward milestone |
| 6 | Focused mastery challenge |
| 7 | Old + new enemy composition |
| 8 | Branch/replay/Hunt preparation |
| 9 | Miniboss and boss gate |
| 10 | Chapter boss and major unlock |

---

## 12. “Already playable” production gate

**Recommendation:** do not begin mass production of Levels 11–100 until every Chapter 1 criterion below passes.

**Status:** IMPLEMENT NOW as the formal gate.

### Core combat

- Sword kit is stable and fun without loot bonuses.
- Axe kit is stable and fun without loot bonuses.
- Sword→Axe and Axe→Sword each create a different, useful Relay flow.
- Q1 support-only and Q2 Relay are both viable choices.
- No duplicate Heroes, stuck Souls, invalid takeover positions, or orphan effects after 100 repeated Relays.
- Every enemy attack used by Ready Conditions emits reliable start/cancel/impact events.

### Chapter content

- Levels 1–10 are complete from title/loadout to results and next chapter.
- All six Chapter 1 objective types used by content are data-driven.
- Level 10 has a production boss with clear telegraphs, two phases, rewards, retry, and save completion.
- Existing Level 1–5 content is migrated without breaking checkpoints, torches, Sigils, or exits.
- Sigils are one ObjectiveDefinition, not a hard-coded global win condition.

### Progression systems

- Player level, XP, 5 Stat Points, milestone bonuses, 5 Skill Points, rank gate, and respec work.
- Hero Soul inventory supports multiple copies, two equipped slots, rarity, item level, stat rolls, affixes, favorite/lock, source, sell value, and save/load.
- Normal–Epic drops are active and balanced in Chapter 1.
- Three auxiliary equipment slots work.
- Sell and guaranteed fusion work with protection against accidental consumption.
- First fusion is possible by Level 10 without replay grinding.
- Campaign remains completable with the deterministic starter Sword plus authored
  physical Archer/Wizard Soul recruitment; random summoning is never required.
  Axe recruitment is deferred until a future true defeat-and-pickup encounter.

### Campaign/data architecture

- Campaign is no longer hard-capped at 2 chapters/20 levels.
- Data validates 10 chapters/100 level IDs even when later level content is marked unavailable.
- `EncounterRunner`, `ObjectiveDefinition`, `RewardBundleDefinition`, `LevelDefinition`, and `ChapterDefinition` drive runtime.
- No production level script directly spawns enemies outside the encounter system.
- First-clear rewards are idempotent and cannot duplicate after reload/crash.
- Replay and Hunt entry points use the same Level/Encounter data.

### UX

- Player can understand equip, rarity, stats, skill allocation, Q1/Q2 Relay, reward, sell, and fusion without external explanation.
- Inventory comparison shows only meaningful differences by default; advanced details are expandable.
- Retry begins in under 5 seconds.
- No more than one major system tutorial is introduced in one level.
- Locked Level 50 systems do not clutter Chapter 1 UI.

### Balance targets

- Every Level 1–10 is clearable using guaranteed free Hero Souls and first-clear equipment.
- Normal level target length: 3–6 minutes.
- Boss level target length: 5–8 minutes.
- First Hero Soul is owned before entering Level 1.
- Second Hero Identity is guaranteed at Level 5.
- At least one meaningful deterministic reward every two levels.
- No single Chapter 1 affix increases total damage or effective durability by more than 20% alone.
- A new tester should understand Q1 support and Q2 Relay by the end of Level 3.
- Target boss clear profile: 25–50% first-attempt clear, at least 70% clear within three attempts after learning.

### Stability and performance

- Clean fresh save and migrated save both work.
- Thirty-minute soak test has no increasing orphan-node count or memory leak.
- Pause, death, retry, level transition, and app background/resume preserve correct state.
- Stable target frame rate on the chosen minimum Android device profile.
- No critical Godot debugger errors or missing-resource warnings.
- All production assets used in Chapter 1 have recorded license/source proof.

---

# LOCKED DECISIONS V0.4

1. Three shared player stats: HP, Damage, Mana.
2. Five Stat Points and five Skill Points per player level.
3. Each stat caps at 200 with diminishing point returns after 100.
4. Automatic milestone perks at invested-stat thresholds.
5. Skill allocations are stored per Hero Identity.
6. Skill maximum rank is 20; one point equals one rank.
7. Skill rank is gated by player level, reaching Rank 20 only near Level 100.
8. Eight rarity names/order: Normal, Magic, Rare, Epic, Legendary, Crystal, Mythic, Eternal.
9. No Quality stat.
10. Hero Souls use tagged Universal, Affinity, and Soul-Action affixes.
11. Three shared auxiliary slots: Soul Vessel, Soul Trace, Soul Focus.
12. Fusion is guaranteed: three same-Identity, same-rarity Souls produce one next-rarity Soul.
13. Fusion has a Gold cost and rerolls the result.
14. Hero Variants are authored sub-kits, maximum one Variant per Identity in the 100-level prototype.
15. One Monster Soul socket per Hero Soul; unlock at Level 50.
16. Monster Soul bonding is permanent by default with a rare gameplay-earned Severance safety valve.
17. Axe is the recommended second production Hero.
18. Campaign uses chapter-map nodes and instanced replayable levels.
19. Chapter 1 must be completed to 10 production levels before Chapters 2–10 are mass-authored.
20. 10 chapters / 100 levels remain the target content structure.

---

# Minimum new data model

## Progression

```text
PlayerProgressionData
- player_level: int
- xp: int
- unspent_stat_points: int
- hp_points: int
- damage_points: int
- mana_points: int
- unspent_skill_points: int
- skill_allocations: Dictionary[hero_identity_id -> Dictionary[skill_track_id -> rank]]
```

```text
StatTrackDefinition
- id
- point_cap
- tiered_point_returns[]
- milestone_definitions[]
- global_caps[]
```

```text
SkillTrackDefinition
- id
- hero_identity_id
- max_rank
- rank_values[]
- player_level_gate_formula
```

## Hero Souls and rarity

```text
RarityDefinition
- id
- index
- display_name
- color
- standard_affix_count
- min_roll_multiplier
- max_roll_multiplier
- special_property_type
- earliest_drop_level
```

```text
HeroIdentityDefinition
- id
- display_name
- affinity
- minimum_rarity
- base_stats
- normal_attack_definition
- active_skill_definition
- dash_definition
- ready_condition_definition
- summon_definition
- departure_definition
- supported_action_tags[]
- variant_definitions[]
```

```text
HeroVariantDefinition
- id
- parent_identity_id
- minimum_rarity
- changed_modules[]
- passive_modifier
- VFX/audio overrides
- compatibility_tags[]
```

```text
HeroSoulInstance
- uuid
- hero_identity_id
- hero_variant_id
- rarity_id
- item_level
- rolled_base_bonuses: Dictionary
- affixes: Array[AffixRoll]
- monster_soul_instance_id
- source_id
- acquired_timestamp
- equipped_slot
- favorite
- locked
```

```text
AffixDefinition
- id
- family
- stacking_group
- allowed_affinities[]
- required_tags[]
- forbidden_tags[]
- minimum_rarity
- base_min
- base_max
- value_type
- global_cap_group
```

```text
AffixRoll
- affix_id
- rolled_value
```

## Equipment and Monster Souls

```text
EquipmentDefinition
- id
- slot_type: VESSEL | TRACE | FOCUS
- rarity_id
- item_level
- guaranteed_primary_stat
- allowed_affix_tags[]
```

```text
EquipmentInstance
- uuid
- definition_id
- rarity_id
- item_level
- primary_roll
- affixes[]
- favorite
- locked
```

```text
MonsterSoulDefinition
- id
- display_name
- family
- unlock_level
- source_enemy_ids[]
- stat_package
- compatible_tags[]
- forbidden_tags[]
- normal_active_modifier
- summon_modifier
- departure_modifier
- VFX/audio_theme
- max_rank
```

```text
MonsterSoulInstance
- uuid
- definition_id
- rank
- essence_count
- bonded_hero_soul_uuid
```

## Loot, rewards, fusion

```text
LootTableDefinition
- id
- entries[]
- rolls
- rarity_weights
- pity_key
```

```text
LootEntry
- type
- definition_id/pool_id
- weight
- min_level
- max_level
- conditions[]
```

```text
RewardBundleDefinition
- id
- gold
- player_xp
- guaranteed_items[]
- loot_table_ids[]
- feature_unlocks[]
- story_flags[]
```

```text
FusionRecipeDefinition
- input_count
- require_same_identity
- require_same_rarity
- output_rarity_offset
- gold_cost_formula
- variant_chance_table
- pity_limit
```

## Campaign

```text
ObjectiveDefinition
- id
- type
- target_ids[]
- required_count
- optional
- exit_required
- failure_conditions[]
```

```text
EncounterDefinition
- id
- spawn_groups[]
- active_enemy_cap
- start_trigger
- completion_rule
- objective_links[]
- arena_events[]
```

```text
LevelDefinition
- id
- chapter_id
- level_number
- scene_path
- objectives[]
- encounters[]
- first_clear_reward_bundle
- repeat_reward_bundle
- challenge_reward_bundle
- story_flags[]
- replay_enabled
- hunt_definition_id
```

```text
ChapterDefinition
- id
- index
- title
- biome_id
- level_ids[10]
- boss_level_id
- unlock_requirements[]
- chapter_reward_bundle
```

---

# Implementation order

## P0 — Chapter 1 production gate

1. Remove 2-chapter/20-level hard cap; introduce Chapter/Level definitions for 10×100.
2. Implement Objective, EncounterRunner, RewardBundle, and migrate Level 1–5.
3. Implement player stat/skill progression and save schema.
4. Implement Hero Soul instance, rarity, Normal–Epic affixes, two-slot equip, inventory and comparison UI.
5. Implement Soul Vessel/Trace/Focus.
6. Implement sell and guaranteed fusion.
7. Implement Axe Hero and Sword↔Axe Relay.
8. Author Level 6–10.
9. Build Vampire Castellan boss.
10. Pass the “Already playable” gate.

## P1 — Chapters 2–5 foundation

1. Add Legendary/Crystal definitions to live drops.
2. Add controlled affix reroll and Hunt.
3. Add at least one Ranger and one Magician Hero Identity.
4. Implement Variant schema and fusion pity.
5. Implement Monster Soul data/interfaces, locked UI, preview/training architecture.
6. Produce Chapters 2–5 incrementally.
7. Unlock Monster Soul runtime at Level 50.

## P2 — Chapters 6–10 and long-term systems

1. Produce first two Hero Variants.
2. Activate Mythic/Eternal properties.
3. Add additional Monster Soul families and Severance.
4. Produce Chapters 6–10.
5. Add Challenge and Depth after campaign systems are stable.
6. Finalize balance, content reuse, endgame reward loops, localization, accessibility, and release QA.

---

# Tests and acceptance criteria

## Unit/data tests

- Validate every rarity index and color.
- Validate every Hero minimum rarity and Variant threshold.
- Validate affix tags, ranges, duplicates, stacking groups, and global caps.
- Validate fusion inputs, cost, result rarity, and Variant pity.
- Validate no equipped/locked/bonded item can be sold or fused.
- Validate skill rank gate at every player-level band.
- Validate stat point cap, diminishing returns, and every milestone once only.
- Validate 10 chapters × 10 level IDs without requiring all scenes to exist.
- Validate reward bundles are idempotent.
- Validate LootTable weights and pity state serialize correctly.

## Runtime tests

- Equip two Hero Soul copies of same or different Identity.
- Relay in both directions with correct stats and skills.
- Swap to a higher-rarity copy without losing Identity skill ranks.
- Save/load inventory with 500+ generated items.
- Sell, fuse, favorite, lock, compare, and sort.
- Finish objectives other than Sigil collection.
- Retry after death without duplicated encounter/reward state.
- Boss death and first-clear reward survive immediate app close/reload.
- Fresh profile can clear Level 1–10 without random summon or fusion.
- Level 50 Monster Soul unlock does not appear early.

## Content acceptance

- Each Chapter 1 level has one clear primary purpose.
- No Chapter 1 encounter uses more than three simultaneous teaching demands.
- Every enemy has readable telegraph, attack, recovery, hurt, and death behavior.
- Boss tests Soul Relay rather than only damage output.
- Level rewards introduce systems in the scheduled order.
- Repeat loot table is visible before replay/Hunt.
