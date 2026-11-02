# R30 follow-up experiments — none visually approved

## D19 layer hierarchy, SHA `bbc7025f`

Matched actual-world ticks 489/516 normal and dim, [run 41445805824](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41445805824) passed. Source quick [41445805724](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41445805724) passed. B now extracts the actual existing central filaments separately from the source quads and places both over a translucent source-STAR material; A stays default and is pixel-identical after B → A at both ticks and lights. No source node, STAR, RNG, timing, or source buffer is substituted. The compositor is a NEW LDR interpretation, not source parity/HDR/Gold.

[Normal 489 A](d19/normal/489-bounded.png) · [B](d19/normal/489-art_directed.png) · [no FX](d19/normal/489-world-base.png) · [source](d19/normal/489-native-source.png)  
[Normal 516 A](d19/normal/516-bounded.png) · [B](d19/normal/516-art_directed.png) · [no FX](d19/normal/516-world-base.png) · [source](d19/normal/516-native-source.png)  
[Dim 489 A](d19/dimmed/489-bounded.png) · [B](d19/dimmed/489-art_directed.png) · [no FX](d19/dimmed/489-world-base.png) · [source](d19/dimmed/489-native-source.png)  
[Dim 516 A](d19/dimmed/516-bounded.png) · [B](d19/dimmed/516-art_directed.png) · [no FX](d19/dimmed/516-world-base.png) · [source](d19/dimmed/516-native-source.png)

**Reject as satisfying R30:** the actual isolated STAR raster is still clipped to its original quad and does not read as a recognizable star; central quads are somewhat more discernible, but shimmer bands remain dominant. Do not invent a substitute star or change A. Full B moving-world/OUT/cancel/recast at this SHA have not been reviewed.

## N04 real-pixel bank displacement, SHA `86da3945`

[Normal motion](n04/normal.mp4) · [dim motion](n04/dimmed.mp4); [run 41446000227](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41446000227) completed, including Linux route and Windows headless. Source quick, runtime smoke and candidate regression also passed; not art approval. Bank footprints now sample/displace real underlying world pixels using operation coverage instead of fabricating a floor. Selected native samples: rupture is still largely a thin dark twig/trace and the banks are insufficiently legible; dim is particularly weak, and the camera moves the static cut away from the player. **Reject.** Complete motion/OUT/cancel/recast has not been visually approved.

## N06 connected liquid body, SHA `e7d327c2`

[Normal motion](n06/normal.mp4) · [dim motion](n06/dimmed.mp4); [run 41446506267](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41446506267) completed, including Linux route and Windows headless. The distinct moving mass replaces the prior thin fin, but selected native frames read as an opaque turquoise paddle/slab, not a convincing volumetric breaking wave; writing remains smooth fixed strips. **Reject.** Complete motion/OUT/cancel/recast has not been visually approved.

All MP4s are real Linux software 1280×720 capture at recorded wall cadence; JSON contains original camera, observed ticks and provenance. Selected 1× frames only were inspected; these files are not a GPU 60 FPS measurement or creator approval. No final unified creator package exists.

## N14 connected cups, SHA `66958cdc`

[Normal motion](n14/N14-normal.mp4) · [dim motion](n14/N14-dimmed.mp4); [run 41447160835](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41447160835) passed Linux route, Windows headless and both captures. The new attached, varied cups and causal branching replace shelves and the old network. In selected native frames the connected growth still reads as a green vine bearing purple flowers, not recognizably fungal colonies; dim moving-camera capture carries the effect partly offscreen. **Reject.**

## N12 major/minor runes, SHA `887bb821`

[Normal motion](n12/N12-normal.mp4) · [dim motion](n12/N12-dimmed.mp4); [run 41447394603](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41447394603) passed Linux route, Windows headless and both captures. Lifecycle [41447394683](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41447394683), runtime [41447394714](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41447394714), and source quick [41447394670](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41447394670) passed. The octagon/chord cage is replaced by a large major glyph and four independently written small inscriptions; actual C generators still provide strike and fractures. In selected native samples the minor glyphs are faint, and the target strike is a brief thin white trace rather than the requested C-quality climax. Reverse disassembly and full motion remain unreviewed. **Reject as meeting the full visual bar.**

## N13 and N18 first-look samples

The [first-look report](../r30_first/README.md) contains normal/dim clips at `702e365bb686595b2b33487d866218e256b23a3e`. Additional selected-frame review: N13 has a recognizably branching brown root and a separate green thorn cue, but in these moving-camera frames the root origin and action are obscured by actors/terrain and tension/retraction cannot be confirmed. N18's five dark crystals contain small repeated crescent marks; some slices look blank and the temporal event is not immediately legible. Neither is visually approved. Complete-motion, natural OUT and cancel/recast/overlap visual review remain outstanding; sampled frames alone are not acceptance.

## N06 eddy experiment, SHA `d65400af05e468033a520df0beda1c24c33f4ff5`

[Normal motion](n06_eddies/normal.mp4) · [dim motion](n06_eddies/dimmed.mp4); [run 41448285200](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41448285200) passed Linux, Windows headless, both captures; runtime [41448285115](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41448285115) and quick [41448285060](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41448285060) passed. Selected frames in both lights show **a row of evenly spaced round coins**, not a voluminous wave. Reject. The derived cause is that nearest-lobe distance and its own angular isolines expose each equal-spaced eddy. A later smooth-union/advected-foam experiment `6ae33fc4` removes those seams; its native outcome was pending when recorded and it is not approved.

## N06 smooth union, SHA `6ae33fc4fafbe5c88908dccf1437dc28184910be`

[Normal motion](n06_union/normal.mp4) · [dim motion](n06_union/dimmed.mp4); [run 41449024527](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41449024527) passed Linux, Windows headless and both captures; runtime [41449024506](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41449024506) and quick [41449024607](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41449024607) passed. In selected frames the coin seams are suppressed but the new material reads as an opaque dark-turquoise blob with minimal visible foam, not a cresting, breaking wave. **Reject.** Full-motion/OUT/cancel/recast still need review. This is the current experimental runtime, not a visually accepted version.
