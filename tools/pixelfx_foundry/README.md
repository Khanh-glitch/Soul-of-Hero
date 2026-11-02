# SOH × PixelFX — FX Foundry tooling

Universal, source-native intake of the [PixelFX](https://github.com/patch-gg/pixelfx) library (MIT) into
Soul of Hero as registered, verified visual assets. Isolated tooling: no gameplay, save, HUD, map or
`soh_binding/**` changes.

## Pinned source

- Upstream: https://github.com/patch-gg/pixelfx
- Pinned commit: `a84159688af3ca37a4be05a0d422b94451b2e24e` (v0.3.0, 2026-10-31) — 244 unique effect IDs in 21 categories (enforced as gate G0).
- Node v22.22.3 used for the export.

## Rebuild everything

```bash
# 1. clean official checkout of the pinned source
git clone https://github.com/patch-gg/pixelfx.git /tmp/pixelfx-upstream
git -C /tmp/pixelfx-upstream checkout a84159688af3ca37a4be05a0d422b94451b2e24e

# 2. discover + export + parity-verify all 244 effects (resumable; re-running skips verified files)
node tools/pixelfx_foundry/intake.mjs --upstream /tmp/pixelfx-upstream --out assets/pixelfx_foundry

# 3. single effects / metadata-only
node tools/pixelfx_foundry/intake.mjs --upstream /tmp/pixelfx-upstream --out assets/pixelfx_foundry --ids ice/ice-lance,fire/meteor
node tools/pixelfx_foundry/intake.mjs --upstream /tmp/pixelfx-upstream --out assets/pixelfx_foundry --report-only

# 4. QA evidence: source contact sheets + SOH day/night strips for all 21 categories
node tools/pixelfx_foundry/qa_sheets.mjs /tmp/pixelfx-upstream /home/user/qa/pixelfx_foundry assets/pixelfx_foundry .

# 5. headless compositing performance measurements (1/3/10 instances, 720p/1080p/1440p, day/night)
node tools/pixelfx_foundry/perf.mjs --assets assets/pixelfx_foundry

# 6. FX Foundry Browser
node tools/pixelfx_foundry/browser/serve.mjs 8734
# open http://localhost:8734/tools/pixelfx_foundry/browser/
```

## Output layout (`assets/pixelfx_foundry/`, atlas PNGs are gitignored — rebuild with step 2)

- `index.json` — registry manifest: 244 entries with metadata, act timing, presentation proposals,
  per-file sha256, per-frame sha256 of the canonical combined frames, page layouts, QA statuses.
- `assets/<category>/<id>/combined-N.png` — canonical transparent frames (`renderFrames().frames[].clear`;
  already includes the source light — never add it twice).
- `assets/<category>/<id>/color-N.png` — raw source color channel (Uint32 → RGBA).
- `assets/<category>/<id>/light-N.png` — additive emission map (RGB, alpha = mask), for night emphasis
  and emission inspection only.
- `assets/<category>/<id>/act-N.png` — performed preview for effects exporting `act` (stock stand-in
  actor; reference only, never bake into SOH sprites).
- `LICENSE`, `NOTICE.md` — upstream attribution, copied verbatim.

## Statuses

`DISCOVERED` (metadata+ID) → `EXPORTED` (atlas files written) → `PARITY_PASS` (atlas PNGs decoded back with
an independent decoder and compared byte-exact against official `renderFrames` output at every frame).
`VISUAL_REVIEWED` and `SOH_READY` are human/gated and never set automatically. `extraShapes=false` for all 244.
