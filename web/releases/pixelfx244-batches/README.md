# PIXELF-244 batches — full-resolution per-category exports (100% sharpness)

Each `<category>.zip` (fire, water, ice, holy, ...) contains the ORIGINAL upstream-rendered
PNG atlas pages for every effect of that category, byte-identical to the pack produced by
`node tools/pixelfx_foundry/intake.mjs` from the pinned pixelfx upstream
(a84159688af3ca37a4be05a0d422b94451b2e24e, 244/244 PARITY_PASS). Zip layout:
`index.json` (category-scoped manifest) + `assets/<category>/<effect>/{combined,light}-*.png`.
Use these when importing individual effects into another channel and sharpness must be
exact — the single-file `SOH-PIXELF-244-TEST.html` necessarily re-encodes to WebP k=0.5
(GitHub raw limit: 100 MB/file), which is why effects inside that HTML look softer.

Zips are NOT git-tracked (too large; repo convention keeps big artifacts out of git).
They live in this folder in the workspace and can always be regenerated:

  node tools/pixelfx_foundry/intake.mjs --upstream <pixelfx checkout> --out /tmp/pfx244
  node web/scripts/export-pixelfx244-batches.mjs --pack /tmp/pfx244 --out web/releases/pixelfx244-batches

See BATCHES-MANIFEST.json for per-batch effect lists, sizes and sha256.
