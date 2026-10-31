# ARCANA visual acceptance audit — code inspection, not approval

Authority: `original_source/package/handoff/FUSION_DECISIONS.md` and the
creator's manifest. These findings are **static code inspection**, not a claim
that animation, silhouette, impact, OUT or in-game quality have been reviewed.
All 20 are `VISUAL_NOT_VERIFIED`; none is owner-approved. The all-skill capture
is source-buffer evidence, not the actual SOH composite. See the CI artifact
`arcana20-visual-review` only when the capture step completes successfully.

## Six fusions

| ID | Creator requirement | Code finding and remaining work |
|---|---|---|
| 01 | A crown formation/collapse; C outer flame; one shockwave, scorch, ash | `FusionPlayer` executes whole A and C crown engines on a shared clock. Both complete effects are overlaid; there is no geometry mask proving that their shockwaves are not duplicated. Each visual contact is now forwarded independently, not treated as damage. Source sprites use different anchors/transforms. Isolate selected geometry and inspect the actual composite; review OUT and impact. The generated #01 sheet is an **approximate rescaled buffer overlay**, not the real transformed composite. |
| 05 | A opening/peak, replace A tails with actual C column/rain, no duplicate halo | `AFusionSpells.AbyssalBloom` is a new A-buffer interpretation. It does not execute either original A bloom choreography or C tide source. Port selected source components and compose them causally; verify actual rain, pooling and OUT. |
| 09 | A chain logic/body shock, B two-color, C bolt branching/density; one network | A-buffer authored network, with two colors and authored `ADraw` bolts; not source A/B/C implementations. Link points are fixed, not live enemy anchors. Strand ribbon retains a nonzero baseline through OUT, then cuts off at cleanup. Port/reuse selected source algorithms, synchronize real anchors and implement sequential strand extinction. |
| 11 | Original A rotating spatial machine and C #09 bolt generator mapped to moving connectors | Authored A-buffer carousel, not original A machine or C bolt algorithm. Conduction cue positions now use the rendered connector position at each authored beat, but do not track live actors. Port selected A and C components and verify rotor alignment/deceleration and grounded scorches. |
| 16 | Smooth original A unfolding with C palette | Authored A-buffer petal model and `AMath.R` palettes, not original A motion or demonstrably original C palette. Port selected motion and palette; inspect saturation and folding. |
| 20 | Original C contour/movement and A environmental deformation | Authored A-buffer rift; no ported C rift or real-world A terrain distortion. Port selected contour/motion and integrate a real-world distortion pass; inspect resealing, depth and actor occlusion. |

These are `FUSION_CANDIDATE`, not verified fusions. In particular, a shared
clock or a passing contact count does not prove preservation, no duplicated
geometry, or visual quality. Current renderer players expose composited sprites,
not separately routable terrain/behind/body/air/light/distortion passes.

## Six redesigns

| ID | Code facts and gaps against the brief |
|---|---|
| 04 | Slit, diagonal blade, timed cut and delayed cracks are explicit. `close_k` fades the whole wound together, not section-by-section closing; contact is a point, not a real moving line. Needs animated silhouette, impact and OUT review. |
| 06 | Three written strokes and wave arcs are explicit. Stroke-tip cues are emitted at each stroke's end, not continuously following the moving tip; inspect legibility and wave/foam transition. |
| 12 | Four drawn glyph strokes, three timed circuit strikes and one final strike exist. All glyph strokes share `dis` fade, so **reverse-order disassembly is not implemented**. Targeted strike and C bolt craft remain unverified/unported. |
| 13 | Generated branches and timed tip/central impact cues exist; `tension` thickens branches. `retract` reduces color, not branch geometry; targeted snap/tension and credible organic retraction require work and visual inspection. |
| 14 | Colonies and links have timed growth, moving glows and later particles. Fixed network and event cues are not connected to actual actors, and causal visual readability and OUT still need inspection. Colony contact cues now propagate as visual contacts. |
| 18 | Five crystal formation/capture times, pre-echo and synchronized impact are authored. All crystals share one `rel` and one `resolve`; ordered reverse release and ordered fragment resolution are **not implemented**. B crystal art is not ported. |

All remain `REDESIGN_CANDIDATE`. Structural phases are not evidence that the
visual silhouettes or impact look good.

## #19 D source capture and parity

`tools/arcana19_d_capture/capture.mjs` loads the original D HTML with a
virtual 60 Hz rAF clock and locates Constellation Engine by its ID/name; in
this HTML it is array index 18. A fresh page resets the source renderer clock;
repeat capture at 5.2 s matched by SHA-256 locally. Original full-scene
screenshots include simulated floor and markers and are reference-only.
The isolated FX diagnostic suppresses these draw calls, but still retains
WebGL bloom/post and produces opaque images. Native uses a CPU compositor with
different post and alpha semantics. `compare.py` reports RGB/region/heatmap
measurements against this diagnostic, not a valid alpha-parity PASS. Original D
continues after 8.6 s; it does not supply a gold reference for the authored
native OUT extension. Matching isolated passes, proper alpha/bloom semantics,
and per-stage visual review remain necessary.

## SOH integration and control authority

No SOH screenshots, bright/dark real-scene captures, moving-camera or
performance traces have been visually reviewed by this audit. A PR #30
handoff comment requests them. No `soh_binding/**` files were changed. R4/CT
alone owns confirmed gameplay hits; visual cues are not damage. One contact
per skill is not an invariant.
