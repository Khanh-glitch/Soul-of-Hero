# ARCANA — An Impossible Pixel Magic Laboratory

Twenty original spell effects for a top-down pixel-art fantasy game, across five
elemental schools. Everything on screen — floor, caster, embers, flame bodies,
ice architecture, lightning, root networks, gravitational lensing, the torn
rendering of reality itself — is generated and animated by running code. There
are no sprite sheets, no textures, and no pre-rendered frames in this project.

---

## Running it

```bash
npm install
npm run dev      # laboratory at http://localhost:5173
npm run build    # production bundle in dist/
npm run shots    # headless capture of all 20 climaxes -> shots/
npm run shots -- --strip   # 8-frame timeline contact sheets -> shots/timeline/
npm run shots -- 7         # just spell 07
```

**Controls** — `SPACE` play/pause · `R` replay · `←/→` previous/next spell ·
`,` / `.` single-frame step · `C` jump to the climax · `H` hide the interface ·
timeline scrubber, 0.25×–2× speed, and a `SHOWCASE` button that plays all
twenty effects back to back.

---

## The rendering stack

A deliberately unusual choice: instead of PixiJS/WebGL, the laboratory uses a
**hand-written HDR software rasteriser at 416×234** whose output is nearest-neighbour
upscaled. This buys pixel-exact authorship of every lit pixel, free read/write
access to the frame (needed for displacement, lensing, heat shimmer, scanline
shear and the reality tear), and perfect determinism.

```
spell draw calls ──► Float32 linear HDR buffer (416×234×3)
                      │
                      ├─ bright-pass ─► ¼-res separable blur ×2 ─┐
                      │                                          │
                      └──────────────► + bloom ─► vignette ─► ACES-ish tonemap
                                                      │
                                      8×8 Bayer ordered dither ─► 26-level
                                      per-channel quantisation ─► ImageData
```

The quantisation step is what makes it read as *pixel art* rather than as a
soft particle demo: colour ramps collapse into deliberate bands, and the
ordered dither breaks the banding into pixel clusters instead of gradients.
Most effects additionally quantise their own shading (`fireCol(h, 9)` etc.)
before it ever reaches the buffer, so the ramps are authored, not accidental.

### Shared machinery (`src/engine`, `src/spells/common.ts`)

| piece | used for |
|---|---|
| `field()` / `fieldMul()` | CPU "fragment shaders" over a bounding box — the workhorse behind flame bodies, vortices, membranes, meteors, the rift interior |
| `ribbon()` | articulated quad-strip with per-position width and per-edge colour — wyrm body, calligraphy, tendrils, water sheets |
| `sheet()` | parametric (u,v) surface rasteriser — flower petals, erupting water sheets, Worldseed layers |
| `growBranches()` | recursive branching growth with per-branch delay/speed — cracks, molten veins, roots, electrical fractures |
| `shard()` | crisp faceted polygon with luminous outline — ice, chronocrystals, the constellation star |
| `boltPath()` / `bolt()` | recursive midpoint-displacement lightning, re-seeded every ~1/28 s so channels crackle |
| `heatShimmer()` | local screen-space displacement of already-drawn pixels |
| `fb.drawBackground(warp)` | per-pixel resampling of the arena layer — gravitational lensing and the reality tear |
| `Pool` | lightweight particle pool; each spell supplies its own integrator |

### Five different visual physics

* **PYRE** — polar silhouette functions with fbm-perturbed surfaces, 9-step heat
  ramps, charred negative space, embers with individual ballistics, late
  explosions.
* **TIDE** — parametric membranes with translucent additive layering, foam
  concentrated on curvature extremes; ice instead uses hard polygons, facet
  shading and chain-reaction fracture.
* **TEMPEST** — nothing is drawn as a smooth line: every channel is recursive
  midpoint displacement with forked leaders, ghost channels persist as memory,
  and the strike shears whole scanlines of the frame sideways as EM interference.
* **VERDANT** — growth systems rather than emitters: branch graphs with
  biological rhythm (pauses, accelerations), follow-the-leader tendril chains
  where the tip leads and the body lags, spore agents that found colonies on
  contact and propagate bioluminescent waves along their own links.
* **ASTRAL** — the renderer itself is the material: background resampling,
  log-depth banding, temporal sampling (an attack defined as a pure function of
  its own local time, evaluated at seven different instants simultaneously),
  and depth-occluded parallax inside a hole cut in the world.

---

## The twenty effects

**I. PYRE** 01 Cinder Crown · 02 Furnace Wyrm · 03 Meteor Loom · 04 Ashen Guillotine
**II. TIDE** 05 Abyssal Bloom · 06 Riptide Calligraphy · 07 Mirrorfrost Basilica · 08 Undertow Maw
**III. TEMPEST** 09 Chain Verdict · 10 Thunderloom · 11 Volt Carousel · 12 Skybreaker Script
**IV. VERDANT** 13 Rootwake · 14 Spore Nebula · 15 Thorn Opera · 16 Worldseed
**V. ASTRAL** 17 Event Horizon · 18 Chronoshard · 19 Constellation Engine · 20 Reality Ripper

A few notes on the less obvious implementations:

* **02 Furnace Wyrm** is a single position history buffer sampled at 72 delayed
  offsets; the head steers, the body inherits delayed curvature for free, and the
  strike *shortens the sampling window* so the creature literally feeds its own
  length into the bite.
* **03 Meteor Loom** reheats older impact scars whenever a new meteor lands
  nearby, and the six scars are finally joined into one sigil.
* **04 Ashen Guillotine** spends 3.5 s on a 1-pixel slit, cuts in two frames, and
  only then opens the wound section by section with independent delays.
