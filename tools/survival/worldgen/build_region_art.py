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
    "salt_d": "#9a9484", "salt": "#c9c3ae", "salt_l": "#ece6d2",
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
}
b.P.update(EXTRA_PALETTE)

WATER_STYLES = {"lake", "river", "tidal", "cenote", "ocean", "water"}
NEW_MATERIALS = ["silt", "reedpeat", "lake", "river", "tidal", "mud", "shell", "dune",
                 "salt", "sulfur", "cinder", "lava", "jungle", "karst", "mangrove",
                 "cenote", "fen", "toxic"]


def mat_tile(style: str, v: int) -> Image.Image:
    im = new(T, T)
    dk, md, hi = C(style + "_d"), C(style), C(style + "_l")
    rect(im, 0, 0, T, T, md)
    if v > 0 and style not in WATER_STYLES:
        # Most tiles are calm fields; only variant 0 carries a readable mark.
        if v == 1:
            px(im, 5, 6, hi)
        return im
    if style in WATER_STYLES:
        for y in (4 + v % 3, 10 + v % 2):
            line(im, [(2, y), (6, y), (9, y + 1)], hi)
        px(im, 12, 6 + v % 3, C(style + "_h") if style + "_h" in b.P else hi)
        return im
    # Calm clustered marks, not full-width corduroy or single-tile confetti.
    if style == "salt":
        line(im, [(3, 5), (7, 3), (11, 6)], dk)
        line(im, [(9, 11), (13, 9)], dk)
        px(im, 5 + v, 7, hi)
    elif style in ("cinder", "lava"):
        ell(im, 3 + v % 3, 4, 5, 3, hi if style == "cinder" else dk)
        ell(im, 9, 10, 4, 2, dk)
        if style == "lava":
            line(im, [(4, 8), (8, 9), (12, 7)], C("rust_d"))
    elif style in ("jungle", "mangrove", "fen", "reedpeat"):
        for x, y in ((4, 5), (10, 10)):
            line(im, [(x, y), (x + 2, y - 1)], hi)
            px(im, x + 1, y + 1, dk)
        if style == "fen":
            ell(im, 8 + v % 3, 3, 4, 2, dk)
    elif style == "karst":
        line(im, [(2, 6), (6, 4), (10, 7)], dk)
        line(im, [(4, 11), (8, 12), (12, 10)], hi)
    elif style in ("dune", "shell"):
        line(im, [(3, 6), (7, 5), (11, 6)], hi)
        line(im, [(5, 11), (9, 10)], hi)
        if style == "shell":
            px(im, 4 + v, 8, C("canvas_l"))
    elif style == "mud":
        line(im, [(3, 7), (7, 6), (11, 8)], hi)
        ell(im, 9, 10, 4, 2, dk)
    elif style == "sulfur":
        ell(im, 4, 5, 5, 3, hi); ell(im, 9, 9, 4, 3, dk)
    elif style == "toxic":
        ell(im, 4 + v % 3, 5, 6, 4, dk); px(im, 7, 6, hi)
    else:  # silt
        line(im, [(3, 6), (7, 5), (10, 7)], hi)
        line(im, [(5, 11), (9, 12)], dk)
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
    im = _building_base(88, 72)
    for x in (12, 40, 72): rect(im, x, 48, 4, 22, C("wood_d"))
    rect(im, 6, 44, 76, 8, C("wood_d")); rect(im, 8, 45, 72, 6, C("wood"))
    rect(im, 16, 24, 56, 22, C("wood_d")); rect(im, 18, 26, 52, 18, C("canvas_d"))
    poly(im, [(10, 26), (44, 6), (78, 26)], C("reedpeat_d")); poly(im, [(14, 24), (44, 9), (74, 24)], C("reedpeat"))
    rect(im, 38, 32, 12, 14, C("ink")); rect(im, 40, 34, 8, 10, C("wood_l"))
    rect(im, 22, 30, 8, 8, C("lake_d")); rect(im, 58, 30, 8, 8, C("lake_d"))
    # moored skiff
    poly(im, [(58, 62), (84, 62), (78, 70), (62, 70)], C("wood_d")); line(im, [(60, 63), (82, 63)], C("wood_l"))
    return im


