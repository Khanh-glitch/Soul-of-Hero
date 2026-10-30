# ARCANA III 001 Black Sun Coronation — source audit (begin, no visual parity claim)

Source: `ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip`, SHA-256
`8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d` (verified
in-branch at `prototypes/skill_readiness/original_sources/`).

## Original definition (eclipse.ts:757, setup `s01` eclipse.ts:17-…)
- id 1, relic `halo`, dur 10.0 s. Phases: [0 Dash & orbit] [1.2 Black sun
  assembles] [4.2 Silence] [4.95 Corona release] [6.5 Aftermath].
- Geometry anchors: ground centre G=(240,174), sun centre SC=(240,102) in the
  480x270 logical space (W=480,H=270,CX=240,YS=0.7 ground squash, util.ts).
- Layout: 6 enemies pinned on a ring r=100 around G; caster segments at
  0-0.9 s, 4.55-5.0 s (rise 136), 5.0-6.0 s.
- Systems in `s01`: enemy ring + magicSeal prison (0.85-5.0 s), 28 converging
  shards, Black Sun (corona_ring x2 counter-rotating stamps + seal_solar,
  void disc, diamond-ring gring), 5 orbiting arcBlade rings, 6 erupting
  crescent blades with ribbon wakes + pixelBolt, plus post darken/silhouette
  envelopes driven per-frame (`c.darken`, `c.silhouette`).

## Engine semantics that the native family must preserve (core.ts/post.ts/util.ts)
- RNG: mulberry32 in util.ts, `reseed(s)` per playback, zero seed -> 1.
  Native foundation: `native/arcana/arcana_util.gd`, verified against the
  ORIGINAL util.ts executed under Node (`reference/arcana_node/`):
  RNG bit-exact for seeds 1/7/0/12345; ease/prog/sstep/hash/vnoise at 1e-9.
- Rendering: PixiJS 8 WebGL multipass — layered Containers (low/deb/add/sky
  particle layers with pooled Sprites from procedural textures pixtex.ts),
  Graphics draw commands (draw.ts), sprite stamps (sprites.ts StampPool),
  and a GLSL post Composer (post.ts: bloom, aberration, shocks, lens, slice,
  flash, grade, vignette). This is NOT the Venomwright CPU raster; the ARCANA
  family keeps its own renderer, clock (60 Hz source) and oracle protocol.
- Therefore Venomwright raster-hash differentials do NOT transfer. ARCANA
  parity needs its own oracle: (a) logic/event vectors from the original
  engine driven headlessly, (b) renderer comparison against real Pixi WebGL
  frames. Neither exists yet; the earlier headless mock-draw run is not
  evidence (see arcana_family_runtime.gd header).

## Status
- SOURCE_NATIVE_EXECUTABLE: no (foundation util only).
- SOURCE_PARITY_VERIFIED: no. GOLD_VISUAL_COMPARISON_READY: no.
- Next: drive original core.ts headlessly with a real Pixi build to record
  001 timeline/event oracle; port Ctx/PLayer/draw primitives into the
  independent ARCANA family runtime; only then register a001.
