# AVFX Venomwright 21 — INDEPENDENT VISUAL/PRODUCT REJECTION AND PAUSE
Audit date: 2026-10-31. Authority: [CONTROL_TOWER_CURRENT.md](../CONTROL_TOWER_CURRENT.md) and [INDEPENDENT_DEEP_REVIEW_PROTOCOL.md](../INDEPENDENT_DEEP_REVIEW_PROTOCOL.md).
Status: **PAUSED_BY_OWNER_DIRECTIVE / VISUAL_COMPOSITOR_ARCHITECTURE_BLOCKER**. This is a product-acceptance decision, not a rollback of source parity. Do not merge/promote or keep optimizing the 21 as a batch until owner explicitly reopens after evidence-based repair.

## Direct source-level cause (not a guessed screenshot splice)
The real-map test is **not pasting a premade Gold video or picture**, but it does render an ENTIRE independent simulated Venomwright combat world, including its drawn actors and floating damage text, and pastes THAT WORLD'S raster layers onto SOH:
1. `prototypes/skill_readiness/pilot/venom_pilot_stage.gd` creates its own `RECORDER.new(ENGINE.WW, ENGINE.WH)`, `world.reset(SEED, true)`, and auto-casts with `ENGINE.auto_aim(world, def)` on tick 1. This retains source-format virtual player/enemies, damage, status, spawns and motion, independent of SOH entities.
2. `prototypes/skill_readiness/native/venom/venom_world.gd` `draw(g)`: calls `ACT.enemy_shadow`, `ACT.draw_enemy`, `ACT.draw_player`, `ACT.draw_enemy_bars`, then draws `nums` (floating damage), FX, particles and glow all to `g.s` and `g.l`. Those pixels cannot be distinguished from actual SOH opponents after the fact by just adjusting alpha or luminance.
3. `prototypes/skill_readiness/pilot/real_map/venom_pilot_real_map_test.gd` freezes the real Knight, positions `holder` at `knight.global_position - stage.player_xy()`, creates `NativeSceneEffects` and `NativeGlow` Sprite2Ds scaled `0.5` from 1200x680 raster to 600x340 world units; premultiplied-alpha coverage is used for the scene in corrected mode while glow is still additive. Legacy mode additively blended the black-backed scene, causing obvious washout. The corrected mode reduces a symptom but retains virtual actors, Gold-space occlusion/positions, source ground and overly dominant glow.
4. It does NOT mount the port on real moving enemy sprites or authoritative `CombatDamage`; `GOLD93_VENOM_REAL_MAP: PASS` explicitly states 'presentation overlay, not enemy integration'. No live player movement, no actual hit/miss/retarget/reaction/death, and no independent original-vs-native Gold/WebGL synchronized visual review.
5. The last sampled Level2 evidence (e.g. run 40902430652 artifacts 12910064028) shows effect presence but concentrated high-brightness, readability/occlusion concerns and Gold-demo actors/number artifacts. The user independently reports the combat scene looks copied and smeared/dazzling; treat as a critical creator-fidelity veto.

## Additional confirmed current regressions
- `skill_readiness_lab.gd` references `Panel/VBox/DarkeningMode` and `DarkeningStrength`; `skill_readiness_lab.tscn` has connections but NO corresponding nodes. Current host CI logs issue `Node not found` for both.
- Current `venom_pilot_real_map_test.gd` uses undeclared `_baseline_frame`, `map_layers` and `base_colors`; run 41170264700 had parse errors and later timeout. Earlier map images are historical evidence, not an up-to-date clean build.
- [run 41155043902](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41155043902) runtime contract PASS but host-21 exceeded 180s Lab. [run 41170264709](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41170264709) host-21 PASS (157307,158800,155589ms) but host-20 failed (~216s). [run 41173911875](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41173911875) hosts 20 and 21 failed on slow runner. 21/21 'ever passed' != same-commit full-host robust PASS. Wall-clock offline budget is NOT live gameplay frame rate.
- 21/21 source parity/registration (special entries 013/016 included in parity index) remains technically valid; source ARCANA III RNG foundation is separate, not an elemental-Fusion20 port.

## Decision / what is frozen
**PAUSE Venomwright 001–021 FULL BATCH.** Preserve source ZIP, original oracle rows, parity/raster code, test receipts and performance work. NO more polishing, performance micro-optimization, visual promotion, new acceptance claims, or production integration on this batch. No agent should unilaterally reactivate. User may reopen after elemental-Fusion20 pilot proves a fully native source-faithful actor/ground/camera compositor with gameplay readability and after real side-by-side + actual moving-actor tests.

**Owner requested focus change:** resume the separate **ARCANA Fusion20 / elemental 20 skills** program, NOT ARCANA III 72 skills and NOT Venomwright 21. Its independent owner task is in the GitHub elemental issue; preserve the 20-vote original source contract and current R4/PR27 + R6/PR28 pilot work without treating R6's baked 30Hz atlases as Gold final.

## Exact unpause acceptance (future, not an active task)
- Rendering must exclude Gold virtual player, enemies, bars and floating damage from SOH frame; only real SOH `AnimatedSprite2D` entities are visible; original source-authored per-body reactions are mapped onto them.
- FX ground/air/screen layers retain source authored motion but bind correct real TileMapLayer/world coordinates, wall/void masks and Camera2D transformations; additive glow has measured luminance budget with pixel-faithful Gold comparison, not generic blurring.
- Real gameplay movement, attacks, aim, hit/miss, death, interrupt, multiple targets, concurrent cast, scene exit/re-enter, persistence safety, cleanup, screen readability at 720p/2K/4K under actual frame time.
- Original Gold vs Godot (same timeline, seed, 1x + crops), effects-in-world and target-body detail reviewed independently. PLAYER_CAN_MOVE + ACTUAL_HIT does not alone mean playable/beautiful/deep; creator alone may set OWNER_VISUAL_APPROVED.
- No merge without a dedicated independent reviewer green across technical/visual/experience dimensions.

Paused on product grounds notwithstanding legitimate 21/21 engineering parity achievement. This file is an evidence record, not a second design canon.
