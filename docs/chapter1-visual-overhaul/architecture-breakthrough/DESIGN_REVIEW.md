# Blood Crucible — architecture breakthrough, Level 5 (design review)

Status: **work in progress, honestly reported.** Level 5 is materially better than
the rejected baseline and is still short of the Monastic Archive reference. The
sections below say exactly where it lands, which frames prove it, and what is
still wrong. No claim of acceptance is made here.

Branch: `arena/6e89e68d-soul-of-hero`. Every image under `L05/` is a native
Godot 4.7 frame captured by `tools/captures/crucible_capture.gd` through the real
campaign boot (`AppRoot` → `AppFlow.start_campaign_level`), 1280×720, zoom 1.0 for
every gameplay station. The Pillow previews under `preview/` are **not** evidence
and are labelled as such in every file.

## 1. Diagnosis, from the gold references at gameplay scale

Looking at `docs/gate2/evidence/after_archive_entry.png` (the Monastic Archive) at
1280×720, the qualities that make it read as a built place are not the palette and
not the number of props:

1. **One value ladder.** Unexcavated background is nearly black; the socle is
   dark; the wall field is mid; the cornice and wall *top plane* are the lightest
   stone in the frame; the floor sits between the wall field and the cornice. That
   ordering does all the work of separating floor from wall from rock.
2. **Contact shadows.** Every wall foot and every prop has a soft shadow. Without
   them, planes meet on hard lines and the room flattens.
3. **A cool base with hot pools.** The ambient is a dim blue-violet, the lights
   are small, warm and local. Brightness is not the trick; contrast is.
4. **Objects, not textures.** Room-scale identity comes from whole sprites —
   armarium, shelves, doors, columns, hanging lamps — placed against walls, with
   the floor left mostly empty so the objects read.
5. **Composition.** One destination per room, secondary objects ranked by size,
   nothing scattered for coverage.

What the rejected L5 frames did instead: one continuous brick texture from floor
to ceiling, no wall top, no value separation, a rhythmic torch every N tiles, a
uniform brightness, and no constructed feature at all. Technical validity
(wall borders, tile percentages, facade coverage) had hidden all five failures.

## 2. What this pass actually built

### Art kit (original, procedural, regenerable)

`tools/level5/art_crucible.py` → `assets/environment/chapter1/crucible/`

* **27 tiles**: one value ladder declared once (`WARM_D < WARM_M < BASALT_M <
  WARM_L < WARM_HI < CAP`), 32 px flagstones drawn as four quadrants so the joint
  falls every 32 px instead of on a 16 px grid, processional paving with a recessed
  cut, narrow blood runnels with a dark rim, grates, alpha-edged blood pools, an
  ashlar wall face, a carved dado, a five-course wall stack (socle → field → dado →
  bright cornice → bright top plane), a pilaster, unexcavated rock, and an
  ambient-occlusion strip.
* **23 whole-sprite props** with a uniform finish: one pixel dark outline plus a
  baked contact shadow, so a pale stone prop separates from a pale stone floor and
  stands on it instead of being pasted onto it. Gate (208×168), portal (88×112),
  raised basin (200×156), broken apparatus (132×124), altar, offering slab, brass
  feed stand, columns and a snapped one, braziers, banner (30×62), gibbet, chains,
  torch, three grades of rubble, skull drifts, carved sigil, radial light texture.
* Every asset is placed by the composition; none is generated for coverage.

### Composition

`tools/level5/architecture.py` → `data/levels/chapter_1_level_5_architecture.json`
(validated: `ARCHITECTURE: OK`). The plan only ever decorates cells the gameplay
map already defines, and the validator refuses tall props on walkable ground,
props over void, and anything on a protected cell. It cannot invent collision.

* **F1 Processional Forecourt** — the colossal gate built onto the antechamber's
  real north wall band; the shrine on its axis (sacrificial stone, brass stand, two
  fires, offerings, blood in the paving) so the rite is *inside the spawn camera
  view* rather than thirty-four tiles east; the raised crucible on the level's own
  solid island; engaged piers down the nave; a second portal closing the axis.
