# Gate 0 — independent integration acceptance review

**Review status:** TECHNICAL GATE PASSED · VISUAL SIGN-OFF PENDING · NOT PRODUCTION INTEGRATED

## Verified references

- Candidate A source map: `f27e8b7fe03f33b2001b08579543e5010a0a1b9d` (Level 3 SHA-256 `5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54`).
- Candidate B source art: `e7cad36f8f21e746abefe44ac6cfa54db9a378e6`.
- Candidate B's delivered Gate 0 evidence/source: `33b75d9a1b7fa176830f269928de8d66180ea81a`.
- Transferred **only 50 new Gate 0 files** to this authorized integration branch from base `78ebc830146a79e8819a824c4d71169cf24d9fad` in commit `d3d8d039b5f35427afc0335b8bc61792e1d80fcc`. Existing `docs/gate0/GATE0_EXECUTION_CONTRACT.md` was preserved.
- Native Godot evidence republished on this integration branch by `c7b84fcf97ce23e7cadf6e842060abf3010e3448`.
- Integration branch CI: [run 39990755157](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/39990755157), **SUCCESS** for import, provenance/determinism, BEFORE/AFTER runtime rendering and publishing.
- PR #4 remains open and unmerged at `f27e8b7`. No edits were made to A's or B's Arena branch, `main`, or any campaign/source `data/**`, `game/**`, `tests/**`, or `project.godot` files.

## Runtime verdict

The experiment proves that the adapter can use Candidate B's original atlas as 15 whole-sprite props (10 solids) in Candidate A's pinned 116×96 Level 3, with the real `game/main.tscn`, HUD, Knight and GL compatibility rendering. Godot logs show actual movement through four stations, no teleportation, sampled Knight/prop physics clearance, source-art pinning and regenerated overlay consistency. This is a focused environment-art integration proof, **not** a full Chapter 1 regression or a merge-ready campaign change.

## Independent visual inspection

The four committed `comparison_*.png` pairs and 4× `closeup_pair_*.png` images were inspected, rather than relying on CI pass counts.

**What improved:** the previously generic stone entry has recognizable writing furniture, manuscript presses, a worktable, a tipped shelf and an evacuation/collapse story. Whole-sprite construction looks more coherent than earlier stone-tile approximations, with no obvious newly sliced multi-tile furniture in these captures.

**What still blocks visual sign-off:**

1. **Tutorial banner masks the signature north-wall presses**, including their tops in destination views; the initial gameplay framing still fails to display the environment's strongest feature clearly.
2. **`shelf_closed` reads as a dark timber slab**, not recognizable archive shelving at native game scale. The small stools/lectern and coin/torches/hero use noticeably different visual emphasis/scaling.
3. **The rubble cluster abuts the floor-door frame**; the connection needs an intentional debris/threshold composition, not just a legal collision arrangement.
4. The additions are limited to the entrance. The remaining gray masonry language and underlying Level 3 layout are **unchanged**, so this is not a redesign of Level 3's full gameplay/environmental progression.
5. Performance is demonstrated in compatibility software GL and four walk/capture stations; wider combat occlusion/playtest and full campaign regression are not yet proven by this focused Gate 0 suite.

## Narrow next correction pass (not authorized to merge)

- Recompose the first playable camera view around an immediately recognizable open manuscript press and desk; avoid using `shelf_closed` as the main read. Keep tutorial UI visible during review.
- Refine at most the few weakest prop placements/scales and the floor-door rubble threshold; no additional formulaic clutter. Confirm opaque sprite bases, collision and silhouette again at 1×.
- Preserve the existing art provenance, immutable entity contracts and deterministic placement. Recheck the 1280×720 native Godot gameplay views and genuine Knight collision after every visual adjustment.
- Before permanent integration, separately plan reload lifecycle, generator ownership, bookkeeping of overlay children, and a focused campaign regression with Level 2 untouched.

**Do not conflate passing Gate 0 with Level 3 visual production approval. Do not merge or deploy.**

## Targeted visual polish — independent follow-up

- **Change commit:** `03fa2b1571796adf6db53a6467c0b4d932a63abc` (only `tools/gate0/author_overlay.py` and generated `prototypes/gate0/overlay_level3_archive.json`; no art pixels or campaign files changed).
- **Native evidence published:** `f1b6e911b0b05430da691eb2d214c267658f48bb`.
- **Godot 4.7 integration run:** [39992472049](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/39992472049) — **SUCCESS**, including provenance, authoring `--check`, import, native BEFORE/AFTER gameplay frames, real Knight walks and sampled collision probes.
- **Visual correction 1:** the nearest `shelf_closed` at (296,176) is now a partly emptied `shelf_partial` of the **same physical dimensions**. The close-up confirms book spines and compartment geometry are now recognizable instead of a featureless dark slab. Existing far partial shelf remains, so there is a repeat; this is not a finished fully-authored archive.
- **Visual correction 2:** `rubble_large` moved 8 px east (384→392, base y352), introducing additional visual separation from the floor-door frame. Validated floor support, physics and walking; other props and gameplay stayed unchanged.
- **Remaining blocker:** the **unchanged production tutorial banner still occludes the tops of the north-wall presses** in the actual 1280×720 after-destination capture, and the first impression remains dominated by HUD/gray masonry. Do not hide the banner solely to manufacture a passing screenshot.
- **Scope decision:** these two targeted fixes pass local visual correction, **NOT full Level 3 visual production acceptance**. The actual Level 3 layout, Chapter 1 combat/balance, editor/reload integration, and comprehensive campaign playtest are outside this proof and have not been signed off.

**Current gate verdict:** technical integration **PASS**; targeted fixes **PASS**; production visual sign-off **PENDING**; no merge/deploy.
