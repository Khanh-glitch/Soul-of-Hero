# Argus / Great Lens — ONE rebuilt hero scene (honest review)

**Status: `SINGLE_PROVENANCE_BACKED_VISUAL_CANDIDATE_BUILT`.** This is one native
`640×360` **1× nearest-neighbour** presentation render, not the rejected 10-shot
set and not a pasted native Godot capture. No creator approval is requested for
this or any weak iteration.

| Deliverable | Path | Exact identity |
|---|---|---|
| Native render | `screenshots/ARGUS_GREAT_LENS_HERO.png` | `640×360`, `122422 B`, SHA-256 `6b91db3a318650b2a5a1063e4d2063c2c6dd88c9d1b84ca8bd3cb2714f92b40c` |
| Exact crop ledger | `data/hero_provenance.json` | SHA-256 `1a18eacbfa0f801c121e07271dfdd7a710a3b69a91bd1b37e4d96eddad00e114` |
| Tracked scene graph | `data/hero_scene.json` | SHA-256 `f7ce95af90597f9cb5e2138c7e841864dc2fe71929e7e81806a2320a4e4777a3` |
| Render stats | `qa/hero_render_stats.json` | 920 tile + 106 mosaic + 21 prop placements; 0 off-palette pixels |
| Strict QA | `qa/hero_results.json`, `qa/HERO_TEST_REPORT.md` | 12 checks, exact-SHA/rect/frame verification |
| Browser evidence | `src/app/hero.html`, `qa/browser_results.json` | full provenance view + `BROWSER_TEST PASS 10 checks` (headless Chromium) |

Rebuild with `npm run hero:build` (ledger → scene graph → render) and verify with
`npm run hero:test`. Both are deterministic: re-running the render produces the
same PNG SHA.

## 1. What was actually built

`src/hero/kit.mjs` resolves **155 real prototype-generated crops** from eight
byte-for-byte staged sheets, each by an exact frame name and exact `[x,y,w,h]`
rect from the prototype's own frame manifests. `src/hero/render.mjs` refuses to
draw any crop whose source SHA, manifest SHA, frame rect, raw-crop SHA or
normalized-crop SHA does not match the ledger. This is the missing
"exact SHA / crop-rect / frame ledger" proof; it is not the earlier unusable
flat connected-component forensics (`data/hero_donor_components.json`).

| Sheet (staged copy) | Bytes | SHA-256 | Prototype origin |
|---|---:|---|---|
| `gatehouse_tiles.png` | 37766 | `4320dcf0a3cbb57b824f07f9b06c0e91498ee4c8419e4493fd4cdf1d633ac783` | `assets/environment/chapter1/gatehouse/gatehouse_tiles.png` |
| `relay_tiles.png` | 18410 | `6358d28f1da32a60943f5a29ee4a528b4334ee9c382f4973e0d0741607184d69` | `assets/environment/chapter1/relay/relay_tiles.png` |
| `vigil_tiles.png` | 47190 | `b16b0d6d97413c04477b73acb3eaadbb3e35ecf9616cccebb058e4e9b7428ac0` | `assets/environment/chapter1/vigil/vigil_tiles.png` |
| `gatehouse_props.png` | 25839 | `265d7e662dbc54f310ce9b5a0e61b06ec2cae1a415699e552289c1ff0b668fc0` | `assets/environment/chapter1/gatehouse/gatehouse_props.png` |
| `relay_props.png` | 24046 | `ffcf953907c38e7bbcba9ef2775bc6e902a2a062e7ff008d6b0653ca3c96f44f` | `assets/environment/chapter1/relay/relay_props.png` |
| `vigil_props.png` | 10030 | `3694916d3c840de0edaec7d19be40ad40f633aee7f492dcad425630031febfef` | `assets/environment/chapter1/vigil/vigil_props.png` |
| `overworld_tiles.png` | 25085 | `cef87705e73693feb2af3a60430e4ce94ef6223f51d43d6418ace018c861ed61` | `assets/environment/overworld/overworld_tiles.png` |
| `light_radial.png` | 12241 | `8a294ed2bc843bec8372d2eff832bc6ed98d1ac2a8c7b3b0747ed34f731de2ef` | `assets/environment/overworld/light_radial.png` |

