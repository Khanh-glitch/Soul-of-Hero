#!/usr/bin/env python3
"""Level 7 — The Beacon Yard. Composition.

The map is one open hall with four hollow bastions and a Soul Beacon at its
centre; three waves come down the four cardinal approaches. The art therefore has
one rule above all others: **nothing is added to the lanes.** Every prop in this
file is placed by a rule that refuses the four approach corridors, and the
validator refuses anything that is not on a cell the map already made walkable.

What the composition adds, in the order a player will meet it:

* **The ward ring** — a seven-cell iron ring inlaid around the Beacon with eight
  burn marks on it, so the thing being defended has a boundary drawn on the floor.
* **Four studded lanes** — iron-set paving running from the walls to the ring, one
  per approach, with the scorch and ash concentrated where the fighting will be.
* **The watch pillars** — four fire-capped chalk pillars on the ring's diagonals.
  They frame the Beacon without standing on it, and they are the silhouette the
  yard reads by.
* **The walls of a working fort** — buttresses, arrow slits and fire baskets on
  the broadside faces, with spears, shields, crates, barrels, sandbags and firewood
  stacked at the wall feet: a place that was garrisoned before it was attacked.

Run: python3 tools/level7/architecture_vigil.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, Plan, cells, load_level, protected, validate, wall_faces, write_document,
    normalise_lights,
)
from art_vigil import ward_offsets  # noqa: E402

LEVEL = 7
OUT = os.path.join(ROOT, "data", "levels", "chapter_1_level_7_architecture.json")
RADIUS = 6

BEACON = (48, 35)
PLAYER = (48, 43)
EXIT = (48, 7)
CHECKPOINT = (48, 47)
CHEST = (48, 57)
# The four approaches the waves use, as the strips that must stay clear.
LANES = [
    [(x, y) for y in range(8, 30) for x in (47, 48, 49)],
    [(x, y) for y in range(41, 63) for x in (47, 48, 49)],
    [(x, y) for x in range(10, 42) for y in (34, 35, 36)],
    [(x, y) for x in range(55, 87) for y in (34, 35, 36)],
]
BASTIONS = [(25, 23), (68, 23), (25, 47), (68, 47)]


def lane_cells() -> set:
    """Cells within one tile of any approach: never dressed, never furnished."""
    guard = set()
    for lane in LANES:
        for (x, y) in lane:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    guard.add((x + dx, y + dy))
    return guard


def in_lane(cell, clear) -> bool:
    return cell in clear


def long_run(cell, faces) -> bool:
    run = 1
    for dx in (-1, 1):
        probe = (cell[0] + dx, cell[1])
        while probe in faces and run < 4:
            run += 1
            probe = (probe[0] + dx, probe[1])
    return run >= 3


## Light energies, not light count.
##
## A second pass over the same rule. The first one doubled the energies and gave the
## ring braziers a light, which is why the yard now has a pool - but it also left
## every lamp at the top of its range, and the frames show what that costs: the
## clipping in this level is a band centred on the camera in all four capture
## frames, because the lamps stack. The wall torches are authored in pairs thirty-two
## pixels apart on a radius of a hundred and forty or more, so each pair lights the
## same stone twice; the Beacon's own cell takes its own lamp plus two pillar fires
## plus two ward sigils, five lamps on one floor. Two lamps at 0.5 energy on chalk at
## 150 land near 260 before ambient; five land near 400.
##
## Each lamp comes down to what one lamp can carry on its own: the torches 0.50 ->
## 0.30, the pillar fires 0.55 -> 0.34, the Beacon 0.55 -> 0.40, the sigils 0.30 ->
## 0.22. Nothing is added, nothing moves, no lamp is removed, and the fire is still
## the only saturated colour in the room - what changes is that the stone under it
## stops being white.
##
## The yard authored twenty-two lights and every one of them sat between 0.30 and
## 0.42 energy, under an ambient of 0.74 - the fires were drawn, they just could not
## be seen on the floor they stood on. The frames show it: a uniform tan field with
## candle sprites in it, no pool, no focus, which buries the Beacon's ownership of
## the room. The energies here are roughly doubled and the ring braziers, which had
## no light at all, now carry one. Nothing about position, radius, colour or ambient
## moved, so this adds local contrast rather than a chapter-wide brightening.
def ward(plan, floor, geom) -> int:
    painted = 0
    for (dx, dy), frame in ward_offsets(RADIUS).items():
        cell = (BEACON[0] + dx, BEACON[1] + dy)
        if cell in floor and cell not in geom:
            plan.floor_tile(cell, frame)
            painted += 1
    plan.lights.append({
        "x": BEACON[0] * 16 + 8, "y": BEACON[1] * 16 + 8,
        "color": [1.0, 0.62, 0.30], "energy": 0.40, "scale": 1.30,
        "cell": [BEACON[0], BEACON[1]], "note": "the Beacon's own light",
    })
    return painted


def lanes(plan, floor, geom, clear) -> int:
    """Iron-set causeways down all four approaches, with the burn where they meet."""
    painted = 0
    for index, lane in enumerate(LANES):
        horizontal = index >= 2
        for cell in lane:
            if cell not in floor or cell in geom:
                continue
            if cell[0] in (47, 49) or cell[1] in (34, 36):
                plan.floor_tile(cell, "lane_h" if horizontal else "lane_v")
            else:
                plan.floor_tile(cell, "lane_v" if horizontal else "lane_h")
            painted += 1
    # scorch collects where the waves arrive and around the ward ring
    for lane in LANES:
        for cell in lane[-6:]:
            if cell in floor and cell not in geom:
                plan.floor_tile(cell, "scorch_b")
        for cell in lane[:3]:
            if cell in floor and cell not in geom:
                plan.floor_tile(cell, "ash_a")
    for offset in range(-RADIUS - 2, RADIUS + 3):
        for cell in ((BEACON[0] + offset, BEACON[1] - RADIUS - 2),
                     (BEACON[0] + offset, BEACON[1] + RADIUS + 2),
                     (BEACON[0] - RADIUS - 2, BEACON[1] + offset),
                     (BEACON[0] + RADIUS + 2, BEACON[1] + offset)):
            if cell in floor and cell not in geom:
                plan.floor_tile(cell, "scorch_a")
    return painted


def apron(plan, floor, geom, clear) -> int:
    """A raised chalk apron around the ward ring, with an iron edge and four
    openings where the causeways arrive. It gives the arena a shaped centre
    instead of a ring floating on a field of identical paving."""
    painted = 0
    span = 9
    for dy in range(-span, span + 1):
        for dx in range(-span, span + 1):
            cell = (BEACON[0] + dx, BEACON[1] + dy)
            if cell not in floor or cell in geom:
                continue
            edge = max(abs(dx), abs(dy)) == span
            if edge:
                if cell in clear:
                    continue
                plan.floor_tile(cell, "lane_h" if abs(dy) == span else "lane_v")
            else:
                plan.floor_tile(cell, "apron")
            painted += 1
    return painted


def beacon_frame(plan, floor, geom, guard) -> None:
    """Watch pillars on the diagonals, braziers on the ring, banners at the core.

    The Beacon cell itself is left entirely alone: it carries the live objective
    sprite and its health, and the architecture's job is to frame that, not to
    stand on it. Nothing in here is a prop or a light aimed at it.

    The one thing added under it is a floor: a fire-scoured hearth. The ward ring
    inlaid into the apron reaches the cell the Beacon stands on, and at gameplay
    scale the Beacon's own light landed on that pale chalk and clipped - the cell
    it stands on was the brightest thing in the room, which is why the glow washed
    the ring out. A fire that has burned here for a season leaves the stone under
    it heat-cracked and black, and it eats the inlay at its centre: the hearth is
    painted over the ring's inner octagon and under nothing else, so the outer
    band, its spurs and its studs are still there.
    """
    for cell in sorted(hearth_cells()):
        if cell in floor and cell not in geom:
            plan.floor_tile(cell, "hearth")
    for dx, dy in ((-4, -4), (4, -4), (-4, 4), (4, 4)):
        cell = (BEACON[0] + dx, BEACON[1] + dy)
        if cell in floor and cell not in guard:
            plan.prop("watch_pillar", cell, note="ward ring corner pillar")
            plan.lights.append({
                "x": cell[0] * 16 + 8, "y": cell[1] * 16 - 96,
                "color": [1.0, 0.66, 0.34], "energy": 0.34, "scale": 1.3,
                "cell": [cell[0], cell[1]], "note": "pillar fire",
            })
    # the cardinals are masonry, not more fire: eight identical flames around one
    # small circle was the repetition finding in the room the player is meant to look
    # at. The ward stones take the ring's light instead of adding their own.
    for dx, dy in ((0, -3), (0, 3), (-3, 0), (3, 0)):
        cell = (BEACON[0] + dx, BEACON[1] + dy)
        if cell in floor and cell not in guard:
            plan.prop("ward_stone", cell, note="ward stone", light={
                "x": cell[0] * 16 + 8, "y": cell[1] * 16 - 26,
                "color": [1.0, 0.62, 0.30], "energy": 0.22, "scale": 1.1,
                "cell": [cell[0], cell[1]], "note": "ward sigil light",
            })
    for dx in (-2, 2):
        cell = (BEACON[0] + dx, BEACON[1] - 2)
        if cell in floor and cell not in guard:
            plan.prop("banner", cell, note="beacon banner")
    plan.prop("bench", (BEACON[0] - 6, BEACON[1] + 5), note="")
    plan.prop("well", (BEACON[0] + 6, BEACON[1] + 4), note="cistern for the fire buckets")


def bastions(plan, floor, geom, faces, guard) -> None:
    """Dress the four hollow bastions as the fort's strong points."""
    for (bx, by) in BASTIONS:
        for cell in sorted(faces):
            if abs(cell[0] - bx) <= 3 and abs(cell[1] - (by + 3)) <= 1:
                plan.wall_tile(cell, "wall_buttress")
        for dx, dy in ((-3, 3), (3, 3)):
            cell = (bx + dx, by + dy)
            if cell in floor and cell not in guard:
                plan.prop("brazier", cell, note="bastion foot brazier")
        cell = (bx, by + 4)
        if cell in floor and cell not in guard:
            plan.prop("banner_torn", cell, note="torn banner on the bastion")
        cell = (bx - 4, by + 4)
        if cell in floor and cell not in guard:
            plan.prop("sandbags", cell, note="sangar")
        for cell in ((bx + 4, by + 4), (bx - 4, by - 4)):
            if cell in floor and cell not in guard:
                plan.prop("shields", cell, note="shield rack")


