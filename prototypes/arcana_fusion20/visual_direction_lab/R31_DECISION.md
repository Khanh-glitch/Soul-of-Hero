# R31 Visual Direction Decision — ART_DIRECTION_REVIEW_REQUIRED

This is a bounded lab, not a game candidate or Gold. Starting checkpoint was `479ec8226d720642bf99ad2ae11f048838756600`, latest existing runtime `6ae33fc4fafbe5c88908dccf1437dc28184910be`. All seven unresolved skills remain visually rejected or unapproved. No renderer code was changed in R31; no new native before/after was captured. Source parity, GPU performance, Windows visual validation, actual combat and production HDR/depth remain separate unproven gates.

## Decisions in the lab

- **04 A for discussion:** connected displaced banks are a more defensible material/force hypothesis than an isolated graphic line, but the generated concept is oversized and the scale sketch still reads as a flat dark trench/straight blade. **Not ready to implement.** 04 B lacks a blade; 04 C becomes a crater/graphic cage. Need a 1× key pose with one recognizable blade and irregular physically displaced terrain, preserving actors.
- **13 C for discussion:** single grounded root crown with causal branches provides an anatomical origin; a visible tensioned branch and attached short thorn could communicate action. Yet AI adds an actor/oversizes the structure, and the 1× sketch still looks like rigid branches plus a spear. **Not ready to implement.** 13 A looks tree-like and 13 B's coil reads as a snail or a rigid bent trunk.
- **19 B for discussion:** orbit-first hierarchy exposes the actual outer graph while the original source-saturated core stays separately recognizable. The screenshot composite still has dominant bands and a pale core; simple spatial masking cuts role continuity and is explicitly **not a valid runtime approach**. Do not invent a star or remove nodes, modify A, or claim HDR. Need a material plan using actual source fields/coverage and identical timing. A remains source faithful and exactly restorable.

The 1× concept paintovers are non-native pictures over a recorded real frame. The AI illustrations alter the background/actors and scale and are shown only as exploratory ideas. D19 previews are non-native composites from the actual captured A/B screenshots, not proof of an implementable pixel-field decomposition. All visuals have explicit critique in the lab. No fabricated image is presented as gameplay.

## Remaining-artwork matrix

| Role | Evidence / technical | Visual decision |
|---|---|---|
| 04 | Latest `86da3945`, run 41446000227 | reject: thin gash; 1× design still weak |
| 06 | Latest `6ae33fc4`, run 41449024527 | reject: blob / no breaking wave |
| 12 | `887bb821`, run 41447394603 | reject: faint minor glyphs/thin climax |
| 13 | `702e365b`, run 41444527534 | unapproved: origin/aim/tension obscured |
| 14 | `66958cdc`, run 41447160835 | reject: green vine and purple flowers |
| 18 | `702e365b`, run 41444527534 | unapproved: repeated tiny symbols, reversal unclear |
| 19 | Matched `bbc7025f`, run 41445805824 | A restore passed; B rejected: bands/core hierarchy |

## Deterministic continuation

1. Use the offline lab and all original metadata; prioritize a visual-design specialist or creator choice on 04 A/13 C/19 B versus another direction. Do **not** implement the rejected silhouettes or repeated shader scalars. Obtain actual gameplay-scale six-beat artwork with actor readability and no fake receipt.
2. After a concrete, viable visual target, perform exactly one material reconstruction per selected role. Preserve the original D A source, #05 A/B and S/F. Do not touch production/combat/`soh_binding/**` or rebuild historical `ARCANA20_ALL_CANDIDATES_PROVISIONAL`.
3. Capture real native before/after 1280×720 normal/dim full moving-world motion and OUT, matched ticks/camera for D; validate source authority, same-cast A→B→A, cancel/recast/overlap, cleanup and all-20 lifecycle. Report tested SHA separately from design-assets SHA. Reject plank/cage/beak/cloud/primitive; do not call CI green artistic acceptance.
4. Build lab from a complete checkout: `python3 tools/arcana20_join/build_r31_lab.py /home/user/ARCANA20_R31_LAB`; run `cd /home/user/ARCANA20_R31_LAB && sha256sum -c SHA256SUMS`. For a GitHub Actions artifact, dispatch `arcana20-source-quick.yml` with `r31_lab=true` on this same branch; this selects the lab-only job. Before dispatch check whether a matching artifact already exists; don't rerun unrelated jobs.

No background work is promised. Do not merge.

## Published checkpoint

- Lab source/art assets commit: `1e429548918af47d76ff9ee0f86a3bf2a21e4371`.
- Tested artifact workflow commit: `537bdf6e804848264b767f183a8396a1f9d63625`; run [41453577422](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41453577422), artifact [13145268608](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41453577422/artifacts/13145268608), expires 2026-12-02 UTC. GitHub artifact outer digest `b4ebe765e3378c46c68b70dd2e0165b1c681e42d3e22a15739c13c600ece7054`; inner `ARCANA20_R31_LAB.zip` SHA-256 `ceba7831c99675b396abb57e6ae354f7bbb177ccc9cf28c1726ec69ce2cbcbc8` (CI check annotation and local reproducible build agree). Run `sha256sum -c SHA256SUMS` inside the extracted lab.
- `gh workflow run ... -f r31_lab=true` returned HTTP 403 (integration cannot dispatch). The artifact was published instead by a workflow-only push tagged `[r31-lab]`; other jobs in that workflow skipped. If re-publication is essential, make a focused workflow-only change and commit with `[r31-lab]` rather than retrying dispatch. No need to rerun it for aesthetic review.
- Native candidate remains `6ae33fc4fafbe5c88908dccf1437dc28184910be`; R31 introduced no renderer change or new native visual pass. Remaining steps above are not yet performed.
