# Hero Systems — H0 Coverage Matrix & H1 First Delivery

**Branch:** `feat/hero-systems-completion`  
**Base for source audit:** `main@5214788933b1a827f3a177d11ff486433dfe5e8a`  
**Status:** H0 source audit and H1.1/H1.2 code delivered; **GitHub Actions Godot 4.7 test suites total 77/77 PASS** (55 Library + 13 pure loadout + 9 full-autoload Roster scene). Visual and human gameplay playtesting remain unverified.

## Status semantics

- **DEFINED**: definition/resource or canonical rules exist.
- **WIRED (source)**: identified actual gameplay/UI/save consumer or function path. Not a claim that the path executes successfully.
- **TEST EXISTS**: runner/test script found. Not a claim that it passed on this commit.
- **PLAYTESTED**: requires observed gameplay/visual evidence; currently **UNVERIFIED** for all rows. Hero Library automated engine test is **PASS**, which does not equal visual/manual playtesting.

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
| Hero Library | `hero_library_catalog.gd`, `hero_library_panel.gd/.tscn` | Home → Hero Roster → Library compendium | **PASS 55/55 on Godot 4.7:** `tests/hero_library_coverage_test.gd` | Visual QA still required at 640×360, 847×437, 1280×720 |
| Hero Variant | Partial schema/rules | Production variant inventory, art, kit, loot and persistence not confirmed | None established in H0 | H4 design+implementation; do not mark LIVE |
| Monster Soul / Parts | Foundation only / roadmap | Complete production loop not confirmed | Monster Soul rule test exists | Out of scope during Hero Systems H1 |

## H1 delivered on branch (engine-tested; visual QA pending)

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

1. **H1.2 shipped as two-column loadout overview**; remaining: multi-viewport visual proof and controller/navigation QA.
2. **H1.3**: exact gear comparison of current/target Hero with live Power/DMG/HP/Mana and selected secondary effects, using `HeroSoulManager.project_hero_combat` as the only authority.
3. **H2**: skill-kit boundary matrix for four heroes, rarities 0–7, valid rank splits; runtime proof before expanding descriptions to `LIVE`.
4. **H3**: equipment lifecycle regression using isolated saves; escalate any necessary SaveService/loot change as a distinct PR.
5. After the Chapter 2 agent publishes its branch, rebase and run combined regression with the real Godot binary.

## H1.2 delivered (Godot runtime certified; visual QA pending)

- Changed `game/ui/screens/hub/tabs/arsenal_tab.gd` to open **Team & Souls** rather than the long-form Hero Library by default. Library stays accessible as tab 0.
- Replaced the long team heading with exactly two compact overview columns showing **Active / Reserve**, the exact selected Hero Soul rarity/item level and whether Armor, Boots and Jewelry are equipped.
- Extracted pure, read-only `game/ui/screens/hub/tabs/components/hero_team_quicklook.gd`: a mismatched Soul ID, orphan equipment UUID or wrong item slot never displays as equipped. No save mutation or gameplay unlock changes.
- Added `tests/hero_team_quicklook_test.gd` (13 passing checks) and a genuine project-scene harness `tests/hero_team_quicklook_runtime.tscn/.gd` (9 passing checks). The scene test runs with SaveService/GameEvents autoloads and verifies the visible UI columns. This prevents false negatives from direct `--script` instantiation of the full roster without normal autoload bootstrapping.
- No changes to `SaveService`, KnightController, HeroSoulManager, AppFlow, LootDirector or Chapter 2 maps/objectives.

**Engine evidence:** [Hero Library Godot QA run #39786405018](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/39786405018) on `0ecb9a4104815a6bc7364be0868774e0d0f407e6`: Godot `4.7.stable.official.5b4e0cb0f`; project import success; Library `55/55`, pure quick look `13/13`, full-autoload Roster scene `9/9`; **job SUCCESS**.

**Not yet certified:** screenshot and manual readability at 640×360, 847×437 and 1280×720; controller navigation, existing broad Hero/UI regression suite, Chapter 2 integration after Agent A publishes its work.

## Actual Godot 4.7 GitHub Actions evidence

- **Workflow:** [Hero Library Godot QA run #1](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/39783645282).
- **Commit tested:** `fc37bd1740b31531406f3bebaf7e9882d5f3bce7` (includes source + test + workflow).
- **Engine reported:** `Godot Engine v4.7.stable.official.5b4e0cb0f`.
- **Project import:** completed successfully on GitHub Actions Ubuntu runner.
- **Focused runtime test:** `HERO LIBRARY COVERAGE TEST PASSED - 55 checks`, job conclusion `success`.
- **Limitations:** no image capture or manual input/UX playtest; other Hero/gear/skill regression suites have not yet been executed on this branch. The subsequent documentation-only commit does not change tested game source.

## Exit criteria

Focused test has passed; **do not claim H1 complete** until existing Hero/UI regressions pass and visuals are inspected at requested viewports. No user-facing `LIVE` label for authored-but-unproven mechanics. Keep this PR draft until those conditions are satisfied.
