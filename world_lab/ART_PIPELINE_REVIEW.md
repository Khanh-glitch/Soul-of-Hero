# Art pipeline self-assessment and web research

Current local HEAD is intentionally not pinned in this document: run `git rev-parse HEAD`. The branch is `arena/2e3cfbd2-soul-of-hero` only as a session label; no stale commit hash is used as evidence.

## 1. Honest assessment of the rejected first generation

The first compiler proved only that GOLD data could be converted into geometry and ten deterministic Node/PNG views. It did **not** prove a convincing pixel-art world. The creator rejected all ten old screenshots. Their underlying style was a runtime vector renderer drawing many terrain categories from material numbers; it had no tracked kit of real prototype crops, no semantic crop/frame ledger, no shared authored value ladder, conservative contact shadows, architectural trim logic, whole-object prop composition, focal hierarchy, or cool-ambient/warm-local light separation. `paired` remains a traversal-route thesis and a test route only, never the default visual direction. The old verdicts `TECHNICAL_PROVEN_WITH_VISUAL_REVIEW_REQUIRED` and `READY_FOR_CREATOR_VISUAL_REVIEW` are obsolete and must not be used in current evidence.

The direct prototype design review staged from `references/gameplay-prototypes-20261102` is more useful than generic advice: it prescribes one value ladder, contact shadows, cool base + hot local pools, whole-object sprites, one destination/room, and subordinate secondary objects; it explicitly rejects continuous brick, missing wall tops, weak value separation, rhythmic torches, uniform brightness, and scenes without a constructed feature. This is the primary local critique used below.

## 2. Research findings actually applied

