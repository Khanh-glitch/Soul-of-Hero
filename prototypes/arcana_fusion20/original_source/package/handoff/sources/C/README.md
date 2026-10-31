# ARCANA — An Impossible Pixel Magic Laboratory

Twenty procedural pixel-art spells in five schools. Every frame is drawn by running code. There are no sprites or textures except the hand-coded caster and pylon sprites.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/index.html (single self-contained file)
```

**Controls:**
- Click a numbered button to cast that spell.
- `Space` pauses and resumes.
- `R` replays the current spell.
- `←` / `→` switch to the previous or next spell.
- `,` and `.` step one frame back or forward.
- `C` jumps to the climax.
- `1`, `2`, `3` set the speed to ¼×, ½× or 1×.
- `S` starts the **showcase**, which plays all 20 in sequence.
- `H` hides the UI.
- You can drag the timeline to scrub. The white tick marks the climax.

URL options: `?spell=7&t=6.6` opens a spell paused at a given time. `?capture=1` hides the UI.

## Architecture

| Layer | File | Role |
|---|---|---|
| Pixel raster | `src/engine/frame.ts` | A 384×216 CPU raster with four layers: **ground** (gets displaced), **ink** (premultiplied pixel art), **light** (HDR additive; can be *negative*, so spells can remove light), and **disp** (per-pixel dx/dy displacement, shade and local chroma). Primitives: capsule ribbons with per-call coverage masks, scanline polygons, banded glows, Bresenham lines, pixel fields. |
| GPU compositor | `src/engine/gl.ts` | WebGL2 with GLSL. Ground is sampled *through* the displacement field. Light is quantized with Bayer dithering, white-hot overflow is added, and bloom comes from the light layer at two levels. Invert, flash, shake, chroma and desaturation are global. Final scaling uses hard pixels. |
| Procedural kit | `src/engine/kit.ts` | Height-aware particles with shadows and landing callbacks, midpoint-displacement lightning with recursive branches, timed branch growth (cracks, frost, charge channels), shockwave and heat-haze displacement, and a follow-the-leader spine. |
| Stage | `src/engine/stage.ts` | A deterministic 60 Hz fixed-step clock. Scrubbing re-simulates from the seed. Ambient dust is a pure function of an "ambient clock", which time spells can freeze or echo. |
| Spells | `src/spells/{pyre,tide,tempest,verdant,astral}.ts` | One self-contained piece of machinery per spell. |

Each school has its own visual physics:
- **Pyre** uses flame tongues, depth-split elliptical arcs and geological strata.
- **Tide** uses polar membrane fields, a spring-driven brush and a log-polar shaft.
- **Tempest** uses stepped leaders, torus-knot threads and proximity bridges.
- **Verdant** uses growth agents, Verlet tendrils, colony graphs and layered bloom fields.
- **Astral** uses lens displacement, an attack written as a pure function of its own time, packet-driven orbits and a tear distance field.

## Verified results

- `npm run build` succeeds.
- All 20 spells were rendered in headless Chrome (WebGL2 via SwiftShader) using `scripts/capture.mjs`.
- `screenshots/01…20-*.png` are 3× captures of each climax, taken from the running renderer. `screenshots/climax-sheet.png` puts all 20 on one sheet.
- I reviewed contact sheets across each spell's timeline and fixed weak results: overexposure, a crown that was too small, calligraphy waves that didn't break, a whirlpool with no depth, faint thunder threads, and growth that was too timid.
- CPU raster cost per frame, measured in headless Chrome: mostly 3–12 ms. The heaviest moments are about 20–26 ms (Cinder Crown burst, Undertow surge, Worldseed, Event Horizon, Reality Ripper).

To recapture: `PUPPETEER_DIR=<dir with puppeteer> node scripts/capture.mjs climax` (or use `sheet 0,1,2,3`, or `times <idx> 1,2,3`).

## Limitations

- The rasterizer runs on the CPU, so slower machines may drop below 60 fps at the heaviest moments. Simulation stays fixed-step, so motion is still correct.
- I inspected motion as sampled frame sequences in headless Chrome, not as recorded video.
- Thunderloom, Volt Carousel and Skybreaker Script climaxes are intentionally overexposed, so their climax stills read hotter than the rest.
- Some decorative twinkles use non-seeded randomness, so the exact pixel layout of sparks can vary slightly between runs.
