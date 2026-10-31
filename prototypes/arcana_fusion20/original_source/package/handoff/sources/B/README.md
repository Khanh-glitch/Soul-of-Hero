# ARCANA — Pixel Magic Laboratory

Twenty procedural pixel-art spells in five schools (PYRE, TIDE, TEMPEST, VERDANT, ASTRAL), drawn and animated entirely by code.

## Run
```
npm install
npm run dev          # interactive lab
npm run build        # builds dist/index.html
node scripts/run-capture.mjs climax        # writes shots/NN-name.png (climax frames)
node scripts/run-capture.mjs strip 7       # 9-frame filmstrip of spell 7
node scripts/run-capture.mjs sheet         # contact sheet of all climaxes
```
Controls: space pause · R recast · ←/→ change spell · `,` `.` step one frame · C jump to climax · 1–4 set speed (0.1–1×) · S showcase (plays all 20 in a loop) · H hide UI · click the arena to move the target.

## How it works
- `src/engine/renderer.ts`: a deterministic CPU rasterizer at a native 384×216. It has an HDR light buffer, separate albedo/shade/mask layers, and deferred banded floor lighting. Transparency is dithered (Bayer). It supports transforms, clipping, warps and switching render targets. Final colors are tone-mapped and ordered-dithered into a limited set of levels.
- `src/engine/gl.ts`: a WebGL2 pass that adds blocky native-resolution bloom, a vignette and an integer-scaled upscale.
- Every spell is a **pure function of time**: a seeded setup plus `render(t)`, with an optional post pass. That is what makes scrubbing, frame-stepping, slow motion, Chronoshard's time sampling, and Node capture possible.
- Each school has its own machinery:
  - **PYRE**: orbits that invert their brightness; a wyrm built from delayed samples of one head path; meteors with 3D ballistics whose impacts re-energize earlier scars; a wound that opens in strata and splits the floor via warp.
  - **TIDE**: translucent dithered membranes with refraction; brush ribbons driven by arclength, with knots where strokes cross; a faceted cathedral that shatters facet by facet in a chain reaction; a per-pixel log-polar tunnel.
  - **TEMPEST**: stepped-leader lightning; torus-knot magnetic storms; orbital rings that reach exact alignment at a set time; a glyph whose strokes activate like a circuit.
  - **VERDANT**: root growth with a pulsing rhythm and bloom feedback; colonies that divide and pass light waves; tendrils whose curvature lags behind the tip; a seed that unfolds layer by layer.
  - **ASTRAL**: gravitational lensing of the actual framebuffer; an attack rendered at different moments inside clipped crystals; a time-freeze desaturation that a shockwave removes; a tear that composites a separately rendered alternate dimension.

## What was checked
- All 20 spells were rendered from the real effect code in Node. The climax screenshots are in `shots/`, and `shots/sheet-all.png` shows all of them together. Filmstrips were reviewed for at least one spell per school.
- After that review I fixed overexposure problems (impact flashes, the spear strike, the rupture) and a wave-fill bug in Riptide Calligraphy.
- `tsc` passes and `npm run build` succeeds.

## Limitations
- No browser was available in this environment, so the live WebGL path was not run here. The screenshots use a CPU copy of the bloom pass.
- Frame time in the browser is untested. Node renders a frame in roughly 35–100 ms, and that figure includes the CPU bloom.
- Some spells read as a little small at their climax, Furnace Wyrm and Rootwake for example. There is no audio.
