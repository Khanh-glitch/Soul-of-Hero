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

## Hợp đồng sử dụng cho agent khác (quality cố định, behavior tự do)
- **Chất lượng hình ảnh = 100% cố định**: toàn bộ 732 file PNG trong 21 zip này byte-identical
  với bản gốc upstream render (đã kiểm chứng sha256 732/732 trùng khớp, 0 sai khác). Agent KHÔNG
  nên re-encode/nén lại ảnh; muốn nét đúng như bản gốc thì dùng nguyên file trong zip.
- **Trigger / scale / vị trí / cách hoạt động = tự do thiết kế**: mỗi chiêu chỉ cần `id`
  (ví dụ `arcane/rune-circle`) + metadata trong `index.json` của batch (frames, fps, page atlas,
  coreBounds, presentation.anchor). Agent tự chọn khi nào trigger, đặt ở đâu, scale bao nhiêu,
  loop hay one-shot — không ảnh hưởng gì đến chất lượng ảnh (ảnh luôn full-res).
- Lấy 1 chiêu riêng lẻ: giải nén đúng folder `assets/<category>/<effect>/` trong zip của category đó.
- Batch nào cũng tái tạo được từ source: `intake.mjs` (upstream pinned a841596...) rồi
  `export-pixelfx244-batches.mjs` — xem `BATCHES-MANIFEST.json` để biết zip nào chứa effect id nào,
  kèm sha256 để verify.
