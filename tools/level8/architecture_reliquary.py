#!/usr/bin/env python3
"""Level 8 — The Divided Reliquary. Composition.

A single reliquary with a central decision hall and two wings: the Reaper wing
(west) and the Vampire wing (east). Only one branch can be bound, so the art's
job is to make the choice legible from the threshold and then to make each wing
feel like a different place to fight in.

The three rules this file is built around:

1. **The wings must not read as one room with two paint jobs.** They are separated
   by material, light and furniture: cold marble, black iron, sarcophagi and
   niches west; rose marble, wine velvet, gilt and a fountain east.
2. **The seals are the composition.** Nothing stands on a seal cell or beside it,
   and each sealed door gets an emblem cut into the floor in front of it, so the
   player reads the choice before touching it.
3. **No decorative bypass.** Props are refused on, beside and in front of the
   seal cells, the chest and the exit: the only way through either wing is the
   branch the player binds.

Run: python3 tools/level8/architecture_reliquary.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, Plan, cells, entities, load_level, protected, validate, wall_faces,
    write_document,
    normalise_lights,
)
from art_reliquary import disc_offsets  # noqa: E402

LEVEL = 8
OUT = os.path.join(ROOT, "data", "levels", "chapter_1_level_8_architecture.json")
KIT = "reliquary"
## How much the authored lamp energies are raised now that the ambient no longer
## lights the level on its own. See the note at the end of build().
LAMP_GAIN = 1.2

# Furniture that must be stacked against a wall rather than standing in a room.
TALL = {"column", "column_broken", "reaper_statue", "grille", "mirror", "drape",
        "censer", "candlestand", "gate_frame", "lamp_standing", "banner_pale"}


def room_rects(level: dict) -> dict:
    rooms = {}
    for room in level["metadata"]["rooms"]:
        x, y, w, h = room["rect"]
        rooms[room["id"]] = (x, y, x + w - 1, y + h - 1)
    return rooms


def zone_cells(level: dict, zone_id: str) -> set:
    for zone in level["metadata"].get("special_zones", []):
        if zone["id"] == zone_id:
            x, y, w, h = zone["rect"]
            return {(cx, cy) for cx in range(x, x + w) for cy in range(y, y + h)}
    raise SystemExit("missing zone %s" % zone_id)


def shade_floor(plan, floor, geom, rects, *, wing: str | None) -> None:
    """Base paving for the whole building, in the wing's own marble where there is one."""
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom:
            continue
        quad = (cx % 2) * 2 + (cy % 2)
        prefix = {"reaper": "cold", "vampire": "wine"}.get(wing or "", "floor")
        plan.floor_tile((cx, cy), "%s_%s" % (prefix, "abcd"[quad]))


def spine(plan, floor, geom) -> int:
    """The processional inlay up the middle of the building.

    It starts at the spawn, runs up the approach, crosses the choice hall and
    climbs the spine into the vault. It is the one thing that is the same on both
    sides of the choice, which is why it carries the eye to the seals.
    """
    painted = 0
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom:
            continue
        if cx in (50, 51):
            plan.floor_tile((cx, cy), "inlay_v")
            painted += 1
        elif cy in (48, 49) and 36 <= cx <= 66:
            plan.floor_tile((cx, cy), "inlay_h")
            painted += 1
    return painted


def emblems(plan, floor, geom) -> int:
    """Each sealed door gets its branch emblem cut into the floor in front of it."""
    painted = 0
    for centre, cold in (((43, 48), True), ((61, 48), False)):
        for (dx, dy), frame in disc_offsets(3).items():
            cell = (centre[0] + dx, centre[1] + dy)
            if cell in floor and cell not in geom:
                plan.floor_tile(cell, ("cold_" if cold else "wine_") + frame)
                painted += 1
    return painted


