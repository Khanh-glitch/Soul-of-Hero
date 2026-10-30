# Research, Source Coverage, and License Decisions — SURV-050A

## Required internal reading completed

- `AGENTS.md` and the complete assigned `SURV-050A_A1_WORK_ORDER.md` (from the assigned A1 ref; the active integration checkout lacked the task file).
- `docs/survival/NEW_CHAT_BOOTSTRAP.md`, `CONTROL_TOWER_CURRENT.md`, `SYSTEM_FUSION_BLUEPRINT.md`, `DECISIONS.md`, `MULTI_AGENT_EXECUTION.md`, `INDEPENDENT_DEEP_REVIEW_PROTOCOL.md`, contracts/acceptance/reconciliation/economy/replay/STATE/WORKLOG/change-protocol/sources/research-log/Docs-audit documents.
- Original Atlas: `docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md`, read in full (1,355 lines). SHA-256 `b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157`.
- `docs/survival/SOURCE_COVERAGE_TRACE.json`: 108 entries (44 SYS + 21 POI + 31 DEP + 12 JOURNEY), 40 unknowns marked `FACT_UNVERIFIED_NOT_DESIGN_STALL`, 28 refs. SHA-256 `602735e9d2be20d88b7a49007e6e7cdc78832744b554962c96ec5ad74e4bfd37`.

## Actual SOH runtime seams inspected

- `game/overworld/chapter1_overworld.gd`, `overworld_world.gd`, `overworld_traversability.gd`, `overworld_state.gd`, `overworld_tiles.gd`; Knight `move_speed = 96.0`.
- Production data: `data/overworld/hollow_marches.json`, `_layers.json`, `_props.json` (13,299 props), tile/prop registries, landmark registry, patches.
- World truth: 384×256 tiles, TILE 16, spawn `[56,218]`, camera zoom `Vector2.ONE` (JSON zoom 2.0 is stale), viewport 640×360 ≈ 40×22.5 tiles.
- Collision oracle: solid RLE OR lower-body prop rects (`w*0.82`, `h*0.42`), 4-neighbour flood. Fresh-save reachable cells: 62,201. All ten dungeon thresholds reachable with shortcuts closed.
- A0 seams read-only: `survival_service.gd`, `survival_build_system.gd`, `survival_state.gd`, `survival_catalog.json`, `hollow_marches_resources.json`. Build validator rejects outside/solid/water/protected/on-route/near-shortcut/out-of-range/occupied.
- Existing visual evidence inspected: `docs/overworld/evidence/overworld_world_overview.png` and station/shortcut evidence.

## External candidates inspected and pinned

