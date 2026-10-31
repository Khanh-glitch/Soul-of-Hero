# ARCANA source architecture & integration hazards

All paths are relative to `sources/` inside the ZIP. Originals remain byte-for-byte in `sources_original/`.

| Input | Renderer / native buffer | Runtime & lifecycle | Source of interest |
|---|---|---|---|
| A | CPU HDR `Framebuffer`, 416×234 | `Lab` fixed 1/60, W hit-stop & time scaling; React/Vite | `A/src/engine/lab.ts`, `world.ts`, `enemies.ts`, `A/src/spells/choreo.ts` |
| B | CPU HDR `Renderer`, 384×216 | independent procedural effects via `Effect`, renderFrame | `B/src/engine/renderer.ts`, `B/src/engine/scene.ts`, `B/src/effects/*.ts` |
| C | CPU pixel `Frame` and WebGL compositor; native buffer check `frame.ts` (384×216) | `Stage` fixed 1/60 and independent `Inst` | `C/src/engine/frame.ts`, `C/src/engine/gl.ts`, `C/src/engine/stage.ts`, `C/src/spells/*.ts` |
| D (19 only) | WebGL2, 480×270 | self-bundled, `engineSpell` = Constellation Engine | `reference/Elemental_VFX_Lab_FIXED_Standalone.html`; search `const engineSpell` |

Canonical positions (from source):

- A: caster `(104,150)`; focus `(232,124)`; anchors `(316,86),(348,162),(236,196),(196,70)`.
- B: caster `(104,132)`; target `(262,104)`; additional anchors are set in `B/src/engine/scene.ts`.
- C: caster `(112,126)`; focus `(252,112)`; four targets in `C/src/engine/floor.ts`.
- D: caster `(148,172)`; center `(244,132)`; three anchors `(300,104),(352,186),(236,74)`.

Do NOT use an unverified `x *= constant` to transfer trajectories. Normalize relative to each spell's focus/anchor, account for camera transform, then test pixels vs hit positions in the same source camera frame.

## A’s critical sequencing

`Lab.step()` calls `W.tick(DT)`; during hit-stop it returns without advancing spell `t`. Otherwise it calls `this.spell.update(dt,t)`, then `CHOREO[id](spell,t,dt)`, then `W.update(dt)`; the composite draws the spell, applies its trail, then renders enemies and overlays. This is not separable by blindly swapping out the A spell object. Original `CHOREO` reads private member state from some spells. Port via an event bridge or preserve A's original per-skill shadow simulation as a physics reference; **retarget visual collision geometry to the winner**. Beware applying independent time scaling in both drivers.

`damageEnemy()` handles force, per-element status, physics, x-ray/shock and death; world method `W.impact` is not the only contact channel. The enemy model has wet+electric interactions, freeze+shatter, burn, root, spore and astral warp; it must be visually demonstrated ON the enemy. Include a toggle to hide pop-up damage numerals only, not to disable the underlying status visualization.

## Engine ownership

- One common timebase and event queue.
- One clear arena/floor; never composite source opaque floors on top of each other.
- Separate **ground/decal**, **behind enemy**, **on enemy/actor**, **front/airborne**, **light/bloom** and **distortion** passes, with selected effects routed correctly.
- Pixels/geometry ideally render at one consistent internal scale; if preserving higher resolution D, test pixel-grid resampling deliberately rather than filtering all layers until blurry.
- Consistent exposure/compression. Remove redundant bloom and overexposure from mixed material, retain selected palettes/material contrast.
- Dynamic particles, decals and status persist across phases according to the owning spell, but are reset/reconstructed deterministically when seeking or switching.
- One hitstop owner (`W`) so shaders and enemy movement do not continue through a supposed freeze unless the effect deliberately permits an ambient layer to remain live.

## Acceptance proof per skill

Capture opening, buildup, first actor contact, climax, exit; record whether each enemy actually took damage and rendered a correct elemental response (not only numbers), including collisions not at arena center; show environmental memory. The package is a **handoff**: none of the above acceptance tests is claimed completed for a fused implementation.