def lm_mere_causeway() -> Image.Image:
    im = _building_base(72, 48)
    rect(im, 4, 30, 64, 14, C("stone_d")); rect(im, 6, 31, 60, 12, C("stone"))
    for x in range(8, 64, 8): line(im, [(x, 31), (x, 42)], C("stone_d"))
    rect(im, 10, 12, 8, 20, C("stone_d")); rect(im, 54, 12, 8, 20, C("stone_d"))
    rect(im, 10, 10, 52, 6, C("stone")); rect(im, 30, 18, 12, 14, C("ink_soft"))
    return im


def lm_glasswind_light() -> Image.Image:
    im = _building_base(56, 96)
    poly(im, [(16, 92), (20, 30), (36, 30), (40, 92)], C("stone_d"))
    poly(im, [(19, 90), (22, 32), (34, 32), (37, 90)], C("stone"))
    for y in (40, 56, 72): rect(im, 22, y, 12, 3, C("cloth_d"))
    rect(im, 18, 22, 20, 10, C("iron_d")); rect(im, 21, 24, 14, 6, C("fire")); px(im, 24, 25, C("fire_l"))
    poly(im, [(16, 22), (28, 8), (40, 22)], C("cloth_d")); poly(im, [(19, 20), (28, 11), (37, 20)], C("cloth"))
    rect(im, 12, 80, 32, 12, C("stone_d")); rect(im, 14, 81, 28, 10, C("stone"))
    rect(im, 24, 84, 8, 8, C("ink"))
    return im


def lm_ember_forge() -> Image.Image:
    im = _building_base(112, 88)
    rect(im, 8, 40, 96, 44, C("lava_d")); rect(im, 10, 42, 92, 40, C("cinder"))
    poly(im, [(8, 40), (30, 20), (52, 40), (74, 20), (96, 40)], C("iron_d"))
    poly(im, [(12, 38), (30, 24), (48, 38)], C("iron")); poly(im, [(56, 38), (74, 24), (92, 38)], C("iron"))
    rect(im, 84, 4, 14, 40, C("rust_d")); rect(im, 86, 4, 10, 38, C("rust")); rect(im, 84, 2, 14, 4, C("iron_d"))
    rect(im, 20, 56, 18, 26, C("ink")); rect(im, 22, 58, 14, 22, C("fire_d")); rect(im, 24, 62, 10, 16, C("fire"))
    rect(im, 52, 56, 12, 12, C("iron_d")); rect(im, 54, 58, 8, 8, C("fire_l"))
    rect(im, 70, 62, 24, 20, C("iron_d")); rect(im, 72, 64, 20, 16, C("iron"))
    return im


def lm_saffron_salt_works() -> Image.Image:
    im = _building_base(96, 64)
    rect(im, 8, 36, 80, 24, C("plaster_d")); rect(im, 10, 38, 76, 20, C("plaster"))
    rect(im, 6, 30, 84, 8, C("plaster_d")); rect(im, 8, 31, 80, 5, C("plaster_l"))
    for x in (16, 40, 64): rect(im, x, 44, 10, 14, C("ink_soft"))
    poly(im, [(48, 30), (72, 14), (92, 30)], C("tile_blue_d")); poly(im, [(52, 28), (72, 17), (88, 28)], C("tile_blue"))
    rect(im, 12, 48, 20, 12, C("salt_d")); rect(im, 14, 49, 16, 10, C("salt_l"))
    line(im, [(36, 60), (44, 40)], C("wood_d"), 2); rect(im, 42, 38, 6, 3, C("iron"))
    return im


def lm_verdant_temple() -> Image.Image:
    im = _building_base(104, 88)
    for i, (x, y, w) in enumerate([(8, 68, 88), (16, 52, 72), (24, 36, 56)]):
        rect(im, x, y, w, 16, C("karst_d")); rect(im, x + 2, y + 1, w - 4, 14, C("karst"))
    rect(im, 36, 16, 32, 22, C("karst_d")); rect(im, 38, 18, 28, 18, C("karst_l"))
    rect(im, 46, 24, 12, 14, C("ink"))
    line(im, [(20, 68), (28, 40), (24, 20)], C("wood_d"), 2)
    line(im, [(84, 68), (76, 44), (80, 24)], C("wood_d"), 2)
    ell(im, 12, 60, 20, 10, C("jungle")); ell(im, 72, 58, 22, 12, C("jungle"))
    return im


