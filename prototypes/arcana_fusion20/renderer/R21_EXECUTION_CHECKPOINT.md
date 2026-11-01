# R21 execution checkpoint — partial, not Gold or playtest acceptance

Starting AVFX SHA: `f499da35e176a512b060e09bcecf98781b8c5fc5`.
Current task authority: PR #30 comment `6561672623`; work stays on
`arena/c7b0c4e8-soul-of-hero`, no merge. Product bible read from A0 branch
`arena/dea2428e-soul-of-hero` at `04eacf62f1a3740a57e08691c3a9006d454aaa2c`:
CURRENT_PRODUCT_CONTRACT, DECISIONS, AGENT_CURRENT_DESIGN_BRIEF,
INDEPENDENT_DEEP_REVIEW_PROTOCOL, ACCEPTANCE, AGENTS. Current product decisions
supersede contradictory historical text. Diagnostic preview is not the latest
production composition, real Core custody, authenticated hits, or E2.

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
