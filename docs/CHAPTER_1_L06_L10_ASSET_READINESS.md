# Chapter 1 Level 6-10 asset readiness

Audit date: 2026-07-16. Canon: V0.4 short/full specs, `ASSET_AUDIT.md`, `ASSET_SOURCING_MATRIX_2026_07_15.md`, and `ITEM_ASSET_CATALOG_2026_07_16.md`.

## Production-ready now

- Axe VFX: charge, cleave, and trail. Their selected sources have local license/usage records; attribution remains mandatory.
- Vampire VFX reusable by the Castellan: blink departure, blink arrival, and tether. These are cosmetic only; boss telegraphs and collision must remain runtime-owned.
- Existing imported PNGs in the scoped manifest use lossless texture import with mipmaps disabled.

## Placeholder-only / release blockers

- Axe Hero character sheets: technically complete but commercial provenance is blocked by an unverified FreeKnight/reference-input dependency.
- Blood Vampire and Vampire Castellan character art: enemy pack license snapshot
  is absent. Level 10 now has a distinct code/scene identity, larger crowned
  silhouette, phase palette, telegraphs and complete internal-playable runtime,
  but it deliberately reuses the existing Vampire sheet as prototype art. This
  is not approval of that sheet as a final commercially releasable boss set.
- Axe spin: usable internally, but its Shikashi derivative mapping must be added to this scoped provenance graph before promotion.
- The old project-original SVG auxiliary atlas is now a legacy layout asset with no runtime reference. Live auxiliary presentation uses the semantically audited RPG400 ranges: armor `151-200`, rings/chains `241-260`, and crystals `321-400`. Catalog, deterministic naming, rarity mapping, runtime loading, and readability tests pass; commercial release remains blocked until the RPG400 license/EULA or store receipt is preserved locally.
- Treasure Chest `1.2a` is integrated as nine regular grades and six monster grades through the real 5x6 atlas. Runtime region/order tests pass, but the bundled readme does not contain a complete usage grant, so the atlas remains release-blocked pending license proof.
- Levels 6-10 have environmental reuse available, but no level-specific production card/key art should be declared until each authored map is locked and captured from the real build.

## Level 10 internal visual gate

- Dedicated gameplay captures are produced by
  `tools/run_chapter_1_level_10_visual_capture.ps1` through the OpenGL
  compatibility renderer at 847x437 and 1280x720.
- Both captures show the real Phase-2 actor, persistent name/HP/phase/pattern
  strip and the full Blink Lanes cross without HUD overlap. This closes the
  internal readability gate; it does not close the source-license/final-art gate
  above.

Run `powershell -ExecutionPolicy Bypass -File tools/validate_chapter_1_assets.ps1` after changing any scoped source, dimensions, or import preset. Promotion from `placeholder_only` to `production_ready` requires a local license record and a passing validator; visual quality approval is still a separate human gate.