def lm_pearl_customs() -> Image.Image:
    im = _building_base(96, 76)
    for x in (12, 44, 80): rect(im, x, 52, 4, 22, C("wood_d"))
    rect(im, 6, 48, 84, 8, C("wood_d")); rect(im, 8, 49, 80, 6, C("wood"))
    rect(im, 16, 24, 64, 26, C("wood_d")); rect(im, 18, 26, 60, 22, C("canvas_d"))
    poly(im, [(10, 26), (48, 6), (86, 26)], C("tile_blue_d")); poly(im, [(14, 24), (48, 9), (82, 24)], C("tile_blue"))
    rect(im, 40, 34, 14, 16, C("ink")); rect(im, 22, 30, 10, 10, C("tidal_d")); rect(im, 64, 30, 10, 10, C("tidal_d"))
    rect(im, 70, 56, 20, 4, C("wood_d"))
    return im


def lm_sunken_cenote() -> Image.Image:
    im = _building_base(80, 64)
    ell(im, 8, 24, 64, 36, C("karst_d")); ell(im, 14, 28, 52, 28, C("cenote_d")); ell(im, 20, 32, 40, 20, C("cenote"))
    rect(im, 30, 8, 20, 18, C("karst_d")); rect(im, 32, 10, 16, 14, C("karst_l")); rect(im, 36, 14, 8, 12, C("ink"))
    line(im, [(12, 40), (20, 36)], C("jungle_l")); line(im, [(60, 44), (68, 40)], C("jungle_l"))
    return im


def lm_ashwater_pump() -> Image.Image:
    im = _building_base(88, 72)
    for x in (12, 72): rect(im, x, 48, 4, 22, C("wood_d"))
    rect(im, 6, 44, 76, 8, C("wood_d"))
    rect(im, 16, 24, 56, 22, C("iron_d")); rect(im, 18, 26, 52, 18, C("rust"))
    poly(im, [(12, 26), (44, 8), (76, 26)], C("iron_d")); poly(im, [(16, 24), (44, 11), (72, 24)], C("iron"))
    rect(im, 36, 32, 16, 14, C("ink")); rect(im, 38, 34, 12, 10, C("toxic_l"))
    rect(im, 60, 12, 8, 34, C("iron_d")); rect(im, 62, 14, 4, 30, C("iron"))
    ell(im, 20, 50, 16, 10, C("toxic_d"))
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
             ("grass", "silt"), ("jungle", "soil"), ("mangrove", "shell"), ("cinder", "ash")]
    for a, c in pairs:
        ta = terrain.get(f"{a}_0") or mat_tile(a, 0)
        tc = terrain.get(f"{c}_0") or mat_tile(c, 0)
        for m in range(1, 16):
            terrain[f"mix_{a}_{c}_{m}"] = mix_tile(ta, tc, m)
            terrain[f"mix_{c}_{a}_{m}"] = mix_tile(tc, ta, m)
    for land in ("silt", "shell", "mud", "karst", "fen", "reedpeat", "dune"):
        tl = terrain.get(f"{land}_0") or mat_tile(land, 0)
        for water in ("lake", "river", "tidal", "cenote"):
            tw = mat_tile(water, 0)
            for m in range(1, 16):
                terrain[f"coast_{land}_{water}_{m}"] = coast_tile(tl, tw, m)
    terrain["boardwalk_ns"] = boardwalk("ns"); terrain["boardwalk_ew"] = boardwalk("ew"); terrain["boardwalk_junction"] = boardwalk("junction")
    terrain["causeway_ns"] = causeway("ns"); terrain["causeway_ew"] = causeway("ew")

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
    return terrain, props


def build() -> dict:
    """Bake the extended atlas by re-running the pilot bake with regional frames."""
    return b.build(include_regions=True)


if __name__ == "__main__":
    print(json.dumps(build(), sort_keys=True))
