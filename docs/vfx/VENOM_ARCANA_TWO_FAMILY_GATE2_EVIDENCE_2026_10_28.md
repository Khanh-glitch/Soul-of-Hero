# Gold VFX two-family progress and source-proof ledger — 2026-10-28

## Repository scope
Branch: `feature/gold-venom-arcana-factory-20261028`.
Validated HEAD before writing this ledger: `36ec5c0ad1e50c96e5b341aa77153b9a35df1d22`.
Base: `b46a46dcde07df0b818d6d6f15b0d76f06e5527f`.
Compare against base: 30 commits ahead; **zero modifications to game/, data/, assets/, project.godot**. No production skill registration.

Input SHA-256 locked to Gold original archives:
- Venomwright 21: `ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716`
- ARCANA III 72: `8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d`

## Original-source parity, native gates confirmed green

| Component | Original source and oracle | Native evidence | What this proves |
| --- | --- | --- | --- |
| Shared RNG | Venomwright `pixel.ts Rng.next()`, ARCANA `util.ts rand()` | [CI 40611852900](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40611852900) | 80 output numeric checks; differing ARCANA zero-seed policy |
| Venomwright Decal | Original `fx.ts Decal` + `pixel.ts Layer.dot` | [CI 40617847435](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40617847435) | 6 families, 24 exact 600x340 RGBA SHA-256 at 4 ages; native Sprite2D staging |
| Venomwright Fang Chain | Original `fx.ts Chain` | [CI 40617983747](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40617983747) | 96 double-precision coordinates along 90-tick moving head path |
| Venomwright Fang body | Original `s1.ts Fang.shd/up/lit`, `pixel.ts Layer` | [CI 40619155489](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40619155489) | 18 complete 600x340 RGBA SHA-256 shadow/body/glow image buffers at ticks 0,1,11,29,53,90 |
| Fang native Canvas | `venom_source_fang_canvas.gd` dynamic CPU original pixels → 3 Godot ImageTextures | [CI 40620156903](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40620156903) | Real OpenGL/Xvfb 3-pass upload/readback, nearest filtering, additive glow, map transform and cleanup. Earlier dummy-headless readback failed and was *not* accepted; real OpenGL passed unchanged byte-compare. |
| ARCANA cracked ground geometry | Original `fx.ts crackScar()`, `util.ts` original RNG | [CI 40620700006](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40620700006) | 12 original geometry SHA over 3 seeds, 4 ages; all fissures/forks and stones, including negative zero-seed case mapping |
| ARCANA complete scar draw | Original `crackScar`, `draw.ts disc/shadeRamp/hiRamp`, `util.ts mix` | [CI 40621055418](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40621055418) | Additional 12 complete source draw-operation SHA including central crater, mark, glow, source RGB, alpha (to 6 decimals) and exact command order |
| ARCANA scar native render | Godot 480x270 GPU staging of original command geometry in independent mark/glow passes | [CI 40621318343](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40621318343) | OpenGL image shows ink at source center and clear empty ground, heat fade at age3.5, mark-only age5.2, all removed at age5.5. CI artifact `arcana-scar-native-preview` is a Godot staging screenshot, **not** a Pixi-vs-Godot parity image. |

## Crucial limitations / next gates

**FULL SKILLS APPROVED: 0 / 93.** Passing source primitives and native staging is NOT a playable skill.

Venomwright #001 Glassfang Hunt still needs all Gold-authored Fang actors, hunt cast timeline, leap/bite and finishing cue, contact flash, particle shards/venom pools, environmental writes, enemy body/status effects, proper RNG consumption order, visual source-vs-native frame tests, and native real-map AppFlow+combat integration. Gold damage must remain authoritative in CombatDamage without applying a second gameplay hit.

ARCANA #001 Black Sun Coronation only has isolated `crackScar()` primitive (seeds 1,20261027,0 in independent fixture), not the whole Black Sun cast seed/camera/world state and not independently proven PixiJS-vs-Godot GPU raster or color/alpha framebuffer parity. Implement remaining spell renderer passes, actor effects, post, scripted sequence, source-world RNG order, environment afterlife and Pixi WebGL comparison. ARCANA 11 new fusion candidates #302–312 have not passed original source visual review.

Both environment ports must still be projected and masked to actual authored Level2 terrain with collision/void safety, inspected as separate real-map ground ROI. Native 1080p/1440p/2160p and WebGL dense combat performance plus full skill cleanup and camera motion remain open.

## No-fake agreement
Never replace Gold animated effects with approximate sprite sheets, flatten Pixi renderer into cached frames, quietly omit environment/enemy effects, or promote Gold-approved status on component-only parity. Keep source ZIP immutable. Port per-family independent dynamic renderer: Venom CPU 600x340 versus ARCANA Pixi 480x270. Proceed sequentially, keep CI on source oracles, attach real screenshots/video, and do not alter map team's source branch.
