# ARCANA #20 — source→port operator map (semantic bridge, 2026-11-03)

Bridge: `web/src/game/arcana_d20/source/` vendors the donor engine **unmodified**
(`engine/frame.ts`, `engine/math.ts`, `engine/palette.ts`, `engine/kit.ts`,
`fusion20/{contour,debris,ripper}.ts`, `aMath.ts` = source A math). The spell
`ripperFusion` runs tick-for-tick on the C `Frame` (384×216); the composite is
the source `compositeC` equation at identity transform (`source/semantic.ts`).
In-game, `Frame.base` and every sample source = **the real SOH world region**
(read back from the world canvas per cast). Output goes through the existing
single WebGL2 presenter as one `frame` layer.

| Source Frame op | Status | Where |
|---|---|---|
| `D` displacement of real background pixels | EXACT | Frame.disp → composite ground sampling |
| `S` shade multiply | EXACT | disp[2] |
| `C` chroma split | EXACT | disp[3] → channel offsets |
| `I`/`Ic`/`Id` opaque/dithered ink | EXACT | ink layer, alpha compositing |
| `L`/`Lc` signed additive light (incl. negative) | EXACT | light layer, quantized /8 + bayer |
| `worldSample` (mode 1 = inverted tint, mode 2) | EXACT | worldFragment + mode transform |
| `blitBase` world-fragment copies | EXACT | worldFragment mode 0 |
| `addLiveWorldLight` / `addBilinearLight` | EXACT | liveLight ops add world RGB |
| mask-clipped polyhedra/ring pixel callbacks | EXACT | donor render code unmodified |
| debris fixed-step sim (monotonic, reset on seek) | EXACT | fusion20/debris.ts |
| `fx.shake/kick/flash/invert` | EXACT (flash routed to frame-layer uniform) | semantic.ts fx |
| deterministic RNG (seed 151461 / 1512011289) | EXACT | donor code |
| 480×270 window | ADAPTED → 384×216 (true source frame size; earlier port had wrong size) | SF_W/SF_H |
| lab dark floor | ADAPTED → real SOH world region as base/sampler (intended Phase-2 integration, not a lab paste) | worldRegion() |
| GPU-side bloom/post | MISSING by design (source has none; "no post/bloom/HDR" per compositeC) | — |
| stage scanlines/blackout (CStage) | MISSING — not used by #20 ripper | — |

Evidence: `web/evidence/avfx-20/SEM-*.png` (CPU source frames on the real world,
personally inspected), CI `avfx-20-evidence` REF/current/restored GPU captures,
`tests/arcana-d20-semantic.test.ts` (5 semantic phase tests incl. replay determinism).
