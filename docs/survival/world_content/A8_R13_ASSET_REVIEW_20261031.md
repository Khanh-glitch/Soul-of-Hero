# A8 R13 Quarry / Orchard art-source review

**Scope:** correction of the existing Quarry and Orchard interiors only. PR #26 stays open/unmerged on its existing branch. No POI identity, canonical cell, collision, doorway, transition, retreat, revisit, owner-authority, or SaveService change is proposed. Creator-confirmed rights are accepted; this note records source identity/pixels and art decisions, not a license re-review.

## Pinned source and adopted pixels

A1 PR #20 current source head reviewed: `e1e4e9a4d4a0f7f0d38360d638715a0c9f144208`.

| Source file | A1 SHA-256 | Dimensions | A8 decision |
|---|---|---:|---|
| `assets/environment/survival_world/terrain.png` | `6128d8f41abe6962fe705431db20e762e0cca613ffc3eca29065727422737d1c` | 512×880 | Byte-copy full atlas; all 1,759 terrain frames are available at current A1 coordinates. |
| `assets/environment/survival_world/props.png` | `8d4acf4028e0e065b901e78c59c65e5a68677fb75d46c04c7e5a029a76d27324` | 1024×572 | Byte-copy full atlas; all 138 props are available at current A1 coordinates. |
| `data/survival/world/art/atlas.v1.json` | `83d69373ca6c1258e8727800d0aa0c288851c34d25539c69c21ec9f5fc9d769a` | manifest | Full frame catalogue and current coordinates. |
| `assets/environment/chapter1/archive/light_radial.png` | `351ed8009dae7be3ae61c80f5161bce6984a4444576c7c5b51500f6fcea8d69e` | 256×256 | Adopt only for the A1 `lamp` in the owner-projected powered Quarry state. Art-only Light2D; no gameplay effect. |

Exact copied texture hashes, dimensions, atlas-frame catalogue digests, and RGBA crop records for the frames actually used are in [`a1_atlas_compatibility.v1.json`](../../../data/survival/world_content/a1_atlas_compatibility.v1.json). The five-frame Orchard mud/boardwalk strip is separately verified crop-for-crop against the full A1 terrain image. The full atlases supersede the previous small/old atlas workaround; this is not an A1 asset or geography edit.

### Frame use — Quarry

- Ground grammar: `ash`, `basalt`, `cinder`, `gravel`; `blend_ash_gravel_0..15`; `detail_karst_fissure_0..2`; `detail_cinder_scoria_0..2`.
- Physical route readability: `road_stone_0..15` beneath `track_stone_0..15`; the Y-shaped central return route and east/west branches are visual only and follow existing walkable geometry.
- Excavation/machinery: `lm_quarry_workface`, `rock_e`, `ore_skarn`, `wall_stub`, `mill_wheel`, `light_pool`, `pipe_run`, `pump_pipe`, `pump_tank`, `cooling_trough`, `lm_ashwater_pump`, `fence_h`, `fence_v`, `split_rail`, `deadfall`, `warning_stakes`, and the `lamp` frame `[714,2,16,34]`.
- Closed state retains the existing gate bars and unrevealed route. Owner-projected `quarry_deep_gate=open` hides only the visual bars, reveals a road/track into the deeper zone, and adds the A1 lamp plus its archive radial light. The physical gate/blocker and neutral owner projection remain authoritative; light creates no damage, cost, reward, or save change.

### Frame use — Orchard

- Ground grammar: `forest`, `grass`, `soil`; `blend_forest_soil_0..15`; source-backed `road_dirt_0..15` and `track_dirt_0..15`; `detail_orchard_grass_0..2` and `detail_mud_crack_0..2`.
- Irrigation/flow grammar: `water_0..2`, `detail_water_ripple_0..2`, and the existing A1 mud/boardwalk surface crops. Untouched remains the narrow channel; only `orchard_channel=flowing` widens the visual water surface and adds ripples. Depth remains UNKNOWN.
- Recognizable planted/ruined spaces use `tree_orchard`, `canopy_tree`, `tree_dead`, `orchard_wall`, `lm_orchard_shed`, `reed_bed`, `sluice_gate`, `boardwalk_post`, `split_rail`, `deadfall`, and the source irrigation group `pipe_run`, `pump_pipe`, `pump_tank`. The fixed boardwalk/door/retreat collision contracts are untouched. Graft-read storytelling is foliage, not an item grant.
- Trees opt into actor-relative depth sorting by their authored feet anchor. It changes draw order only; it does not add collision or move the Hero.

## Reviewed compatible candidates not adopted

