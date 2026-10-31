#!/usr/bin/env python3
"""Original A1 regional art: eight unrepresented ecologies, one shared pixel language.

Extends the accepted first-hour atlas without repainting Crown/Amberwood/Frost.
All frames are original SOH-style pixel art (16px ground grid, unscaled props,
1px ink outline, feet anchor bottom-center). No third-party bytes are imported.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

import build_world_art as b
from build_world_art import C, T, ell, line, new, poly, px, rect, shadow

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "data/survival/world/art"

# Shared material ramps for the new regions (same ink/outline weight as pilot).
EXTRA_PALETTE = {
    "silt_d": "#4a4a3c", "silt": "#6b6a52", "silt_l": "#8c8a6a",
    "reedpeat_d": "#3c4636", "reedpeat": "#55624a", "reedpeat_l": "#758463",
    "lake_d": "#234a56", "lake": "#336273", "lake_l": "#5b8fa0", "lake_h": "#9fc6cf",
    "river_d": "#2b515c", "river": "#3d7180", "river_l": "#6fa0ac",
    "tidal_d": "#274a50", "tidal": "#3a666c", "tidal_l": "#679296",
    "mud_d": "#4c4234", "mud": "#6d5f48", "mud_l": "#91805f",
    "shell_d": "#8d8268", "shell": "#b3a684", "shell_l": "#d8cba4",
    "dune_d": "#9a7c4e", "dune": "#c0a066", "dune_l": "#ddc28a",
    "salt_d": "#8f897a", "salt": "#b8b29d", "salt_l": "#ded8c4",
    "sulfur_d": "#8a7a2e", "sulfur": "#c2ad45", "sulfur_l": "#e6d67a",
    "cinder_d": "#3a2f2c", "cinder": "#5a463f", "cinder_l": "#7d6052",
    "lava_d": "#2c2729", "lava": "#453c40", "lava_l": "#655459",
    "jungle_d": "#2c4a2e", "jungle": "#416b39", "jungle_l": "#659248", "jungle_h": "#8fb85e",
    "karst_d": "#6a6a58", "karst": "#93927a", "karst_l": "#bcbaa0",
    "mangrove_d": "#33453a", "mangrove": "#4b6350", "mangrove_l": "#6d8a68",
    "cenote_d": "#173a46", "cenote": "#24586a", "cenote_l": "#3f8296", "cenote_h": "#7fc0cf",
    "fen_d": "#2f3a30", "fen": "#46543f", "fen_l": "#657554",
    "toxic_d": "#3a4a36", "toxic": "#5a6b41", "toxic_l": "#8a9a58",
    "rust_d": "#5a3226", "rust": "#8a4d33", "rust_l": "#b9744a",
    "plaster_d": "#9c8a66", "plaster": "#c9b78d", "plaster_l": "#e8d8ae",
    "tile_blue_d": "#2e4a5c", "tile_blue": "#41687e", "tile_blue_l": "#6d94a8",
    "ore_d": "#6f4a30",
    "brine_d": "#5f9a94", "brine": "#8fc4bd", "brine_l": "#d6eee2", "brine_h": "#f4fbf2",
    "moss_d": "#3f5a35", "moss": "#5f7d43", "moss_l": "#8fa85c",
    "rope": "#b49a6a", "rope_d": "#7a6544", "lamp_glow": "#ffd98a",
}
b.P.update(EXTRA_PALETTE)

WATER_STYLES = {"lake", "river", "tidal", "cenote", "ocean", "water"}
NEW_MATERIALS = ["silt", "reedpeat", "lake", "river", "tidal", "mud", "shell", "dune",
                 "salt", "sulfur", "cinder", "lava", "jungle", "karst", "mangrove",
                 "cenote", "fen", "toxic", "brine"]


def mat_tile(style: str, v: int) -> Image.Image:
    """Calm base material with non-periodic micro-relief.

    Large readable features are authored as clusters/props, not repeated on
    every 16px tile. Variants break the 4-tile grid without material confetti.
    """
    im = new(T, T)
    dk, md, hi = C(style + "_d"), C(style), C(style + "_l")
    rect(im, 0, 0, T, T, md)
    if style in WATER_STYLES or style == "brine":
        # Offset wavelets; no full-width corduroy. Brine is non-walkable pan water.
        yy = (3, 9, 12, 6)[v % 4]
        xx = (2, 8, 5, 11)[v % 4]
        line(im, [(xx, yy), (xx + 3, yy), (xx + 5, yy + 1)], hi)
        if v % 2 == 0:
            line(im, [(1, 12 - v), (4, 12 - v)], dk)
        px(im, (12 + v) % 15, (5 + v * 3) % 14, C(style + "_h") if style + "_h" in b.P else hi)
        if style == "brine":
            px(im, 3 + v, 3, C("salt_l")); px(im, 12 - v, 13, C("salt"))
        return im
    # Subtle tone patches shared by all variants, offset by v.
    ox, oy = (v * 5) % 11, (v * 7) % 11
    ell(im, ox, oy, 5, 3, dk if v % 2 else hi)
    if v == 0:
        if style == "salt":
            line(im, [(3, 5), (7, 3), (11, 6)], dk); line(im, [(9, 11), (13, 9)], dk); px(im, 6, 7, hi)
        elif style in ("cinder", "lava"):
            ell(im, 3, 4, 5, 3, hi if style == "cinder" else dk); ell(im, 9, 10, 4, 2, dk)
            if style == "lava": line(im, [(4, 8), (8, 9), (12, 7)], C("rust_d"))
        elif style in ("jungle", "mangrove", "fen", "reedpeat"):
            for x, y in ((4, 5), (10, 10)):
                line(im, [(x, y), (x + 2, y - 1)], hi); px(im, x + 1, y + 1, dk)
            if style == "fen": ell(im, 8, 3, 4, 2, dk)
        elif style == "karst":
            line(im, [(2, 6), (6, 4), (10, 7)], dk); line(im, [(4, 11), (8, 12), (12, 10)], hi)
        elif style in ("dune", "shell"):
            line(im, [(3, 6), (7, 5), (11, 6)], hi); line(im, [(5, 11), (9, 10)], hi)
            if style == "shell": px(im, 4, 8, C("canvas_l"))
        elif style == "mud":
            line(im, [(3, 7), (7, 6), (11, 8)], hi); ell(im, 9, 10, 4, 2, dk)
        elif style == "sulfur":
            ell(im, 4, 5, 5, 3, hi); ell(im, 9, 9, 4, 3, dk)
        elif style == "toxic":
            ell(im, 4, 5, 6, 4, dk); px(im, 7, 6, hi)
        else:
            line(im, [(3, 6), (7, 5), (10, 7)], hi); line(im, [(5, 11), (9, 12)], dk)
    elif v == 1:
        px(im, 5, 6, hi); px(im, 12, 11, dk)
    elif v == 2:
        line(im, [(9, 4), (12, 5)], hi if style not in ("lava", "toxic") else dk)
    else:
        px(im, 3, 12, dk); px(im, 13, 3, hi)
    return im


def mix_tile(a: Image.Image, c: Image.Image, mask: int) -> Image.Image:
    im = a.copy()
    bands = {1: [(x, 0) for x in range(16)], 2: [(15, y) for y in range(16)],
             4: [(x, 15) for x in range(16)], 8: [(0, y) for y in range(16)]}
    for bit, pts in bands.items():
        if not mask & bit:
            continue
        for x, y in pts:
            im.putpixel((x, y), c.getpixel((x, y)))
            if bit == 1 and (x // 2) % 2 == 0: im.putpixel((x, 1), c.getpixel((x, 1)))
            if bit == 4 and (x // 2) % 2 == 1: im.putpixel((x, 14), c.getpixel((x, 14)))
            if bit == 8 and (y // 2) % 2 == 0: im.putpixel((1, y), c.getpixel((1, y)))
            if bit == 2 and (y // 2) % 2 == 1: im.putpixel((14, y), c.getpixel((14, y)))
    return im


def coast_tile(land: Image.Image, water: Image.Image, mask: int) -> Image.Image:
    im = mix_tile(land, water, mask)
    foam = C("lake_l")
    if mask & 1:
        for x in range(2, 14, 5): px(im, x, 2, foam)
    if mask & 4:
        for x in range(3, 14, 5): px(im, x, 13, foam)
    if mask & 8:
        for y in range(2, 14, 5): px(im, 2, y, foam)
    if mask & 2:
        for y in range(3, 14, 5): px(im, 13, y, foam)
    return im


def boardwalk(orient: str) -> Image.Image:
    im = new(T, T)
    if orient in ("ns", "junction"):
        rect(im, 3, 0, 10, 16, C("wood_d"))
        for y in range(0, 16, 3): rect(im, 4, y, 8, 2, C("wood"))
        line(im, [(4, 0), (4, 15)], C("wood_l")); line(im, [(11, 0), (11, 15)], C("wood_d"))
    if orient in ("ew", "junction"):
        rect(im, 0, 3, 16, 10, C("wood_d"))
        for x in range(0, 16, 3): rect(im, x, 4, 2, 8, C("wood"))
        line(im, [(0, 4), (15, 4)], C("wood_l")); line(im, [(0, 11), (15, 11)], C("wood_d"))
    return im


def causeway(orient: str) -> Image.Image:
    im = new(T, T)
    if orient == "ns": rect(im, 2, 0, 12, 16, C("stone_d")); rect(im, 3, 0, 10, 16, C("stone"))
    else: rect(im, 0, 2, 16, 12, C("stone_d")); rect(im, 0, 3, 16, 10, C("stone"))
    for i in range(0, 16, 4):
        if orient == "ns": line(im, [(3, i), (12, i)], C("stone_d"))
        else: line(im, [(i, 3), (i, 12)], C("stone_d"))
    return im


# ---- props ---------------------------------------------------------------

def reed_clump() -> Image.Image:
    im = new(20, 22)
    for x, h in [(3, 16), (7, 20), (11, 14), (15, 18)]:
        line(im, [(x, 21), (x - 1, 21 - h)], C("reedpeat_l"))
        rect(im, x - 2, 20 - h, 2, 4, C("wood_l"))
    return im


def mangrove_root() -> Image.Image:
    im = new(30, 26); shadow(im, 26, 5)
    for x in (6, 14, 22):
        line(im, [(x, 2), (x - 3, 14), (x - 5, 24)], C("wood_d"), 2)
        line(im, [(x, 2), (x + 3, 14), (x + 5, 24)], C("wood_d"), 2)
    ell(im, 4, 0, 22, 10, C("mangrove")); ell(im, 7, 1, 16, 7, C("mangrove_l"))
    return im


def palm() -> Image.Image:
    im = new(34, 40); shadow(im, 28, 6)
    line(im, [(17, 38), (16, 14)], C("wood_d"), 3); line(im, [(17, 38), (16, 14)], C("wood"), 1)
    for dx, dy in [(-14, -4), (14, -4), (-10, -10), (10, -10), (0, -12)]:
        line(im, [(16, 14), (16 + dx, 14 + dy)], C("leaf"), 2)
        line(im, [(16, 14), (16 + dx, 14 + dy)], C("leaf_l"), 1)
    return im


def jungle_canopy() -> Image.Image:
    im = new(44, 40); shadow(im, 38, 7)
    rect(im, 20, 24, 4, 14, C("wood_d"))
    ell(im, 2, 6, 40, 24, C("jungle_d")); ell(im, 5, 4, 34, 22, C("jungle"))
    ell(im, 9, 6, 24, 16, C("jungle_l")); ell(im, 14, 8, 12, 8, C("jungle_h"))
    return im


def karst_pinnacle() -> Image.Image:
    im = new(26, 40); shadow(im, 22, 6)
    poly(im, [(4, 38), (8, 10), (13, 2), (18, 12), (22, 38)], C("karst_d"))
    poly(im, [(7, 36), (10, 12), (13, 6), (16, 14), (19, 36)], C("karst"))
    line(im, [(13, 6), (13, 36)], C("karst_l"))
    ell(im, 6, 30, 14, 6, C("jungle"))
    return im


def driftwood() -> Image.Image:
    im = new(30, 12); shadow(im, 26, 4)
    line(im, [(2, 8), (28, 6)], C("wood_d"), 3); line(im, [(2, 8), (28, 6)], C("canvas_d"), 1)
    line(im, [(10, 7), (14, 2)], C("wood_d"), 2)
    return im


def resource(kind: str) -> Image.Image:
    im = new(22, 18); shadow(im, 18, 4)
    if kind in ("silica_placer", "salt_crust_prop", "clay_lens", "peat_cut"):
        col = {"silica_placer": "shell", "salt_crust_prop": "salt", "clay_lens": "silt", "peat_cut": "fen"}[kind]
        ell(im, 3, 8, 16, 8, C(col + "_d")); ell(im, 4, 7, 14, 7, C(col)); px(im, 8, 9, C(col + "_l"))
    elif kind in ("storm_glass", "obsidian_shard"):
        poly(im, [(6, 16), (9, 3), (12, 16)], C("ice_d")); poly(im, [(8, 15), (10, 5), (11, 15)], C("ice_l"))
        poly(im, [(12, 16), (15, 7), (17, 16)], C("soul_d"))
    elif kind in ("sulfur_vent", "gas_vent"):
        ell(im, 4, 9, 14, 7, C("sulfur_d")); ell(im, 6, 8, 10, 6, C("sulfur")); px(im, 10, 9, C("sulfur_l"))
        px(im, 10, 4, (220, 220, 180, 120)); px(im, 12, 2, (220, 220, 180, 80))
    elif kind in ("copper_vein", "bog_iron", "basalt_chunk", "limestone_chunk"):
        col = {"copper_vein": "ore", "bog_iron": "rust", "basalt_chunk": "basalt", "limestone_chunk": "karst"}[kind]
        poly(im, [(3, 15), (6, 6), (14, 4), (19, 12), (16, 16)], C(col + "_d"))
        poly(im, [(5, 14), (8, 7), (14, 6), (17, 12)], C(col)); px(im, 10, 8, C(col + "_l"))
    elif kind in ("pearl_bed", "freshwater_pearl", "abyssal_pearl"):
        ell(im, 3, 9, 16, 7, C("shell_d")); ell(im, 4, 8, 14, 6, C("shell"))
        c = C("soul_l") if kind == "abyssal_pearl" else C("canvas_l")
        ell(im, 9, 9, 4, 4, c); px(im, 10, 10, C("snow_h"))
    elif kind in ("venom_sac", "fen_venom", "spore_cluster"):
        line(im, [(11, 16), (11, 8)], C("leaf_d"))
        ell(im, 6, 4, 10, 9, C("cloth_d")); ell(im, 7, 5, 8, 7, C("cloth")); px(im, 9, 6, C("cloth_l"))
    elif kind in ("hardwood_log", "rubber_tap"):
        rect(im, 3, 9, 16, 7, C("wood_d")); rect(im, 4, 10, 14, 5, C("wood"))
        ell(im, 16, 9, 4, 7, C("wood_l"))
        if kind == "rubber_tap": rect(im, 8, 12, 3, 4, C("canvas"))
    elif kind in ("reed_bundle",):
        for x in (6, 10, 14): line(im, [(x, 16), (x, 4)], C("reedpeat_l"))
        rect(im, 5, 10, 12, 2, C("wood_d"))
    elif kind in ("karst_herb",):
        for x, y in [(6, 10), (11, 7), (15, 11)]:
            line(im, [(x, 16), (x, y)], C("herb")); ell(im, x - 2, y - 2, 4, 3, C("herb_l"))
    return im


def hazard(kind: str) -> Image.Image:
    im = new(24, 20)
    if kind == "bleached_reeds":
        for x, h in [(4, 14), (9, 18), (14, 12), (19, 16)]:
            line(im, [(x, 19), (x - 1, 19 - h)], C("canvas_l"))
    elif kind == "tide_gauge":
        rect(im, 10, 2, 3, 17, C("wood_d"))
        for y in (4, 8, 12): rect(im, 10, y, 3, 1, C("canvas_l"))
        rect(im, 8, 14, 7, 2, C("tidal_l"))
    elif kind == "cenote_rim":
        ell(im, 2, 6, 20, 12, C("karst_d")); ell(im, 5, 8, 14, 8, C("cenote_d"))
    elif kind == "toxic_pool_edge":
        ell(im, 2, 8, 20, 10, C("toxic_d")); ell(im, 4, 9, 16, 8, C("toxic")); px(im, 9, 11, C("sulfur"))
    elif kind == "sulfur_crust":
        ell(im, 3, 9, 18, 9, C("sulfur_d")); ell(im, 5, 8, 14, 7, C("sulfur"))
    else:
        return resource(kind)
    return im


def _building_base(w, h):
    im = new(w, h); shadow(im, w - 12, 8)
    return im


def lm_mere_boathouse() -> Image.Image:
    im = _building_base(128, 96)
    for x in (14, 44, 84, 112): rect(im, x, 66, 5, 26, C("wood_d"))
    rect(im, 8, 60, 112, 10, C("wood_d")); rect(im, 10, 61, 108, 8, C("wood"))
    for x in range(12, 116, 6): line(im, [(x, 61), (x, 68)], C("wood_d"))
    rect(im, 24, 30, 76, 32, C("wood_d")); rect(im, 26, 32, 72, 28, C("canvas_d"))
    poly(im, [(16, 32), (62, 8), (108, 32)], C("reedpeat_d")); poly(im, [(20, 30), (62, 12), (104, 30)], C("reedpeat"))
    for x in range(28, 96, 10): line(im, [(x, 30), (x + 6, 14)], C("reedpeat_l"))
    rect(im, 52, 42, 18, 20, C("ink")); rect(im, 54, 44, 14, 16, C("wood_l"))
    rect(im, 32, 38, 12, 10, C("lake_d")); rect(im, 80, 38, 12, 10, C("lake_d"))
    rect(im, 100, 44, 16, 18, C("wood_d")); rect(im, 102, 46, 12, 14, C("net_rack") if "net_rack" in b.P else C("canvas_d"))
    poly(im, [(84, 84), (122, 84), (114, 92), (90, 92)], C("wood_d")); line(im, [(88, 85), (118, 85)], C("wood_l"))
    rect(im, 12, 52, 8, 10, C("iron_d")); rect(im, 13, 53, 6, 8, C("lamp_glow"))
    return im


def lm_mere_causeway() -> Image.Image:
    im = _building_base(112, 72)
    rect(im, 6, 48, 100, 18, C("stone_d")); rect(im, 8, 49, 96, 16, C("stone"))
    for x in range(10, 104, 9):
        line(im, [(x, 49), (x, 64)], C("stone_d")); px(im, x + 2, 52, C("stone_l"))
    ell(im, 18, 58, 14, 6, C("moss")); ell(im, 78, 50, 12, 5, C("moss"))
    for x in (14, 94):
        rect(im, x, 20, 10, 30, C("stone_d")); rect(im, x + 1, 21, 8, 28, C("stone"))
        rect(im, x - 2, 16, 14, 6, C("stone_d")); rect(im, x - 1, 17, 12, 4, C("stone_l"))
    rect(im, 24, 28, 64, 8, C("stone_d")); rect(im, 26, 29, 60, 6, C("stone"))
    rect(im, 48, 36, 16, 18, C("ink_soft")); rect(im, 50, 38, 12, 14, C("lake_d"))
    rect(im, 8, 40, 6, 10, C("iron_d")); rect(im, 9, 41, 4, 8, C("lamp_glow"))
    return im


def lm_glasswind_light() -> Image.Image:
    im = _building_base(80, 128)
    poly(im, [(22, 124), (28, 36), (52, 36), (58, 124)], C("stone_d"))
    poly(im, [(25, 122), (30, 38), (50, 38), (55, 122)], C("stone"))
    for y in (50, 70, 90): rect(im, 30, y, 20, 4, C("cloth_d")); rect(im, 31, y + 1, 18, 2, C("cloth"))
    rect(im, 24, 24, 32, 14, C("iron_d")); rect(im, 28, 27, 24, 8, C("fire")); px(im, 34, 28, C("fire_l"))
    poly(im, [(20, 24), (40, 6), (60, 24)], C("cloth_d")); poly(im, [(24, 22), (40, 10), (56, 22)], C("cloth"))
    rect(im, 14, 108, 52, 16, C("stone_d")); rect(im, 16, 109, 48, 14, C("stone"))
    rect(im, 34, 112, 12, 12, C("ink")); rect(im, 18, 112, 10, 8, C("tidal_d")); rect(im, 52, 112, 10, 8, C("tidal_d"))
    rect(im, 60, 92, 16, 24, C("plaster_d")); rect(im, 62, 94, 12, 20, C("plaster")); poly(im, [(58, 94), (68, 84), (78, 94)], C("tile_blue_d"))
    rect(im, 10, 100, 8, 12, C("iron_d")); rect(im, 11, 101, 6, 10, C("lamp_glow"))
    return im


def lm_ember_forge() -> Image.Image:
    im = _building_base(160, 120)
    rect(im, 10, 56, 140, 58, C("lava_d")); rect(im, 12, 58, 136, 54, C("cinder"))
    poly(im, [(10, 56), (40, 28), (70, 56), (100, 28), (130, 56)], C("iron_d"))
    poly(im, [(14, 54), (40, 32), (66, 54)], C("iron")); poly(im, [(74, 54), (100, 32), (126, 54)], C("iron"))
    rect(im, 124, 8, 18, 52, C("rust_d")); rect(im, 126, 9, 14, 50, C("rust")); rect(im, 122, 4, 22, 6, C("iron_d"))
    for y in (18, 34, 50): rect(im, 124, y, 18, 3, C("iron_d"))
    rect(im, 26, 76, 26, 34, C("ink")); rect(im, 28, 78, 22, 30, C("fire_d")); rect(im, 31, 84, 16, 22, C("fire")); px(im, 36, 90, C("fire_l"))
    rect(im, 66, 78, 18, 18, C("iron_d")); rect(im, 68, 80, 14, 14, C("fire_l"))
    rect(im, 96, 84, 34, 24, C("iron_d")); rect(im, 98, 86, 30, 20, C("iron"))
    rect(im, 16, 104, 128, 8, C("stone_d")); rect(im, 18, 105, 124, 6, C("stone"))
    rect(im, 8, 68, 10, 28, C("iron_d")); rect(im, 9, 69, 8, 26, C("rust"))
    rect(im, 140, 70, 12, 30, C("iron_d")); rect(im, 141, 71, 10, 28, C("iron"))
    line(im, [(18, 72), (40, 72), (40, 84)], C("iron_d"), 3); line(im, [(18, 72), (40, 72), (40, 84)], C("iron"), 1)
    ell(im, 4, 108, 20, 8, C("ink_soft")); ell(im, 136, 108, 20, 8, C("ink_soft"))
    rect(im, 58, 62, 8, 10, C("iron_d")); rect(im, 59, 63, 6, 8, C("lamp_glow"))
    return im


def lm_saffron_salt_works() -> Image.Image:
    im = _building_base(144, 96)
    rect(im, 12, 52, 120, 36, C("plaster_d")); rect(im, 14, 54, 116, 32, C("plaster"))
    rect(im, 8, 44, 128, 10, C("plaster_d")); rect(im, 10, 45, 124, 7, C("plaster_l"))
    for x in (24, 56, 88): rect(im, x, 64, 14, 20, C("ink_soft")); rect(im, x + 2, 66, 10, 16, C("tidal_d"))
    poly(im, [(72, 44), (104, 20), (136, 44)], C("tile_blue_d")); poly(im, [(76, 42), (104, 24), (132, 42)], C("tile_blue"))
    rect(im, 18, 72, 28, 14, C("salt_d")); rect(im, 20, 73, 24, 12, C("salt_l"))
    line(im, [(54, 86), (66, 56)], C("wood_d"), 2); rect(im, 64, 54, 8, 4, C("iron"))
    rect(im, 112, 68, 20, 18, C("wood_d")); rect(im, 114, 70, 16, 14, C("canvas_d"))
    poly(im, [(4, 58), (34, 48), (64, 58), (34, 66)], C("cloth_d")); poly(im, [(8, 58), (34, 51), (60, 58), (34, 64)], C("cloth"))
    rect(im, 8, 58, 3, 28, C("wood_d")); rect(im, 58, 58, 3, 28, C("wood_d"))
    rect(im, 126, 48, 8, 12, C("iron_d")); rect(im, 127, 49, 6, 10, C("lamp_glow"))
    return im


def lm_verdant_temple() -> Image.Image:
    im = _building_base(144, 120)
    for x, y, w in [(10, 96, 124), (22, 76, 100), (34, 56, 76), (46, 36, 52)]:
        rect(im, x, y, w, 18, C("karst_d")); rect(im, x + 2, y + 1, w - 4, 16, C("karst"))
        for xx in range(x + 6, x + w - 4, 12): line(im, [(xx, y + 1), (xx, y + 16)], C("karst_d"))
        ell(im, x + 4, y + 12, 14, 5, C("moss"))
    rect(im, 56, 16, 32, 22, C("karst_d")); rect(im, 58, 18, 28, 18, C("karst_l")); rect(im, 66, 24, 12, 14, C("ink"))
    line(im, [(26, 96), (38, 56), (32, 24)], C("wood_d"), 3); line(im, [(118, 96), (106, 58), (112, 26)], C("wood_d"), 3)
    for x, y in ((20, 88), (112, 84), (40, 48), (96, 44)):
        ell(im, x, y, 22, 12, C("jungle_d")); ell(im, x + 3, y + 2, 16, 8, C("jungle")); ell(im, x + 6, y + 3, 8, 4, C("jungle_l"))
    for x in (44, 72, 100):
        line(im, [(x, 36), (x + 3, 60), (x - 2, 84)], C("leaf_d"), 2)
    rect(im, 64, 80, 16, 16, C("ink")); rect(im, 66, 82, 12, 12, C("toxic_d"))
    rect(im, 12, 84, 8, 12, C("iron_d")); rect(im, 13, 85, 6, 10, C("lamp_glow"))
    return im


def lm_pearl_customs() -> Image.Image:
    im = _building_base(144, 112)
    for x in (16, 48, 96, 128): rect(im, x, 76, 5, 32, C("wood_d"))
    rect(im, 8, 68, 128, 12, C("wood_d")); rect(im, 10, 69, 124, 10, C("wood"))
    for x in range(12, 132, 6): line(im, [(x, 69), (x, 78)], C("wood_d"))
    rect(im, 24, 32, 96, 38, C("wood_d")); rect(im, 26, 34, 92, 34, C("canvas_d"))
    for x in range(28, 116, 12): line(im, [(x, 34), (x, 68)], C("wood_d"))
    poly(im, [(14, 34), (72, 8), (130, 34)], C("tile_blue_d")); poly(im, [(18, 32), (72, 12), (126, 32)], C("tile_blue"))
    for x in range(26, 118, 10): line(im, [(x, 30), (x + 5, 16)], C("tile_blue_l"))
    rect(im, 62, 46, 20, 24, C("ink")); rect(im, 64, 48, 16, 20, C("wood_l"))
    rect(im, 34, 42, 14, 12, C("tidal_d")); rect(im, 96, 42, 14, 12, C("tidal_d"))
    rect(im, 36, 44, 10, 8, C("tidal_l")); rect(im, 98, 44, 10, 8, C("tidal_l"))
    rect(im, 112, 52, 20, 18, C("wood_d")); rect(im, 114, 54, 16, 14, C("canvas_d"))
    line(im, [(122, 52), (122, 30), (136, 30)], C("wood_d"), 2); line(im, [(136, 30), (136, 44)], C("rope"))
    rect(im, 10, 56, 8, 12, C("iron_d")); rect(im, 11, 57, 6, 10, C("lamp_glow"))
    rect(im, 126, 56, 8, 12, C("iron_d")); rect(im, 127, 57, 6, 10, C("lamp_glow"))
    rect(im, 48, 80, 48, 6, C("wood_d")); rect(im, 50, 81, 44, 4, C("wood"))
    return im


def lm_sunken_cenote() -> Image.Image:
    im = _building_base(128, 96)
    ell(im, 8, 36, 112, 52, C("karst_d")); ell(im, 14, 40, 100, 44, C("cenote_d")); ell(im, 22, 46, 84, 32, C("cenote"))
    ell(im, 34, 52, 56, 20, C("cenote_l")); px(im, 58, 58, C("cenote_h"))
    for i, (x, y, w) in enumerate([(18, 72, 92), (28, 64, 72), (38, 56, 52)]):
        rect(im, x, y, w, 6, C("karst_d")); rect(im, x + 1, y + 1, w - 2, 4, C("karst"))
    rect(im, 48, 10, 32, 28, C("karst_d")); rect(im, 50, 12, 28, 24, C("karst_l")); rect(im, 58, 18, 12, 18, C("ink"))
    line(im, [(18, 58), (30, 52)], C("jungle_l")); line(im, [(98, 62), (112, 56)], C("jungle_l"))
    ell(im, 12, 30, 24, 12, C("jungle")); ell(im, 92, 28, 26, 14, C("jungle"))
    rect(im, 104, 44, 8, 12, C("iron_d")); rect(im, 105, 45, 6, 10, C("lamp_glow"))
    return im


def lm_ashwater_pump() -> Image.Image:
    im = _building_base(144, 112)
    for x in (16, 64, 120): rect(im, x, 76, 5, 32, C("wood_d"))
    rect(im, 8, 68, 128, 12, C("wood_d")); rect(im, 10, 69, 124, 10, C("wood"))
    rect(im, 24, 34, 80, 36, C("iron_d")); rect(im, 26, 36, 76, 32, C("rust"))
    poly(im, [(16, 36), (64, 10), (112, 36)], C("iron_d")); poly(im, [(20, 34), (64, 14), (108, 34)], C("iron"))
    rect(im, 52, 46, 22, 24, C("ink")); rect(im, 54, 48, 18, 20, C("toxic_l"))
    rect(im, 96, 16, 12, 54, C("iron_d")); rect(im, 98, 18, 8, 50, C("iron")); rect(im, 94, 12, 16, 6, C("rust_d"))
    rect(im, 112, 44, 24, 32, C("iron_d")); rect(im, 114, 46, 20, 28, C("iron")); ell(im, 112, 38, 24, 10, C("iron_d"))
    line(im, [(26, 60), (10, 60), (10, 84)], C("iron_d"), 4); line(im, [(26, 60), (10, 60), (10, 84)], C("iron"), 2)
    line(im, [(104, 60), (124, 60), (124, 76)], C("iron_d"), 4); line(im, [(104, 60), (124, 60), (124, 76)], C("iron"), 2)
    ell(im, 28, 80, 24, 12, C("toxic_d")); ell(im, 32, 82, 16, 8, C("toxic_l"))
    rect(im, 12, 52, 8, 12, C("iron_d")); rect(im, 13, 53, 6, 10, C("lamp_glow"))
    rect(im, 128, 52, 8, 12, C("iron_d")); rect(im, 129, 53, 6, 10, C("lamp_glow"))
    for x in (36, 84): rect(im, x, 70, 12, 4, C("sulfur")); rect(im, x + 2, 71, 8, 2, C("ink_soft"))
    return im


def small_struct(kind: str) -> Image.Image:
    im = new(24, 24)
    if kind in ("mooring_post", "boardwalk_post"):
        rect(im, 10, 4, 4, 18, C("wood_d")); rect(im, 9, 3, 6, 3, C("wood_l"))
    elif kind == "net_rack":
        rect(im, 3, 4, 2, 18, C("wood_d")); rect(im, 19, 4, 2, 18, C("wood_d"))
        for y in (6, 10, 14): line(im, [(5, y), (19, y)], C("canvas_d"))
    elif kind == "salt_rake":
        line(im, [(6, 20), (16, 4)], C("wood_d"), 2); rect(im, 13, 3, 8, 3, C("iron"))
    elif kind == "sluice_gate":
        rect(im, 3, 6, 18, 14, C("wood_d")); rect(im, 5, 8, 14, 10, C("wood"))
        rect(im, 10, 2, 4, 6, C("iron_d"))
    elif kind == "pump_pipe":
        rect(im, 4, 10, 16, 6, C("iron_d")); rect(im, 5, 11, 14, 4, C("iron")); rect(im, 16, 4, 4, 8, C("iron_d"))
    elif kind == "chimney_stack":
        rect(im, 8, 2, 8, 20, C("rust_d")); rect(im, 9, 3, 6, 18, C("rust")); rect(im, 7, 1, 10, 3, C("iron_d"))
    elif kind == "awning":
        poly(im, [(2, 10), (12, 3), (22, 10)], C("cloth_d")); poly(im, [(4, 9), (12, 5), (20, 9)], C("cloth"))
        rect(im, 4, 10, 2, 12, C("wood_d")); rect(im, 18, 10, 2, 12, C("wood_d"))
    elif kind == "salt_windbreak":
        rect(im, 2, 8, 20, 10, C("stone_d")); rect(im, 3, 9, 18, 8, C("stone"))
    elif kind == "tidal_wrack":
        line(im, [(2, 14), (22, 12)], C("wood_d")); px(im, 8, 13, C("shell")); px(im, 15, 12, C("mangrove_l"))
    elif kind == "bog_pool":
        ell(im, 2, 8, 20, 12, C("fen_d")); ell(im, 4, 9, 16, 10, C("toxic_d"))
    elif kind == "cenote_pool":
        ell(im, 2, 6, 20, 14, C("cenote_d")); ell(im, 4, 8, 16, 10, C("cenote"))
    elif kind == "shell_bar":
        ell(im, 2, 10, 20, 8, C("shell_d")); ell(im, 3, 9, 18, 7, C("shell"))
    elif kind == "cinder_cone":
        poly(im, [(3, 20), (12, 4), (21, 20)], C("cinder_d")); poly(im, [(6, 19), (12, 7), (18, 19)], C("cinder"))
    elif kind == "fen_snag":
        line(im, [(12, 22), (11, 4)], C("wood_d"), 2); line(im, [(11, 10), (6, 6)], C("wood_d")); line(im, [(11, 14), (17, 10)], C("wood_d"))
    elif kind == "liana":
        line(im, [(6, 2), (10, 10), (8, 20)], C("leaf_d"), 2); line(im, [(16, 2), (13, 12), (16, 22)], C("leaf"), 2)
    elif kind == "stilt_walk":
        rect(im, 2, 8, 20, 6, C("wood_d")); rect(im, 3, 9, 18, 4, C("wood"))
        rect(im, 4, 14, 2, 8, C("wood_d")); rect(im, 18, 14, 2, 8, C("wood_d"))
    elif kind == "causeway_stone":
        rect(im, 2, 8, 20, 10, C("stone_d")); rect(im, 3, 9, 18, 8, C("stone"))
        for x in (7, 12, 17): line(im, [(x, 9), (x, 16)], C("stone_d"))
    elif kind == "rope_bridge":
        rect(im, 2, 9, 20, 6, C("wood_d"))
        for x in range(3, 21, 3): rect(im, x, 10, 2, 4, C("wood"))
        line(im, [(2, 7), (22, 7)], C("canvas_d")); line(im, [(2, 17), (22, 17)], C("canvas_d"))
    elif kind == "boardwalk":
        rect(im, 2, 6, 20, 12, C("wood_d"))
        for y in range(7, 17, 3): rect(im, 3, y, 18, 2, C("wood"))
    elif kind == "heat_shimmer":
        for x in (6, 12, 18): line(im, [(x, 18), (x - 1, 10), (x + 1, 4)], (230, 220, 190, 90))
    return im


# ---- shared regional production grammar: narrow piers, worn tracks, decals ----

def _fade(im: Image.Image, alpha: int) -> Image.Image:
    a = im.getchannel("A").point(lambda v: v * alpha // 255)
    im.putalpha(a)
    return im


def track_decal(mask: int, stone: bool = False) -> Image.Image:
    """Transparent wear, not an opaque plank carpet. Mask 15 is a worn clearing."""
    im = new(T, T)
    dk = C("stone_d" if stone else "soil_d")
    hi = C("stone_l" if stone else "soil_l")
    # Broken, low-contrast wear only. No continuous crosshatch/corduroy.
    if mask == 15:
        for x, y in ((4, 5), (11, 4), (5, 11), (12, 12), (8, 8)):
            px(im, x, y, dk); px(im, x + 1, y, hi)
    else:
        if mask & 1:
            px(im, 6, 2, dk); px(im, 10, 4, hi)
        if mask & 4:
            px(im, 6, 12, dk); px(im, 10, 14, hi)
        if mask & 2:
            px(im, 12, 6, dk); px(im, 14, 10, hi)
        if mask & 8:
            px(im, 2, 6, dk); px(im, 4, 10, hi)
        if mask in (3, 12, 5, 10, 7, 11, 13, 14):
            px(im, 7, 7, hi); px(im, 8, 8, dk)
    return _fade(im, 85)


def pier_tile(orient: str, variant: int = 0) -> Image.Image:
    im = new(T, T)
    wd, wd_l = C("wood_d"), C("wood_l")
    wood = C("wood") if variant % 3 else C("canvas_d")
    def ns():
        rect(im, 3, 0, 10, 16, wd)
        for y in range(0, 16, 4):
            rect(im, 4, y, 8, 3, wood if (y // 4 + variant) % 3 else wd_l)
            px(im, 5, y + 1, wd); px(im, 10, y + 1, wd)
        line(im, [(3, 0), (3, 15)], wd_l); line(im, [(12, 0), (12, 15)], wd)
    def ew():
        rect(im, 0, 3, 16, 10, wd)
        for x in range(0, 16, 4):
            rect(im, x, 4, 3, 8, wood if (x // 4 + variant) % 3 else wd_l)
            px(im, x + 1, 5, wd); px(im, x + 1, 10, wd)
        line(im, [(0, 3), (15, 3)], wd_l); line(im, [(0, 12), (15, 12)], wd)
    if orient in ("ns", "junction", "end_n", "end_s"): ns()
    if orient in ("ew", "junction", "end_e", "end_w"): ew()
    if orient == "end_n": rect(im, 3, 0, 10, 2, wd_l)
    if orient == "end_s": rect(im, 3, 14, 10, 2, wd_l)
    if orient == "end_e": rect(im, 14, 3, 2, 10, wd_l)
    if orient == "end_w": rect(im, 0, 3, 2, 10, wd_l)
    return im


def causeway_tile(orient: str, variant: int = 0) -> Image.Image:
    im = new(T, T)
    sd, st, sl = C("stone_d"), C("stone"), C("stone_l")
    if orient == "ns":
        rect(im, 2, 0, 12, 16, sd); rect(im, 3, 0, 10, 16, st)
        for y in range(0, 16, 5):
            line(im, [(3, y + variant % 2), (12, y + variant % 2)], sd)
            px(im, 4 + (y + variant) % 7, y + 1, sl)
        if variant % 2: line(im, [(5, 2), (7, 6), (6, 10)], sd)
        if variant == 3: ell(im, 3, 10, 4, 3, C("moss"))
    else:
        rect(im, 0, 2, 16, 12, sd); rect(im, 0, 3, 16, 10, st)
        for x in range(0, 16, 5):
            line(im, [(x + variant % 2, 3), (x + variant % 2, 12)], sd)
            px(im, x + 1, 4 + (x + variant) % 7, sl)
        if variant % 2: line(im, [(2, 5), (6, 7), (10, 6)], sd)
        if variant == 3: ell(im, 10, 3, 4, 3, C("moss"))
    return im


def detail_tile(kind: str, v: int = 0) -> Image.Image:
    im = new(T, T)
    if kind == "reed_tuft":
        for x, h in ((3, 8), (7, 11), (11, 7)):
            line(im, [(x, 15), (x + (v % 2), 15 - h)], C("reedpeat_l"))
            px(im, x + (v % 2), 15 - h, C("wood_l"))
    elif kind == "mud_crack":
        line(im, [(2, 4 + v), (7, 6), (12, 3 + v)], C("mud_d"))
        line(im, [(7, 6), (9, 12)], C("mud_d")); px(im, 8, 7, C("mud_l"))
    elif kind == "salt_crust":
        poly(im, [(2, 6), (6, 2 + v), (12, 4), (14, 10), (8, 14), (3, 11)], C("salt_l"))
        line(im, [(4, 7), (9, 5), (12, 9)], C("salt_d"))
    elif kind == "cinder_scoria":
        ell(im, 2 + v, 3, 5, 4, C("cinder_d")); ell(im, 9, 9, 4, 3, C("cinder_l"))
        px(im, 5, 5, C("rust_d"))
    elif kind == "jungle_litter":
        for x, y in ((3, 4), (9, 8), (5, 12)):
            ell(im, x, y + v % 2, 4, 2, C("jungle_l")); px(im, x + 1, y + 1, C("jungle_d"))
    elif kind == "karst_fissure":
        line(im, [(3, 2 + v), (6, 7), (5, 13)], C("karst_d"))
        line(im, [(7, 7), (12, 9 + v % 2)], C("karst_l"))
    elif kind == "shell_hash":
        for x, y in ((3, 5), (8, 3), (12, 8), (5, 12)):
            px(im, x, y, C("shell_l")); px(im, x + 1, y + 1, C("shell_d"))
    elif kind == "water_ripple":
        line(im, [(2, 6 + v), (6, 5 + v), (10, 6 + v)], C("lake_l"))
        line(im, [(5, 11), (9, 10), (13, 11)], C("lake_d"))
    elif kind == "peat_cut":
        rect(im, 2, 4 + v % 2, 5, 8, C("fen_d")); rect(im, 9, 3, 5, 9, C("fen_d"))
        line(im, [(2, 4), (7, 4)], C("silt")); line(im, [(9, 3), (14, 3)], C("silt"))
    elif kind == "toxic_film":
        ell(im, 2, 4, 12, 8, C("toxic_d")); ell(im, 4, 6, 7, 4, C("toxic_l"))
        px(im, 6, 7, C("sulfur_l"))
    elif kind == "dune_ripple":
        line(im, [(2, 5 + v), (7, 3 + v), (13, 5 + v)], C("dune_l"))
        line(im, [(3, 11), (8, 9), (14, 11)], C("dune_d"))
    elif kind == "forge_slag":
        ell(im, 2, 7, 6, 5, C("ink_soft")); ell(im, 8, 5, 6, 6, C("cinder_d"))
        px(im, 5, 8, C("rust_l")); px(im, 11, 7, C("rust"))
    elif kind == "orchard_grass":
        for x in (3, 7, 11):
            line(im, [(x, 14), (x + 1, 9 - v % 3)], C("leaf")); px(im, x + 1, 9, C("leaf_l"))
    return _fade(im, 210 if kind not in ("toxic_film", "water_ripple") else 170)


# ---- larger destination silhouettes and biome-specific storytelling props ----

def mangrove_tree() -> Image.Image:
    im = new(48, 56); shadow(im, 40, 8)
    for x in (14, 24, 34):
        line(im, [(x, 52), (x - 4, 34), (x - 8, 48)], C("wood_d"), 2)
        line(im, [(x, 52), (x + 3, 36), (x + 7, 50)], C("wood_d"), 2)
    rect(im, 22, 24, 5, 26, C("wood_d")); rect(im, 23, 25, 3, 24, C("wood"))
    for cx, cy, r in ((14, 18, 12), (30, 14, 14), (24, 26, 12), (38, 24, 10)):
        ell(im, cx - r, cy - r // 2, r * 2, r, C("mangrove_d"))
        ell(im, cx - r + 2, cy - r // 2 + 1, r * 2 - 4, r - 3, C("mangrove"))
        ell(im, cx - r + 5, cy - r // 2 + 2, r, r // 2, C("mangrove_l"))
    return im


def reed_bed() -> Image.Image:
    im = new(36, 26); shadow(im, 32, 5)
    for i, x in enumerate(range(3, 34, 4)):
        h = 12 + (i * 7) % 10
        line(im, [(x, 24), (x + (i % 3) - 1, 24 - h)], C("reedpeat_l"))
        rect(im, x - 1, 22 - h, 2, 4, C("wood_l"))
    return im


def dock_small() -> Image.Image:
    im = new(48, 30); shadow(im, 44, 6)
    rect(im, 2, 10, 44, 12, C("wood_d"))
    for x in range(3, 45, 5): rect(im, x, 11, 4, 10, C("wood") if x % 10 else C("canvas_d"))
    for x in (4, 22, 42):
        rect(im, x, 4, 3, 22, C("wood_d")); rect(im, x, 3, 3, 2, C("wood_l"))
    line(im, [(4, 6), (44, 6)], C("rope_d"))
    return im


def ferry_boat() -> Image.Image:
    im = new(56, 28); shadow(im, 50, 6)
    poly(im, [(4, 16), (52, 16), (46, 24), (10, 24)], C("wood_d"))
    poly(im, [(7, 17), (49, 17), (44, 22), (12, 22)], C("wood"))
    rect(im, 20, 6, 18, 10, C("canvas_d")); poly(im, [(18, 7), (29, 2), (40, 7)], C("tile_blue_d"))
    line(im, [(29, 2), (29, 16)], C("wood_d")); line(im, [(8, 14), (48, 14)], C("rope"))
    return im


def fish_trap() -> Image.Image:
    im = new(24, 20); shadow(im, 20, 4)
    ell(im, 3, 6, 18, 10, C("wood_d")); ell(im, 5, 7, 14, 8, C("canvas_d"))
    for x in range(6, 19, 3): line(im, [(x, 7), (x, 15)], C("wood_d"))
    line(im, [(5, 11), (19, 11)], C("rope"))
    return im


def forge_slag_heap() -> Image.Image:
    im = new(36, 26); shadow(im, 32, 6)
    poly(im, [(3, 22), (10, 8), (20, 4), (32, 20)], C("ink_soft"))
    poly(im, [(6, 21), (12, 10), (20, 7), (29, 20)], C("cinder_d"))
    for x, y in ((10, 14), (18, 10), (24, 16)): px(im, x, y, C("rust_l")); px(im, x + 1, y + 1, C("rust"))
    return im


def pipe_run() -> Image.Image:
    im = new(44, 22); shadow(im, 40, 4)
    rect(im, 2, 8, 40, 7, C("iron_d")); rect(im, 3, 9, 38, 5, C("iron"))
    for x in (8, 22, 36): rect(im, x, 7, 3, 9, C("rust_d"))
    rect(im, 34, 2, 6, 8, C("iron_d")); rect(im, 35, 3, 4, 6, C("iron"))
    return im


def vent_stack() -> Image.Image:
    im = new(26, 44); shadow(im, 22, 6)
    rect(im, 8, 8, 10, 32, C("rust_d")); rect(im, 9, 9, 8, 30, C("rust"))
    rect(im, 6, 4, 14, 5, C("iron_d")); rect(im, 7, 5, 12, 3, C("iron"))
    for y in (14, 24, 34): rect(im, 8, y, 10, 2, C("iron_d"))
    px(im, 12, 2, (220, 220, 180, 120)); px(im, 14, 0, (220, 220, 180, 80))
    return im


def cooling_trough() -> Image.Image:
    im = new(44, 26); shadow(im, 40, 5)
    rect(im, 2, 8, 40, 14, C("stone_d")); rect(im, 4, 10, 36, 10, C("lake_d"))
    line(im, [(6, 13), (18, 12), (30, 14)], C("lake_l")); px(im, 24, 16, C("brine_h"))
    rect(im, 6, 4, 4, 6, C("iron_d")); rect(im, 34, 4, 4, 6, C("iron_d"))
    return im


def canopy_tree() -> Image.Image:
    im = new(64, 60); shadow(im, 56, 10)
    rect(im, 29, 34, 6, 24, C("wood_d")); rect(im, 30, 35, 4, 22, C("wood"))
    line(im, [(32, 44), (20, 52)], C("wood_d"), 2); line(im, [(32, 44), (44, 52)], C("wood_d"), 2)
    layers = [(10, 26, 44, 22, "jungle_d"), (6, 18, 52, 24, "jungle"), (14, 10, 36, 20, "jungle_l"), (22, 4, 22, 14, "jungle_h")]
    for x, y, w, h, col in layers: ell(im, x, y, w, h, C(col))
    for x, y in ((16, 20), (40, 16), (30, 28)): px(im, x, y, C("jungle_h"))
    return im


def understory_fern() -> Image.Image:
    im = new(32, 28); shadow(im, 28, 5)
    for dx, dy in ((-12, -6), (-6, -12), (0, -14), (6, -12), (12, -6)):
        line(im, [(16, 26), (16 + dx, 26 + dy)], C("leaf_d"), 2)
        line(im, [(16, 26), (16 + dx, 26 + dy)], C("leaf_l"))
    return im


def root_arch() -> Image.Image:
    im = new(48, 42); shadow(im, 44, 7)
    line(im, [(6, 40), (10, 18), (24, 8), (38, 18), (42, 40)], C("wood_d"), 4)
    line(im, [(8, 40), (12, 20), (24, 12), (36, 20), (40, 40)], C("wood"), 2)
    ell(im, 14, 4, 20, 10, C("jungle")); ell(im, 18, 6, 12, 6, C("jungle_l"))
    return im


def liana_curtain() -> Image.Image:
    im = new(32, 50)
    for x, h in ((5, 44), (12, 36), (19, 48), (26, 30)):
        line(im, [(x, 0), (x + 2, h // 2), (x - 1, h)], C("leaf_d"), 2)
        for y in range(6, h, 8): px(im, x + (y % 3), y, C("leaf_l"))
    return im


def karst_boulder() -> Image.Image:
    im = new(40, 34); shadow(im, 36, 6)
    poly(im, [(4, 30), (8, 12), (20, 4), (34, 14), (36, 30)], C("karst_d"))
    poly(im, [(7, 29), (11, 14), (20, 8), (31, 16), (33, 29)], C("karst"))
    line(im, [(20, 8), (18, 28)], C("karst_l")); ell(im, 8, 24, 12, 6, C("moss"))
    return im


def salt_heap() -> Image.Image:
    im = new(32, 24); shadow(im, 28, 5)
    poly(im, [(3, 20), (16, 4), (29, 20)], C("salt_d")); poly(im, [(6, 19), (16, 7), (26, 19)], C("salt_l"))
    line(im, [(10, 16), (22, 16)], C("salt")); px(im, 16, 9, C("canvas_l"))
    return im


def shade_sail() -> Image.Image:
    im = new(48, 34); shadow(im, 44, 6)
    rect(im, 5, 12, 3, 20, C("wood_d")); rect(im, 40, 12, 3, 20, C("wood_d"))
    poly(im, [(3, 14), (24, 4), (45, 14), (24, 20)], C("cloth_d"))
    poly(im, [(6, 14), (24, 7), (42, 14), (24, 18)], C("cloth"))
    line(im, [(24, 7), (24, 18)], C("canvas_l"))
    return im


def keeper_shed() -> Image.Image:
    im = new(64, 48); shadow(im, 58, 7)
    rect(im, 8, 22, 48, 22, C("stone_d")); rect(im, 10, 24, 44, 18, C("plaster"))
    poly(im, [(4, 24), (32, 8), (60, 24)], C("tile_blue_d")); poly(im, [(8, 22), (32, 11), (56, 22)], C("tile_blue"))
    rect(im, 26, 30, 12, 14, C("ink")); rect(im, 14, 28, 8, 8, C("tidal_d")); rect(im, 44, 28, 8, 8, C("tidal_d"))
    return im


def storm_glass_cluster() -> Image.Image:
    im = new(28, 24); shadow(im, 24, 4)
    for x, h in ((6, 14), (13, 18), (20, 11)):
        poly(im, [(x - 3, 20), (x, 20 - h), (x + 3, 20)], C("ice_d"))
        poly(im, [(x - 1, 19), (x, 22 - h), (x + 1, 19)], C("ice_l"))
    return im


def driftwood_pile() -> Image.Image:
    im = new(36, 20); shadow(im, 32, 4)
    for y, dx in ((14, 0), (10, 4), (6, 8)):
        line(im, [(3 + dx, y), (31 - dx, y - 2)], C("wood_d"), 3)
        line(im, [(4 + dx, y), (30 - dx, y - 2)], C("canvas_d"))
    return im


def cenote_steps() -> Image.Image:
    im = new(48, 32); shadow(im, 44, 5)
    for i, (x, y, w) in enumerate([(4, 22, 40), (10, 16, 28), (16, 10, 16)]):
        rect(im, x, y, w, 6, C("karst_d")); rect(im, x + 1, y + 1, w - 2, 4, C("karst"))
    ell(im, 18, 4, 12, 6, C("cenote")); px(im, 22, 6, C("cenote_h"))
    return im


def orchard_wall() -> Image.Image:
    im = new(48, 24); shadow(im, 44, 4)
    rect(im, 2, 10, 44, 10, C("karst_d"))
    for x in range(3, 45, 8): rect(im, x, 11, 7, 8, C("karst")); px(im, x + 1, 12, C("karst_l"))
    ell(im, 6, 6, 10, 6, C("jungle")); ell(im, 30, 5, 12, 7, C("jungle"))
    return im


def lantern_post() -> Image.Image:
    im = new(16, 32); shadow(im, 12, 4)
    rect(im, 7, 10, 2, 20, C("wood_d")); rect(im, 4, 6, 8, 8, C("iron_d"))
    rect(im, 5, 7, 6, 6, C("lamp_glow")); rect(im, 6, 8, 4, 4, C("fire_l"))
    rect(im, 3, 5, 10, 2, C("iron_d"))
    return im


def pier_rail() -> Image.Image:
    im = new(24, 16)
    rect(im, 2, 4, 2, 10, C("wood_d")); rect(im, 20, 4, 2, 10, C("wood_d"))
    line(im, [(2, 5), (22, 5)], C("rope")); line(im, [(2, 9), (22, 9)], C("rope_d"))
    return im


def warning_stakes() -> Image.Image:
    im = new(24, 20); shadow(im, 20, 4)
    for x in (5, 12, 19):
        rect(im, x, 4, 2, 14, C("wood_d")); poly(im, [(x, 4), (x + 1, 1), (x + 2, 4)], C("wood_l"))
    line(im, [(5, 8), (19, 6)], C("rope")); rect(im, 10, 5, 5, 4, C("sulfur"))
    return im


def tide_gauge_large() -> Image.Image:
    im = new(20, 40); shadow(im, 16, 5)
    rect(im, 8, 4, 4, 34, C("wood_d")); rect(im, 9, 5, 2, 32, C("canvas_l"))
    for y in range(8, 36, 4): rect(im, 6, y, 8, 1, C("ink_soft"))
    rect(im, 4, 2, 12, 4, C("tile_blue_d")); rect(im, 5, 3, 10, 2, C("tidal_l"))
    return im


def pump_tank() -> Image.Image:
    im = new(40, 48); shadow(im, 36, 6)
    rect(im, 6, 12, 28, 30, C("iron_d")); rect(im, 8, 14, 24, 26, C("iron"))
    ell(im, 6, 8, 28, 8, C("iron_d")); ell(im, 8, 9, 24, 6, C("iron_l"))
    for y in (20, 30): rect(im, 6, y, 28, 2, C("rust_d"))
    rect(im, 16, 4, 8, 6, C("rust_d")); rect(im, 18, 5, 4, 4, C("rust"))
    return im


def spore_mushroom() -> Image.Image:
    im = new(24, 22); shadow(im, 20, 4)
    rect(im, 10, 12, 4, 8, C("canvas_d"))
    ell(im, 4, 6, 16, 8, C("toxic_d")); ell(im, 6, 7, 12, 6, C("toxic_l"))
    px(im, 9, 8, C("sulfur_l")); px(im, 14, 9, C("sulfur"))
    return im


def region_frames() -> tuple[dict, dict]:
    terrain: dict[str, Image.Image] = {}
    for style in NEW_MATERIALS:
        for v in range(4):
            terrain[f"{style}_{v}"] = mat_tile(style, v)
    # Cardinal material transitions for the authored landform boundaries.
    pairs = [("silt", "reedpeat"), ("reedpeat", "lake"), ("silt", "lake"), ("shell", "dune"),
             ("dune", "salt"), ("salt", "sulfur"), ("cinder", "lava"), ("lava", "sulfur"),
             ("jungle", "karst"), ("karst", "soil"), ("mangrove", "mud"), ("mud", "tidal"),
             ("karst", "cenote"), ("fen", "toxic"), ("fen", "silt"), ("toxic", "mud"),
             ("grass", "silt"), ("jungle", "soil"), ("mangrove", "shell"), ("cinder", "ash"),
             ("salt", "brine"), ("dune", "brine")]
    for a, c in pairs:
        ta = terrain.get(f"{a}_0") or mat_tile(a, 0)
        tc = terrain.get(f"{c}_0") or mat_tile(c, 0)
        for m in range(1, 16):
            terrain[f"mix_{a}_{c}_{m}"] = mix_tile(ta, tc, m)
            terrain[f"mix_{c}_{a}_{m}"] = mix_tile(tc, ta, m)
    for land in ("silt", "shell", "mud", "karst", "fen", "reedpeat", "dune", "salt"):
        tl = terrain.get(f"{land}_0") or mat_tile(land, 0)
        for water in ("lake", "river", "tidal", "cenote", "brine"):
            tw = mat_tile(water, 0)
            for m in range(1, 16):
                terrain[f"coast_{land}_{water}_{m}"] = coast_tile(tl, tw, m)
    # Legacy broad boardwalk/causeway frames remain for compatibility, but new
    # regional scenes use narrow purposeful piers and weathered causeways.
    terrain["boardwalk_ns"] = boardwalk("ns"); terrain["boardwalk_ew"] = boardwalk("ew"); terrain["boardwalk_junction"] = boardwalk("junction")
    terrain["causeway_ns"] = causeway("ns"); terrain["causeway_ew"] = causeway("ew")
    for m in range(16):
        terrain[f"track_dirt_{m}"] = track_decal(m, False)
        terrain[f"track_stone_{m}"] = track_decal(m, True)
    for orient in ("ns", "ew", "junction", "end_n", "end_s", "end_e", "end_w"):
        for v in range(3):
            terrain[f"pier_{orient}_{v}"] = pier_tile(orient, v)
    for orient in ("ns", "ew"):
        for v in range(4):
            terrain[f"causeway_{orient}_{v}"] = causeway_tile(orient, v)
    for kind in ("reed_tuft", "mud_crack", "salt_crust", "cinder_scoria", "jungle_litter",
                 "karst_fissure", "shell_hash", "water_ripple", "peat_cut", "toxic_film",
                 "dune_ripple", "forge_slag", "orchard_grass"):
        for v in range(3):
            terrain[f"detail_{kind}_{v}"] = detail_tile(kind, v)

    props: dict[str, Image.Image] = {
        "reed_clump": reed_clump(), "mangrove_root": mangrove_root(), "palm": palm(),
        "jungle_canopy": jungle_canopy(), "karst_pinnacle": karst_pinnacle(), "driftwood": driftwood(),
        "lm_mere_boathouse": lm_mere_boathouse(), "lm_mere_causeway": lm_mere_causeway(),
        "lm_glasswind_light": lm_glasswind_light(), "lm_ember_forge": lm_ember_forge(),
        "lm_saffron_salt_works": lm_saffron_salt_works(), "lm_verdant_temple": lm_verdant_temple(),
        "lm_pearl_customs": lm_pearl_customs(), "lm_sunken_cenote": lm_sunken_cenote(),
        "lm_ashwater_pump": lm_ashwater_pump(),
    }
    for kind in ("silica_placer", "storm_glass", "sulfur_vent", "copper_vein", "salt_crust_prop",
                 "hardwood_log", "rubber_tap", "venom_sac", "pearl_bed", "abyssal_pearl",
                 "limestone_chunk", "karst_herb", "peat_cut", "bog_iron", "fen_venom",
                 "reed_bundle", "clay_lens", "freshwater_pearl", "obsidian_shard", "basalt_chunk"):
        props[kind] = resource(kind)
    for kind in ("gas_vent", "bleached_reeds", "spore_cluster", "tide_gauge", "cenote_rim",
                 "toxic_pool_edge", "sulfur_crust"):
        props[kind] = hazard(kind)
    for kind in ("mooring_post", "boardwalk_post", "net_rack", "salt_rake", "sluice_gate",
                 "pump_pipe", "chimney_stack", "awning", "salt_windbreak", "tidal_wrack",
                 "bog_pool", "cenote_pool", "shell_bar", "cinder_cone", "fen_snag",
                 "liana", "stilt_walk", "causeway_stone", "rope_bridge", "boardwalk", "heat_shimmer"):
        props[kind] = small_struct(kind)
    props["stone_causeway"] = small_struct("causeway_stone")
    props.update({
        "mangrove_tree": mangrove_tree(), "reed_bed": reed_bed(), "dock_small": dock_small(),
        "ferry_boat": ferry_boat(), "fish_trap": fish_trap(), "forge_slag_heap": forge_slag_heap(),
        "pipe_run": pipe_run(), "vent_stack": vent_stack(), "cooling_trough": cooling_trough(),
        "canopy_tree": canopy_tree(), "understory_fern": understory_fern(), "root_arch": root_arch(),
        "liana_curtain": liana_curtain(), "karst_boulder": karst_boulder(), "salt_heap": salt_heap(),
        "shade_sail": shade_sail(), "keeper_shed": keeper_shed(), "storm_glass_cluster": storm_glass_cluster(),
        "driftwood_pile": driftwood_pile(), "cenote_steps": cenote_steps(), "orchard_wall": orchard_wall(),
        "lantern_post": lantern_post(), "pier_rail": pier_rail(), "warning_stakes": warning_stakes(),
        "tide_gauge_large": tide_gauge_large(), "pump_tank": pump_tank(), "spore_mushroom": spore_mushroom(),
    })
    return terrain, props


def build() -> dict:
    """Bake the extended atlas by re-running the pilot bake with regional frames."""
    return b.build(include_regions=True)


if __name__ == "__main__":
    print(json.dumps(build(), sort_keys=True))
