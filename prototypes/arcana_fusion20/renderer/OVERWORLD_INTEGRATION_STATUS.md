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
- #09 `e0cae48d` adds an experimental A graph schedule with actual actor
  references, B ARC colors and C `bolt_pts`. Its native JOIN and source tests
  were still running when this document was written; no success is asserted.
  Legacy candidate remains separate. No effects engine mutates combat HP.
- Screen flash/shake, D full bloom/warp, A body integration, world lighting,
  post overlap policy, occlusion layers, target-device performance and all
  same-seed original-vs-native full-cast comparisons remain open. Experimental
  per-frame CPU packing is not a production renderer.

| ID | Current actual-world source status | Remaining / evidence |
|---|---|---|
| 01 | A/C field producers; paired source players still duplicate whole crown | Isolate selected geometry, A shimmer world and C flame, one shock/scar/ash, post, OUT |
| 02 | B world pass diagnostic | [run 41207915157](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41207915157), one frozen frame only |
| 03 | B world fields available | Actual-world comparison and lifecycle not checked |
| 04 | A world pass diagnostic; REDESIGN_CANDIDATE | [run 41208517991](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41208517991); no visual approval |
| 05 | A candidate fields available | Original A opening + C pillar/fall not integrated; one role owner |
| 06 | A candidate fields available; REDESIGN_CANDIDATE | Moving-tip sweep, water and full world review missing |
| 07 | C world fields available | Actual-world comparisons, occlusion, phases missing |
| 08 | B world fields available | Actual-world comparisons, post, gameplay missing |
| 09 | New A graph/B colors/C bolt candidate; native result pending | Real actors/misses/deaths, C branches, B raster, full source comparison |
| 10 | C world pass diagnostic | [run 41207915157](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41207915157), one frozen frame only |
| 11 | A candidate fields available | Original A rotor and full C #09 branching not integrated |
| 12 | A candidate fields available; REDESIGN_CANDIDATE | Targeting, source craft and world review missing |
| 13 | A candidate fields available; REDESIGN_CANDIDATE | Actor targeting, depth and world review missing |
| 14 | A candidate fields available; REDESIGN_CANDIDATE | Actor/colony integration and world review missing |
| 15 | C world fields available | Actual-world and moving-actor review missing |
| 16 | A candidate fields available | Original A growth and C palette/material not integrated |
| 17 | C world pass diagnostic incl. live-screen fragment mapping | [run 41207915157](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41207915157), one frozen frame only |
| 18 | A candidate fields available; REDESIGN_CANDIDATE | Real actors, full-cast and world review missing |
| 19 | D additive source fields + recorded bend descriptors | Actual D warp raster, bloom/post/OUT, native consumer and original parity missing |
| 20 | A candidate fields available | Original C rift and A real-world deformation not integrated |

Run-level pass does not override a failing check annotation. No thresholds have
been relaxed. Only CT owns `soh_binding/**`; no production mount, merge, fake
battlefield composition, visual approval, or damage authority is claimed.
