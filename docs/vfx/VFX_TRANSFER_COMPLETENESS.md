# VFX transfer completeness method (grounded in ARCANA #20 Reality Ripper incident, 2026-11-03)

Compact, reusable checklist for porting any ARCANA skill from its approved source
package into the real Soul of Hero Web world. Derived from the actual #20 failure,
not from a speculative audit.

## What actually went wrong on #20 (root cause, code-level)

The approved source (#20 = A+C per `FUSION_DECISIONS.md`; C leads the tear contour,
A leads environmental deformation) draws every frame **sequentially into ONE
framebuffer**: world-pull displacement → void/interior fill → in-tear geometry →
world-sampled fragment copies (`f.blitBase`) → shock/particles. The Web port
instead mapped those steps onto *order-independent additive* compositor layers
and submitted the content layer **before** the rift layer. `RIFT_FS` replaces all
pixels inside the tear width, so every in-tear element (rotating geometry, passage
rings, interior sparkles) was **overwritten at composite time** — invisible in
screenshots while CI stayed green. Two sibling losses shared the same cause:
`f.blitBase` (copy of real world pixels) was translated to flat-color polys, and
cast-owned sim state (`collided`, debris tick, particles) was never reset on
replay/backwards seek, so the second cast lost the collision beat.

## The method (apply per skill, ~15 min)

1. **Primitive inventory before integration.** List every distinct draw primitive
   the source uses (displace `D`, scale `S`, fill `Ic`, add-light `Lc/L`,
   world-sample `worldSample/blitBase`, line/ring, shock, particle sim, flash,
   invert). Map each one to a concrete compositor capability (warp field, rift
   pass, glow/additive pass, blit pass, flash uniform, particle commands).
   Any primitive with no destination = lost behavior; fix the pipeline, not the art.
2. **Preserve source draw order as pass order.** Single-framebuffer sequential
   semantics are NOT order-independent. Compositing order must reproduce
   "who paints over whom" (here: warp+void → interior geometry → fragments).
   Verify with a mid-timeline screenshot, not only CI.
3. **World-sample operations stay world-sampled.** If the source copies or mirrors
   live world pixels, the port must sample the live world texture (pre-warp),
   never substitute a flat color or a lab background.
4. **Cast state is cast-owned.** Sim state must reset on new cast and on
   backwards seek (the source debris sim throws on non-monotonic time; ports
   must handle it explicitly). Add an A→B→A replay check to QA.
5. **Accept visually, on the timeline.** Matched-timestamp captures of the full
   animation (opening / interior / climax / restitch / OUT, day+night, both
   modes) in the real world, inspected by a human. Green CI ≠ visual fidelity.

## Scope guard

This method checks *completeness of transfer*, not art direction. It does not
re-audit architecture, and it must not become a synthetic-test blocker factory.
