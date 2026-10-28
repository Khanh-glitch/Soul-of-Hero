# World art & readability — completion report

Everything in this file was executed on `arena/54306b59-soul-of-hero`, and every
number was read back from a run, a log or a PNG. Nothing here is a plan.

## 1. Where the work is

| commit | what it did |
| --- | --- |
| `804ac7aa` | occlusion system, traversability system, hybrid override pipeline, two hand-painted exteriors, two new runtime tests, two new CI steps |
| `3721cb44` | the capture took two `RefCounted` systems as `Node` — a runtime-only type error, fixed |
| `05f584d6` | the occlusion demonstration's numbers published as their own check annotation |
| `5580df49` | **L03 and L04 repainted**, after looking at the frames at 5x and in the scene |

Final tree: `5580df49` on `arena/54306b59-soul-of-hero`. `main` untouched.

## 2. The two systems

### Smart occlusion — `game/overworld/overworld_occlusion.gd`

Props standing in front of the player fade; nothing else changes.

* Overlap is tested against each sprite's **drawn rect** at the player's **feet**,
  not against the node position (which for a feet-anchored sprite is the ground
  contact point, and would have made every tall building "overlap" while the
  player was still in front of it).
* 128 px buckets: a frame steps 109 of 2 620 registered occluders, not all of them.
* Hysteresis 2 px enter / 5 px exit, so a boundary cannot flicker.
* Depth by role — vegetation 0.30, architecture 0.50, landmark 0.62, default 0.42.
  A destination stays recognisable while the Knight is visible through it.
* Visual only: collision, position and save state are asserted unchanged.

### Traversability — `game/overworld/overworld_traversability.gd`

A 0/1/2 grid (free / terrain / prop body) read from the **live `StaticBody2D`s**,
plus a breadth-first flood carrying walking distances in a `PackedInt32Array`
with a head cursor (linear over ~73 000 free cells; `pop_front()` would have made
it quadratic).

* `unreachable_endpoints()` names every landmark threshold, camp, discovery and the
  spawn that the built world has sealed off, with the distance to the nearest
  standable cell.
* `nearest_free()` / `nearest_free_position()` place the player and the capture.
* Invalidated when a shortcut opens or closes.

## 3. What the systems found, and what was fixed

Both found real defects on their first run.

1. **Two rewards were buried under trees.** `d_crucible_cove` and `d_relay_shard`
   sat under `tree_dead` colliders. `author.py` checked collider props against
   interaction cells by **anchor tile**; a body is 0.82 of the sprite's width and
   hangs from its feet, so it routinely covers a neighbour. Scatter now asks the
   body footprint, and `validate()` refuses to bake a world where any body covers
   an interaction cell — checked twice, with shortcuts closed and open.
2. **A fresh character spawned inside the refuge tent**, because `validate()`
   checked a hard-coded `(56, 216)` that had drifted from the document's
   `(56, 218)`. One `START` constant now feeds the document, the bake and the
   flood; the scene also settles the player onto free ground before the first
   frame if a body ever covers the spawn again.
3. **Both hand-painted exteriors were worse than what they replaced.** See §5.

## 4. Override pipeline and provenance

```
python3 tools/overworld/overrides.py --list      # what is overridden, from where
python3 tools/overworld/overrides.py --compose   # rebuild atlas + manifest
python3 tools/overworld/source_audit.py --check   # fail if any pixel has no origin
```

`art.py` / `art_props.py` call `compose()` as their last step, so the atlas is
always "generated, then overridden", and deleting an override PNG restores the
generated frame. `data/overworld/art_manifest.json` records per frame: rect,
source, origin (`generated` / `hand`), license, and the atlas sha256.

Audit result: **3 files, 2 overrides, all `license: original`** — every pixel in
the overworld is drawn by this repository's own code, so there is nothing to
attribute. `docs/overworld/SOURCE_AUDIT.md` is generated from the bytes on disk,
not from memory.

## 5. The art pass: before / after

Two galleries, both built from **the previously shipped frames** (commit
`8be364cf`) rather than from memory:

| image | contents |
| --- | --- |
| `docs/overworld/evidence/overworld_gallery_landmarks.png` | L03 and L04 at native size, generated vs hand-painted |
| `docs/overworld/evidence/overworld_gallery_stations.png` | the other ten stations at half scale, with the measured difference per row |

