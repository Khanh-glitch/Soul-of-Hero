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