* **F2 Blood Court** — the monumental sunken basin at the court's centre with a
  paved apron, four runnels, a colonnade on the court's own block ranges, corner
  ritual stations, banners, gibbet and chains over the court, and damage (toppled
  column, masonry fall) that reads as a fight that already happened.
* **F3 Hooded Archer Crucible** — the broken apparatus as the arena's centrepiece
  on its own solid island, entrance framing fire kept out of the firing lanes,
  colonnade and debris placed so cover exists without blocking projectile paths,
  and the boss's own spawn left untouched.

### Presentation layer (no collision, no gameplay change)

`game/levels/presentation/crucible_art.gd`, attached by `dungeon_level.gd`:

| Layer | z | What it does |
|---|---|---|
| `CrucibleBedrock` | −12 | fills the whole map rectangle with rock, so a room is a cavity in a mountain, not a lit box on black |
| `CrucibleFloor` | −9 | authored paving on **every** walkable cell (quadrant rule), composed paving over it |
| `CrucibleShadow` | −8 | occlusion strip at the foot of every wall face |
| `CrucibleWalls` | 2 | five-course stack over the level's collision tiles (z 0), under the entity root (z 3) |
| props | 3 | whole sprites in the level's own y-sorted `Entities` root, so they sort against the Knight |
| `CrucibleLights` | 3 | 22 composed local lights; ambient is a cool 0.30/0.32/0.40 |

Two layering faults found and fixed during the pass, both of which explain part of
why the rejected version looked flat: the presentation layer drew at z −9, i.e.
**behind** the level's own grey brick collision tiles, and the level's stock
`Decor` layer kept dropping loose crates and brackets over the new floor.

Light radii were also wrong by 3×: a `PointLight2D` pool is the 256 px light
texture times `texture_scale`, so the authored 3–8 was a 768–2048 px pool — the
whole viewport per brazier, which is precisely why every room looked evenly lit.

## 3. Where it lands, honestly

Native frames (see `L05/images/`), reviewed at 1280×720:

* The floor now reads as paved stone with a joint rhythm rather than a brick wall
  underfoot; the wall foot has a shadow; the wall has a lit cornice and top plane;
  the rock mass surrounds the rooms; light is local and the rooms have a dark
  surround. Against the rejected baseline (`pair_*.png`) the difference is obvious.
* F1 has a real composition: gate, shrine, fires, the raised basin. The first frame
  is no longer an empty tiled room.
* **Still short of the reference.** The rooms are larger and emptier than the gold
  reference, which is denser with object-scale architecture. The stone-to-stone
  contrast is still the main weakness: floor, field and rock are closer in value
  than they are in the Monastic Archive. The basin and the apparatus are legible as
  landmarks but their masonry is smoother than the kit's walls. F2 and F3 have
  composition and light but have not yet had the per-room object pass that F1
  received. Anyone asking "is this as convincing as the archive?" today gets an
  honest **no**, with the specific deficits above rather than a claim of parity.

## 4. What was protected and verified

* `data/levels/chapter_1_level_5.json` is untouched (hash pinned in
  `L05/manifest.json`). No entity id, reward payload, boss placement, checkpoint,
  door or objective was changed. The presentation layer adds no collision.
* Frozen suites, run natively in the same workflow (logs in `L05/logs/`):
  `chapter_1_map_design_test` (SceneTree), `chapter_1_campaign_map_design_test`,
  `chapter_1_level_5_miniboss_test`, `level_5_archer_pickup_test`,
  `chapter_1_level_5_live_loot_regression` (.tscn), `chapter_1_collision_route_test`
  (.tscn); balance matrix recorded only, its pre-existing baseline failure still
  disclosed.
* Determinism: the workflow regenerates the kit and the plan from source and fails
  if the committed bytes differ.

## 5. Open work, in priority order

1. **Value separation.** Push the rock and the wall field darker and the wall top
   lighter; the current spread is too narrow to survive a warm light pool.
2. **Object-scale density.** The reference is populated with furniture-scale
   architecture along the walls; F2 and F3 need that pass, not more floor features.
3. **Basin and apparatus masonry.** Both need visible courses and joints, not
   smooth fills, at 1:1.
4. Only then L7 (Failing Beacon) and L10 (Castellan Throne), with their own kit.
