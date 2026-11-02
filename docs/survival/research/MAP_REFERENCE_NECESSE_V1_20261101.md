# SOH Research Field Notes 01 — Necesse 1.0 World & Pixel Map (2026-11-01)

**STATUS: EVIDENCE-BASED RESEARCH / NOT FINAL SOH ART REFERENCE / NO AUTHORISED MAP REDRAW.** Creator authorized research into Necesse then Core Keeper, era-accurate Last Island world-placement, and finally SOH full paper map. Do not dispatch existing map audition designer or edit geography from this document.

## Source identity and chronology
- Fair Games presskit dates **1.0 to October 16, 2025**; the 1.0 changelog introduces **infinite seamless world generation and biome blending**, changing from discrete islands; multiple settlements and map exploration adjusted. https://necessegame.com/presskit ; https://necessewiki.com/Version_History ; https://steamdb.info/patchnotes/20422048/
- Developer's Sept 26, 2025 25-minute world-gen explanation exists; October 18, 2025 analysis of its layered map preview suggests large biome fields → ocean/rivers → caves and authored places → local details. **This is a public developer demonstration/media summary, not a reimplementation or source-code access.** https://store.steampowered.com/news/posts/?appids=1169040&enddate=1760547621&feed=steam_community_announcements ; https://gameoneer.com/necesse-introduces-infinite-seamless-world-generation-in-1-0-update/
- **Important visual provenance:** official screenshot gallery might be older/undated; Feb 2025 river/swamp/snow illustrations below are **PRE-1.0, visual grammar only**, not confirmation of infinite-world region placement. Keep them explicitly version-labeled.

