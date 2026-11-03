# ARCANA19 decisive compositor round — STOP / specialist takeover

**Visual verdict: FAIL.** The live-world source-floor boundary still produces
severe bright/dark stripes. The graph still uses multi-context full-frame
processing and two scene posts; this is not a scalable or production-ready
renderer. Per Control Tower's stop condition, do not proceed to #02/#16 or
another cosmetic gain/threshold/bloom round. No merge. This is a source patch
for the primary Web game, not changes on the gameplay branch and not a real
ARCANA Core.

## Implementation, fixed boundaries and baselines

Patch `primary-19-decisive.patch`, SHA-256
`db9dda28bd77545e6f32d75fead790d9f9089b4d67583063fced5a9bbac66ee3`, applies
cleanly to gameplay PR #38 `3b37ae90601dee098066cbc4cf465552f1eb6f04`.
Preserves prior AVFX commits `b6222e4c36819da683813a02d21f728b77a15453` and
`f1f7a758036ebfdf1b6f7cb31ad666560759eae5` and evidence. PixelFX PR #39 last
checked `3ad009551d6302e3ac99f02c7d619d0dd2ff4728`; the integration was NOT
joined with PixelFX. The active bridge is development-only and observes genuine
ordinary Ember commits; it does not implement #19 hits, costs, item, or receipts.

Changed in this round: `d/worldGpu.ts` now bilinearly samples the field like
source's LINEAR warp texture and evaluates source UV continuously; strict
same-path `groundShimmerOn/Off` capture changes only the diagnostic shimmer
uniform. `d/warp.ts` and `d/commands.ts` remove an unintended extra OUT fade
from the source warp history and transfer. That does **not** silently remove
shimmer; it restores a source-authored field which actually makes its real-world
material problem more explicit. `primaryBridge.ts` exposes frozen QA metadata,
`qa-arcana19-matched.mjs` selects separately a genuine unmodified-game clearing
and the actual roof/tree scene, and `qa-arcana19-floor-boundary.mjs` renders the
unmodified source floor shader/FBO in four controlled cells. A new unit test
checks float history at exact ticks, within a stated tolerance against the
native RGBA16F center samples. Runtime changes are in the transferable patch;
no engine/sim/catalog/map/persistence was replaced.

## Earliest failed boundary, controlled 2×2

`evidence/boundary/*`: original standalone `FLOOR_FS` and its original native
float warp/decal buffers, exact 60Hz ticks 60/240/498/552; only floor material
(source's original floor versus a screenshot of the real game clearing mapped
back through the exact recorded transform) and the shader's shimmer term vary.
Native source emission is drawn identically in every corresponding `withEmission`
frame; `floor` is before emission, lighting and post. No post is applied in any
of these diagnostic cells. The source lab floor is **only** in these reference
images, never placed in the actual game. All fixed steps and captures execute in
one browser task; the original standalone's animation loop still renders while
paused, so allowing a task break would contaminate its FBO/geometry. Original
source output reference images remain under `evidence/original/`.

At tick 498 the native RGBA16F warp alpha at the center is **22.796875**;
`1 + w.w*0.10*sin(...)` can therefore range approximately **−1.28 to 3.28**
there before writing/clamping to the source RGBA8 scene. At tick 552 the center
is **25.390625**, not zero. Native decal alpha max is zero at all four sampled
ticks for this D cast (not a general statement about other sources). Native
CPU float history center is 22.7686 and 25.2836 respectively; small residuals
remain from different float precision/history and source camera shake; there is
no claim of bit-exact field parity. The shader applies its authored modulation
to sampled floor color *before* the RGBA8 scene's additive source geometry and
post; transferring it directly to brighter game materials makes the same factor
much larger in absolute luminance and produces clipped dark/light stripes. The
rotated/scaled world mapping changes their apparent screen orientation.

Within the source-center radius of 70 (15,380 pixels), on/off absolute luma
delta at climax was **16.26/255 on source floor vs 42.48/255 on real terrain**;
mean unmodulated luma was 36.64 vs 106.18. With the same source emission the
mean delta was 8.30 vs 21.34. Opening/build on/off delta was exactly zero, since
this source warp has not yet been emitted. These are diagnostic measurements,
not creator acceptance or a reason to remove shimmer. Images personally opened:
`climax-source-on-floor`, `climax-source-off-floor`, `climax-world-on-floor`,
`climax-world-off-floor`, both `*-withEmission`, and game clearing/occlusion
final day/night and moving frames.

Additional original-source finding: native renderer produces GL error 1282 in
its post path because it uploads `uFlashCol` (declared `vec3`) using `uniform4f`.
`qa-arcana19-source-gl-error.mjs` isolates this in the **unmodified** standalone;
the diagnostic's floor draws, texture upload and float read themselves return
zero errors. No original reference file was changed. Source flash parity needs
owner clarification instead of silently treating that error as a Web fix.

## Primary-game evidence and tests

