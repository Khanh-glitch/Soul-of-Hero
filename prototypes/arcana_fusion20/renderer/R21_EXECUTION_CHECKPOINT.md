# R21 execution checkpoint — partial, not Gold or playtest acceptance

Starting AVFX SHA: `f499da35e176a512b060e09bcecf98781b8c5fc5`.
Current task authority: PR #30 comment `6561672623`; work stays on
`arena/c7b0c4e8-soul-of-hero`, no merge. Product bible read from A0 branch
`arena/dea2428e-soul-of-hero` at `04eacf62f1a3740a57e08691c3a9006d454aaa2c`:
CURRENT_PRODUCT_CONTRACT, DECISIONS, AGENT_CURRENT_DESIGN_BRIEF,
INDEPENDENT_DEEP_REVIEW_PROTOCOL, ACCEPTANCE, AGENTS. Current product decisions
supersede contradictory historical text. Diagnostic preview is not the latest
production composition, real Core custody, authenticated hits, or E2.

## Latest checkpoint — supersedes older run-status / resume notes below

Creator run [41342302519](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41342302519) at `8c260d9d` completed successfully, including same-run Windows headless, Linux software real-route builds, all 22 natural captures (#05 A/B lock, 14 S and F01 normal/dim), both moving #15 range matrices, `batch-s-small-review` and the partial creator package. [Partial package 13097602255](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41342302519/artifacts/13097602255) is 1,077,446,880 bytes; GitHub artifact digest `sha256:c34689eb8f99f658e7c3b19d2400198c858591982c901843d97f54fd63dceacf` (not locally downloaded due Azure EOF). CI generated and verified `SHA256SUMS.txt` within its aggregate before upload. [Small review 13097793089](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41342302519/artifacts/13097793089) is 14,659,085 bytes, with 84 individual 1× JPEGs, 14 sheets and metadata. `reviews/batch_s` now contains the actual current sheets and metadata (7,278,511 bytes); older `853ab121` pre-dither sheets remain in Git history. `reviews/batch_f01_8c260` contains current #01 normal/dim evidence. No Gold, full S acceptance, or 20-slot completeness.

Four actual-cadence 1280×720 H.264 clips, detached blob transport, were retrieved and decoded to `/home/user/r21review/current`:
* #03 normal `b4a8da96cb5c1c8c224fc99f85b3f0f56b8cc401`, SHA256 `972b3548e7b976589a7c34c3a2fcd2bce7d788afca70f1fa7bfbe7d153d54965`, 79 decoded frames / 16.821s captured wall time; dim `85e123cd412e010d30aa77e677e09ad77c896804`, SHA256 `8e847cd2368f51817630ccc3d17bc54396544cc524d7b95475689f7c0c15914a`, 79 frames / 29.684s.
* #15 normal `fe8259b4965c788119e9ee078a58c338e1576bbe`, SHA256 `306422931cfbd9fed10e378408a516e0de4c14c33173379dfec6f2692386aa73`, 67 frames / 15.723s; dim `bdd2e4d7da82c96387a29a38ea79e69d956e618e`, SHA256 `b351bbb194bd5cda5d782c0350efadd31b17be3ade733ee6b8c707d2bedfcb13`, 68 frames / 9.505s. Each ends with a 1ms repeated final image for concat.

Every decoded frame was inspected sequentially in small thumbnail sheets and several critical frames at 1280×720, not smooth playback/full 1× continuous motion. #03 alternates brief, source-authored near-gray full-screen flash with visible meteors, sigil and OUT; world/actors retain some visibility in inspected critical frames. Flash remains **LDR approximation**, not HDR equivalence, 60-fps performance, or an aesthetic approval. #15 natural views show actor-linked green strands, pink bloom, petals and OUT. Both can stutter because captures reflect software-rendering/PNG-I/O wall time and skipped ticks.

#15: `20c42492` adds bounded sparse non-overlapping world-only source raster tiles without scaling or modifying the original simulation. Actual range run [41341519966](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41341519966) at `2852addb` tested 35/900 units × four directions × three observed beats × both lighting: all sampled strand vertices covered by original/active tiles, no cap reached (maximum 8/9 of 12 extras). PNGs from that earlier run were not uploaded; the 8c run includes raw matrix artifacts `13097568113`/`13097901540`. Graphical tile cancel tests pass pinned `41342102329` and current A0 `41342102357`; source-quick `41341519944` and lifecycle `41341520036` pass. These are finite samples, not proof all pixels/ticks fit. Crucial independent unresolved issue: in a 35-unit cast when the real caster runs far away, the original finite-length source strands follow the caster and separate visibly from the fixed bloom; tile overscan reveals but does not repair that geometry conflict. Do not claim seven S candidates complete. Do not silently stretch/replace source geometry; owner policy or explicitly approved reinterpretation is required. Performance, tiles/seams, actor depth and real combat are unverified.

F has begun: `7169f048` aligns A01 crown and the elected C outer flames in source basis and center (including clamp); source-quick `41340970911`, JOIN `41340970777`/`41340970862` pass. The 8c creator captured normal/dim #01; stills show selected red C flame geometry and A burst but do not prove full source parity. #09/#11/#16/#20 still need full native evidence and art work; #20 includes C contour, A bgWarp and A mapped-world debris, but full OUT, actor/depth and source parity remain unverified. N and D remain incomplete. Next: review F01 full motion, inspect/fix #09 A/B/C, #11 A rotor/C09 lightning, #16 A+C, #20 C+A, then N #04/06/12/13/14/18 and D #19 without requesting another prompt; preserve #05 A/B and user/CT owner boundaries. Finish S only when all independent defects are resolved and full per-skill native-motion review supports it. Commit a new tested package only after meaningful new progress; do not duplicate large captures merely for transport.


## Source and execution recovery

`HEAD:prototypes/arcana_fusion20/original_source/ARCANA_20_Corrected_Source_Package.zip`
is 2,357,693 bytes, SHA-256
`afbd876bfaf8f74068abea58347364296a13d1210973165b0e2891ceefa61eee`, and
`unzip -t` passed. `original_source/README_SOURCE_AUTHORITY.md` and
`package/handoff/FUSION_DECISIONS.md` identify the authorized source and votes.
Initially local Git metadata was at base `5214788` while the previous files
remained in the workspace; `git fetch --depth=1 --no-tags origin
arena/c7b0c4e8-soul-of-hero` and `git reset --mixed FETCH_HEAD` recovered
`f499da35` without discarding files; status became clean. Local `godot` and
`godot4` were absent. The existing same-repository CI uses Godot 4.7.0 and
previously built/tested the exact starting SHA in run `41329664482`.

## Batch S / #02 Furnace Wyrm — partial implementation

Original B `package/handoff/sources/B/src/effects/pyre.ts:289-489` uses seed 202,
a 48-segment delayed head path, impact at 4.98s, source-authored global flash
and shake, heat-warp, fire, cracks and debris. `source_b/b_pyre_wyrm.gd` ports
these; `BSourcePlayer.source_pass_frame()` already publishes flash and shake.
The real-world preview's viewport consumer accepted only C frames, silently
omitting B's authored impact flash and shake. It now accepts B frames as well,
while leaving B geometry/source algorithms and the #05 selector unchanged.
This existing optional diagnostic pre-HUD consumer applies flash to an
already-tone-mapped image; it is **not** source-linear-HDR post parity or the
owner's production compositor. B's camera-shake input is transformed to actual
viewport coordinates. Cancellation/finish retire its per-cast state. Overlap
arbitration remains the consumer's documented diagnostic policy.

`arcana20_source_pass_test.gd` now exercises a real #02 source producer at bite,
checks that the source RGB reaches the viewport consumer and verifies cancel
retirement. The existing creator workflow additionally captures #02 natural
moving-world formation, flight, windup, bite and aftermath in normal and dim,
while retaining all six #05 A/B jobs. Its single aggregate is explicitly named
`ARCANA20_CREATOR_VISUAL_REVIEW_PARTIAL`: it is not the requested final
19-candidate package. Check exact run SHA/results and inspect actual #02 images
before claiming even the scoped correction successful. Full continuously
viewed videos, other source roles, body effects and 720p/2K/4K review remain.

## Batch S / #03 Meteor Loom — target and gravity mount correction

Original B `pyre.ts` declares the sigil centre as `(W/2+16,H/2+4)`,
independently of `r.caster` and `r.target`, and its ballistic z subtracts from
screen Y. The old shared B mount instead pinned `(262,104)` to the target and
rotated the entire source frame to the caster-target bearing: the sigil centre
missed the chosen target and gravity leaned or inverted for other bearings.
#03 now pins its actual authored centre to the real target and uses a
world-up similarity scale. Original meteor trajectories, seeds, algorithms and
source fields are untouched; actual caster/target metadata stays intact. Four
bearing tests assert target anchoring and world-up axes. Normal/dim #03 natural
captures were added to the existing workflow. These are changes awaiting their
own same-SHA native and visual results; do not mark #03 complete.

## Batch S / #07 Mirrorfrost Basilica — world-up mount correction

C's original `tide.ts` and `c_mirrorfrost_basilica.gd` use the fixed target
centre Q=(244,112), raised spire height on screen Y and gravity-driven falling
shards. The generic caster-direction mount rotated these into horizontal or
upward gravity. The actual #07 renderer now requests the existing target-pinned
upright C transform, with the original Q, algorithms, seeds and actor metadata
unchanged. Four-bearing tests go through the actual Arcana20Renderer; normal
and dim natural captures are added to the reused creator workflow. This is a
partial mount fix, not proof of source/world/post fidelity or body effects.

## Batch S / #08 Undertow Maw — world-up vortex correction

Original B `tide.ts` uses its own `(W/2+26,H/2+4)` centre and subtracts
ballistic droplet height from screen Y. The prior common B transform pinned a
separate caster-target anchor and rotated the vortex and gravity by cast
bearing. #08 now uses its own target-pinned upright source mount, with source
simulation, palette, seeds and actor metadata unchanged. Four-bearing tests and
normal/dim moving-world captures are included; awaiting same-SHA CI and actual
visual review. Real pull authority is still owner-dependent.

## Earlier scoped evidence

Source quick [41334566477](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41334566477)
passed at `fc1d29d8adc8f9da303c245d4d35c291a1198f9e`. #02 normal and dim
real-route moving-world jobs `124931943724` / `124931943777` passed natural
finish, restart/cancel and visual-only health checks. Native 1x samples showed
an orange curved traveling body, bright bite and a visible scorched aftermath;
the head is small at gameplay scale. I sampled frames, not full uninterrupted
video playback. The same runs reported five resources in use and player
signal-disconnect errors on exit, so shutdown is not clean. This earlier SHA
does not validate later #03/#07/#08 mount changes. Source quick
[41334716109](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41334716109)
passed at `061b91e3`; #03 normal real-route capture job `124932449520`
completed, but a sampled sigil frame was overexposed by the initial B flash
transport. The preview shader was subsequently refined to approximate B's
source exponential tone operation on the existing LDR screen instead of direct
add-and-clip. This is still **not** HDR parity. Inspect the new exact-SHA
captures before claiming the visual issue resolved. Its same-run #05 dimmed
locked job `124932449381` failed a frozen-state/PNG check (no further cause
identified); a later source test passing does not erase that failed evidence.
The locked capture harness now emits specific image/save, tick, camera, player
and actor diagnostics on a future failure without weakening the lock.

At `78b4c7934e225b49720492828508e499267aabb4`, source quick
[41334834011](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41334834011)
passed. Both real-route #07 jobs `124932807357` normal and `124932807281` dim
passed movement, natural finish and cancellation; their sampled 1x frames show
crystalline emergence, upright spires, fracture and dispersed aftermath in the
real map. This is sampled review only, not continuous playback or approval.
They also show five resources in use at shutdown; the normal job reported
player disconnect errors. At `93ba1c1ed2bad2af171ec47cc83350e3d6f57b21`,
source quick [41334940707](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41334940707)
passed, including #08 four-bearing geometry. Both #08 real-route jobs
`124933031036` normal and `124933030981` dim completed successfully. Dim 1x
samples show an authored banded vortex around the real chest/ground and its
subsequent receding outline and debris; the banded appearance is also present
in the original B reference `maw_t440.png`. This remains a sampled review,
not full-motion approval. The dim run reported multiple disconnect errors at
shutdown. At the same SHA, both pinned JOIN
[41334940704](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41334940704)
and current-A0 JOIN [41334942898](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41334942898)
passed. These are not visual sign-off, and later edits require new same-SHA
runs.

## Remaining S capture coverage

The reused creator matrix now also requests #10, #15 and #17 natural moving
world captures in normal/dim, with four surfaced phases and source references.
This is **evidence collection**, not evidence those runs passed or those
candidates meet the creator's visual bar. #15's original five-tendril
choreography uses both fixed caster and multiple authored targets, and its
petals use screen-up z: simply making its entire frame target-upright would
break the caster attachment. Do not repeat the #03/#07/#08 transform blindly.
#10 and #17 must retain their existing world-compositor work while reviewing
same-frame capture, actors/terrain, source timing and natural OUT.

## R21 continuation — native clips and #15 live-caster fix

Order: PR30 comment 6562047500. The correct 20bf creator baseline is run
[41335324866](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41335324866),
25/25 success, artifact 13094643091; no code change in d785 after that export.
All 14 normal/dim source-locked jobs contain native videos. `gh run download`
of `r20-C15-normal-lock0` returned EOF on the Actions blob host, which is
outside this sandbox's allowed outbound hosts. Decoded existing per-job native
1x phase annotations for all seven S candidates instead; actual observations
and limitations are in `playtest/BATCH_S_REVIEW.txt`. These are still samples,
not a false claim that videos were fully watched. Existing workflow now
surfaces a heavily compressed whole-cast motion proxy in check annotations;
lossless full-resolution videos remain unchanged in the artifact. Verify the
proxy step and inspect the whole motion, then return to 1x source/world beats.

#15 at `322a089e8f2855c852d82f9f06bc01547ed531d5`: the source caster was
fixed at cast start while the actual player moved. The five original verlet
bases now follow the optional genuine caller-supplied actor, while the authored
fixed target positions/bloom stay fixed in the original mounted source frame;
petal z is projected world-up rather than rotating with cast bearing. At the
existing min/max scale clamp originally made the focus miss the selected point
at extreme ranges. A subsequent source-frame adaptation translates the focus
and all four source targets by one common offset at clamped ranges; test and
visual results for that follow-up are pending. Very distant targets may still
lie outside the fixed raster. This is explicitly a live-world
adaptation, not a new source-only parity claim. Raster remains 384x216 and may
clip if actors separate beyond the source window. No actual hit/body receipt is
inferred. Source quick [41336944418](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41336944418)
passed including four bearings and #05 A/B source equality. Later quick
[41337278339](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41337278339)
passed at `ce6f03707fcca0c2d035c30462ba2a11af3ce0d2`, including direct petal
ink/shadow projection. Dim #15 job `124939387197` at `24247f6a` passed, with
sampled diagonal tendrils and a small pink bloom, partly outside the target
crop; full motion and normal/dim at the final SHA remain to be inspected.

Historical same-run no-FX/single/overlap comparisons
[41294138791](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41294138791)
reported matching ID-normalized 17 object / 5 resource shutdown diagnostics;
this does not prove AVFX has no independent leaks. Player disconnect errors
remain for A0/AppFlow investigation. #05 locked failure is intermittent and
unexplained, not assumed fixed; 20bf passed.

## Resume

1. `git status --short; git rev-parse HEAD; gh run list --branch arena/c7b0c4e8-soul-of-hero --limit 20`.
2. Inspect the newest source-quick and creator runs for this SHA, first failures
   via `gh api repos/Khanh-glitch/Soul-of-Hero/check-runs/<job>/annotations?per_page=100`.
   Do not claim a result before it is known; fix Godot parse/runtime failures.
3. Decode each #02 job's `NATIVE_1X_*` annotation chunks as in the existing
   `native_review_surface.py` tooling; inspect real gameplay samples (including
   bite and OUT), normal and dim, and check natural finish/cancel/no HP damage.
   Full videos are in the artifact, not equivalent to having watched them.
4. Critique and continue Batch S (03/07/08/10/15/17), then F (01/09/11/16/20),
   N (04/06/12/13/14/18), and D (19). Preserve #05 A/B, #09 tracking/field,
   #10 stage compositor, isolated saves and all owner boundaries. Never call
   synthetic contact a real hit; D's same-frame linear/HDR and authenticated
   combat/body receipts require the actual owner APIs. Do not claim this
   checkpoint completes a batch or the final creator package.
5. Update PR #30 with exact SHA/run/artifact evidence; no merge. Google Docs
   sync is `DOCS_SYNC_PENDING` (no connected Docs app in this session).

## R21 continuation — all seven compressed proxy sequences inspected

At `3399ecde`, every frame of the 320×180/4-fps compressed whole-cast proxies
from successful creator run `41337133995` was inspected for all seven spells,
normal and dim. These are downsampled frames, not native 1× motion review and
not creator approval. In addition to the observations above: #03 has repeated
bright, near-uniform gray full-screen flash beats obscuring world/actors in the
proxy even after the LDR correction; intervening meteors and fading embers are
visible. The pulses are source-authored, but their world readability and
same-frame HDR parity remain open. Do not silently weaken/remove source post;
inspect full-resolution and use the owner-provided pre-HUD HDR world. #08 has a
small cyan formation growing into a banded vortex, then a shrinking outline and
return to the moving world in both lighting variants. #02's head remains small
at gameplay scale. #07 grows and shatters; #10 darkens and returns; #15 shows
actor-linked strands and bloom but was before the clamped-focus follow-up;
#17 shows source-authored blackout, rebound and return. Compression and 4 fps
cannot establish fine source fidelity or all brief beats. See the concise
`playtest/BATCH_S_REVIEW.txt` for role descriptions and remaining checks.

At `d88a998e0f04c0b7a21e811b720d83613428554b`, source quick
[41337551630](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41337551630)
passed clamped-range focus/constellation and petal tests, and current-A0 JOIN
[41337551616](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41337551616)
passed. Creator run [41337551652](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41337551652)
has successful build and source-review, with motion, locked comparator and
Windows jobs queued as of this entry; check the actual result, including its
package integrity steps. Experimental build 41337551690, all-20 41337551725,
and pinned JOIN 41337551631 were also pending. Build output at d88 predates
this documentation update; any current-final candidate needs a creator run
at the actual final commit, with archive integrity and hash verification. In
particular, inspect #15 after d88 at normal/dim and short/long range; its finite
raster may clip, and geometry regression alone cannot resolve this visually.

**Resume:** check Git status and exact SHA, run the existing creator workflow on
the committed current SHA, check results and #05 comparator; retrieve native
full videos if the artifact endpoint becomes reachable. Do not label Batch S
complete without the required 1× real-motion inspection and verified package.
Then continue the already ordered F → N → D work without asking for permission.
