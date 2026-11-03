# #19 compositor recovery — experimental / visual FAIL

This is a transferable primary Web patch, not a merge or playable ARCANA Core.
Primary baseline PR #38: `3b37ae90601dee098066cbc4cf465552f1eb6f04`.
PixelFX PR #39 inspected at `3ad009551d6302e3ac99f02c7d619d0dd2ff4728`.
Previous adapter preserved in `dd5f82fc2b70b7690158895b0c1072659cafffa0`;
this is a new, separate patch so the earlier work remains recoverable. SHA-256
`f0a9291fb49d4896b32957e017e8f97d1fd4dafa9f8185df929cb514536ccd7a`.
The exact primary tree accepts `git apply --check`. No primary branch was changed.

## Implementation and boundaries

`web/src/game/arcana20/{primaryBridge,scenePost}.ts`, `d/worldGpu.ts` and the
narrow `render.ts` hooks now split live-terrain distortion from source-emission;
collect actual alpha of y-sorted game actors, trees and game roofs; and subtract
that occlusion from source color before adding emission **after** the game's
actual weather/night lighting. No brightness-key mask, fake actors, imported
laboratory background or terrain replacement. Real roof and trees in the frames
are the primary map's. `scenePost.ts` executes the source BRIGHT/blur pyramid
and COMP equations on the live lit scene. It compares complete source post on
live scenes with/without emission to keep unrelated primary terrain from being
globally recolored. This is an adaptation, NOT source-equivalent HDR: the
source's scene/bloom buffers are RGBA8 (its warp may be RGBA16F); ours uses
Canvas2D/RGBA8 intermediates, screenshot-sized buffers, two full post runs,
source-to-world scaling and an LDR post difference. The pre-actor ground warp
still has a bounded influence mask and remains an approximation. Multiple
casts pick the maximum bloom gain/flash; correct overlapping source post is not
validated. There is no actual GPU depth buffer. Bloom spills around occluders.

`Game.tsx` only observes the existing Ember cast event in development mode via
`?arcana19Bridge=1`, which is **QA-only**. A real #19 gameplay Core, authenticated
cast/impact/cancel, resource costs, target identity and damage do not exist.
No changes were made to engine/sim/catalog/world/content/persistence. PixelFX
also changes `render.ts`/`Game.tsx` and supplies depth-item closures bound to
its own context; this alpha-layer technique is not automatically compatible and
has not been joined with PR #39. Owner review and a shared pass contract are
required before any merge. The attempt to request the read-only gameplay event
on issue #37 failed with GitHub `Resource not accessible by integration`; no
comment was posted.

## Matched inspection, not acceptance

`evidence/`: same real QA run seed **21441822**, same visual seed **97** and
same cast/aim, 1x 640x360, tick **60/240/498/552** (1/4/8.3/9.2 seconds),
day and night. A dev-only visual freeze advances/rewinds source sampling at
exact 60 Hz; it does not freeze gameplay or prove frame pacing. Camera was
(264,1566) for all except day opening (265,1567); `moving-*` captures a real D
key movement to (274,1566) at tick 552. QA grants the existing Ember Core and
creates a real boar through engine APIs; day/night is a QA clock offset. Original
`source-original-{tick}.png` shows the frozen unmodified standalone including
its lab floor for reference **only**, never imported into gameplay. Source
raster, real terrain/world, actor, roof, actual lighting, alpha occluder,
emission before/after mask, scene, post/pre-HUD, final with actual HUD and
camera-motion frames are all included. Final screenshots are true 1x.

I inspected original 498, `day-climax-preHud`, `night-climax-preHud`,
`day-climax-final-1x`, `moving-preHud`, and 9.2s OUT. Night emission now survives
lighting and actual roof/trees cut it, unlike the previous near-invisible
result. **It still fails visual fidelity:** prominent high-contrast bands remain
by day and night; day star is obscured/washed out; the live viewport's full
scene post difference and source transform are not original source HDR/order.
No creator/Gold approval, #02/#16 work, or production link claimed.

At climax, pixels with luma >10 above the actual after-light scene: day 18,826,
night 19,507 out of 230,400. Peak luma increase day 196, night 232/255;
output pixels luma >=220: day 719, night 635. Source-emission RGB >5 covered
20,719 pixels before alpha occlusion, 11,933 after, in both. These are
coverage/brightness diagnostics, not geometric or visual acceptance; the mask
includes real map trees and roof, not just actors. Source and world are
transformed and have different backgrounds so pixel values are not a parity
metric. The original source reference stays unchanged.

## Tests and constraints

On the pinned primary + patch in a scratch tree: `npx tsc --noEmit`, all 22
Vitest cases and production `npm run build` passed on the final patch. RGBA8
ordering synthetic check passed [167,167,167,255] vs legacy [59,59,59,255].
A final real-input lifecycle rerun passed: cancel before commit charge 3/visual
0; two Ember commits charge 1/visual 2/two receipts; explicit visual cancel 0.
A separate final real-input contact/natural-cleanup run passed: the QA Ember
charge 3→2, real boar HP 200→155, one fire receipt and visual cleanup 0, no
page errors. This is ordinary fire, not a #19 hit. Earlier attempts to run
lifecycle and contact hit an intermittent primary React `cvRef.current` null /
`getContext` startup failure; successful retries do not erase that baseline
flakiness. The matched 1x visual capture completed with no page errors.

SwiftShader Chromium non-capture sample: baseline rAF p50/p95 83.3/166.7ms,
cast 283.3/316.7ms; source CPU 0.1/0.5ms, raster 0.3/1ms, ground composite
1.4/3.2ms, post submission 1.2/8.3ms. Asynchronous GPU/readback costs are not
captured by these CPU timings; this is software rendering and is far too slow,
not device FPS. Warnings include Canvas2D readback and automatic SwiftShader
fallback. `npm ci` reported six advisories (1 low, 1 moderate, 2 high, 2 critical).

Focused remote CI [run 41572328943](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41572328943)
**PASS** on implementation commit `b6222e4c36819da683813a02d21f728b77a15453`:
the pinned patch applied, install, typecheck, tests, build, RGBA8, lifecycle and
matched capture steps succeeded. The uploaded `arcana19-focused-frames`
[artifact](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41572328943/artifacts/13202096773)
expires 2026-11-10 UTC. CI carries Node 20 action-deprecation and Ubuntu-latest
migration warnings; success is not visual approval or proof against the
intermittent startup race. Next: establish physically correct
source-space scene/warp/FBO post ordering and real color/coverage including
HDR-capable intermediates without global recolor or bands, reconcile PixelFX
layer ownership, obtain authenticated owner event, then measure a real GPU and
repeat matched inspection before progressing beyond #19.
