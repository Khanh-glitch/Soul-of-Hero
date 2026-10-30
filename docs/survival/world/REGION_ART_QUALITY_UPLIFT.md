# A1 regional art quality uplift — CT dabf7bf5 image findings

Status: **SOURCE + PILLOW VISUAL UPLIFT; NATIVE / GOLD / A0 PRODUCTION UNKNOWN**. PR20 remains open/unmerged. This pass changes shared atlas/scene-generation source, not screenshot paint-overs.

Before reference: `dabf7bf516a80b112821b51d07e4dfe5fcb9a765`.
After reference: the commit containing this document on `arena/e385312a-soul-of-hero`.

## What changed visibly

- **Pearl / Ashwater:** broad plank carpets replaced by narrow maintained pier spines snapped to source road cells, transparent wear off-spine, rail/posts/lanterns, larger Customs/Pump silhouettes, root/channel/peat detail clusters. Night views keep destination + hazard cues lit by A1-private lantern pools.
- **Mirrormere:** reed shelves, banks, small docks, ferry/boat/trap activity, weathered causeway variation and lanterns; open water remains water.
- **Embersteppe:** larger forge with chimney/piping/slag/cooling trough, low-contrast broken track wear instead of crosshatch corduroy, gas/route contrast and night forge framing.
- **Verdant:** canopy/understory/root/liana layers, karst boulders, temple terrace detail, spore hollow cues and marked lanes.
- **Glasswind / Saffron / Sunken:** keeper shed/driftwood/storm glass/dune ridges; shallow brine pan with salt crust/shade/rakes instead of painted-over water; cenote steps/orchard walls/fissures/understory.

Algorithmic transition/shore masks remain system variants, not a quality count. The meaningful additions are purposeful pier/causeway families, transparent wear, ecological decals, larger destination silhouettes and layered vegetation/industrial props.

## Exact-camera evidence

`docs/survival/world/evidence/quality_uplift/` contains per-region:

- `*_1x_before_after.png`: day/night, exact 640×360 logical player camera. Before art is rendered from the pushed `dabf7bf5` atlas/doc using the after camera, so the comparison is not a camera move.
- `*_5x_before_after.png`: corresponding 5× nearest crops with a marked 12×16 technical proxy. Knight is not D051.

Standalone after previews remain `docs/survival/world/evidence/world_art_*_*.png`. These are Pillow/atlas renders, **not** native Godot captures.

## Frozen consumer safety

- `first_hour_visual_payload_lock.v1.json`: old Crown/Amberwood/Frost payload keys (`ground`, `overlays`, `props`, `lights`, `capture_views`, ambient) match `ad39bde6`; 145 old terrain crops and 36 old prop crops are byte-frozen.
- `a8_used_crop_lock.v1.json`: A8 PR26 `0e22d5f0` used crops still match: **23 terrain / 25 props**. No wholesale A8 reimport is required.
- Impassable source water remains visually water/brine; maintained overlays are validated against source road/bridge cells.
- Ten inherited dungeon thresholds, world plan, chunks, corridor, rewards, stands and collision authority are unchanged.
- A0 production mount remains false. A0 PR21 still pins older atlas manifest `617fc36d…`; the new global atlas manifest `83d69373…` cannot be silently dropped into A0. A0 may continue B0 Waystation integration on older `ad39bde6` art in parallel.

Current atlas bytes:

- terrain PNG SHA256 `6128d8f41abe6962fe705431db20e762e0cca613ffc3eca29065727422737d1c`
- props PNG SHA256 `8d4acf4028e0e065b901e78c59c65e5a68677fb75d46c04c7e5a029a76d27324`
- atlas manifest SHA256 `83d69373ca6c1258e8727800d0aa0c288851c34d25539c69c21ec9f5fc9d769a`
- mount bundle SHA256 `c2e5c596a8f60f12073593c084c3087465ae459f3201d97ca78279c503eadf38`

## Gates

- `tests/survival/world`: **126 passed** (121 prior + 5 new frozen-consumer/visual-rule tests).
- world/slice/connector/corridor/world-art/mount-bundle validators: **0 errors**.
- region coverage/BFS/water-nonwalkability: **0 errors**.
- determinism: **260 artifacts**, tree `cfd88ee5c50acf1db42e7f8607dbcc9a7f1b601c3941312f106c85869319f12b`.
- gdparse/YAML: clean.

## Remaining honest limits

- Native 720p/1440p/2160p captures, exact Gold parity, A0 camera/collision/y-sort/day-night integration and human playtest remain **NOT_TESTED / UNKNOWN**.
- D014 final art kit and D015 final world dimensions/partition remain **OPEN**.
- Saffron is still a sparse working pan by design; Mirrormere still contains broad open water. These are now ecologically framed rather than empty schematic fills, but native camera review may still request density changes.
- CPU contrast study is not Gold. A1 lights use private mask 2; original AVFX Gold remains mask 1 and untouched.

Pause condition: source art is independently inspectable at 1×/5× and pushed to PR20. Further useful art changes should wait for concrete A0 native camera/scene feedback or A8 consumer feedback.
