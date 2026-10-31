# ARCANA 20 — visual triage, not acceptance

The following are observations of the **low-resolution, 16-color, six-frame
thumbnails** recovered from the source-buffer review artifact of run
[41200681217](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41200681217)
(commit `24f0f8fe7`, before the subsequent OUT changes). Frame layout is
opening / development / catalog peak / approximate first contact / aftermath /
OUT. They are not original-resolution material and do not prove motion,
aesthetic quality, source fidelity, actor integration, OUT smoothness or Gold.
A new run is required to judge the later design changes. Full-resolution
frames are in the run's `arcana20-visual-review` artifact; that run's capture
job **failed** despite writing frames, so they are diagnostics, not CI PASS.
The source sheet for #01 is an FX-only world-transform software composite, not
the real SOH framebuffer. Names below identify observed risks, not approvals.

| ID | Still-frame triage / next check |
|---|---|
| 01 | Small orange crown shapes converge and leave residuals; determine whether complete A/C layers duplicate the crown/impact, at native resolution and in motion. |
| 02 | Curved orange trail and peak spark visible. The contact frame includes a large opaque flash rectangle; separate screen lighting from world-space sprite and check actual wyrm head/body. |
| 03 | Many small streaks and a peak burst; contact includes a large rectangular flash. Opening sample is empty. Review meteor trajectories and full range of landing contacts, not just first. |
| 04 | Diagonal thin line and later red cracks visible; blade silhouette is small. Check impact weight and, in a new run, sequential wound closing. |
| 05 | Broad cyan petal/bloom and dense central white; water column/rain are not identifiable at thumbnail scale. Genuine A/C components remain unported. |
| 06 | Thin cyan curved strokes, largely separated; intended glyph is hard to assess at thumbnail scale. Inspect full-resolution moving tip and wave direction. |
| 07 | Clustered white/cyan facets; selected peak/contact frames have full rectangular flash/dark coverage. Check whether actual actor silhouettes remain visible. |
| 08 | Cyan circular vortex forms and vanishes before the 97% OUT sample. Check earlier closure/droplet arc and real-environment contrast. |
| 09 | Sparse angular network of violet-white lines. Check branching at real enemy anchors, both bolt colors, and new sequential extinction; actual A/B/C sources are not preserved. |
| 10 | Brief slender spear-like highlight; peak frame carries a full dark rectangle. Inspect screen-space flash handling and line alignment against actual target. |
| 11 | Dense white/cyan rotating-like structures across the development/peak stills. Motion, connector tracking and true C bolt geometry remain unverified. |
| 12 | Small stacked pale-blue glyph with thin marks. Check readability and strike weight; newer reverse-order OUT is not shown in this run. |
| 13 | Dense green branching clump; individual tips and tension are difficult to resolve in thumbnail. New branch retraction is not shown here. |
| 14 | Discrete green colonies/links are visible. Signals and causal progression require motion review; verify actor-local spores and deposition. |
| 15 | Green and pink strand/impact marks; peak has a full dark rectangle. Check fine thorn silhouette, per-tip contact and screen flash at full size. |
| 16 | Light pink/white flower-like shape is clear but small; the selected source motion and palette remain unverified. Check folding and petals at normal game scale. |
| 17 | Mostly dark/low-contrast traces; peak contains a full rectangular black patch. Check negative space and actual world visibility; OUT sample is empty. |
| 18 | Small blue-white crystals and a pale central orb. Sequential reverse motion cannot be confirmed from stills; inspect newer release/OUT animation. |
| 19 | Purple-white nodes and bright central star. Browser-source vs native RGB diagnostics have large discrepancies (see audit); no parity or actual D OUT approval. |
| 20 | Thin pale-purple diamond shapes and dark center, rather than a clearly readable rift at thumbnail scale. Original C contour and A world distortion are missing. |

## Cross-cutting blockers

* The A/B/C/D compositors derive alpha from whether resulting RGB is nonzero,
  and bake flash/invert into the same source-local sprite. A transformed opaque
  flash rectangle is **not** a correct real screen-space lighting/post pass.
  Replace this with explicit source coverage and separate real-world/screen
  post passes while retaining independent source-buffer parity tests; do not
  use color-threshold transparency for SOH composition. Some black/dark images
  are expected diagnostic samples but cannot establish actor visibility.
* Real SOH scene screenshots need review separately. Real crypt capture run
  `41200912184` wrote an artifact but **failed** its job; it uses actual game
  scene/actors and manual camera/enemy offsets, not the PR #30 binding, a bright
  overworld or confirmed combat receipts. It is diagnostic only.
* Normal-speed movement, visual contacts vs moving actors, bright/dark actual
  scenes, overlaps, cleanup, memory and target-hardware performance remain
  open. A contact-count gate or reduced thumbnail does not prove any of them.
* All visual states remain `VISUAL_NOT_VERIFIED`; no owner approval is inferred.

## Real-crypt preliminary findings

The 20 peak-ish real-scene thumbnails from runs `41200912184` and the
later successful diagnostic `41201624379` show the actual
crypt tilemap, but HUD/debug overlay coverage is substantial and #05/#16/#20
can obscure a large portion of the play area. These reduced stills are not
sufficient to judge actor readability or movement. The run logged four
`CFrame.ribbon` callback-arity errors in Cinder Crown; the later run passed
after adding the missing fourth callback argument. Its #02+#10 overlap
probe measured runner p95 **3729.518 ms per frame** over 60 frames, on shared
software-rendered CI, with casts ending during the window. This is a severe
performance warning, not a target-device benchmark. Later work moves A/C
rasterization out of the per-catch-up-tick loop; remeasure before claiming an
improvement. The later `41201624379` software-rendered run recorded
p95 **603.734 ms/frame** over 60 frames with the same limitations. This is
still far from a playable frame budget; runner load and casts ending during
measurement prevent a controlled benchmark comparison. Profile D independently.

The sampled-source capture also revealed an A framebuffer error at the bottom
two image rows: the original JS truncates the quarter-height bloom array and
silently ignores out-of-range typed-array writes, whereas Godot raised an index
error. The port now explicitly skips that partial bloom block (preserving JS
behavior) and has a bright-bottom-edge regression check; CI re-verification is
pending. This is not a substitute for a source/native A parity gate.
