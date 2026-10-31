# ARCANA20 real-overworld integration status — diagnostic, not acceptance

This is a current-world overlay on `ACCEPTANCE_MATRIX.md`, not a replacement for
original-source comparison or the creator's approvals. All 20 remain active;
all are `VISUAL_NOT_VERIFIED`, and `OWNER_VISUAL_APPROVED = 0`.

**Reproducible isolated join:** `tools/arcana20_join/assemble.py` and
`.github/workflows/arcana20-overworld-join.yml`; archives overlay exact owner
objects without merge/checkout. Tested pin: historical A0
`62f6a32d08d319bfdcd28235786558f54f49b420`, A6
`6b801554a6af95424b4e39dd29f43c146aa13848`, A1/A3
`2cb1a3c5f093724eb9fecbdf45909ccb611f7b32` /
`18e7afcbd576bbd9bfbcc509b2ee13216186a522`, PR30
`e505173edd119fdd955cf6249511b575a5468440`. Latest observed A0
`ee5f9f5160c8e4385f35a63b355ddda957f93d10` connected-journey
[run 41206034344](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41206034344)
failed; this historical pin is not an endorsement of the latest route.

- B/C run [41207915157](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41207915157)
  at `98bd1ff1`: actual AppRoot/Home/AppFlow world and readiness; *injected*
  real Skeleton and R4-authorized diagnostic hit reached unmodified PR30.
  Frozen t=3s #02/#10/#17 changed 18,366 / 10,392 / 63,432 pixels, none
  outside conservative source-operation footprints. Cancellation restored the
  baseline; #02/#17 camera (+40,+20) preserved world source transform and
  moved the screen anchor (−40,−20). This is one frozen frame per ID, not a
  gameplay, fidelity, overlap, actor-depth, performance or full-phase gate.
- A run [41208517991](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41208517991)
  at `b2031ab3`: diagnostic JOIN passed after fixing A direct `ADraw.field`
  operation tracking. #04 is an unapproved redesign candidate; successful
  terrain compositing is not approval. Exact per-ID metrics remain in the run
  artifact. First A test at `4aa3b6cc` failed: direct field operations were
  missing from the footprint; no tolerance was changed.
- 220×220 **32-color diagnostic crops** of #02/#17 have been inspected from
  [triage 41208343910](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41208343910).
  They show an actual world/actor and effects but are insufficient for source
  parity, phase, occlusion, native-size color or owner review. Raw screenshots
  and source fields are in the JOIN artifacts. No simulated arena screenshot is
  used as acceptance.
- [JOIN 41209253992](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41209253992)
  at `cb634486` additionally passed frozen #02+#10 cross-family and #02+#03
  same-family overlap/cancel restoration and #05 A/C shared-world/cancel
  checks. These exercise composition and cleanup only, not live play or full
  source fidelity. #05 uses original A opening/peak and C late column/fall
  candidates with a 0.6s offset and A eruption tails excluded; its full cast,
  original-source pass comparison and owner review remain open.
- #09 `e0cae48d` adds an experimental A graph schedule with actual actor
  references, B ARC colors and C `bolt_pts`. Its native JOIN and source tests
  [JOIN run 41208565813](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41208565813)
  at `e0cae48d` passed the moving-real-skeleton anchor, no-damage, and cancel
  diagnostics. This one-injected-actor test is not AI targeting or source
  fidelity. Source regression/full capture and later revisions remain pending.
  Legacy candidate remains separate. No effects engine mutates combat HP.
- Screen flash/shake, D full bloom/post fidelity, A body integration, world lighting,
  post overlap policy, occlusion layers, target-device performance and all
  same-seed original-vs-native full-cast comparisons remain open. Experimental
  per-frame CPU packing is not a production renderer.

