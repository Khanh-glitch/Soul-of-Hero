# Gate 4 — Original Venomwright Glassfang acid Pool visuals and lifecycle (2026-10-28)

**Scope:** original user ZIP `venomwright-combat-vfx-design (4).zip`, SHA-256 `ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716`. On isolated GitHub feature branch only. Still **0 of 93 full skills gameplay/visual-approved**.

## Newly passed Gold source gates

1. **Original procedural liquid shade:** source `src/game/pixel.ts` `mkNoise()`, `Field.shade()`, and `src/game/mats.ts` `MAT.acid`. GDScript `venom_source_noise.gd` recreates two original 64×64 Float32-derived noise tables. `venom_source_pool_shade.gd` ports flowing bands, Bayer dither, outline/rim, high and shadow bevels, caustic veins and source six-step palette. Two original source noise SHA-256 and **10/10 full 600×340 RGBA SHA-256** passed. [CI 40624650104](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40624650104).
2. **Original separated additive Pool.lit():** `src/game/fx.ts` `Pool.lit()` with original banded additive `src/game/pixel.ts glow()`; **10/10 original 600×340 RGBA SHA-256** passed for trail (life0.9) and finisher (life4.2) checkpoints, independent of the ground. [CI 40624835596](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40624835596).
3. **Real Godot two-pass OpenGL preview:** `venom_source_pool_canvas.gd` dynamically sends source ground RGBA and separate additive light RGBA through two nearest-neighbor `Sprite2D/ImageTexture` passes, source-logical 600×340 with an explicit optional source-world→map transform. Real OpenGL Xvfb readback matches Gold CPU bytes, screenshot at both pool kinds, both layers hidden after duration, transparent empty region. [CI 40625063774](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40625063774) PASS. Download CI artifact `venom-pool-native-two-pass-preview` (actual Godot screenshot, not Pixi/Gold end-to-end parity proof).
4. **Original World Pool.upd 60Hz bubble and acid tick CUES:** `venom_source_pool_lifecycle.gd` retains original world-RNG order, bubble probabilistic branching, position/velocity/size parameters, initial damage tick, 0.7-second interval, per-enemy Hits cooldown and 3-hit maximum. The **independent original TypeScript Pool fixture ran 253 source frames**, yielding **54 bubble cues and three acid contact cues** (frame 11, 84, 126), final RNG state 3133980089. Native Godot 253-row timing/RNG SHA-256 exactly matched original source, as did seven bubble coordinate samples. [CI 40625334532](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40625334532) PASS. **Renderer never deals damage**; production `CombatDamage` must authorize exactly one damage application per accepted cue.

Earlier successful gates: Gold RNG 80; Decal six kinds/24 RGBA; Fang Chain 96 coordinates; isolated Fang 18 RGBA frames; Glassfang full source moving/death-retarget 480-frame motion SHA and 10 bites; live Fang 24 original RGBA hashes with real OpenGL images; Pool Float32 complete SDF 10 hashes. ARCANA `crackScar()` full draw ledger/native OpenGL has separate passing CI.

## Important limitations — do not claim a full-skill PASS

- These Pool fixtures use seed-fixed **isolated injected source World RNG**, NOT complete multi-skill simultaneous World RNG consumption order. The Gold full cast includes 3 finisher pools sharing `Hits` and many other FX actors, sparks/shards/Flash/Splash/Embed; source whole-World event integration and cross-pool shared hit-gate need verification.
- Current Pool's **bubble cues** are emitted and numerically validated but not yet bound to production particle rendering. Native acid Pool is not yet masked/composited on actual Chapter1 Level2 authored terrain under moving camera.
- Existing full Gold Glassfang cast requires projectile throw, vial/splash, bite impact VFX, enemy corrode overlays, 3 residual acid pools after finisher, and source feedback/shake. Must test afterlife against real target with `CombatDamage` as sole gameplay authority.
- No full source-vs-real-map frame-by-frame playback, 1080p/1440p/2160p benchmark, GPU stress or WebGL parity yet. Do not fake these with isolated CI.
- Other Venomwright skills and 72 ARCANA skills still **not full approved**; ARCANA new fusion #302–312 are TS candidates lacking independent Gold visual review.

## Next steps

Start with **Glassfang World-integrated Pool registry**: original finisher `src/game/skills/s1.ts` spawns three acid pools life4.2, boil2, tick every0.7, max3 shared `poolHits`; trail pools are separate life0.9 with no acid ticks. Port exactly their multi-pool shared `Hits` and composite source frame, children bubble/shards and enemy overlays. Then overlay in disposable actual Level2 test clone, ground/void mask and real gameplay damage adapter. In parallel resume original ARCANA Black Sun cast, not merely primitive crackScar. Source is immutable; never merge prototype to production on evidence of component smoke tests alone.

**Verified HEAD before this document:** `7105d7069c4bd7fabc609d68c979507d21543760`, 14 commits ahead of Gate3 `722d6b0b19b471b18c00f82a5f14e401d072fdbd`, **no changes** in `game/`, `data/`, `assets/` or `project.godot`.
