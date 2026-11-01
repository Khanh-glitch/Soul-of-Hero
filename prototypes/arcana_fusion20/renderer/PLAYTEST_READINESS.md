# ARCANA20 — playtest readiness (current summary)

**NOT PLAYTEST_READY.** All 20 are `VISUAL_NOT_VERIFIED`; no creator approval,
Gold approval or production merge. This is the concise current ledger; the
[world integration evidence](OVERWORLD_INTEGRATION_STATUS.md) contains detailed
historical methods, caveats and source-comparison references.

## R17 status and experimental build

**NOT PLAYTEST_READY.** The newest downloadable, visual-only build is
[Windows x64 + Linux x64 artifact 13084835609](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41308842474/artifacts/13084835609),
source `3bb43f3b6c27835e4ec32a1f67c38b436e4c5963`.
[Run 41308842474](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41308842474)
passed Linux real-route motion for [#14](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41308842474/artifacts/13084397189)
and [#18](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41308842474/artifacts/13085030225)
and Windows **headless** smoke. It is available for early feedback, not a
creator-approved build or a Windows GPU/display test. Its #11 is still an
unreadable white cloud at peak. #14's meandering hyphae have only been
inspected in selected native normal/dim frames; some links still look wire-like
and all art is unapproved. No genuine CT combat receipts are mounted.
The prior f58 build remains [available](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41301527667/artifacts/13081262251),
source `328d63336ae6705661f55b03271064c21bd642b7`.

The export uses A0 `04eacf62f1a3740a57e08691c3a9006d454aaa2c`, A6
`6b801554a6af95424b4e39dd29f43c146aa13848`, CT/PR30 files
`e505173edd119fdd955cf6249511b575a5468440`, A1 contract files
`2cb1a3c5f093724eb9fecbdf45909ccb611f7b32`, A3 contract files
`18e7afcbd576bbd9bfbcc509b2ee13216186a522`; A8 and the copied CT/R4
bridge are **not mounted**. The artifact contains the exact join manifest.

### R17 lightning review and remaining evidence

- #09's A graph now receives the live caster reference, fixing the measured
  85.443-world-unit origin detachment in the earlier capture. B-like two-color
  palette and C branching are candidates, not full original B/C parity. A new
  visual-test UI formation (`a74d7b2`, in the 3bb43f3 build) can spawn real
  Skeletons in a ring; [41303697476](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41303697476)
  exercised it with normal AI, seven moving enemies and both lights. The AI
  converges around the player and the sampled #09 still remains hard to read.
- #11 full-five-branch `d310436`, scaled `0ebc44b`, original-A-width `f58c2a8`
  and C-length-density `1039869` were rejected as visual closures. Native 1×
  tick 327 normal/dim [41301954960](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41301954960)
  shows the density candidate still white/cloudlike, worse than baseline. It
  distributes C's branches proportionally across A's many short connectors;
  this is a disclosed adaptation, not exact C/full-spell parity. Earlier f58
  native review is [41301516790](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41301516790).
  `f101aaf` is a new unverified experiment: restore A's actual bolt algorithm
  on the other moving connectors and assign C's five-branch channels to at most
  six deterministically ranked A bridges, based on C #09's six successful
  channels. The original C timing/graph is **not** reproduced by this mapping.
  C primitive/selection tests passed in 41309089962. Isolated A-only source
  restoration in [41309090038](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41309090038)
  compared full unmodified A fields at ticks 87/183/247/327: support IoU
  1.000/0.9966/0.9979/1.000, full-field RGB MAE 1.83e-8/2.38e-5/1.10e-5/8.03e-7;
  max error 0.000041/0.0964/0.0269/0.000206. It excludes source base/trail/post
  and is not fusion/world parity. Native normal/dim motion is still pending;
  this is not in the current download or an acceptance claim.
- Actual moving-world source-clock-retimed before/after videos, baseline vs
  1039869: [#09 normal](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41301955052/artifacts/13081387454),
  [#09 dim](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41301955052/artifacts/13082155888),
  [#11 normal](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41301955052/artifacts/13081143080),
  [#11 dim](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41301955052/artifacts/13081417326).
  Actors and cameras are independent between runs; the last observed source
  tick can lag presentation, so these are not presentation-fenced.
- [41301639958](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41301639958)
  has four genuine world captures and per-recorded-frame 2× comparisons of one
  selected original C channel, adapted native channel, actual palette/intensity
  native channel, and 1× world. It is not a full Gold fusion, C post/bloom or
  same-frame world-linear comparison; skipped frames are not invented.
- Full original C #09 source-pass reference versus full native source and actual
  1× world: [normal](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41304892316/artifacts/13083011496)
  and [dim](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41304892316/artifacts/13082946561).
  Each has 54 recorded frames, source ticks 7–431. Original C's spell is
  re-instantiated per recorded frame with live actor anchors mapped uniformly;
  its own graph, fixed waypoints, timing and deterministic-reseeded particles
  are not the A fusion or a continuous C gameplay cast. All C light, ink,
  ground, displacement/shade and stage commands are saved separately; empty
  source base and no C browser post mean this is **not Gold or world parity**.
  The world is not modified or composited with synthetic imagery; source panels
  are 2×, world 1×, and no interpolated world frames are invented.
- Full original A #11 rotor source versus full native A+C source and actual
  world at 54 recorded ticks: [normal](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41305186204/artifacts/13082792010)
  and [dim](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41305186204/artifacts/13083426541).
  Original A is the full unmodified source role, not a completed Gold A+C
  composite; its reference uses empty base/trail and excludes lab/post. Source
  HDR panels use the same disclosed x/(1+x) preview at 2×, native coverage is
  separate, world is unmodified 1×. Ticks may lag presentation and world HDR
  is not available. Original C remains a separately measured channel.
- A diagnostic-only, same-state source-field decomposition
  [41302275137](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41302275137)
  rerenders the rotor without connectors **only for measurement**, never as a
  displayed candidate. At tick 327 the original displayed fusion source field
  has RGB sums 49160/54295/67866; the rotor-only field is 5451/6343/8803,
  while the connector contribution is 43709/47953/59063, with 215 connector
  calls. Source maxima are 70.15/75.07/81.35 versus 8.91/10.03/12.31 without
  connectors. Unmodified original A #11 at that same tick has RGB sums
  51207/56676/70359 and maxima 72.49/79.42/95.44 in
  [41303344936](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41303344936).
  Thus accumulation is not merely extra branches, and the raw A source is
  brighter, not dimmer, at this point; arbitrary energy suppression would not
  establish source fidelity. None of these numbers is world-HDR, tonemap,
  depth, display-contrast or original full A+C Gold validation.

### R17 moving-world review and retention

[41302035437](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41302035437)
contains actual full-cast videos plus four native-scale phase details for
#01/#05/#16/#20 in normal and dim and #14/#18 in dim (source `328d633`).
Inspection of samples shows #20's rift and #16's flower, but does not prove
source or actor parity; #05's pale facets and #18's tiny stored marks need
motion/meaning review. #14's caps/spores are recognizable but its links look
like a geometric lattice. `2e0cb33` adds progressive side hyphae, but
native 1× details in [normal](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41303282363)
and [dim](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41303282388)
still read as a lattice; those additions are not a visual closure. `c2523b2`
adds curved links and clearer forks while preserving colony anchor contacts;
selected 1× frames in [normal](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41303812818)
and [dim](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41303812821)
look more organic but some links still read as wires. Full-motion and creator
review remain open. #18's sequence remains weak as capture/suspension/release,
with no real combat receipts. `c73adea` enlarges stored moments to source B's
0.42 clip transform and adds its four-vertex projectile head in the A raster;
clipping/order runtime checks passed in 41304136832. Normal/dim 1× snapshots
[41304404181](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41304404181)
and [41304404342](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41304404342)
still do not make stored events clear. `63bada3` tests small released projectile
heads traveling ahead of the shards toward a common impact. In the selected
[normal](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41305298174)
and [dim](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41305298106)
release phases the small pale heads do move toward the center, but the stored
actions remain hard to identify at world scale. This is a visual-only candidate,
not B raster/post parity, a genuine combat capture or creator approval.

The remaining four redesigns have real full-cast videos and native-scale phase
samples in [normal](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41303590845)
and [dim](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41303590819).
#04's older full-viewport blade [41304356189](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41304356189)
reads as a dark rectangular slab. `b6504d3` tapers the same single covered
blade to a point without glow camouflage; full-viewport review
[41305323215](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41305323215)
still looked slab-like. A narrower, longer-taper single blade is being tested;
it remains unapproved. #06's broad translucent ribbons need motion/meaning
review; #12's sampled glyph is partly outside the detail region.
#13's previous roots read as oversized straight black/green wires. `aa02f0b`
grows toward the contact anchors with shorter child branches. In the native
normal/dim samples [41304147187](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41304147187)
they spread less but still read as dark, angular wires. `8e1a9b8` uses opaque
seeded olive-brown bark rather than black cores; native normal/dim phase samples
[41304945469](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41304945469)
show more visible olive bodies, but the side branches are still angular and
full motion/creator acceptance remain open.
The phase-matched CPU job in 41303791337 exited 134 during current-project
import after historical baselines completed; the first fatal cause was not
exposed. A separate fresh-current source-only benchmark
[41304068554](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41304068554)
passed at `7da206c` in both art directions. For direction A, #14 at source
seconds 3.6/5.4/5.7 had p50 15.539/22.038/46.540 ms and #18 at 3.2/6.4/7.0
had 23.690/31.834/12.333 ms. This measures CPU source raster in CI, not a
successful rerun of the complete historical comparison, world/GPU or device FPS.

[41302085450](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41302085450)
compared fresh no-FX/FX processes on the real route, seven static Skeletons,
three start/cancels per round and a Home→overworld reload, for #09/#11/#14.
The [counter review](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41303222785)
found incremental per-round node/resource/texture/video-memory deltas of zero;
object delta +1 in both rounds. Incremental static bytes round 1/2 were
38121/5456 (#09), 51885/5456 (#11), 51861/5456 (#14). Cast WeakRefs cleared
on every cancel and old world/renderer WeakRefs cleared on scene change. These
are sampled engine counters including cache variation, not allocation tracing,
full natural-cast stress, a no-leak proof, or hardware GPU measurements.
Two earlier harness runs failed due lazy script typing and collection path,
not test failures hidden as passes.

### Earlier downloadable builds

**Earlier experimental visual-preview candidate:**
[Windows x64 + Linux x64 artifact 13080001982](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297739439/artifacts/13080001982),
source `b33e2da349daa066ebf8867a0c2319b7ab49c7a0`.
[Run 41297739439](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297739439)
completed successfully, including Linux real-route and same-run Windows
**headless** smoke. Full moving-world visual captures are
[#14](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297739439/artifacts/13079494508)
and [#18](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297739439/artifacts/13080480080).
The C lightning raster is included; all-20 moving-world lifecycle/capture jobs
including #09/#11 passed in [41297739352](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297739352),
with three real enemies per spell (seven for #09), natural finish, restart/
cancel and unchanged enemy HP. Current pre-narrowing R17 candidates also
passed the all-20 suite [41305402482](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41305402482),
source `ffecce687e146d20088560ffffd0ebc8b3ed4a18`. These are not complete visual review, genuine
combat receipts or source/post/actor-depth parity.
The build is visual-only, not a confirmed combat or Windows GPU test, and
**NOT PLAYTEST_READY**. All 20 remain `VISUAL_NOT_VERIFIED`.

**Previous temporal-echo preview:**
[Windows x64 + Linux x64 artifact 13079353974](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297412321/artifacts/13079353974),
source `a99916b42db9c9b99104f9d627ef4d21f08f8b03`.
[Run 41297412321](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297412321)
completed, including Linux real-route smoke, same-run Windows headless smoke,
and real-moving-world full visual captures for [#14](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297412321/artifacts/13079214539)
and [#18](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297412321/artifacts/13080147153).
The temporal echo markers are visual-only, not confirmed contacts. This build
predates the new C-bolt raster below, has no true receipts or target-hardware
performance, and is **NOT PLAYTEST_READY**. Art remains unapproved.

**Previous temporal-motion preview:**
[Windows x64 + Linux x64 artifact 13079428315](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297074032/artifacts/13079428315),
source `33df4c94daba5b4c24c3d1f682ab6e0e289f793e`, from successful
[run 41297074032](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297074032).
The Linux executable passed the actual route; Windows exercised the same route
headlessly. Real-moving-world full-cast videos are
[#14](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297074032/artifacts/13079089190)
and [#18](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297074032/artifacts/13079997057).
For #18 all three real Skeletons moved, 66 software frames were captured and
source tick 503 was last observed; source-frame tick may lag presentation.
The selected full-frame stills still do not make temporal causality obvious;
full motion has not been exhaustively reviewed. This build contains the visual
freeze/resume/echoes, but not the later visual-event markers. It is visual-only
and **NOT PLAYTEST_READY**; no receipts, device performance or art approval.

**Previous chronological-shard preview:**
[Windows x64 + Linux x64 artifact 13079547031](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41296591004/artifacts/13079547031),
source `4f5887db73dfd43a966acba85f8dfe13cf959736`, from completed successful
[run 41296591004](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41296591004).
Linux and the same-run Windows x64 executable passed the actual route smoke;
Windows ran **headlessly**, not on a display/GPU. #14 and #18 complete visual
casts ran in moving real world; videos/timelines are
[#14](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41296591004/artifacts/13079855881)
and [#18](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41296591004/artifacts/13079581291).
#18 had three moving Skeletons and 66 captured frames, last-observed tick 503;
the preview remains sparse software capture, not native 60 Hz. At one
full-frame midpoint the crystal contents are still hard to see. Lossless 1x
detail in [41296932483](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41296932483)
shows the brighter curved dot-trails inside the shards, but their meaning as
successive moments remains unclear. Its new chronological marks are experimental,
not B-source parity or creator approval. All 20 remain VISUAL_NOT_VERIFIED,
no CT receipts are mounted, and it is **not PLAYTEST_READY**.
The lossless timestamp inspection measured #14/#18 presentation intervals at
302.533/177.014 ms median and maximum PTS errors 0.493/0.497 ms; these are
software capture measurements, not hardware FPS.

**Previous experimental visual-preview candidate:**
[Windows x64 + Linux x64 artifact 13078684701](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41295327487/artifacts/13078684701),
source `e9008a58fd0cd7827a9a04006b6afbba5b17ab51`. The
[build and full-motion smoke run](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41295327487)
completed successfully: Linux and the same-run Windows x64 executable exercised
the real route; Windows used the **headless** backend. The new #14/#18 visuals
were captured on the real moving overworld, with three real Skeletons (at
least two independently moving), player/camera movement, natural completion
and restart/cancel. #14 had all three Skeletons moving and recorded 67
software-rendered frames and last-observed tick 511. Videos and
metadata are [#14](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41295327487/artifacts/13078473706)
and [#18](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41295327487/artifacts/13078383839).
They are sparse software captures, not 60-Hz or target-device evidence; the
last-observed source tick can lag the displayed state. An inspected #18
full-frame midpoint shows the larger crystals surrounding the actor, but their
stored moments still look mostly blank and do not establish temporal causality.
The complete videos have not been exhaustively human-reviewed. The build is
visual-only, does not bind CT receipts and is **not PLAYTEST_READY**.

[41296497754](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41296497754)
inspected actual encoded lossless videos against the captured timestamps. #14
has 67 captured frames, 20.602 s between first/last, median presentation
interval 307.960 ms; #18 has 66, 13.774 s, median interval 209.728 ms.
The lossless files have one deliberate final repeated frame and match the
recorded timestamps within 0.465/0.497 ms respectively. These timings include
software rendering and capture effects, not real-hardware frame rates.
Unscaled lossless-detail crops at the actual effect area show #14's cap, pale
stipe, connections and visible late spores; #18's internal event marks are
very faint. Full-frame context remains in the videos; these selected crops
are not full-motion approval. Inspection runs 41296426805 and 41296466869
failed because ffprobe was not installed; 41296497754 installed ffmpeg and
passed. No earlier timing claims were inferred from the failed attempts.

**Prior timestamp-corrected candidate:**
[Windows x64 + Linux x64 artifact 13078977612](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294874261/artifacts/13078977612),
source `924dc2522f9776d570c6e91118766d5fdc040fc4`;
[run 41294874261](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294874261)
completed successfully. The exported Linux and same-run Windows executables
passed the real-route smoke; Windows ran **headlessly**, not on a GPU/display.
Full moving-world captures are [#14](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294874261/artifacts/13078493198)
and [#18](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294874261/artifacts/13079165311):
three real Skeletons moved for each, with player/camera motion, natural
finish, restart/cancel and no combat receipts. 67/66 frames were captured;
source ticks 511/503 were last observed. Software rendering skipped visual
frames, so this is not 60-Hz playback or target-hardware performance. The
capture now timestamps `frame_post_draw` before PNG I/O, while the reported
source tick is only the last signal observed and can lag the displayed state.
Complete video visual review is still outstanding. The newer #14/#18 art edits
below are **not included** in this build. It is not playtest-ready.

**Last fully smoke-tested creator visual-preview candidate:** [Windows x64 + Linux x64 artifact
13078327548](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294519115/artifacts/13078327548),
source `aa897d8d7892efb61f8b574021b75f057d8576b2`,
[run 41294519115](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294519115).
It includes the Vietnamese guide and exact join manifest. Linux ran real-route
smoke; the exported Windows application ran the same smoke on a Windows Actions
runner **headlessly**. Full live #14/#18 captures with three real moving
Skeletons, player and camera passed and are available as
[#14 video + timeline](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294519115/artifacts/13079130370)
and [#18 video + timeline](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294519115/artifacts/13078122964).
These are visual-only, software-rendered captures, not GPU presentation, real
combat or target-hardware performance. **Capture timestamp caveat:** this
revision recorded wall time after each PNG was encoded, so variable write
latency is assigned to that frame rather than its actual presentation instant.
The source-tick metadata is the last observed signal, not necessarily the exact
tick of the presented frame. The `924dc25` correction timestamps `frame_post_draw`
before PNG I/O; its replacement captures are linked above. All 20 remain
`VISUAL_NOT_VERIFIED` and this candidate is **not PLAYTEST_READY**. Artifact
retention is 14 days.

**Prior rollback executable:** [Windows x64 + Linux x64 artifact 13077879778](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293811919/artifacts/13077879778),
[run 41293811919](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293811919),
source `3373c7a39a19d576be8ead42abfa5b24d32f567e`. Linux and
Windows binaries passed real-route smoke; the Windows run is **headless**,
not GPU/presentation or real-device performance. The additional art and
multi-enemy test changes on later commits are **not in this executable**.
Visual-only; no combat receipts, creator approval, or PLAYTEST_READY claim.

**Earlier R16 preview:** [Windows x64 + Linux x64 artifact
13078291976](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293502803/artifacts/13078291976),
run [41293502803](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293502803),
source `8f102d2687c0c10abb18ac40f741d0cc08e1c5a2`. It has the same owner pins
listed below and includes the newer #14/#18 working designs. The exported Linux
application passed the real-route start/cancel smoke; the same-run Windows x64
binary passed that smoke on a Windows Actions runner **headlessly**. The build
is still visual-only, `VISUAL_NOT_VERIFIED` and **not PLAYTEST_READY**; no
Windows presentation/GPU, confirmed combat or target-hardware performance test.
The following older artifact remains the rollback/early-feedback build.

[Windows x64 + Linux x64 experimental artifact (14-day retention)](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41290366274/artifacts/13077490714).
It is **not** a playtest-ready build. Run
[41290366274](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41290366274)
exported both platforms and launched the **Linux** binary through the actual
AppRoot → New Game → Home → Chapter1Overworld route. Smoke verified real
player movement, real Skeleton spawn, start/cancel for all 20 slots, #10+#17
overlap, world-tint toggle and unchanged test-enemy HP. The same Windows
rollback executable also ran that route and smoke on a native Windows Actions
runner in [41293267800](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293267800),
using Godot's **headless** backend. This is not a Windows GPU/presentation or
target-hardware test. These quick starts are not complete cast motion, real
combat, performance or quality validation. The artifact
contains the manifest and [Vietnamese controls](playtest/HUONG_DAN_THU_NGHIEM.txt).
The wrapper's cast buttons deliberately produce visuals only, **no combat hit**.
The default #14/#18 art direction is A; B alternatives are experimental.

Build source SHA `c295879b5e5e10b1eeb103b7e1abf603d97b4b83`. It
assembles the real A0 overworld `04eacf62f1a3740a57e08691c3a9006d454aaa2c`,
A6 UI overlay `6b801554a6af95424b4e39dd29f43c146aa13848`, AVFX renderer,
and CT files `e505173edd119fdd955cf6249511b575a5468440`. A1
`2cb1a3c5f093724eb9fecbdf45909ccb611f7b32` and A3
`18e7afcbd576bbd9bfbcc509b2ee13216186a522` are contract files only; A8 is
not mounted. **The wrapper does not mount the copied R4/CT receipt bridge** and
cannot produce or consume a confirmed skill hit. Owner-head observations are
not claims of combined runtime validation. A0 04e had a narrow no-FX/entry
validation, not full campaign acceptance.


## R16 live-motion pilot (not accepted as complete evidence)

[41293267800](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293267800)
ran #10 and #14 to natural finish on the exported Linux application, with
actual player input, Skeleton AI, and follow camera, then restarted/cancelled
and checked viewer/post cleanup and unchanged enemy HP. #10 observed tick 439
and 58 captured frames, player/enemy/camera displacement 94.57/125.96/94.98;
#14 observed tick 511 and 67 frames, displacement 85.01/129.64/84.95. The
source simulation advanced more ticks than the software-rendered frames: this
is not native 60 FPS or complete per-tick visual review. Capture I/O and software
CI produced wall-frame p50/p95 204.76/346.43 ms (#10) and 310.35/360.83 ms
(#14), not device performance. **Both video-encoding steps failed**: the
workflow looked for timeline files only in the requested user-dir; the failure
was not conclusively diagnosed from the inaccessible log. The artifacts therefore do not retain the images or
video. A follow-up locates and retains the capture by searching the actual user
data roots; its result is pending. These observations are no visual approval,
combat verification, overlap test, or all-20 coverage. The live pilot also
logged the existing five-resource shutdown warning and player disconnect errors;
separate AVFX versus no-FX leak attribution is still required.

The new #14 cap/stipe/gill material and #18 clipped stored-event miniatures are
unverified working candidates, not creator-approved or complete B-source/post
parity. Previous native images in the art section below show the earlier
candidate, not those new shapes.

The follow-up [41293502803](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293502803)
**passed all three actual-motion capture jobs**, produced native FFV1, MP4 and
per-frame timestamps, and uploaded [#10](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293502803/artifacts/13078311296),
[#14](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293502803/artifacts/13078347175)
and [#18](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293502803/artifacts/13078506862).
The real user data folder differed from the requested command-line path; the
new search found the frames. #10/#14/#18 recorded 64/67/66 rendered frames
and last observed source ticks 443/511/503. These are actual software-rendered
frames over the complete runtime, not one image per 60 Hz simulation tick.
All three had moving real actors/camera and natural completion plus restart/
cancel cleanup. Two full-frame preview stills and one center 1x crop per
skill were inspected, **not the complete videos**. In those stills #10 is
small and easy to lose as the camera moves; #14's brighter caps are more
contrasting but clusters still read as green trees, not an unmistakable fungal
outbreak; #18's small blue crystals move away from the actors, and their stored
moments and temporal causality remain difficult to read. The panel covers a
large part of the frame in these three captures; the next harness hides it as
F4 would. These are actionable visual failures, not creator approval. A later
all-20 capture and matched no-cast/leak/overlap measurement are pending.

The more recent run [41293811919](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293811919)
recorded all 20 full natural visual timelines in independent live jobs, with
one real, AI-moving Skeleton, real movement and camera, no fabricated damage,
normal finish, restart/cancel and viewer/post cleanup. It retained native-size
lossless/MP4 gameplay videos and timestamps per skill. The recorded wall times include PNG-write completion latency, not exact
presentation timestamps. The rendered frames are sparse on software CI (for example #05 had 67 frames over its cast and a
capture-included wall-frame p50/p95 of 917/1583 ms): they are not 60-Hz motion,
GPU profiles or target-device FPS. The single-enemy #09 image cannot validate
its multi-target chain; a subsequent multi-enemy run is recorded below. Three
natural overlap sessions #10+#17, #14+#18 and #18+#10 also completed (separate
noncapturing measurements), but do not establish source parity or all overlap
pairs. No full video has been exhaustively human-reviewed. Selected full-frame
normal-scale stills for the six redesigns were inspected: #04 is a thin line
followed by detached dark rupture fragments; #06 has a readable water crescent
but its writing is unclear; #12 is sparse/pale; #13 remains tangled/wire-like;
#14 still reads as small trees; #18 looks like five small hexagons without
clear temporal contents. None is accepted. The later purple-cap and sharper
stored-event revision `7a74a7e2b8b9b2745e91b19214fa87941b6f44af` is included
in the current candidate; full-frame and native 1x selected frozen-world stills
[41294277111](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294277111)
and [41294485137](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294485137)
show more contrasting caps, but the colonies still read largely tree-like. Two
selected full-viewport stills from each current live #14/#18 capture similarly
show small clusters and mostly blank-looking crystals; the temporal cause is
not clearly readable. The 516/504 native source-tick frozen-world videos in
41294277111 passed capture in normal/dim light, but have not been fully
human-reviewed. Neither art change is approved or established as finished.

The follow-up [41294225391](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294225391)
completed **all 20** independent full-timeline gameplay captures with three
real Skeletons per spell (seven for #09), real player input and camera, at
least two independently moving enemies, natural finish, restart/cancel and
viewer/post cleanup; the visual casts did not change enemy HP. Its exported
source was `4eaf7f36c36fdbaa24d252086f79b8c03b8cd940`, **before** the later
#14/#18 color/temporal refinements. #09 observed all seven enemies moving and
zero unbound source-contact events; its two selected full-frame stills still
make the lightning difficult to see. These are runtime/lifecycle observations,
not full video review, elected-source parity, body reactions or true receipts.
The videos from this run also timestamped after PNG encoding and therefore do
not preserve exact frame presentation intervals. Three additional no-capture
overlap runs also passed in this multi-actor setup.
The `aa897d8` build's #14/#18 full casts above cover that later art in live motion,
but the remaining 18 captures are from the earlier exact SHA.

The timestamp-corrected all-20 rerun [41294874230](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294874230)
completed successfully at `924dc2522f9776d570c6e91118766d5fdc040fc4`.
It retained separate live-motion artifacts for all 20 with three real moving
Skeletons (seven for #09), player/camera movement, natural finish, restart and
cancel, and unchanged enemy HP. The #09 [video + timeline](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294874230/artifacts/13078279711)
contains 57 captured frames, last-observed tick 431, all seven enemies moving,
and zero unbound source-contact events. All captures remain sparse, software
rendered and not comprehensively visually reviewed. Three overlap sessions and
Windows headless smoke also passed. The later art edits below are not in this
run; success is not parity, a hit receipt, or creator acceptance.

Subsequent **unreviewed redesign candidates**: `75b44c5106020be85b474a961746e57dab95b62e`
changes the #14 A clusters from tall stacked branching shapes to shorter,
broader cap-and-stipe clusters and enlarges the spores. Frozen-world capture jobs (including a completed normal-A still job)
are in [41294992386](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294992386).
`cfae6b1` arranges the five #18 A stored-event shards around the shared impact,
with larger crystal windows; [41295029499](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41295029499) passed source-runtime and CPU benchmark, but not art review. A normal-light 1x crop of the #14 colony beat from
[41295231056](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41295231056)
shows low purple caps, but they read as thin parallel slats over dark green
stems rather than a convincing outbreak. Follow-up `e9008a58fd0cd7827a9a04006b6afbba5b17ab51`
gives the caps a deeper rounded profile; [41295327463](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41295327463)
completed all frozen normal/dim full-motion and still captures, and
[41295327487](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41295327487)
completed the latest build and real-moving-world #14/#18 capture above. The
source event runtime and historical parity/CPU diagnostics
[41295327512](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41295327512)
also passed; these checks do not establish art or full-source fidelity. Native
1x normal-light colony still from [41296331303](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41296331303)
shows the deeper purple caps as much more recognizable mushroom profiles than
the preceding slats; the clusters still appear small, and the still does not
establish a convincing growing/sporulating outbreak throughout motion. The
#18 mid-cast full view still shows largely blank crystal interiors. The two
complete videos have not been exhaustively reviewed; no art is creator-approved.
Follow-up `4f5887db73dfd43a966acba85f8dfe13cf959736` makes #18's five
stored moments chronological with brighter, larger clipped marks; this is an
intentional redesign adaptation, not B-source parity. Its build
[41296591004](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41296591004)
and frozen-motion captures [41296590948](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41296590948)
completed the build and live capture; the frozen normal/dim motion run is in progress.
`3dc4713193f120eae6fbb56b697637957b40af7c` adds a constant-backed sequence
and checks ascending capture/reverse convergence; both A/B source-runtime
and historical parity/CPU jobs in [41296611649](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41296611649)
passed. The sequence is in the `4f5887d` build above; the later test refactor
is not. Source runtime and visual samples are not visual approval.

A further unverified #18 revision `33df4c94daba5b4c24c3d1f682ab6e0e289f793e`
adapts the original B source attack's projectile star/trail and early forward
and reverse echoes onto the real scene, alongside a central freeze-and-resume
trajectory ending at the 6.2-second synchronization. This adds visible temporal
cause/effect rather than relying only on tiny crystal interiors. It is a
redesign adaptation, not full B parity; there are no fabricated damage claims.
`4ed03a4215daf51b606f7934bb490353243e6989` additionally exposes the two echo
beats as visual-only events, not confirmed contacts. Runtime regression
[41297109728](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297109728),
preview [41297074032](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297074032)
and frozen motion [41297073989](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297073989)
finished the 33df4c9 preview above; frozen motion remains in progress.
The 4ed03a4 source-runtime, including freeze/release/event assertions, passed,
but its independent historical CPU-benchmark job aborted with exit 134 during
optimized-project import before comparison; cause unknown. The diagnostic rerun
[41297306491](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297306491)
passed both source-runtime and historical parity/CPU jobs at `0a97283`. The
33df4c9 preview does not contain later visual-event markers; neither revision
is approved. The subsequent `a99916b` build including those markers is linked above.
A 16-beat sampled full-viewport frozen-world timeline from [41297464510](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297464510)
shows crystals forming, brightening, converging and shattering; the actual
attack/causal direction remains hard to read at normal scale. This is sparse
inspection of a frozen-world video, not complete review or moving-world approval.

**#09 / #11 C bolt raster:** `8873fa863f790a5ee803ae16261d7862d88609d9`
replaces the A streak approximation for selected C-style bolts with the C
`drawBolt`/ribbon pixel-visit and core/halo raster directed to A's additive
field. The A chain schedule, real actor anchors, B palette and A rotor remain;
full C channel timing, scene/post and contact fidelity are not claimed.
[41297668036](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297668036)
compared 791 affected common-domain pixels bit-exactly against actual CFrame
for four representative overlapping/reveal/boundary strokes (plus a subpixel
case), including influence tracking. First attempt [41297576511](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297576511)
failed because its test used A's 416-pixel row stride for C's 384-pixel
frame; `82e4d47` corrected coordinates without changing thresholds. The
larger A field is intentionally not clipped to C's 384x216 demo extent.
This primitive test is not a full spell/fusion parity proof. The latest creator
build above includes it; [41297739352](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297739352)
completed the all-20 moving-world capture. #09 had seven real moving Skeletons,
57 captured frames, last-observed tick 431 and zero unbound source contacts;
[#09 video](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297739352/artifacts/13080078009),
[#11 video](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41297739352/artifacts/13079967160).
In selected full-frame and 1x lossless crops from
[41298024637](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41298024637),
#09's long link is still very faint and washed-out; #11 shows a bright complex
rotor but the bolt branching is hard to distinguish. Neither visual is
approved. #09/#11 recorded median software-capture intervals 323.658/421.224 ms;
encoded lossless PTS differed from recorded times by at most 0.496/0.498 ms.
This is capture overhead and shared software rendering, not target hardware FPS.
The three same-run no-FX/single/overlap shutdown comparisons each printed 17
instance and 5 resource lines; equal counts are not a proof of no AVFX leaks.

[41293811919](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293811919)
also compared complete no-PNG-I/O casts/overlap with fresh same-duration
no-cast wrapper sessions (which still mount the empty AVFX wrapper). For
#10, baseline/single/#10+#17 wall-frame p50/p95 were
59.17/64.96, 111.38/239.86 and 190.52/380.38 ms. For #14, baseline/single/
#14+#18 were 62.30/69.02, 207.36/245.57 and 348.71/432.46 ms. For #18,
baseline/single/#18+#10 were 68.37/74.23, 191.79/231.97 and 230.14/362.70 ms.
Different live movement/AI and shared software CI make these approximate, not
matched render-phase comparisons or hardware FPS. In all three cases verbose
shutdown recorded 17 ObjectDB lines and 5 resource lines in each variant.
[41294138791](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294138791)
compared ID-normalized leak text and the five survival/economy resource paths;
the printed lines matched each no-cast baseline. Equal diagnostics do **not**
prove zero AVFX leaks or rule out different instances, long-session retention,
or native/GPU memory leaks. Player tree-entered/tree-exiting disconnect errors
also remain for A0/AppFlow owner investigation.

An [isolated provisional AVFX receipt relay](owner_adapters/README.md) and
synthetic fixture tests [41294102470](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294102470)
are **unmounted**. The decoder must come from CT; this cannot authenticate
receipts, provide owner lifecycle/replay policy, or establish real combat.

The `8f102d2` source-event smoke passed, but its phase-benchmark job
[41293502840](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293502840)
failed because it compared an intentionally changed redesign against the
pre-optimization image hashes. The optimization equality proof is now pinned
to its exact historical before/after revisions, while current art is measured
separately; [41293811953](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293811953)
passed the unchanged six-field equality checks in both A/B directions. This is
not a relaxed image-parity threshold or proof of current art parity. A later benchmark run
[41294277027](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294277027)
exited 134 before reporting the current benchmark; original logs were not
surfaced. Subsequent reruns [41294411877](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294411877)
and [41294429733](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294429733)
passed. The earlier abort's cause remains unknown.

## Source-role and visual status

All rows are partial candidates, not completed source roles; full visual motion has not been exhaustively
reviewed, and actor/terrain depth, confirmed gameplay and creator approval
remain unverified.
The six NEW entries are redesigns, not rejected-source ports. Common GPU/device
performance is unverified. All 20 completed the multi-actor visual timeline diagnostic above at the
stated earlier SHA; this does not establish complete source roles or gameplay
combat.

| ID | Decision | Executable role / specific remaining blocker |
|---:|---|---|
| 01 | A+C | A crown + selected C outer flame; full fusion/post and depth unverified. |
| 02 | B | B wyrm source runtime; full world/post and body contact unverified. |
| 03 | B | B meteor runtime; per-impact actual gameplay and OUT unverified. |
| 04 | NEW | Single dark-metal diagonal blade + linked wound; earlier full view was slab-like, tapered-point candidate still needs full motion and creator review. |
| 05 | A+C | A opening + C late water candidate; full source composition and real wet/body response unverified. |
| 06 | NEW | A ribbon/foam adaptation, glyph and wave; C physical writing and full motion remain incomplete. |
| 07 | C | C source and local ice effects; world/actor ordering, post and full parity open. |
| 08 | B | B vortex source; real-world depth, pull authority and OUT open. |
| 09 | A+B+C | A graph follows explicit live caster/targets; B-like two-color and C branching are partial candidates, full source/world contrast and contact binding remain open. |
| 10 | C | C source; viewport-aligned stage fix, overlap/cancel tested; actor/post ordering and natural targets open. |
| 11 | A+C09 | A rotor + adapted C09 channels follow source connectors; tick-327 native output remains an overexposed cloud; full fusion/world contrast open. |
| 12 | NEW | Glyph + actual C bolt geometry via A raster; complete C craft, rhythm and visual quality open. |
| 13 | NEW | Bark is more visible in native samples; shorter side branches still look angular/wire-like, no creator approval. |
| 14 | NEW | Caps, spores and curved/forked links are visible in normal/dim phase samples; full motion, actor status and creator review open. |
| 15 | C | C thorn source with local shade; full world/actor/post parity open. |
| 16 | A+C | A growth, selected C organism/material/debris; complete C environment and fusion/OUT parity open. |
| 17 | C | C stage blackout/light; overlapping post/cancel tested, actor/source ordering open. |
| 18 | NEW | B-inspired frozen moments remain visually ambiguous; new projectile-release cue unreviewed, B post and real receipt/body reaction open. |
| 19 | D+A combat | D partial geometry/warp, separate OUT study; D core, bloom/linear pre-HUD post and actual A receipt binding missing. |
| 20 | A+C | C rift + partial A world warp/debris; full source fusion and real hit/miss/occlusion remain open. |

## Art direction and review

Earlier #14 A clusters formed an outbreak; B upright cups read more like isolated
umbrellas. #18 A pointed fragments read as a shatter; B broad fragments and
dial read as a tidy ring. Selected **internal working direction A only**, not
creator acceptance: inspection was of selected full-viewport downscaled stills
([#14](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41287797853),
[#18 revised](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41288055318)),
not full-motion review. Follow-up unscaled 384×216 detail crops, taken from
the full-viewport motion files, were inspected at three beats in both lights
[41289179652](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41289179652):
#14 clusters are larger but read as leafy trees, with little perceived
sporulation; #18's shards are more substantial but temporal capture remains
unclear. Later `69719b1` adds gill undersides; selected 1× crop inspection
[41289591285](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41289591285)
still looks largely tree-like. Crops do not replace the full-frame videos,
and none of these checks establishes creator acceptance. Full native 60-Hz before/after motion capture
[41288691508](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41288691508)
completed 8 jobs: baseline `ffbcbdd7ec7974bb2529fb230cb0d492286b1093`
vs candidate `1066d36ad74331fd30e766b3dd53f7a982eb5e98`, normal/dim,
516 #14 and 504 #18 frames per job, FFV1 and MP4. The later `69719b1` refines #14 cap undersides and wrapper controls;
updated native motion for those sources completed
[41289638142](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41289638142).
The build also contains the later solid-color raster optimization. Twelve
selected source-field hashes match pre-optimization across A/B, not a
full-lifecycle equivalence proof. These
are frozen-world frames, not full-motion human review or gameplay proof. The
prior [41288595150](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41288595150)
failed in the capture step; after a harness-indentation correction the new run
passed, but the original failure's full log was not locally accessible. All
8 new motion jobs report **5 resources still in use at exit**; the diagnostic
also prints PASS. Baseline and candidate both show the warning, but its cause
and any AVFX contribution are not established. Long-session leak behavior is
not cleared. No-FX and #18 diagnostics
[41289131356](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41289131356)
both reported 17 ObjectDB instances at exit; the no-FX path also reported
five resources. This reproduces a baseline leak warning, but does not absolve
AVFX of independent leaks. Updated build smoke and alternate-source runtime
[41289298200](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41289298200)
passed; the 20-skill lifecycle/source-field gate
[41290028830](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41290028830)
passed at `146d668` after the raster change.

Earlier full-motion evidence: #04 [41277778594](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41277778594)
480 ticks/light; #10 [41277330808](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41277330808)
444 ticks/light. They use frozen or scripted actors, not owner receipts; all
frames have not been individually inspected. Native component comparisons are
linked in the detailed ledger, including #11 rotor
[41211833178](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41211833178)
and #16 selected layers [41242339621](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41242339621).

## Hard blockers / measurements

* CT owns same-frame linear/HDR pre-HUD world input and composition order, plus
  immutable confirmed hit/miss/block receipts and target lifecycle integration;
  [contract request](https://github.com/Khanh-glitch/Soul-of-Hero/pull/30#issuecomment-6553822213).
  The frozen D prototype overexposes a tone-mapped world; do not integrate it as final.
* Source parity, full visual motion, genuine combat, moving-target/obstacle
  occlusion, camera/resize, transitions, long-session cleanup and six redesigns
  remain incomplete. Do not present diagnostics as gameplay evidence.
* Phase-matched headless CPU source raster
  [41290129725](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41290129725)
  compared `69719b1` against `146d668` plus the test-only benchmark. At six
  static times in both art directions all color/coverage/multiplier/warp/
  influence hashes match. Direction A #14 t=5.7 median/p95 was
  **34.562/35.075 → 33.820/34.123 ms**, #18 t=6.4 **20.308/20.692 →
  19.927/20.230 ms** (10 timed draws after one warmup, same CI host). The
  small improvement does not meet a 60-FPS budget and is not full-frame/GPU
  or device performance; update history is not simulated.
* Software-only #10 comparisons [41275419647](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41275419647)
  and overlap [41275419532](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41275419532)
  were not phase matched; they are not hardware FPS or GPU timings. No target
  machine, sustained 60-FPS result, GPU breakdown or production memory budget
  has been verified.
