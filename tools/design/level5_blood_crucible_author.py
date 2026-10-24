#!/usr/bin/env python3
"""Level 5 "Lò Hiến Tế Huyết Cốt" (Blood Crucible) — architectural author.

Deterministic authoring authority for `data/levels/chapter_1_level_5.json`.

Why this file exists
--------------------
Level 5 was emitted by `tools/generators/generate_chapter_1_levels_2_to_5.gd`
through `ChapterOneMapBuilder`: additive rectangles, an 8-tile hash floor, a
9-slice wall ring and three hash-scattered cave decals. That is a *map-shaped
mockup*: every room is the same flat slab, walls are one tile tall, and no part
of the footprint reads as constructed architecture.

This file replaces that path with an ordered, shape-aware masonry compiler —
the same craft the accepted Level 3/4 rebuilds used, with a different spatial
language: a forecourt nave around a sunken offering basin, a ritual court ringed
by piers and blood channels, and a tiered arena whose crucible is the boss floor.

Usage
-----
    python3 tools/design/level5_blood_crucible_author.py --check
    python3 tools/design/level5_blood_crucible_author.py --write
    python3 tools/design/level5_blood_crucible_author.py --validate
    python3 tools/design/level5_blood_crucible_author.py --stats
    python3 tools/design/level5_blood_crucible_author.py --diagram OUTDIR

Only the Python standard library is required. `--diagram` additionally needs
Pillow and is documentation-only: a plan diagram is never gameplay evidence.

Invariants
----------
* 120 x 88, 16 px tiles, three storeys, 83 entities — unchanged from the pin.
* Every entity ID, type, reward payload and interaction contract is preserved.
* 4 reciprocal floor doors, 4 required Sigils, 2 checkpoints, 24 spikes,
  10 Skeletons / 5 Reapers / 1 Vampire / 1 Hooded Archer, 3 combat camps.
* Only entity *cells* move, and every move is listed in `ENTITY_MOVES` so the
  change is auditable against the pinned blob.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data" / "levels" / "chapter_1_level_5.json"
BASELINE = ROOT / "prototypes" / "level5" / "baseline" / "chapter_1_level_5.json"

TILE = 16
WIDTH = 120
HEIGHT = 88

# ---------------------------------------------------------------------------
# Tile vocabulary. Source 0 is `dungeon_tileset_ii.png` (32 x 32 tiles of
# 16 px); source 1 is `atlas_walls_low.png` (12 x 4). Both are declared for the
# visual and the collision TileSet in game/levels/crypt_entrance.tscn, and the
# runtime rebuilds the same grids in DungeonLevel._make_tile_set(), so any cell
# written here is guaranteed loadable. Every entry below was confirmed by
# rendering the atlas through tools/design/render_level_plan.py and comparing
# it with the accepted Level 3/4 native captures.
# ---------------------------------------------------------------------------
S0 = 0
S1 = 1

# --- floor field (8 slabs, ~91 % one slab: no visible tiling period) --------
F_A = (1, 4)
F_A_WORN = (2, 4)
F_A_CRACK = (3, 4)
F_A_ALT = (1, 5)
F_A_ALT_WORN = (2, 5)
F_A_ALT_CRACK = (3, 5)
F_A_STAIN = (1, 6)
F_A_STAIN2 = (2, 6)
# --- processional blood gutter ---------------------------------------------
BLOOD = (1, 13)          # saturated crimson carpet: the ceremonial blood run
BLOOD_EDGE = (2, 12)     # dark tile the carpet is laid against
RUG_BLUE = (3, 13)       # the one cool carpet, reserved for the checkpoint rooms
# --- masonry --------------------------------------------------------------
BRICK_A = (1, 1)
BRICK_B = (2, 1)
BRICK_C = (3, 1)
CAP_A = (1, 0)
CAP_B = (2, 0)
CAP_C = (3, 0)
SCONCE_A = (4, 0)
SCONCE_B = (5, 0)
SCONCE_C = (6, 0)
# --- damaged crucible -----------------------------------------------------
VOID = (6, 8)          # black interior seen through a broken arch
HOLES = (1, 11)        # flagstone broken into service holes
HOLES_B = (2, 11)      # the same, with bone fragments
# --- hangings -------------------------------------------------------------
DRAPE_RED = (1, 2)
DRAPE_BLUE = (2, 2)
DRAPE_GREEN = (1, 3)
DRAPE_ORANGE = (2, 3)
# --- thresholds -----------------------------------------------------------
GATE_L = (2, 9)        # monumental stone doorway, 2 x 2
GATE_R = (3, 9)
GATE_LB = (2, 10)
GATE_RB = (3, 10)
ARCH_TOP_L = (2, 14)   # barred ritual arch, 4 wide x 3 tall
ARCH_TOP_R = (3, 14)
ARCH_JAMB_L = (1, 15)
ARCH_JAMB_R = (4, 15)
ARCH_BAR_L = (2, 15)
ARCH_BAR_R = (3, 15)
ARCH_FOOT_L = (1, 16)
ARCH_FOOT_R = (4, 16)
ARCH_FOOT_BL = (2, 16)
ARCH_FOOT_BR = (3, 16)
STATUE_A = (1, 22)     # plinth statue, a whole 1 x 1 asset
STATUE_B = (3, 22)
STATUE_C = (5, 22)
STAIR_RAIL_L = (0, 9)
STAIR_RAIL_LB = (0, 10)
STAIR_RAIL_R = (1, 9)
STAIR_RAIL_RB = (1, 10)

# --- atlas_walls_low shell (the chapter's shared stone language) -----------
SHELL_W = (1, 1)
SHELL_E = (3, 1)
SHELL_N = (2, 2)
SHELL_S = (2, 0)
SHELL_INNER = (9, 2)
SHELL_ROOF = (10, 0)
SHELL_BRICK_W = (1, 2)
SHELL_BRICK_E = (3, 2)
SHELL_BRICK = (2, 2)
SHELL_NE = (8, 0)
SHELL_NW = (11, 0)
SHELL_BE = (4, 3)
SHELL_BW = (7, 3)


class Plan:
    """Layer accumulator: floor (Backdrop), geometry (collision), decoration."""

    def __init__(self) -> None:
        self.floor: dict[tuple[int, int], tuple[int, int, int]] = {}
        self.geom: dict[tuple[int, int], tuple[int, int, int]] = {}
        self.decor: dict[tuple[int, int], tuple[int, int, int]] = {}

    # -- primitive edits ----------------------------------------------------
    def carve(self, x0: int, y0: int, x1: int, y1: int) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 3 <= x < WIDTH - 3 and 2 <= y < HEIGHT - 2:
                    cell = (x, y)
                    if cell in self.geom:
                        continue
                    self.floor[cell] = (S0, *self._floor_tile(x, y))

    def force_carve(self, x0: int, y0: int, x1: int, y1: int) -> None:
        """Carve floor through anything: used for real doorways only."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 3 <= x < WIDTH - 3 and 2 <= y < HEIGHT - 2:
                    cell = (x, y)
                    self.geom.pop(cell, None)
                    self.floor[cell] = (S0, *self._floor_tile(x, y))

    def uncarve(self, x0: int, y0: int, x1: int, y1: int) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.floor.pop((x, y), None)

    def floor_tile(self, x: int, y: int, tile: tuple[int, int]) -> None:
        if (x, y) in self.floor:
            self.floor[(x, y)] = (S0, *tile)

    def solid(self, x: int, y: int, tile: tuple[int, int], source: int = S0) -> None:
        cell = (x, y)
        self.floor.pop(cell, None)
        self.decor.pop(cell, None)
        self.geom[cell] = (source, *tile)

    def prop(self, x: int, y: int, tile: tuple[int, int], source: int = S0) -> None:
        if (x, y) in self.geom:
            return
        self.decor[(x, y)] = (source, *tile)

    # -- floor texture ------------------------------------------------------
    @staticmethod
    def _floor_tile(x: int, y: int) -> tuple[int, int]:
        """Calm flagstone field: one slab dominates, wear arrives in pairs."""
        h = (x * 41 + y * 17) % 37
        if h == 0:
            return F_A_CRACK
        if h in (5, 6):
            return F_A_WORN
        if h == 11:
            return F_A_ALT
        if h == 19:
            return F_A_ALT_WORN
        if h == 27:
            return F_A_STAIN
        return F_A

    # -- set pieces ---------------------------------------------------------
    def gutter_h(self, x0: int, x1: int, y: int, width: int = 1) -> None:
        for x in range(x0, x1 + 1):
            for dy in range(width):
                self.floor_tile(x, y + dy, BLOOD if dy == 0 else BLOOD_EDGE)

    def gutter_v(self, y0: int, y1: int, x: int, width: int = 1) -> None:
        for y in range(y0, y1 + 1):
            for dx in range(width):
                self.floor_tile(x + dx, y, BLOOD)

    def blood_pool(self, cx: int, cy: int, radius: int) -> None:
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if abs(dx) + abs(dy) <= radius:
                    self.floor_tile(cx + dx, cy + dy, BLOOD)

    def resurface(self, x0: int, y0: int, x1: int, y1: int, kind: str) -> None:
        """Give a room its own flagstone family so rooms never look alike."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if (x, y) not in self.floor:
                    continue
                h = (x * 7 + y * 13) % 11
                if kind == "nave":
                    tile = F_A_ALT if h == 0 else (F_A_WORN if h < 3 else F_A)
                elif kind == "chapel":
                    tile = F_A_STAIN if h < 3 else (F_A_WORN if h == 4 else F_A)
                elif kind == "court":
                    tile = F_A_ALT if h < 3 else (F_A_ALT_WORN if h == 4 else F_A)
                elif kind == "hall":
                    tile = F_A_STAIN2 if h < 2 else (F_A_STAIN if h == 3 else F_A)
                elif kind == "arena":
                    tile = F_A_CRACK if h < 2 else (F_A_ALT_CRACK if h == 3 else F_A)
                elif kind == "landing":
                    tile = F_A_ALT_WORN if h < 3 else F_A
                else:
                    tile = F_A
                self.floor[(x, y)] = (S0, *tile)

    def basin(self, x0: int, y0: int, x1: int, y1: int) -> None:
        """Sunken offering basin: masonry kerb, broken interior, burnt floor rim."""
        for y in range(y0 - 1, y1 + 2):
            for x in range(x0 - 1, x1 + 2):
                if x in (x0 - 1, x1 + 1) or y in (y0 - 1, y1 + 1):
                    self.floor_tile(x, y, F_A_STAIN if (x + y) % 3 else F_A_STAIN2)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if x in (x0, x1) or y in (y0, y1):
                    self.solid(x, y, BRICK_B if (x + y) % 2 else BRICK_A)
                elif x in (x0 + 1, x1 - 1) or y in (y0 + 1, y1 - 1):
                    self.solid(x, y, HOLES if (x * 3 + y) % 4 else HOLES_B)
                else:
                    self.solid(x, y, VOID)
        for cx, cy in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
            self.solid(cx, cy, SHELL_INNER, S1)

    def buttress(self, x: int, y_top: int, height: int = 2) -> None:
        """A masonry buttress standing on the floor, capped by a wall sconce."""
        for step in range(height):
            self.solid(x, y_top + step, BRICK_A if step % 2 == 0 else BRICK_C)
        for step in range(1, 4):
            probe = (x, y_top - step)
            if probe not in self.floor:
                self.prop(x, probe[1], SCONCE_B if height < 3 else SCONCE_A)
                break

    def altar(self, x0: int, y_step: int, width: int, drape: tuple[int, int]) -> None:
        """A one-row sacrificial block against a north wall, hung with a banner."""
        for dx in range(width):
            self.solid(x0 + dx, y_step, BRICK_A if dx % 2 else BRICK_B)
        centre = x0 + width // 2
        if (centre, y_step - 1) not in self.floor:
            self.solid(centre, y_step - 1, drape)
        if (centre, y_step - 2) not in self.floor:
            self.solid(centre, y_step - 2, CAP_B)

    def arch_wall(self, x0: int, y_top: int) -> None:
        """A barred ritual arch (4 x 3) seated in a wall band, never across a path."""
        cells = [
            (x0 + 1, y_top, ARCH_TOP_L), (x0 + 2, y_top, ARCH_TOP_R),
            (x0, y_top + 1, ARCH_JAMB_L), (x0 + 1, y_top + 1, ARCH_BAR_L),
            (x0 + 2, y_top + 1, ARCH_BAR_R), (x0 + 3, y_top + 1, ARCH_JAMB_R),
            (x0, y_top + 2, ARCH_FOOT_L), (x0 + 1, y_top + 2, ARCH_FOOT_BL),
            (x0 + 2, y_top + 2, ARCH_FOOT_BR), (x0 + 3, y_top + 2, ARCH_FOOT_R),
        ]
        for x, y, tile in cells:
            if (x, y) not in self.floor:
                self.solid(x, y, tile)

    def wall_gate(self, x0: int, y_top: int) -> None:
        """The monumental 2 x 2 doorway, set into a wall band as a sealed door."""
        cells = [
            (x0, y_top, GATE_L), (x0 + 1, y_top, GATE_R),
            (x0, y_top + 1, GATE_LB), (x0 + 1, y_top + 1, GATE_RB),
        ]
        for x, y, tile in cells:
            if (x, y) not in self.floor:
                self.solid(x, y, tile)

    def stair_lip(self, x0: int, y: int) -> None:
        """The 2 x 2 stair-rail asset as a descent lip (decoration only)."""
        for dx, dy, tile in (
            (0, 0, STAIR_RAIL_L), (1, 0, STAIR_RAIL_R),
            (0, 1, STAIR_RAIL_LB), (1, 1, STAIR_RAIL_RB),
        ):
            self.prop(x0 + dx, y + dy, tile)

    def band_h(self, x0: int, x1: int, y: int, gaps=(), thickness: int = 2) -> None:
        """A horizontal masonry band with doorways, capped on its north edge."""
        for row in range(thickness):
            for x in range(x0, x1 + 1):
                if any(lo <= x <= hi for lo, hi in gaps):
                    continue
                cell = (x, y + row)
                if cell not in self.floor:
                    continue
                if row == 0:
                    self.solid(x, y, CAP_A if (x * 3 + y) % 3 else CAP_C)
                elif row == thickness - 1:
                    self.solid(x, y + row, BRICK_B if (x + y) % 2 else BRICK_A)
                else:
                    self.solid(x, y + row, BRICK_A if (x * 5 + y) % 3 else BRICK_B)
        # Reveal: the floor inside the doorway is worn, and jambs get a sconce.
        for lo, hi in gaps:
            self.force_carve(lo, y, hi, y + thickness)
            for x in range(lo, hi + 1):
                self.floor_tile(x, y + thickness, F_A_ALT_WORN)
            for x in (lo - 1, hi + 1):
                if (x, y) not in self.floor:
                    self.prop(x, y, SCONCE_B if (x + y) % 2 else SCONCE_A)

    def band_v(self, y0: int, y1: int, x: int, gaps=(), thickness: int = 2) -> None:
        """A vertical masonry band with doorways."""
        for col in range(thickness):
            for y in range(y0, y1 + 1):
                if any(lo <= y <= hi for lo, hi in gaps):
                    continue
                cell = (x + col, y)
                if cell not in self.floor:
                    continue
                if col == 0:
                    self.solid(x, y, BRICK_A if (x + y) % 2 else BRICK_B)
                elif col == thickness - 1:
                    self.solid(x + col, y, BRICK_C if (x * 3 + y) % 3 else BRICK_A)
                else:
                    self.solid(x + col, y, BRICK_B if (x + y) % 3 else BRICK_A)
        for lo, hi in gaps:
            self.force_carve(x, lo, x + thickness, hi)
            for y in range(lo, hi + 1):
                self.floor_tile(x + thickness, y, F_A_ALT_WORN)

    def mass(self, x0: int, y0: int, x1: int, y1: int) -> None:
        """A solid masonry stack: capped on its north edge, shaded on its south.

        These are the load-bearing masses that stop a hall from reading as one
        flat slab; each one touches a wall so it never looks like floating rock.
        """
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if (x, y) not in self.floor:
                    continue
                if y == y0:
                    tile = CAP_A if (x + y) % 3 else CAP_C
                elif y == y1:
                    tile = BRICK_C
                else:
                    tile = BRICK_A if (x * 5 + y) % 3 else BRICK_B
                self.solid(x, y, tile)

    def colonnade(self, x0: int, x1: int, y_top: int, step: int, height: int = 2,
                  width: int = 2) -> None:
        """A run of wall-attached masses with openings between them."""
        x = x0
        while x + width - 1 <= x1:
            self.mass(x, y_top, x + width - 1, y_top + height - 1)
            x += step

    def sconce_wall(self, x: int, y: int, tile: tuple[int, int] = SCONCE_B) -> None:
        if (x, y) not in self.floor:
            self.prop(x, y, tile)

    def coffin(self, x0: int, y0: int) -> None:
        """A 2 x 2 coffin slab: a whole prop, never a chopped composite."""
        for dx, dy, tile in (
            (0, 0, (5, 5)), (1, 0, (6, 5)),
            (0, 1, (5, 6)), (1, 1, (6, 6)),
        ):
            if (x0 + dx, y0 + dy) in self.floor:
                self.solid(x0 + dx, y0 + dy, tile)

    def alcove(self, x: int, y: int, tile: tuple[int, int] = (6, 8)) -> None:
        """A sealed niche cut into a wall band; reads as depth without a passage."""
        if (x, y) not in self.floor:
            self.prop(x, y, tile)

    def pier_teeth(self, xs, y: int) -> None:
        """A row of single-tile buttress teeth along a wall foot."""
        for x in xs:
            self.mass(x, y, x + 1, y + 1)

    def rubble(self, cells) -> None:
        for x, y in cells:
            self.floor_tile(x, y, HOLES if (x + y) % 2 else HOLES_B)

    def breach(self, cells) -> None:
        """Damaged masonry: a wall run broken open, rubble on the floor below."""
        for x, y in cells:
            self.solid(x, y, BRICK_C)
            if (x, y + 1) in self.floor:
                self.floor_tile(x, y + 1, F_A_CRACK)


def compile_masonry(plan: Plan) -> None:
    """Ordered masonry pass, after all carving and interior set pieces.

    Grammar (shared with the accepted Level 3/4 shell so the chapter reads as
    one place): a 9-slice shell of `atlas_walls_low` around every floor edge,
    north faces carried by opaque ashlar courses, and an opaque interior fill so
    the void outside the level never shows through a wall. Cells an earlier pass
    authored (altars, arches, breaches, banners) are never overwritten.
    """
    shell: dict[tuple[int, int], bool] = {}
    for y in range(HEIGHT):
        for x in range(WIDTH):
            if (x, y) in plan.floor:
                continue
            near = any(
                (x + dx, y + dy) in plan.floor
                for dy in (-1, 0, 1)
                for dx in (-1, 0, 1)
            )
            if near or (x, y + 2) in plan.floor:
                shell[(x, y)] = True

    def is_shell(x: int, y: int) -> bool:
        return (x, y) in shell

    for (x, y) in sorted(shell):
        if (x, y) in plan.geom:
            continue
        f_n = (x, y - 1) in plan.floor
        f_s = (x, y + 1) in plan.floor
        f_e = (x + 1, y) in plan.floor
        f_w = (x - 1, y) in plan.floor
        if f_s:
            plan.solid(x, y, BRICK_B if (x * 3 + y * 5) % 3 else BRICK_A)
        elif f_n:
            if is_shell(x, y + 1):
                if f_w and not is_shell(x - 1, y):
                    plan.solid(x, y, SHELL_NE, S1)
                elif f_e and not is_shell(x + 1, y):
                    plan.solid(x, y, SHELL_NW, S1)
                else:
                    plan.solid(x, y, SHELL_ROOF, S1)
            elif f_w and not is_shell(x - 1, y):
                plan.solid(x, y, SHELL_BRICK_W, S1)
            elif f_e and not is_shell(x + 1, y):
                plan.solid(x, y, SHELL_BRICK_E, S1)
            else:
                plan.solid(x, y, SHELL_BRICK, S1)
        elif (x, y + 2) in plan.floor:
            plan.solid(x, y, CAP_C if (x * 3 + y) % 3 == 0 else CAP_A)
        elif f_e and f_w:
            plan.solid(x, y, SHELL_N, S1)
        elif f_e:
            if is_shell(x - 1, y):
                plan.solid(x, y, SHELL_BE, S1)
            elif (x + 1, y + 1) in plan.floor and not is_shell(x, y - 1):
                plan.solid(x, y, SHELL_NW, S1)
            else:
                plan.solid(x, y, SHELL_W, S1)
        elif f_w:
            if is_shell(x + 1, y):
                plan.solid(x, y, SHELL_BW, S1)
            elif (x - 1, y + 1) in plan.floor and not is_shell(x, y - 1):
                plan.solid(x, y, SHELL_NE, S1)
            else:
                plan.solid(x, y, SHELL_E, S1)
        elif (x + 1, y + 1) in plan.floor:
            plan.solid(x, y, SHELL_NW if (is_shell(x - 1, y) or is_shell(x, y - 1)) else SHELL_N, S1)
        elif (x - 1, y + 1) in plan.floor:
            plan.solid(x, y, SHELL_NE if (is_shell(x + 1, y) or is_shell(x, y - 1)) else SHELL_N, S1)
        elif (x + 1, y - 1) in plan.floor:
            plan.solid(x, y, SHELL_BE if (is_shell(x - 1, y) or is_shell(x, y + 1)) else SHELL_E, S1)
        elif (x - 1, y - 1) in plan.floor:
            plan.solid(x, y, SHELL_BW if (is_shell(x + 1, y) or is_shell(x, y + 1)) else SHELL_W, S1)
        else:
            plan.solid(x, y, SHELL_INNER, S1)


# ---------------------------------------------------------------------------
# THE PLAN
# ---------------------------------------------------------------------------
# Storey bands. Each band is one 4-connected floor component; the gaps
# (28..33 and 58..61) are fully solid so `_count_components` sees exactly three.
def build_plan(plan: Plan) -> None:
    _floor_one(plan)
    _floor_two(plan)
    _floor_three(plan)
    compile_masonry(plan)


def _floor_one(p: Plan) -> None:
    """BLOOD FORECOURT — an L of chambers around a solid masonry core.

    The footprint is deliberately not a corridor: a wide vestibule in the
    south-west, the processional nave running east along the north, a reliquary
    chamber cut into the north wall, a chapel hanging south of the vestibule, and
    a solid block of stone between them so the two routes never see each other.
    """
    # ---- footprint ------------------------------------------------------
    # Carve generous slabs first, then cut away everything that is not a room.
    # Every partition band therefore always lands on real floor, which is what
    # keeps the doorways honest.
    p.carve(6, 6, 110, 36)
    p.carve(50, 2, 66, 8)
    p.uncarve(6, 6, 33, 11)          # north-west void above the vestibule
    p.uncarve(6, 26, 33, 36)         # south-west void (chapel carves back in)
    p.carve(8, 26, 30, 34)           # chapel
    p.uncarve(31, 26, 95, 36)        # south void under the nave
    p.uncarve(34, 23, 74, 36)        # south edge of the nave keeps its wall mass
    p.uncarve(109, 6, 110, 36)

    # ---- partitions -----------------------------------------------------
    p.band_h(8, 30, 25, gaps=[(15, 18)], thickness=1)        # vestibule | chapel
    p.band_h(50, 66, 8, gaps=[(56, 59)], thickness=1)        # nave | reliquary
    p.band_v(9, 22, 73, gaps=[(14, 17)], thickness=2)        # nave | guard court
    p.band_h(96, 108, 26, gaps=[(101, 103)], thickness=1)    # court | stair tower

    # ---- the offering apse ---------------------------------------------
    p.basin(44, 11, 52, 18)
    p.gutter_h(35, 43, 14)
    p.gutter_h(53, 66, 14)
    p.gutter_v(19, 22, 48)
    p.blood_pool(37, 20, 2)
    p.blood_pool(60, 20, 1)
    p.rubble([(42, 10), (54, 19), (41, 19), (55, 10)])
    p.arch_wall(58, 3)

    # ---- vestibule ------------------------------------------------------
    p.altar(9, 13, 4, DRAPE_GREEN)
    p.mass(14, 20, 15, 22)
    p.mass(25, 20, 26, 22)
    p.sconce_wall(7, 23)
    p.sconce_wall(13, 12)
    p.coffin(20, 23)
    p.prop(17, 22, (5, 5))

    # ---- nave aisles ----------------------------------------------------
    p.mass(36, 6, 37, 8)             # alternating bays keep the nave rhythmic
    p.mass(66, 6, 67, 8)
    p.mass(70, 19, 72, 21)
    p.prop(40, 9, (1, 22))
    p.prop(64, 9, (3, 22))
    p.prop(38, 18, (5, 5))
    p.prop(68, 12, (6, 5))
    p.sconce_wall(45, 5)
    p.sconce_wall(62, 5)

    # ---- reliquary chamber (breather) -----------------------------------
    p.altar(55, 2, 5, DRAPE_RED)
    p.coffin(51, 4)
    p.coffin(64, 4)
    p.prop(59, 5, (20, 21))
    p.sconce_wall(50, 1)
    p.sconce_wall(65, 1)
    p.blood_pool(58, 6, 1)

    # ---- chapel (breather) ---------------------------------------------
    p.coffin(11, 27)
    p.coffin(26, 27)
    p.altar(18, 32, 3, DRAPE_BLUE)
    p.mass(9, 33, 10, 34)
    p.mass(28, 33, 29, 34)
    p.sconce_wall(17, 26)

    # ---- guard court ----------------------------------------------------
    p.mass(79, 9, 81, 11)
    p.mass(79, 23, 81, 25)
    p.mass(101, 9, 103, 11)
    p.altar(88, 8, 4, DRAPE_ORANGE)
    p.mass(88, 24, 90, 26)
    p.mass(99, 24, 101, 26)
    p.breach([(83, 26), (84, 26)])
    p.sconce_wall(84, 7)
    p.sconce_wall(96, 7)
    p.prop(93, 12, (5, 5))
    p.prop(93, 22, (6, 5))
    p.prop(105, 20, (1, 22))

    # ---- stair tower ----------------------------------------------------
    p.mass(97, 28, 98, 30)
    p.stair_lip(104, 33)
    p.wall_gate(103, 29)
    p.sconce_wall(108, 33)
    p.blood_pool(100, 32, 1)
    p.prop(107, 35, (3, 22))

    # ---- grounds ---------------------------------------------------------
    p.resurface(6, 12, 40, 24, "landing")
    p.resurface(34, 6, 74, 22, "nave")
    p.resurface(50, 2, 66, 8, "chapel")
    p.resurface(8, 26, 30, 34, "chapel")
    p.resurface(76, 8, 108, 26, "court")
    p.resurface(96, 27, 110, 36, "landing")


def _floor_two(p: Plan) -> None:
    """THE BLOOD COURT — a walkable ring around a solid ceremonial island.

    The middle storey is a loop: the landing enters at the west, the corridor
    runs both north and south around a solid island whose north face carries the
    offering basin's apse, and both lanes rejoin at the east breach into the
    Blood Court hall. It cannot be walked as a straight line.
    """
    p.carve(6, 40, 108, 58)
    p.carve(78, 57, 96, 64)
    p.uncarve(6, 40, 19, 42)
    p.uncarve(6, 57, 77, 58)
    p.uncarve(97, 57, 108, 58)
    p.uncarve(78, 65, 96, 65)
    p.uncarve(32, 45, 58, 53)        # the ceremonial island (solid)

    p.band_v(43, 56, 20, gaps=[(47, 50)], thickness=2)       # landing | court
    p.band_v(43, 56, 70, gaps=[(47, 50)], thickness=2)       # court | hall
    p.band_h(78, 96, 57, gaps=[(84, 87)], thickness=1)       # hall | vault

    # ---- landing -------------------------------------------------------
    p.stair_lip(9, 52)
    p.wall_gate(12, 43)
    p.mass(17, 45, 18, 47)
    p.mass(17, 53, 18, 55)
    p.sconce_wall(7, 43)
    p.blood_pool(15, 54, 1)

    # ---- the court ring ------------------------------------------------
    p.basin(41, 47, 49, 51)
    p.gutter_h(34, 40, 52)
    p.gutter_h(50, 57, 52)
    p.gutter_v(53, 55, 38)
    p.gutter_v(53, 55, 60)
    p.mass(34, 46, 35, 47)           # teeth on the island's north face
    p.mass(39, 46, 40, 47)
    p.mass(50, 46, 51, 47)
    p.mass(55, 46, 56, 47)
    p.prop(36, 44, (5, 5))
    p.prop(54, 44, (6, 5))
    p.prop(36, 56, (5, 5))
    p.prop(54, 56, (6, 5))
    p.rubble([(30, 42), (62, 42), (30, 57)])
    p.sconce_wall(45, 43)
    p.sconce_wall(45, 57)
    p.blood_pool(45, 54, 1)

    # ---- Blood Court hall ----------------------------------------------
    p.altar(96, 42, 5, DRAPE_RED)
    p.mass(74, 42, 76, 44)
    p.mass(88, 42, 90, 44)
    p.mass(74, 54, 76, 56)
    p.mass(104, 54, 106, 56)
    p.gutter_h(86, 102, 49)
    p.rubble([(80, 55), (106, 45)])
    p.breach([(77, 43), (78, 43)])
    p.blood_pool(92, 48, 2)
    p.sconce_wall(82, 41)
    p.sconce_wall(102, 41)
    p.prop(93, 44, (1, 22))
    p.prop(99, 53, (5, 5))
    p.prop(108, 50, (3, 22))

    # ---- reliquary vault (breather below the hall) ----------------------
    p.coffin(80, 58)
    p.coffin(93, 58)
    p.coffin(80, 63)
    p.prop(86, 60, (20, 21))
    p.altar(86, 66, 4, DRAPE_BLUE)
    p.sconce_wall(79, 57)
    p.blood_pool(90, 62, 1)

    # ---- grounds --------------------------------------------------------
    p.resurface(6, 44, 20, 56, "landing")
    p.resurface(22, 40, 70, 58, "court")
    p.resurface(71, 42, 108, 56, "hall")
    p.resurface(78, 57, 96, 64, "chapel")


def _floor_three(p: Plan) -> None:
    """ANTECHAMBER AND THE CRUCIBLE ARENA.

    Landing -> last-guard hall -> antechamber (last checkpoint; the arena opens
    to view through its mouth) -> the tiered arena: a sunken crucible under a
    stone canopy, four buttresses, a processional dais east, exit sanctuary.
    """
    p.carve(6, 66, 110, 86)
    p.uncarve(6, 66, 27, 67)
    p.uncarve(6, 83, 27, 86)
    p.uncarve(110, 66, 110, 86)

    p.band_v(66, 82, 27, gaps=[(73, 76)], thickness=1)       # landing | hall
    p.band_v(66, 84, 62, gaps=[(74, 77)], thickness=1)       # hall | antechamber
    p.band_v(66, 86, 74, gaps=[(75, 79)], thickness=1)       # antechamber | arena

    # ---- landing -------------------------------------------------------
    p.stair_lip(9, 80)
    p.wall_gate(11, 66)
    p.sconce_wall(7, 69)
    p.blood_pool(15, 78, 1)
    p.prop(21, 71, (5, 5))

    # ---- last guard hall ----------------------------------------------
    p.altar(42, 66, 5, DRAPE_BLUE)
    p.mass(30, 66, 32, 68)
    p.mass(50, 66, 52, 68)
    p.mass(30, 82, 32, 84)
    p.mass(56, 82, 58, 84)
    p.gutter_h(34, 49, 75)
    p.rubble([(34, 84), (57, 84)])
    p.breach([(60, 69), (61, 69)])
    p.arch_wall(46, 62)
    p.coffin(35, 82)
    p.pier_teeth([36, 40, 44], 81)
    p.sconce_wall(36, 65)
    p.sconce_wall(54, 65)
    p.blood_pool(45, 77, 2)
    p.prop(53, 72, (1, 22))

    # ---- antechamber ---------------------------------------------------
    p.mass(65, 70, 66, 72)
    p.mass(72, 70, 73, 72)
    p.stair_lip(66, 80)
    p.sconce_wall(69, 69)
    p.blood_pool(69, 78, 1)
    p.prop(65, 81, (21, 22))

    # ---- the crucible arena --------------------------------------------
    p.basin(84, 72, 92, 79)
    p.gutter_h(93, 106, 75)
    p.gutter_h(78, 82, 71)
    p.gutter_v(66, 70, 87)
    p.gutter_v(81, 86, 87)
    p.mass(78, 66, 79, 68)
    p.mass(96, 66, 97, 68)
    p.mass(78, 84, 79, 86)
    p.mass(96, 84, 97, 86)
    p.rubble([(82, 66), (83, 66), (100, 86), (105, 86)])
    p.blood_pool(99, 74, 3)
    p.altar(100, 66, 4, DRAPE_RED)
    p.sconce_wall(80, 65)
    p.sconce_wall(94, 65)
    p.sconce_wall(108, 65)
    # Whole-prop dressing inside the bowl; none of it collides or blocks a lane.
    for cell in ((80, 68), (93, 68), (103, 68), (80, 84), (103, 84)):
        p.prop(cell[0], cell[1], (5, 5))
    for cell in ((82, 66), (94, 66), (107, 66)):
        p.prop(cell[0], cell[1], (1, 22))
    for cell in ((81, 77), (107, 79)):
        p.prop(cell[0], cell[1], (3, 22))
    p.prop(93, 84, (20, 21))
    p.prop(99, 84, (21, 22))
    # Tier lines: the bowl steps down toward the crucible.
    for x in range(76, 110):
        if (x, 69) in p.floor:
            p.floor_tile(x, 69, F_A_ALT_WORN)
        if (x, 83) in p.floor:
            p.floor_tile(x, 83, F_A_ALT_WORN)

    # ---- the dais and exit sanctuary -----------------------------------
    p.solid(106, 72, BRICK_A)
    p.solid(107, 72, BRICK_B)
    p.solid(106, 80, BRICK_A)
    p.solid(107, 80, BRICK_B)
    p.sconce_wall(109, 71, SCONCE_B)
    p.sconce_wall(109, 81, SCONCE_A)
    p.breach([(109, 74)])
    p.wall_gate(104, 63)
    p.prop(101, 82, (20, 21))

    # ---- grounds --------------------------------------------------------
    p.resurface(6, 68, 26, 82, "landing")
    p.resurface(28, 66, 62, 84, "chapel")
    p.resurface(64, 70, 74, 82, "hall")
    p.resurface(76, 66, 110, 86, "arena")


# ---------------------------------------------------------------------------
# ENTITIES
# ---------------------------------------------------------------------------
def cell_pos(cx: int, cy: int) -> list:
    return [cx * TILE + 8, cy * TILE + 8]


BOSS_CELL = (95, 74)   # frozen: tests/chapter_1_level_5_archer_visual_capture.gd
EXIT_CELL = (108, 75)

# (id, type, cell, extra) in the pinned baseline's ordering. Types, ids, patrol
# values and reward payloads are unchanged; cells are the redesign.
_ENTITY_TABLE: list[tuple[str, str, tuple[int, int], dict]] = [
    ("player_spawn", "player", (9, 17), {}),

    # Camp 1 — the forecourt guard court (6).
    ("l5_c1_skeleton_01", "skeleton", (69, 15), {"patrol": 34}),
    ("l5_c1_skeleton_02", "skeleton", (74, 19), {"patrol": 34}),
    ("l5_c1_skeleton_03", "skeleton", (84, 14), {"patrol": 34}),
    ("l5_c1_skeleton_04", "skeleton", (70, 22), {"patrol": 34}),
    ("l5_c1_reaper_01", "skeleton_reaper", (81, 17), {"patrol": 28}),
    ("l5_c1_reaper_02", "skeleton_reaper", (87, 21), {"patrol": 28}),

    # Camp 2 — the Blood Court hall (6, including the Vampire).
    ("l5_c2_skeleton_01", "skeleton", (84, 42), {"patrol": 32}),
    ("l5_c2_skeleton_02", "skeleton", (84, 50), {"patrol": 32}),
    ("l5_c2_skeleton_03", "skeleton", (92, 42), {"patrol": 32}),
    ("l5_c2_reaper_01", "skeleton_reaper", (92, 50), {"patrol": 26}),
    ("l5_c2_reaper_02", "skeleton_reaper", (99, 43), {"patrol": 26}),
    ("l5_c2_vampire", "vampire", (99, 50), {"patrol": 24}),

    # Camp 3 — the last guard before the antechamber (4).
    ("l5_c3_skeleton_01", "skeleton", (34, 74), {"patrol": 30}),
    ("l5_c3_skeleton_02", "skeleton", (34, 80), {"patrol": 30}),
    ("l5_c3_skeleton_03", "skeleton", (50, 73), {"patrol": 30}),
    ("l5_c3_reaper_01", "skeleton_reaper", (42, 82), {"patrol": 24}),

    ("l5_hooded_archer_miniboss", "hooded_archer_miniboss", BOSS_CELL, {
        "patrol": 24,
        "guaranteed_loot_profile": "level_5_archer_soul",
    }),

    ("door_l5_f1_f2_down", "floor_door", (104, 17), {
        "target_position": cell_pos(9, 48), "label": "Tầng 2",
        "message": "Nhấn chuột trái để đi tiếp",
    }),
    ("door_l5_f1_f2_up", "floor_door", (9, 48), {
        "target_position": cell_pos(104, 17), "label": "Quay lại",
        "message": "Nhấn chuột trái để quay lại tầng trước",
    }),
    ("door_l5_f2_f3_down", "floor_door", (106, 48), {
        "target_position": cell_pos(9, 76), "label": "Tầng 3",
        "message": "Nhấn chuột trái để đi tiếp",
    }),
    ("door_l5_f2_f3_up", "floor_door", (9, 76), {
        "target_position": cell_pos(106, 48), "label": "Quay lại",
        "message": "Nhấn chuột trái để quay lại tầng trước",
    }),

    ("l5_sigil_camp_1", "sigil", (88, 17), {}),
    ("l5_sigil_blood_ring", "sigil", (36, 48), {}),
    ("l5_sigil_vampire", "sigil", (102, 49), {}),
    ("l5_sigil_last_guard", "sigil", (52, 78), {}),

    ("l5_checkpoint_floor_2", "checkpoint", (10, 49), {}),
    ("l5_checkpoint_before_boss", "checkpoint", (65, 76), {}),
    ("l5_exit", "exit_gate", EXIT_CELL, {}),
    ("l5_chest_blood_ring", "chest", (62, 52), {"score_reward": 520}),
    ("l5_chest_boss_antechamber", "chest", (62, 78), {"score_reward": 600}),
]

# Hazards: readable, never sealing a route, each with >= 2 safe neighbours.
_SPIKES = [
    (34, 12), (44, 21), (56, 21), (66, 17), (79, 12), (91, 23), (30, 20),
    (35, 41), (35, 55), (45, 42), (57, 42), (45, 55), (55, 55), (64, 47),
    (87, 38), (87, 53), (94, 40), (100, 52),
    (28, 79), (35, 68), (46, 78), (52, 68), (47, 83), (97, 78),
]

# Wall-side light sources: whole torch entities sat against authored masonry.
_TORCHES = [
    (6, 16), (19, 19), (34, 12), (42, 20), (66, 13), (81, 24), (106, 20),
    (6, 47), (17, 51), (34, 43), (61, 54), (75, 41),
    (6, 76), (29, 70),
]

# Pickups leading the eye along the intended route.
_COINS = [
    (14, 18), (30, 16), (40, 8), (48, 20), (61, 16), (90, 16),
    (22, 48), (37, 50), (48, 43), (81, 48), (96, 46), (106, 45),
    (29, 76), (56, 82),
]

def build_entities() -> list:
    entities = []
    for entity_id, entity_type, cell, extra in _ENTITY_TABLE:
        entry = {"id": entity_id, "type": entity_type, "position": cell_pos(*cell)}
        entry.update(extra)
        entities.append(entry)
    for index, cell in enumerate(spike_cells, start=1):
        entities.append({"id": "l5_spikes_%02d" % index, "type": "spikes", "position": cell_pos(*cell)})
    used = set(spike_cells) | set(placed.values())
    for prefix, anchors in (("l5_torch", _TORCHES), ("l5_coin", _COINS)):
        for index, anchor in enumerate(anchors, start=1):
            chosen = _snap(
                plan,
                anchor,
                lambda probe, used=used: probe not in used and probe not in spikes,
            )
            used.add(chosen)
            entities.append({"id": "%s_%02d" % (prefix, index), "type": prefix[3:], "position": cell_pos(*chosen)})
    return entities


METADATA = {
    "objective": (
        "Băng qua tiền sảnh hiến tế, phá vòng phòng thủ quanh ba lò, hạ Tử Thần Chúa "
        "và Hooded Archer, rồi tự tay nhặt Archer Hero Soul rơi ra."
    ),
    "difficulty_tier": 5,
    "pacing": "six_guard_forecourt_then_ringed_blood_court_then_four_guard_before_the_crucible_arena",
    "roster_id": "chapter_1_level_5_roster",
    "required_miniboss_id": "hooded_archer_miniboss",
    "encounter_pack_model": {
        "enabled": True,
        "profile_stage": 5,
        "floor_count": 3,
        "placement": "authored_camp_anchors",
        "authored_counts_are_anchors": True,
    },
    "required_sigils": 4,
    "camera_bounds": [0, 0, WIDTH * TILE, HEIGHT * TILE],
    "layout_profile": "three_floor_blood_crucible_forecourt_ring_and_tiered_arena",
    "tileset": "0x72 DungeonTileset II v1.7 (CC0)",
    "rooms": [
        {"id": "l5_f1_entry", "floor": 1, "role": "safe_entry", "rect": [5, 11, 16, 12]},
        {"id": "l5_f1_nave", "floor": 1, "role": "processional_nave", "rect": [26, 8, 37, 19]},
        {"id": "l5_f1_reliquary", "floor": 1, "role": "breather", "rect": [26, 4, 21, 5]},
        {"id": "l5_f1_camp", "floor": 1, "role": "combat_camp", "rect": [62, 10, 31, 16]},
        {"id": "l5_f2_landing", "floor": 2, "role": "safe_landing", "rect": [5, 44, 14, 11]},
        {"id": "l5_f2_blood_ring", "floor": 2, "role": "route_choice", "rect": [32, 40, 20, 6]},
        {"id": "l5_f2_blood_court", "floor": 2, "role": "combat_camp", "rect": [74, 36, 35, 20]},
        {"id": "l5_f3_landing", "floor": 3, "role": "safe_landing", "rect": [5, 73, 13, 10]},
        {"id": "l5_f3_last_guard", "floor": 3, "role": "combat_camp", "rect": [24, 68, 35, 17]},
        {"id": "l5_f3_antechamber", "floor": 3, "role": "boss_antechamber", "rect": [58, 72, 11, 9]},
        {"id": "l5_f3_boss_crucible", "floor": 3, "role": "boss_arena", "rect": [72, 66, 39, 20]},
    ],
    "combat_camps": [
        {
            "id": "l5_camp_1_double_anchor",
            "floor": 1,
            "rect": [62, 10, 31, 16],
            "entry_cell": [64, 15],
            "enemy_ids": [
                "l5_c1_skeleton_01", "l5_c1_skeleton_02", "l5_c1_skeleton_03",
                "l5_c1_skeleton_04", "l5_c1_reaper_01", "l5_c1_reaper_02",
            ],
            "formation": "four_swordsmen_between_two_reaper_anchors",
            "breather_after": True,
        },
        {
            "id": "l5_camp_2_blood_court",
            "floor": 2,
            "rect": [76, 38, 30, 16],
            "entry_cell": [76, 46],
            "enemy_ids": [
                "l5_c2_skeleton_01", "l5_c2_skeleton_02", "l5_c2_skeleton_03",
                "l5_c2_reaper_01", "l5_c2_reaper_02", "l5_c2_vampire",
            ],
            "formation": "three_swordsmen_two_reapers_and_the_unique_vampire",
            "breather_after": True,
        },
        {
            "id": "l5_camp_3_last_guard",
            "floor": 3,
            "rect": [26, 70, 30, 16],
            "entry_cell": [26, 77],
            "enemy_ids": [
                "l5_c3_skeleton_01", "l5_c3_skeleton_02", "l5_c3_skeleton_03",
                "l5_c3_reaper_01",
            ],
            "formation": "four_unit_guard_immediately_before_the_boss_breather",
            "breather_after": True,
        },
    ],
    "safe_zones": [
        {"id": "l5_spawn_sanctuary", "rect": [5, 11, 16, 12],
         "purpose": "spawn_before_first_six_unit_camp"},
        {"id": "l5_floor_2_breather", "rect": [5, 44, 14, 11],
         "purpose": "checkpoint_after_first_camp"},
        {"id": "l5_boss_antechamber", "rect": [58, 72, 11, 9],
         "purpose": "checkpoint_and_full_camera_read_before_boss"},
    ],
    "special_zones": [
        {
            "id": "l5_hooded_archer_arena",
            "rect": [88, 66, 23, 20],
            "purpose": "hooded_archer_drops_base_archer_hero_soul_for_physical_pickup",
            "spawn_anchor_cell": [BOSS_CELL[0], BOSS_CELL[1]],
            "spawn_entity_id": "l5_hooded_archer_miniboss",
            "status": "playable_required_miniboss",
        },
    ],
}


def _snap(
    plan: Plan,
    anchor: tuple[int, int],
    predicate,
) -> tuple[int, int]:
    """Nearest cell to a design anchor that satisfies the placement predicate.

    Positions in `_ENTITY_TABLE` are *design anchors* — where the designer wants
    the thing — not final coordinates. The snap keeps intent while guaranteeing
    that the authored cell is walkable, Knight-clear, off every hazard, and
    inside the encounter's own room. Ties break on (y, x) so the result is
    deterministic and the JSON stays byte-reproducible.
    """
    floor = plan.floor
    geom = plan.geom
    best: tuple[int, int] | None = None
    best_key = None
    for (x, y) in floor:
        if (x, y) in geom or (x, y - 1) in geom:
            continue
        if not predicate((x, y)):
            continue
        key = (
            (x - anchor[0]) ** 2 + (y - anchor[1]) ** 2,
            y,
            x,
        )
        if best_key is None or key < best_key:
            best_key = key
            best = (x, y)
    if best is None:
        raise SystemExit(
            "no placement satisfies the contract near anchor %s" % (anchor,)
        )
    return best


def _patrol_ok(plan: Plan, cell: tuple[int, int], patrol: int) -> bool:
    """Cardinal clearance, exactly as tests/chapter_1_map_design_test.gd reads it."""
    radius = max(1, patrol // TILE)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        for step in range(1, radius + 1):
            if (cell[0] + dx * step, cell[1] + dy * step) not in plan.floor:
                return False
    return True


def place_entities(plan: Plan) -> list:
    """Resolve every authored anchor into a contract-satisfying cell."""
    plan_doc = _ENTITY_TABLE
    camps = {camp["id"]: camp for camp in METADATA["combat_camps"]}
    camp_of = {}
    for camp in METADATA["combat_camps"]:
        for enemy_id in camp["enemy_ids"]:
            camp_of[enemy_id] = camp

    # 0. Hazards first: they are the frame every other placement avoids.
    spikes: dict[tuple[int, int], bool] = {}
    spike_cells: list[tuple[int, int]] = []
    for anchor in _SPIKES:
        chosen = _snap(
            plan,
            anchor,
            lambda probe: (
                probe not in spikes
                and all(
                    abs(probe[0] - other[0]) + abs(probe[1] - other[1]) > 1
                    for other in spikes
                )
                and sum(
                    1
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                    if (probe[0] + dx, probe[1] + dy) in plan.floor
                    and (probe[0] + dx, probe[1] + dy) not in spikes
                )
                >= 2
            ),
        )
        spikes[chosen] = True
        spike_cells.append(chosen)

    placed: dict[str, tuple[int, int]] = {}
    positions: list[tuple[float, float]] = []

    def rect_has(cell, rect):
        return (
            rect[0] <= cell[0] < rect[0] + rect[2]
            and rect[1] <= cell[1] < rect[1] + rect[3]
        )

    def far_from_spikes(cell, minimum_cells):
        return all(
            max(abs(cell[0] - s[0]), abs(cell[1] - s[1])) >= minimum_cells
            for s in spikes
        )

    # 1. Enemies: inside their camp rect, patrol-clear, readable spacing.
    for entity_id, entity_type, cell, extra in plan_doc:
        if entity_type not in ENEMY_TYPES and entity_type != "vampire":
            continue
        if entity_type == "hooded_archer_miniboss":
            continue
        camp = camp_of.get(entity_id)
        if camp is None:
            continue
        patrol = int(extra.get("patrol", 32))
        chosen = _snap(
            plan,
            cell,
            lambda probe, camp=camp, patrol=patrol: (
                rect_has(probe, camp["rect"])
                and probe not in spikes
                and _patrol_ok(plan, probe, patrol)
                and all(
                    abs(probe[0] - other[0]) * 16 + 0 >= 55
                    or abs(probe[1] - other[1]) * 16 >= 55
                    or (abs(probe[0] - other[0]) ** 2 + abs(probe[1] - other[1]) ** 2) ** 0.5 * 16 >= 55
                    for other in placed.values()
                )
            ),
        )
        placed[entity_id] = chosen

    # 2. The Archer keeps its frozen anchor (frozen tests hard-code the cell).
    placed["l5_hooded_archer_miniboss"] = BOSS_CELL

    # 3. Objectives, doors and props: walkable, clear, off hazards.
    for entity_id, entity_type, cell, extra in plan_doc:
        if entity_id in placed:
            continue
        if entity_type in ("sigil", "chest", "exit_gate", "checkpoint", "player"):
            guard = 3 if entity_type in ("sigil", "chest", "exit_gate", "checkpoint") else 0
            placed[entity_id] = _snap(
                plan,
                cell,
                lambda probe, guard=guard: (
                    probe not in spikes
                    and far_from_spikes(probe, guard)
                    and (entity_type != "exit_gate" or probe[0] > WIDTH - 20)
                ),
            )
        elif entity_type == "floor_door":
            placed[entity_id] = _snap(
                plan, cell, lambda probe: probe not in spikes and far_from_spikes(probe, 4)
            )
        else:
            placed[entity_id] = _snap(plan, cell, lambda probe: probe not in spikes)

    # 4. Emit in the pinned order, rewriting door partners so reciprocity holds.
    entities = []
    for entity_id, entity_type, _cell, extra in plan_doc:
        if entity_id not in placed:
            raise SystemExit("unplaced entity %s" % entity_id)
        entry = {"id": entity_id, "type": entity_type, "position": cell_pos(*placed[entity_id])}
        entry.update(extra)
        entities.append(entry)
    by_id = {e["id"]: e for e in entities}
    for entity in entities:
        if entity["type"] != "floor_door":
            continue
        base = entity["id"][: -len("_down")] if entity["id"].endswith("_down") else entity["id"][: -len("_up")]
        partner_id = base + ("_up" if entity["id"].endswith("_down") else "_down")
        partner = by_id[partner_id]
        target_cell = (
            partner["position"][0] // TILE,
            partner["position"][1] // TILE,
        )
        entity["target_position"] = cell_pos(*target_cell)
    for index, (entity_id, entity_type, _cell, _extra) in enumerate(plan_doc):
        if entity_type == "floor_door":
            continue
    for index, cell in enumerate(spike_cells, start=1):
        entities.append({"id": "l5_spikes_%02d" % index, "type": "spikes", "position": cell_pos(*cell)})
    used = set(spike_cells) | set(placed.values())
    for prefix, anchors in (("l5_torch", _TORCHES), ("l5_coin", _COINS)):
        for index, anchor in enumerate(anchors, start=1):
            chosen = _snap(
                plan,
                anchor,
                lambda probe, used=used: probe not in used and probe not in spikes,
            )
            used.add(chosen)
            entities.append({"id": "%s_%02d" % (prefix, index), "type": prefix[3:], "position": cell_pos(*chosen)})
    return entities


def build_level() -> dict:
    plan = Plan()
    build_plan(plan)
    entities = place_entities(plan)
    return {
        "version": 2,
        "name": "Lò Hiến Tế Huyết Cốt",
        "movement_mode": "top_down",
        "tile_size": TILE,
        "width": WIDTH,
        "height": HEIGHT,
        "layers": {
            "Backdrop": serialize_layer(plan.floor),
            "Geometry": serialize_layer(plan.geom),
            "Decor": serialize_layer(plan.decor),
        },
        "entities": entities,
        "metadata": METADATA,
    }


def serialize_layer(cells: dict) -> list:
    out = []
    for y in range(HEIGHT):
        for x in range(WIDTH):
            entry = cells.get((x, y))
            if entry is None:
                continue
            out.append({
                "x": x,
                "y": y,
                "source": int(entry[0]),
                "atlas": [int(entry[1]), int(entry[2])],
                "alternative": 0,
            })
    return out


def serialize_level(document: dict) -> str:
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"


# ---------------------------------------------------------------------------
# CONTRACT VALIDATION
# The frozen Godot suites are the authority; this module replays their rules so
# the author can be iterated offline. It is a convenience, never a substitute:
# CI still runs tests/chapter_1_map_design_test.gd, chapter_1_collision_route_test.gd
# and the Level 5 boss/pickup suites against the committed JSON.
# ---------------------------------------------------------------------------
ENEMY_TYPES = {
    "skeleton", "skeleton_reaper", "hooded_archer_miniboss", "vampire",
}
MINIBOSS_TYPES = {"hooded_archer_miniboss"}
DOOR_TRANSITIONS = True


def _cells(layer: list) -> dict:
    return {(int(c["x"]), int(c["y"])): c for c in layer}


def _cell(entity: dict) -> tuple[int, int]:
    x, y = entity["position"]
    return (int(x) // TILE, int(y) // TILE)


def _pos(entity: dict) -> tuple[float, float]:
    return (float(entity["position"][0]), float(entity["position"][1]))


def _dist(a, b) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def _components(floor: dict) -> int:
    unseen = set(floor)
    count = 0
    while unseen:
        count += 1
        stack = [unseen.pop()]
        while stack:
            x, y = stack.pop()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nxt = (x + dx, y + dy)
                if nxt in unseen:
                    unseen.discard(nxt)
                    stack.append(nxt)
    return count


def _knight_clear(floor: dict, geom: dict) -> dict:
    """Replay DungeonLevel collision for a 12 x 16 Knight body at cell centre.

    The body sits with its feet on the cell centre, so it covers the lower half
    of the cell above; a cell therefore needs its own column and the one above
    to be free of Geometry. Geometry tiles are full 16 px solids.
    """
    clear = {}
    for (x, y) in floor:
        if (x, y) in geom or (x, y - 1) in geom:
            continue
        clear[(x, y)] = True
    return clear


def _route(clear: dict, start: tuple[int, int], blocked: dict, doors: dict) -> dict:
    if start not in clear or start in blocked:
        return {}
    seen = {start: True}
    queue = [start]
    cursor = 0
    while cursor < len(queue):
        cur = queue[cursor]
        cursor += 1
        x, y = cur
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nxt = (x + dx, y + dy)
            if nxt in clear and nxt not in blocked and nxt not in seen:
                seen[nxt] = True
                queue.append(nxt)
        for nxt in doors.get(cur, []):
            if nxt in clear and nxt not in blocked and nxt not in seen:
                seen[nxt] = True
                queue.append(nxt)
    return seen


def validate(document: dict) -> list[str]:
    errors: list[str] = []
    floor = _cells(document["layers"]["Backdrop"])
    geom = _cells(document["layers"]["Geometry"])
    decor = _cells(document["layers"]["Decor"])
    entities = document["entities"]
    metadata = document["metadata"]
    by_id = {e["id"]: e for e in entities}
    by_type: dict[str, list] = {}
    for e in entities:
        by_type.setdefault(e["type"], []).append(e)

    def fail(message: str) -> None:
        errors.append(message)

    # -- structural ------------------------------------------------------
    for cell in floor:
        if cell in geom:
            fail("Geometry overwrites walkable floor at %s" % (cell,))
        if not (3 <= cell[0] < WIDTH - 3 and 2 <= cell[1] < HEIGHT - 2):
            fail("floor cell outside the authored margin: %s" % (cell,))
    for cell, entry in geom.items():
        source = int(entry["source"])
        ax, ay = entry["atlas"]
        if source == 0 and not (0 <= ax < 32 and 0 <= ay < 32):
            fail("Geometry atlas out of range at %s: %s" % (cell, (ax, ay)))
        if source == 1 and not (0 <= ax < 12 and 0 <= ay < 4):
            fail("Geometry walls_low atlas out of range at %s: %s" % (cell, (ax, ay)))
    for cell, entry in decor.items():
        if cell in geom:
            fail("Decor and Geometry share cell %s" % (cell,))

    components = _components(floor)
    if components != 3:
        fail("expected exactly three door-linked footprints, found %d" % components)

    # -- entities on floor ----------------------------------------------
    for e in entities:
        if _cell(e) not in floor:
            fail("entity %s is not on walkable floor at %s" % (e["id"], _cell(e)))

    # -- doors -----------------------------------------------------------
    doors = [e for e in entities if e["type"] == "floor_door"]
    door_edges: dict[tuple[int, int], list] = {}
    door_targets = set()
    for door in doors:
        target = door["target_position"]
        target_cell = (int(target[0]) // TILE, int(target[1]) // TILE)
        door_targets.add(target_cell)
        if target_cell not in floor:
            fail("door %s arrives off-floor at %s" % (door["id"], target_cell))
        door_edges.setdefault(_cell(door), []).append(target_cell)
    for door in doors:
        src = _cell(door)
        target = door["target_position"]
        target_cell = (int(target[0]) // TILE, int(target[1]) // TILE)
        partner_id = door["id"][:-5] + ("_up" if door["id"].endswith("_down") else "_down")
        back = by_id.get(partner_id)
        if back is None:
            continue
        if _cell(back) != target_cell:
            fail("door %s target %s does not match its partner cell %s" % (door["id"], target_cell, _cell(back)))
        if tuple(int(v) for v in back["target_position"]) != (src[0] * TILE + 8, src[1] * TILE + 8):
            fail("door %s is not reciprocal with %s" % (door["id"], back["id"]))

    player = by_type["player"][0]
    start = _cell(player)
    if start not in floor:
        fail("player spawn is not on floor")
    reachable = _route({c: True for c in floor}, start, {}, door_edges)
    if len(reachable) != len(floor):
        missing = sorted(set(floor) - set(reachable))[:8]
        fail("player cannot reach %d floor cells (e.g. %s)" % (len(floor) - len(reachable), missing))

    # -- spawn / checkpoint / door safety ---------------------------------
    enemies = [e for t in ENEMY_TYPES for e in by_type.get(t, [])]
    spikes = by_type.get("spikes", [])
    enemy_positions = [_pos(e) for e in enemies]
    spike_positions = [_pos(e) for e in spikes]
    nearest_enemy = min(_dist(_pos(player), p) for p in enemy_positions)
    if nearest_enemy < 240.0:
        fail("player spawn is %.1f px from an enemy (needs 240)" % nearest_enemy)
    nearest_spike = min(_dist(_pos(player), p) for p in spike_positions)
    if nearest_spike < 160.0:
        fail("player spawn is %.1f px from a spike (needs 160)" % nearest_spike)
    for checkpoint in by_type.get("checkpoint", []):
        if min(_dist(_pos(checkpoint), p) for p in enemy_positions) < 150.0:
            fail("%s is inside a sleeping camp" % checkpoint["id"])
        if min(_dist(_pos(checkpoint), p) for p in spike_positions) < 64.0:
            fail("%s is a trap spawn" % checkpoint["id"])
    for door in doors:
        if min(_dist(_pos(door), p) for p in spike_positions) < 64.0:
            fail("%s has spikes on its interaction pad" % door["id"])

    # -- patrol cardinal clearance ---------------------------------------
    for enemy in enemies:
        radius = max(1, int(float(enemy.get("patrol", 32.0)) // TILE))
        cell = _cell(enemy)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            for step in range(1, radius + 1):
                probe = (cell[0] + dx * step, cell[1] + dy * step)
                if probe not in floor:
                    fail("%s loses %dx patrol clearance at %s" % (enemy["id"], radius, probe))
                    break

    # -- traps ------------------------------------------------------------
    blocked_spikes = {}
    for spike in spikes:
        cell = _cell(spike)
        blocked_spikes[cell] = True
        safe = 0
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            probe = (cell[0] + dx, cell[1] + dy)
            if probe in floor and probe not in blocked_spikes:
                safe += 1
        if safe < 2:
            fail("%s leaves no local dodge space" % spike["id"])
    safe_route = _route({c: True for c in floor}, start, blocked_spikes, door_edges)
    for objective in by_type.get("sigil", []) + by_type.get("exit_gate", []):
        if _cell(objective) not in safe_route:
            fail("%s is unreachable without stepping on spikes" % objective["id"])

    # -- camps ------------------------------------------------------------
    camps = metadata.get("combat_camps", [])
    if len(camps) != 3:
        fail("expected three combat camps, found %d" % len(camps))
    assigned = {}
    for camp in camps:
        ids = camp.get("enemy_ids", [])
        if len(ids) < 4:
            fail("%s has fewer than four enemies" % camp.get("id"))
        x, y, w, h = camp["rect"]
        positions = []
        for enemy_id in ids:
            entity = by_id.get(enemy_id)
            if entity is None:
                fail("%s names a missing enemy %s" % (camp.get("id"), enemy_id))
                continue
            if enemy_id in assigned:
                fail("%s is assigned twice" % enemy_id)
            assigned[enemy_id] = True
            cell = _cell(entity)
            if not (x <= cell[0] < x + w and y <= cell[1] < y + h):
                fail("%s sits outside %s rect %s" % (enemy_id, camp.get("id"), camp["rect"]))
            positions.append(_pos(entity))
        for i in range(len(positions)):
            for j in range(i + 1, len(positions)):
                gap = _dist(positions[i], positions[j])
                if gap < 55.0:
                    fail("%s packs two members %.1f px apart (needs 55)" % (camp.get("id"), gap))
        if positions and max(
            _dist(positions[i], positions[j])
            for i in range(len(positions))
            for j in range(i + 1, len(positions))
        ) > 560.0:
            fail("%s spreads beyond one encounter (560 px)" % camp.get("id"))
    for enemy in enemies:
        if enemy["type"] in MINIBOSS_TYPES:
            continue
        if enemy["id"] not in assigned:
            fail("%s belongs to no authored camp" % enemy["id"])

    # -- counts -----------------------------------------------------------
    expected = {
        "skeleton": 10, "skeleton_reaper": 5, "vampire": 1,
        "hooded_archer_miniboss": 1, "spikes": 24, "sigil": 4,
        "checkpoint": 2, "floor_door": 4, "exit_gate": 1, "chest": 2,
        "torch": 14, "coin": 14, "player": 1,
    }
    for entity_type, count in expected.items():
        actual = len(by_type.get(entity_type, []))
        if actual != count:
            fail("expected %d %s, found %d" % (count, entity_type, actual))
    if len(entities) != 83:
        fail("expected 83 entities, found %d" % len(entities))
    if int(metadata.get("required_sigils", 0)) != 4:
        fail("required_sigils must stay 4")

    # -- special zone -----------------------------------------------------
    zones = [z for z in metadata.get("special_zones", []) if z.get("id") == "l5_hooded_archer_arena"]
    if not zones:
        fail("l5_hooded_archer_arena is missing")
    else:
        anchor = zones[0].get("spawn_anchor_cell", [])
        if len(anchor) != 2 or (int(anchor[0]), int(anchor[1])) not in floor:
            fail("Archer spawn anchor is not walkable")
        if zones[0].get("spawn_entity_id") != "l5_hooded_archer_miniboss":
            fail("boss zone does not point at the Archer entity")
        if zones[0].get("status") != "playable_required_miniboss":
            fail("boss zone is not marked runtime-required")

    # -- Knight-sized route clearance -------------------------------------
    clear = _knight_clear(floor, geom)
    if start not in clear:
        fail("player spawn fails the live Knight collision footprint")
    for door in doors:
        if _cell(door) not in clear:
            fail("%s source cell fails Knight clearance" % door["id"])
        target = door["target_position"]
        target_cell = (int(target[0]) // TILE, int(target[1]) // TILE)
        if target_cell not in clear:
            fail("%s arrival cell %s fails Knight clearance" % (door["id"], target_cell))
    knight_route = _route(clear, start, blocked_spikes, door_edges)
    safe_clear = {c for c in clear if c not in blocked_spikes}
    if len(knight_route) != len(safe_clear):
        missing = sorted(safe_clear - set(knight_route))[:8]
        fail(
            "Knight-clear route covers %d/%d cells (unreached e.g. %s)"
            % (len(knight_route), len(safe_clear), missing)
        )

    def reachable_near(cell: tuple[int, int]) -> bool:
        for radius in range(0, 4):
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    if max(abs(dx), abs(dy)) != radius:
                        continue
                    probe = (cell[0] + dx, cell[1] + dy)
                    if probe in knight_route and probe in clear:
                        return True
        return False

    target_types = [
        "sigil", "exit_gate", "checkpoint", "chest", "floor_door",
        "skeleton", "skeleton_reaper", "hooded_archer_miniboss", "vampire",
    ]
    for entity_type in target_types:
        for entity in by_type.get(entity_type, []):
            if not reachable_near(_cell(entity)):
                fail("%s is unreachable with Knight clearance" % entity["id"])
    for entity in entities:
        if "target_position" in entity:
            target = entity["target_position"]
            target_cell = (int(target[0]) // TILE, int(target[1]) // TILE)
            if not reachable_near(target_cell):
                fail("%s patrol target is unreachable" % entity["id"])

    # -- campaign capture anchors ----------------------------------------
    for room_id, in (("l5_f2_blood_ring",), ("l5_f3_boss_crucible",)):
        room = next((r for r in metadata.get("rooms", []) if r.get("id") == room_id), None)
        if room is None:
            fail("campaign capture room %s is missing" % room_id)
            continue
        x, y, w, h = room["rect"]
        centre = (x + w / 2.0, y + h / 2.0)
        inside = [c for c in floor if x <= c[0] < x + w and y <= c[1] < y + h]
        if not inside:
            fail("%s rect contains no walkable floor" % room_id)
            continue
        nearest = min(inside, key=lambda c: (c[0] + 0.5 - centre[0]) ** 2 + (c[1] + 0.5 - centre[1]) ** 2)
        if nearest not in clear:
            fail("%s capture anchor %s fails Knight clearance" % (room_id, nearest))

    # -- Archer sightline for the staged visual capture -------------------
    boss = by_id["l5_hooded_archer_miniboss"]
    bx, by = boss["position"]
    sight = (int((bx + 165) // TILE), int(by // TILE))
    if sight not in clear:
        fail("the Archer's 165 px east capture stance %s is not walkable" % (sight,))

    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="rewrite the level JSON")
    parser.add_argument("--check", action="store_true", help="fail if the JSON has drifted")
    parser.add_argument("--validate", action="store_true", help="run the contract validator")
    parser.add_argument("--stats", action="store_true", help="print layer/entity statistics")
    parser.add_argument("--diagram", default="", help="write a plan diagram to this directory")
    args = parser.parse_args(argv)

    document = build_level()
    rendered = serialize_level(document)
    problems = validate(document)

    status = 0
    if args.validate or args.check or not (args.write or args.stats or args.diagram):
        if problems:
            status = 1
            for problem in problems:
                print("CONTRACT: " + problem, file=sys.stderr)
        else:
            print("CONTRACT: OK — %d floor / %d geometry / %d decor cells, %d entities"
                  % (len(document["layers"]["Backdrop"]),
                     len(document["layers"]["Geometry"]),
                     len(document["layers"]["Decor"]),
                     len(document["entities"])))

    if args.write:
        OUTPUT.write_text(rendered, encoding="utf-8")
        print("WROTE %s (%d bytes, sha256 %s)"
              % (OUTPUT.relative_to(ROOT), len(rendered.encode("utf-8")), _sha256(rendered)))
    if args.check:
        current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
        if current != rendered:
            print("DRIFT: %s is not the output of this author" % OUTPUT.relative_to(ROOT), file=sys.stderr)
            status = 1
        else:
            print("CHECK: %s is byte-identical to the author output" % OUTPUT.relative_to(ROOT))
    if args.stats:
        print_stats(document)
    if args.diagram:
        write_diagram(document, Path(args.diagram))
    return status


def _sha256(text: str) -> str:
    import hashlib
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def print_stats(document: dict) -> None:
    import collections
    for name, layer in document["layers"].items():
        tiles = collections.Counter((c["source"], tuple(c["atlas"])) for c in layer)
        print("%-9s %5d cells, %2d tiles, dominant %.0f%%"
              % (name, len(layer), len(tiles), 100.0 * tiles.most_common(1)[0][1] / max(1, len(layer))))
    types = collections.Counter(e["type"] for e in document["entities"])
    print("entities  %d  %s" % (len(document["entities"]), dict(sorted(types.items()))))


def write_diagram(document: dict, out_dir: Path) -> None:
    """Documentation-only plan render. Never gameplay evidence."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import render_level_plan  # noqa: WPS433 (local tool import)

    out_dir.mkdir(parents=True, exist_ok=True)
    image = render_level_plan.render(document)
    image.convert("RGB").save(out_dir / "level5_plan.png")
    for index, (top, bottom) in enumerate(((3, 27), (34, 57), (62, 86)), start=1):
        crop = image.crop((0, top * TILE, WIDTH * TILE, (bottom + 1) * TILE))
        crop.convert("RGB").save(out_dir / ("level5_floor%d_plan.png" % index))
    print("DIAGRAM: wrote plan renders to %s (PIL, not native)" % out_dir)


if __name__ == "__main__":
    raise SystemExit(main())