## Six empirical scene references and SOH transfer
| Study | Source/image | What is visibly learnable | SOH transfer and caveat |
|---|---|---|---|
| S1. 1.0 worldgen macro | [Oct-2025 layered world preview](https://gameoneer.com/wp-content/uploads/2025/10/Necesse_map_Layers-1024x576.jpg) | Nonrectangular large water/biome bands and rivers are generated before local sprites; it is a **debug/editor map, not playable HUD** | Geology+drainage/climate before POI roads; keep SOH fixed continent, do not copy infinite generator |
| S2. Official settlement | [Presskit settlement overview](https://necessegame.com/content/screenshots/10-Settlement%20overview.png) | Functional buildings, fenced crop/animal plots, connected path grid, quiet yards, coastline as edge; exact screenshot version undated | Waystation must have lawful activity/road/access/yard, not arbitrary fence/cart props or false story state |
| S3. Production farm/housing | [Steam community farm screenshot](https://images.steamusercontent.com/ugc/18218365503604285882/515327747C488F991938AB67B02A5C59033A034B/) | Work zones and enclosed production lanes visually distinct, enough collision/transport space | Home room→storage→station→garden→outpost logistics must connect in real gameplay, not decorative crop |
| S4. River/water route | [Feb-2025 rainy river](https://res.cloudinary.com/ddbybfkod/image/upload/v1740745909/blogs/Nemanja/getting-started-in-necesse/img3_tei8gp.jpg) | Water corridor, separate sandy shore band, trees set back, player/navigation during rain | In SOH authentic shallow shore vs impassable deep water, ford/bridge/boat risk and physical input; **pre-1.0 illustrative** |
| S5. Marsh ecological floor | [Feb-2025 swamp](https://res.cloudinary.com/ddbybfkod/image/upload/v1740265585/blogs/Nemanja/what-the-necesse-swamp-biome-offers/img1_nyghih.jpg) | Marsh grass/peat/mud, mushrooms/reed/clusters and sizeable negative-space corridors; biome != teal overlay | SOH walkable bog+true water+hazard cues must agree with world authority; **pre-1.0 illustrative** |
| S6. Snow and landmark | [Feb-2025 snow](https://res.cloudinary.com/ddbybfkod/image/upload/v1740581779/blogs/Nemanja/necesse-exploring/img1_srxpkd.jpg) | Dominant coherent snow material with few contrasting trees, obvious building/shore silhouette | SOH Frostcrown needs clear snowline/heat shelter/retreat, not universal blue palette; **pre-1.0 illustrative** |

## An unusually instructive v1.0 numeric fact — settlement *functional* scale
Necesse [Settlements wiki](https://necessewiki.com/Settlements): v1.0 standard settlement 80×80 **Necesse tiles**, 5×5 fixed 16-tile regions, expandable to 112×112, 144×144, etc.; pre-v1.0 240×240. Area is work-boundary, not house footprint, with valid beds/enclosed rooms, zones for farm/forestry/animals, seed chests, production workstation chains and real job travel. **Do NOT convert directly into SOH's 16px/tile or assign SOH home a fixed 80×80 footprint**. The lesson is dedicated usable work/transport space, logical zoning and access.

## SOH measured baseline and hypothesis — current A1 source at ce9d4ba2d
- `data/survival/world/world_plan.v1.json`: 1024×768 **16px tiles** = 192 64×64 chunks; 11 regions, 22 biome keys; 118 POI (10 old retained + 108 new planned), 106 WORLD_SITE_CONTRACT_ONLY in content readiness, *not playable*; 33 resource sites/178 node records, not all production spawned.
- Physical gameplay logical camera 640×360 = 40×22.5 SOH cells. **128px tree height = 8 cells, ~35.6% screen height** at 1x. This exposes why dumping native-size CraftPix or blindly 0.5× scaling every tree is untenable.
- Source metadata records straight-crossing **~170.7s horizontal/~128s vertical at 96px/s**. These are ideal straight-line arithmetic, **NOT** physically measured A0 traversal; actual paths, inventory, time, adversaries, water hazards and stamina need empirical G3 checks. Do not enlarge the world immediately; first audit 14-day meaningful exploration/travel-to-site distances and return costs.
- Original A1 map art and creative Pilot1–3 failed creator visual acceptance. Their source/pixel test improvements are research, not production quality references. True long-term quality requires topo→materials→routes/roads→POI function→bounded vegetation clusters→day/night hazard readability→native 3-camera player travel, with full source rect/provenance and D051 male/female, no old Knight.

## Transfer proposals to approve/disprove together
1. **Geographic grammar:** geological height/watersheds/soil/snowline/peat-water fringe first; roads/settlement history next; authored sources and buildings after; foliage as locally causal accents last.
2. **Purposeful pixel hierarchy:** every 640×360 live frame can reveal actual player, safe route and/or valuable optional detour, physical hazard and a coherent landmark. Empty space has navigational value.
3. **Function-sized POI:** house/forge/orchard/quarry/Waystation separate main entrance, exit/retreat, equipment/hazard and storage/production routes; no false walls, loot, or POI states.
4. **Module grammar:** source-backed 16px floor road straight/corners/junction/endcap, wet/dry/cliff bank masks, prop occlusion/collision, distinct night/season layers. No arbitrarily shifted 2px crops or raw commercial ZIP redistribution.
5. **History/recurrence:** real 336-hour online/offline changes, farm/workshop value and final72 Ragnarok territory/hazard readability; no compulsory boss/forced quest or fake simulator progress.

## Upcoming evidence requirements
- Continue Necesse v1.0-specific capture verification: at least 3 in-game dated v1.0 frames (avoid attributing Early Access images to seamless world) and actual tile/pixel ratio measures where zoom known.
- Phase 02: **Core Keeper** regional material/biome/POI/light and non-cluttered composition at player scale.
- Phase 03: **Last Day Rules/Last Island H1 Mar–Oct 2019** physical map vs **H2 November 2019** redesign, correct game identity and distinguish map footprint fact from inference. Primary SOH Last Day Rules atlas remains canonical.
- Phase 04: SOH *paper-world* sheet: geo/region ecological polygons, roads/crossings, source+POI economy/time paths, home-buildable candidate distribution, six Elder territories/last72 change, 1x camera composition sheets, versioned per-asset BOM. Only creator-approved masterplan may alter geography after A0 migration/G3 test, never unilateral A1 edits.
