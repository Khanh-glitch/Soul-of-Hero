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
| 09 | New A graph/B colors/C bolt candidate; one moving-real-skeleton diagnostic | [run 41208565813](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41208565813); misses/deaths, C branches, B raster, full source comparison |
| 10 | C world pass diagnostic | [run 41207915157](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41207915157), one frozen frame only |
| 11 | A candidate fields available | Original A rotor and full C #09 branching not integrated |
| 12 | A candidate fields available; REDESIGN_CANDIDATE | Targeting, source craft and world review missing |
| 13 | A candidate fields available; REDESIGN_CANDIDATE | Actor targeting, depth and world review missing |
| 14 | A candidate fields available; REDESIGN_CANDIDATE | Actor/colony integration and world review missing |
| 15 | C world fields available | Actual-world and moving-actor review missing |
| 16 | A growth + C material; [original source samples 41210844049](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41210844049), [real-world sample 41210774544](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41210774544) | C material parity, full world cast/OUT and owner review |
| 17 | C world pass diagnostic incl. live-screen fragment mapping | [run 41207915157](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41207915157), one frozen frame only |
| 18 | A candidate fields available; REDESIGN_CANDIDATE | Real actors, full-cast and world review missing |
| 19 | D additive and persistent warp consumer, frozen-world/cancel [JOIN 41209511506](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41209511506) | D bloom/post, OUT review, depth and original parity missing |
| 20 | C seeded contour + A real-world pull candidate `93256c98` | GPU/world test pending; polygons, blocks, particles, OUT and parity missing |

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
whole world cast and selected C-material source comparison remain pending. The earlier all-20 sweep at `c6fb12ba` exercised the older #16
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
and exact frozen-world restoration. Idle/HUD-pixel regression is running.
The consumer is NOT automatically mounted, lacks original multiscale bloom,
uses an experimental overlap policy, and desaturates the composed scene rather
than source-C's pre-ink ground. It needs human visual/contamination review.

At `93256c98`, opt-in #20 selects C's seeded rift contour, timing/edges and
interior with a phase-aligned A bgWarp pull/stretch on that same real world;
source-C inverted fragments explicitly sample the live world. This replaces
neither legacy source nor approved systems. [Source-field quick 41211236215](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211236215)
verified ink, inverted live fragments and displacement exist; real-world
contamination/cancel is pending. Original C polygons/blocks/particles and A
debris remain missing, as do source parity, OUT and visual approval. The
all-20 sweep at `c6fb12ba` exercised the older #20 candidate.
