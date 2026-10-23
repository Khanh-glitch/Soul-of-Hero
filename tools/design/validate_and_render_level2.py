#!/usr/bin/env python3
"""Deterministic builder, contract verifier, footprint diagrammer, and 1:1 preview
renderer for Soul of Hero Level 2 Design Audition (data/levels/chapter_1_level_2.json).
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
LEVEL_PATH = ROOT / "data/levels/chapter_1_level_2.json"
BASELINE_SHA = "1c21a49c2eb3775c4b421dab86d057c7256f5964"
TILE = 16
WIDTH = 120
HEIGHT = 97

# 100% opaque (min_alpha == 255) 0x72 antique weathered stone floor palette
FLOOR_PALETTE = [
    (1, 4), (2, 4), (1, 4), (3, 4),
    (1, 5), (2, 5), (1, 4), (3, 5),
    (1, 6), (2, 6), (1, 4), (2, 4),
]


def cpos(cx: int, cy: int) -> list[int]:
    return [cx * TILE + 8, cy * TILE + 8]


def floor_tile_for(x: int, y: int) -> tuple[int, int]:
    idx = ((x * 73856093) ^ (y * 19349663) ^ ((x + y) * 83492791)) & 0xFFFFFFFF
    return FLOOR_PALETTE[idx % len(FLOOR_PALETTE)]


def wall_atlas_9slice(floor_set: set[tuple[int, int]], x: int, y: int) -> tuple[int, int]:
    """Exact 9-slice perimeter wall autotile matching Chapter1MapBuilder._wall_atlas."""
    north = (x, y - 1) in floor_set
    east = (x + 1, y) in floor_set
    south = (x, y + 1) in floor_set
    west = (x - 1, y) in floor_set
    if north and east:
        return (1, 2)
    if north and west:
        return (3, 2)
    if south and east:
        return (1, 0)
    if south and west:
        return (3, 0)
    if south:
        return (2, 0)
    if north:
        return (2, 2)
    if east:
        return (1, 1)
    if west:
        return (3, 1)
    if (x + 1, y + 1) in floor_set:
        return (1, 0)
    if (x - 1, y + 1) in floor_set:
        return (3, 0)
    if (x + 1, y - 1) in floor_set:
        return (1, 2)
    if (x - 1, y - 1) in floor_set:
        return (3, 2)
    return (2, 0)


def build_level2_data() -> dict:
    floor_cells: dict[tuple[int, int], tuple[int, int, int]] = {}
    geom_cells: dict[tuple[int, int], tuple[int, int, int]] = {}
    decor_cells: dict[tuple[int, int], tuple[int, int, int]] = {}
    pillar_centers: list[tuple[int, int, bool]] = []

    def set_solid(x: int, y: int, src: int, tx: int, ty: int) -> None:
        floor_cells.pop((x, y), None)
        geom_cells[(x, y)] = (src, tx, ty)

    def carve_rect(x0: int, y0: int, w: int, h: int) -> None:
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if 2 <= x < WIDTH - 2 and 2 <= y < HEIGHT - 2:
                    tx, ty = floor_tile_for(x, y)
                    floor_cells[(x, y)] = (0, tx, ty)
                    geom_cells.pop((x, y), None)

    def uncarve_rect(x0: int, y0: int, w: int, h: int) -> None:
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                floor_cells.pop((x, y), None)

    def runner_h(x0: int, x1: int, y: int, recessed: bool = False) -> None:
        """100% opaque smooth polished flagstone processional avenue (atlas [1, 4])."""
        for x in range(x0, x1 + 1):
            if (x, y) in floor_cells:
                floor_cells[(x, y)] = (0, 1, 4)

    def runner_v(x: int, y0: int, y1: int, recessed: bool = False) -> None:
        for y in range(y0, y1 + 1):
            if (x, y) in floor_cells:
                floor_cells[(x, y)] = (0, 1, 4)

    def add_column(cx: int, cy: int, cracked: bool = False) -> None:
        pillar_centers.append((cx, cy, cracked))

    def place_pier_2x2(
        x0: int,
        y0: int,
        left_banner: tuple[int, int] | None = None,
        right_banner: tuple[int, int] | None = None,
    ) -> None:
        for dy in range(2):
            for dx in range(2):
                if dy == 0:
                    set_solid(x0 + dx, y0 + dy, 0, 1 + dx, 1)
                else:
                    set_solid(x0 + dx, y0 + dy, 0, 3, 2)
        if left_banner is not None:
            set_solid(x0, y0 + 1, 0, left_banner[0], left_banner[1])
        if right_banner is not None:
            set_solid(x0 + 1, y0 + 1, 0, right_banner[0], right_banner[1])

    def place_basin(x0: int, y_top: int, crimson: bool) -> None:
        """Seamless 3-wide x 3-tall 0x72 gargoyle fountain basin in solid Geometry."""
        for dx, tx in enumerate((4, 5, 6)):
            set_solid(x0 + dx, y_top, 0, tx, 0)
            set_solid(x0 + dx, y_top + 1, 0, tx, 1 if crimson else 3)
            set_solid(x0 + dx, y_top + 2, 0, tx, 2 if crimson else 4)

    def place_archway(x0: int, y_top: int, open_arch: bool, with_stairs_below: bool = True) -> None:
        base_tx = 5 if open_arch else 2
        for dx in range(2):
            set_solid(x0 + dx, y_top, 0, base_tx + dx, 15)
            set_solid(x0 + dx, y_top + 1, 0, base_tx + dx, 16)
        if with_stairs_below:
            if (x0, y_top + 2) in floor_cells:
                decor_cells[(x0, y_top + 2)] = (0, 5, 12)
            if (x0 + 1, y_top + 2) in floor_cells:
                decor_cells[(x0 + 1, y_top + 2)] = (0, 3, 6)

    # =========================================================================
    # FLOOR 1 (y = 4..26): TIỀN ĐƯỜNG PHÂN CỐT
    # Flow: West Narthex -> Central White-Bone Bifurcation Monument ->
    #       [North: Crimson Reliquary Vault Breach] vs [South: Sapphire Cloister]
    #       -> Northeast Shield-Wall Convergence Apse -> East Crypt Stair (75, 14)
    # =========================================================================
    carve_rect(9, 11, 14, 10)     # x=9..22, y=11..20 Ossuary Narthex
    carve_rect(7, 13, 3, 6)       # x=7..9,  y=13..18 western portal apse
    carve_rect(21, 9, 5, 14)      # x=21..25, y=9..22 bifurcation vestibule

    # Route A (North): Crimson Reliquary Vault Breach (7 tiles high -> 3x3 clear islands around all spikes!)
    carve_rect(24, 7, 24, 7)      # x=24..47, y=7..13
    carve_rect(36, 6, 7, 2)       # x=36..42, y=6..7 vaulted treasure apse
    carve_rect(45, 9, 6, 7)       # x=45..50, y=9..15 drop-down overlook onto Watchpost (50, 13)!

    # Central White-Bone Bifurcation Monument (x=25..29, y=14..18 SOLID PYLON separating N & S!)
    uncarve_rect(25, 14, 5, 5)

    # Route B (South): Sapphire Cloister Colonnade (spacious L-arcade)
    carve_rect(24, 19, 29, 6)     # x=24..52, y=19..24
    carve_rect(40, 24, 7, 2)      # x=40..46, y=24..25 sunken Ossilegium coin alcove
    carve_rect(48, 13, 6, 9)      # x=48..53, y=13..21 wide northern turn into merge apse

    # Convergence Apse (l2_f1_convergence) + East Stair Vestibule (door_l2_f1_f2_down at 75, 14)
    carve_rect(50, 9, 20, 13)     # x=50..69, y=9..21 grand apse hall (includes (50,13)!)
    uncarve_rect(66, 9, 4, 2)     # chamfered NE corner
    uncarve_rect(66, 20, 4, 2)    # chamfered SE corner
    carve_rect(69, 11, 10, 7)     # x=69..78, y=11..17 East Crypt Stair Vestibule

    runner_h(8, 23, 15, recessed=False)
    runner_h(8, 23, 16, recessed=True)
    runner_h(24, 47, 10, recessed=False)
    runner_v(47, 10, 14, recessed=False)
    runner_h(24, 51, 21, recessed=True)
    runner_v(51, 15, 21, recessed=True)
    runner_h(69, 77, 14, recessed=False)

    add_column(12, 13, cracked=False)
    add_column(12, 18, cracked=False)
    add_column(21, 12, cracked=False)
    add_column(21, 19, cracked=False)
    add_column(32, 21, cracked=False)
    add_column(40, 21, cracked=True)
    add_column(56, 12, cracked=False)
    add_column(56, 18, cracked=True)
    add_column(64, 15, cracked=False)

    # =========================================================================
    # FLOOR 2 (y = 38..60): HUYỆT ĐÀI TRẦM CỐT
    # Flow: ARCHITECTURAL SWITCHBACK (EAST -> RADIAL CRUCIBLE -> WEST)
    # =========================================================================
    # 1. East Stair Landing & Overlook Vestibule (door_l2_f1_f2_up at 85, 50)
    carve_rect(76, 47, 14, 8)     # x=76..89, y=47..54

    # 2. North Wing: Azure Sanctuary & Reliquary Overlook (l2_f2_north_cache)
    carve_rect(49, 41, 29, 5)     # x=49..77, y=41..45
    carve_rect(74, 45, 5, 3)      # eastern stair connection from landing up into Sanctuary
    carve_rect(51, 45, 4, 3)      # western drop-in stair into Crucible Rotunda!
    carve_rect(66, 45, 4, 3)      # eastern drop-in stair into Crucible Rotunda!
    uncarve_rect(55, 46, 11, 1)

    # 3. Central Arena: Octagonal Sunken Crucible Rotunda (l2_f2_ring — OFFICIAL MID CAPTURE!)
    carve_rect(44, 47, 32, 12)    # x=44..75, y=47..58
    uncarve_rect(44, 47, 3, 2)
    uncarve_rect(73, 47, 3, 2)
    uncarve_rect(44, 57, 3, 2)
    uncarve_rect(73, 57, 3, 1)

    # 4. South Wing: Catacomb Vault Cut (l2_f2_south_cache)
    carve_rect(35, 54, 21, 6)     # x=35..55, y=54..59 (6 rows -> full 3x3 clear space around spikes!)

    # 5. West Stair Breather & Crypt (l2_f2_convergence, door_l2_f2_f3_down at 25, 51)
    carve_rect(33, 48, 12, 7)
    carve_rect(21, 48, 13, 8)     # x=21..33, y=48..55

    runner_h(50, 76, 43, recessed=True)
    runner_h(76, 87, 50, recessed=False)
    runner_h(45, 58, 52, recessed=False)
    runner_h(62, 75, 52, recessed=False)
    runner_h(23, 44, 51, recessed=True)

    add_column(54, 49, cracked=False)
    add_column(66, 49, cracked=True)
    add_column(54, 55, cracked=True)
    add_column(66, 55, cracked=False)

    # =========================================================================
    # FLOOR 3 (y = 72..95): THÁNH ĐƯỜNG HỘI CỐT
    # Flow: West Sanctuary Landing -> Dual Converging Nave Aisles ->
    #       Cross-Vaulted Convergence Cathedral -> Triumphal Arch -> Exit Sanctum
    # =========================================================================
    carve_rect(19, 80, 18, 9)     # x=19..36, y=80..88 West Sanctuary Landing
    carve_rect(36, 76, 20, 6)     # x=36..55, y=76..81 Northern Chasm-Bridge Slalom
    carve_rect(36, 87, 20, 6)     # x=36..55, y=87..92 Southern Reliquary Transept
    carve_rect(54, 75, 32, 18)    # x=54..85, y=75..92 Grand Convergence Cathedral Nave
    carve_rect(76, 91, 7, 3)      # x=76..82, y=91..93 Southern Reliquary Vault Apse (CLEAR OF JOYSTICK HUD!)
    carve_rect(76, 74, 7, 2)      # Matching Northern Ossuary Transept Niche
    carve_rect(85, 78, 21, 13)    # x=85..105, y=78..90 Raised Exit Sanctum (CLEAR OF TOP & BOTTOM HUD!)
    uncarve_rect(103, 78, 3, 2)
    uncarve_rect(103, 89, 3, 2)

    runner_h(36, 55, 79, recessed=False)
    runner_v(55, 79, 83, recessed=False)
    runner_h(55, 101, 83, recessed=False)
    runner_h(36, 55, 89, recessed=True)
    runner_v(55, 84, 89, recessed=True)
    runner_h(55, 101, 84, recessed=True)

    add_column(26, 82, cracked=False)
    add_column(26, 86, cracked=False)
    add_column(58, 79, cracked=False)
    add_column(58, 88, cracked=True)
    add_column(66, 81, cracked=True)
    add_column(66, 86, cracked=False)
    add_column(74, 78, cracked=False)
    add_column(74, 89, cracked=False)
    add_column(89, 80, cracked=False)
    add_column(89, 88, cracked=False)

    # =========================================================================
    # STEP 1: EXACT 9-SLICE PERIMETER AUTOTILING (ZERO CORNER OR SOUTH GAPS!)
    # =========================================================================
    pure_floor_set = set(floor_cells.keys())
    for y in range(HEIGHT):
        for x in range(WIDTH):
            if (x, y) in pure_floor_set:
                continue
            touches = any(
                (x + dx, y + dy) in pure_floor_set
                for dy in (-1, 0, 1)
                for dx in (-1, 0, 1)
                if (dx, dy) != (0, 0)
            )
            if touches:
                tx, ty = wall_atlas_9slice(pure_floor_set, x, y)
                geom_cells[(x, y)] = (1, tx, ty)

    # Crown interior north-facing walls with 2-row 0x72 brick masonry + coping (zero corner slits!)
    for (wx, wy), (src, tx, ty) in list(geom_cells.items()):
        south_f = (wx, wy + 1) in pure_floor_set
        sw_f = (wx - 1, wy + 1) in pure_floor_set
        se_f = (wx + 1, wy + 1) in pure_floor_set
        east_f = (wx + 1, y := wy) in pure_floor_set
        west_f = (wx - 1, wy) in pure_floor_set
        north_f = (wx, wy - 1) in pure_floor_set
        if south_f and sw_f and se_f and not north_f and not east_f and not west_f:
            geom_cells[(wx, wy)] = (0, 3, 2)
            if (wx, wy - 1) not in pure_floor_set and (wx, wy - 1) not in geom_cells:
                geom_cells[(wx, wy - 1)] = (0, 1 + (wx % 3), 1)

    # =========================================================================
    # STEP 2: INTERIOR ARCHITECTURAL COLUMNS, SHRINE ISLAND & TRIUMPHAL ARCH
    # =========================================================================
    for cx, cy, cracked in pillar_centers:
        col_x = 6 if cracked else 5
        set_solid(cx, cy, 0, 3, 2)
        decor_cells[(cx, cy - 1)] = (0, col_x, 5)
        decor_cells[(cx, cy)] = (0, col_x, 6)
        decor_cells[(cx, cy + 1)] = (0, col_x, 7)

    # Central Bone Reliquary Island inside Floor 2 Crucible Rotunda
    place_pier_2x2(59, 51, left_banner=(1, 2), right_banner=(2, 2))
    set_solid(61, 51, 0, 2, 1)
    set_solid(61, 52, 0, 1, 12)

    # Twin-Column Triumphal Archway framing the Floor 3 Exit Sanctum
    place_pier_2x2(83, 76, left_banner=(1, 2), right_banner=(1, 2))
    place_pier_2x2(83, 79, left_banner=(1, 2), right_banner=(2, 2))
    place_pier_2x2(83, 87, left_banner=(2, 2), right_banner=(1, 2))
    place_pier_2x2(83, 90, left_banner=(2, 2), right_banner=(2, 2))

    # =========================================================================
    # STEP 3: MONUMENTAL GARGOYLE BASINS, CRYPT ARCHWAYS & HERALDIC BANNERS
    # =========================================================================
    # Floor 1
    place_archway(10, 9, open_arch=False, with_stairs_below=False)
    set_solid(14, 10, 0, 1, 12)
    set_solid(16, 10, 0, 2, 2)
    set_solid(18, 10, 0, 2, 12)

    # Central White-Bone Bifurcation Monument (x=25..29, y=14..18)
    for px in range(25, 30):
        set_solid(px, 14, 0, 1 + (px % 3), 1)
        set_solid(px, 15, 0, 3, 2)
    place_basin(28, 4, crimson=True)          # Full gargoyle heads visible below HUD!
    set_solid(25, 6, 0, 1, 2)
    set_solid(32, 6, 0, 1, 2)
    set_solid(34, 6, 0, 1, 12)
    set_solid(44, 6, 0, 1, 2)
    place_basin(26, 16, crimson=False)        # Flowing Azure Spirit-Basin on South Face of Pylon!
    set_solid(25, 17, 0, 2, 2)
    set_solid(29, 17, 0, 2, 3)
    set_solid(25, 15, 0, 1, 2)
    set_solid(29, 15, 0, 1, 12)

    # Sapphire Cloister North Wall accents (y=18)
    set_solid(34, 18, 0, 2, 2)
    set_solid(38, 18, 0, 1, 12)
    set_solid(42, 18, 0, 2, 3)
    set_solid(46, 18, 0, 2, 2)

    # Merge Apse & East Crypt Stair Archway (x=74..75, y=9..10 directly above door_l2_f1_f2_down!)
    set_solid(54, 8, 0, 1, 2)
    set_solid(58, 8, 0, 1, 12)
    set_solid(62, 8, 0, 2, 2)
    place_archway(74, 9, open_arch=True, with_stairs_below=True)

    # Floor 2
    place_archway(84, 45, open_arch=True, with_stairs_below=True)
    set_solid(80, 46, 0, 2, 2)
    set_solid(87, 46, 0, 1, 12)

    place_basin(61, 38, crimson=False)
    set_solid(53, 40, 0, 2, 2)
    set_solid(57, 40, 0, 2, 3)
    set_solid(67, 40, 0, 2, 3)
    set_solid(72, 40, 0, 2, 2)

    for bx in range(55, 66):
        set_solid(bx, 46, 0, 3, 2)
    set_solid(56, 46, 0, 2, 2)
    set_solid(58, 46, 0, 1, 12)
    set_solid(60, 46, 0, 1, 2)
    set_solid(62, 46, 0, 2, 12)
    set_solid(64, 46, 0, 2, 2)

    place_archway(24, 46, open_arch=True, with_stairs_below=True)
    set_solid(29, 47, 0, 1, 2)
    set_solid(37, 47, 0, 1, 12)

    # Floor 3: Symmetric Azure & Crimson Fountains flanking Exit Gate Portal!
    place_archway(22, 78, open_arch=True, with_stairs_below=True)
    set_solid(29, 79, 0, 2, 2)
    set_solid(33, 79, 0, 2, 3)

    set_solid(41, 86, 0, 2, 2)
    set_solid(44, 86, 0, 1, 12)
    set_solid(47, 86, 0, 2, 3)
    set_solid(42, 75, 0, 1, 2)
    set_solid(48, 75, 0, 1, 2)

    place_basin(69, 72, crimson=True)
    set_solid(60, 74, 0, 1, 2)
    set_solid(64, 74, 0, 1, 12)
    set_solid(80, 73, 0, 1, 2)

    # Exit Sanctum North Facade (y=75..77 — 100% below SigilPanel & ObjectivePanel!):
    # Left: Azure Fountain (91..93) | Center: Solid Sanctuary Masonry behind l2_exit (96) | Right: Crimson Fountain (99..101)
    place_basin(91, 75, crimson=False)
    for mx in range(94, 99):
        set_solid(mx, 76, 0, 1 + (mx % 3), 1)
        set_solid(mx, 77, 0, 3, 2)
    place_basin(99, 75, crimson=True)
    set_solid(88, 77, 0, 2, 2)
    set_solid(94, 77, 0, 1, 12)
    set_solid(98, 77, 0, 2, 12)

    # Purposeful White Ossuary Skulls (Decor [18, 27])
    skull_cells = [
        (10, 12), (10, 19), (24, 12), (24, 19), (30, 12), (30, 19),
        (27, 8), (42, 7), (41, 25), (45, 25), (50, 10), (68, 12), (68, 16),
        (58, 50), (62, 50), (58, 53), (62, 53), (50, 42), (76, 42),
        (37, 58), (47, 58), (22, 49), (22, 54),
        (20, 81), (20, 87), (40, 81), (40, 87), (77, 92), (81, 92),
        (82, 81), (82, 86), (87, 79), (87, 89), (102, 81), (102, 87),
    ]
    for sx, sy in skull_cells:
        if (sx, sy) in floor_cells and (sx, sy) not in decor_cells:
            decor_cells[(sx, sy)] = (0, 18, 27)

    # =========================================================================
    # ALL 64 CANONICAL BASELINE ENTITIES + EXPLICIT ADDED TORCHES & COINS
    # Every spike sits inside a full 3x3 floor island so 32x32 sprites NEVER clip walls!
    # =========================================================================
    f1_door_pos = cpos(75, 14)
    f2_entry_pos = cpos(85, 50)
    f2_door_pos = cpos(25, 51)
    f3_entry_pos = cpos(23, 84)

    entities: list[dict] = [
        # 1. Player Spawn
        {"id": "player_spawn", "type": "player", "position": cpos(15, 15)},

        # 2. Camp 1 Skeletons (5 authored in l2_camp_1_shield_wall; runtime +1 scout at (50, 13))
        {"id": "l2_c1_skeleton_01", "type": "skeleton", "position": cpos(36, 10), "patrol": 40},
        {"id": "l2_c1_skeleton_02", "type": "skeleton", "position": cpos(36, 22), "patrol": 40},
        {"id": "l2_c1_skeleton_03", "type": "skeleton", "position": cpos(54, 16), "patrol": 40},
        {"id": "l2_c1_skeleton_04", "type": "skeleton", "position": cpos(60, 12), "patrol": 40},
        {"id": "l2_c1_skeleton_05", "type": "skeleton", "position": cpos(61, 18), "patrol": 40},

        # 3. Camp 2 Skeletons (5 authored in l2_camp_2_ring_pressure — all visible in MID capture!)
        {"id": "l2_c2_skeleton_01", "type": "skeleton", "position": cpos(51, 50), "patrol": 40},
        {"id": "l2_c2_skeleton_02", "type": "skeleton", "position": cpos(69, 50), "patrol": 40},
        {"id": "l2_c2_skeleton_03", "type": "skeleton", "position": cpos(49, 55), "patrol": 40},
        {"id": "l2_c2_skeleton_04", "type": "skeleton", "position": cpos(70, 55), "patrol": 40},
        {"id": "l2_c2_skeleton_05", "type": "skeleton", "position": cpos(60, 56), "patrol": 40},

        # 4. Camp 3 Skeletons (5 authored in l2_camp_3_slalom — 03, 04, 05 visible in END capture!)
        {"id": "l2_c3_skeleton_01", "type": "skeleton", "position": cpos(52, 80), "patrol": 38},
        {"id": "l2_c3_skeleton_02", "type": "skeleton", "position": cpos(61, 88), "patrol": 38},
        {"id": "l2_c3_skeleton_03", "type": "skeleton", "position": cpos(71, 80), "patrol": 38},
        {"id": "l2_c3_skeleton_04", "type": "skeleton", "position": cpos(71, 88), "patrol": 38},
        {"id": "l2_c3_skeleton_05", "type": "skeleton", "position": cpos(79, 83), "patrol": 38},

        # 5. Four Reciprocal Floor Doors
        {
            "id": "door_l2_f1_f2_down",
            "type": "floor_door",
            "position": f1_door_pos,
            "target_position": f2_entry_pos,
            "label": "Tầng 2",
            "message": "Nhấn chuột trái để đi tiếp",
        },
        {
            "id": "door_l2_f1_f2_up",
            "type": "floor_door",
            "position": f2_entry_pos,
            "target_position": f1_door_pos,
            "label": "Quay lại",
            "message": "Nhấn chuột trái để quay lại tầng trước",
        },
        {
            "id": "door_l2_f2_f3_down",
            "type": "floor_door",
            "position": f2_door_pos,
            "target_position": f3_entry_pos,
            "label": "Tầng 3",
            "message": "Nhấn chuột trái để đi tiếp",
        },
        {
            "id": "door_l2_f2_f3_up",
            "type": "floor_door",
            "position": f3_entry_pos,
            "target_position": f2_door_pos,
            "label": "Quay lại",
            "message": "Nhấn chuột trái để quay lại tầng trước",
        },

        # 6. Four Sigils (required_sigils = 3)
        {"id": "l2_sigil_choice_north", "type": "sigil", "position": cpos(34, 10)},
        {"id": "l2_sigil_choice_south", "type": "sigil", "position": cpos(52, 44)},
        {"id": "l2_sigil_ring", "type": "sigil", "position": cpos(60, 54)},
        {"id": "l2_sigil_gauntlet", "type": "sigil", "position": cpos(78, 83)},

        # 7. Two Checkpoints
        {"id": "l2_checkpoint_floor_2", "type": "checkpoint", "position": cpos(60, 44)},
        {"id": "l2_checkpoint_floor_3", "type": "checkpoint", "position": cpos(29, 84)},

        # 8. Exit Gate & Two Reward Chests (100% clear of all 5 HUD panels!)
        {"id": "l2_exit", "type": "exit_gate", "position": cpos(96, 81)},
        {"id": "l2_chest_risky_branch", "type": "chest", "position": cpos(39, 9), "score_reward": 220},
        {"id": "l2_chest_gauntlet", "type": "chest", "position": cpos(79, 91), "score_reward": 280},

        # 9. Fifteen Spikes — ALL 15 surrounded by full 3x3 pure stone floor islands!
        {"id": "l2_spikes_01", "type": "spikes", "position": cpos(28, 9)},
        {"id": "l2_spikes_02", "type": "spikes", "position": cpos(32, 11)},
        {"id": "l2_spikes_03", "type": "spikes", "position": cpos(41, 10)},
        {"id": "l2_spikes_04", "type": "spikes", "position": cpos(45, 11)},
        {"id": "l2_spikes_05", "type": "spikes", "position": cpos(56, 52)},
        {"id": "l2_spikes_06", "type": "spikes", "position": cpos(64, 52)},
        {"id": "l2_spikes_07", "type": "spikes", "position": cpos(51, 53)},
        {"id": "l2_spikes_08", "type": "spikes", "position": cpos(69, 53)},
        {"id": "l2_spikes_09", "type": "spikes", "position": cpos(45, 56)},
        {"id": "l2_spikes_10", "type": "spikes", "position": cpos(39, 56)},
        {"id": "l2_spikes_11", "type": "spikes", "position": cpos(43, 79)},
        {"id": "l2_spikes_12", "type": "spikes", "position": cpos(49, 78)},
        {"id": "l2_spikes_13", "type": "spikes", "position": cpos(70, 84)},
        {"id": "l2_spikes_14", "type": "spikes", "position": cpos(77, 79)},
        {"id": "l2_spikes_15", "type": "spikes", "position": cpos(77, 87)},

        # 10. Original 10 Torches + 12 Added Architectural Torches
        {"id": "l2_torch_01", "type": "torch", "position": cpos(10, 14)},
        {"id": "l2_torch_02", "type": "torch", "position": cpos(23, 10)},
        {"id": "l2_torch_03", "type": "torch", "position": cpos(23, 20)},
        {"id": "l2_torch_04", "type": "torch", "position": cpos(52, 10)},
        {"id": "l2_torch_05", "type": "torch", "position": cpos(72, 12)},
        {"id": "l2_torch_06", "type": "torch", "position": cpos(82, 48)},
        {"id": "l2_torch_07", "type": "torch", "position": cpos(57, 49)},
        {"id": "l2_torch_08", "type": "torch", "position": cpos(63, 56)},
        {"id": "l2_torch_09", "type": "torch", "position": cpos(27, 81)},
        {"id": "l2_torch_10", "type": "torch", "position": cpos(93, 80)},
        {"id": "l2_torch_11", "type": "torch", "position": cpos(10, 17)},
        {"id": "l2_torch_12", "type": "torch", "position": cpos(36, 8)},
        {"id": "l2_torch_13", "type": "torch", "position": cpos(44, 20)},
        {"id": "l2_torch_14", "type": "torch", "position": cpos(66, 18)},
        {"id": "l2_torch_15", "type": "torch", "position": cpos(58, 42)},
        {"id": "l2_torch_16", "type": "torch", "position": cpos(65, 42)},
        {"id": "l2_torch_17", "type": "torch", "position": cpos(28, 49)},
        {"id": "l2_torch_18", "type": "torch", "position": cpos(43, 55)},
        {"id": "l2_torch_19", "type": "torch", "position": cpos(55, 77)},
        {"id": "l2_torch_20", "type": "torch", "position": cpos(77, 91)},
        {"id": "l2_torch_21", "type": "torch", "position": cpos(86, 80)},
        {"id": "l2_torch_22", "type": "torch", "position": cpos(101, 80)},

        # 11. Original 10 Coins + 8 Added Route Breadcrumb Coins
        {"id": "l2_coin_01", "type": "coin", "position": cpos(30, 10)},
        {"id": "l2_coin_02", "type": "coin", "position": cpos(38, 11)},
        {"id": "l2_coin_03", "type": "coin", "position": cpos(42, 24)},
        {"id": "l2_coin_04", "type": "coin", "position": cpos(45, 24)},
        {"id": "l2_coin_05", "type": "coin", "position": cpos(58, 54)},
        {"id": "l2_coin_06", "type": "coin", "position": cpos(62, 54)},
        {"id": "l2_coin_07", "type": "coin", "position": cpos(42, 58)},
        {"id": "l2_coin_08", "type": "coin", "position": cpos(46, 79)},
        {"id": "l2_coin_09", "type": "coin", "position": cpos(89, 83)},
        {"id": "l2_coin_10", "type": "coin", "position": cpos(93, 84)},
        {"id": "l2_coin_11", "type": "coin", "position": cpos(26, 10)},
        {"id": "l2_coin_12", "type": "coin", "position": cpos(43, 10)},
        {"id": "l2_coin_13", "type": "coin", "position": cpos(27, 21)},
        {"id": "l2_coin_14", "type": "coin", "position": cpos(55, 43)},
        {"id": "l2_coin_15", "type": "coin", "position": cpos(48, 58)},
        {"id": "l2_coin_16", "type": "coin", "position": cpos(44, 89)},
        {"id": "l2_coin_17", "type": "coin", "position": cpos(81, 91)},
        {"id": "l2_coin_18", "type": "coin", "position": cpos(97, 84)},
    ]

    def serialize_layer(cells: dict[tuple[int, int], tuple[int, int, int]]) -> list[dict]:
        return [
            {"x": x, "y": y, "source": src, "atlas": [tx, ty], "alternative": 0}
            for (x, y), (src, tx, ty) in sorted(cells.items(), key=lambda item: (item[0][1], item[0][0]))
        ]

    rooms = [
        {"id": "l2_f1_entry", "floor": 1, "role": "safe_entry", "rect": [7, 11, 14, 10]},
        {"id": "l2_f1_fork", "floor": 1, "role": "route_choice", "rect": [21, 9, 9, 14]},
        {"id": "l2_f1_north_reliquary", "floor": 1, "role": "optional_reward", "rect": [24, 6, 26, 9]},
        {"id": "l2_f1_south_reliquary", "floor": 1, "role": "optional_reward", "rect": [24, 19, 30, 7]},
        {"id": "l2_f1_convergence", "floor": 1, "role": "combat_camp", "rect": [50, 9, 29, 13]},
        {"id": "l2_f2_landing", "floor": 2, "role": "safe_landing", "rect": [76, 47, 14, 8]},
        {"id": "l2_f2_ring", "floor": 2, "role": "combat_camp", "rect": [44, 47, 32, 12]},
        {"id": "l2_f2_north_cache", "floor": 2, "role": "flank_route", "rect": [49, 41, 29, 5]},
        {"id": "l2_f2_south_cache", "floor": 2, "role": "flank_route", "rect": [35, 54, 21, 6]},
        {"id": "l2_f2_convergence", "floor": 2, "role": "breather", "rect": [21, 48, 14, 8]},
        {"id": "l2_f3_landing", "floor": 3, "role": "safe_landing", "rect": [19, 80, 18, 9]},
        {"id": "l2_f3_gauntlet", "floor": 3, "role": "combat_camp", "rect": [36, 74, 49, 20]},
        {"id": "l2_f3_exit", "floor": 3, "role": "exit", "rect": [85, 78, 21, 13]},
    ]

    metadata = {
        "objective": "Chọn nhánh ít rủi ro hơn, phá ba bãi xương và thu 3 trong 4 ấn ký.",
        "difficulty_tier": 2,
        "pacing": "three_five_member_packs_per_floor_with_route_pressure",
        "density_cadence_anchor": [808, 216],
        "roster_id": "chapter_1_level_2_roster",
        "encounter_pack_model": {
            "enabled": True,
            "profile_stage": 2,
            "floor_count": 3,
            "placement": "authored_camp_anchors",
            "authored_counts_are_anchors": True,
        },
        "required_sigils": 3,
        "camera_bounds": [0, 0, 110 * TILE, HEIGHT * TILE],
        "layout_profile": "three_floor_fork_and_recombine",
        "tileset": "0x72 DungeonTileset II v1.7 (CC0)",
        "rooms": rooms,
        "combat_camps": [
            {
                "id": "l2_camp_1_shield_wall",
                "floor": 1,
                "rect": [34, 8, 30, 16],
                "entry_cell": [50, 15],
                "enemy_ids": [
                    "l2_c1_skeleton_01",
                    "l2_c1_skeleton_02",
                    "l2_c1_skeleton_03",
                    "l2_c1_skeleton_04",
                    "l2_c1_skeleton_05",
                ],
                "formation": "five_swordsmen_converge_on_two_entries",
                "breather_after": True,
            },
            {
                "id": "l2_camp_2_ring_pressure",
                "floor": 2,
                "rect": [46, 47, 28, 12],
                "entry_cell": [74, 50],
                "enemy_ids": [
                    "l2_c2_skeleton_01",
                    "l2_c2_skeleton_02",
                    "l2_c2_skeleton_03",
                    "l2_c2_skeleton_04",
                    "l2_c2_skeleton_05",
                ],
                "formation": "five_swordsmen_attack_around_a_cover_pit",
                "breather_after": True,
            },
            {
                "id": "l2_camp_3_slalom",
                "floor": 3,
                "rect": [49, 76, 33, 15],
                "entry_cell": [55, 83],
                "enemy_ids": [
                    "l2_c3_skeleton_01",
                    "l2_c3_skeleton_02",
                    "l2_c3_skeleton_03",
                    "l2_c3_skeleton_04",
                    "l2_c3_skeleton_05",
                ],
                "formation": "five_swordsmen_hold_both_slalom_lanes",
                "breather_after": True,
            },
        ],
        "safe_zones": [
            {"id": "l2_spawn_sanctuary", "rect": [7, 11, 14, 10], "purpose": "spawn_and_control_read"},
            {"id": "l2_floor_2_breather", "rect": [49, 41, 29, 5], "purpose": "checkpoint_after_camp"},
            {"id": "l2_floor_3_breather", "rect": [19, 80, 18, 9], "purpose": "checkpoint_before_final_camp"},
        ],
        "special_zones": [
            {"id": "l2_choose_one_sigil_fork", "rect": [24, 6, 30, 20], "purpose": "two_risk_profiles_one_required_route"},
        ],
    }

    return {
        "version": 2,
        "name": "Ngã Ba Cốt Trắng",
        "movement_mode": "top_down",
        "tile_size": TILE,
        "width": WIDTH,
        "height": HEIGHT,
        "layers": {
            "Backdrop": serialize_layer(floor_cells),
            "Geometry": serialize_layer(geom_cells),
            "Decor": serialize_layer(decor_cells),
        },
        "entities": entities,
        "metadata": metadata,
    }


def verify_all_contracts(data: dict, baseline: dict) -> dict:
    errors: list[str] = []
    floor_set = {(c["x"], c["y"]) for c in data["layers"]["Backdrop"]}
    geom_set = {(c["x"], c["y"]) for c in data["layers"]["Geometry"]}

    if floor_set & geom_set:
        errors.append(f"Backdrop overlaps Geometry at {len(floor_set & geom_set)} cells")
    for layer_name in ("Backdrop", "Geometry", "Decor"):
        for c in data["layers"][layer_name]:
            x, y, src, (tx, ty) = c["x"], c["y"], c["source"], c["atlas"]
            if not (0 <= x < WIDTH and 0 <= y < HEIGHT):
                errors.append(f"{layer_name} cell out of bounds: {(x, y)}")
            max_tx, max_ty = (32, 32) if src == 0 else (12, 4)
            if not (0 <= tx < max_tx and 0 <= ty < max_ty):
                errors.append(f"{layer_name} invalid atlas coord: src={src} atlas={(tx, ty)}")

    visited: set[tuple[int, int]] = set()
    components: list[set[tuple[int, int]]] = []
    for cell in sorted(floor_set):
        if cell in visited:
            continue
        comp: set[tuple[int, int]] = set()
        q = deque([cell])
        visited.add(cell)
        while q:
            cur = q.popleft()
            comp.add(cur)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nb = (cur[0] + dx, cur[1] + dy)
                if nb in floor_set and nb not in visited:
                    visited.add(nb)
                    q.append(nb)
        components.append(comp)
    components.sort(key=lambda c: min(p[1] for p in c))
    if len(components) != 3:
        errors.append(f"Expected 3 Backdrop components, got {len(components)}")

    base_by_id = {e["id"]: e for e in baseline["entities"]}
    after_by_id = {e["id"]: e for e in data["entities"]}
    if len(after_by_id) != len(data["entities"]):
        errors.append("Duplicate entity IDs found")
    for eid, be in base_by_id.items():
        if eid not in after_by_id:
            errors.append(f"Missing baseline entity ID: {eid}")
        elif after_by_id[eid]["type"] != be["type"]:
            errors.append(f"Entity {eid} changed type {be['type']} -> {after_by_id[eid]['type']}")

    base_rooms = {r["id"] for r in baseline["metadata"]["rooms"]}
    after_rooms = {r["id"] for r in data["metadata"]["rooms"]}
    if base_rooms != after_rooms:
        errors.append(f"Room ID mismatch: missing={base_rooms - after_rooms}, extra={after_rooms - base_rooms}")

    collision_clear = {c for c in floor_set if (c[0], c[1] - 1) not in geom_set}
    spike_cells = {(e["position"][0] // TILE, e["position"][1] // TILE) for e in data["entities"] if e["type"] == "spikes"}
    door_targets: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for e in data["entities"]:
        cx, cy = e["position"][0] // TILE, e["position"][1] // TILE
        if e["position"] != [cx * TILE + 8, cy * TILE + 8]:
            errors.append(f"Entity {e['id']} not centered on tile: {e['position']}")
        if (cx, cy) not in floor_set:
            errors.append(f"Entity {e['id']} {(cx, cy)} not on Backdrop floor!")
        if (cx, cy) not in collision_clear:
            errors.append(f"Entity {e['id']} {(cx, cy)} collides with north Geometry wall under Knight BodyShape!")
        if e["type"] == "floor_door":
            tx, ty = e["target_position"][0] // TILE, e["target_position"][1] // TILE
            door_targets.setdefault((cx, cy), []).append((tx, ty))

    # Strict 3x3 pure-floor island check around every 32x32 scaled spike sprite + >= 2 safe neighbors
    min_spike_safe_neighbors = 4
    for sc in spike_cells:
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if (sc[0] + dx, sc[1] + dy) not in floor_set:
                    errors.append(f"Spike {sc} 32x32 sprite clips non-floor tile {(sc[0] + dx, sc[1] + dy)}!")
        safe_card = sum(
            1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if (sc[0] + dx, sc[1] + dy) in collision_clear and (sc[0] + dx, sc[1] + dy) not in spike_cells
        )
        min_spike_safe_neighbors = min(min_spike_safe_neighbors, safe_card)
        if safe_card < 2:
            errors.append(f"Spike at {sc} has only {safe_card} safe cardinal neighbors (< 2)")

    spawn = next(e for e in data["entities"] if e["type"] == "player")
    start = (spawn["position"][0] // TILE, spawn["position"][1] // TILE)
    reached: set[tuple[int, int]] = set()
    if start in collision_clear and start not in spike_cells:
        reached.add(start)
        q = deque([start])
        while q:
            cur = q.popleft()
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
                nb = (cur[0] + dx, cur[1] + dy)
                if nb not in collision_clear or nb in spike_cells or nb in reached:
                    continue
                if dx != 0 and dy != 0:
                    if (cur[0] + dx, cur[1]) not in collision_clear or (cur[0], cur[1] + dy) not in collision_clear:
                        continue
                reached.add(nb)
                q.append(nb)
            for dest in door_targets.get(cur, []):
                if dest in collision_clear and dest not in spike_cells and dest not in reached:
                    reached.add(dest)
                    q.append(dest)

    safe_floor = collision_clear - spike_cells
    if reached != safe_floor:
        unreachable = sorted(safe_floor - reached)[:15]
        errors.append(f"Unreachable collision_clear non-spike cells ({len(safe_floor - reached)}): {unreachable}")

    enemies = [e for e in data["entities"] if e["type"] == "skeleton"]
    spikes = [e for e in data["entities"] if e["type"] == "spikes"]
    checkpoints = [e for e in data["entities"] if e["type"] == "checkpoint"]
    doors = [e for e in data["entities"] if e["type"] == "floor_door"]

    def dist(a: list[int], b: list[int]) -> float:
        return math.hypot(a[0] - b[0], a[1] - b[1])

    min_spawn_enemy = min(dist(spawn["position"], e["position"]) for e in enemies)
    min_spawn_spike = min(dist(spawn["position"], s["position"]) for s in spikes)
    min_cp_enemy = min(dist(cp["position"], e["position"]) for cp in checkpoints for e in enemies)
    min_cp_spike = min(dist(cp["position"], s["position"]) for cp in checkpoints for s in spikes)
    min_door_spike = min(dist(d["position"], s["position"]) for d in doors for s in spikes)

    if min_spawn_enemy < 240.0:
        errors.append(f"min_spawn_enemy {min_spawn_enemy:.1f} < 240")
    if min_spawn_spike < 160.0:
        errors.append(f"min_spawn_spike {min_spawn_spike:.1f} < 160")
    if min_cp_enemy < 150.0:
        errors.append(f"min_cp_enemy {min_cp_enemy:.1f} < 150")
    if min_cp_spike < 64.0:
        errors.append(f"min_cp_spike {min_cp_spike:.1f} < 64")
    if min_door_spike < 64.0:
        errors.append(f"min_door_spike {min_door_spike:.1f} < 64")

    for label, pos in [(e["id"], e["position"]) for e in enemies] + [("density_cadence_anchor", data["metadata"]["density_cadence_anchor"])]:
        cx, cy = pos[0] // TILE, pos[1] // TILE
        if label == "density_cadence_anchor" and (cx, cy) != (50, 13):
            errors.append(f"density_cadence_anchor moved from (50,13) to {(cx, cy)}")
        max_card = 0
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            steps = 0
            while (cx + dx * (steps + 1), cy + dy * (steps + 1)) in floor_set:
                steps += 1
            max_card = max(max_card, steps)
        if max_card < 2:
            errors.append(f"{label} at {(cx, cy)} lacks cardinal patrol clearance ({max_card})")

    for camp in data["metadata"]["combat_camps"]:
        rx, ry, rw, rh = camp["rect"]
        ex, ey = camp["entry_cell"]
        if (ex, ey) not in collision_clear:
            errors.append(f"Camp {camp['id']} entry_cell {(ex, ey)} not collision_clear")
        in_camp = [
            e for e in enemies
            if rx <= e["position"][0] // TILE < rx + rw and ry <= e["position"][1] // TILE < ry + rh
        ]
        if len(in_camp) != 5:
            errors.append(f"Camp {camp['id']} expected 5 enemies, got {len(in_camp)}")
        for i in range(len(in_camp)):
            for j in range(i + 1, len(in_camp)):
                d = dist(in_camp[i]["position"], in_camp[j]["position"])
                if not (55.0 <= d <= 560.0):
                    errors.append(f"Camp {camp['id']} pair {in_camp[i]['id']}..{in_camp[j]['id']} dist={d:.1f} outside 55..560")

    min_sym_diff = 999999
    for other_file in sorted((ROOT / "data/levels").glob("*.json")):
        if other_file.name == "chapter_1_level_2.json" or "chapter_2" in other_file.name:
            continue
        od = json.loads(other_file.read_text(encoding="utf-8"))
        of = {(c["x"], c["y"]) for c in od.get("layers", {}).get("Backdrop", [])}
        sym = len(floor_set ^ of)
        min_sym_diff = min(min_sym_diff, sym)
        if sym < 500:
            errors.append(f"Symmetric diff with {other_file.name} is {sym} (< 500)")

    def shortest_tiles(src: tuple[int, int], dst: tuple[int, int], forbidden_rect: tuple[int,int,int,int] | None = None) -> int:
        q = deque([(src, 0)])
        seen = {src}
        while q:
            cur, d = q.popleft()
            if cur == dst:
                return d
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nb = (cur[0] + dx, cur[1] + dy)
                if nb in seen or nb not in collision_clear or nb in spike_cells:
                    continue
                if forbidden_rect is not None:
                    fx, fy, fw, fh = forbidden_rect
                    if fx <= nb[0] < fx + fw and fy <= nb[1] < fy + fh:
                        continue
                seen.add(nb)
                q.append((nb, d + 1))
        return -1

    f1_crimson = shortest_tiles((15, 15), (75, 14), forbidden_rect=(24, 19, 30, 7))
    f1_sapphire = shortest_tiles((15, 15), (75, 14), forbidden_rect=(24, 6, 25, 8))
    f2_direct = shortest_tiles((85, 50), (25, 51), forbidden_rect=(49, 41, 29, 5))
    f2_sanctuary = (
        shortest_tiles((85, 50), (52, 44))
        + shortest_tiles((52, 44), (60, 54))
        + shortest_tiles((60, 54), (25, 51))
    )
    f3_direct = shortest_tiles((23, 84), (96, 81), forbidden_rect=(36, 87, 20, 6))
    f3_transept = (
        shortest_tiles((23, 84), (79, 91), forbidden_rect=(36, 76, 20, 6))
        + shortest_tiles((79, 91), (96, 81))
    )

    return {
        "errors": errors,
        "floor_cells": len(floor_set),
        "geometry_cells": len(geom_set),
        "decor_cells": len(data["layers"]["Decor"]),
        "floor_component_sizes": [len(c) for c in components],
        "collision_clear_cells": len(collision_clear),
        "safe_reachable_cells": len(reached),
        "min_spike_safe_neighbors": min_spike_safe_neighbors,
        "min_sym_diff_other_maps": min_sym_diff,
        "min_spawn_enemy_px": round(min_spawn_enemy, 1),
        "min_spawn_spike_px": round(min_spawn_spike, 1),
        "min_checkpoint_enemy_px": round(min_cp_enemy, 1),
        "min_checkpoint_spike_px": round(min_cp_spike, 1),
        "min_door_spike_px": round(min_door_spike, 1),
        "routes_tiles": {
            "f1_crimson_breach": f1_crimson,
            "f1_sapphire_cloister": f1_sapphire,
            "f2_direct_crucible": f2_direct,
            "f2_sanctuary_overlook": f2_sanctuary,
            "f3_north_bridge_direct": f3_direct,
            "f3_south_reliquary_flank": f3_transept,
            "total_fast_risky": f1_crimson + f2_direct + f3_direct,
            "total_tactical_exploratory": f1_sapphire + f2_sanctuary + f3_transept,
        },
    }


def render_preview_and_footprints(after: dict, baseline: dict) -> None:
    a0 = Image.open(ROOT / "assets/environment/dungeon_0x72/dungeon_tileset_ii.png").convert("RGBA")
    a1 = Image.open(ROOT / "assets/environment/dungeon_0x72/atlas_walls_low.png").convert("RGBA")

    sprite_paths = {
        "player": ("assets/characters/knight/cavalry/attack/Knight_attack_new_1.png", None, (32, 48)),
        "skeleton": ("assets/characters/enemies/enemies-skeleton1_idle.png", (0, 0, 32, 32), (16, 28)),
        "spikes": ("assets/environment/dungeon/items/spikes/peaks_2.png", None, (16, 16)),
        "chest": ("assets/environment/dungeon/items/chest/chest_1.png", None, (8, 12)),
        "torch": ("assets/environment/dungeon/items/torch/candlestick_1_1.png", None, (8, 14)),
        "coin": ("assets/environment/dungeon/items/coin/coin_1.png", None, (8, 8)),
        "sigil": ("assets/environment/dungeon/items/coin/coin_1.png", None, (8, 8)),
        "floor_door": ("assets/environment/dungeon/items/flag/flag_1.png", None, (8, 18)),
        "checkpoint": ("assets/environment/dungeon/items/flag/flag_2.png", None, (16, 30)),
        "exit_gate": ("assets/library/downloaded/free_topdown_pixel_dungeon/PNG/doors_lever_chest_animation.png", (0, 0, 32, 48), (18, 52)),
    }

    tile_cache: dict[tuple[int, int, int, tuple[float, float, float]], Image.Image] = {}

    def get_tile(src: int, tx: int, ty: int, mod: tuple[float, float, float]) -> Image.Image:
        key = (src, tx, ty, mod)
        if key not in tile_cache:
            im = (a0 if src == 0 else a1).crop((tx * 16, ty * 16, tx * 16 + 16, ty * 16 + 16)).copy()
            px = im.load()
            for y in range(16):
                for x in range(16):
                    r, g, b, al = px[x, y]
                    px[x, y] = (min(255, int(r * mod[0])), min(255, int(g * mod[1])), min(255, int(b * mod[2])), al)
            tile_cache[key] = im
        return tile_cache[key]

    def render_full_world(level: dict) -> Image.Image:
        w, h = level["width"] * 16, level["height"] * 16
        world = Image.new("RGBA", (w, h), (9, 5, 15, 255))
        for c in level["layers"]["Backdrop"]:
            world.alpha_composite(get_tile(c["source"], c["atlas"][0], c["atlas"][1], (0.68, 0.73, 0.82)), (c["x"] * 16, c["y"] * 16))
        for c in level["layers"]["Geometry"]:
            world.alpha_composite(get_tile(c["source"], c["atlas"][0], c["atlas"][1], (0.74, 0.78, 0.86)), (c["x"] * 16, c["y"] * 16))
        for c in level["layers"]["Decor"]:
            world.alpha_composite(get_tile(c["source"], c["atlas"][0], c["atlas"][1], (0.84, 0.80, 0.78)), (c["x"] * 16, c["y"] * 16))

        glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for e in level["entities"]:
            ex, ey = int(e["position"][0]), int(e["position"][1])
            et = e["type"]
            if et == "torch":
                gd.ellipse((ex - 64, ey - 64, ex + 64, ey + 64), fill=(255, 130, 45, 26))
                gd.ellipse((ex - 28, ey - 28, ex + 28, ey + 28), fill=(255, 165, 70, 34))
            elif et == "sigil":
                gd.ellipse((ex - 36, ey - 36, ex + 36, ey + 36), fill=(175, 85, 255, 45))
            elif et == "floor_door":
                gd.ellipse((ex - 48, ey - 48, ex + 48, ey + 48), fill=(80, 155, 255, 38))
            elif et == "exit_gate":
                gd.ellipse((ex - 64, ey - 84, ex + 64, ey + 44), fill=(55, 235, 245, 48))
        world = Image.alpha_composite(world, glow)

        ents_with_scout = list(level["entities"]) + [
            {"id": "cadence_scout", "type": "skeleton", "position": level["metadata"]["density_cadence_anchor"]}
        ]
        ents_with_scout.sort(key=lambda item: item["position"][1])
        for e in ents_with_scout:
            et = e["type"]
            ex, ey = int(e["position"][0]), int(e["position"][1])
            p_info = sprite_paths.get(et)
            if p_info and (ROOT / p_info[0]).exists():
                sp = Image.open(ROOT / p_info[0]).convert("RGBA")
                if p_info[1] is not None:
                    sp = sp.crop(p_info[1])
                if et == "skeleton":
                    sp = sp.resize((48, 48), Image.NEAREST)
                    world.alpha_composite(sp, (ex - 24, ey - 40))
                elif et == "spikes":
                    sp = sp.resize((32, 32), Image.NEAREST)
                    world.alpha_composite(sp, (ex - 16, ey - 16))
                elif et == "checkpoint":
                    sp = sp.resize((32, 32), Image.NEAREST)
                    world.alpha_composite(sp, (ex - 16, ey - 30))
                elif et == "exit_gate":
                    sp = sp.resize((37, 55), Image.NEAREST)
                    world.alpha_composite(sp, (ex - 18, ey - 52))
                elif et == "sigil":
                    px = sp.load()
                    for sy in range(sp.height):
                        for sx in range(sp.width):
                            r, g, b, al = px[sx, sy]
                            px[sx, sy] = (min(255, int(r * 0.8 + 90)), int(g * 0.35), min(255, int(b + 180)), al)
                    sp = sp.resize((24, 24), Image.NEAREST)
                    world.alpha_composite(sp, (ex - 12, ey - 12))
                else:
                    world.alpha_composite(sp, (ex - p_info[2][0], ey - p_info[2][1]))
        return world

    def crop_camera(world: Image.Image, level: dict, target_px: tuple[float, float], draw_hud_guide: bool = False) -> Image.Image:
        cb = level["metadata"]["camera_bounds"]
        cx = max(cb[0] + 320, min(cb[0] + cb[2] - 320, int(target_px[0])))
        cy = max(cb[1] + 180, min(cb[1] + cb[3] - 180, int(target_px[1] - 8)))
        sub = world.crop((cx - 320, cy - 180, cx + 320, cy + 180)).resize((1280, 720), Image.NEAREST)
        if draw_hud_guide:
            d = ImageDraw.Draw(sub)
            d.rectangle((22, 18, 434, 152), outline=(255, 255, 255, 95), width=2)
            d.rectangle((454, 18, 868, 128), outline=(255, 255, 255, 95), width=2)
            d.rectangle((886, 18, 1258, 148), outline=(255, 255, 255, 95), width=2)
            d.rectangle((28, 456, 260, 688), outline=(255, 255, 255, 75), width=2)
            d.rectangle((860, 460, 1256, 702), outline=(255, 255, 255, 75), width=2)
        return sub

    def room_center_px(level: dict, room_id: str) -> tuple[float, float]:
        floor_set = {(c["x"], c["y"]) for c in level["layers"]["Backdrop"]}
        rm = next(r for r in level["metadata"]["rooms"] if r["id"] == room_id)
        rx, ry, rw, rh = rm["rect"]
        cx_f, cy_f = rx + rw * 0.5, ry + rh * 0.5
        best = min(
            ((x, y) for y in range(ry, ry + rh) for x in range(rx, rx + rw) if (x, y) in floor_set),
            key=lambda p: (p[0] - cx_f) ** 2 + (p[1] - cy_f) ** 2,
        )
        return (best[0] * 16 + 8, best[1] * 16 + 8)

    world_after = render_full_world(after)
    world_before = render_full_world(baseline)
    world_after.save("/tmp/preview_after_full.png")
    world_before.save("/tmp/preview_before_full.png")

    spawn_after = next(e for e in after["entities"] if e["type"] == "player")["position"]
    spawn_before = next(e for e in baseline["entities"] if e["type"] == "player")["position"]
    for name, pa, pb in [
        ("spawn", tuple(spawn_after), tuple(spawn_before)),
        ("mid", room_center_px(after, "l2_f2_ring"), room_center_px(baseline, "l2_f2_ring")),
        ("end", room_center_px(after, "l2_f3_exit"), room_center_px(baseline, "l2_f3_exit")),
    ]:
        crop_camera(world_after, after, pa, draw_hud_guide=True).save(f"/tmp/preview_after_{name}.png")
        crop_camera(world_before, baseline, pb, draw_hud_guide=True).save(f"/tmp/preview_before_{name}.png")

    # Export identical-scale (10 px / tile = exact 1:1 scale!) labeled Before vs After floor footprints!
    S = 10
    pad_top = 86
    pad_side = 36
    panel_w = WIDTH * S + pad_side * 2
    panel_h = HEIGHT * S + pad_top + 52
    comp = Image.new("RGB", (panel_w * 2 + 24, panel_h), (12, 10, 18))
    cd = ImageDraw.Draw(comp)
    try:
        font_lg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 21)
        font_md = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
        font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 11)
    except Exception:
        font_lg = font_md = font_sm = ImageFont.load_default()

    role_colors = {
        "safe_entry": (46, 86, 130),
        "safe_landing": (42, 114, 134),
        "route_choice": (78, 72, 118),
        "optional_reward": (98, 68, 128),
        "flank_route": (54, 96, 136),
        "combat_camp": (74, 66, 94),
        "breather": (52, 102, 108),
        "exit": (48, 116, 110),
    }

    def draw_pill(x: int, y: int, text: str, fg: tuple[int, int, int] = (248, 246, 255)) -> None:
        bbox = cd.textbbox((x, y), text, font=font_sm)
        cd.rounded_rectangle((bbox[0] - 4, bbox[1] - 2, bbox[2] + 4, bbox[3] + 2), radius=4, fill=(14, 11, 22), outline=(74, 68, 104), width=1)
        cd.text((x, y), text, fill=fg, font=font_sm)

    def draw_footprint_panel(ox: int, title: str, subtitle: str, level: dict, is_after: bool) -> None:
        cd.rounded_rectangle((ox + 8, 8, ox + panel_w - 8, panel_h - 8), radius=12, fill=(18, 15, 28), outline=(62, 56, 86), width=2)
        cd.text((ox + pad_side, 22), title, fill=(242, 238, 255), font=font_lg)
        cd.text((ox + pad_side, 52), subtitle, fill=(168, 162, 198), font=font_sm)

        gx0, gy0 = ox + pad_side, pad_top
        cd.rectangle((gx0, gy0, gx0 + level["width"] * S, gy0 + level["height"] * S), fill=(11, 8, 17), outline=(45, 40, 65), width=1)

        room_map: dict[tuple[int, int], tuple[int, int, int]] = {}
        for rm in level["metadata"]["rooms"]:
            rx, ry, rw, rh = rm["rect"]
            col = role_colors.get(rm["role"], (72, 70, 90))
            if rm["id"] == "l2_f1_north_reliquary" and is_after:
                col = (138, 56, 74)
            elif rm["id"] == "l2_f1_south_reliquary" and is_after:
                col = (50, 96, 150)
            for y in range(ry, ry + rh):
                for x in range(rx, rx + rw):
                    room_map[(x, y)] = col

        for c in level["layers"]["Geometry"]:
            x, y = gx0 + c["x"] * S, gy0 + c["y"] * S
            cd.rectangle((x, y, x + S - 1, y + S - 1), fill=(36, 33, 52))

        for c in level["layers"]["Backdrop"]:
            cx, cy = c["x"], c["y"]
            x, y = gx0 + cx * S, gy0 + cy * S
            base_col = room_map.get((cx, cy), (76, 74, 96))
            if c["source"] == 0 and c["atlas"][0] == 4:
                base_col = (112, 118, 154)
            cd.rectangle((x, y, x + S - 1, y + S - 1), fill=base_col)

        doors_by_id = {e["id"]: e["position"] for e in level["entities"] if e["type"] == "floor_door"}
        for a_id, b_id, col in [
            ("door_l2_f1_f2_down", "door_l2_f1_f2_up", (95, 185, 255)),
            ("door_l2_f2_f3_down", "door_l2_f2_f3_up", (130, 225, 255)),
        ]:
            p1, p2 = doors_by_id[a_id], doors_by_id[b_id]
            x1, y1 = gx0 + int(p1[0] / 16.0 * S), gy0 + int(p1[1] / 16.0 * S)
            x2, y2 = gx0 + int(p2[0] / 16.0 * S), gy0 + int(p2[1] / 16.0 * S)
            cd.line((x1, y1, x2, y2), fill=col, width=2)

        ent_colors = {
            "player": (80, 245, 150),
            "exit_gate": (55, 240, 245),
            "floor_door": (95, 175, 255),
            "checkpoint": (110, 230, 195),
            "sigil": (205, 115, 255),
            "chest": (255, 205, 70),
            "spikes": (255, 95, 95),
            "skeleton": (235, 235, 242),
        }
        for e in level["entities"]:
            et = e["type"]
            if et not in ent_colors:
                continue
            ex = gx0 + int(e["position"][0] / 16.0 * S)
            ey = gy0 + int(e["position"][1] / 16.0 * S)
            r = 5 if et in ("player", "exit_gate", "floor_door", "sigil", "chest", "checkpoint") else 3
            cd.ellipse((ex - r, ey - r, ex + r, ey + r), fill=ent_colors[et], outline=(10, 8, 16))

        for rm in level["metadata"]["rooms"]:
            rx, ry, rw, rh = rm["rect"]
            label = rm["id"].replace("l2_", "")
            lx = gx0 + int((rx + rw * 0.5) * S) - len(label) * 3
            if rm["id"] in ("l2_f1_north_reliquary", "l2_f2_north_cache"):
                ly = gy0 + ry * S - 22
            elif rm["id"] in ("l2_f1_south_reliquary", "l2_f2_south_cache"):
                ly = gy0 + (ry + rh) * S + 8
            else:
                ly = gy0 + ry * S + 4
            draw_pill(lx, ly, label)

        if is_after:
            draw_pill(gx0 + 910, gy0 + 18, "FLOOR 1: W -> E BIFURCATION", (255, 215, 120))
            draw_pill(gx0 + 30, gy0 + 388, "FLOOR 2: E -> W SWITCHBACK CRUCIBLE", (125, 220, 255))
            draw_pill(gx0 + 835, gy0 + 725, "FLOOR 3: W -> E CONVERGENCE SANCTUM", (145, 245, 195))

    draw_footprint_panel(
        0,
        "BEFORE — Pinned Baseline (1c21a49c) | 112×80 Tiles",
        "Repeated Left->Center->Right boxes on all 3 floors; mirrored fork rectangles; cross-map door teleports",
        baseline,
        is_after=False,
    )
    draw_footprint_panel(
        panel_w + 24,
        "AFTER — Ngã Ba Cốt Trắng Overhaul | 120×97 Tiles (Identical 10px/Tile Scale)",
        "3D Cathedral Switchback: F1 W->E Bifurcation | F2 E->W Radial Crucible + Sanctuary | F3 W->E Convergence Sanctum",
        after,
        is_after=True,
    )
    legend = "Legend:  ● Green=Spawn   ● Cyan=Exit Gate   ─ Blue Line=Reciprocal Stair Doors   ● Violet=Sigil (4)   ● Gold=Chest (2)   ● Mint=Checkpoint (2)   ● Red=Spikes (15)   ● White=Skeletons (15)"
    cd.text((pad_side, panel_h - 32), legend, fill=(215, 210, 238), font=font_md)

    out_dir = ROOT / "docs/design-audition/images"
    out_dir.mkdir(parents=True, exist_ok=True)
    comp.save(out_dir / "level2_footprint_comparison.png")


def main() -> int:
    raw_base = subprocess.check_output(["git", "show", f"{BASELINE_SHA}:data/levels/chapter_1_level_2.json"], cwd=ROOT, text=True)
    baseline = json.loads(raw_base)
    after = build_level2_data()
    report = verify_all_contracts(after, baseline)
    print(json.dumps(report, indent=2))
    if report["errors"]:
        print("CONTRACT ERRORS DETECTED!", file=sys.stderr)
        return 1
    LEVEL_PATH.write_text(json.dumps(after, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    render_preview_and_footprints(after, baseline)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
