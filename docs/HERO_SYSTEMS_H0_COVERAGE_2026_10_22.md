# Hero Systems — H0 Coverage Matrix & H1 First Delivery

**Branch:** `feat/hero-systems-completion`  
**Base for source audit:** `main@5214788933b1a827f3a177d11ff486433dfe5e8a`  
**Status:** source-level verification + targeted Hero Library implementation. **Godot runtime, visual and manual playtesting not executed in this audit environment.**

## Status semantics

- **DEFINED**: definition/resource or canonical rules exist.
- **WIRED (source)**: identified actual gameplay/UI/save consumer or function path. Not a claim that the path executes successfully.
- **TEST EXISTS**: runner/test script found. Not a claim that it passed on this commit.
- **PLAYTESTED**: requires engine execution plus observed gameplay evidence; currently **UNVERIFIED** for every row in this branch.

## Coverage matrix

| System | DEFINED | WIRED (source) | Tests present on main | Remaining H1–H4 gate |
|---|---|---|---|---|
| Sword / K-Night | `game/heroes/data/sword_hero.tres`, `game/heroes/sword/k_night_rules.gd` | `game/characters/knight/knight.gd`, `game/heroes/hero_soul_manager.gd`, Roster/HUD | Hero-aware HUD, hero skill combat, Hero Soul runtime | Visual and real run QA |
| Archer | `game/heroes/data/archer_hero.tres`, kit + animation library | KnightController, HeroSoulManager, HUD; documented Level 5 physical acquisition | `run_archer_hero_combat_tests.ps1`, `run_level_5_archer_pickup_tests.ps1` | Confirm current first-pickup/equip/relay and HUD in Godot |
| Axe | `game/heroes/data/axe_hero.tres`, kit + animation library | KnightController and Soul Team paths, with story-only unlock restriction | `run_axe_tests.ps1`, `run_axe_soul_team_runtime_test.ps1` | Confirm current production gate, art/Throw and story recruitment; **do not auto-unlock** |
| Wizard | `game/heroes/data/wizard_hero.tres`, `game/heroes/wizard/wizard_runtime.gd`, animation and kit | KnightController + HUD methods, HeroSoulManager projection | Existing full regression includes Hero runtime suites; targeted Wizard evidence must be established | Verify story availability, actual gameplay, effects, portraits and reward source |
| Two-skill rarity kits | `game/meta/hero_souls/hero_skill_kit_rules.gd`; Basic (rarity 0–2), Advanced (3–4), Legendary+ (5–7) | `knight.gd` active kit execution; `hero_soul_manager.gd` kit/combat snapshot; Arsenal details | `run_hero_skill_combat_tests.ps1`, Hero Soul tests | Cross 4 Heroes × all 8 rarities × rank splits, cancel/mana/cooldown |
| 6 progression tracks | `game/meta/progression/player_progression_rules.gd` and `hero_progression_rules.gd` | `SaveService.allocate_hero_skill`, `respec_hero_skills`, Arsenal screen, runtime hero stats | `run_player_progression_tests.ps1`, `run_mana_meta_core_tests.ps1` | Rank 0–20, affordability, reset, persistence and in-combat parity |
| Hero Soul exact instances | `hero_soul_rules.gd`, `hero_soul_combat_affixes.gd` | `SaveService` exact-instance equip/fuse/sell, HeroSoulManager and Arsenal | `run_hero_soul_instance_live_tests.ps1`, `run_hero_soul_fusion_live_affix_tests.ps1` | Verify equip → live stat → remove/swap → reload and protected-item fail-close |
| Armor / Boots / Jewelry | `auxiliary_equipment_definitions.gd` (`soul_vessel`, `soul_boots`, `soul_trace`) | Equipment combat projection, SaveService equipment API, Arsenal, loot catalog | Auxiliary equipment, combat, upgrade/migration runners | Validate all generator LIVE affixes against combat, preview delta, upgrade +5 and ownership |
| Hero Library | `hero_library_catalog.gd`, `hero_library_panel.gd/.tscn` | Home → Hero Roster → Library compendium | **New:** `tests/hero_library_coverage_test.gd` | Run newly added coverage and visual QA at 640×360, 847×437, 1280×720 |
| Hero Variant | Partial schema/rules | Production variant inventory, art, kit, loot and persistence not confirmed | None established in H0 | H4 design+implementation; do not mark LIVE |
| Monster Soul / Parts | Foundation only / roadmap | Complete production loop not confirmed | Monster Soul rule test exists | Out of scope during Hero Systems H1 |

## H1 delivered on branch (not yet runtime certified)

### Before

`HeroLibraryCatalog.hero_ids()` returned only Sword; `profile()` rejected Archer/Axe/Wizard. The read-only compendium had one K-Night button, the heading for K-Night's combo was hard-coded for every profile, and the portrait was always cropped from the K-Night sprite to 48×48 regardless of the 120×80 source frame.

### After

- Library lists **Sword, Archer, Axe and Wizard**. Non-Sword display names, base HP/Mana/Power/move speed, authored kit skill names/parameters, basic/advanced/Legendary+ actions and Summon/Departure are derived from canonical HeroDefinition and HeroSkillKitRules, not independently balanced text.
- A Library card remains **informational**; browsing does **not** unlock, equip or claim a Hero. Ownership stays in SaveService/UnlockService.
- Portrait atlas and frame size are per Hero: Sword 120×80; Archer 64×64; Axe 120×80; Wizard 231×190. No generated imagery or new asset licensing was introduced.
- Left Hero list receives a vertical ScrollContainer for compact 640×360 layouts.
- New regression script covers all four IDs, profile non-emptiness, eight rarities, two skills per kit band, real portrait paths and live scene navigation.

### Execute focused test in an environment with Godot 4.7

```sh
godot --headless --path . --script res://tests/hero_library_coverage_test.gd
```

Use the actual `godot` binary name/path installed there; capture version, stdout, stderr and exit code. Then perform **visual** inspection, because headless pass alone does not prove legibility.

## Shared-file quarantine / coordination

No edits in this slice to `knight.gd`, `hero_soul_manager.gd`, `save_service.gd`, `game/main.gd`, `loot_director.gd`, `app_flow.gd`, campaign objective/map files or the full-regression orchestrator. Chapter 2 Agent A may still have unpublished changes; verify actual diffs before any shared-file patch.

## Next tightly scoped work

1. **H1.2**: live snapshot summary in Hero Roster for active/reserve Hero and equipped Soul/gear, with correct unavailable/locked states; verify current Arsenal before adding duplicate UI.
2. **H1.3**: exact gear comparison of current/target Hero with live Power/DMG/HP/Mana and selected secondary effects, using `HeroSoulManager.project_hero_combat` as the only authority.
3. **H2**: skill-kit boundary matrix for four heroes, rarities 0–7, valid rank splits; runtime proof before expanding descriptions to `LIVE`.
4. **H3**: equipment lifecycle regression using isolated saves; escalate any necessary SaveService/loot change as a distinct PR.
5. After the Chapter 2 agent publishes its branch, rebase and run combined regression with the real Godot binary.

## Exit criteria

No H1 completion claim until new focused test passes, existing Hero/UI regressions pass, and visuals are inspected at requested viewports. No user-facing `LIVE` label for authored-but-unproven mechanics. Keep this PR draft until those conditions are satisfied.