- **Majority tileable/trim kit, one unique hero prop:** Intel's modularity guidance describes tileable textures as the majority reusable “frontline infantry”, trim sheets as one-direction/grid strips, grid snapping as mandatory, and unique textures as a resource reserved for hero props [9](https://www.intel.com/content/dam/develop/external/us/en/documents/modularityforgames.pdf). The Polycount definition says a few pieces fit a common pattern to create variety [1](http://wiki.polycount.com/wiki/Modular_environments), while the modular-architecture paper identifies uniform grid, standard measurements, joints/trims, and planned variation as key principles [3](https://uu.diva-portal.org/smash/get/diva2:1642436/FULLTEXT01.pdf). Carlos Casals' production deck likewise uses consistent module sizes, module testing, then hero assets and final details [1](https://www.slideshare.net/slideshow/environment-creation-using-a-modular-approach-carlos-casals-ten-square-games/256494371).
- **One focal hierarchy and readable functional spaces:** GameDeveloper separates foreground, center of interest, background and staffage; dark foreground frames the dominant, the center reads first, and practical leading lines/observation spots guide movement [6](https://www.gamedeveloper.com/design/composition-in-level-design). 80.lv says the majority of final assets must intentionally be subordinate to the focal/hero asset and that the pathway/interactable assets must stay clear [4](https://80.lv/articles/the-stages-of-environment-art-in-gamedev). Nasty Rodent's pipeline treats sight lines, focal hierarchy, grid compliance and spatial proportion as blockout checks [1](https://nastyrodent.com/3d-environment-design/). The Level Design Book places layout, blockout, lighting and environment art in that order [1](https://book.leveldesignbook.com/process/overview). Visual-language guidance adds landmarks, lighting and contrast as orientation devices [2](https://game-designers.net/visual-language-in-game-level-design).
- **Shared limited palette with hue-shifted value ramps:** the-pixel's hue-shifting guide recommends roughly 20° hue movement per ramp step, highlights toward yellow, shadows toward blue/purple, and warm light/cool shadow [1](https://the-pixel.art/articles/hue-shifting-pixel-art-shading/); its palette guide describes material ramps of 3–5 colours, shared ambient-shadow/warm-light colours, and value as the carrier of the image [3](https://the-pixel.art/articles/pixel-art-color-palette-how-to-make/). Art-Pia recommends 3–4 value steps per motif, a 15–20% adjacent value gap, cool shadows and warm highlights [1](https://art-pia.com/guide-color-palette-en.html), plus a fixed 45° upper-left light direction and consistent shadow logic [1](https://art-pia.com/guide-light-shadow-en.html). Pixnote measured that at 16×16 the lightness gap does most of the work and warns against pillow shading [1](https://pixnote.net/en/learn/shading/); the palette-swap guide emphasizes about three shades per material and grayscale readability [1](https://spritesheetgenerator.online/guides/color-palettes-palette-swaps). The implemented `src/hero/palette.mjs` therefore uses exactly 36 authored colours, group-scoped nearest-colour mapping, a fixed 4×4 Bayer choice dither, no off-palette RGB, and a strict 1× test.
- **Seamless 16px grid, hard edges and conservative shadows:** FreePixel describes seamless edge/wrap technique, a 16px grid, variants to hide repetition and hard edges for man-made floors/walls [5](https://freepixel.art/blog/how-to-design-pixel-art-tilesets-for-seamless-worlds/). Slynyrd's top-down tile guide limits drop shadows to one/two wall faces and at most one tile, with base textures looping on all sides [1](https://www.slynyrd.com/blog/2023/3/26/pixelblog-43-top-down-tiles-part-2). `contactShadow()` in `src/hero/palette.mjs` is therefore capped at 16px and uses a hard 1px edge.
- **Layer hierarchy and y/depth sorting:** Sandro Maglione separates foreground, main, close background and distant parallax; foreground must never hide the character, main interactables have high contrast, and distant backgrounds have lower contrast [1](https://www.sandromaglione.com/articles/pixel-art-platformer-level-design-full-guide). Island Class recommends darker/sparser foreground, highest-clarity midground, lighter/less-saturated background, leading lines and testing at real size [3](https://islandclass.org/2026/09/26/game-environment-art-layout-colour-layers/). Slynyrd's character guide says lower-screen objects are closer along the Y axis, while arbitrary X overlap confuses depth; it also ties sprite scale to a tile unit [4](https://www.slynyrd.com/blog/2019/10/21/pixelblog-22-top-down-character-sprites). The scene therefore sorts whole-object props by `footY`, keeps hard-edge material transitions, and never uses an opaque pasted native capture as a background.
- **Trim sheets and production staging:** PropGon describes a shared horizontal-strip atlas that tiles in one direction and reserves unique baked texture for a hero prop [3](https://propgon.com/en/trim-sheets-3d-optimization-game-art-guide/). Braiden Fenech's paper describes modular pieces as small reusable components assembled into larger structures [1](https://static1.squarespace.com/static/574e757260b5e93b27fb18ac/t/5b4804012b6a286d041b6fc9/1531446278799/BraidenFenech_ApproachesToModularConstructionForReal-timeGameEnvironments.pdf).

## 3. Exact URLs fetched with `fetch_page`

Only `chunkIndex 0` or `1` mid-article chunks were read; this is **not** a claim of full-article review. `pathbits` returned 404. Exact URLs:

1. https://www.intel.com/content/dam/develop/external/us/en/documents/modularityforgames.pdf
2. https://www.gamedeveloper.com/design/composition-in-level-design
3. https://the-pixel.art/articles/hue-shifting-pixel-art-shading/
4. https://www.slynyrd.com/blog/2023/3/26/pixelblog-43-top-down-tiles-part-2
5. https://freepixel.art/blog/how-to-design-pixel-art-tilesets-for-seamless-worlds/
6. https://the-pixel.art/articles/pixel-art-color-palette-how-to-make/
7. https://app.pathbits.com/articles/understanding-the-role-of-pixel-art-layers-in-top-down-design
8. https://propgon.com/en/trim-sheets-3d-optimization-game-art-guide/
9. https://game-designers.net/visual-language-in-game-level-design
10. https://80.lv/articles/the-stages-of-environment-art-in-gamedev
11. https://www.slynyrd.com/blog/2023/3/26/pixelblog-43-top-down-tiles-part-2 (`chunkIndex 1`)
12. https://www.gamedeveloper.com/design/composition-in-level-design (`chunkIndex 1`)
13. https://www.intel.com/content/dam/develop/external/us/en/documents/modularityforgames.pdf (`chunkIndex 1`)
14. https://80.lv/articles/the-stages-of-environment-art-in-gamedev (`chunkIndex 1`)
15. https://www.sandromaglione.com/articles/pixel-art-platformer-level-design-full-guide
16. https://islandclass.org/2026/09/26/game-environment-art-layout-colour-layers/
17. https://nastyrodent.com/3d-environment-design/
18. https://www.unboxfuture.com/2026/07/from-2d-canvas-to-3d-world-complete-5.html
19. https://book.leveldesignbook.com/process/overview
20. https://www.creativebloq.com/3d/these-blender-environment-art-tricks-make-scenes-feel-instantly-more-cinematic
21. http://wiki.polycount.com/wiki/Modular_environments
22. https://uu.diva-portal.org/smash/get/diva2:1642436/FULLTEXT01.pdf
23. https://static1.squarespace.com/static/574e757260b5e93b27fb18ac/t/5b4804012b6a286d041b6fc9/1531446278799/BraidenFenech_ApproachesToModularConstructionForReal-timeGameEnvironments.pdf
24. https://www.slynyrd.com/blog/2019/10/21/pixelblog-22-top-down-character-sprites
25. https://art-pia.com/guide-color-palette-en.html
26. https://art-pia.com/guide-light-shadow-en.html
27. https://pixnote.net/en/learn/shading/
28. https://spritesheetgenerator.online/guides/color-palettes-palette-swaps

## 4. What changed in this checkpoint

- Removed two zero-byte failed scratch PNGs and the duplicate `cainos_struct.png` forensic row; reran the donor-sheet dissection: **23 unique sheets / 914 connected components / 0 duplicate sheet paths**.
- Added `image-search/` to the root ignore so ad-hoc web-search downloads are not staged.
- Added `src/hero/palette.test.mjs`: **9/9** checks for 36 exact colours, strict palette emission, chroma key, nearest-neighbour downsample, selective outline, ≤16px contact shadow and PNG 1× round trip.
- Added `src/hero/source_manifest.mjs`, `data/hero_source_manifest.json`, `ASSET_LICENSES.md`, `THIRD_PARTY.md`: exact local SHA-256/bytes for 32 prototype files, 5 raw packs, 4 native references, 8 license stubs, 23 donor sheets and AI-derived files; exact Git blob SHA1/origin for prototype files; exact license/source URLs; explicit no-full-license-coverage and no-owner-rights-claim caveats.
- Current HEAD is dynamic (`git rev-parse HEAD`), never a committed 40-hex hash. No C01–C24 same-SHA proof, owner semantic commitment, native Godot scene/import/captures/test, 336h E2 evidence, or independent playability proof is claimed.

Current honest verdict remains **PLAYABILITY_UNPROVEN / GAMEPLAY_INTEGRATION_BLOCKED**; the one-scene visual candidate has not been sent for owner approval. The first-generation visual set remains **REJECTED**.
