# ARCANA20 world compositor contract — R14 diagnostic, not acceptance

This contract applies to **each** of the 20 source selections in
`arcana20_source_catalog.gd`, including all six fusions and all six unapproved
redesign studies. It is a target for the isolated world-pass router, not a
claim that the current prototype implements all layers. The canonical per-skill
status and evidence are in `OVERWORLD_INTEGRATION_STATUS.md`.

## Semantic layers and ordering

1. **Ground/decal**: authored contact marks, cracks and terrain coloration must
   sample and alter the real ground, with authored geometric coverage. They
   follow the world/camera transform; do not tint an enclosing sprite quad.
2. **Behind actors**: physical geometry whose source ordering puts it behind
   bodies/obstacles needs a world depth slot, not an always-on-top effect.
3. **Actor-linked**: attach visual geometry to the actual caster/target anchors
   on every source tick, with explicit loss-of-target behavior. Positions and
   confirmed receipts are input from the owner; this renderer has no authority
   over HP, mana, hit testing, cooldown, or ownership.
4. **Airborne / foreground**: keep source-authored flight, body and foreground
   marks ordered relative to real actors and obstacles; don't manufacture fake
   battlefield actors or HUD inside a source image.
5. **Emissive**: preserve source HDR values and real coverage independently of
   RGB; black/dark pixels may be authored geometry, not transparent pixels.
   Bloom and exposure require the intended pre-HUD world input and source math.
6. **Local distortion**: sample the actual pre-HUD world only inside the
   authored influence, applying source-to-world and camera transforms. Signed
   fields and inverse mapping must not be replaced with brightness-keyed masks.
7. **Viewport stage/post**: full-screen shade, scanlines, blackout, shake,
   chroma, invert and flash may cover the actual viewport only where the source
   explicitly authors a global operation. They must not become rotated,
   translated or scaled source-space rectangles. Preserve source operation
   order; all HUD, including partially transparent pixels, stays outside post.
8. **Aftermath / OUT**: carry the original source's final phases and chosen
   fusion choreography through natural retirement; clearly mark any separately
   authored withdrawal as unapproved. Actor movement must not freeze the world.
9. **Cleanup / overlap**: state belongs to a cast and family. Cancel, restart,
   transition and natural layer finish release their own textures and stage
   states without erasing another cast; global operations need deterministic,
   source-faithful ordering. Frozen restoration and zero outside changes alone
   are necessary regressions, not proof that the influence is correct.

The source frame (`arcana20_source_pass_frame.gd`) contains source-sized,
row-major visual data, tick, seeds, source-to-world similarity transform and
caster/target anchors. Producers retain mutable storage: consumers must copy
fields retained beyond synchronous delivery. A/B/C/D currently expose different
subsets; no consumer may infer missing coverage from RGB. The viewport is not
source space. Stage inputs require explicit routing, not a generic full-canvas
heuristic. Source standalone rendering/parity remains independent of world
integration; post, depth and source comparisons must all be tested separately.

## Current routes and known gaps

| Selection | Source routing (catalog) | Diagnostic today / mandatory unresolved work |
|---|---|---|
| 01 A+C, 05 A+C, 09 A+B+C, 11 A+C09, 16 A+C, 20 A+C | creator-selected fusions | Separate per-family world consumers and lifecycle; #01/#16 ordering is approximate, actor/foreground occlusion and full fusion parity remain open. #20 needs owner-confirmed moving-hit/miss/receipt contract. |
| 02 B, 03 B, 08 B | B | B ink/coverage, ground, shade/light and warp routes are diagnostic, not complete depth, post or owner-world parity. |
| 07 C, 15 C | C | C world fields can represent local shade and light; all source operations must still be audited for local versus global semantics, moving actors and correct occlusion. Do not extrapolate #10 results to these skills. |
| 10 C | C Thunderloom | Authored full-stage shade/scanlines route to a viewport-aligned consumer; local cloud/shade/bolt remain local. Depth and multiple global-effect ordering remain approximations. |
| 17 C | C Event Horizon | Authored whole-stage blackout and subsequent source light use a viewport consumer; target light is very small at gameplay scale. Overlap and full temporal/source ordering still need review. |
| 19 D (+ A combat selection) | D | D geometry/warp diagnostics and separately authored OUT exist; original scene bloom/post, depth and full-source fidelity remain unresolved. A combat receipt ownership remains external. |
| 04 A+C, 06 A+C, 12 A+C09, 13 B+C, 14 A+B+C, 18 B | redesign studies | `REDESIGN_CANDIDATE` only; physical causality, all world layers and creator review remain open. Source study routing is not creator approval. |

The current mount uses ordered canvas copies and independent per-cast viewers;
#10 stage shade runs before actors/HUD, while #17 blackout is viewport-wide.
Neither is a general exact source-stage ordering solution. A original terrain,
refraction and post, D bloom/full WebGL post, generalized actor depth, global
post arbitration and production performance remain unimplemented or unproven.
No contract text here changes this status or promotes any skill.
