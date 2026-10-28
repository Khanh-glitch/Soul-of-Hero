# Gate 8 — Real Level 2 map-aware combat readability (Gold source remains immutable)

Date: 2026-10-28. **Composite native staging PASS; full Gold skill still NOT accepted.**

## User's new requirement

For bright/detailed authored maps, foreground Gold skill effects should remain readable. When local real-map luminance crosses the brightness threshold, automatically attenuate **authored scenery**, not the imported Gold effects, enemy, Knight, HUD, HP, collisions or source skill clock. Dark maps must stay dark without gratuitous suppression. The transition is optional and smooth during actual gameplay; original source Gold effects must remain as authored.

## Implemented & corrected

- `prototypes/gold_pair/venom_combat_readability.gd`: real viewport ROI sRGB→linear sampling, brightness-aware target calculation (threshold0.23, target0.16 linear, max attenuation0.42), 60Hz exponential ramp-in 0.18sec and ramp-out 0.30sec, exact original tint/alpha saved and restored.
- Gold VFX source/procedural image layers untouched. Real Knight/enemy children live under `Level/Entities`, which must **never** be dimmed or covered. HUD also remains in its independent CanvasLayer.
- **Important discovery from actual native frame inspection:** on this Level2, the brightest authored stone architecture is inside **`Level/CrucibleArt`**. Dimming only the three TileMapLayers barely affected the bright facades (original prototype changed 510 sampled screenshot pixels at tick147). Fixed by binding Backdrop, Geometry, Decor, CrucibleArt and world `Background` parallax. Do **not** tint the `Level` parent because it also owns Entities.
- Sensor reads **the actual Level2 baseline captured before Gold FX**. It never samples current Gold glow/flash; otherwise the imported skill itself would incorrectly trigger background dimming.
- `prototypes/gold_pair/tests/venom_combat_readability_oracle.gd` unit oracle verifies bright floor triggers, dark floor bypasses, source 60Hz fade works, authored tint+opacity exact restore, Knight/enemy not changed, CrucibleArt and parallax included.
- `prototypes/gold_pair/tests/venom_glassfang_level2_visual_comparison.gd` now renders **two native screenshots at identical source frames 15, 147, 177**: adaptive OFF and adaptive ON. Original Gold source on its own original stage is the third visual reference, never modified to force a match.

## CI evidence / actual authored Level2 data

- [Readability unit CI 40650105014](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40650105014) — PASS (includes CrucibleArt + parallax).
- [Actual authored Level2 image comparison CI 40650127066](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40650127066) — PASS; 9 original-clock native Level2 frames, plus **3 identical-tick adaptive OFF/ON pairs**.
- Godot native screenshots are actually captured under **immutable map commit `f9fb8d4b7490a2579426bd5c4ee4667704d3a05e`**, real AppFlow, 8057 floor and 3927 wall cells, original Knight/enemy/Camera2D. No edits to game/, data/, assets/ or project.godot.
- For actual Level2 ROI at frame 15/147/177, original brightness baseline (linear): **0.439 / 0.427 / 0.423**. Auto dim output: **42% map-only attenuation** (maximum cap). 4px-sampled screenshot difference count **46780 / 46717 / 46857**, demonstrating the architecture genuinely changes, as opposed to the earlier 500-pixel TileMap-only approach. These image counts include changes to authored background, not a claimed Gold-vs-Godot fidelity score.
- Full comparison package contains original Gold pre-GLSL frame and actual native Level2 (OFF and ON) at each tick, plus close-up for finisher and the raw CI manifest. Compare full screenshot **first**, not an isolated Fang image.

## Non-negotiable Gold fidelity boundary

The adaptive dim is **an optional SOH display/accessibility setting**, NEVER an alteration to source Gold colors, source FX RNG/damage, or proof of Gold pixel fidelity. The original Gold scene before final WebGL post is displayed as a reference. Gold's authored WebGL post, source complete particle/world RNG, enemy corrode and vial all still require further integration before a full-skill 1:1 visual PASS. The current right stage is still PARTIAL, NOT a playable equipped skill.

For all remaining 21 Venomwright + 72 ARCANA III authored skills: run matched original Gold background vs REAL Level2 screenshot review, then compare native Level2 with adaptive readability OFF/ON on bright levels. Keep the optional backdrop dim independent of skill renderer family and make it restore exactly after each cast. Do not blindly force dimming on dark terrain or apply it over source Gold effects.

**Full-skill acceptance: 0/93.** Branch: `feature/gold-venom-arcana-factory-20261028`.
