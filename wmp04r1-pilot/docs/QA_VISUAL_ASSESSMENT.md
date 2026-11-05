# WMP-04R1 visual QA — direct inspection of every real screenshot

All 16 native **640×360** captures and all 6 labelled **1280×400** same-camera
comparisons in `evidence/shots/` were opened and inspected directly. Nothing here is a
technical preview, a mockup or a re-drawn canvas. Every capture comes from the running
SOH Web renderer in Chromium 153 (`LD_LIBRARY_PATH=/tmp/al2023/lib`), viewport 640×360,
`deviceScaleFactor=1`, with `page.screenshot()`.

**Same-camera proof:** all 6 comparisons have `cameraDeltaPx = 0` and
`cameraExactlyEqual = true` (`evidence/qa-report.json`). The QA camera lock is released
by the first real movement key, after which the original player-following camera resumes
(verified: 184.8 px player displacement → 185.3 px camera delta).

## Per-scene assessment

| Scene | Material readability | Height / cliff composition | Forest density | Water boundary | Road legibility | POI scale / identity | Pixel-art coherence |
|---|---|---|---|---|---|---|---|
| 1 · baseline forest/coast (day) | Good: meadow/forest/sand/water all distinct | Flat 2D, no cliffs in view | Dense but readable; individual oaks/pines | Crisp stepped coast with wave lines | n/a | `Lighthouse Spit` label at correct scale | Identical to untouched Gameplay build |
| 1 · baseline (night) | Good: blue-dark tint + player light halo; trees still separable | as above | as above | as above | n/a | as above | Original lighting preserved |
| 2 · Typhon–Argus snow (day) | **Strong**: pale speckled snow, brown rock outcrop, green vegetation fringe, grey boulders clearly separated | **Weak**: WMP-03 cliff faces appear as flat dark-grey rectangles with crisp 8 AU cell edges, not vertical faces | Snow-pines + conifers sparse over snow, dense meadow/forest at the southern fringe | none in this window | Brown authored route visible | 9 GOLD POI footprints in window; no fabricated structures | Coherent with existing SOH sprites; no new tileset |
| 2 · snow (night) | Good: bluish snow still readable, player halo, silhouettes of snow-pines | Blockier in low light | as above | none | weak at night | as above | Original night lighting preserved |
| 3 · Oasis corridor (day) | Good: pale sand, dark brown dry-steppe patch, brown road band, green meadow fringe | No cliffs in view | Sparse scrub, palms, pebbles | Left-edge coast/water legible | **`Bone Road Waystation`** authored road band readable across the lower third | 7 POI footprints; name banner at correct scale | Coherent; road/dry-steppe contrast adequate |
| 3 · Oasis (night) | Readable but low contrast; road band blends with dry-steppe in dark | — | — | — | reduced | — | Original lighting |
| 4 · Cinder shoreline (day) | **Strong**: deep blue water with waves, tan beach strip, green forest island, dark volcanic ground with boulders/dead trees | Cliff ledges on the right are blocky but read as elevation steps | Dense forest patch in the centre, sparse dead trees on volcanic ground | **Crisp** GOLD coastline; no raster-square coast | Authored roads present | 5 POI footprints; Cinder POIs not all in view | Coherent; geographic danger shown as terrain, no invented damage |
| 4 · Cinder (night) | Dark but water/forest/volcanic still separable under player halo | — | — | — | — | — | Original lighting |
| 5 · Western Deathwater / Beacon Rock (day) | Clear: sand island, brown authored road/dock band, deep water with wave lines all around | No cliffs in view | Small green fringe only | **Strong** island/water boundary | Brown route band legible | `Beacon Rock Light` authored POI at exact helicopter coordinate; **no helicopter object** | Coherent; no fabricated landmark |
| 5 · Deathwater (night) | Readable under halo; water dark | — | — | — | — | as above | Original lighting |
| QA · dry-transition AFTER | Good: green meadow vs brown dry steppe clearly distinct, authored road band unchanged | No cliffs | Green meadow with trees; dry area treeless | — | Road band clearly separates the two | 10 POI footprints | Existing `T.HILL` palette reused |
| QA · dry-transition BEFORE | All green meadow + same authored road | — | — | — | same | same | — |
| BEFORE pairs (4 + dry) | Same GOLD geometry and same art mapping as their AFTER pairs; only source biome / WMP-03 cliffs / WMP-04 marine annotation differ | BEFORE has no WMP-03 cliff faces | Pre-WMP-04 forest/meadow | Identical coastlines | Identical authored roads | Identical POI footprints | Identical |

## World-coordinate differences vs rendering-quality differences

| Comparison | Legitimate world-coordinate/geography difference | Rendering-quality difference | Verdict |
|---|---|---|---|
| snow BEFORE→AFTER | 3,094 analytical cells became snow; restored rock outcrops; WMP-03 cliff faces; cold-transition classes; snow-pine distribution | **None.** Same renderer, same art mapping, same camera, same GOLD geometry. | Genuine WMP-04R1 geography delta |
| dry-transition BEFORE→AFTER | 790 `meadow → scrub_dry_steppe` cells; 10,720 changed diagnostic tiles in the AU `[1000,600]` window | **None.** Same `T.HILL` art mapping used in both pairs. | Genuine WMP-04 dry-region delta |
| cinder BEFORE→AFTER | WMP-03 cliff faces appear; WMP-04 static `marine_cinder_geothermal_strait` annotation | **None** in terrain art. | Genuine geometry + static domain delta; **no biome change** (honest: `changedSeaCells=0`) |
| oasis BEFORE→AFTER | **Zero** WMP-04R1 biome cells changed in the canonical Oasis window | **Zero.** Images are visually identical. | Correctly reports no delta; the dry delta is proven by the separate QA pair |
| deathwater BEFORE→AFTER | **Zero** biome cells changed; WMP-04 static `marine_west_deadly_depths` annotation added | **Zero.** Images are visually identical. | Correctly reports a static marine domain, not a terrain/AI/damage change |
| original Gameplay → pilot scene 1 | **Zero.** Same `shipping_fresh` world. | **Zero** in terrain, coast, forest density, HUD, quickbar, pixel-art coherence. The only visible differences are seed-dependent weather (`cloudy` vs `clear`), rain particles and 2–3 creature positions. | Baseline **not visually degraded** |

## Known visual weaknesses (REWORK, not hidden)

1. **Cliff composition.** `T.CLIFF` renders as flat dark-grey rectangles. At U=2 an 8 AU
   analytical cell becomes a ~4×4 tile block, so WMP-03 connected cliff faces look
   blocky. No random props were added to hide this. Needs a GAMEPLAY/art decision;
   `productionAtlas = NOT_AUTHORIZED`.
2. **Night road legibility.** Brown road and brown dry-steppe converge under the night
   overlay. Existing SOH lighting was preserved rather than brightened.
3. **HUD density.** The pilot geography annotation is QA text at 9px and can overlap the
   POI "Discovered" banner. It is not SOH art and does not alter the world.
4. **Canonical scene placement.** Two of the five requested windows contain no WMP-04R1
   biome change. Rather than fabricate a difference, the pilot reports this and supplies
   a separate measured dry-transition comparison.

## What was NOT done

No screenshot was retouched, upscaled, composited from a different renderer, or replaced
by a prettier mockup. No weak world geometry was covered with random props. No new
tileset was created. No screenshot was accepted as "visual approval".
