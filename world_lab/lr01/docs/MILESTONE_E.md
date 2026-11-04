# MAP-LR01 Milestone E — art provenance and native 640×360 in-world previews

**Status:** `MILESTONE_E__ASSETS_ASSESSED_INDIVIDUALLY__NO_CREATOR_VISUAL_APPROVAL`
These are **static geography QA views**, not gameplay scenes, not an asset
showcase, and not playable survival acceptance.

## 1. Individual asset review (11 records, 5 tiers)

`src/e_art.mjs` writes `output/art_manifest.v1.json` with tier, origin, exact
file/SHA (git object or workspace file), rights, individual assessment, decision
and reason. Seven image/code sources were **actually opened and inspected** at
native size before any decision:

| tier | asset | decision |
|---:|---|---|
| 1 | PR44 `web/src/game/art.ts` | `KEEP_AS_PRIMARY_WEB_BASELINE` — original pixel-art sprites; three 640×360 evidence captures viewed. Code-painted originals are the accepted source, not a defect. |
| 1 | PR44 `web/src/game/render.ts` | `KEEP_AS_WATER_BASELINE` — `texel()` material ramp, per-tile animated water, shore fringe, distinct fresh/salt palettes. `shipping-reloaded-640x360.png` shows the **large wave motifs and shore glints**. |
| 1 | PR44 `web/THIRD_PARTY.md` | `KEEP_AS_PROVENANCE` — OFL fonts / MIT libraries, **no third-party sprites, tiles or sound**. |
| 2 | A1 `terrain.png` @ `ce9d4ba2` (512×896) | `REFERENCE_ONLY__NOT_ADOPTED` — viewed: strong hard-edged 16px families and wave rows, but Godot `res://` path, darker denser value ramp, MAP-R01 unapproved. Palette/motif reference only. |
| 2 | A1 `props.png` @ `ce9d4ba2` (1024×794) | `REFERENCE_ONLY__UNVERIFIED_SUBSET_EXCLUDED` — viewed: houses/lighthouse/towers are stronger authored props, but no Web-native intake, unapproved branch, and the painterly tree subset has unproven rights (A1 license doc admits only nine `inherited_original` props). |
| 2 | MAP-R01 `soh_slice_atlas.png` + `frame_ledger.v1.json` | `REFERENCE_ONLY__NOT_ADOPTED` — viewed; 181-frame admitted slice, excluded `cainos_*`/`ocean_*` crops. Unapproved/unmerged research. **PNG atlas import is not proof of improvement.** |
| 2 | `web_art_patch/source/mapArt.ts` (B candidate) | `REJECT` — before/after 640×360 viewed side by side: replaces strong original trees with a repetitive dense canopy and adds procedural grass noise; stylistic inconsistency with the primary Web baseline. |
| 3 | A1 `RESEARCH_AND_LICENSES.md` | `PROVENANCE_ONLY` — Eden/Herbak rejected (no license), CraftPix raw-art redistribution forbidden, Cainos demo art REJECTED. |
| 3 | verified committed world-art libraries | `BLOCKED__NO_VERIFIED_WORLD_ART_LIBRARY` — only OFL fonts / MIT libs exist; repo `assets/` sheets have no verified redistribution rights. |
| 4 | Drive / CraftPix packs | `BLOCKED__NO_BYTES_NO_AUTHORIZED_ACCESS` — ZIP bytes absent, no authorized asset connector, license terms forbid raw-art redistribution. Exact restriction recorded; work continued independently. |
| 5 | external/generated for real gaps | `NO_EXTERNAL_ART_USED` — no gap needs a new pack. Previews are data-driven Map views, not a new asset pack. |

The **original Web ocean, large wave motifs and animated shore glints remain the
preferred baseline**. Static preview frames do not reimplement the runtime
animation. No unlicensed pack is published and no creator visual approval is
claimed.

## 2. Reproducible before / after / after_ui views

`tools/render_world.mjs` renders **18 native 640×360 PNGs** (6 stable regions ×
3 modes) from the verified GEO-01 rasters, canonical Veyra geometry, Milestone C
road/bridge data and Milestone D POI layouts. SVG is the reproducible source;
Chromium rasterizes it at `deviceScaleFactor=1`. Every view has recorded SVG and
PNG SHA-256, window and transform metadata in `output/views_index.v1.json`.

Regions: `zone_bz_greywater` (RT-1 river/bridge/`po_kilns` context),
`zone_bz_silver` (spawn/home), `zone_bz_hook` (coast/logistics),
`zone_bz_delta` (wetlands/distributaries), `land_ld_ironholm` (island/beaches),
`elder_el_typhon` (Elder outer/core/arenas/approach).

* **BEFORE** — flat GEO-01 raster diagnostic: raw biome/water cells, thin grey
  road centrelines, no art treatment, no transitions, no waves, no glints.
* **AFTER** — retained Web baseline language: hard-edged 1px material fringes
  derived from **actual neighbouring biome codes** (not procedural grass noise),
  dark-blue ocean with **large sparse wave motifs** drawn only across 3+ sea
  cells, static shore-glint frames at coast cells, separate lake/river palette
  (flat lake texture is **never** used for ocean), authored cart/trail roads with
  dark outline, bridge display glyphs, and POI/Elder/zone landmarks from
  Map-owned geometry.
* **AFTER_UI** — same scene plus a QA HUD frame (status, clock, hotbar) to check
  terrain and landmark **readability beneath UI**. Explicitly labelled
  `MAP QA · NO GAMEPLAY` / `STATIC GEOGRAPHY QA — NOT PLAYABLE SURVIVAL ACCEPTANCE`.

Transform metadata: `previewPxPerAu=2` for four regions → **one 8 au source cell
= 16 px**, matching Web's 16 px tile scale without canonizing U. Island/Elder
windows are wider (`1.8336` / `0.9982` px/au). `runtimeScaleStatus: UNDECIDED`;
these are Map geography QA views, **not** a native gameplay camera.

## 3. Visuals actually inspected

The agent opened and reviewed: the four PR44 640×360 evidence captures, the
`web_art_patch` before/after pair, the MAP-R01 slice atlas, both A1 sheets, and
the generated `zone_bz_greywater` before/after/after_ui,
`land_ld_ironholm` after (including a 3× crop to identify a two-cell snow patch
and confirm the large-wave treatment), `elder_el_typhon` after and
`zone_bz_delta` after. The snow palette was softened after that inspection.
No photographic/gameplay screenshot improvement is asserted.

## No-claims

No creator visual approval; PNG import is not proof of improvement; no strong
existing terrain replaced by an asset-backed seam; no unlicensed pack published;
no asset showcase presented as gameplay; no playable survival acceptance; no
runtime wave animation reimplemented; no approved 12-code→Gameplay biome mapping.

**Next:** Milestone F assembles the versioned **geography-only** handoff, exact
SHAs, capability/compatibility report, adapter spec and open Web integration gate.