Prototype source branch `references/gameplay-prototypes-20261102` @
`7a1c53acfc5b7cda6cb34ea3f348b4e100744354`. Full per-frame SHA/rect records,
git blob SHA-1 origins and byte counts are in `data/hero_provenance.json`;
license/source records are in `ASSET_LICENSES.md` / `THIRD_PARTY.md` (coverage
is partial, no owner rights claim).

**Kit composition.** 156 ledger entries: 155 real crops, **139 tileable/trim
(89.68%)**, 15 whole-sprite props, 1 real light stencil, and exactly **one
AI-derived hero prop**. Two real-crop mosaics are assembled from exact frames:
`medallion_-4..4_-4..4` (81 × 16px, relay sheet) under the focal landmark and
`ring_-2..2_-2..2` (25 × 16px, gatehouse sheet) at the subordinate south
observation space. The scene graph contains a fully explicit `40×23` 16px tile
map (920 cells), two mosaics, 21 y-sorted objects, 7 light emitters, functional
spaces and a focal hierarchy.

**One hero landmark.** `great_lens_hero` comes from
`assets/source/derived/great_lens_hero_v4_clean.png`
(SHA-256 `c22fef7f2035bcb0c492ae1d7336c23d08ee90fe472aa1950f8cf93178ab7f65`),
cleaned deterministically, chroma-keyed and reduced by an **integer /8
nearest-neighbour** factor to 152×152. It is labelled
`AI_DERIVED_HERO_PROP_NOT_REAL_ASSET` in the ledger, the scene graph, the
browser view and `data/hero_derived_notice.json`. It is **never** cited as
real-asset proof.

## 2. Applied art direction

- **Uniform 16px grid / modular majority.** Every tile/trim frame is `16×16`
  and every tile placement is on the grid; only whole-sprite props use pixel
  foot anchors. Trim strips (`rail_w/rail_e`, `step_*`, `conduit_*`,
  `chevron_*`, `aisle_*`, `wall_*` courses) carry transitions rather than
  continuous brick.
- **One shared 36-colour value ladder.** `src/hero/palette.mjs` is applied to
  every crop (ordered dither perturbs palette choice, never emitted RGB), with
  dark values hue-shifted toward blue/violet and highlights toward brass/ivory.
  Final audit: **0 off-palette pixels, 0 transparent pixels**.
- **Cool ambient + warm local light.** One discrete cool ambient step globally;
  seven small local pools driven by the real `light_radial.png` alpha crop
  quantized into **four hard bands** (no runtime gradient). Warm pixels
  `13633`, cool pixels `25216`. Light direction is fixed 45° upper-left.
- **Conservative shadows.** `contactShadow()` is ≤1 tile; the scene's maximum
  drop is `12px`, alpha cap `110`; `shadow_edge` is a real prototype alpha crop
  at the wall foot. No cast-shadow system, no pillow shading.
- **Hierarchy / leading lines.** Dark sparse foreground pillars and crates,
  highest-clarity midground medallion + hero landmark, lower-clarity
  background wall/rock. Horizontal conduits with inward chevrons and the
  vertical processional aisle converge on the lens.
- **Hard edges / y-depth sorting.** No anti-aliasing, no bilinear scaling; all
  21 objects are serialized in ascending `foot_y`, background `104–210`,
  hero `260`, foreground `348–360`.
- **Functional spaces.** `lens_chamber`, `west_retreat`, `east_retreat`,
  `south_observation`, `north_wall_service` — informed by the `argus_l2`
  spatial thesis (`po_academy`, anchor `[936,262]`, zones `[14,8,20,16]` etc.).
  **This is presentation only**: it exports no collision, stairs, teleport,
  hazard, POI interaction, power state or gameplay semantics.

## 3. Comparison against the staged L06 / L09 references

