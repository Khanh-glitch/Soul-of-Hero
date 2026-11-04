# CORRECTION — Reuse SOH existing art first (WMP-04R1)

The earlier board compared **weak custom LAB renders** against SOH. Those labs did **not use SOH's existing native snow/ice/cliff art**. Direct Gameplay source audit confirms `web/src/game/render.ts` already contains `T.SNOW`, `T.ICE`, `T.HILL`, `T.CLIFF`, `T.SAND` and wave materials; `web/src/game/art.ts` already contains `snowpine`, `rock`, ore and vegetation sprites. The earlier conclusion to acquire or manufacture an entire winter tileset is **withdrawn**. No redundant new asset work authorized.

Use the renderer and sprites already in SOH at exact GameRoot first. Only explicitly demonstrated missing features may warrant an asset request. Current R1 geographic correction restores 510/510 rocks and reduces inland snow while keeping northern 23%.

---

# Independent five-scene visual inspection (04 Nov 2026)

Viewed the actual CI browser screenshots at 1x. **All five LAB outputs REJECTED as game-art improvements over the frozen SOH Web**. They are useful source-compatibility probes, not choices to approve.

- **Forest:** Cainos yellow/olive tree palette, patchy empty ground, weaker canopy masses, path texture and focal placement than Web. Preserve Web baseline.
- **Snow:** white floor, un-snowed olive trees, no elevation/cliff, snow-on-roof/stone/vegetation or settlement identity. No qualified snow kit exists in inspected inventory.
- **Arid:** huge uniform blocks, sparse tiny crops, no convincing dryness, route, POI landmarks or safe resource affordance. CraftPix Island whole-kit style clashes with Web.
- **Deadly and geothermal seas:** flat tinted water lacks SOH Web wave movement and shoreline hierarchy; an arbitrary demonstrative sea bridge was found and removed (no authored bridge at that location).
- **Argus architecture:** prototype building props show vocabulary, but random scattered structures are not modular authored architecture; Great Lens comparator is itself a non-native Lab with one AI-derived hero prop.

**No winning tileset and no production art approval.** Source triage result: keep SOH forest/terrain/waves, selectively audition physically-scaled compatible props only, prioritize making a real custom 16px winter/transition kit and a quality-controlled arid family. Independent native same-camera Gameplay capture is next acceptance gate. The revision also changes forest sample to 1100×650 AU (no unintended snow) and removes decorative quality-percent metrics.

---

# WMP-04 ART AUDITION 01 — source triage and 640×360 comparative lab

**Status:** `ART_R_AND_D__NOT_NATIVE__NOT_PRODUCTION_APPROVED`.

## Files and reproducibility

- [Offline source-backed board](AUDITION_01_REAL_ASSETS.html): 13 PNGs embedded from exact source Git blobs, original raw bytes; 5 tabs, real Web baselines separated from diagnostic lab syntheses; 640×360 nearest-neighbor Canvas using effective WMP-04 biome raster.
- [Browser QA script](test_board.mjs): tests scene switching, loaded source images, canvas output, controls, absence of page errors, writes five authentic **browser-rendered LAB** evidence captures and JSON checksums; no gameplay evidence claimed.
- [Automated workflow](../../../../.github/workflows/wmp04-art-audition.yml): npm-pinned source-test and artifact output, no new GameRoot or arbitrary art claim.
- [Active Map](../../CURRENT_WORLD_MASTER.json): WMP-04 geographic masks.

## Source and rights ledger

All source PNG paths and Git blob SHA-1 are embedded in the board as SOURCES, tied to Map HEAD `103a755477a8086ff29c11aad0fcbdeab6900165`. Four provenance classes: frozen real Web capture, native-looking but non-GameRoot LAB, third-party actual donor sheet, prototype-grown sheet. CraftPix licensing refers only to provenance/reference stubs in `world_lab/ASSET_LICENSES.md`, not a creator rights sign-off.

## Preliminary design direction

| WMP-04 scene/family | Preferred direction | Status | Evidence restriction |
|---|---|---|---|
| Native forest/ocean Web | Preserve original SOH rendering, wave patterns, HUD, readability | RETAIN | A/B/C legacy review rejects C as inferior and B too pattern-heavy |
| Snow 24% Typhon–Argus | Dedicated true 16px snow/autotile, cliff, evergreen frost, building roofs, water ice edges needed | **NO QUALIFIED SOURCE KIT** | Palette-changing Cainos source is a LAB demonstration, not snow sprite asset |
| Dry/arid +30% | SOH Web soil/paths, selective small crop donor shrubs and arid foliage after exact-license and integer scale acceptance | PARTIAL | CraftPix Island saturated cyan/yellow look incompatible as whole-world atlas |
| Western deadly sea + Cinder hot sea | Keep SOH base waves; design readable above-water events (wake, foam, steam, heat/refraction), anchored to WMP04 marineRegion masks | PARTIAL | Static ocean palette cannot prove ocean hazard or Leviathan |
| Port/Argus monumental | 16px prototype gatehouse/relay/vigil for modular building mass; CraftPix bridge isolated trial only | PARTIAL | Different orthographic grammar and collision/roof semantics unresolved |

## Quality gate (creator-facing)

Do **not** mark any source as winner solely from this board. Before production atlas and native adoption:
1. Use exact WMP04 current pointer and Gameplay latest head.
2. Same camera/time/character/route BEFORE vs proposed scene in native GameRoot 640×360 at 1× (and nearest-neighbor scaling up).
3. At least one snow-highland POI with cliff/canopy, one arid road/resource, one geothermal shore and one western ocean route/Beacon landing; preserve base SOH forest and wave visual identity.
4. Original material IDs, walkable/water permission, POI doorway, collision/LOS, save & offline must not be broken; no hard-coded ferry-only routes.
5. Sprite ledger exact SHA/rect, pixel sizes and rights on each used asset; avoid mixing topdown/3Q perspective or making 16px scene from arbitrary noninteger donor resampling.
6. Creator chooses world art direction from actual native visuals, not fake Web screenshot or the source-atlas contact sheet.

**Owner:** Map/Art audition. **Not executed here:** Gameplay runtime ingestion, authoritative temperature/wetness behavior, monsters/helicopter scenes, tile atlas integration. No new prompt to paused Map Agent required to understand this report.