def walls(plan, floor, geom, faces) -> None:
    """Buttresses, arrow slits and fire baskets on the broadside faces."""
    for cell in sorted(faces):
        if not long_run(cell, faces):
            continue
        if cell[0] % 9 == 0:
            plan.wall_tile(cell, "wall_buttress")
        elif cell[0] % 9 == 4:
            plan.wall_tile(cell, "wall_slit")
        elif cell[0] % 9 == 6:
            plan.wall_tile(cell, "wall_ember")


def stores(plan, floor, geom, faces, guard, clear) -> None:
    """The garrison's stores at the wall feet, never in a lane.

    The foot of a wall is any walkable cell that touches masonry, not just the
    cells below a wall face: the yard's south boundary is a wall the camera never
    sees the face of, and it still needs its crates and its sandbags.
    """
    # Frame names, not descriptions: every string here must be a frame the vigil
    # prop atlas actually contains, or the stores cell renders as nothing at all.
    # "barrels" was never a frame — the atlas has "barrel" — so twenty wall-foot
    # store cells across the yard drew empty while the document claimed a prop.
    # tools/validate_chapter1_art_refs.py now refuses that class of typo.
    kinds = ["spears", "crates", "barrel", "fire_wood", "sandbags", "barrel",
             "spears", "crates", "arrows", "rubble", "bench", "barrel"]
    index = 0
    for cell in sorted(floor):
        if cell in geom or cell in guard or cell in clear:
            continue
        touches = any((cell[0] + dx, cell[1] + dy) in geom
                      for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        if not touches:
            continue
        roll = (cell[0] * 37 + cell[1] * 61) % 100
        if roll > 30:
            continue
        plan.prop(kinds[index % len(kinds)], cell, note="garrison stores")
        index += 1
    # wall furniture: torches, iron rings and the odd torn banner
    for cell in sorted(faces):
        if not long_run(cell, faces):
            continue
        roll = (cell[0] * 53 + cell[1] * 29) % 100
        if roll < 12:
            plan.prop("torch_bracket", cell, note="wall torch", light={
                "x": cell[0] * 16 + 8, "y": cell[1] * 16 - 26,
                "color": [1.0, 0.72, 0.40], "energy": 0.30, "scale": 1.15,
                "cell": [cell[0], cell[1]], "note": "wall torch",
            })
        elif roll < 20:
            plan.prop("iron_ring", cell, note="tie ring")
        elif roll < 26:
            plan.prop("banner_torn", cell, note="torn banner")


def quadrant_scenes(plan, floor, geom, guard, clear) -> None:
    """Four drill squares, each used for something different.

    An open hall this size reads as empty unless the middle has composition, and a
    ring of identical braziers in every quadrant is exactly the pattern this pass
    is meant to avoid. So each quadrant is a marked square with its own garrison
    business in it: the muster line, the fire station, the dressing station and the
    armoury. The outlines are floor tiles only and are cut wherever they would
    touch an approach.
    """
    squares = ((14, 12, 40, 30), (56, 12, 82, 30), (14, 40, 40, 58), (56, 40, 82, 58))
    scenes = ("muster", "fire_station", "dressing", "armoury")
    for (x0, y0, x1, y1), scene in zip(squares, scenes):
        damaged = scene == "dressing"
        if not damaged:
            for x in range(x0, x1 + 1):
                for y in (y0, y1):
                    cell = (x, y)
                    if cell in floor and cell not in geom and cell not in clear:
                        plan.floor_tile(cell, "lane_h")
            for y in range(y0, y1 + 1):
                for x in (x0, x1):
                    cell = (x, y)
                    if cell in floor and cell not in geom and cell not in clear:
                        plan.floor_tile(cell, "lane_v")
        else:
            # a square that has been fought over: only the corner marks survive
            for (cx, cy) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
                for d in range(0, 3):
                    for cell in ((cx + d, cy), (cx - d, cy), (cx, cy + d), (cx, cy - d)):
                        if cell in floor and cell not in geom and cell not in clear:
                            plan.floor_tile(cell, "lane_h" if d % 2 else "lane_v")

        def put(frame, cell, **kwargs):
            if cell in floor and cell not in geom and cell not in guard and cell not in clear:
                plan.prop(frame, cell, **kwargs)
                return True
            return False

        cx = (x0 + x1) // 2
        if scene == "muster":
            # the line the garrison formed up on: racks and shields along the
            # square's north edge, one brazier at the inner corner
            for i, x in enumerate(range(x0 + 4, x1 - 2, 6)):
                put("spears" if i % 2 == 0 else "shields", (x, y0 + 1))
            put("bench", (x0 + 3, y1 - 1))
            put("brazier", (x1 - 2, y0 + 1))
            put("banner", (cx, y0 - 1))
        elif scene == "fire_station":
            # the well, the fire buckets and the woodpile: what a yard under
            # attack by fire actually needs
            put("well", (cx - 2, y0 + 2))
            put("fire_wood", (cx + 4, y0 + 2))
            put("barrel", (cx + 7, y0 + 2))
            put("sandbags", (cx - 6, y1 - 2))
            put("brazier", (cx + 1, y1 - 2))
        elif scene == "dressing":
            # where the wounded were carried: benches, spent arrows, rubble
            put("bench", (cx - 4, y0 + 3))
            put("bench", (cx + 3, y0 + 3))
            put("arrows", (cx, y1 - 2))
            put("rubble", (cx - 7, y1 - 1))
            put("brazier", (cx + 8, y0 + 2))
            put("banner_torn", (cx - 1, y0 - 1))
        else:
            # the armoury: the yard's stores
            for i, x in enumerate(range(x0 + 4, x1 - 3, 5)):
                put("shields" if i % 3 == 0 else ("crates" if i % 3 == 1 else "spears"),
                    (x, y0 + 2))
            put("crates", (cx - 3, y1 - 2))
            put("barrel", (cx + 4, y1 - 2))
            put("brazier", (cx + 1, y0 + 5))


def bastion_towers(plan, floor, geom, faces, guard) -> None:
    """A fire-capped watch pillar on every bastion, so the four strong points
    have a silhouette above the wall instead of a brazier at their feet."""
    for (bx, by) in BASTIONS:
        face = (bx, by + 3)
        if face in faces:
            plan.prop("watch_pillar", face, note="bastion watch pillar", light={
                "x": face[0] * 16 + 8, "y": face[1] * 16 - 96,
                "color": [1.0, 0.68, 0.36], "energy": 0.42, "scale": 1.3,
                "cell": [face[0], face[1]], "note": "bastion fire",
            })


def perimeter(plan, floor, geom, clear) -> int:
    """A darker perimeter road: the yard is a plaza with an edge, not a field."""
    painted = 0
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom or (cx, cy) in clear:
            continue
        near_wall = any((cx + dx, cy + dy) in geom
                        for dx in range(-2, 3) for dy in range(-2, 3))
        if near_wall:
            plan.floor_tile((cx, cy), "ash_a")
            painted += 1
    return painted


def objectives(plan, floor, geom, faces, guard) -> None:
    """Give the exit, the checkpoint and the supply chest their own dressing."""
    ex, ey = EXIT
    for cell in ((ex - 2, ey + 2), (ex + 2, ey + 2)):
        if cell in floor and cell not in guard:
            plan.prop("brazier", cell, note="gate brazier")
    for dx in (-3, 3):
        cell = (ex + dx, ey + 1)
        if cell in floor and cell not in guard:
            plan.prop("watch_pillar", cell, note="gate pillar", light={
                "x": cell[0] * 16 + 8, "y": cell[1] * 16 - 96,
                "color": [1.0, 0.70, 0.38], "energy": 0.40, "scale": 1.3,
                "cell": [cell[0], cell[1]], "note": "gate pillar fire",
            })
    for cell in ((CHECKPOINT[0] - 3, CHECKPOINT[1]), (CHECKPOINT[0] + 3, CHECKPOINT[1])):
        if cell in floor and cell not in guard:
            plan.prop("brazier", cell, note="checkpoint brazier")
    for cell in ((CHEST[0] - 2, CHEST[1] - 1), (CHEST[0] + 2, CHEST[1] - 1)):
        if cell in floor and cell not in guard:
            plan.prop("crates", cell, note="supply stack")


HEARTH_RADIUS = 2


def hearth_cells() -> set:
    """The fire-scoured setting under the Beacon, in the ward ring's own terms.

    Painted over the inlay's inner octagon and nothing else: the outer band, its
    spurs and its studs stay. A wear pass is what would otherwise take it away -
    the Beacon's own cell rolls under the general scorch rule - so every pass that
    writes floor below here has to know these cells are not its business.
    """
    return {(BEACON[0] + dx, BEACON[1] + dy)
            for dx in range(-HEARTH_RADIUS, HEARTH_RADIUS + 1)
            for dy in range(-HEARTH_RADIUS, HEARTH_RADIUS + 1)}


def wear(plan, floor, geom, clear) -> None:
    """Ash and broken paving at the wall feet, scorch under the lanes."""
    hearth = hearth_cells()
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom or (cx, cy) in hearth:
            continue
        near_wall = any((cx + dx, cy + dy) in geom
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        roll = ((cx * 71 + cy * 137) % 100) / 100.0
        if near_wall and 0.30 < roll < 0.42:
            plan.floor_tile((cx, cy), "floor_broken")
        elif not near_wall and not (cx, cy) in clear and roll < 0.035:
            plan.floor_tile((cx, cy), "scorch_a")


def build():
    level = load_level(LEVEL)
    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    guard = protected(level)
    clear = lane_cells()
    face_map = wall_faces(floor, geom)
    faces = {cell for values in face_map.values() for cell in values}

    plan = Plan()
    walls(plan, floor, geom, faces)
    # The apron is laid first and the ward ring is inlaid *into* it. Painting them
    # the other way round threw the ring away: the apron covers nine cells in every
    # direction, so it repainted the whole disc and the level's one piece of floor
    # art - an octagonal iron ring with eight ward marks - was never visible in any
    # build. The ring is the arena's centre, so it goes on last.
    painted_apron = apron(plan, floor, geom, clear)
    painted_lanes = lanes(plan, floor, geom, clear)
    painted_ward = ward(plan, floor, geom)
    beacon_frame(plan, floor, geom, guard)
    bastions(plan, floor, geom, faces, guard)
    objectives(plan, floor, geom, faces, guard)
    stores(plan, floor, geom, faces, guard, clear)
    quadrant_scenes(plan, floor, geom, guard, clear)
    bastion_towers(plan, floor, geom, faces, guard)
    perimeter(plan, floor, geom, clear)
    wear(plan, floor, geom, clear)

    document = {
        "schema": "chapter1_architecture/1",
        "level": "chapter_1_level_7",
        "kit": "vigil",
        "tile_size": 16,
        "note": (
            "Authored architecture for The Beacon Yard. Derived, additive and "
            "deterministic: it decorates cells the level already defines and never "
            "creates walkable or solid ground of its own, and it keeps all four "
            "enemy approaches clear of props. Generated by "
            "tools/level7/architecture_vigil.py."
        ),
        # A yard at dusk: warm dust in the air, the fire doing the lighting.
        "ambient": [0.74, 0.70, 0.64],
        "background": [0.045, 0.035, 0.030],
        # The ledger had the yard at paving 99, wall 90 and the rock it is cut into
        # at 118: the void was the brightest thing in the frame, so the mass read as
        # a lit field the room was dropped onto. Rock goes under the paving.
        "bedrock_tint": [0.55, 0.55, 0.56],
        "layers": {"floor": plan.floor, "wall": plan.wall},
        "props": plan.props,
        "lights": plan.lights,
        "stats": {
            "floor_overrides": len(plan.floor),
            "wall_overrides": len(plan.wall),
            "props": len(plan.props),
            "lights": len(plan.lights),
            "lane_cells": painted_lanes,
            "apron_cells": painted_apron,
            "ward_cells": painted_ward,
        },
    }
    return document, level


def main() -> None:
    document, level = build()
    problems = validate(document, level)
    normalise_lights(document)
    write_document(OUT, document)
    print("level 7 architecture -> %s" % os.path.relpath(OUT, ROOT))
    for key, value in document["stats"].items():
        print("  %-20s %s" % (key, value))
    if problems:
        print("  PROBLEMS (%d):" % len(problems))
        for problem in problems[:20]:
            print("    " + problem)
        raise SystemExit(1)
    print("  validation: clean")


if __name__ == "__main__":
    main()