References read directly at their staged paths (native 1280×720 captures with
HUD; **comparison only, not donors**):

- `assets/source/prototype/references/docs_chapter1-visual-overhaul_L06_images_after_landmark.png`
- `assets/source/prototype/references/docs_chapter1-visual-overhaul_L09_images_after_entry.png`
- `assets/source/prototype/references/docs_chapter1-audit_L09_mosaic.png`, `assets/source/prototype/references/docs_chapter1-audit_detail_line_L09_iron-run.png`
- `assets/source/prototype/docs_chapter1-visual-overhaul_architecture-breakthrough_DESIGN_REVIEW.md`

| L06 / L09 quality (and the L05 design review) | This scene | Honest gap |
|---|---|---|
| One value ladder: near-black surround < socle < wall field < floor < cornice < bright wall top | Five explicit wall courses + cool floor + bright cap, all remapped to one 36-colour ladder | The wall field and floor remain closer in value than the Monastic Archive reference; no full wall-top plane or carved depth |
| Contact shadows at every wall foot and prop foot | Real `shadow_edge` alpha strip + 16 conservative per-prop shadows (≤12px) | No soft penumbra / baked per-tile occlusion on every prop |
| Cool base with small hot local pools | Cool global ambient + 2 braziers, 2 sconces, cool crystal/lens pools in 4 hard bands | Pools are discrete bands, not Godot `PointLight2D` composition; still simpler than the reference's light layering |
| Objects, not textures; one destination; secondary objects ranked by size | One derived lens landmark on an 81-crop real medallion; arch/towers/pylons/braziers ranked below; quiet floor | Fewer object-scale props (no shelves, doors, hanging lamps, armarium) and no character/NPC scale reference |
| Leading lines, observation spots, dark foreground frame | Conduits + chevrons + vertical aisle, rails, south observation dial, dark foreground pillars | Foreground is a simple frame, not a dense stage; no gameplay HUD or avatar |
| Native Godot 4.7 camera at 1280×720 with entities and gameplay | Node/PNG native `640×360` **1×** render from exact donor crops | **Not a native Godot frame.** No runtime, import, collision, player input or capture pipeline |

**Verdict of the comparison:** the rebuilt scene is a coherent, provenance-safe
single-room composition with a clear destination and honest kitbash discipline.
It is **not** as convincing as the L06/L09 native references, and no parity or
creator acceptance is claimed. The 10 old screenshots remain **REJECTED**;
`paired` Greywater→Argus remains only a traversal-route thesis.

## 4. Verdicts and boundaries

```text
hero_scene          SINGLE_PROVENANCE_BACKED_VISUAL_CANDIDATE_BUILT
donor_proof         EXACT_SHA_RECT_FRAME_VERIFIED (12/12 strict QA checks)
creator_visual_review NOT_REQUESTED_NO_WEAK_ITERATION_APPROVAL
playability         PLAYABILITY_UNPROVEN
gameplay_integration GAMEPLAY_INTEGRATION_BLOCKED
native_godot        NOT_CLAIMED_NO_GODOT_4_7_SCENE_OR_IMPORT
```

Still missing before full delivery: owner A0/A1/A3/A8/Gameplay semantic
commitments; C01–C24 same-SHA Godot/source proof; four spawn walks, three
builds, 2+ POI access/retreat; 336h E2; a current native Godot 4.7
scene/import/captures/test; independent playability; creator acceptance.
Legacy compiler-only verdicts `TECHNICAL_PROVEN_WITH_VISUAL_REVIEW_REQUIRED`
and `READY_FOR_CREATOR_VISUAL_REVIEW` are obsolete and were replaced in
`src/tools/qa.mjs` / `qa/results.json`.

The browser tool (`/`, `/src/app/hero.html`) is a review surface, not a second
gameplay engine. `npm test` is legacy compiler/data QA only; `npm run hero:test`
is the new scene QA; `npm run test:browser` is a headless-Chromium smoke test.
None of these substitute for native Godot proof.
