# VEYRA — R5 world exploration preview (81 canonical POI IDs)

## Quick start

Open `PLAY_VEYRA_WORLD_R5_81_POI_SIX_ELDERS.html` directly in desktop Chrome/Chromium. No local web server required. Select **New run → Creator Inspect → World Map**, choose a POI, then **Inspect & Play**. Use keyboard/mouse controls shown in game; press **E** at an actual stair/hatch. The creator inspector is a QA fixture, not production world progression.

The game includes Arena's newer pixel-art source integrated into the existing VEYRA browser gameplay engine, six distinct Elder exploration layouts, and three **explicitly provisional** C03 landing plans.

## Six boss-area landmarks (architectural only)

| Elder | Canonical POI ID | Exploration premise |
|---|---|---|
| Aion | `po_elderwood` | Root sanctuary, under-root hollow, bough walk, crown overlook |
| Anubis | `po_necropolis` | Processional tomb avenue, ossuary, guardian terrace, solar parapet |
| Argus | `po_hall_eyes` | Observation hall, archive below, watchers' gallery, third eye |
| Atlas | `po_gate` | Giant grounded gate, anchor vault, upper arch span, keystone |
| Surtur | `po_surtur` | Volcanic forge shrine, undercroft, chimney rim, crown |
| Typhon | `po_typhon` | Fracture canyon, under-cleft, surviving skybridge, high rim |

The bosses themselves, AI, telegraphs, combat/VFX, progression rewards and save/loot authority are **not provided in this release**. The monumental sprites are provisional hand-authored pixel art, not the existing native boss assets. Visual polish is **not** approved. The 6 POIs have distinct multi-level spatial layouts, not six fully playable boss encounters.

## C03 recovery status — non-authentic

`po_strait`, `po_mere`, `po_southfoot` are placeholders built from verified GOLD identities/positions. They are **NOT** the missing original C03 Breakthrough authored implementation. Do not overwrite or present these as C03 canon; replace with original if recovered.

## Verified QA and its limits

- 81 unique canonical IDs in registry; 81 architectural plans compile with **zero `issues` in available plan compiler** (see `EVIDENCE/architecture_all81.json`).
- All 6 boss areas have 4 levels `[-1,0,1,2]` and 3 defined connections; **12/12 ground-level Elder stair targets reachable by engine's actual pathfinder**, recorded in `EVIDENCE/qa_elder_and_c03_routes.json`.
- C03 provisional three landings: **3/3 ground-to-upper ladder endpoints** reachable by engine pathfinder.
- One Necropolis E input test (`0 → -1 → 0`) performed using player keyboard input, not an exhaustive playthrough of all stairs or all POIs.
- Representative scenes rendered in Chromium, no JS page errors in completed test runs. See `EVIDENCE/VEYRA_SIX_ELDERS_ACTUAL_GAMEPLAY.jpg` and individual scene shots.
- **Not validated:** full 81 consecutive human walk-throughs, every stair by E, high-end art acceptance, boss combat, true C03, native Godot integration, network deployment, complete lore/loot/enemy systems, and source Vite production rebuild from this R5 patch.

## Source and reproducible rebuild

The source additions live under `SOURCE/`:
- `rest48_r5.ts`: full REST48 authored site grammar, including six dedicated Elder plans, used by R5.
- `c03_recovery.ts`: temporary three C03 plans; non-canonical source.
- `elder-art.js`: independent procedural pixel-sprite factory for the six Elder landmarks.
- `elder_six.tsfrag`: separately extracted six Elder design code for inspection (already included in `rest48_r5.ts`; **do not insert twice**).
- `decor-client-reference.ts`: renderer reference from the R5 working patch, for careful transplantation; **not proof of native branch source compile**.
- `BUILD/build_world_portable.cjs`: optional exact standalone rebuild; requires Node.js and the TypeScript npm module or globally installed TypeScript; consumes bundled `BASE/R4_WORLD_ASSET_BASELINE.html`. From the package root, run `node BUILD/build_world_portable.cjs`. Validate output against `EVIDENCE/R5_RELEASE_MANIFEST.json`.

The embedded browser game is the **playable deliverable**. The source above represents the R5 delta relative to the previous R4 standalone. It is not a standalone native Godot port and should not be merged into production without a reviewed source integration and real Vite build.

## Custody

GitHub workspace branch: `game/veyra-81-poi-art-battle-20261109` of `Khanh-glitch/Soul-of-Hero`. Do not merge to production. The complete big-file standalone and its R4 baseline are attached to this package rather than silently claimed to be built into the repository's current Vite entry point.
## Source registry and renderer handoff

The isolated branch now also registers **81 authored canonical POI IDs** through `web/src/veyra05/arch/sites.ts` and connects the C01/C02/C04/F03/Elder sprites through `web/src/veyra05/decor-client.ts` and `elder-art.ts`. TypeScript architecture registry check: 81 unique IDs, zero missing, zero `compilePlan` issues. The full branch Vite build remains **UNVERIFIED** here because upstream Vite/@noble modules and geography `?raw` imports were not installed. The browser standalone distributed in the ChatGPT R5 ZIP is the verified playable candidate, not this branch's built output.