Measured change (share of pixels differing by more than 3/255):

| station | change |
| --- | --- |
| L03 Crossfire Archive | **8.5 %** |
| L04 Spiral Reliquary | **5.9 %** |
| Ashen Refuge (spawn) | 0.6 % (a dead tree removed from an interaction cell) |
| the other nine | 0.0 % |

What the repaint fixed, in the order it showed up on screen:

* L03's centre span was one **featureless gable plate** — the single thing the art
  rules forbid — with a shelf beside it that read as loose sticks.
* L03's plinth was `0.52 × stone` on a `0.55` plaza, so the building looked like it
  floated on a black shelf. It is now drawn in the ground's own gravel palette and
  measured at 0.375 against a plaza at 0.377.
* L04 was **three stacked slabs**: 20 px faces with no coursing read as a wedding
  cake at 2×, and the crown was lost against the sky.
* Measured against the plaza they stand on, both sat at **delta -0.03 / +0.01**
  luminance — the same value as the ground, i.e. not readable as destinations.
  A `value_lift` (a mix toward warm light, which keeps the relative steps between
  courses, unlike a brightness multiply) puts them at **+0.068 / +0.075**.

Native `LOOK` numbers before → after the repaint (CI, run `40713790031` →
`40716220253`): archive `colours 201→208, std 0.062→0.074`; reliquary
`colours 192→197, std 0.066→0.076`. More structure, not more noise: `flat` stayed
at 21 % / 16 % and `edges` at 19 % / 17 %.

## 6. Occlusion demonstration

Station pair `overworld_occlusion_off.png` / `overworld_occlusion_on.png`, shot
from the **same camera and the same tile** with one flag different. The natively
captured evidence, read back from the run's annotations:

```
OVERWORLD CAPTURE occlusion: standing at (3336.0, 568.0)
  (landmark feet (3336.0, 648.0), rect [P: (3270.0, 544.0), S: (132.0, 104.0)])
OVERWORLD CAPTURE occlusion: 2 sprite(s) faded for this frame, alpha of the gate 0.62
OVERWORLD OCCLUSION occlusion_on differs from occlusion_off in 4.0 pct of sampled pixels
```

`docs/overworld/evidence/overworld_occlusion_pair.png` is the offline composite of
the same scenario (same atlas, same tile maths, same framing) and is labelled as
such — this sandbox has no display server, so it cannot photograph the engine.

## 7. Verification

Local, on a from-source Godot 4.7 (`4.7.stable.custom_build.5b4e0cb0f`), via
`bash tools/overworld/local_suite.sh`:

| gate | result |
| --- | --- |
| STATIC | `38 checks` |
| GUARD | `82 checks` |
| KNIGHT | `4 checks` |
| SCENE | `29 checks` |
| MOVEMENT | `7 checks` |
| PROVISIONS | `15 checks` |
| PERSISTENCE | `26 checks` |
| GATE | `35 checks` |
| SHORTCUT | `30 checks` |
| TRAVERSABILITY | `26 checks` |
| OCCLUSION | `22 checks` |
| ROUNDTRIP | `27 checks` |
| ACCEPTANCE | `64 checks, 0 failures` |

**413 checks, zero failures.**

CI, run `40716220253` on `5580df49`:

* STATIC CONTRACTS — success
* NATIVE RUNTIME — success (13 gates, including the two new ones)
* VISUAL EVIDENCE — success, 17 stations captured and validated
* browser playtest `40716220155` — success: export, headless-Chromium smoke,
  publish to `playtest-preview`

Playable: <https://khanh-glitch.github.io/Soul-of-Hero/> (deployment status for the
environment is `success`; this sandbox's network blocks the `*.github.io` host, so
the site was verified through the deployment API and the publish job, not by curl).

## 8. What this report does not claim

* That the world looks *good*. What is measured is measured; the judgement is the
  owner's, and the frames it rests on are the CI artifact plus the labelled offline
  renders in `docs/overworld/evidence/`.
* That the "Godot 4.7 Runtime Validation" workflow is green. Its
  `Original main baseline comparison` job fails on this branch and did so before
  this work started: it diffs against `main`, which by definition does not contain
  the overworld. Its other two jobs (Xvfb gameplay captures, headless runtime)
  pass.
* Anything about combat, Heroes, RPG systems, progression, HUD, narrative or
  dungeon interiors. Those were frozen and are untouched.
