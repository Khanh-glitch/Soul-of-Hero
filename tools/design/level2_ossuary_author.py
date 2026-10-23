#!/usr/bin/env python3
"""Deterministic authoring authority for Chapter 1 Level 2 — "Ossuary Fork".

This script is the single source of truth for
``data/levels/chapter_1_level_2.json``. It replaces the former Level 2 block in
``tools/generators/generate_chapter_1_levels_2_to_5.gd`` (that generator now
deliberately skips Level 2 so a regeneration cannot silently erase this design).

Design grammar
--------------
Floors are composed from ordered shape primitives instead of plain rectangles,
so the three sites read as architecture rather than boxes:

* ``rect``     — orthogonal rooms and corridors
* ``ells``     — two joined rects (corridors that turn)
* ``ellipse``  — round chambers, wells, apses
* ``ring``     — walkways around a void (the bone well)
* ``poly``     — tapered jaws, trapezoid terraces, octagons
* ``carve_*``  — subtractive voids (the well shaft, the jaw notch)

Then a material pass paints floor families (bone dust, grave slabs, soul-lit
inlay, ruined/wet stone, plank decking) and a decoration pass places real atlas
props with an entity keep-out ring.

Usage
-----
    python3 tools/design/level2_ossuary_author.py            # write JSON
    python3 tools/design/level2_ossuary_author.py --check    # verify in sync
    python3 tools/design/level2_ossuary_author.py --stats
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data" / "levels" / "chapter_1_level_2.json"

TILE = 16
WIDTH = 164
HEIGHT = 138

# ---------------------------------------------------------------------------
# Atlas vocabulary. Every coordinate is a real 16px tile of the shipped CC0
# 0x72 DungeonTileset II atlas (source 0) or the low wall atlas (source 1).
# ---------------------------------------------------------------------------
# --- Floor families -------------------------------------------------------
# Verified by rendering each candidate as an 8x8 field at 4x zoom; only tiles
# that read as continuous ground under repetition are used as fills.
# Limestone flagstone: crack variants only, no holes.
BASE = [(1, 4), (2, 4), (3, 4)]
# Ossuary niche paving: clean floor with a faint skull motif.
NICHE = [(1, 12), (2, 12)]
# Candle-stub paving: strong accent, used only in narrow lit lanes and bridges.
CANDLE = [(3, 12), (4, 12)]
# Collapsed ground: sparse holes, never a fill.
HOLE = [(1, 6), (2, 6)]
# Ruined flagstone variants for sunken shoulders.
BROKEN = [(1, 5), (2, 5), (3, 5)]
# Teal glow strip: the lit lip of standing water. Edge use only.
LIP = [(4, 4), (5, 4), (6, 4)]

WALL_SOURCE = 1
ATLAS_GRID = {0: (32, 32), 1: (12, 4)}

DECOR_ART = {
    "brazier": [(4, 3), (5, 3), (6, 3)],      # burning floor braziers
    "bier": [(5, 5), (6, 5)],                # carved stone coffin slab
    "grave": [(23, 1), (24, 1)],             # light gravestone
    "grave_dark": [(23, 7), (24, 7)],        # mossy gravestone
    "statue": [(27, 9), (28, 9)],            # hooded guardian statue
    "candle": [(3, 6), (2, 6)],              # lit candle stand
}


# ---------------------------------------------------------------------------
# Shape helpers
# ---------------------------------------------------------------------------
def rect(x, y, w, h):
    return {(cx, cy) for cy in range(y, y + h) for cx in range(x, x + w)}


def cells_of(shape):
    kind = shape[0]
    if kind == "rect":
        return rect(*shape[1:])
    if kind == "ells":
        _, ax, ay, aw, ah, bx, by, bw, bh = shape
        return rect(ax, ay, aw, ah) | rect(bx, by, bw, bh)
    if kind == "ellipse":
        _, cx, cy, rx, ry = shape
        return {
            (x, y)
            for y in range(cy - ry, cy + ry + 1)
            for x in range(cx - rx, cx + rx + 1)
            if (x - cx) ** 2 * ry * ry + (y - cy) ** 2 * rx * rx <= rx * rx * ry * ry
        }
    if kind == "ring":
        _, cx, cy, rx_out, ry_out, rx_in, ry_in = shape
        return cells_of(("ellipse", cx, cy, rx_out, ry_out)) - cells_of(
            ("ellipse", cx, cy, rx_in, ry_in)
        )
    if kind == "poly":
        return polygon(shape[1])
    if kind == "octagon":
        return octagon(*shape[1:])
    raise ValueError(kind)


def polygon(points):
    """Scanline fill for a simple polygon of integer vertices (cell centres)."""
    ys = [p[1] for p in points]
    out = set()
    for y in range(min(ys), max(ys) + 1):
        scan = y + 0.5
        xs = []
        for index, (x1, y1) in enumerate(points):
            x2, y2 = points[(index + 1) % len(points)]
            if (y1 <= scan < y2) or (y2 <= scan < y1):
                t = (scan - y1) / (y2 - y1)
                xs.append(x1 + t * (x2 - x1))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            for x in range(math.ceil(xs[i] - 0.001), math.floor(xs[i + 1] + 0.001) + 1):
                out.add((x, y))
    return out


def octagon(cx, cy, rx, ry, cut):
    return polygon([
        (cx - rx + cut, cy - ry), (cx + rx - cut, cy - ry),
        (cx + rx, cy - ry + cut), (cx + rx, cy + ry - cut),
        (cx + rx - cut, cy + ry), (cx - rx + cut, cy + ry),
        (cx - rx, cy + ry - cut), (cx - rx, cy - ry + cut),
    ])


# ---------------------------------------------------------------------------
# FLOOR 1 — "Hàm Răng Trắng" / The White Jaw
# A fossil jaw: mouth vestibule, a ribbed fan hall where the jawbone splits the
# route, a high ledge above and a flooded nave below, rejoining in a round
# cenotaph rotunda.
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# FLOOR 1 — "Hàm Răng Trắng" / The White Jaw  (rows 4..46)
# Mouth Court -> Jaw Hall split by the jawbone -> two roads -> Cenotaph Rotunda.
# ---------------------------------------------------------------------------
F1_ADD = [
    ("ellipse", 18, 26, 11, 8),                    # R1 Mouth Court (spawn)
    ("rect", 26, 22, 13, 9),                       # throat
    ("octagon", 51, 26, 16, 12, 5),                # R2 Jaw Hall
    # North balcony over the jaw: the first landmark the player sees.
    ("rect", 44, 8, 16, 7),
    ("rect", 47, 15, 7, 5),
    # High road: the Ledge of Relics, a dog-legged ledge with two notches.
    ("rect", 66, 13, 9, 6),
    ("rect", 74, 10, 10, 6),
    ("rect", 83, 13, 9, 6),
    ("rect", 91, 9, 10, 6),
    ("octagon", 111, 12, 11, 8, 4),                # R3 Reliquary Chapel
    ("rect", 104, 15, 9, 5),                       # chapel stair east
    ("rect", 119, 13, 12, 4),                      # chapel-to-rotunda neck
    # Low road: the Flooded Nave, wide and sunken.
    ("poly", [(66, 34), (78, 32), (96, 33), (104, 36),
              (104, 41), (92, 43), (74, 43), (65, 39)]),
    ("ellipse", 113, 37, 10, 7),                   # R4 Nave Chancel
    ("rect", 120, 36, 10, 5),                      # chancel stair east
    # R5 Cenotaph Rotunda: the floor-1 convergence. A sunken moat ring
    # separates the outer ambulatory from the cenotaph island; four
    # processional bridges cross it at the compass points.
    ("octagon", 143, 26, 19, 18, 7),
]
# Moat ring under the rotunda floor (carved back to void, then bridged).
F1_CARVE = [
    ("octagon", 143, 26, 15, 14, 6),
]
F1_BRIDGE = [
    ("octagon", 143, 26, 10, 9, 4),                # cenotaph island
    ("rect", 141, 8, 5, 11),                       # north bridge
    ("rect", 141, 34, 5, 10),                      # south bridge
    ("rect", 124, 24, 11, 5),                      # west bridge
    ("rect", 152, 24, 11, 5),                      # east bridge
]

# The jawbone: a solid bar with hanging teeth that forces the two roads.
F1_SPINE = [
    ("rect", 42, 24, 26, 4),
    ("rect", 42, 28, 3, 3), ("rect", 58, 28, 3, 3), ("rect", 66, 20, 3, 4),
    ("rect", 42, 18, 3, 3),
]

# ---------------------------------------------------------------------------
# FLOOR 2 — "Giếng Xương" / The Bone Well  (rows 52..94)
# Antechamber -> ring gallery around a true void -> four spans to an island.
# ---------------------------------------------------------------------------
WELL = (88, 72, 34, 19)
F2_ADD = [
    ("octagon", 18, 72, 11, 9, 4),                 # R6 Well Antechamber
    ("rect", 27, 69, 14, 7),                       # causeway
    ("rect", 40, 68, 16, 8),                       # causeway span to the rim
    ("ellipse", WELL[0], WELL[1], WELL[2], WELL[3]),   # R7 ring gallery
    ("rect", 118, 65, 12, 15),                     # east neck
    ("octagon", 140, 72, 14, 12, 5),               # R8 Wellhead Hall
    ("octagon", 128, 56, 10, 7, 3),                # R9 Ossuary Shelf (north cache)
    ("rect", 128, 62, 6, 6),
    ("octagon", 128, 88, 10, 7, 3),                # R10 Flooded Vault (south cache)
    ("rect", 128, 80, 6, 6),
]
F2_CARVE = [
    ("ellipse", WELL[0], WELL[1], 24, 11),         # the shaft
]
F2_REFILL = [
    ("ellipse", WELL[0], WELL[1], 7, 3),           # the island
    ("rect", 85, 61, 6, 9),                        # north plank span
    ("rect", 85, 75, 6, 9),                        # south plank span
    ("rect", 94, 70, 20, 4),                       # long east plank span
]
F2_SOLID = [
    ("rect", 86, 71, 4, 3),                        # island altar
    *[("rect", x, 56, 2, 2) for x in (66, 74, 100, 108)],
    *[("rect", x, 86, 2, 2) for x in (66, 74, 100, 108)],
    ("rect", 134, 64, 3, 3), ("rect", 148, 64, 3, 3),
    ("rect", 134, 78, 3, 3), ("rect", 148, 78, 3, 3),
]

# ---------------------------------------------------------------------------
# FLOOR 3 — "Ca Đoàn Trắng" / The White Choir  (rows 100..134)
# Antechamber -> processional -> three-lane choir -> apse with the exit.
# ---------------------------------------------------------------------------
F3_ADD = [
    ("octagon", 17, 116, 11, 9, 4),                # R11 Choir Antechamber
    ("rect", 27, 112, 15, 8),                      # processional
    ("rect", 42, 108, 44, 16),                     # R12 Choir Nave
    ("rect", 43, 110, 42, 12),                     # widened inner chamber
    ("octagon", 96, 116, 12, 13, 4),               # R13 Exit Apse
    ("rect", 104, 119, 10, 6),                     # discovery aisle east
    ("octagon", 120, 122, 9, 7, 3),                # R14 Relic Stair (discovery)
]
F3_COLONNADE = [
    *[("rect", x, 113, 2, 2) for x in (48, 56, 64, 72, 80)],
    *[("rect", x, 118, 2, 2) for x in (48, 56, 64, 72, 80)],
]
F3_SOLID = [
    ("rect", 44, 109, 2, 3), ("rect", 44, 121, 2, 3),
    ("rect", 84, 109, 2, 3), ("rect", 84, 121, 2, 3),
    ("rect", 90, 110, 2, 3), ("rect", 90, 120, 2, 3),
]

# ---------------------------------------------------------------------------
# Materials. Ordered: later entries paint over earlier ones.
# ---------------------------------------------------------------------------
MATERIALS = [
    # ---- FLOOR 1 ----
    ("deep", ("poly", [(46, 22), (62, 20), (104, 22), (110, 26), (110, 32),
                       (104, 34), (62, 33), (46, 30)])),
    ("bone", ("rect", 0, 0, WIDTH, 50)),
    ("deep", ("poly", [(66, 34), (78, 32), (96, 33), (104, 36),
                       (104, 41), (92, 43), (74, 43), (65, 39)])),
    ("deep", ("ellipse", 113, 37, 10, 7)),
    ("grave", ("octagon", 111, 12, 11, 8, 4)),
    ("grave", ("octagon", 143, 26, 18, 17, 6)),
    ("soul", ("rect", 27, 25, 10, 2)),
    ("soul", ("rect", 45, 25, 22, 2)),
    ("soul", ("rect", 74, 11, 10, 2)),
    ("soul", ("rect", 91, 10, 10, 2)),
    ("soul", ("rect", 121, 37, 10, 2)),
    ("soul", ("rect", 135, 25, 16, 2)),
    # ---- FLOOR 2 ----
    ("deep", ("ellipse", WELL[0], WELL[1], 26, 13)),
    ("bone", ("ellipse", WELL[0], WELL[1], 24, 11)),
    ("span", ("rect", 85, 61, 6, 9)), ("span", ("rect", 85, 75, 6, 9)),
    ("span", ("rect", 94, 70, 20, 4)),
    ("span", ("ellipse", WELL[0], WELL[1], 7, 3)),
    ("grave", ("rect", 27, 69, 14, 7)),
    ("grave", ("octagon", 140, 72, 14, 12, 5)),
    ("grave", ("octagon", 128, 56, 10, 7, 3)),
    ("deep", ("octagon", 128, 88, 10, 7, 3)),
    ("soul", ("rect", 118, 71, 12, 2)),
    # ---- FLOOR 3 ----
    ("grave", ("rect", 42, 108, 44, 16)),
    ("bone", ("rect", 42, 104, 44, 8)),
    ("soul", ("rect", 46, 115, 38, 2)),
    # A single lit processional lane runs from the choir into the exit apse.
    ("soul", ("rect", 92, 115, 10, 2)),
    ("soul", ("rect", 99, 112, 2, 8)),
    ("deep", ("rect", 110, 120, 10, 4)),
]

# ---------------------------------------------------------------------------
# Solid multi-cell masses (piers, columns, altars, jawbone, cenotaph).
# Subtracted from the floor mask so they are genuine obstructions.
# ---------------------------------------------------------------------------
SOLID = [
    *F1_SPINE,
    ("rect", 140, 22, 8, 8),                       # the Cenotaph
    ("rect", 34, 24, 2, 5),                        # throat post pair
    ("rect", 129, 10, 2, 4), ("rect", 129, 18, 2, 4),   # chapel jambs
    *[("rect", x, 30, 2, 2) for x in (70, 78, 86, 94)],  # nave breakwater
    *[("rect", x, 40, 2, 2) for x in (74, 82, 90)],
    *F2_SOLID,
    *F3_COLONNADE,
    *F3_SOLID,
]


def world(cx, cy):
    return [cx * TILE + TILE // 2, cy * TILE + TILE // 2]


def tile_cell(x, y, atlas, source=0):
    return {
        "x": int(x), "y": int(y), "source": int(source),
        "atlas": [int(atlas[0]), int(atlas[1])], "alternative": 0,
    }


def build_floor():
    floor = set()
    for shape in F1_ADD + F2_ADD + F3_ADD:
        floor |= cells_of(shape)
    for shape in F1_CARVE + F2_CARVE:
        floor -= cells_of(shape)
    for shape in F1_BRIDGE + F2_REFILL:
        floor |= cells_of(shape)
    solid = set()
    for shape in SOLID:
        solid |= cells_of(shape)
    floor -= solid
    return {(x, y) for (x, y) in floor if 0 <= x < WIDTH and 0 <= y < HEIGHT}, solid


def seeded(x, y, salt):
    return (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)


def pick(options, x, y, salt):
    return options[seeded(x, y, salt) % len(options)]


# ---------------------------------------------------------------------------
# Entity placement (all 64 baseline IDs retained; every one repositioned).
# ---------------------------------------------------------------------------
ENTITIES = {
    "player_spawn": ("player", (12, 26), {}),

    "l2_c1_skeleton_01": ("skeleton", (139, 22), {"patrol": 28}),
    "l2_c1_skeleton_02": ("skeleton", (147, 22), {"patrol": 28}),
    "l2_c1_skeleton_03": ("skeleton", (139, 30), {"patrol": 28}),
    "l2_c1_skeleton_04": ("skeleton", (147, 30), {"patrol": 28}),
    "l2_c1_skeleton_05": ("skeleton", (143, 18), {"patrol": 24}),

    "l2_c2_skeleton_01": ("skeleton", (126, 56), {"patrol": 40}),
    "l2_c2_skeleton_02": ("skeleton", (130, 66), {"patrol": 40}),
    "l2_c2_skeleton_03": ("skeleton", (126, 79), {"patrol": 40}),
    "l2_c2_skeleton_04": ("skeleton", (120, 62), {"patrol": 40}),
    "l2_c2_skeleton_05": ("skeleton", (121, 85), {"patrol": 40}),

    "l2_c3_skeleton_01": ("skeleton", (52, 111), {"patrol": 38}),
    "l2_c3_skeleton_02": ("skeleton", (62, 116), {"patrol": 38}),
    "l2_c3_skeleton_03": ("skeleton", (70, 120), {"patrol": 38}),
    "l2_c3_skeleton_04": ("skeleton", (80, 116), {"patrol": 38}),
    "l2_c3_skeleton_05": ("skeleton", (86, 111), {"patrol": 30}),

    "door_l2_f1_f2_down": ("floor_door", (156, 26), {
        "target_position": world(11, 72), "label": "Tầng 2",
        "message": "Nhấn chuột trái để xuống Giếng Xương"}),
    "door_l2_f1_f2_up": ("floor_door", (11, 72), {
        "target_position": world(156, 26), "label": "Quay lại",
        "message": "Nhấn chuột trái để về Hàm Răng Trắng"}),
    "door_l2_f2_f3_down": ("floor_door", (142, 72), {
        "target_position": world(11, 116), "label": "Tầng 3",
        "message": "Nhấn chuột trái để xuống Ca Đoàn Trắng"}),
    "door_l2_f2_f3_up": ("floor_door", (11, 116), {
        "target_position": world(142, 72), "label": "Quay lại",
        "message": "Nhấn chuột trái để về Giếng Xương"}),

    # 4 sigils — you need 3, so one branch can be skipped entirely.
    "l2_sigil_choice_north": ("sigil", (124, 12), {}),     # reliquary chapel (high road)
    "l2_sigil_choice_south": ("sigil", (126, 38), {}),      # nave chancel (low road)
    "l2_sigil_ring": ("sigil", (88, 71), {}),               # bone well island
    "l2_sigil_gauntlet": ("sigil", (68, 116), {}),          # white choir

    "l2_checkpoint_floor_2": ("checkpoint", (10, 68), {}),
    "l2_checkpoint_floor_3": ("checkpoint", (10, 111), {}),
    "l2_exit": ("exit_gate", (100, 116), {}),

    "l2_chest_risky_branch": ("chest", (108, 11), {"score_reward": 220}),
    "l2_chest_gauntlet": ("chest", (120, 122), {"score_reward": 280}),

    # Hazards: high-road notches, nave shallows, well rim, choir lanes.
    "l2_spikes_01": ("spikes", (96, 10), {}),
    "l2_spikes_02": ("spikes", (104, 13), {}),
    "l2_spikes_03": ("spikes", (112, 9), {}),
    "l2_spikes_04": ("spikes", (78, 12), {}),
    "l2_spikes_05": ("spikes", (78, 37), {}),
    "l2_spikes_06": ("spikes", (100, 34), {}),
    "l2_spikes_07": ("spikes", (114, 41), {}),
    "l2_spikes_08": ("spikes", (60, 84), {}),
    "l2_spikes_09": ("spikes", (74, 85), {}),
    "l2_spikes_10": ("spikes", (100, 85), {}),
    "l2_spikes_11": ("spikes", (114, 84), {}),
    "l2_spikes_12": ("spikes", (110, 70), {}),
    "l2_spikes_13": ("spikes", (58, 110), {}),
    "l2_spikes_14": ("spikes", (74, 120), {}),
    "l2_spikes_15": ("spikes", (90, 120), {}),

    "l2_torch_01": ("torch", (6, 20), {}),
    "l2_torch_02": ("torch", (24, 19), {}),
    "l2_torch_03": ("torch", (18, 33), {}),
    "l2_torch_04": ("torch", (40, 9), {}),
    "l2_torch_05": ("torch", (22, 69), {}),
    "l2_torch_06": ("torch", (22, 76), {}),
    "l2_torch_07": ("torch", (140, 50), {}),
    "l2_torch_08": ("torch", (6, 118), {}),
    "l2_torch_09": ("torch", (46, 110), {}),
    "l2_torch_10": ("torch", (96, 106), {}),

    "l2_coin_01": ("coin", (20, 22), {}),
    "l2_coin_02": ("coin", (88, 10), {}),
    "l2_coin_03": ("coin", (114, 36), {}),
    "l2_coin_04": ("coin", (152, 34), {}),
    "l2_coin_05": ("coin", (30, 72), {}),
    "l2_coin_06": ("coin", (66, 86), {}),
    "l2_coin_07": ("coin", (108, 69), {}),
    "l2_coin_08": ("coin", (34, 112), {}),
    "l2_coin_09": ("coin", (76, 112), {}),
    "l2_coin_10": ("coin", (124, 128), {}),
}

ENTITY_ORDER = [
    "player_spawn",
    *[f"l2_c1_skeleton_0{i}" for i in range(1, 6)],
    *[f"l2_c2_skeleton_0{i}" for i in range(1, 6)],
    *[f"l2_c3_skeleton_0{i}" for i in range(1, 6)],
    "door_l2_f1_f2_down", "door_l2_f1_f2_up",
    "door_l2_f2_f3_down", "door_l2_f2_f3_up",
    "l2_sigil_choice_north", "l2_sigil_choice_south",
    "l2_sigil_ring", "l2_sigil_gauntlet",
    "l2_checkpoint_floor_2", "l2_checkpoint_floor_3",
    "l2_exit",
    "l2_chest_risky_branch", "l2_chest_gauntlet",
    *[f"l2_spikes_{i:02d}" for i in range(1, 16)],
    *[f"l2_torch_{i:02d}" for i in range(1, 11)],
    *[f"l2_coin_{i:02d}" for i in range(1, 11)],
]


# ---------------------------------------------------------------------------
# Non-blocking decoration: (kind, cells, orientation-of-binding)
# ---------------------------------------------------------------------------
def runs() -> list:
    """Architectural decoration runs, aligned to the authored rooms."""
    out = [
        # ---- F1 Mouth Court: braziers at the two exits, grave jambs ----
        ("brazier", [(9, 20), (9, 32), (24, 20), (24, 32)]),
        ("grave", [(13, 18), (13, 34), (20, 17), (20, 35)]),
        # ---- F1 Jaw Hall: bier rows on the terraces, teeth lit from below ----
        ("bier", [(40, 20), (44, 20), (48, 20), (52, 20), (56, 20)]),
        ("bier", [(40, 32), (44, 32), (48, 32), (52, 32), (56, 32)]),
        ("brazier", [(38, 26), (64, 26), (50, 14), (50, 38)]),
        ("grave_dark", [(46, 24), (56, 24), (46, 29), (56, 29)]),
        # ---- F1 north balcony (landmark) ----
        ("statue", [(48, 10), (52, 10), (56, 10)]),
        ("brazier", [(45, 9), (59, 9)]),
        # ---- F1 Ledge of Relics: braziers at every jog, graves between ----
        ("brazier", [(67, 14), (75, 11), (84, 14), (92, 10), (102, 11)]),
        ("grave", [(70, 17), (79, 14), (87, 17), (96, 13)]),
        # ---- F1 Reliquary Chapel ----
        ("bier", [(106, 9), (106, 15), (110, 9), (110, 15)]),
        ("statue", [(115, 9), (118, 9)]),
        ("candle", [(108, 12), (112, 12), (116, 13)]),
        ("brazier", [(104, 8), (118, 17)]),
        # ---- F1 Flooded Nave ----
        ("grave_dark", [(70, 36), (78, 40), (88, 36), (96, 40)]),
        ("bier", [(72, 33), (76, 33)]),
        ("brazier", [(66, 37), (103, 38)]),
        # ---- F1 Cenotaph Rotunda ----
        ("grave", [(132, 18), (136, 18), (140, 18), (144, 18), (148, 18)]),
        ("grave", [(132, 34), (136, 34), (140, 34), (144, 34), (148, 34)]),
        ("brazier", [(133, 14), (155, 14), (133, 38), (155, 38)]),
        ("statue", [(130, 26), (157, 26)]),
        ("candle", [(150, 25), (150, 28)]),
        # ---- F2 Antechamber ----
        ("brazier", [(11, 67), (11, 77), (24, 67), (24, 77)]),
        ("grave", [(16, 65), (16, 79)]),
        # ---- F2 causeways: brazier pairs at the pinch points ----
        ("brazier", [(31, 69), (31, 75), (43, 69), (43, 75)]),
        ("grave_dark", [(36, 70), (36, 74)]),
        # ---- F2 ring gallery: coffin shelves follow the rim ----
        ("grave", [(60, 58), (66, 56), (74, 55), (82, 54), (90, 55), (98, 56), (106, 58)]),
        ("grave", [(58, 86), (66, 88), (74, 89), (82, 90), (90, 89), (98, 88), (106, 86)]),
        ("grave_dark", [(56, 62), (56, 82), (118, 62), (118, 82)]),
        ("brazier", [(70, 61), (70, 83), (104, 61), (104, 83)]),
        # ---- F2 island (landmark) ----
        ("statue", [(83, 69), (93, 69)]),
        ("bier", [(85, 66), (89, 66)]),
        ("candle", [(88, 76), (86, 75), (90, 75)]),
        # ---- F2 Wellhead Hall ----
        ("grave", [(134, 68), (138, 68), (142, 68), (146, 68)]),
        ("brazier", [(132, 62), (150, 62), (132, 82), (150, 82)]),
        ("statue", [(144, 77), (144, 66)]),
        # ---- F2 caches ----
        ("bier", [(124, 54), (128, 54), (132, 54)]),
        ("grave_dark", [(124, 90), (128, 90), (132, 90)]),
        ("brazier", [(122, 53), (137, 53), (122, 91), (137, 91)]),
        # ---- F3 Antechamber + processional ----
        ("brazier", [(11, 111), (11, 121), (24, 111), (24, 121)]),
        ("grave", [(31, 110), (31, 121), (37, 110), (37, 121)]),
        # ---- F3 White Choir (landmark colonnade) ----
        ("bier", [(48, 110), (56, 110), (64, 110), (72, 110), (80, 110)]),
        ("bier", [(48, 121), (56, 121), (64, 121), (72, 121), (80, 121)]),
        ("brazier", [(52, 116), (68, 116), (80, 116)]),
        ("candle", [(58, 114), (62, 118), (70, 114), (74, 118)]),
        ("statue", [(44, 113), (88, 113)]),
        ("grave_dark", [(46, 124), (84, 105), (84, 126)]),
        # ---- F3 Exit Apse + discovery ----
        ("statue", [(92, 110), (92, 122)]),
        ("bier", [(100, 111), (100, 121)]),
        ("brazier", [(104, 116), (110, 116)]),
        ("grave_dark", [(112, 121), (118, 124), (126, 122)]),
    ]
    return out


DECOR_RUNS = runs()


def build_decor(floor, entities):
    reserved = set()
    for entity in entities:
        x = entity["position"][0] // TILE
        y = entity["position"][1] // TILE
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                reserved.add((x + dx, y + dy))
    used = set()
    cells = []
    for kind, positions in DECOR_RUNS:
        art = DECOR_ART[kind]
        for index, (x, y) in enumerate(positions):
            if (x, y) not in floor or (x, y) in reserved or (x, y) in used:
                continue
            used.add((x, y))
            cells.append(tile_cell(x, y, art[index % len(art)], 0))
    return cells


def material_map(floor):
    material = {}
    for name, shape in MATERIALS:
        for cell_pos in cells_of(shape):
            if cell_pos in floor:
                material[cell_pos] = name
    return material


def build_backdrop(floor):
    """Paint a floor family per cell, with water lips and sparse collapse."""
    material = material_map(floor)
    # North lip of every sunken zone gets the teal glow strip: the level's
    # single "water" gesture, readable at gameplay zoom.
    lip = set()
    for (x, y) in floor:
        above = material.get((x, y - 1))
        here = material.get((x, y), "bone")
        if here == "deep" and above != "deep":
            lip.add((x, y))
    cells = []
    for (x, y) in sorted(floor, key=lambda c: (c[1], c[0])):
        m = material.get((x, y), "bone")
        roll = seeded(x, y, 17) % 100
        if (x, y) in lip:
            atlas = pick(LIP, x, y, 6)
        elif m == "soul":
            atlas = pick(CANDLE, x, y, 3)
        elif m == "grave":
            atlas = pick(NICHE, x, y, 2) if roll < 70 else pick(BASE, x, y, 2)
        elif m == "deep":
            if roll < 11:
                atlas = pick(HOLE, x, y, 8)
            elif roll < 40:
                atlas = pick(BROKEN, x, y, 9)
            else:
                atlas = pick(BASE, x, y, 1)
        elif m == "span":
            atlas = pick(CANDLE, x, y, 5)
        else:  # bone terraces
            atlas = pick(HOLE, x, y, 8) if roll < 4 else pick(BASE, x, y, 1)
        cells.append(tile_cell(x, y, atlas, 0))
    return cells


def wall_atlas(floor, x, y):
    north = (x, y - 1) in floor
    east = (x + 1, y) in floor
    south = (x, y + 1) in floor
    west = (x - 1, y) in floor
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
    if (x + 1, y + 1) in floor:
        return (1, 0)
    if (x - 1, y + 1) in floor:
        return (3, 0)
    if (x + 1, y - 1) in floor:
        return (1, 2)
    if (x - 1, y - 1) in floor:
        return (3, 2)
    return (2, 0)


WALL_BAND = 2
BANDS = [(0, 50), (50, 98), (98, HEIGHT)]


def _dilate(cells, radius):
    out = set()
    for (x, y) in cells:
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                out.add((x + dx, y + dy))
    return out


def _erode(cells, radius):
    return {(x, y) for (x, y) in cells
            if all((x + dx, y + dy) in cells
                   for dy in range(-radius, radius + 1)
                   for dx in range(-radius, radius + 1))}


def _seams(floor):
    """Morphological closing: fills narrow stone seams between adjacent rooms.

    Wide gaps (the open jaw chasm, the well shaft) survive, so the level keeps
    its readable negative space while adjacent chambers share a solid wall body.
    """
    closed = _erode(_dilate(floor, 3), 3)
    return closed - floor


def _diagonal_join(floor):
    """Keep the floor mask diagonal-free (no tile-corner leaks)."""
    return floor


def build_geometry(floor):
    """Carved rock: the interior void of each floor band becomes solid masonry.

    This is what makes the rooms read as excavated architecture instead of
    islands floating in a black void, and it also gives the interior pillars
    and cenotaph a coherent stone body to sit in.
    """
    walls = set(_seams(floor))
    # A two-cell lip around the outer silhouette gives the map a cut-away edge.
    for (x, y) in floor:
        for dy in range(-WALL_BAND, WALL_BAND + 1):
            for dx in range(-WALL_BAND, WALL_BAND + 1):
                n = (x + dx, y + dy)
                if n not in floor and 0 <= n[0] < WIDTH and 0 <= n[1] < HEIGHT:
                    walls.add(n)
    return [tile_cell(x, y, wall_atlas(floor, x, y), WALL_SOURCE)
            for (x, y) in sorted(walls, key=lambda c: (c[1], c[0]))]


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------
ROOM_SHAPES = [
    ("l2_f1_entry", 1, "safe_entry", [("ellipse", 18, 26, 11, 8)]),
    ("l2_f1_fork", 1, "route_choice",
     [("octagon", 51, 26, 16, 12, 5), ("rect", 26, 22, 13, 9)]),
    ("l2_f1_north_reliquary", 1, "optional_reward",
     [("octagon", 111, 12, 11, 8, 4), ("rect", 66, 13, 9, 6),
      ("rect", 74, 10, 10, 6), ("rect", 83, 13, 9, 6), ("rect", 91, 9, 10, 6)]),
    ("l2_f1_south_reliquary", 1, "optional_reward",
     [("poly", [(66, 34), (78, 32), (96, 33), (104, 36),
                (104, 41), (92, 43), (74, 43), (65, 39)]),
      ("ellipse", 113, 37, 10, 7)]),
    ("l2_f1_convergence", 1, "combat_camp", [("octagon", 143, 26, 18, 17, 6)]),
    ("l2_f2_landing", 2, "safe_landing",
     [("octagon", 18, 72, 11, 9, 4), ("rect", 27, 69, 14, 7)]),
    ("l2_f2_ring", 2, "combat_camp",
     [("ellipse", WELL[0], WELL[1], WELL[2], WELL[3])]),
    ("l2_f2_north_cache", 2, "flank_route",
     [("octagon", 128, 56, 10, 7, 3), ("rect", 128, 62, 6, 6)]),
    ("l2_f2_south_cache", 2, "flank_route",
     [("octagon", 128, 88, 10, 7, 3), ("rect", 128, 80, 6, 6)]),
    ("l2_f2_convergence", 2, "breather", [("octagon", 140, 72, 14, 12, 5)]),
    ("l2_f3_landing", 3, "safe_landing",
     [("octagon", 17, 116, 11, 9, 4),
      ("rect", 27, 112, 15, 8)]),
    ("l2_f3_gauntlet", 3, "combat_camp", [("rect", 42, 104, 44, 24)]),
    ("l2_f3_exit", 3, "exit",
     [("octagon", 96, 116, 12, 13, 4), ("octagon", 120, 122, 9, 7, 3),
      ("rect", 104, 119, 10, 6)]),
]


def room_rect(shapes):
    cells = set()
    for shape in shapes:
        cells |= cells_of(shape)
    xs = [c[0] for c in cells]
    ys = [c[1] for c in cells]
    return [min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1]


CAMPS = [
    {
        "id": "l2_camp_1_shield_wall",
        "floor": 1,
        "rect": [130, 14, 30, 24],
        "entry_cell": [135, 24],
        "enemy_ids": [f"l2_c1_skeleton_0{i}" for i in range(1, 6)],
        "formation": "five_swordsmen_ring_the_cenotaph_from_four_quadrants",
        "breather_after": True,
    },
    {
        "id": "l2_camp_2_ring_pressure",
        "floor": 2,
        "rect": [120, 56, 26, 32],
        "entry_cell": [124, 60],
        "enemy_ids": [f"l2_c2_skeleton_0{i}" for i in range(1, 6)],
        "formation": "five_swordsmen_hold_the_east_neck_above_and_below_the_well",
        "breather_after": True,
    },
    {
        "id": "l2_camp_3_slalom",
        "floor": 3,
        "rect": [46, 108, 46, 16],
        "entry_cell": [47, 112],
        "enemy_ids": [f"l2_c3_skeleton_0{i}" for i in range(1, 6)],
        "formation": "five_swordsmen_weave_the_three_choir_lanes",
        "breather_after": True,
    },
]

SAFE_ZONES = [
    {"id": "l2_spawn_sanctuary", "rect": [5, 17, 25, 19],
     "purpose": "spawn_and_route_read"},
    {"id": "l2_floor_2_breather", "rect": [4, 57, 26, 23],
     "purpose": "checkpoint_after_cenotaph_camp"},
    {"id": "l2_floor_3_breather", "rect": [3, 100, 25, 23],
     "purpose": "checkpoint_before_the_choir"},
]

SPECIAL_ZONES = [
    {"id": "l2_choose_one_sigil_fork", "rect": [33, 5, 53, 42],
     "purpose": "two_risk_profiles_one_required_route"},
    {"id": "l2_bone_well_crossing", "rect": [60, 58, 46, 26],
     "purpose": "optional_island_crossings_over_the_shaft"},
]


def _clearance_ok(floor, cell, radius):
    x, y = cell
    if cell not in floor or (x, y - 1) not in floor:
        return False
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        for distance in range(1, radius + 1):
            if (x + dx * distance, y + dy * distance) not in floor:
                return False
    return True


def snap(floor, cell, predicate, max_radius=6):
    """Return the nearest cell (Manhattan ring order) satisfying ``predicate``."""
    if predicate(cell):
        return cell
    for radius in range(1, max_radius + 1):
        ring = []
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if abs(dx) + abs(dy) != radius:
                    continue
                ring.append((cell[0] + dx, cell[1] + dy))
        ring.sort()
        for candidate in ring:
            if predicate(candidate):
                return candidate
    return cell


def resolve_entities(floor, spikes):
    """Snap every authored marker onto a legal cell, preserving design intent."""
    camp_rects = {}
    for camp in CAMPS:
        x, y, w, h = camp["rect"]
        camp_rects[camp["id"]] = (x, y, w, h)
    entity_camp = {}
    for camp in CAMPS:
        for enemy_id in camp["enemy_ids"]:
            entity_camp[enemy_id] = camp["id"]

    resolved = {}
    adjustments = []
    for entity_id in ENTITY_ORDER:
        entity_type, cell, extra = ENTITIES[entity_id]
        if entity_type == "skeleton":
            radius = max(1, int(extra.get("patrol", 72)) // TILE)
            rect = camp_rects[entity_camp[entity_id]]

            def predicate(candidate, radius=radius, rect=rect):
                x, y, w, h = rect
                if not (x <= candidate[0] < x + w and y <= candidate[1] < y + h):
                    return False
                return _clearance_ok(floor, candidate, radius)
        elif entity_type in ("torch", "coin"):
            def predicate(candidate):
                return candidate in floor and (candidate[0], candidate[1] - 1) in floor
        elif entity_type in ("sigil", "chest", "checkpoint", "exit_gate", "player",
                             "floor_door"):
            def predicate(candidate):
                return (candidate in floor and (candidate[0], candidate[1] - 1) in floor
                        and candidate not in spikes)
        else:
            def predicate(candidate):
                return candidate in floor
        snapped = snap(floor, cell, predicate)
        if snapped != cell:
            adjustments.append((entity_id, cell, snapped))
        resolved[entity_id] = (entity_type, snapped, extra)
    return resolved, adjustments


def build_document():
    floor, solid = build_floor()
    spikes = {ENTITIES[f"l2_spikes_{i:02d}"][1] for i in range(1, 16)}
    resolved, adjustments = resolve_entities(floor, spikes)
    for entity_id, before, after in adjustments:
        print(f"snap {entity_id}: {before} -> {after}")
    entities = []
    for entity_id in ENTITY_ORDER:
        entity_type, cell, extra = resolved[entity_id]
        row = {"id": entity_id, "type": entity_type, "position": world(*cell)}
        row.update(extra)
        entities.append(row)
    return {
        "version": 2,
        "name": "Ngã Ba Cốt Trắng",
        "movement_mode": "top_down",
        "tile_size": TILE,
        "width": WIDTH,
        "height": HEIGHT,
        "layers": {
            "Backdrop": build_backdrop(floor),
            "Geometry": build_geometry(floor),
            "Decor": build_decor(floor, entities),
        },
        "entities": entities,
        "metadata": {
            "objective": (
                "Chọn Ledge of Relics hay Nave Ngập để lấy ấn ký, phá vòng "
                "Cenotaph rồi thu 3 trong 4 ấn ký để mở cổng thoát."
            ),
            "difficulty_tier": 2,
            "pacing": "route_choice_then_camp_then_ring_then_choir_with_recovery_landings",
            "density_cadence_anchor": world(50, 13),
            "roster_id": "chapter_1_level_2_roster",
            "encounter_pack_model": {
                "enabled": True,
                "profile_stage": 2,
                "floor_count": 3,
                "placement": "authored_camp_anchors",
                "authored_counts_are_anchors": True,
            },
            "required_sigils": 3,
            "camera_bounds": [0, 0, WIDTH * TILE, HEIGHT * TILE],
            "layout_profile": "three_floor_jawbone_fork_bone_well_choir",
            "tileset": "0x72 DungeonTileset II v1.7 (CC0)",
            "rooms": [
                {"id": room_id, "floor": floor_no, "role": role,
                 "rect": room_rect(shapes)}
                for (room_id, floor_no, role, shapes) in ROOM_SHAPES
            ],
            "combat_camps": CAMPS,
            "safe_zones": SAFE_ZONES,
            "special_zones": SPECIAL_ZONES,
        },
    }, floor, solid


def serialise(document):
    return json.dumps(document, ensure_ascii=False, indent=2) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--stats", action="store_true")
    args = parser.parse_args()
    document, floor, solid = build_document()
    text = serialise(document)
    if args.stats:
        print(f"floor {len(floor)} solid {len(solid)}")
        for name in ("Backdrop", "Geometry", "Decor"):
            print(name, len(document["layers"][name]))
    if args.check:
        current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
        if current != text:
            print("LEVEL 2 JSON OUT OF SYNC with the authoring spec", file=sys.stderr)
            return 1
        print("LEVEL 2 JSON matches the authoring spec")
        return 0
    OUTPUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)} ({len(text) // 1024} KiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