`evidence/clearing/`: a real terrain clearing in the real map, QA-teleported to
player (2728,1800), seed 29253076; no fake stage. `evidence/occlusion/` uses the
normal Meadow Bay actual house/trees and boar, seed 29273440. Each is one real
run and cast shared by its day/night captures; visual source seed 97, source
ticks 60/240/498/552 and 1× 640×360. QA freezes **visual sampling only**, not the
gameplay clock. Each records the transform and camera per capture. Real D-key
movement at OUT moved the camera (clearing 2408→2418; occlusion 264→267).
Lighting/weather can differ day/night; no direct RGB parity asserted. Actor and
roof occlusion remain real alpha, not a brightness key. Source-vs-world
morphology is best inspected in the clearing; roof depth is a separate test.
Observed clearing day star has conspicuous yellow striping, night is luminous
but still striped; roof scene deliberately occludes source geometry. Therefore
neither passes fidelity. User HUD is in the 1× final screenshots; exact no-cast
world/HUD pixel identity is not separately proven this round.

Focused remote [CI run 41575638691](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41575638691) **PASS** on exact implementation commit `112c873e9c590063936c5cb6b85596817f70bd10`: clean primary patch application, typecheck, 23 tests, build, RGBA8 regression, real-input lifecycle, both game scenes and source-boundary/measurement scripts. The [frame artifact](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41575638691/artifacts/13203672223) expires 2026-11-10 UTC. CI includes Node 20 action deprecation and Ubuntu-latest migration warnings; a green run does not prove visual fidelity, target GPU performance, or absence of the intermittent startup race.

Local final-patch typecheck, build and **23/23** Vitest cases pass; RGBA8 ordering
synthetic regression 167 vs legacy 59 passes. Final-patch real-input lifecycle
passed on a retry: before-commit cancel charge 3 / visuals 0; two Ember commits
charge 1 / visuals 2 / two receipts; explicit visual cleanup 0. Two attempts
at a new natural-cleanup/contact run failed before gameplay with intermittent
primary `cvRef.current` null / `getContext` startup errors. Thus natural cleanup
on this exact patch is **not newly proven**; `f1f7a758` records a prior successful
ordinary Ember contact/cleanup on the preceding patch. Successful clearing and
occlusion captures had no page errors. No #19 gameplay is claimed.

SwiftShader without captures, early cast (source time 2.0167s): baseline rAF
p50/p95 50/116.8ms, cast 250.1/299.9ms; source CPU 0.1/0.5ms, raster 0.3/1ms,
ground submission 1.2/3.2ms and post submission 1.1/9.6ms. These CPU calls do
not expose deferred GPU work/sync; headless software is not target-GPU FPS and
the peak-time cost is unmeasured. Six npm advisories (1 low, 1 moderate, 2 high,
2 critical) and browser Canvas2D readback/SwiftShader warnings remain.

## Concrete takeover brief: one compositor owner

**Owner needed:** WebGL2 renderer/compositor specialist + gameplay/PixelFX
owners; alternatively a matched Godot-vs-Web vertical slice if Web ownership
cannot provide the capabilities below. Do not solve by replacing the source or
changing brightness, frequency, shimmer, bloom thresholds, real occlusion or
combat.

1. Replace the main visible game canvas's Canvas2D-only ownership with a
   gameplay-approved WebGL2 presentation owner. A 2D context cannot be turned
   into WebGL on the same canvas. Migrate the existing 2D world to an offscreen
   producer and upload once per frame, or migrate terrain/actors into WebGL;
   present directly from that one GPU context, with React HUD on top. A simple
   WebGL helper drawn back into a 2D canvas still incurs a cross-context copy.
2. In that owner keep resident FBOs/textures for world color, semantic
   actor/roof coverage or actual depth, source RGBA16F warp ping-pong and decal,
   source scene/geometry/emission, original bright + two-scale blur, and final
   pre-HUD source post. Raster source batches in the same context. One graph,
   one bloom/post per frame, no `toDataURL`, readback or two full-scene post
   passes on the runtime path. Specify resize/context loss, color space,
   blend/alpha, lifetime, overlap arbitration and clock ownership.
3. Resolve the **material-policy decision**: exact source shimmer multiplies a
   dark laboratory floor and clips violently on brighter game surfaces. The
   2×2 native-source test reproduces this even with source FBO ordering, so a
   creator/gameplay-authorized semantic response for bright materials is needed;
   no undocumented suppression, brightness-key, synthetic floor, or fake actors.
   Validate on both unobstructed real terrain and real actor/roof motion.
4. Gameplay and PixelFX must supply/agree typed event and target-aware depth/pass
   interfaces. Current PixelFX depth closures capture their context and cannot
   be assumed compatible with the existing alpha-layer redirection. Gameplay
   alone owns HP/cost/impact/cancel. No implementation can assert a #19 hit
   until that authenticated event exists.
5. Gate on original-source vs clearing and separate occlusion frames at the four
   ticks, day/night, 1×, moving camera, full OUT and zero-cast identical world /
   HUD; validate float field and RGBA8 source clamp/post, frame pacing and GPU
   timers on genuine hardware. Fix or have gameplay owner address the observed
   intermittent canvas startup race. Only then re-open #19 fidelity review.
