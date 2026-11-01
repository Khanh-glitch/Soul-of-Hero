# ARCANA20 — playtest readiness (current summary)

**NOT PLAYTEST_READY.** All 20 are `VISUAL_NOT_VERIFIED`; no creator approval,
Gold approval or production merge. This is the concise current ledger; the
[world integration evidence](OVERWORLD_INTEGRATION_STATUS.md) contains detailed
historical methods, caveats and source-comparison references.

## Experimental downloadable build

**Newer visual-preview candidate:** [Windows x64 + Linux x64 artifact
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

The `8f102d2` source-event smoke passed, but its phase-benchmark job
[41293502840](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41293502840)
failed because it compared an intentionally changed redesign against the
pre-optimization image hashes. The optimization equality proof is being pinned
to its exact historical before/after revisions, while current art is measured
separately; this is not a relaxed image-parity threshold.

## Source-role and visual status

All rows are partial candidates, not completed source roles; none has verified
full-motion, actor/terrain depth, real confirmed gameplay or creator approval.
The six NEW entries are redesigns, not rejected-source ports. Common GPU/device
performance is unverified. The renderer can start all 20 in the experimental
wrapper, but the quick smoke does not establish full life-cycle gameplay.

| ID | Decision | Executable role / specific remaining blocker |
|---:|---|---|
| 01 | A+C | A crown + selected C outer flame; full fusion/post and depth unverified. |
| 02 | B | B wyrm source runtime; full world/post and body contact unverified. |
| 03 | B | B meteor runtime; per-impact actual gameplay and OUT unverified. |
| 04 | NEW | Diagonal blade and linked wound candidate; dim wound and complete motion quality remain weak. |
| 05 | A+C | A opening + C late water candidate; full source composition and real wet/body response unverified. |
| 06 | NEW | A ribbon/foam adaptation, glyph and wave; C physical writing and full motion remain incomplete. |
| 07 | C | C source and local ice effects; world/actor ordering, post and full parity open. |
| 08 | B | B vortex source; real-world depth, pull authority and OUT open. |
| 09 | A+B+C | A actor graph, B-like two-color palette, C bolt-tree; original B/C raster/complete timing not evidenced. |
| 10 | C | C source; viewport-aligned stage fix, overlap/cancel tested; actor/post ordering and natural targets open. |
| 11 | A+C09 | A rotor + C bolt tree; original C raster, live connectors and full fusion review open. |
| 12 | NEW | Glyph + actual C bolt geometry via A raster; complete C craft, rhythm and visual quality open. |
| 13 | NEW | Target-root choreography with thicker barbs; selected snap still wire-like at gameplay scale. |
| 14 | NEW | Fungal growth/propagation with two new candidate architectures; visual motion, spores and actor status open. |
| 15 | C | C thorn source with local shade; full world/actor/post parity open. |
| 16 | A+C | A growth, selected C organism/material/debris; complete C environment and fusion/OUT parity open. |
| 17 | C | C stage blackout/light; overlapping post/cancel tested, actor/source ordering open. |
| 18 | NEW | B-inspired frames and retimed impact, two shatter directions; B miniature contents/post, motion and body reaction open. |
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