* **08 Undertow Maw** renders its shaft with a log-spiral band function, so the
  throat appears to descend forever; the surge is seeded by an absolute freeze.
* **17 Event Horizon** warps the arena through `1/r` lensing quantised into
  2-pixel bands, then throws actual squares of the floor texture outward.
* **18 Chronoshard** draws the same attack function at `t−0.48 … t+0.48`, stores
  individual instants inside clipped crystals, and plays them back forward, in
  reverse, and as released particles.
* **20 Reality Ripper** removes the world along a jagged spine, exposes three
  occluding parallax layers of alien architecture, drags fractured 3-pixel bands
  of the background toward the opening (occasionally folding one back at the
  wrong place), and stitches shut on a per-band schedule — with one small region
  that stays broken a moment too long.

---

---

## v2 — Force, smoothness, and enemies

v2 was driven by a written standard, **[`docs/VFX_DOCTRINE.md`](docs/VFX_DOCTRINE.md)**,
rather than by patching individual effects. Its rules are implemented as engine systems:

* **World / force layer** (`src/engine/world.ts`): trauma² camera shake on smooth
  noise (translation + roll), spring camera kick away from the force source,
  spring zoom punch, camera focus push-in during build-ups, *inhale* (the
  world's light drains before a strike), **delayed hit-stop** (impact frames play
  while the release explodes at full speed for 3 frames, then the freeze holds
  on the first big drawing), a short speed ramp afterwards, 3-frame **impact
  frames** (burn-white silhouettes → element-tinted negative → overexposure),
  radial chromatic aberration, and **refractive shockwaves** that displace the
  real frame instead of drawing a ring.
* **Smoothness** (doctrine §3): sub-pixel bilinear splats for every point
  primitive, a C²-smooth glow kernel, shock-front rings with fbm breakup and
  short wakes, bilinear bloom upsampling (v1's nearest upsample produced
  visible 4×4 blocks), a sub-pixel camera resample on the HDR buffer, and a
  per-school **persistence buffer** (`trail = max(fx, trail·decay)`) acting as
  motion blur / smear for all spell light.
* **Enemies** (`src/engine/enemies.ts`): seven bodies (husk, crawler, brute)
  with mass, knockback, launch, bounce, slide, wall hits and recovery;
  flash → squash → knockback → launch → lean → hitstun → damage number + lagging
  HP bar; elemental statuses drawn on the sprite (burn/char flames, wet, ice
  shell + sliding + shatter bonus, X-ray shock, vines, spores, astral ghosts);
  seven deaths where every sprite pixel becomes an analytic particle
  (ash, burst, Voronoi shatter, scan-line disintegration, overgrowth, TV-off,
  and a true **slice** for Ashen Guillotine), each leaving residue on the floor.
  Enemies are drawn as silhouettes over spell light, lit by the light sampled
  around them, with 40% of the spell light re-added on top.
* **Impact score** (`src/spells/choreo.ts`): every spell's TELL / GATHER /
  COMMIT / STRIKE / RELEASE / RESIDUE / LAST BEAT, and how it acts on bodies
  (pull, freeze-lock, chain, root-then-launch, consume, time-hold…), written
  separately from the drawing code. Chain Verdict, Thorn Opera and Thunderloom
  now target the actual enemies.

### Verifying motion, not just stills

```bash
npm run shots -- --grid          # all 20 climaxes in one contact sheet
npm run shots -- --grid 0.6      # all 20, 0.6 s after the climax (aftermath)
npm run shots -- 4 --seq 3.45 3  # 16 *real* frames from t=3.45, every 3rd frame
```

`--seq` samples real frames rather than simulation time, so hit-stop holds and
speed ramps are visible in the timestamps and images (e.g. Cinder Crown:
`3.93 3.97 4.00 4.02 4.02 4.02 4.02 … 4.03 4.04 4.06`). All captures go
through the exact same `Lab.step()` / `Lab.render()` path as the browser.

## Verified results

* All 20 effects are implemented, run in the browser at the full 416×234
  internal resolution, and were inspected both as motion and as frames.
* **Screenshots in `shots/` are real renderer output.** The capture script
  (`scripts/capture.ts`) imports the exact same `Lab`, `Framebuffer` and spell
  classes used by the app, shims `ImageData`, steps the deterministic
  fixed-timestep simulation to each spell's climax, and writes a PNG with a
  hand-rolled encoder. Nothing is AI-generated or hand-painted.
* `shots/timeline/*.png` (generated with `--strip`) are 8-frame contact sheets
  across each spell's full duration, used during development to judge pacing.
* Determinism: every spell is seeded with its own xorshift RNG and advanced at a
  fixed 1/60 s step, so the timeline scrubber reproduces any instant exactly by
  rebuilding and fast-forwarding.
* Typical cost on the capture machine is a few milliseconds per frame per spell;
  the browser build runs at 60 fps for the great majority of the collection.

## Known limitations

* The heaviest frames — Mirrorfrost Basilica's full build, the Reality Ripper's
  open rift and Event Horizon's lensing — are per-pixel CPU work over large
  areas and can drop below 60 fps on low-end hardware. Lowering the internal
  resolution in `src/engine/arena.ts` (`VIEW_W`/`VIEW_H`) scales the cost
  quadratically.
* The caster is a marker, not an animated character; the brief asked for the
  screen to belong to the artwork.
* No audio, and no gameplay layer: this is a VFX laboratory.
* Bloom is a single ¼-resolution blur chain, so very large bright areas bleed
  slightly more than a multi-mip implementation would.
