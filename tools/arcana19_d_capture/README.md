# Original D #19 browser evidence

`npm install && npx playwright install --with-deps chromium && node capture.mjs`
inside this directory, or see `.github/workflows/arcana19-d-capture.yml`.
The exact spell is looked up by id and name (its ALL array index is **18**, not 2).
The virtual clock advances requestAnimationFrame at 60Hz; a fresh page is used
for repeatability because replay does not reset the renderer's global clock.

`original_*` are full unmodified HTML output (contain simulated floor and
markers; **never composite into SOH**). `fx-only_*` suppress floor/marker draw
calls and retain the source WebGL FX and postprocessing, a modified diagnostic
against a black scene. Captures are opaque; alpha IoU and fair native parity
require a carefully defined isolated-pass comparison. The original D does not
have the native port's authored 8.6–9.8 OUT, so late source frames are not a
reference for that extension. Do not count this capture as a parity PASS.

Local sandbox route tested: npm `@sparticuz/chromium` + Playwright with
`CHROMIUM_PATH=/tmp/chromium` and `LD_LIBRARY_PATH` pointing to the extracted
`al2023.tar.br` libraries. See `manifest.json` for times and SHA-256.