def dais(plan, floor, geom) -> int:
    """A raised inlaid platform in front of the exit, under the elite's guardian.

    The vault is 17 cells deep and ends in a door; without a dais the reward
    chamber reads as the end of a corridor. This gives it a room.
    """
    painted = 0
    for cy in range(6, 14):
        for cx in range(46, 57):
            cell = (cx, cy)
            if cell not in floor or cell in geom:
                continue
            edge = cx in (46, 56) or cy in (6, 13)
            if edge:
                plan.floor_tile(cell, "inlay_h" if cy in (6, 13) else "inlay_v")
            else:
                quad = (cx % 2) * 2 + (cy % 2)
                plan.floor_tile(cell, "cold_" + "abcd"[quad])
            painted += 1
    return painted


def wear(plan, floor, geom, wing_of) -> int:
    """Damage where it tells a story: the east wing is the one that was sacked."""
    painted = 0
    for (cx, cy) in sorted(floor):
        if (cx, cy) in geom:
            continue
        wing = wing_of.get((cx, cy))
        roll = ((cx * 71 + cy * 137) % 100) / 100.0
        near_wall = any((cx + dx, cy + dy) in geom
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if wing == "vampire" and roll < (0.16 if near_wall else 0.05):
            plan.floor_tile((cx, cy), "floor_broken")
            painted += 1
        elif wing == "reaper" and roll < (0.10 if near_wall else 0.03):
            plan.floor_tile((cx, cy), "floor_worn")
            painted += 1
    return painted


def tomb_slab(plan, floor, geom, centre, tall_cells: int, *, cold: bool) -> int:
    """A grave cut into the floor: the wings' own composition.

    An outlined slab with an effigy band, long enough to read as a tomb rather
    than as a decorative stripe. Nothing stands on it: it is a floor feature and
    the walking is unchanged.
    """
    painted = 0
    x0 = centre[0] - 2
    x1 = centre[0] + 2
    y0 = centre[1] - tall_cells // 2
    y1 = centre[1] + tall_cells // 2
    for cy in range(y0, y1 + 1):
        for cx in range(x0, x1 + 1):
            cell = (cx, cy)
            if cell not in floor or cell in geom:
                continue
            if cx in (x0, x1):
                plan.floor_tile(cell, "cold_inlay_v" if cold else "inlay_v")
            elif cy in (y0, y1):
                plan.floor_tile(cell, "cold_inlay_h" if cold else "inlay_h")
            elif cx == centre[0]:
                plan.floor_tile(cell, "cold_b" if cold else "wine_b")
            else:
                plan.floor_tile(cell, "cold_d" if cold else "wine_d")
            painted += 1
    return painted


def walls(plan, faces, wing_of, geom) -> int:
    """Wall dressing: a burial arcade west, gilt panels east, plain ashlar elsewhere.

    This used to hang a niche or a gilt panel wherever a hash roll happened to land,
    on whatever course of the wall that cell was, so the east wall carried red dashes
    at four different heights and the west wall carried black slots wherever the
    arithmetic fell. That is the scattered-ornament finding, and it is worst in the
    room whose whole idea is that the two halves are *organised* differently. The
    panels are now a course - one row of the wall, the dado - and they are placed in
    bays measured from the wing's own centre, so each wing reads as an elevation:
    niches on a rhythm, gilt on a rhythm, nothing in between.
    """
    painted = 0
    for cell in sorted(faces):
        x, y = cell
        wing = wing_of.get((x, y + 1))
        # Ornament goes on the wall's own bottom course. The stack above it is not in
        # this document - the renderer extrudes it into the rock - so a panel placed
        # one row up would float in a cell the validator rightly calls outside the
        # geometry. One course means one height for every panel in the room.
        bay_cell = cell
        if wing == "reaper":
            if x % 5 == 0 or x % 5 == 5:
                if x % 10 == 0:
                    plan.wall_tile(bay_cell, "wall_niche")
                    painted += 1
                elif x % 10 == 5:
                    plan.wall_tile(bay_cell, "wall_iron")
                    painted += 1
        elif wing == "vampire":
            if x % 4 == 0:
                plan.wall_tile(bay_cell, "wall_gilt")
                painted += 1
            elif x % 4 == 2:
                plan.wall_tile(bay_cell, "wall_niche")
                painted += 1
        else:
            if x % 7 == 0:
                plan.wall_tile(bay_cell, "wall_dado_a")
                painted += 1
    return painted


class Placer:
    """Placement with the level's own rules baked in."""

    def __init__(self, plan, floor, geom, guard, faces):
        self.plan = plan
        self.floor = floor
        self.geom = geom
        self.guard = guard
        self.faces = faces

    def wall(self, frame: str, cell, light=None, note="") -> bool:
        """A wall-mounted prop: only on masonry, only where the map is solid."""
        if cell not in self.geom or cell in self.guard:
            return False
        if frame in TALL and cell not in self.faces:
            return False
        if any(entry["frame"] == frame and tuple(entry["cell"]) == tuple(cell)
               for entry in self.plan.props):
            return False
        self.plan.prop(frame, cell, light=light, note=note)
        return True

    def floor_prop(self, frame: str, cell, light=None, note="") -> bool:
        """A freestanding prop: on walkable ground, never in a gameplay cell or
        beside one, and never with another prop already there."""
        if cell not in self.floor or cell in self.geom or cell in self.guard:
            return False
        used = {tuple(entry["cell"]) for entry in self.plan.props}
        if cell in used:
            return False
        self.plan.prop(frame, cell, light=light, note=note)
        return True


def cold_light(cell, energy=0.85, scale=1.7, y=-22, note="cold niche light"):
    return {"x": cell[0] * 16 + 8, "y": cell[1] * 16 + y,
            "color": [0.60, 0.78, 1.0], "energy": energy, "scale": scale,
            "cell": [cell[0], cell[1]], "note": note}


def rose_light(cell, energy=0.9, scale=1.7, y=-22, note="rose candle light"):
    return {"x": cell[0] * 16 + 8, "y": cell[1] * 16 + y,
            "color": [1.0, 0.66, 0.62], "energy": energy, "scale": scale,
            "cell": [cell[0], cell[1]], "note": note}


def gold_light(cell, energy=0.75, scale=1.5, y=-22, note="lamp"):
    return {"x": cell[0] * 16 + 8, "y": cell[1] * 16 + y,
            "color": [1.0, 0.82, 0.55], "energy": energy, "scale": scale,
            "cell": [cell[0], cell[1]], "note": note}


def face_row(faces, y: int, x0: int, x1: int) -> list:
    return [(x, y) for x in range(x0, x1 + 1) if (x, y) in faces]


def face_row(faces, y: int, x0: int, x1: int) -> list:
    return [(x, y) for x in range(x0, x1 + 1) if (x, y) in faces]


# The reliquary's walls are thin slabs, so a prop can only be mounted where the
# renderer actually draws a face: on an east-west wall with floor below it. Those
# rows are fixed by the map, and every wall prop below is addressed by row.
NORTH_WALL = 20      # the wall above both wings' halls
SOUTH_WALL = 44      # the wall below both wings, and the seal band
VAULT_WALL = 3       # the wall above the reward chamber
ANTE_WALL = 16       # the outer wall above the antechamber


def reaper_wing(p: Placer, rect, wing_of) -> int:
    """Austere, cold, funerary: a colonnade north, grilles south, the dead at the walls."""
    x0, y0, x1, y1 = rect
    placed = 0
    for index, cell in enumerate(face_row(p.faces, NORTH_WALL, x0 + 2, x1 - 2)):
        if index % 9 == 4:
            placed += p.wall("column", cell, light=cold_light(cell, 0.30),
                             note="reaper colonnade")
        elif index % 13 == 7:
            placed += p.wall("column_broken", cell, note="fallen column")
        elif index % 5 == 1:
            placed += p.wall("reaper_statue", cell, light=cold_light(cell, 0.40, 1.5),
                             note="reaper statue niche")
        elif index % 7 == 3:
            placed += p.wall("censer", cell, light=cold_light(cell, 0.40, 1.3, -26),
                             note="censer")
    for index, cell in enumerate(face_row(p.faces, SOUTH_WALL, x0 + 3, x1 - 3)):
        if index % 6 == 2:
            placed += p.wall("grille", cell, light=cold_light(cell, 0.35, 1.4, -20),
                             note="niche grille")
        elif index % 6 == 5:
            placed += p.wall("column", cell, light=cold_light(cell, 0.28),
                             note="reaper colonnade")
    # the dead are laid along the walls, never across the fighting floor
    for (cx, cy) in ((x0 + 3, y0 + 1), (x0 + 10, y0 + 1), (x1 - 5, y0 + 1),
                     (x0 + 6, y1 - 1), (x1 - 8, y1 - 1)):
        placed += p.floor_prop("sarcophagus", (cx, cy), note="reaper sarcophagus")
    placed += p.floor_prop("sarcophagus_open", (x1 - 4, y0 + 2),
                           note="opened sarcophagus")
    placed += p.floor_prop("bier", (x0 + 16, y0 + 1), note="bier for the honoured dead")
    placed += p.floor_prop("bier", (x0 + 2, y0 + 13), note="bier for the honoured dead")
    placed += p.floor_prop("bier", (x0 + 30, y0 + 12), note="bier for the honoured dead")
    placed += p.floor_prop("sarcophagus", (x0 + 3, y0 + 17), note="reaper sarcophagus")
    placed += p.floor_prop("sarcophagus", (x0 + 31, y0 + 17), note="reaper sarcophagus")
    placed += p.floor_prop("rubble", (x0 + 18, y1 - 1), note="fallen masonry")
    placed += p.floor_prop("rubble", (x1 - 12, y0 + 14), note="fallen masonry")
    placed += p.floor_prop("rubble", (x0 + 13, y0 + 9), note="broken column")
    return placed


def vampire_wing(p: Placer, rect, wing_of) -> int:
    """Decadent and sacked: velvet, gilt, a fountain that is still running."""
    x0, y0, x1, y1 = rect
    placed = 0
    for index, cell in enumerate(face_row(p.faces, NORTH_WALL, x0 + 2, x1 - 2)):
        if index % 8 in (0, 1, 2):
            placed += p.wall("drape", cell, note="velvet hanging")
        elif index % 8 == 6:
            placed += p.wall("mirror", cell, light=rose_light(cell, 0.40, 1.4, -26),
                             note="cracked mirror")
        elif index % 6 == 2:
            placed += p.wall("candlestand", cell, light=rose_light(cell, 0.55, 1.5),
                             note="candelabrum")
    for index, cell in enumerate(face_row(p.faces, SOUTH_WALL, x0 + 3, x1 - 3)):
        if index % 7 in (1, 2):
            placed += p.wall("drape", cell, note="velvet hanging")
        elif index % 7 == 5:
            placed += p.wall("candlestand", cell, light=rose_light(cell, 0.50, 1.4),
                             note="candelabrum")
    placed += p.floor_prop("fountain", (x0 + 9, y0 + 12), light=rose_light(
        (x0 + 9, y0 + 12), 0.62, 2.0, -34, "the wine fountain"), note="wine fountain")
    placed += p.floor_prop("banquet", (x0 + 13, y0 + 1), note="banquet left standing")
    placed += p.floor_prop("banquet", (x0 + 22, y0 + 1), note="banquet left standing")
    placed += p.floor_prop("banquet", (x0 + 13, y1 - 1), note="banquet left standing")
    placed += p.floor_prop("banquet", (x0 + 3, y0 + 12), note="banquet left standing")
    placed += p.floor_prop("velvet_bench", (x0 + 15, y0 + 12), note="velvet bench")
    placed += p.floor_prop("velvet_bench", (x0 + 3, y0 + 17), note="velvet bench")
    placed += p.floor_prop("velvet_bench", (x0 + 9, y0 + 1), note="velvet bench")
    placed += p.floor_prop("velvet_bench", (x0 + 26, y1 - 1), note="velvet bench")
    placed += p.floor_prop("goblets", (x0 + 16, y0 + 2), note="spilled cups")
    placed += p.floor_prop("goblets", (x0 + 25, y1 - 2), note="spilled cups")
    placed += p.floor_prop("rubble", (x1 - 5, y0 + 15), note="smashed marble")
    placed += p.floor_prop("rubble", (x1 - 13, y1 - 1), note="smashed marble")
    placed += p.floor_prop("rubble", (x0 + 2, y1 - 5), note="smashed marble")
    return placed


def choice_hall(p: Placer, rect, seals, room) -> int:
    """The decision: two sealed doors, an emblem each, and nothing to hide behind."""
    x0, y0, x1, y1 = rect
    placed = 0
    for index, cell in enumerate(face_row(p.faces, SOUTH_WALL, x0 + 4, x1 - 4)):
        if index % 4 == 2:
            placed += p.wall("candlestand", cell, light=rose_light(cell, 0.35, 1.2),
                             note="hall candelabrum")
        elif index % 4 == 0:
            placed += p.wall("column", cell, light=gold_light(cell, 0.30, 1.3),
                             note="hall column")
    # a bench on each side of the hall, out of the through line to either seal
    for cell in ((room[0] + 2, room[3] - 2), (room[2] - 2, room[3] - 2)):
        placed += p.floor_prop("velvet_bench", cell, note="waiting bench")
    return placed


def vault(p: Placer, rect, exit_cell, chest_cell) -> int:
    """The reward chamber: a dais, a named gate, and the elite's own room."""
    x0, y0, x1, y1 = rect
    placed = 0
    # the gate is a real arch over the exit: piers either side, arch above
    for dx in (-2, 2):
        placed += p.wall("column", (exit_cell[0] + dx, VAULT_WALL),
                         light=gold_light((exit_cell[0] + dx, VAULT_WALL),
                                          0.42, 1.5, 8, "exit gate light"),
                         note="exit gate pier")
    placed += p.wall("gate_frame", (exit_cell[0], VAULT_WALL),
                     note="exit gate arch")
    for cell in ((x0 + 2, VAULT_WALL), (x1 - 2, VAULT_WALL)):
        placed += p.wall("banner_pale", cell, light=cold_light(cell, 0.35, 1.4, 8),
                         note="reliquary banner")
    # the dais corners, and the founders either side of the chest
    placed += p.floor_prop("sarcophagus", (chest_cell[0] - 4, chest_cell[1] + 3),
                           note="founder's sarcophagus")
    placed += p.floor_prop("sarcophagus", (chest_cell[0] + 4, chest_cell[1] + 3),
                           note="founder's sarcophagus")
    placed += p.floor_prop("bier", (chest_cell[0], chest_cell[1] + 5),
                           note="the elite's bier")
    # the small things along the dais walls: a reliquary is also a store cupboard
    for (cx, cy) in ((x0 + 2, y0 + 6), (x1 - 2, y0 + 6), (x0 + 2, y0 + 10),
                     (x1 - 2, y0 + 10)):
        placed += p.floor_prop("rubble", (cx, cy), note="broken reliquary casque")
    placed += p.floor_prop("bench_stone", (x0 + 4, y0 + 3), note="stone bench")
    placed += p.floor_prop("bench_stone", (x1 - 4, y0 + 3), note="stone bench")
    placed += p.floor_prop("goblets", (x0 + 6, y1 - 1), note="offering cups")
    # the dais is lit from the wall, not by furniture standing in the walkway
    for cx in (chest_cell[0] - 5, chest_cell[0] + 5):
        plan_light = rose_light((cx, chest_cell[1] + 1), 0.36, 1.5, 0,
                                "vault dais light")
        p.plan.lights.append(plan_light)
    return placed


def approach(p: Placer, rect) -> int:
    """The way in: a lamp lit for whoever comes back."""
    x0, y0, x1, y1 = rect
    placed = 0
    for index, cell in enumerate(face_row(p.faces, ANTE_WALL, x0 - 2, x1 - 2)):
        if index % 3 == 1:
            placed += p.wall("banner_pale", cell, light=gold_light(cell, 0.4, 1.3, 10),
                             note="reliquary banner")
    for (cx, cy) in ((x0 + 2, y0 + 3), (x1 - 2, y0 + 5), (x1 - 3, y1 - 1)):
        placed += p.floor_prop("rubble", (cx, cy), note="fallen masonry")
    placed += p.floor_prop("bench_stone", (x0 + 2, y0 + 6), note="stone bench")
    placed += p.floor_prop("bench_stone", (x1 - 2, y0 + 8), note="stone bench")
    return placed


def build():
    level = load_level(LEVEL)
    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    guard = protected(level)
    face_map = wall_faces(floor, geom)
    faces = {cell for values in face_map.values() for cell in values}
    rooms = room_rects(level)

    seals = [tuple(int(v) // 16 for v in entity["position"])
             for entity in level["entities"]
             if entity["type"] in ("reliquary_branch_seal",)]
    if len(seals) != 2:
        raise SystemExit("expected two branch seals, found %d" % len(seals))
    seals.sort()

    wing_of = {}
    # The metadata room rects run wall to wall; the wings' halls are the cells
    # between the two face rows that the renderer draws, which is what the props
    # have to stand on.
    reaper = (5, NORTH_WALL + 1, 42, SOUTH_WALL - 1)
    vampire = (61, NORTH_WALL + 1, 98, SOUTH_WALL - 1)
    for rect in (reaper, vampire):
        inside = {c for c in floor if rect[0] <= c[0] <= rect[2] and rect[1] <= c[1] <= rect[3]}
        if len(inside) < 500:
            raise SystemExit("wing interior looks wrong: %d cells for %s" % (len(inside), rect))
    for cell in floor:
        if reaper[0] <= cell[0] <= reaper[2] and reaper[1] <= cell[1] <= reaper[3]:
            wing_of[cell] = "reaper"
        elif vampire[0] <= cell[0] <= vampire[2] and vampire[1] <= cell[1] <= vampire[3]:
            wing_of[cell] = "vampire"

    plan = Plan()
    shade_floor(plan, {c for c in floor if wing_of.get(c) is None}, geom, rooms, wing=None)
    shade_floor(plan, {c for c in floor if wing_of.get(c) == "reaper"}, geom, rooms,
                wing="reaper")
    shade_floor(plan, {c for c in floor if wing_of.get(c) == "vampire"}, geom, rooms,
                wing="vampire")
    painted_spine = spine(plan, floor, geom)
    painted_emblems = emblems(plan, floor, geom)
    painted_dais = dais(plan, floor, geom)
    for (dx, dy), frame in disc_offsets(3).items():
        cell = (51 + dx, 9 + dy)
        if cell in floor and cell not in geom:
            plan.floor_tile(cell, "cold_" + frame)
    painted_slabs = (tomb_slab(plan, floor, geom, (12, 31), 11, cold=True)
                     + tomb_slab(plan, floor, geom, (88, 31), 11, cold=False))
    painted_walls = walls(plan, faces, wing_of, geom)
    painted_wear = wear(plan, floor, geom, wing_of)

    p = Placer(plan, floor, geom, guard, faces)
    props = 0
    props += reaper_wing(p, reaper, wing_of)
    props += vampire_wing(p, vampire, wing_of)
    props += choice_hall(p, rooms["l8_choice_hall"], seals, rooms["l8_choice_hall"])
    exit_cell = next((tuple(int(v) // 16 for v in entity["position"])
                      for entity in level["entities"]
                      if entity["type"] == "exit_gate"), (51, 7))
    chest_cell = next((tuple(int(v) // 16 for v in entity["position"])
                       for entity in level["entities"]
                       if entity["type"] == "treasure_chest"
                       and tuple(int(v) // 16 for v in entity["position"])[1] < 20),
                      (51, 13))
    props += vault(p, rooms["l8_elite_vault"], exit_cell, chest_cell)
    props += approach(p, rooms["l8_south_approach"])

    # the two wing lights: what each half of the building is lit by
    for cell in ((reaper[0] + 8, reaper[1] + 6), (reaper[0] + 24, reaper[1] + 14),
                 (reaper[0] + 10, reaper[3] - 6), (reaper[2] - 6, reaper[3] - 10)):
        plan.lights.append(cold_light(cell, 0.35, 2.6, 0, "reaper wing ambient light"))
    for cell in ((vampire[0] + 9, vampire[1] + 6), (vampire[0] + 26, vampire[1] + 12),
                 (vampire[0] + 12, vampire[3] - 6), (vampire[2] - 6, vampire[3] - 10)):
        plan.lights.append(rose_light(cell, 0.40, 2.6, 0, "vampire wing ambient light"))

    document = {
        "schema": "chapter1_architecture/1",
        "level": "chapter_1_level_8",
        "kit": KIT,
        "tile_size": 16,
        "note": (
            "Authored architecture for The Divided Reliquary. Derived, additive and "
            "deterministic: it decorates cells the level already defines, never "
            "creates walkable or solid ground, keeps every branch seal, chest, exit "
            "and door clear, and gives the two wings separate materials and light. "
            "Generated by tools/level8/architecture_reliquary.py."
        ),
        # A cold stone interior: neither wing's light is sunlight.
        # Measured at 0edc5a1: 1.25% of the frame above 245 and a p10 of 70 - bright
        # everywhere, lit nowhere, because 45 lamps averaging 0.41 energy were losing
        # to an ambient that did the lighting by itself. The first attempt at this
        # (ambient 0.58, lamps x1.6) traded one fault for a worse one: 5.0% of the
        # frame clipped, so the level went from flat to blown. 0.64 and x1.2 is the
        # pair that was measured to hold the highlights.
        "ambient": [0.64, 0.62, 0.66],
        "background": [0.028, 0.026, 0.036],
        "layers": {"floor": plan.floor, "wall": plan.wall},
        "props": plan.props,
        "lights": plan.lights,
        "stats": {
            "floor_overrides": len(plan.floor),
            "wall_overrides": len(plan.wall),
            "props": len(plan.props),
            "lights": len(plan.lights),
            "spine_cells": painted_spine,
            "emblem_cells": painted_emblems,
            "dais_cells": painted_dais,
            "tomb_slab_cells": painted_slabs,
            "wall_dressing": painted_walls,
            "wear_cells": painted_wear,
        },
    }
    # Every lamp in this level was authored at 0.28-0.9 energy while the ambient did
    # the actual lighting, which is why the sweep measured 1.25% of the frame above 245
    # and a p10 of 70: bright everywhere, lit nowhere. The ambient is down to 0.58 and
    # the authored energies are scaled together here, so the relative order the author
    # wrote survives (normalise_lights' soft knee still caps the top) and the lamps can
    # carry the lighting instead of decorating it.
    # The gain is applied once per light, not once per place the light is written down.
    # A prop's light is the same dict that also goes into plan.lights (kitlib's
    # Placer.prop appends it to both), so applying the gain in both loops multiplied
    # every lamp carried by a wall prop by 1.44 instead of 1.2 - the exit gate piers,
    # the wine fountain, the candle stands and the niches were all 20 % hotter than
    # authored, while the lights the generators append directly were correct. That is
    # the whole of the vault's remaining blow-out: measured on the exit frame, mean
    # 151.8 and 15.2 % of the field above 245 before any of this pass.
    gained = 0
    seen: set[int] = set()
    for light in plan.lights:
        if not isinstance(light, dict) or "energy" not in light or id(light) in seen:
            continue
        seen.add(id(light))
        light["energy"] = round(float(light["energy"]) * LAMP_GAIN, 2)
        gained += 1
    for entry in plan.props:
        light = entry.get("light") if isinstance(entry, dict) else None
        if not isinstance(light, dict) or "energy" not in light or id(light) in seen:
            continue
        seen.add(id(light))
        light["energy"] = round(float(light["energy"]) * LAMP_GAIN, 2)
        gained += 1
    document["stats"]["lights_gained"] = gained
    return document, level


def main() -> None:
    document, level = build()
    problems = validate(document, level, tall=TALL)
    normalise_lights(document)
    write_document(OUT, document)
    print("level 8 architecture -> %s" % os.path.relpath(OUT, ROOT))
    for key, value in document["stats"].items():
        print("  %-20s %s" % (key, value))
    if problems:
        print("  PROBLEMS (%d):" % len(problems))
        for problem in problems[:20]:
            print("   ", problem)
    else:
        print("  validation: clean")


if __name__ == "__main__":
    main()