| ID | Current actual-world source status | Remaining / evidence |
|---|---|---|
| 01 | A candidate + selected C outer tongue primitives, frozen-world/cancel [41209822468](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41209822468) | Whole-cast source parity, viewport post, actor depth and owner review |
| 02 | B world pass diagnostic | [run 41207915157](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41207915157), one frozen frame only |
| 03 | B world fields available | Actual-world comparison and lifecycle not checked |
| 04 | A world pass diagnostic; REDESIGN_CANDIDATE | [run 41208517991](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41208517991); no visual approval |
| 05 | World-mode A original opening/peak + C selected column/fall candidates, one frozen JOIN sample | [run 41209253992](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41209253992); source pass comparison, wet actor and whole-cast review missing |
| 06 | A candidate fields available; REDESIGN_CANDIDATE | Moving-tip sweep, water and full world review missing |
| 07 | C world fields available | Actual-world comparisons, occlusion, phases missing |
| 08 | B world fields available | Actual-world comparisons, post, gameplay missing |
| 09 | A graph/B colors/C bolt candidate; real-enemy anchor diagnostic [41208565813](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41208565813); C channel variants/branches added `84d9bcb0` | New branch tests pending; misses/deaths, B raster, full source comparison and review missing |
| 10 | C world pass diagnostic | [run 41207915157](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41207915157), one frozen frame only |
| 11 | A rotor/fragment + C bolt-tree candidate; [isolated rotor comparison 41211833178](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211833178), [actual-world JOIN 41211652270](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211652270) | C branch role/fidelity, full fusion/post, natural motion/OUT, depth and review missing |
| 12 | A candidate fields available; REDESIGN_CANDIDATE | Targeting, source craft and world review missing |
| 13 | A candidate fields available; REDESIGN_CANDIDATE | Actor targeting, depth and world review missing |
| 14 | A candidate fields available; REDESIGN_CANDIDATE | Actor/colony integration and world review missing |
| 15 | C world fields available | Actual-world and moving-actor review missing |
| 16 | A growth + C material; [original source samples 41210844049](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41210844049), [real-world sample 41210774544](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41210774544) | C material parity, full world cast/OUT and owner review |
| 17 | C world pass diagnostic incl. live-screen fragment mapping | [run 41207915157](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41207915157), one frozen frame only |
| 18 | A candidate fields available; REDESIGN_CANDIDATE | Real actors, full-cast and world review missing |
| 19 | D additive and persistent warp consumer; pixel-center sprite/ribbon source diagnostic [41216275855](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41216275855) | D bloom/post, full OUT, depth, full original parity and visual approval missing |
| 20 | C contour/polygons/blocks/particles/OUT + A world pull and real-ground debris candidate; [motion](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41215663639), [overworld JOIN](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41215918902) | Complete fusion/world fidelity, gameplay authority, moving-hit/miss, depth and review missing |

Run-level pass does not override a failing check annotation. No thresholds have
been relaxed. Only CT owns `soh_binding/**`; no production mount, merge, fake
battlefield composition, visual approval, or damage authority is claimed.

## Known regression under investigation

Run [41209339382](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41209339382)
at `e45b1504` failed a **single JS-vs-Godot exact A hash** test at the large
coordinate `(9000,1244)` after the signed-shift correction. Other listed hash
vectors passed. Diagnostic `407afd03` showed native intermediates match JavaScript. The
comparison was switched to exact uint32 numerator vectors (not a relaxed
floating tolerance), and [source quick 41209652104](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41209652104)
at `305f595c` passed. This validates the tested vectors, not every input. The real-world JOIN was
successful at that SHA, but that does not clear this independent source gate.
The JOIN shutdown reported 17 ObjectDB instances / 5 resources in use.
[No-FX baseline 41209973572](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41209973572)
reproduced the same counts and same five economy scripts without creating AVFX
or R4 actors; this isolates the observed historical baseline, not all possible
AVFX leaks or the current A0 route.

## Original A #05 opening source-only trace

