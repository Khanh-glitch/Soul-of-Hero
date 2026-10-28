# Gold VFX — ORIGINAL WORLD vs REAL Chapter 1 Level 2 visual acceptance

## Non-negotiable review output for EACH full authored skill

Produce SAME source tick, same original RNG seed, same relative caster/target camera positioning in paired pictures:

| Left = Gold SOURCE | Right = SOH native Level 2 |
|---|---|
| Unmodified runnable original source ZIP, original background/actors/FX, original default QUALITY (Venomwright Ultra k=2 1200×680), original authored GPU post where available | ACTUAL authored Level2 Godot 4.7 AppFlow run, original Knight and Enemy / Camera2D / floor and collision TileMaps, source-ported procedural renderer on production viewport, not an image montage pasted atop the map |
| Opening, first impact, multi-hit/motion, finisher, ground residue, complete expiry | Identical source ticks and ordered phases; mask floor/void and wall collision transparently without changing original VFX geometry on valid tiles |

One consolidated report per skill **batch**, not a progress message for each tiny step. Publish side-by-side full scenes plus **cropped close-ups** (nearest-neighbor for display, never claim it is enhanced original detail), numbered timeline, and downloadable original native frames. GOLD shader/post is mandatory for FINAL visual comparison. If only TS `World.draw()` pre-post is available, caption precisely `BEFORE original GLSL post`. If Godot only ports primitives, caption prominently `PARTIAL, NOT FULL SKILL`.

**DO NOT** approve a full skill because isolated shadow/ground/glow buffers match SHA: source world RNG, simultaneous FX, player/enemy reaction, final vignette/flash/shock camera, aftermath, visible environmental modifications, runtime, collision and cleanup must be demonstrated. Never bake pre-rendered sprite sheets as substitutes for source algorithms. Original source ZIPs are immutable; never silently weaken Gold image hashes. Use this SAME reviewer output contract for all 21 Venomwright and 72 ARCANA III authored skills, keeping the families' renderers separate.

## First real-map comparison: Venomwright #001 Glassfang Hunt

**Actual native CI: [40641151945](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40641151945) PASS for PARTIAL STAGE**. Original Gold side is unmodified user ZIP `World.draw` / `World.step(1/60)` Ultra k2, with the original procedural Gold floor, Gold player, elite, multiple FX. Nine source timestamps: `6,15,31,63,96,147,177,220,330` ticks. Screenshot pairs generated from original 1200×680 RGBA + Godot native 1280×720 gameplay capture. Original source samples and stage record use the same 60Hz clock.

On the RIGHT, this CI actually starts production `AppFlow` campaign Level2 on map team immutable SHA `f9fb8d4b7490a2579426bd5c4ee4667704d3a05e`. Verifies **8057 authored floor cells / 3927 wall Geometry cells**, production Knight and actual enemy `L2C2Skeleton04`, actual Camera2D, three-pass source Fang actor motion, real source Pool.gnd/Pool.lit color and glow on the original floor, wall/void pool masking, and nine native 1280×720 screenshots. The mapped native stage's procedural source-ported portions are generated at runtime, not pasted onto background screenshots; no production files modified. Nine screenshots and detailed `comparison_manifest.json` uploaded as artifact `gold-glassfang-actual-level2-comparison-partial-stage`.

During nine checkpoints this map instance staged 28 source Pool instances cumulatively, masked 6566 nonfloor pixels, and recorded >100 changed sampled screenshot pixels against baseline. Combat damage remains unconnected: gameplay Knight/enemy HP is unchanged; this comparison is NOT an equipped/approved skill.

### This comparison FAILS FINAL FIDELITY, despite passing honest native staging

Compare Gold left to Level2 right, especially tick147: Gold source displays dramatic bright finisher, large enemy reaction plus shards/glow; the right side displays only small isolated pool residue because **vial projectile, splash, shards, feedback rings, impact flash, enemy crystal/corrode, bubble particles, source whole-world layering, original final shader and authoritative gameplay hit flow are NOT yet ported**. The reason for the obvious difference is **missing authored FX**, not wrong bitmap resolution. Do NOT scale/brighten pool arbitrarily to compensate: preserve Gold radius and source light, integrate missing effects and compositing until visual matches.

Check rendered images **as the required acceptance target**, not cosmetic decoration or primitive test status. The next work MUST complete Glassfang missing FX on this real-map acceptance harness and then obtain matched full Gold **WebGL postprocessed** vs native frames before calling #001 complete. For other skills reuse this exact native capture harness, original background and review layout, not just replacing the skill ID in an isolated test.

## Implementation / evidence index

- `prototypes/gold_pair/tests/venom_glassfang_level2_visual_comparison.gd` and `.tscn`
- `.github/workflows/venom-gold-glassfang-level2-comparison.yml`
- Source Gold event trace derived by running original ZIP `src/game/skills/s1.ts` against `World.step`, kept as immutable geometry/Pool constructor data (13 source pools with timestamps and RNG seed). No frames reused as procedural output.
- Original source 9-frame TS Gold source Ultra screenshot evidence generated in the direct working conversation; native Level2 screenshots directly accessible as the CI artifact, not via unverified sandbox paths.

Progress state: **0 / 93 full authored skills accepted**.
