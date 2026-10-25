#!/usr/bin/env python3
"""Author the architecture of the Blood Crucible (Chapter 1, Level 5).

This is an *authored* document, not a scatter generator: the set pieces, their
positions and the room compositions below were chosen per floor and are written
out explicitly. What is generated is only the repetition *inside* an authored
decision — e.g. "hang a banner on every third wall face of the nave" — and every
such rule is written here, in this file, with its range.

Output
    data/levels/chapter_1_level_5_architecture.json

Schema
    {
      "level": "chapter_1_level_5",
      "tile_size": 16,
      "layers": {
        "floor": [{"cell": [x, y], "frame": "floor_aisle_v"}, ...],
        "wall":  [{"cell": [x, y], "frame": "wall_field_a"}, ...]
      },
      "props": [{"frame": "arch_monumental", "cell": [x, y], "z": 0, "y_sort": true,
                 "light": {...}, "note": "..."}],
      "lights": [{"x": px, "y": px, "color": [r,g,b], "energy": e, "scale": s}]
    }

Rules that the validator enforces (see validate()):
  * A wall/floor decoration may only sit on a cell that already exists in the
    level's own Backdrop (floor) or Geometry (solid) layer. The presentation
    layer never invents a cell the map does not have, so it can never imply a
    wall where the player can walk, or a walkable cell where the player cannot.
  * A prop whose base cell is walkable must be flagged "low": true, meaning it
    is deliberately a floor-level feature the player walks over (stains,
    channels, inlays). Everything else must be backed by solid geometry, so no
    prop ever floats in mid-air or blocks an invisible cell.
  * No prop or decoration may occupy the boss's spawn cell, the player spawn
    cell, a checkpoint, a sigil, a door, a chest or the exit.

Run:  python3 tools/level5/architecture.py
"""

from __future__ import annotations

import json
import math
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
LEVEL = os.path.join(ROOT, "data", "levels", "chapter_1_level_5.json")
OUT = os.path.join(ROOT, "data", "levels", "chapter_1_level_5_architecture.json")
T = 16

# Cells that must never be covered: they are the gameplay furniture.
PROTECTED_TYPES = {
    "player", "sigil", "checkpoint", "exit_gate", "floor_door", "chest",
    "hooded_archer_miniboss",
}


def load_level() -> dict:
    with open(LEVEL, encoding="utf-8") as fh:
        return json.load(fh)


def cells(doc: dict, layer: str) -> set:
    return {(int(t["x"]), int(t["y"])) for t in doc["layers"].get(layer, [])}