| Candidate | Pinned commit | License finding | Decision |
|---|---|---|---|
| Azgaar/Fantasy-Map-Generator | `d279257a727c76dc310dc5859c4c797ca69db1dc` | GitHub field `NOASSERTION`, but actual `LICENSE` read: MIT ©2017–2024 Max Haniyeu; explicitly permits derivative maps/images. | Reference/adapt algorithmic ideas only (river/biome causality). No JS dependency imported. |
| m-w-marker/heightmap-level-generator | `43a525473f6ad070df4c46f34f701587a6059600` | MIT ©2026 Michael Marker. Deps: three/lil-gui/vite/WebGPU. | Reference Priority-Flood (Barnes 2014), flow accumulation, lakes, meander, grade-limited roads. 3D/GPU stack rejected for SOH. |
| Poissecaille/Eden | `7df234b0f9a78df3efcb181c3197b70c78b807f7` | No license file anywhere in tree. | Reject code reuse. Conceptual reference only for Godot 4 elevation/moisture biomes. |
| Herbak/proc-gen-maps | `dd51d3594410d05e5a30f4bf07abcbfaf03c2c82` | No license file. | Reject code reuse. Conceptual reference only for D8 priority-flood/flow/lake. |
| gdquest-demos/godot-procedural-generation | `19c98cee16ed18e642b3ce178f4c649d56b334b2` | Dual: source MIT ©2020 GDQuest; art/audio CC-By 4.0 attributing “GDQuest and contributors (https://www.gdquest.com/)”. | Safe to adapt code patterns with MIT notice; persistent sector modification pattern inspected. No art imported. |
| LehiSmart/IsometricWorldGen | unpinned | Search-only candidate. | Not used; WFC/isometric fit concerns. |
| Godot 4.7-stable Linux build | release tag `4.7-stable` | Engine build, not world content. | Download blocked by asset-host SSL; no native binary obtained. CI uses Godot 4.7.0. |

Pinned metadata/source/license files were fetched into `.arena/research/` during the session (local scratch, not committed). The committed deliverable contains no third-party code or art. The A1 compiler uses authored data literals, deterministic value-noise roughness, and original Python; it does not copy unlicensed Eden/Herbak code.

## Design consequences taken from research

- Causal chain first: geology/elevation/drainage → biome/moisture → material sources → gathering routes → refining/crafting → protective gear/credentials → exploration access → POIs → materials/recipes/Skill Cores.
- Hydrology: descending authored river control points with deterministic meander, lake outlets, terminal salt pan, and a dye-traced subsurface karst conduit. Priority-Flood/accumulation were studied as references; the committed plan uses authored drainage contracts rather than importing a GPU hydrology stack.
- Roads: trunk network with cycles and alternates; grade-limited routing studied as a reference. Native A0 pass should still verify slope/collision before playable claims.
- Persistence: static world truth is immutable; dynamic mutations are keyed by stable IDs. GDQuest persistent-sector pattern informed the separation, but no GDQuest art is used.
- Danger: environmental clues + preparation capabilities, not arbitrary level walls. Late core vaults require late-earned capabilities (`cap_seal_3`, `cap_deepward`, `cap_tide_ward`) so midgame preparation cannot bypass all late content.

## License compliance statement

No third-party source code, textures, audio, or generated art from the researched repositories is committed in this milestone. If A0/A5 later adapt MIT code, preserve the MIT notice. If any GDQuest art is ever imported, add CC-By 4.0 attribution to “GDQuest and contributors (https://www.gdquest.com/)”. Eden and Herbak remain reference-only because no license was found.

## Review-correction engine acquisition / fixture provenance (2026-10-29)

- Godot 4.7 Linux release asset download remained blocked by `release-assets.githubusercontent.com` SSL failure. No substitute engine version was used and no native result is claimed from the local sandbox.
- PyPI probes (`godot-binary`, `godot-engine`, `godot_bin`, `godot`) found no Godot engine binary; `godot` is an unrelated Python DOT-language package. It was rejected as an engine source.
- The A1-owned CI fixture uses the repository's existing `chickensoft-games/setup-godot@v2` action at version `4.7.0`, matching the existing survival/overworld workflows. The fixture project and reader/test scripts are original A1 work, not third-party code.
- The isolated reader fixture is read-only and does not import Godot procedural-generation demo assets, Azgaar code, Eden code, or any unlicensed source. Existing research reuse/reject decisions remain unchanged.

## 2026-10-30 — first-hour corridor art and streaming decisions

**Internal sources read:** CT seven-agent reactivation packet, D001–D054, Atlas POI-14/DEP-01/JOURNEY-01/02/SYS-50, A3 PR19 `sources.json` (`7c2cddcd…`), A8 PR26 site JSONs (`dcc7bbf6…`, `7bf9bd45…`, `9c9af244…`), inherited SOH art manifests, `OverworldWorld`/`OverworldTiles`, and the existing connector/slice contracts.

**Art decision for this checkpoint: REUSE inherited original SOH frames.** The corridor admits only frames whose `data/overworld/art_manifest.json` license is `original`: `camp_crate`, `signpost`, `cart`, `wall_stub`, `column_broken`, `tree_dead`, `bush`, `rock_a`, `rock_c`, plus the existing terrain/road/detail atlas. This avoids random style mixing, generic colored boxes, and unverified third-party license claims. Native compatibility is through the production `OverworldTiles`/`OverworldWorld` atlas path, not a parallel renderer.

**43 Craftpix packs: DEFERRED, not rejected.** CT D050 admitted 22 P0 / 18 P1 / 3 SOURCE_HOLD candidates, but the ZIP bytes are not in this Arena checkout and the Craftpix free license forbids raw-art redistribution. No new general-purpose inventory was opened. Minimal future admissions for this corridor, pending local bytes + license proof + native scale/palette review:

| Need | CT pack candidate | Decision now |
|---|---:|---|
| road/path edges | 574220 | BYTES+LICENSE VERIFIED; REJECT_IMPORT_STYLE_MISMATCH; original SOH road overlays used |
| trees | 385863 | PENDING_LOCAL_BYTES; inherited `tree_dead` used now |
| bushes/forest objects | 141354 / 505052 | PENDING_LOCAL_BYTES; inherited `bush` used now |
| ruins | 934618 | PENDING_LOCAL_BYTES; inherited `wall_stub`/`column_broken` used now |
| rocks/rocky area | 974061 / 639143 | PENDING_LOCAL_BYTES; inherited `rock_a`/`rock_c` used now |
| containers | 218281 | PENDING_LOCAL_BYTES; inherited `camp_crate` used now |
| village/buildings | 504452 / 812442 | PENDING_LOCAL_BYTES; not needed for the crate spur |

SOURCE_HOLD packs 351300/654184/749505 remain unusable until individually confirmed. Inherited `treasure_chests_1_2a` was not admitted because its bundled readme does not contain a standalone license grant; Cainos demo art was not imported because the archive lacked a standalone license document and the official terms need re-check before shipping.

**Streaming OSS reference:** `gdquest-demos/godot-procedural-generation` @ `19c98cee16ed18e642b3ce178f4c649d56b334b2`. Actual `LICENSE` read: source MIT ©2020 GDQuest; art/audio CC-BY 4.0. `godot4/infinite_space/persistent_world_generator.gd` inspected for separate modification dictionary + sector regeneration. Decision: **REFERENCE** the static-truth/mutation/active-window separation; **REJECT** importing GDQuest art or rewriting SOH into infinite procedural generation. See `STREAMING_EVALUATION.md`.

## 2026-10-30 world art production decisions

- **ADOPT / ORIGINAL:** `tools/survival/worldgen/build_world_art.py` bakes a shared SOH material-culture atlas (238 terrain / 45 prop frames). Palette, outline weight, 16 px grid, feet-anchor perspective and reserved accents are authored data in `world_art_grammar.v1.json`. File and pixel SHA-256 pinned in `atlas.v1.json`.
- **REUSE_UNSCALED:** nine inherited original frames from `assets/environment/overworld/overworld_props.png` (`tree_dead`, `tree_pine`, `bush`, `rock_a/c/e`, `signpost`, `wall_stub`, `column_broken`). No perspective/scale change; provenance recorded per frame.
- **REJECT:** Cainos demo art. Bright fantasy palette diverges from grey-violet SOH culture; A8 prototype resamples a 132×160 tree to 122×153 (~0.92×/0.96×); standalone license unproven. No bytes imported.
- **REFERENCE_ONLY:** GDQuest persistent-sector pattern (MIT code / CC-BY art) and Godot demo `2d/dynamic_tilemap_layers` @ `b761b4cd…` (MIT) for runtime tile update / per-layer collision disable. No art imported.
- **DRIVE VERIFIED / NOT_IMPORTED:** Google Drive connector enabled this turn; folder `1pRNobw2FrKWQmelMdGpGnh3PUHPijjA0` metadata lists 43 CraftPix ZIPs. Candidate 574220 path/road pack downloaded privately and byte-verified (size 1,205,980; MD5 `ff7fe573a16faf9e8fca62ad703527ff`; SHA-256 `302e8fa1da79163d2cd9da5ddfd7610bb0186b16de7f959b7d9a09ee4763e43c`). `license.txt` → https://craftpix.net/file-licenses/; Freebie terms permit game use/modification, forbid source redistribution. Actual PNG contact sheet inspected: **REJECT_IMPORT_STYLE_MISMATCH** (bright cartoon cobble/grass, outline density). Raw ZIP/extracts remain in excluded `.arena/drive_verify/`; no CraftPix bytes committed. Remaining 42 entries stay NOT_IMPORTED until individually verified. User-fixed bald avatars 555940 / 419402 untouched.
- **A8 VISUAL CONTRACT:** `a8_visual_contract.v1.json` records executable requirements and PR #26 divergences A8-VIS-01..07. A8 keeps creative control and interaction engine; A0 alone mounts production.

## 2026-10-30 native-engine acquisition: demonstrated hard blocker (not a retry loop)

- npm `@ringozz/godot` 4.7.2-680 optional platform builds are only `web-wasm32`, `macos-arm64`, `windows-x86_64`; **no linux-x64 engine** exists on the registry. `@volter/browser-godot` is a 23KB TS bridge, not an engine. PyPI has no Godot engine package (only gdtoolkit/scons).
- GitHub release binaries redirect to `release-assets.githubusercontent.com` (blocked). codeload source tarball is reachable but building needs scons+GL/X dev headers and >available cores/RAM; not a viable native path here.
- Sandbox has **no** libEGL/GLX/X11/mesa/OSMesa/Xvfb; `apt-get` is permission-denied and Debian egress is blocked, so no rendering context can be created even with a binary.
- Therefore genuine native frames are a **hard external dependency** (CI runner backlog). All owner-independent art/navigation/bundle work was completed instead; native/Gold/A6/A0-mount statuses remain PENDING, never claimed PASS.
