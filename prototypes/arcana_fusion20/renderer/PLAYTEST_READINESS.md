# ARCANA20 — playtest readiness (current summary)

**NOT PLAYTEST_READY.** All 20 are `VISUAL_NOT_VERIFIED`; no creator approval,
Gold approval or production merge. This is the concise current ledger; the
[world integration evidence](OVERWORLD_INTEGRATION_STATUS.md) contains detailed
historical methods, caveats and source-comparison references.

## Experimental downloadable build

[Windows x64 + Linux x64 experimental artifact (14-day retention)](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41288055352/artifacts/13075849396).
It is **not** a playtest-ready build. Run
[41288055352](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41288055352)
exported both platforms and launched the **Linux** binary through the actual
AppRoot → New Game → Home → Chapter1Overworld route. Smoke verified real
player movement, real Skeleton spawn, start/cancel for all 20 slots, #10+#17
overlap, world-tint toggle and unchanged test-enemy HP. Windows was exported
but has **not** been launched on Windows. These quick starts are not complete
cast motion, real combat, performance or quality validation. The artifact
contains the manifest and [Vietnamese controls](playtest/HUONG_DAN_THU_NGHIEM.txt).
The wrapper's cast buttons deliberately produce visuals only, **no combat hit**.
The default #14/#18 art direction is A; B alternatives are experimental.

Build source SHA `3b45a5c` (see build artifact manifest for full SHA). It
assembles the real A0 overworld `04eacf62f1a3740a57e08691c3a9006d454aaa2c`,
A6 UI overlay `6b801554a6af95424b4e39dd29f43c146aa13848`, AVFX renderer,
and CT files `e505173edd119fdd955cf6249511b575a5468440`. A1
`2cb1a3c5f093724eb9fecbdf45909ccb611f7b32` and A3
`18e7afcbd576bbd9bfbcc509b2ee13216186a522` are contract files only; A8 is
not mounted. **The wrapper does not mount the copied R4/CT receipt bridge** and
cannot produce or consume a confirmed skill hit. Owner-head observations are
not claims of combined runtime validation. A0 04e had a narrow no-FX/entry
validation, not full campaign acceptance.

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

#14 A clusters form an outbreak; B upright cups read more like isolated
umbrellas. #18 A pointed fragments read as a shatter; B broad fragments and
dial read as a tidy ring. Selected **internal working direction A only**, not
creator acceptance: inspection was of selected full-viewport downscaled stills
([#14](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41287797853),
[#18 revised](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41288055318)),
not 1× full-motion review. #14 still needs convincing sporulation and #18
needs clear temporal capture and force. Full native 60-Hz before/after motion
capture [41288595150](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41288595150)
is pending; not presumed successful or reviewed.

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
* Software-only #10 comparisons [41275419647](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41275419647)
  and overlap [41275419532](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41275419532)
  were not phase matched; they are not hardware FPS or GPU timings. No target
  machine, sustained 60-FPS result, GPU breakdown or production memory budget
  has been verified.