[Comparison 41209885994](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41209885994)
runs the unmodified TypeScript A spell and isolated native A component with the
same 416×234 dimensions, fixed 60 Hz seed/clock and black source input. At
ticks 90/180/270, RGB PNG MAE is 0.0213/0.0433/0.0534 and maximum channel
error is 1. Instrumented *source buffer write* footprint IoU is 1.0 for all
three; artifacts include full PNGs, pixel heatmaps, 8×6 regional errors and
HDR buffers. The instrumentation tracks write operations, not RGB-derived
world alpha; it is not equivalent to opaque coverage or a world composite.
Burst, C selected late role, full cast, real-world post and owner review remain
unverified. [No-FX baseline leak isolation](https://github.com/Khanh-glitch/Soul-of-Hero/pull/21#issuecomment-6544643328)
reproduced the historical economy-resource leak without AVFX; exact ownership
of every leaked instance and current A0 status remain unproven.

## All-20 camera and cancellation diagnostic

[Frozen sweep 41210274460](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41210274460)
(`c6fb12ba`), with [all rows 41210426324](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41210426324),
used actual historical AppRoot→Home→overworld, real injected SOH Skeleton and
opt-in world consumers. Every ID changed the world at tick 120, held its
source world transform when the camera offset moved (+40,+20), and restored
the same frozen world when cancelled. Paired baseline/cast PNG comparison
measured the visual change-mask translation as (−80,−40) physical pixels at
1280×720 because the root render scale is 2×: logical (−40,−20). Change-mask
IoU ranged 0.999749–1.0, including #02 0.999954 and #17 1.0; maximum individual
RGB difference reached 39 for #02, so do not call every pixel exact. These are
measurements, not tuned PASS thresholds or source/coverage/visual approval.
The artifact contains individual captures, camera heatmaps and metadata.

A repeat at `37cb938c` includes the revised #09, #11, #16 and #20 candidates:
[JOIN sweep 41212751992](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212751992),
[all rows 41213007733](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41213007733).
All 20 changed the frozen world, kept their source transform anchored for camera
(+40,+20) / screen (−40,−20 logical), and restored the baseline after cancel.
Change-mask IoU was 0.999749–1.0; #02 0.999954, #17 and #20 1.0. One tick
(120) only, not continuous movement, complete phases, performance or approval.

The sweep's one-shot `source_snapshot_ms` includes 120 simulation ticks plus
render/upload on shared software CI; it is **not** per-frame latency or a
target-device budget. #19 cost 5474.832 ms for that whole snapshot, flagging
D for profiling. Gameplay input, natural motion, full cast/OUT, depth/post,
multiple resolutions and target-device p50/p95/p99 still require evidence.

## #16 original growth and selected material

At `5a10246b`, opt-in world mode selects the original A `0x5eed` seed,
four-layer parametric growth, fold, pollen and bloom, with C Worldseed's
leaf/bloom/gold palette and material rules on explicit coverage-bearing ink.
Original legacy candidate remains unchanged. This adaptation deliberately
combines A geometry with C material; it is not a claim of full C material or
post parity. [A-only neutral-material source comparison 41210721707](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41210721707)
compared original TypeScript vs native at ticks 90/180/270: write-trace IoU
1.0 each; RGB MAE 0.00393/0.00866/0.04427, max channel error 1. These
are black-canvas source tests, not authored world alpha or approval. [Real-world tick-240/cancel JOIN 41210774544](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41210774544)
passed. [Seven original-A source samples through tick 479 / near OUT](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41210844049)
all have write-trace IoU 1.0 and RGB maximum 1 (maximum MAE 0.1042). The
whole world cast and selected C-material source comparison remain pending. The older all-20 sweep at `c6fb12ba` exercised the older #16
candidate, not this revision.

## Live movement diagnostic

[Live input 41210774548](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41210774548)
used the real historical-world Knight's right-click input route and target,
held `move_right` while an opt-in #02 visual cast was *injected by the test*,
and enabled the actual Skeleton's physics. The player moved 46.76 world
units, Skeleton 19.80, camera 57.29; the target's HP stayed 69 and source
anchor remained world-consistent. This is not a gameplay skill binding or
combat targeting/miss test. The 35 intervals in that log are **physics-signal
intervals**, not rendered-frame percentiles; its memory delta is not an
allocation count. Shared software CI is not a target-device budget.

## Experimental C viewport impulses and #20 rift

At `1bfcc1a0`, the opt-in viewport post consumer applies **source-authored**
C flash/shake/chroma/invert above the real world/actors and below A0 HUD layer
20. [JOIN 41210977545](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41210977545)
passed C17 rebound enable, actual-screen change, overlapping-cast cancellation
and exact frozen-world restoration. [JOIN 41211301091](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211301091), [assertions 41211488925](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211488925) additionally passed idle no-change and an actual opaque HUD-pixel isolation check.
[C20 collision JOIN 41213047595](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41213047595),
[assertions 41213261574](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41213261574)
also verified original C20 collision inversion in the real viewport, one
actual opaque HUD pixel remained unchanged, and detaching the opt-in consumer
restored the no-post frame. The collision impulse is intentionally screen-wide;
this is not a human contamination or source-post fidelity review.
The consumer is NOT automatically mounted, lacks original multiscale bloom,
uses an experimental overlap policy, and desaturates the composed scene rather
than source-C's pre-ink ground. It needs human visual/contamination review.

At `93256c98`, opt-in #20 selects C's seeded rift contour, timing/edges and
interior with a phase-aligned A bgWarp pull/stretch on that same real world;
source-C inverted fragments explicitly sample the live world. This replaces
neither legacy source nor approved systems. [Source-field quick 41211236215](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211236215)
verified ink, inverted live fragments and displacement exist. Real-world [JOIN
41211301091](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211301091)
and [assertion triage 41211488925](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211488925)
show 70,364 changed pixels inside explicit influence, zero outside, and exact
frozen-world cancellation restoration at tick 270. The isolated original C
first-contour field comparison [41211396186](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211396186)
at ticks 270/324/396/450/540 produced authored ink coverage IoU 1.0, ink MAE/max
0, and light MAE <= 2.1e-11 / max 5.96e-8 on a zero base. It excludes A warp
and all other C geometry, so it is NOT whole-source/composite parity. Original
`006c0073` added C original clipped wireframe geometry and passage;
[isolated polygon comparison 41212119457](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212119457)
at ticks 270/324/378 has light-support IoU 1.0 and light max <= 2.38e-7 on zero
base, excluding contour, blocks, particles, A warp and actual world. The
[early-glitch comparison 41212198883](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212198883)
at ticks 20/45/64/84 reported zero light/displacement error on zero base.

`e7f6ecce` adds C's 56 seeded source-world blocks and collision shock;
[isolated comparison 41212314942](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212314942)
at ticks 396/420/450/480/540/558 had ink coverage IoU 1.0 and max ink error 0,
light max <= 2.98e-8 and displacement max <= 8.95e-6 (zero base, no other
roles). Actual-world [JOIN 41212334117](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212334117)
and [assertions 41212530822](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212530822)
confirmed 2,421 direct live-world fragment pixels and 146,257 changed pixels
inside source influence, zero outside, at tick 420, plus exact frozen-world
cancel restoration. This JOIN predates the later particles and OUT code.

`5dc94018` adds original C edge/collision particles. [Controlled-seed source
comparison 41212432542](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212432542)
at ticks 270/324/396/420/450/480/510 recorded max light error <= 2.39e-7,
and zero ink/displacement errors; no ink is authored here. C's original
Math.random particle-seed sequence was controlled to match native, so this is
not unrestricted-random or complete-cast parity. `aa0ff825` adds source C's
final live-world inversion and glint; [neutral source-only OUT comparison
41212515806](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212515806)
at ticks 570/582/591/593/594 recorded zero ink/light/displacement errors, but
live-world and post fidelity are separate. [Actual-world JOIN 41212486419](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212486419) and [assertions 41212683037](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212683037) confirmed 30 live-world OUT inversion fragments and 1,104 changed pixels inside influence, zero outside, at tick 570, followed by exact frozen-world cancel. This is one frame, not a natural full OUT or a visual-accuracy review. A original ground-sample additive debris, full-source/world fidelity, motion,
depth, owner review and production readiness all remain open. The older all-20 sweep at `c6fb12ba` exercised the
older #20 candidate; the newer sweep at `37cb938c` includes current #20.

## Actual-overworld overlap frame probe

At `38c408e8`, [overlap diagnostic 41211526529](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211526529)
measured 54 actual post-draw intervals while #02 and #10 were concurrently
active in the pinned historical overworld, at verified viewport-capture sizes.
Shared software-rendered CI results (milliseconds):

| Captured size | p50 | p95 | p99 |
|---|---:|---:|---:|
| 1280x720 | 371.446 | 394.153 | 409.275 |
| 2560x1440 | 646.300 | 676.415 | 719.087 |
| 3840x2160 | 881.093 | 915.322 | 950.645 |

The recorded static-byte delta (~7.22 MB) and object delta (15) included the
capture image and were sampled after the timing loop, possibly after a cast
ended; they are **not a reliable simultaneous-cast memory delta**, allocation
counts, peak memory, post-cancel leak counts, or target-device results. Enemy HP stayed
69 throughout. This software CI is very slow and **does not satisfy a frame
budget**. The test does not prove all effects, natural gameplay, or 4K visual
quality. `9c3fe144` added an X11 screenshot and explicit window-size check;
[run 41211743348](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211743348)
passed all three resolutions, but that older screenshot was taken after the
timing loop and did not establish that both casts remained active. The newer
probe captures during overlap and samples memory while both viewers are active. Device-specific profiling,
allocations, full-cast capture and cleanup analysis remain mandatory.

## #11 isolated rotor and actual-world evidence

The `b7362e60` world-mode #11 candidate uses original A seed `0xc0de`, six
segmented rotor rings, synchronization and particle lifecycle; it replaces
A bolt paths with C bolt-tree geometry, drawn in the A presentation palette.
[JOIN 41211652270](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211652270),
[assertions 41211916988](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211916988)
verified 48,147 changed actual-world pixels inside explicit source influence,
zero outside, and exact frozen-world restoration on cancel at tick 180.

[Original A comparison 41211833178](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211833178)
instruments the A bolt helper as a no-op in memory and disables the native C
bolts to isolate A's rotor, sync, pulse ring and fragments on a black source
canvas. Ticks 90/180/270/324/348/396/420 produced buffer-write-trace IoU 1.0,
RGB max 1 and MAE <= 0.111, HDR MAE <= 2.4e-9. The trace is not authored
alpha; this is not a comparison of C bolts, live-world composition, the
entire fusion, human visual review or combat binding.

[Late C #05 comparison 41211894503](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211894503)
showed exact displacement and ink coverage IoU 1.0 at ticks 372/396/420/450/480/510,
but light differed after tick 372 (max about 0.67). The original particle
engine uses `Math.random()` for per-particle seeds, whereas native CKit uses a
deterministic counter. [Controlled-seed comparison 41212007767](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212007767)
matched the source `Math.random()` seed sequence to native's counter without
modifying source logic: at all six ticks ink coverage IoU was 1.0, ink max
<= 5.96e-8, light max <= 5.96e-8 and displacement max 0. This explains the
previous light difference but does not prove uncontrolled random seeds match
or cover t < 6.2, original full fusion, world composition, post, OUT or review.

The updated [overlap run 41212007763](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212007763)
verified that both source viewers were active across the physical screenshot,
checked 720p/2K/4K viewport, window and X11 sizes, and then measured 52
post-draw overlapping intervals per resolution: p50/p95/p99 were
444.659/466.964/493.019 ms (720p), 645.000/675.498/697.919 ms (2K) and
652.600/676.249/702.701 ms (4K). Live-object delta was 33 while overlapping
and 0 after cancel relative to baseline in these probes. Static-byte deltas
were negative at higher resolutions as viewport/capture resources changed, so
they are **not reliable cast-allocation measurements**. These software-CI
results are not device budgets, full lifecycle or visual approval.

#09 added C channel variants/branch generation over its A live-actor graph
at `84d9bcb0`, retaining B colors. [Source smoke 41212672128](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212672128)
passed a branch-specific write assertion; [actual historical-world JOIN
41212600375](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212600375)
with [assertion triage 41212776758](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212776758)
passed moving-real-actor anchors, no damage authority, unbound contact ledger
and cancellation. It is not a source comparison of C raster/slot timing,
full gameplay targeting, miss coverage or visual approval.

#19 D source initialization was corrected at `b9b8a165` to use the original
browser's 0.0001-second first reset update before subsequent 60 Hz steps. A
new [source-pass diagnostic 41213284257](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41213284257)
is pending. Original D HTML allocates scene and both bloom target scales as
RGBA8, while only warp targets are RGBA16F when supported. The first attempted
float read of scene/bloom [41212972194](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41212972194)
failed; the RGBA8 capture was corrected rather than pretending those original
targets were HDR. No D bloom implementation or full parity is claimed.

D19 neutral-base g-buffer diagnostic at old SHA `5f268dd3`, before the
first-reset-delta fix: [41213135534](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41213135534)
ran successfully, but **did not establish parity**. Original RGBA8 scene versus
clipped native float g: light-support IoU 0.698/0.675/0.683/0.932/0.931,
linear RGB MAE 0.00289/0.00296/0.00339/0.01332/0.01718 and max error
1.0/0.957/1.0/0.980/0.984 at ticks 72/192/312/489/510 respectively.
Support is a diagnostic measurement, never an alpha key. The raw native
peak was 5.51/4.89/5.43/38.94/40.35; original RGBA8 clips to 1.0.
Original bloom intermediates were captured but not compared to a native bloom;
no live world, native post, source coverage or approval was established. Newer
source initialization and a diagnostic-only skipped-intermediate-raster
optimization must be rerun and assessed separately; its eager-vs-skipped
comparison runs at tick 20, not every possible phase.

[Real-overworld review crops 41213357418](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41213357418)
extract small quantized review thumbnails from full-size JOIN captures, not
replacement acceptance images. The #11 tick-180 crop appeared thin and low
contrast in this limited inspection; it needs native-size Gold-vs-world creator
review. The #20 OUT crop shows strong color inversion; the separately tested
collision post is screen-wide. Both need the mandated human contamination
review against full-size before/after captures. No visual approval is
inferred from these thumbnails.

At corrected initial delta SHA `b9b8a165`, [41213284257](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41213284257)
reproduced the same reported g-buffer summary metrics above. Diagnostic-only
skipped-intermediate raster at `0cd7f78e` also reproduced these reported
metrics in [41213481876](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41213481876),
with an explicit eager-state-and-buffer check at tick 20. This is not a claim
of full buffer equality at the five sampled frames.

Original D `SPRITE_VS` rasterizes a rotated quad and fragment centers are at
half pixels; at `c2882d5a` the CPU sprite port was corrected to sample those
centers and restrict rasterization to the quad. A new original-vs-native
[diagnostic 41213605327](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41213605327)
measured improved light-support IoU **0.954/0.903/0.865/0.987/0.987** and
linear RGB MAE **0.000631/0.000797/0.001959/0.010781/0.012465** at ticks
72/192/312/489/510 respectively. Local maximum RGB error remains
**1.0/0.894/1.0/0.983/0.986**: this is not parity or acceptance. Latest
viewport-clipped optimization `743688b2` has a separate
[diagnostic 41213639184](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41213639184)
completed with the same reported summary metrics, and
[world JOIN 41213605315](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41213605315)
passed at `c2882d5a`. Ribbons/poly, GPU rounding, coverage, bloom/post, actual
SOH world source parity and creator review remain separate.

## 2026-10-31 continued native work — scoped evidence

- At `8eaffdfb` A20's original seeded spawn, decay and bilinear debris role was
  mapped onto C20's **single** selected contour, with C20's existing retimed
  clock. It emits additive sampling instructions for actual SOH world pixels;
  per-pixel operation lists preserve overlapping source coordinates rather
  than overwriting earlier debris. [A motion reference 41215663639](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41215663639)
  compares original A and native on the original A path at six A ticks:
  counts 0/48/192/336/310/54, maximum state difference 5.12e-13. This does
  not establish fused visual parity or gameplay hits. The retiming and C-path
  mapping remain fusion-candidate decisions pending visual review.
- Historical A0 JOIN at `d44e3892` [41215918902](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41215918902),
  [triage 41216218828](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41216218828),
  found 9,516 live sample operations over 4,117 pixels with 2,923 pixels
  retaining multiple mappings; disabling the additive pass changed the real
  world. This was a frozen tick, not a moving-cast, miss or damage proof.
- Full **visible actual HUD at this state** isolation in the same JOIN was
  measured using black/white backgrounds below the real HUD and post-on/off
  live-world captures: 59,787 covered pixels, 17,930 opaque, 41,857 partial,
  0 mismatches under a fixed 3/255 arithmetic-rounding bound (max 1.667/255).
  Hidden panels/states, other A0 versions and human contamination review are
  not covered. HUD geometry was not fabricated. Active-cast AppFlow transition
  regression was added later at `79d632c1` and remains pending.
- Five economy resources and 17 ObjectDB instances remained in both the
  no-AVFX baseline and full frozen JOIN at `d44e3892`; the **count delta**
  was zero, not proof that all possible AVFX lifecycle leaks are absent.
- D at `bafac9de` [41216275855](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41216275855)
  aligns straight-ribbon sampling with GPU fragment centers/finite strips,
  approximating the source shader's screen-gradient fwidth. Neutral g-buffer
  support IoU 0.961/0.964/0.873/0.987/0.987 and linear RGB MAE
  0.000371/0.000500/0.001930/0.008032/0.009180 at ticks 72/192/312/489/510;
  max error 0.820/0.894/1.0/0.980/0.986. **Not parity.** Further poly,
  multi-segment ribbon, fwidth and source blend/rounding work remains.
  Legacy D preview at `d4fd9040` is explicit additive blending with opaque
  black inputs, not RGB-derived alpha or evidence of authored coverage; native
  bloom, full post and full-cast comparison are still missing and tests pending.
- `e0965930` caches the immutable seed-151461 nearest-contour fields to avoid
  recomputation for repeated #20 casts; approximately 1,990,656 packed bytes
  remain intentionally resident as a static master. The initial sharing test
  [41216341845](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41216341845)
  exposed mutable packed-array aliasing (cold/cached setup 495.4/1.14 ms); the
  implementation was corrected to explicitly duplicate each cast's arrays.
  [Regression 41216872164](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41216872164)
  passed mutation isolation and measured cold/cached setup 520.145/1.199 ms
  on shared software CI, with a ~1.99 MB master plus ~1.99 MB per cast (array
  payload only, excludes allocator overhead). This is not frame time or a
  target-device memory budget.
- Latest A0 inspected is `a6e3797879915510b2e86be0d2ee521f53967c94`:
  [A0+A6 composition 41215828924](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41215828924/job/124580025221)
  fails `res://game/survival/a0_world_authority.gd:157`, missing `_spawn_cell()`;
  [connected journey 41215828926](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41215828926/job/124580025210)
  separately fails accessing `disabled`/`pressed` on freed controls. Exact
  normal-entry leg uses `timeout --signal=TERM --kill-after=15s 1800s xvfb-run
  -a bash tools/ci/godot_isolated.sh --path . --rendering-method gl_compatibility
  --rendering-driver opengl3 --audio-driver Dummy --user-data-dir
  artifacts/ud_candidate --resolution 960x540 --windowed --script
  res://tests/survival_normal_entry_waystation_candidate_test.gd`; its
  [job 124580025941](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41215828989/job/124580025941)
  fails. A0 owns these errors; no A0 fix or acceptance claim is made here.
  Current AVFX code is on Arena branch, **not** PR #28 (`06ca9f15`, older #02
  pilot). Coordination: [PR30 comment](https://github.com/Khanh-glitch/Soul-of-Hero/pull/30#issuecomment-6545495243),
  [A0 owner comment](https://github.com/Khanh-glitch/Soul-of-Hero/pull/21#issuecomment-6545623258).

- Real #02+#20 sampled overlap at `a831193b` on software X11 4K
  ([run 41217166376](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41217166376))
  sampled 54 actual post-draw intervals: p50/p95/p99 **859.002/1110.438/
  1172.719 ms**, live objects +36 and post-cancel object delta 0. Allocation
  counts were unavailable; static-memory deltas were negative and unusable.
  Source-tick start/end were not recorded in this older run; phase coverage
  must not be inferred from wall-clock frame count. 720p was
  **363.090/526.892/568.072 ms** and 2K was
  **608.223/818.918/854.339 ms**, 54 overlap frames each. All three jobs
  completed, but this is not full-cast or target-device performance.
  Architectural costs remain: procedural CPU source raster, multiple full
  384×216 field texture uploads and full-viewport BackBufferCopy per cast;
  this does not prove the CI renderer alone caused the whole delay.
- Active #20 collision post and real overworld viewer were present before
  AppFlow opened Home; [JOIN 41217063693](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41217063693)
  passed removal, weak-reference cleanup and frozen-Home stability assertions
  at `39db0ff0`. This is an isolated historical-A0 scene transition, not a
  complete death/despawn/production lifecycle test.

- A live #20 visual-motion probe at `a02d2d46` [41217365513](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41217365513)
  verified selected world direction and retained a nonhoming world transform
  while the actual player moved 6.40 units and the real enemy moved 12 units
  using test-driven `CharacterBody2D.move_and_collide`. HP remained 69→69;
  source tick 19, and cancel removed the viewer. The first natural-AI attempt
  [41217130242](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41217130242)
  failed because the enemy stayed still, not because the cast anchor shifted.
  This probe does not implement or prove a gameplay hit volume, moving-enemy
  miss, confirmed receipt, full cast or the current A0 route.

- At `f95b8a00`, C field uploads skip a texture only when authored activity
  says it was clear both before and now. Active-to-inactive clears once;
  unknown producers upload conservatively. Black ink remains an operation, not
  a brightness key. [Source regression 41217802586](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41217802586)
  passed the clear/write/clear/unknown sequence. Historical real-world JOIN
  [41217802768](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41217802768)
  passed at `f95b8a00`. The subsequent 4K [overlap job 41217825832](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41217825832)
  at `c2ac274b` sampled p50/p95/p99 **849.165/1101.219/1157.922 ms**,
  with 256,177,152 raw bytes sent to C field textures since cast start;
  ground uploaded once and A20 live-light atlas/index nine times. At 720p
  the same run measured **478.139/704.420/757.338 ms**, and at 2K
  **623.485/862.887/920.063 ms**; both were slower than the earlier run.
  Driver
  allocation, effective bandwidth and target-device cost are not measured.
  Comparing shared CI runs cannot establish a reliable performance gain.
  Source tick interval was not captured; `dec5fcf4` adds it for future probes.
- Disposable assembly now supports caller-supplied exact A0 and PR30 SHAs.
  [Current A0 no-AVFX entry probe 41218212859](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41218212859)
  at A0 `a6e37978`, AVFX `482de022` and PR30 `e505173e` failed, without
  mounting AVFX: `Function "_spawn_cell()" not found in base self` at
  `game/survival/a0_world_authority.gd:157`, followed by dependent
  `chapter1_overworld.gd` compile/instantiation and readiness failure. Import
  succeeded. A0 owner was notified directly
  [PR21](https://github.com/Khanh-glitch/Soul-of-Hero/pull/21#issuecomment-6545906989).
  No owner files were changed; historical normal-entry success does not
  constitute acceptance of the current runtime.

- Follow-up coverage-aware fragment activity at `f8d86501` avoids marking a
  clear fragment dirty for unrelated ink; black ink always marks the ink
  field, and overdraw of an actual fragment marks fragment coverage dirty.
  The intermediate `2bab675b` accidentally dropped the ink dirty bit and is
  invalid; it was corrected before acceptance. Source regression
  [41218563663](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41218563663),
  historical-world JOIN [41218563692](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41218563692)
  and all-20 lifecycle [41218563634](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41218563634)
  passed at `f8d86501`. These do not prove visual parity.
  New [overlap 41218563612](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41218563612)
  recorded #20 source ticks **23–463** at 720p and 2K, 256,177,152 raw
  C upload bytes, with p50/p95/p99 **489.845/713.600/754.724 ms** and
  **629.420/868.191/914.720 ms** respectively; 4K sampled ticks **24–464**
  at **881.643/1150.895/1196.608 ms**, with 254,899,200 raw upload bytes.
  Thus these frames span more than the opening, but do not include full OUT. The upload
  count was unchanged versus the preceding run in this sample. Do not treat
  either optimization as a demonstrated target-device win.

- Opt-in CPU wall-time phase instrumentation (`ARCANA20_PROFILE_CPU=1`) at
  `62476fa4` separately records C clear, authored raster, source-field packing,
  and world-viewer submission p50/p95/p99. It does not measure asynchronous GPU
  execution or target hardware. [Run 41219131053](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41219131053)
  failed because the probe's percentile helper was missing. Fix `4f00b5d6`
  passed [source](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41219318245),
  [world](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41219318271),
  [live](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41219318226),
  [all-20 lifecycle](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41219318304)
  and [three-resolution overlap](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41219318293).
  C raster p50/p95/p99 on 59 sampled frames was 241.803/414.451/498.013 ms
  (720p runner), 171.598/292.092/348.645 ms (2K runner), and
  117.124/200.050/241.283 ms (4K runner). These timings measure CPU wall time
  on different shared software hosts; they demonstrate substantial source
  raster cost but are not a controlled resolution comparison or GPU timings.
  Viewer texture submission p50 was 0.355–0.935 ms, asynchronous only.
- Candidate `9bd4df3f` keeps the exact valid contour positions in row-major
  order and visits only those samples, rather than scanning known-invalid
  pixels each rendered frame. The source-authored calculations and ordering
  are unchanged; there is an extra int32 index per valid sample in the static
  cache and each cast. Source comparisons, isolation, world regression and
  new CPU/overlap measurements must pass before describing a speedup.

- D's original ten-stage bright/blur chain and COMP shader now have an
  explicit-scene GPU producer (`DOriginalBloom`), **not yet mounted** on the
  SOH viewport. Original WebGL and native GPU were fed the identical original
  neutral-base scene and original actual GL uniforms. The full per-stage
  [diagnostic 41222553731](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41222553731)
  at `b7e4d2af` recorded bloomSmall RGB MAE **0.097–0.177/255**, max **5–9/255**;
  bloom2 MAE **0–0.109/255**, max **0–1/255**; post MAE **0.052–0.227/255**,
  max **10/255** at ticks 72/192/312/489/510. The first bright stage still has
  local max **255/255** because source WebGL's 2:1 nearest samples land on
  texel boundaries and do not select the same neighbor consistently. The
  native shader uses the dominant observed selection, not proven bit-exact
  GPU rounding. Source geometry, real-world HUD/depth, post/full OUT and
  parity remain unresolved. Unmounted results are not acceptance.
- Sparse traversal source comparisons [41221651890](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41221651890),
  [polygons](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41221651906),
  [blocks](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41221651864),
  [particles](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41221651870),
  [early](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41221651982),
  [OUT](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41221651871),
  [JOIN](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41221651873)
  and [all-20 lifecycle](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41221651876)
  passed at `9bd4df3f`. The first controlled baseline comparison
  [41221988308](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41221988308)
  failed at tick 444 due to differing process-global particle seed counters;
  [41222306130](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41222306130)
  controlled the counters and matched every captured field at ticks
  108/270/390/444/510. Eight-sample p50 baseline→sparse was
  5.434→4.360, 206.108→205.573, 279.299→278.564,
  234.214→232.998, 96.424→95.585 ms on a shared CPU. The extra index
  costs **127,600 bytes per master and per cast**; target hardware remains
  unmeasured. At `815d3a40` float64 row-band hashes additionally reduce
  repeated work: [controlled run 41222515279](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41222515279)
  matched all fields and p50 baseline→new was 5.936→4.589,
  232.704→222.039, 321.551→312.704, 266.130→256.674,
  110.105→105.708 ms. Raster remains far too costly on this runner.
- `0a945024` adds a **62,208-byte per-cast float64** lattice-hash memo for
  source C noise with an out-of-range exact fallback and a direct float64
  equality regression. [Source quick 41222716458](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41222716458)
  and [historical JOIN 41222716378](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41222716378)
  passed. [Controlled source comparison 41222801681](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41222801681)
  matched fields through ticks 108/270/390/444/510/570/590/600. Eight alternating
  samples p50 baseline→optimized were **277.620→192.569 ms** (tick 270),
  **387.143→237.260** (390), **318.349→215.351** (444), and
  **131.910→91.275** (510), on one shared software CPU; repeated samples
  include warm-cache behavior. [720p/2K/4K overlap 41222716429](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41222716429)
  passed with ticks 23–463, but full-cast, source-native composite parity,
  GPU timing and target-device budget remain open. This is not visual approval.

- Fusion lifecycle fix `ec91610e`: a C05 source ends before its A05/shared
  timeline due to the authored offset. Previously the last C world texture
  and post state remained frozen until the entire cast finished. Each completed
  source family is now retired independently, while sibling and other-cast
  layers remain. [Historical JOIN 41223399432](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41223399432),
  [assertion triage 41223645326](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41223645326)
  passed C05 layer/post/legacy sprite cleanup with A05 and an independent C10
  still active. The same run captured C20 ticks 21/120/180/240/270/396/420/
  510/570/600 and passed a separate natural-end cleanup and no-damage check.
  Frozen-world visual captures are not source parity, moving-target hit/miss,
  or proof of current A0 readiness.
- `0c606912` replaces C `imul`'s 16-bit split with signed-int32 operands
  multiplied safely inside int64, preserving low 32 bits exactly. Source quick
  [41222994576](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41222994576)
  passed edge and 10,000 sampled identities against the former implementation;
  C05 and six C20 role comparisons at `12b2a04e` also passed. Controlled
  comparison [41223085300](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41223085300)
  uses the actual prior source and C20's direct prior math, matching all fields
  through tick 600; exact matched output and timing are limited to those ticks.
- A new six-catalog-relative-tick actual-overworld sweep `08eddd80` is queued;
  it records actual native duration and explicitly marks casts that terminate
  before a requested sample. It does not assert those ticks are the original
  authored phase boundaries or substitute for source-native comparisons.
- [All-20 historical-world phase sweep 41223761713](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41223761713)
  ran four five-skill batches at `08eddd80`; **PASS means captures completed and
  the frozen actual world restored, not all expected phases or parity**. It
  exposed shorter native than catalog timelines: #01 6.6/7.8 s, #06 8.4/8.8,
  #09 7.2/7.8, #11 7.2/8.2, #12 8.6/8.8, #13 8.4/9.4, #14 8.6/9.4,
  #16 8.0/10.2, #18 8.4/10.0; their late catalog-relative samples expired,
  and #16 also expired before its requested aftermath. These durations do not
  establish that the original selected source must be stretched; source OUT and
  fusion alignment must be individually investigated. C16 rules and B/C09
  selected primitives can be embedded in an A-owned source pass, so pass family
  alone does not establish their presence or fidelity. The same run identified
  B's `source_tick` reporting one tick behind due to floating-point floor;
  `7f6d6110` counts fixed updates directly without changing elapsed/render/event
  time, with [source quick regression 41224124206](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41224124206).
  Phase images have not been source-paired or approved; post is not enabled in
  this sweep, and no moving actor, damage, occlusion, target-device or dark-world
  conclusion is implied.