These exact project files were opened as sprite sheets. The decision is visual/semantic: avoid splicing a different palette, perspective, or dungeon language into A1’s current 16px site grammar. No rights concern is asserted.

| Pack / inspected source | Identity | Review result |
|---|---|---|
| Cainos demo `assets/environment/cainos_demo/cainos_tileset_grass.png` | SHA-256 `3afee45fa3ab4f2908114d5caa84fad20df568e276782550d3e9548e4e40a555`, 256×256; grass tile scale is 16px | Closest in tile scale, but the olive fill, thin inset stone edge, and decorative-dot treatment differ from A1’s ash/forest/soil palette and prop outlines. Not mixed into either site. |
| Cainos demo `assets/environment/cainos_demo/cainos_props.png` | SHA-256 `bc100749fcf3cc9008a0078454f704bc63f9000d6f3e4a91574b83da098fa71e`, 512×512 | Props belong to that sheet’s visual ramp/outline system; A1 already provides the exact quarry, tree, pump, and orchard landmarks needed. Not copied. |
| Ocean Cainos `assets/environment/ocean_cainos/ocean_props.png` | SHA-256 `a7219a797d5acddfe3053dd1db514354d828564f11bda9255433cf136a073e4a`, 512×512 | Dark teal coastal objects/structures; neither Orchard irrigation nor Quarry excavation. Not copied. |
| A1 Chapter 1 archive `archive_tiles.png`, `archive_props.png` | SHA-256s `e7ee787a97ca14591101760bf985a9313f932b48a9723d29db36e1a1bb230aa6` / `f00e28932a6a66704fd4329a8a4e91afd2dd25eef35ef8c89d66ddb7e923b0c1`; 1024×16 / 446×96. Frame JSON: `bookshelf`, `bookshelf_b`, `bookshelf_c`, `lectern`, `scroll_rack`, `chandelier`, `brazier`, `grille_door`, `ladder`. | Library interior; not Quarry/Orchard scenery. Only the standalone A1 archive radial light is adopted, attached to a source A1 lamp. |
| A1 Chapter 1 crypt/ruins `crypt_tiles.png`, `crypt_props.png` | SHA-256s `c3d127b9645ac0689681c299da5baa5a3628f9c7ea036a395fce66e06cfb19d9` / `739d9842812798f5cc0b4f5422e1a246043cb77b0264e4c7f213a2a08c4d5813`; 1024×16 / 548×104. Frames include `sarcophagus`, `crypt_door`, `crypt_door_ajar`, `loculus`, `candelabrum`, `grave_goods`, `grave_urn`, `hanging_lamp`, `bier`. | Gray-violet crypt floor and funerary/crypt-door semantics do not describe the two existing surface/mine POIs. Not copied. |
| Free Top-Down Pixel Dungeon `PNG/walls_floor.png`, `doors_lever_chest_animation.png`, `decorative_cracks_floor.png`, `trap_animation.png`, `Water_coasts_animation.png` | SHA-256s respectively `1bbe25b0268030153dedc2023870b96e47e317cddf0c8788e4c114df7a4e045c`, `1d72b52010cbf186f0eee4bdf61e47d2ea3153f12eaaaf39250a99e30b65697f`, `cc358af5f628f30716c74f125dedf6fac054bdc68bab444a9f2a94808738edaf`, `21cb466892add385ec56f8a09e9718b2186af1e0a0e25eb74ce576b4d3210c06`, `e48f4221111931cf692dbbf670c11262e2fb5ca101943130c4116876c0519fef`. | Reviewed the actual 208×368 wall/floor, 160×192 doors/levers/chests, 128×240 cracks, 144×400 trap animation, and 352×448 water/coast sheets. Their purple-blue masonry, hard-lit doors, traps and separate interior rendering language would read as a different dungeon/POI. A1 `detail_karst_fissure`, `detail_water_ripple`, track masks and existing gate art are coherent choices instead. None copied. |

## Visual evidence boundary

- Source-composed clean layout previews are in `.artifacts/r13-art-review/previews/`; files are identified by POI/state and 720/1440/2160 dimensions. They use exact source pixels and an exact idle Hero frame, but they are **not native Godot captures**.
- Native player-view journey captures at 1280×720, 2560×1440, and 3840×2160 remain required. CI capture generation, eye inspection, A0 owner integration, and human play are separately reported. No visual or product acceptance is inferred from frame/pixel tests or Pillow previews.
- The existing Quarry and Orchard identities/canonical cells stay `[30,280]` and `[140,360]`. No POI is added; no A0/A1/A3-owned source is edited.