def protected(doc: dict) -> set:
    out = set()
    for entity in doc["entities"]:
        if entity.get("type") in PROTECTED_TYPES:
            pos = entity.get("position", [0, 0])
            cell = (int(pos[0]) // T, int(pos[1]) // T)
            # protect the cell and its immediate surroundings: props must not sit
            # on top of an interactable the player has to see and touch.
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    out.add((cell[0] + dx, cell[1] + dy))
            # the boss drop lands under the archer; keep a wider berth there
            if entity.get("type") == "hooded_archer_miniboss":
                for dx in range(-3, 4):
                    for dy in range(-2, 3):
                        out.add((cell[0] + dx, cell[1] + dy))
    return out


def wall_faces(floor: set, geom: set) -> list:
    """Solid cells whose south neighbour is walkable: the band the camera sees."""
    faces = [(x, y) for (x, y) in geom if (x, y + 1) in floor]
    faces.sort(key=lambda c: (c[1], c[0]))
    return faces


def east_west_faces(floor: set, geom: set) -> list:
    """Solid cells with walkable ground to the west or east: side walls."""
    out = []
    for (x, y) in sorted(geom, key=lambda c: (c[1], c[0])):
        if (x - 1, y) in floor or (x + 1, y) in floor:
            out.append((x, y))
    return out


def hang_anchor(geom: set, x: int, y: int, *, limit: int = 10):
    """Anchor a hanging prop to the nearest solid cell at or above (x, y).

    Chains and gibbets hang from a ceiling, so the cell they are drawn from must
    be part of the wall mass above the room. Searching upward is deterministic
    and keeps the authored intent ("hang over the court") readable in the plan.
    """
    for step in range(limit + 1):
        if (x, y - step) in geom:
            return (x, y - step)
    return None


# Frames that describe the surface a room is walked on: detail painted over plain
# floor. They must never erase a lane, because a stain in a corridor is still a
# corridor.
SURFACE_FRAMES = {"floor_worn", "floor_broken", "stain_a", "stain_b", "stain_c"}
# Directional floor frames. Two of them on one cell need a crossing piece.
LANE_FRAMES = {"floor_aisle_v", "floor_aisle_h", "floor_channel_v", "floor_channel_h"}
CROSSING_FRAMES = {frozenset(("floor_channel_v", "floor_channel_h")): "floor_channel_x"}


class Plan:
    """Collects one frame per cell, and resolves cells that two passes claim.

    The floor layer draws one tile per cell, so a second write to a cell is not a
    layer, it is an overwrite. The room passes and the dressing passes do claim the
    same cells — an aisle cross claimed by both aisle directions, a stain dropped on
    a lane — and the last writer silently won. That is why the Crucible's corridors
    changed frame halfway along their length: the aisle was erased by a stain, or by
    the perpendicular aisle of a crossing.

    Now the resolution is a rule rather than an accident:

    * a lane beats a surface — the wall run is structural, the wear is not;
    * two lanes at one cell become the kit's crossing piece when the kit has one
      (the drainage channel does), and otherwise keep the first lane and are
      counted, so the loss is visible in the generator's report instead of
      only in the picture;
    * two surfaces keep the first.

    The Counter is reported by main() and by the validator.
    """

    def __init__(self) -> None:
        self._floor: dict = {}
        self.wall: list = []
        self.props: list = []
        self.lights: list = []
        self.claims = 0
        self.lane_clashes: list = []

    def floor_tile(self, cell, frame) -> None:
        key = (int(cell[0]), int(cell[1]))
        if key not in self._floor:
            self._floor[key] = frame
            return
        current = self._floor[key]
        if current == frame:
            self.claims += 1
            return
        self.claims += 1
        if current in LANE_FRAMES and frame in LANE_FRAMES:
            crossing = CROSSING_FRAMES.get(frozenset((current, frame)))
            if crossing:
                self._floor[key] = crossing
            else:
                # No aisle crossing exists in the kit. Keep the first lane rather
                # than the last, so the corridor keeps the direction it started in.
                self.lane_clashes.append((key, current, frame))
            return
        if current in LANE_FRAMES:
            return  # the lane wins over the wear
        if frame in LANE_FRAMES:
            self._floor[key] = frame
            return
        # two surfaces, or a surface over plain floor: the first is kept
        return

    @property
    def floor(self) -> list:
        return [{"cell": [cell[0], cell[1]], "frame": frame}
                for cell, frame in self._floor.items()]

    def wall_tile(self, cell, frame) -> None:
        self.wall.append({"cell": [cell[0], cell[1]], "frame": frame})

    def hang(self, frame, geom, x, y, *, note: str = "", limit: int = 10) -> None:
        anchor = hang_anchor(geom, x, y, limit=limit)
        if anchor is not None:
            self.prop(frame, anchor, z=1, note=note)

    def prop(self, frame, cell, *, z: int = 0, low: bool = False, light=None,
             note: str = "", flip: bool = False, anchor: str = "base",
             span: bool = False) -> None:
        entry = {
            "frame": frame,
            "cell": [cell[0], cell[1]],
            "z": z,
            "y_sort": not low,
            "low": low,
            "anchor": anchor,
            "note": note,
        }
        if span:
            entry["span"] = True
        if light:
            entry["light"] = light
            self.lights.append(dict(light, cell=[cell[0], cell[1]]))
        if flip:
            entry["flip"] = True
        self.props.append(entry)


# ---------------------------------------------------------------------------
# Floor 1 — Processional Forecourt (y 0..30)
# ---------------------------------------------------------------------------
# The player spawns in a small antechamber at (9,17). Looking east they see the
# monumental gate at x=25..29, and past it the raised crucible altar built on the
# level's existing solid island at x=40..48, y=11..22. The nave between them is
# paved as a processional walk with a blood channel down its centre line, and the
# antechamber walls carry the complex's banner and torch rhythm.
def floor_one(plan: Plan, floor: set, geom: set, faces: list, guard: set) -> None:
    # --- the processional walk: centre line of the nave, x 26..60 ----------
    for x in range(26, 61):
        for y in (16, 17):
            if (x, y) in floor:
                plan.floor_tile((x, y), "floor_aisle_v")
    # --- blood channels running off the walk toward the altar -------------
    for y in range(12, 23):
        if (33, y) in floor:
            plan.floor_tile((33, y), "floor_channel_v")
        if (56, y) in floor:
            plan.floor_tile((56, y), "floor_channel_v")
    for x in range(34, 40):
        if (x, 13) in floor:
            plan.floor_tile((x, 13), "floor_channel_h")
        if (x, 21) in floor:
            plan.floor_tile((x, 21), "floor_channel_h")
    # --- threshold in front of the gate ----------------------------------
    for x in range(23, 30):
        for y in range(12, 23):
            if (x, y) in floor and (x, y) not in guard:
                plan.floor_tile((x, y), "floor_aisle_h")
    # --- wear and stains: authored, sparse, away from the walking line -----
    for (x, y) in (
        (31, 20), (38, 17), (43, 24), (48, 13), (52, 15), (53, 20),
        (14, 13), (21, 15), (11, 22), (20, 24),
    ):
        if (x, y) in floor and (x, y) not in guard:
            plan.floor_tile((x, y), "stain_a" if (x + y) % 3 else "stain_b")
    # grate drains under the channels
    for (x, y) in ((33, 23), (56, 23), (34, 12), (39, 22)):
        if (x, y) in floor:
            plan.floor_tile((x, y), "floor_grate")

    # --- THE GATE ---------------------------------------------------------
    # 128x128 px = 8 x 8 cells. Its base sits on the floor band at y=22 so the
    # opening lines up with the walk (rows 16-21), and the arch rises into the
    # solid wall band above the nave's west wall.
    # The map already pinches the hall with two 2x3 piers at x13..14 and x24..25
    # (y20..23). The gate stands on them, so its jambs are real solid masonry and
    # the player walks through an opening that was always there.
    # The gate is a façade, and a façade belongs on a south-facing wall. It is
    # built onto the nave's north wall band (solid at y=10..11), above the
    # processional walk, so it reads as the sealed ceremonial gate of the
    # complex rather than as a doorway painted over walkable ground.
    # Two gates, both built onto real wall bands:
    #  * the colossal one on the antechamber's north wall, which is what the
    #    player sees in the first frame of the level;
    #  * a smaller portal behind the altar, closing the processional axis.
    plan.prop("arch_wide", (16, 10), z=3,
              note="colossal ceremonial gate on the antechamber's north wall",
              light={"x": 16 * T + 8, "y": 10 * T + 1, "color": [1.0, 0.58, 0.30],
                     "energy": 1.9, "scale": 5.6})
    plan.prop("arch_doorway", (48, 12), z=3,
              note="portal closing the processional axis behind the altar",
              light={"x": 48 * T + 8, "y": 12 * T + 1, "color": [1.0, 0.64, 0.36],
                     "energy": 1.3, "scale": 3.6})
    # --- THE ALTAR: raised crucible on the existing solid island ----------
    plan.prop("crucible_small", (48, 15), z=1, low=True, anchor="center",
              note="raised crucible, built on the level's own solid island (x44..52, y11..18)",
              light={"x": 48 * T + 8, "y": 14 * T + 8, "color": [1.0, 0.56, 0.38],
                     "energy": 1.25, "scale": 5.6})
    # altar dressing on the island's shoulders
    plan.prop("altar", (44, 11), z=2, note="offering table on the altar island's west shoulder")
    plan.prop("stand", (52, 12), z=2, note="brass feed pipes into the crucible's east side")
    plan.prop("skulls", (43, 19), z=1, low=True, note="offerings at the altar's foot")
    plan.prop("skulls", (53, 19), z=1, low=True, note="offerings at the altar's east foot")
    plan.prop("slab", (53, 21), z=1, low=True, note="sacrificial slab below the altar steps")

    # --- engaged columns down the nave, on the wall bands -----------------
    for x in (31, 37, 49, 55):
        if (x, 10) in geom:
            plan.prop("column", (x, 10), z=1, note="engaged pier, north wall of the nave")
    for x in (33, 45, 57):
        if (x, 23) in geom:
            plan.prop("column", (x, 23), z=1, note="engaged pier, south side of the nave")
    plan.prop("column_broken", (25, 20), z=1, note="snapped pier: the nave is damaged")

    # --- brazier pairs flanking the gate and the altar -------------------
    for cell in ((16, 25), (22, 25), (39, 23), (56, 23)):
        if cell in floor and cell not in guard:
            plan.prop("brazier", cell, z=1, low=True,
                      note="fire bowl on the processional line",
                      light={"x": cell[0] * T + 8, "y": cell[1] * T + 4,
                             "color": [1.0, 0.66, 0.32], "energy": 1.25, "scale": 3.4})

    # --- THE FOREGROUND RITE: the shrine the first frame has to show ------
    # The brief is explicit that the altar must be inside the spawn camera view,
    # not thirty-four tiles east of it. The basin still stands on its island, but
    # the room the player opens in now holds the station the level's own name
    # promises: a sacrificial stone on the gate's axis, fire on both sides, the
    # bones of what was offered, and blood in the paving around it. Everything is
    # furniture on walkable ground, so nothing here invents collision.
    plan.prop("slab", (15, 15), z=1, low=True, note="sacrificial stone on the gate's axis")
    plan.prop("stand", (18, 14), z=1, low=True, note="brass offering stand beside the stone")
    for cell in ((11, 15), (20, 15)):
        if cell in floor and cell not in guard:
            plan.prop("brazier", cell, z=1, low=True, note="fire at the shrine's shoulder",
                      light={"x": cell[0] * T + 8, "y": cell[1] * T + 4,
                             "color": [1.0, 0.62, 0.30], "energy": 1.5, "scale": 3.2})
    for cell in ((13, 16), (17, 16)):
        if cell in floor and cell not in guard:
            plan.prop("skulls", cell, z=1, low=True, note="offerings at the shrine's step")
    for cell in ((14, 14), (16, 14), (15, 16), (13, 15), (17, 15)):
        if cell in floor and cell not in guard:
            plan.floor_tile(cell, "stain_a" if (cell[0] + cell[1]) % 2 else "stain_b")

    # --- the antechamber: banner + emblem + torch rhythm -----------------
    for cell in ((7, 10), (9, 10), (22, 10), (24, 10)):
        if (cell[0], cell[1]) in geom:
            plan.prop("banner", cell, z=1, note="chapter banner, antechamber north wall")
    plan.prop("emblem", (20, 10), z=2, note="crucible sigil carved beside the gate")
    for cell in ((5, 14), (5, 21), (23, 14), (23, 21)):
        if cell in geom:
            plan.prop("torch", cell, z=1, note="wall bracket, antechamber",
                      light={"x": cell[0] * T + 12, "y": cell[1] * T + 14,
                             "color": [1.0, 0.70, 0.40], "energy": 0.95, "scale": 2.6})
    # the antechamber's own rubble and clutter
    plan.prop("rubble_large", (30, 12), z=1, low=True, note="collapse below the north wall")
    plan.prop("rubble_small", (6, 24), z=1, low=True, note="debris by the entrance")
    plan.hang("cage", geom, 10, 12, note="hanging gibbet over the antechamber")
    plan.hang("chain_long", geom, 17, 12, note="chains over the antechamber")
    plan.hang("chain_short", geom, 21, 12, note="chains over the antechamber")
    plan.prop("skulls", (10, 15), z=1, low=True, note="bone heap in the antechamber")
    plan.prop("skulls", (20, 20), z=1, low=True, note="bone heap in the antechamber")

    # --- the camp hall east of the altar ---------------------------------
    for cell in ((63, 9), (69, 9), (75, 9), (81, 9), (87, 9)):
        if (cell[0], cell[1]) in geom:
            plan.prop("column", cell, z=1, note="colonnade of the guard hall")
    for cell in ((66, 9), (78, 9), (90, 9)):
        if (cell[0], cell[1]) in geom:
            plan.prop("banner", cell, z=1, note="guard hall banner")
    for cell in ((62, 22), (72, 22), (84, 22)):
        if cell in floor and cell not in guard:
            plan.prop("brazier", cell, z=1, low=True, note="guard hall fire bowl",
                      light={"x": cell[0] * T + 8, "y": cell[1] * T + 4,
                             "color": [1.0, 0.62, 0.30], "energy": 1.2, "scale": 3.2})
    plan.prop("rubble_large", (96, 21), z=1, low=True, note="damage at the guard hall's east end")
    plan.prop("rubble_column", (98, 20), z=1, low=True, note="toppled column, guard hall")


# ---------------------------------------------------------------------------
# Floor 2 — Blood Court (y 30..60)
# ---------------------------------------------------------------------------
# The landing is a dwarf gallery; the long spine runs east to the blood court,
# which is built as a sunken court: a monumental octagonal basin set into the
# floor, ringed by a paved kerb, with four raised ritual stations on the corner
# blocks and the level's own central masonry island rebuilt as a parapet wall.
def floor_two(plan: Plan, floor: set, geom: set, faces: list, guard: set) -> None:
    # --- landing: dwarf gallery ------------------------------------------
    for y in range(42, 57):
        if (6, y) in floor:
            plan.floor_tile((6, y), "floor_aisle_v")
    for cell in ((8, 41), (13, 41), (17, 41)):
        if cell in geom:
            plan.prop("column", cell, z=1, note="dwarf gallery colonnade")
    for cell in ((10, 41), (15, 41)):
        if cell in geom:
            plan.prop("banner", cell, z=1, note="landing banner")
    plan.prop("torch", (5, 44), z=1, note="landing bracket",
              light={"x": 5 * T + 12, "y": 44 * T + 14, "color": [1.0, 0.70, 0.42],
                     "energy": 0.95, "scale": 2.6})
    plan.prop("brazier", (19, 50), z=1, low=True, note="landing fire bowl",
              light={"x": 19 * T + 8, "y": 50 * T + 4, "color": [1.0, 0.66, 0.34],
                     "energy": 1.15, "scale": 3.0})
    plan.prop("slab", (14, 55), z=1, low=True, note="preparation slab by the landing")

    # --- the spine: paved walk east from the landing ----------------------
    for x in range(20, 74):
        for y in (47, 48):
            if (x, y) in floor:
                plan.floor_tile((x, y), "floor_aisle_v" if x % 2 else "floor_aisle_h")
    for x in range(30, 74):
        if (x, 51) in floor:
            plan.floor_tile((x, 51), "floor_channel_h")
    # --- the level's central masonry island becomes a parapet ------------
    # x 26..57, y 45..53 is solid in the authored map; dress its face as a
    # constructed parapet with a coping line and two corner piers.
    for x in range(26, 58):
        if (x, 53) in geom:
            plan.wall_tile((x, 53), "wall_cornice")
        if (x, 54) in geom:
            plan.wall_tile((x, 54), "wall_plinth")
    for cell in ((26, 44), (44, 44), (57, 44)):
        if cell in geom:
            plan.prop("column", cell, z=1, note="parapet pier on the ring wall")
    for cell in ((33, 44), (50, 44)):
        if cell in geom:
            plan.prop("banner", cell, z=1, note="ring wall banner")

    # --- THE BLOOD COURT -------------------------------------------------
    # The court floor spans x74..109, y40..56 and is a bare box in the authored
    # map. It is rebuilt as a sunken court: a monumental basin sunk into the
    # centre, a paved kerb, raised ritual stations on the ring of small solid
    # blocks the map already has along its north and south edges, and a
    # colonnade of piers on those same blocks.
    court_cx, court_cy = 91, 46
    plan.prop("crucible_grand", (91, 46), z=1, low=True, anchor="center",
              note="monumental sunken basin at the centre of the blood court",
              light={"x": court_cx * T + 8, "y": court_cy * T + 8,
                     "color": [1.0, 0.52, 0.34], "energy": 1.45, "scale": 5.4})
    # paved apron ringing the basin
    for y in range(court_cy - 6, court_cy + 7):
        for x in range(court_cx - 10, court_cx + 11):
            if (x, y) in floor and (x, y) not in guard:
                ring = max(abs((x - court_cx) / 9.0), abs((y - court_cy) / 6.0))
                if 0.85 <= ring <= 1.0:
                    plan.floor_tile((x, y), "floor_aisle_h" if (x + y) % 2 else "floor_aisle_v")
                elif ring > 1.0 and (x + y) % 7 == 0:
                    plan.floor_tile((x, y), "stain_b")
    # four blood channels running from the basin to the court's wall stations
    for (dx, dy, frame_name) in ((0, -1, "floor_channel_v"), (0, 1, "floor_channel_v"),
                                 (-1, 0, "floor_channel_h"), (1, 0, "floor_channel_h")):
        for step in range(7, 12):
            x = court_cx + dx * step
            y = court_cy + dy * step
            if (x, y) in floor and (x, y) not in guard:
                plan.floor_tile((x, y), frame_name)
    # ritual stations and piers on the court's own solid blocks. The north range
    # stops west of the basin: the basin is 276 px wide and 166 tall, so a pier at
    # x 86, 94 or 98 was drawn straight through its rim -- the first native frames
    # of this court showed piers standing in the bowl.
    basin_left, basin_right = court_cx - 9, court_cx + 9
    basin_top, basin_bottom = court_cy - 5, court_cy + 5

    def clear_of_basin(cell: tuple) -> bool:
        return not (basin_left <= cell[0] <= basin_right
                    and basin_top <= cell[1] <= basin_bottom)

    for cell in ((74, 42), (79, 42), (86, 42), (94, 42), (98, 42)):
        if cell in geom and clear_of_basin(cell):
            plan.prop("column", cell, z=1, note="court colonnade on the north block range")
    for cell in ((75, 55), (85, 55), (91, 55), (97, 55), (107, 55)):
        if cell in geom:
            plan.prop("column", cell, z=1, note="court colonnade on the south block range")
    for cell in ((74, 54), (107, 54)):
        if cell in geom:
            plan.prop("altar", cell, z=1, low=True, note="raised ritual station at the court's corner")
    for cell in ((77, 43), (103, 43)):
        if cell in geom and clear_of_basin(cell):
            plan.prop("banner", cell, z=1, note="court banner on the north range")
    for cell in ((86, 55), (97, 55)):
        if cell in geom:
            plan.prop("banner", cell, z=1, note="court banner on the south range")
    plan.prop("emblem", (79, 42) if (79, 42) in geom else (74, 42), z=2,
              note="crucible sigil over the court's north range")
    # fire on the kerb, deliberately warm against the cold court
    for cell in ((court_cx - 11, court_cy - 7), (court_cx + 11, court_cy - 7),
                 (court_cx - 11, court_cy + 7), (court_cx + 11, court_cy + 7)):
        if cell in floor and cell not in guard:
            plan.prop("brazier", cell, z=1, low=True, note="court corner fire",
                      light={"x": cell[0] * T + 8, "y": cell[1] * T + 4,
                             "color": [1.0, 0.64, 0.32], "energy": 1.35, "scale": 3.8})
    # damage and evidence of the fight that happened here
    plan.prop("rubble_column", (106, 51), z=1, low=True, note="toppled column in the court")
    plan.prop("rubble_large", (80, 53), z=1, low=True, note="masonry fall on the court's south side")
    plan.prop("rubble_small", (103, 45), z=1, low=True, note="debris east of the basin")
    plan.prop("slab", (79, 47), z=1, low=True, note="sacrificial slab on the court's west side")
    plan.prop("slab", (100, 50), z=1, low=True, note="sacrificial slab on the court's east side")
    plan.hang("cage", geom, 93, 44, note="gibbet over the court")
    plan.hang("chain_long", geom, 88, 44, note="chains over the court")
    plan.hang("chain_long", geom, 99, 44, note="chains over the court")
    plan.hang("chain_short", geom, 84, 44, note="chains over the court")
    for cell in ((84, 49), (88, 43), (95, 44)):
        if cell in floor and cell not in guard:
            plan.prop("skulls", cell, z=1, low=True, note="bone drift across the court")
    for cell in ((82, 44), (92, 53)):
        if cell in floor and cell not in guard:
            plan.floor_tile(cell, "stain_a" if (cell[0] + cell[1]) % 2 else "stain_b")

    # --- THE COURT'S ARCHITECTURE, finished ------------------------------
    # The north range is the court's monumental wall: engaged piers on a regular
    # bay rhythm, banners between them, and the sigil of the order at each end.
    # This is the object-scale architecture the reference rooms carry along their
    # walls; the basin alone was never going to be enough.
    for cell in ((72, 39), (80, 39), (88, 39), (96, 39), (104, 39)):
        if cell in geom:
            plan.prop("column", cell, z=1, note="court wall: engaged pier on the north range")
    for cell in ((76, 39), (84, 39), (92, 39), (100, 39)):
        if cell in geom:
            plan.prop("banner", cell, z=1, note="court wall: order banner between piers")
    for cell in ((70, 39), (108, 39)):
        if cell in geom:
            plan.prop("emblem", cell, z=2, note="court wall: sigil at the range's end")
    for cell in ((74, 39), (102, 39)):
        if cell in geom:
            plan.prop("torch", cell, z=1, note="court wall: bracket picking out the piers",
                      light={"x": cell[0] * T + 8, "y": cell[1] * T + 12,
                             "color": [1.0, 0.66, 0.38], "energy": 1.0, "scale": 2.4})
    # the south ledge is the low wall behind the fighting line: piers, so the
    # court is enclosed on both long sides instead of only on the north
    for cell in ((85, 57), (90, 57), (95, 57)):
        if cell in geom:
            plan.prop("column", cell, z=1, note="court wall: pier on the south ledge")

    # --- four ritual workstations, set on the court's diagonals -----------
    # Each is one object, not a pile: a working slab, its offering stand, and the
    # fire that lights the work. They are the secondary points of interest that
    # make the room a place where something was done, and they are placed on the
    # diagonals so they frame the basin instead of crowding it.
    workstations = (
        ((80, 41), (81, 41), (79, 41), "north west workstation: the blood is drawn here"),
        ((103, 41), (104, 41), (102, 41), "north east workstation: the vessels are filled here"),
        ((80, 52), (81, 52), (79, 53), "south west workstation: the offering is prepared"),
        ((103, 52), (104, 52), (102, 53), "south east workstation: the tally is kept"),
    )
    for slab_cell, stand_cell, skull_cell, note in workstations:
        if slab_cell in floor and slab_cell not in guard:
            plan.prop("slab", slab_cell, z=1, low=True, note=note)
        if stand_cell in floor and stand_cell not in guard:
            plan.prop("stand", stand_cell, z=1, low=True, note=note + " - offering stand")
        if skull_cell in floor and skull_cell not in guard:
            plan.prop("skulls", skull_cell, z=1, low=True, note=note + " - the offering")

    # --- the court's east dais: a raised station the ritual served ---------
    for cell in ((106, 44), (106, 48)):
        if cell in floor and cell not in guard:
            plan.prop("brazier", cell, z=1, low=True, note="dais fire, east end of the court",
                      light={"x": cell[0] * T + 8, "y": cell[1] * T + 4,
                             "color": [1.0, 0.60, 0.30], "energy": 1.2, "scale": 3.2})
    if (105, 46) in floor and (105, 46) not in guard:
        plan.prop("altar", (105, 46), z=1, low=True, note="the court's principal altar, east end")


# ---------------------------------------------------------------------------
# Floor 3 — Hooded Archer Crucible (y 60..88)
# ---------------------------------------------------------------------------
# The last guard hall is a damaged vestibule; the antechamber is a dark, low
# threshold with a single light; the arena is the boss's room and is composed
# around the broken apparatus standing on the level's solid island at x 81..89,
# y 72..79, with the archer to its east and clear firing lanes on every side.
def floor_three(plan: Plan, floor: set, geom: set, faces: list, guard: set) -> None:
    # --- last guard hall --------------------------------------------------
    for x in range(24, 58):
        for y in (75, 76):
            if (x, y) in floor:
                plan.floor_tile((x, y), "floor_aisle_h")
    for cell in ((27, 68), (35, 68), (43, 68), (51, 68)):
        if cell in geom:
            plan.prop("column", cell, z=1, note="guard hall colonnade")
    for cell in ((30, 68), (39, 68), (47, 68)):
        if cell in geom:
            plan.prop("banner", cell, z=1, note="guard hall banner")
    for cell in ((25, 84), (40, 84), (55, 84)):
        if cell in floor and cell not in guard:
            plan.prop("brazier", cell, z=1, low=True, note="guard hall fire bowl",
                      light={"x": cell[0] * T + 8, "y": cell[1] * T + 4,
                             "color": [1.0, 0.60, 0.28], "energy": 1.2, "scale": 3.2})
    plan.prop("rubble_column", (22, 82), z=1, low=True, note="collapse at the guard hall's south west")
    plan.prop("rubble_large", (57, 71), z=1, low=True, note="masonry fall by the antechamber mouth")
    plan.prop("slab", (44, 72), z=1, low=True, note="sacrificial slab in the guard hall")

    # --- antechamber: the dark threshold ---------------------------------
    for cell in ((60, 72), (67, 72)):
        if cell in geom:
            plan.prop("column", cell, z=1, note="antechamber pier")
    plan.hang("emblem", geom, 63, 72, note="sigil over the arena threshold")
    plan.prop("torch", (62, 71), z=1, note="antechamber bracket",
              light={"x": 62 * T + 12, "y": 72 * T, "color": [1.0, 0.66, 0.36],
                     "energy": 1.0, "scale": 2.6})
    for cell in ((61, 80), (68, 80)):
        if cell in floor and cell not in guard:
            plan.prop("skulls", cell, z=1, low=True, note="threshold offering")

    # --- THE ARENA --------------------------------------------------------
    # The broken apparatus on the solid island: it is the room's centrepiece,
    # it is already solid, and the archer's lane around it stays clear.
    plan.prop("apparatus", (88, 75), z=1, low=True, anchor="center",
              note="broken sacrificial apparatus on the arena's own solid island (x84..92, y72..79)",
              light={"x": 88 * T + 8, "y": 76 * T, "color": [1.0, 0.30, 0.18],
                     "energy": 2.0, "scale": 6.4})
    # the arena floor: a raised ritual apron of paving around the apparatus
    for x in range(73, 111):
        for y in range(66, 87):
            if (x, y) not in floor or (x, y) in guard:
                continue
            if 79 <= x <= 91 and 70 <= y <= 81:
                plan.floor_tile((x, y), "floor_aisle_h" if (x + y) % 2 else "floor_aisle_v")
    # an arc of columns down the arena's north wall and its south wall: the
    # arena reads as a hall, not as a box
    for cell in ((76, 65), (82, 65), (94, 65), (100, 65), (106, 65)):
        if cell in geom:
            plan.prop("column", cell, z=1, note="arena colonnade, north wall")
    # the braziers stand at x 78 and 92 just above this line, so the south piers
    # start beyond them rather than growing out of the fire
    for cell in ((81, 86), (88, 86), (100, 86), (106, 86)):
        if cell in geom:
            plan.prop("column", cell, z=1, note="arena colonnade, south wall")
    for cell in ((79, 65), (97, 65)):
        if cell in geom:
            plan.prop("banner", cell, z=1, note="arena banner: torn, at the boss's back")
    for cell in ((74, 65), (109, 65)):
        if cell in geom:
            plan.prop("emblem", cell, z=1, note="crucible sigil at the arena's corners")
    # focused light: two braziers flank the apparatus approach and one lights
    # the archer's ground, so the boss is always readable during the fight.
    for cell in ((78, 82), (92, 82)):
        if cell in floor and cell not in guard:
            plan.prop("brazier", cell, z=1, low=True, note="arena fire, framing the approach",
                      light={"x": cell[0] * T + 8, "y": cell[1] * T + 4,
                             "color": [1.0, 0.62, 0.30], "energy": 1.35, "scale": 3.8})
    plan.prop("brazier_broken", (98, 69), z=1, low=True, note="smashed brazier at the archer's back")
    # chains and gibbets hang over the arena, which makes it feel tall
    plan.hang("chain_long", geom, 86, 66, note="chain over the arena")
    plan.hang("chain_long", geom, 92, 66, note="chain over the arena")
    plan.hang("cage", geom, 90, 66, note="gibbet over the arena")
    # the arena's debris, kept out of the firing lanes
    plan.prop("rubble_large", (108, 84), z=1, low=True, note="arena's south east collapse")
    plan.prop("rubble_column", (75, 68), z=1, low=True, note="fallen pier, arena's north west")
    plan.prop("rubble_small", (104, 80), z=1, low=True, note="debris behind the archer")
    plan.prop("slab", (75, 79), z=1, low=True, note="sacrificial slab at the arena's west side")

    # --- THE ARENA'S MOUTH: a framed approach ----------------------------
    # The player comes out of the dark antechamber into the boss room. Two
    # engaged piers, a torn banner overhead and fire on both sides turn that
    # threshold into a doorway worth walking through, and they are all on cells
    # that are already solid or already open, so the lane stays clear.
    # one engaged pier each side of the mouth. Two adjacent columns read as a
    # single doubled, blurry pillar in the native frame, not as a portal.
    for cell in ((72, 72), (72, 76)):
        if cell in geom:
            plan.prop("column", cell, z=1, note="arena mouth: engaged jamb pier")
    plan.hang("banner", geom, 72, 72, note="arena mouth: banner over the threshold")
    for cell in ((75, 74), (75, 77)):
        if cell in floor and cell not in guard:
            plan.prop("brazier", cell, z=1, low=True, note="arena mouth: fire at the threshold",
                      light={"x": cell[0] * T + 8, "y": cell[1] * T + 4,
                             "color": [1.0, 0.62, 0.30], "energy": 1.25, "scale": 3.2})

    # --- the apparatus's own surroundings --------------------------------
    # It stands on the island; the island's north face carries a low pier rhythm
    # and its shoulders hold the remnants of the rite, so the centrepiece sits in
    # built architecture rather than on a bare rock platform.
    # snapped piers sit on the island's back edge, one row *above* the apparatus's
    # base, so y-sorting draws them behind the centrepiece. On the front edge they
    # were drawn over it and the arena read as clutter.
    for cell in ((85, 73), (91, 73)):
        if cell in geom:
            plan.prop("column_broken", cell, z=1, note="island back edge: snapped pier behind the apparatus")
    for cell in ((84, 82), (92, 82)):
        if cell in floor and cell not in guard:
            plan.prop("skulls", cell, z=1, low=True, note="the offerings around the apparatus")
    if (86, 82) in floor and (86, 82) not in guard:
        plan.prop("altar_dry", (86, 82), z=1, low=True, note="dry altar: the rite ran out of blood")
    if (90, 82) in floor and (90, 82) not in guard:
        plan.prop("stand", (90, 82), z=1, low=True, note="overturned feed stand at the apparatus")

    # --- the arena floor: a duel ground, not a bare plate -----------------
    # The hall is 36 by 20 cells and the earlier pass left most of it untouched,
    # which is exactly the "large empty chamber" failure. The floor now carries the
    # reading: a scorched, broken ring where the apparatus has been burning, a
    # blood trench along the south wall that fed it, and the footings of the ruined
    # gallery on the west side.
    for y in range(69, 86):
        for x in range(76, 108):
            if (x, y) not in floor or (x, y) in guard:
                continue
            dx = abs(x - 88) / 9.0
            dy = abs(y - 78) / 7.0
            ring = max(dx, dy)
            if 0.92 <= ring <= 1.12:
                plan.floor_tile((x, y), "floor_worn" if (x + y) % 3 else "floor_broken")
            elif 1.12 < ring <= 1.35 and (x * 7 + y * 5) % 4 == 0:
                plan.floor_tile((x, y), "stain_c")
    # the avenue: the duelling floor is paved, with a worn border, so the arena
    # reads as a built hall rather than as leftover ground
    for y in range(69, 85):
        for x in range(76, 106):
            if (x, y) not in floor or (x, y) in guard:
                continue
            if 84 <= x <= 92 and 72 <= y <= 79:
                continue
            edge = x in (76, 105) or y in (69, 84)
            if edge:
                plan.floor_tile((x, y), "floor_worn")
            elif (x * 3 + y) % 11 == 0:
                plan.floor_tile((x, y), "floor_grate")
    # the trench: a channel along the arena's south wall, capped at both ends
    for x in range(80, 101):
        if (x, 85) in floor and (x, 85) not in guard:
            plan.floor_tile((x, 85), "floor_channel_h")
    for x in (79, 101):
        if (x, 85) in floor and (x, 85) not in guard:
            plan.floor_tile((x, 85), "floor_channel_end")
    # the ruined gallery's footing on the west side: three piers' bases with the
    # span between them gone. Not a row: two stand, the third has collapsed.
    for cell in ((78, 71), (83, 70)):
        if cell in floor and cell not in guard:
            plan.prop("slab", cell, z=1, low=True, note="footing of the ruined gallery over the arena")
    if (80, 70) in floor and (80, 70) not in guard:
        plan.prop("rubble_large", (80, 70), z=1, low=True,
                  note="the gallery span that came down between the footings")
    for cell in ((79, 69), (84, 69)):
        if cell in floor and cell not in guard:
            plan.prop("skulls", cell, z=1, low=True, note="debris under the gallery footing")

    # --- wall sculpture: torn standards and brackets along the arena ------
    for cell in ((74, 65), (109, 65)):
        if cell in geom:
            plan.prop("torch", cell, z=1, note="arena wall: bracket beside the sigil",
                      light={"x": cell[0] * T + 8, "y": cell[1] * T + 12,
                             "color": [1.0, 0.66, 0.38], "energy": 1.0, "scale": 2.4})
    # Two torn standards, at the two ends of the wall, not a row of six banners at
    # even spacing: the earlier set read as wallpaper.
    for cell in ((81, 65), (101, 65)):
        if cell in geom:
            plan.prop("banner", cell, z=1, note="arena wall: torn standard")
    # gibbets over the flanks, so the west side of the hall is not empty air
    for cell in ((76, 65), (104, 65)):
        if cell in geom:
            plan.hang("cage", geom, cell[0], cell[1], note="gibbet over the arena's west flank")
    for cell in ((83, 84), (95, 85), (106, 74)):
        if cell in floor and cell not in guard:
            plan.prop("skulls", cell, z=1, low=True, note="bone drift across the arena")
    # --- the west flank: a rite that failed before the archer arrived ------
    # A row of dry altars on the arena's west side, its offerings still on the
    # ground, and the collapsed masonry of the gallery that once stood over it.
    # This is authored content with a reading, not another evenly spaced prop.
    for cell in ((78, 80), (79, 83)):
        if cell in floor and cell not in guard:
            plan.prop("altar_dry", cell, z=1, low=True,
                      note="dry altar on the arena's west flank: the rite stopped here")
    for cell in ((77, 81), (80, 81), (80, 84), (77, 84)):
        if cell in floor and cell not in guard:
            plan.prop("skulls", cell, z=1, low=True, note="offerings left where the rite stopped")
    if (77, 78) in floor and (77, 78) not in guard:
        plan.prop("rubble_column", (77, 78), z=1, low=True,
                  note="fallen gallery pier, arena's west flank")
    if (76, 83) in floor and (76, 83) not in guard:
        plan.prop("rubble_large", (76, 83), z=1, low=True,
                  note="collapsed gallery masonry against the west wall")
    if (76, 71) in geom:
        plan.prop("torch", (76, 71), z=1, note="bracket on the west wall, over the fallen gallery",
                  light={"x": 76 * T + 8, "y": 72 * T, "color": [1.0, 0.62, 0.34],
                         "energy": 1.15, "scale": 3.0})
    if (76, 85) in geom:
        plan.prop("torch", (76, 85), z=1, note="bracket at the west wall's foot",
                  light={"x": 76 * T + 8, "y": 86 * T, "color": [1.0, 0.58, 0.32],
                         "energy": 1.0, "scale": 2.6})
    for cell in ((90, 85), (99, 78), (76, 70)):
        if cell in floor and cell not in guard:
            plan.floor_tile(cell, "stain_a" if (cell[0] + cell[1]) % 2 else "stain_b")


# ---------------------------------------------------------------------------
# Build + validate
# ---------------------------------------------------------------------------
def build() -> dict:
    doc = load_level()
    floor = cells(doc, "Backdrop")
    geom = cells(doc, "Geometry")
    guard = protected(doc)
    faces = wall_faces(floor, geom)
    plan = Plan()
    floor_one(plan, floor, geom, faces, guard)
    floor_two(plan, floor, geom, faces, guard)
    floor_three(plan, floor, geom, faces, guard)
    # One global correction to the lights, applied after every floor has placed
    # its own: the first native frames showed the light pool of a single brazier
    # covering the whole screen, because the radius is the light texture (256 px)
    # times texture_scale and 3-8 was read as "a bit bigger than a torch". It is
    # 768-2048 px, i.e. the entire viewport, which is why every room looked
    # evenly lit no matter where the braziers were. A pool wants to be 200-500 px,
    # so the scale is pulled back to that range and the energy lifted slightly to
    # keep the focus bright.
    for light in plan.lights:
        light["scale"] = round(float(light.get("scale", 1.0)) * 0.30, 2)
        light["energy"] = round(float(light.get("energy", 1.0)) * 1.25, 2)
    document = {
        "schema": "chapter1_architecture/1",
        "level": "chapter_1_level_5",
        "tile_size": T,
        "note": (
            "Authored architecture for the Blood Crucible. Derived, additive and "
            "deterministic: it decorates cells the level already defines and never "
            "creates walkable or solid ground of its own. Generated by "
            "tools/level5/architecture.py."
        ),
        "kit": "crucible",
        "ambient": [0.30, 0.32, 0.40],
        "background": [0.035, 0.028, 0.032],
        "layers": {"floor": plan.floor, "wall": plan.wall},
        "props": plan.props,
        "lights": plan.lights,
    }
    document["stats"] = {
        "floor_overrides": len(document["layers"]["floor"]),
        "wall_overrides": len(document["layers"]["wall"]),
        "props": len(document["props"]),
        "lights": len(document["lights"]),
        "floor_claims_resolved": plan.claims,
        "lane_clashes": len(plan.lane_clashes),
    }
    return document


def validate(document: dict) -> list:
    doc = load_level()
    floor = cells(doc, "Backdrop")
    geom = cells(doc, "Geometry")
    guard = protected(doc)
    problems = []
    # One frame per cell: a repeat means two passes claim the same floor and the
    # document is describing a layer it cannot draw. Plan resolves these, so any
    # repeat here is a bug in the resolution, not a stylistic choice.
    claimed: dict = {}
    for entry in document["layers"]["floor"]:
        c = tuple(entry["cell"])
        if c in claimed:
            problems.append("two floor frames claim one cell: %s and %s at %s"
                            % (claimed[c], entry["frame"], c))
        claimed[c] = entry["frame"]
    for entry in document["layers"]["floor"]:
        c = tuple(entry["cell"])
        if c not in floor:
            problems.append("floor decoration outside the floor layer: %s %s" % (entry["frame"], c))
        elif c in geom:
            problems.append("floor decoration under solid geometry: %s %s" % (entry["frame"], c))
    for entry in document["layers"]["wall"]:
        c = tuple(entry["cell"])
        if c not in geom:
            problems.append("wall dressing outside solid geometry: %s %s" % (entry["frame"], c))
    TALL = {"arch_monumental", "arch_wide", "arch_doorway", "column", "column_broken",
            "banner", "torch", "emblem", "cage", "chain_long", "chain_short"}
    for entry in document["props"]:
        c = tuple(entry["cell"])
        frame = entry["frame"]
        if c in guard:
            problems.append("prop on a protected gameplay cell: %s %s" % (frame, c))
        if c not in geom and c not in floor:
            problems.append("prop over void: %s %s" % (frame, c))
            continue
        if frame in TALL:
            # architectural pieces are built onto the wall mass, so they can never
            # imply an obstacle the level does not already have
            if c not in geom:
                problems.append("tall architecture off the wall mass: %s %s" % (frame, c))
        elif not entry.get("low", False) and c not in geom:
            problems.append("furniture on walkable ground must be flagged low: %s %s"
                            % (frame, c))
        if entry.get("span"):
            # a spanning arch is carried by masonry at both ends: check that the
            # extremities of its footprint really are solid
            width = int(entry.get("footprint_w", 200))
            half = int(math.ceil(width / (2 * T)))
            left, right = (c[0] - half, c[1]), (c[0] + half, c[1])
            if left not in geom or right not in geom:
                problems.append("spanning arch is not carried by solid masonry: %s %s %s"
                                % (frame, left, right))
    return problems


def summary(document: dict) -> str:
    by_frame = defaultdict(int)
    for entry in document["props"]:
        by_frame[entry["frame"]] += 1
    stats = document.get("stats", {})
    lines = [
        "components: floor %d, wall %d, props %d, lights %d"
        % (len(document["layers"]["floor"]), len(document["layers"]["wall"]),
           len(document["props"]), len(document["lights"])),
        "floor claims resolved: %d, competing lanes with no crossing frame: %d"
        % (stats.get("floor_claims_resolved", 0), stats.get("lane_clashes", 0)),
    ]
    for frame, count in sorted(by_frame.items(), key=lambda kv: -kv[1]):
        lines.append("  %-18s %d" % (frame, count))
    return "\n".join(lines)


def main() -> None:
    document = build()
    problems = validate(document)
    for problem in problems:
        print("PROBLEM:", problem)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(document, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(summary(document))
    print("ARCHITECTURE: %s" % ("OK" if not problems else "%d problems" % len(problems)))
    raise SystemExit(1 if problems else 0)


if __name__ == "__main__":
    main()
