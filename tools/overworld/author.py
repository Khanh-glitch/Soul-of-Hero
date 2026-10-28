#!/usr/bin/env python3
"""Author the Hollow Marches overworld.

Single source of truth for the region's geography AND its gameplay document.

Terrain is grown from two smooth fields (elevation and wetness) plus authored
landforms, so the ground reads as one continuous country rather than ten
isolated biomes. Every transition is dithered through a threshold band, which is
what stops it looking like a colour chart.

The bake step is also the correctness gate: after the layers are composed, a
flood fill from the refuge proves that all ten dungeon thresholds, all four
camps and all eight discoveries are reachable on foot with every shortcut
closed, and again with them open. Unreachable content is a hard error.

Outputs:
  data/overworld/hollow_marches.json          world document (gameplay truth)
  data/overworld/hollow_marches_layers.json   baked ground/detail/solid grids
  data/overworld/hollow_marches_props.json    baked prop placement

Run: python3 tools/overworld/author.py
"""

from __future__ import annotations

import json
import math
import os
import sys
import zlib
from collections import deque

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DATA_DIR = os.path.join(ROOT, "data", "overworld")

W, H = 384, 256
TILE = 16

# ---------------------------------------------------------------------------
# layer buffers
# ---------------------------------------------------------------------------
ground = ["."] * (W * H)
detail = ["."] * (W * H)
solid = ["."] * (W * H)
props: list[dict] = []


def idx(x, y):
    return y * W + x


def inside(x, y):
    return 0 <= x < W and 0 <= y < H


def get(layer, x, y):
    if not inside(x, y):
        return "."
    return layer[idx(x, y)]


def put(layer, x, y, code):
    if inside(x, y):
        layer[idx(x, y)] = code


# ---------------------------------------------------------------------------
# deterministic noise
# ---------------------------------------------------------------------------
def h01(*values):
    h = 2166136261
    for v in values:
        h ^= int(v * 7919) & 0xFFFFFFFF
        h = (h * 16777619) & 0xFFFFFFFF
    return ((h >> 8) & 0xFFFF) / 65536.0


def vnoise(x, y, scale, seed=0):
    fx, fy = x / scale, y / scale
    x0, y0 = int(math.floor(fx)), int(math.floor(fy))
    tx, ty = fx - x0, fy - y0
    tx = tx * tx * (3 - 2 * tx)
    ty = ty * ty * (3 - 2 * ty)
    a = h01(seed, x0, y0)
    b = h01(seed, x0 + 1, y0)
    c = h01(seed, x0, y0 + 1)
    d = h01(seed, x0 + 1, y0 + 1)
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def fbm(x, y, seed=0, octaves=3, scale=26.0):
    total = 0.0
    amp = 1.0
    norm = 0.0
    s = scale
    for i in range(octaves):
        total += vnoise(x, y, s, seed + i) * amp
        norm += amp
        amp *= 0.55
        s *= 0.45
    return total / norm


# ---------------------------------------------------------------------------
# geometry
# ---------------------------------------------------------------------------
def ellipse(cx, cy, rx, ry, wobble=0.0, seed=0):
    for y in range(int(cy - ry) - 5, int(cy + ry) + 6):
        for x in range(int(cx - rx) - 5, int(cx + rx) + 6):
            dx = (x - cx) / max(0.001, rx)
            dy = (y - cy) / max(0.001, ry)
            d = math.sqrt(dx * dx + dy * dy)
            if wobble:
                d += (h01(seed, x // 3, y // 3) - 0.5) * wobble
            if d <= 1.0:
                yield x, y


def dist_to_segment(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    seg = vx * vx + vy * vy
    t = 0.0 if seg <= 0.0001 else max(0.0, min(1.0, (wx * vx + wy * vy) / seg))
    dx = ax + t * vx - px
    dy = ay + t * vy - py
    return math.sqrt(dx * dx + dy * dy), t


def polyline(points, half_width, taper=False):
    seg = [math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1])
           for i in range(len(points) - 1)]
    total = max(0.001, sum(seg))
    run = 0.0
    for i in range(len(points) - 1):
        ax, ay = points[i]
        bx, by = points[i + 1]
        ln = seg[i]
        pad = int(half_width) + 3
        for y in range(int(min(ay, by)) - pad, int(max(ay, by)) + pad + 1):
            for x in range(int(min(ax, bx)) - pad, int(max(ax, bx)) + pad + 1):
                d, t = dist_to_segment(x, y, ax, ay, bx, by)
                hw = half_width
                if taper:
                    gt = (run + t * ln) / total
                    hw = half_width * (0.5 + 0.5 * min(1.0, min(gt, 1 - gt) * 5))
                if d <= hw:
                    yield x, y, (run + t * ln) / total
        run += ln


def point_in_poly(x, y, poly):
    inside_ = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            inside_ = not inside_
        j = i
    return inside_


# ---------------------------------------------------------------------------
# painting helpers
# ---------------------------------------------------------------------------
def blend_put(layer, x, y, code, alt=None, band=0.0, value=0.5, threshold=0.5, seed=0):
    """Write `code`, but dither toward `alt` inside a threshold band."""
    if not inside(x, y):
        return
    if alt and band > 0 and abs(value - threshold) < band:
        t = 0.5 + (value - threshold) / (2 * band)
        if h01(seed, x, y) > t:
            put(layer, x, y, alt)
            return
    put(layer, x, y, code)


def road(points, half_width=2.4, kind="=", *, ground_code="d", seed=0):
    cells = set()
    for x, y, t in polyline(points, half_width, taper=True):
        if get(ground, x, y) in ("~", "-"):
            # a ford, not a swimming lesson: the road can always be walked
            put(ground, x, y, "-")
        else:
            put(ground, x, y, ground_code)
        put(detail, x, y, kind)
        put(solid, x, y, ".")
        cells.add((x, y))
    # scatter a little wear and gravel in the verges
    for x, y in list(cells):
        for dy in (-2, -1, 1, 2):
            for dx in (-2, -1, 1, 2):
                if abs(dx) + abs(dy) > 2:
                    continue
                nx, ny = x + dx, y + dy
                if (nx, ny) in cells:
                    continue
                if h01(seed, nx, ny) < 0.18 and get(ground, nx, ny) not in ("f", "~", "-", "v", "y"):
                    put(ground, nx, ny, "g")
    return cells


def river(points, half_width, *, shallow_edges=True):
    core = {(x, y) for x, y, _ in polyline(points, half_width - 0.6)}
    edge = {(x, y) for x, y, _ in polyline(points, half_width + 0.9)} - core
    for x, y in edge:
        if get(solid, x, y) == ".":
            put(ground, x, y, "-")
    for x, y in core:
        if get(solid, x, y) == ".":
            put(ground, x, y, "~")
    return core | edge


def ridge(points, half_width, *, seed=0, jitter=1.6):
    """Impassable rock mass with a noisy silhouette."""
    out = set()
    pad = int(half_width) + 6
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    for y in range(int(min(ys)) - pad, int(max(ys)) + pad + 1):
        for x in range(int(min(xs)) - pad, int(max(xs)) + pad + 1):
            d = min(dist_to_segment(x, y, points[i][0], points[i][1],
                                    points[i + 1][0], points[i + 1][1])[0]
                    for i in range(len(points) - 1))
            limit = half_width + (h01(seed, x, y) - 0.5) * jitter
            if d <= limit and inside(x, y):
                put(solid, x, y, "#")
                out.add((x, y))
    return out


def wall(points, half_width=1.0):
    out = set()
    for x, y, _t in polyline(points, half_width):
        put(solid, x, y, "W")
        out.add((x, y))
    return out


def thicket(cells, density=0.55, seed=0):
    out = set()
    for x, y in cells:
        if h01(seed, x, y) < density:
            put(solid, x, y, "T")
            out.add((x, y))
    return out


def block_rect(x0, y0, x1, y1, code="#"):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            put(solid, x, y, code)


def clear_rect(x0, y0, x1, y1):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            put(solid, x, y, ".")


def plaza(cx, cy, r, *, code="f", rim="g", seed=0, ry=None):
    ry = ry if ry is not None else r * 0.62
    for x, y in ellipse(cx, cy, r, ry, wobble=0.35, seed=seed):
        put(ground, x, y, code)
        put(solid, x, y, ".")
        if h01(seed + 5, x, y) < 0.18:
            put(detail, x, y, "*")
    for x, y in ellipse(cx, cy, r + 2.6, ry + 2.0, wobble=0.5, seed=seed + 1):
        if get(ground, x, y) not in (code, "=", "+"):
            put(ground, x, y, rim)
            put(solid, x, y, ".")


def approach(points, half_width=1.8):
    for x, y, _t in polyline(points, half_width):
        put(ground, x, y, "f")
        put(detail, x, y, "+")
        put(solid, x, y, ".")


def add_prop(frame, x, y, *, flags="", z=0, lit=False):
    props.append({
        "frame": frame,
        "x": round(float(x), 1),
        "y": round(float(y), 1),
        "flags": flags,
        "z": z,
        "lit": lit,
    })


def tile_pos(x, y):
    return x * TILE + 8, y * TILE + 8


def _load_prop_meta():
    path = os.path.join(DATA_DIR, "overworld_props.json")
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f).get("frames", {})


PROP_META = _load_prop_meta()

## Prop frames that get a collision body at runtime. Kept in step with
## OverworldWorld.SOLID_PROP_PREFIXES; `validate()` refuses to bake a world where
## one of them stands in a walking lane or on an interaction cell.
## Base ids the runtime resolves to real frames (OverworldWorld.SHORTCUT_FRAME_ALIASES).
SHORTCUT_ALIAS_KEYS = ("short_bridge", "short_rubble", "short_conduit", "short_valve")

COLLIDER_PROP_PREFIXES = (
    "lm_", "short_bridge", "short_rubble", "short_conduit", "short_valve",
    "wall_stub", "tree_dead", "tree_pine", "column", "statue",
    "camp_tent", "cart", "sarcophagus",
)


# ---------------------------------------------------------------------------
# the world document
# ---------------------------------------------------------------------------
LANDMARKS = [
    ("lm_crypt", "chapter_1_level_1", "Crypt Entrance", "western_funerary_quarter",
     (88, 180), "lm_crypt", "undead", "The Sealed Steps"),
    ("lm_ossuary", "chapter_1_level_2", "Ossuary Fork", "ossuary_ravines",
     (64, 128), "lm_ossuary", "bone", "The Bone Galleries"),
    ("lm_archive", "chapter_1_level_3", "Crossfire Archive", "central_ruins",
     (132, 152), "lm_archive", "knowledge", "Crossfire Archive"),
    ("lm_reliquary", "chapter_1_level_4", "Spiral Reliquary", "sacred_terraces",
     (200, 136), "lm_reliquary", "sacred", "The Spiral Reliquary"),
    ("lm_crucible", "chapter_1_level_5", "Blood Crucible", "ritual_basin",
     (192, 192), "lm_crucible", "ritual", "The Blood Crucible"),
    ("lm_relay", "chapter_1_level_6", "Soul Anchor Relay", "relay_watershed",
     (288, 140), "lm_relay", "soul", "Soul Anchor Relay"),
    ("lm_beacon", "chapter_1_level_7", "The Failing Beacon", "watch_ridge",
     (208, 80), "lm_beacon", "fire", "The Failing Beacon"),
    ("lm_divided", "chapter_1_level_8", "Divided Reliquary", "northern_precinct",
     (272, 72), "lm_divided", "schism", "The Divided Reliquary"),
    ("lm_gate", "chapter_1_level_9", "Crimson Gate", "fortified_pass",
     (208, 40), "lm_gate", "military", "The Crimson Gate"),
    ("lm_throne", "chapter_1_level_10", "Castellan Throne", "citadel",
     (280, 36), "lm_throne", "throne", "Castellan's Citadel"),
]

CAMPS = [
    ("camp_refuge", "Ashen Refuge", (56, 216), True),
    ("camp_crossroads", "Wayfarer Stones", (152, 188), False),
    ("camp_relay_base", "Relay Foot", (248, 158), False),
    ("camp_ridge", "Watch Ridge Camp", (208, 104), False),
]

DISCOVERIES = [
    ("d_crypt_offer", (76, 196), "coin_cache", {"account": 40}),
    ("d_ossuary_stash", (48, 146), "material_cache", {"hero_materials": 1}),
    ("d_archive_lore", (146, 138), "lore", {}),
    ("d_shrine_grove", (176, 118), "shrine", {"restore": 0.5}),
    ("d_crucible_cove", (200, 226), "material_cache", {"monster_fragments": 1}),
    ("d_relay_shard", (312, 156), "sigil_cache", {"sigils": 1}),
    ("d_quartermaster", (232, 96), "coin_cache", {"account": 80}),
    ("d_gate_plunder", (184, 52), "material_cache", {"hero_materials": 2, "monster_fragments": 1}),
]

SHORTCUTS = [
    ("short_crucible_bridge", "broken_bridge", (184, 210), "chapter_1_level_5",
     [(-6, -2), (6, 2)], "The old span is down. Relight the Crucible and its span returns."),
    ("short_relay_power", "powered_conduit", (256, 125), "chapter_1_level_6",
     [(-4, -3), (4, 3)], "The conduit is dark. Wake the Soul Anchor and it will carry you up the ridge."),
    ("short_beacon_road", "rubble_block", (208, 96), "chapter_1_level_7",
     [(-5, -4), (5, 4)], "A fall of stone blocks the ridge stair. Light the Beacon and the stair is cleared."),
    ("short_gate_valve", "gate_valve", (233, 50), "chapter_1_level_9",
     [(-3, -3), (3, 3)], "The valve is sealed. Hold the Crimson Gate and the inner postern opens."),
]


def stable_seed(text):
    """Deterministic seed for a string.

    Python's builtin `hash()` is salted per process, which made the bake
    non-reproducible: two runs of `author.py` produced slightly different
    props and counts, so the committed JSON could never be reproduced and the
    preview drifted from the world. crc32 is stable across processes,
    platforms and Python versions.
    """
    return zlib.crc32(text.encode("utf-8")) & 0x3FF


## Hazards are authored rects: (id, (x, y, w, h), label). They drain faster
## than the open wilds and are the only reason a player ever detours.
HAZARDS = [
    ("crucible_basin", (160, 184, 64, 40), "The basin's heat"),
    ("fen_marsh", (232, 196, 104, 48), "Fen rot"),
    ("relay_watershed", (246, 122, 62, 34), "Cold conduit bleed"),
]


def carve_rect(kind, tx, ty):
    """The solid band each shortcut occupies while closed.

    One definition, used by the painter, the reachability gate and the emitted
    world document, so the collision the runtime opens is exactly the collision
    the geography baked. Every rect must be fully solid at bake time (checked in
    `validate()`).
    """
    return {
        "broken_bridge": (tx - 3, ty - 1, tx + 3, ty + 1),
        "powered_conduit": (tx - 2, ty - 3, tx + 2, ty + 3),
        "rubble_block": (tx - 4, ty - 3, tx + 4, ty + 2),
        "gate_valve": (tx - 1, ty - 2, tx + 1, ty + 2),
    }[kind]


# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
def build_fields():
    """Elevation and wetness, then the base ground from their thresholds."""
    height = [[0.0] * W for _ in range(H)]
    wet = [[0.0] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            # the frontier climbs to the north
            north = max(0.0, 1.0 - y / 200.0)
            height[y][x] = 0.30 + 0.34 * fbm(x, y, seed=101, scale=58) + 0.34 * north
            wet[y][x] = 0.28 + 0.62 * fbm(x, y, seed=202, scale=44)
    return height, wet


def paint_base(height, wet):
    for y in range(H):
        for x in range(W):
            hv = height[y][x]
            wv = wet[y][x]
            if hv > 0.80:
                blend_put(ground, x, y, "r", "g", 0.05, hv, 0.80, seed=1)
            elif hv > 0.70:
                blend_put(ground, x, y, "g", "r", 0.05, hv, 0.70, seed=2)
            elif wv > 0.74:
                blend_put(ground, x, y, "b", ";", 0.05, wv, 0.74, seed=3)
            elif wv > 0.61:
                blend_put(ground, x, y, ";", "b", 0.05, wv, 0.61, seed=4)
            elif wv < 0.36:
                blend_put(ground, x, y, "d", ",", 0.05, wv, 0.36, seed=5)
            else:
                blend_put(ground, x, y, ",", ";", 0.06, wv, 0.50, seed=6)


def paint_landforms():
    # far mountains: a wall across the north, then down both flanks
    ridge([(-30, 10), (50, 4), (130, 12), (196, 4), (262, 8), (330, 2), (420, 10)], 10, seed=201)
    ridge([(376, -20), (382, 60), (372, 130), (378, 200), (370, 280)], 10, seed=202)
    ridge([(-20, -20), (-12, 60), (-8, 130), (4, 200), (-8, 280)], 10, seed=203)
    ridge([(330, 60), (344, 76), (352, 40), (366, 20)], 7, seed=204)

    # southern marsh: the sea of reeds the road turns away from
    for x, y in ellipse(196, 268, 250, 30, wobble=0.5, seed=210):
        blend_put(ground, x, y, "b", ";", 0.2, h01(211, x // 2, y // 2), 0.5, seed=212)
    for x, y in ellipse(196, 284, 250, 26, wobble=0.4, seed=213):
        put(solid, x, y, "#" if h01(214, x, y) < 0.55 else ".")

    # the western burial fields: pale dry ground, the oldest part of the frontier
    for x, y in ellipse(76, 156, 62, 54, wobble=0.55, seed=220):
        blend_put(ground, x, y, "d", ";", 0.18, fbm(x, y, seed=221, scale=14), 0.42, seed=222)

    # the central ruins: broken paving in a bowl of gravel
    for x, y in ellipse(132, 152, 32, 24, wobble=0.45, seed=230):
        blend_put(ground, x, y, "g", "f", 0.22, h01(231, x // 2, y // 2), 0.5, seed=232)
    for x, y in ellipse(130, 150, 21, 15, wobble=0.5, seed=233):
        if h01(234, x, y) < 0.72:
            put(ground, x, y, "f")

    # the sacred terraces climbing to the Reliquary
    for x, y in ellipse(200, 138, 34, 22, wobble=0.4, seed=240):
        blend_put(ground, x, y, "r", "f", 0.2, h01(241, x // 2, y // 2), 0.5, seed=242)
    for x, y in ellipse(199, 137, 22, 13, wobble=0.45, seed=243):
        put(ground, x, y, "f")

    # the ritual basin: a sunken bowl of ash with dried blood at its floor
    for x, y in ellipse(192, 194, 38, 24, wobble=0.45, seed=250):
        blend_put(ground, x, y, "a", "v", 0.18, h01(251, x // 2, y // 2), 0.45, seed=252)
    for x, y in ellipse(192, 194, 24, 14, wobble=0.5, seed=253):
        put(ground, x, y, "v")
    for x, y in ellipse(192, 194, 11, 6, wobble=0.5, seed=254):
        put(ground, x, y, "m")

    # the relay watershed: cold wet flats braided with conduit stone
    for x, y in ellipse(288, 142, 40, 30, wobble=0.45, seed=260):
        blend_put(ground, x, y, ";", "m", 0.2, fbm(x, y, seed=261, scale=16), 0.5, seed=262)
    for x, y in ellipse(292, 144, 26, 17, wobble=0.4, seed=263):
        blend_put(ground, x, y, "y", ";", 0.2, h01(264, x // 2, y // 2), 0.5, seed=265)

    # the watch ridge: bare wind-scoured rock above the tree line
    for x, y in ellipse(210, 84, 42, 24, wobble=0.4, seed=270):
        blend_put(ground, x, y, "r", "g", 0.22, fbm(x, y, seed=271, scale=12), 0.5, seed=272)
    for x, y in ellipse(208, 82, 24, 13, wobble=0.5, seed=273):
        if h01(274, x, y) < 0.7:
            put(ground, x, y, "g")

    # the northern precinct: the monastery's gravel court
    for x, y in ellipse(272, 74, 28, 18, wobble=0.4, seed=280):
        blend_put(ground, x, y, "g", "f", 0.2, h01(281, x // 2, y // 2), 0.5, seed=282)
    for x, y in ellipse(272, 74, 16, 10, wobble=0.5, seed=283):
        put(ground, x, y, "f")

    # the pass: wind-scoured stone squeezed between mountain walls
    for x, y in ellipse(214, 44, 34, 15, wobble=0.35, seed=290):
        blend_put(ground, x, y, "g", "r", 0.25, h01(291, x // 2, y // 2), 0.5, seed=292)
    # the citadel plateau
    for x, y in ellipse(284, 38, 30, 17, wobble=0.3, seed=293):
        put(ground, x, y, "f")

    # the southern refuge: a defended hollow on the last dry ground
    for x, y in ellipse(58, 220, 42, 19, wobble=0.4, seed=300):
        blend_put(ground, x, y, "d", "f", 0.22, h01(301, x // 2, y // 2), 0.5, seed=302)
    for x, y in ellipse(58, 222, 23, 11, wobble=0.45, seed=303):
        put(ground, x, y, "f")

    # the south-east fen: dead water nobody garrisons
    for x, y in ellipse(272, 216, 56, 26, wobble=0.5, seed=310):
        blend_put(ground, x, y, "b", "m", 0.22, fbm(x, y, seed=311, scale=13), 0.5, seed=312)


def paint_water():
    # the Soul Relay river: born in the northern mountains, feeds the basin,
    # drains through the southern fen
    river([(298, 8), (294, 30), (290, 52), (286, 74), (280, 96), (274, 118),
           (268, 136), (258, 156), (246, 172), (236, 186), (228, 200),
           (224, 214), (226, 232), (232, 252)], 2.6)
    # tributary out of the eastern hills
    river([(360, 122), (342, 130), (326, 138), (310, 142), (298, 143)], 1.8)
    # the crucible's overflow west into the fen
    river([(216, 210), (208, 218), (202, 228), (206, 244)], 1.8)
    # the thin stream the broken bridge crosses
    river([(152, 212), (166, 214), (182, 212), (196, 208), (210, 208)], 1.7)
    # the western spring above the ossuary ravines
    river([(42, 116), (52, 132), (58, 148), (54, 164), (48, 178)], 1.5)


def paint_barriers():
    # ossuary ravines: two steep walls the burial road threads between
    ridge([(26, 134), (44, 128), (58, 118), (76, 114)], 3.2, seed=401)
    ridge([(34, 162), (56, 158), (78, 150), (96, 148), (114, 140)], 2.8, seed=402)
    # the western march wall
    ridge([(8, 92), (12, 132), (8, 170), (14, 206), (10, 244)], 5.0, seed=403)
    # the archive's terraced retaining wall
    ridge([(110, 170), (126, 174), (144, 172), (158, 164)], 2.0, seed=404)
    # the terrace escarpment up to the Reliquary, with one stair at x=200
    escarp = list(polyline([(168, 156), (182, 160), (198, 162), (214, 160), (228, 154)], 2.2))
    for x, y, _t in escarp:
        if 196 <= x <= 204 and y > 158:
            continue
        put(solid, x, y, "#")
    # the crucible rim, with a throat on the north-west where the road enters
    rim = list(polyline([(158, 180), (162, 198), (172, 214), (190, 222), (210, 220),
                         (224, 208), (230, 192), (228, 176)], 2.0))
    for x, y, _t in rim:
        if (176 <= x <= 190 and y < 188) or (222 <= x <= 232 and 196 <= y <= 210):
            continue
        put(solid, x, y, "#")
    # the ridge that walls the basin off from the watershed
    ridge([(230, 184), (242, 172), (250, 160)], 1.8, seed=405)
    # the watch ridge's south face
    ridge([(150, 110), (168, 106), (186, 102), (196, 98)], 3.0, seed=406)
    ridge([(234, 98), (252, 94), (270, 94), (288, 98), (302, 106)], 2.4, seed=407)
    # the shelf the beacon stands above
    ridge([(184, 70), (204, 66), (226, 68), (244, 72)], 1.4, seed=408)
    # the northern mountain wall either side of the pass
    ridge([(142, 32), (162, 26), (178, 24)], 5.0, seed=409)
    ridge([(248, 24), (266, 26), (288, 22)], 4.4, seed=410)


def paint_forests():
    thicket(ellipse(96, 78, 34, 24, wobble=0.6, seed=501), 0.62, 502)
    thicket(ellipse(56, 62, 30, 22, wobble=0.6, seed=503), 0.5, 504)
    thicket(ellipse(338, 202, 26, 18, wobble=0.6, seed=505), 0.55, 506)
    thicket(ellipse(154, 234, 22, 12, wobble=0.6, seed=507), 0.45, 508)
    thicket(ellipse(118, 42, 22, 14, wobble=0.6, seed=509), 0.5, 510)
    thicket(ellipse(150, 96, 16, 10, wobble=0.6, seed=511), 0.4, 512)


def paint_roads():
    road([(58, 228), (64, 214), (72, 200), (82, 190), (88, 184)], 2.6, seed=601)
    road([(88, 184), (80, 168), (72, 154), (66, 142), (64, 132)], 2.4, seed=602)
    road([(64, 132), (78, 124), (94, 126), (108, 134), (120, 144), (130, 152)], 2.4, seed=603)
    road([(130, 152), (138, 168), (146, 182), (152, 190)], 2.4, seed=604)
    road([(152, 190), (166, 196), (180, 198), (192, 196)], 2.4, seed=605)
    road([(192, 196), (194, 182), (196, 168), (198, 154), (200, 142)], 2.4, seed=606)
    road([(130, 152), (146, 146), (162, 144), (178, 146), (194, 142)], 2.6, seed=607)
    road([(202, 140), (220, 140), (240, 144), (258, 146), (274, 146), (288, 144)], 2.6, seed=608)
    road([(288, 144), (280, 132), (270, 126), (258, 124), (246, 118), (234, 110),
          (220, 106), (208, 104)], 2.4, seed=609)
    road([(208, 104), (208, 96), (208, 88)], 2.2, seed=610)
    road([(210, 84), (224, 78), (240, 74), (256, 72), (270, 74)], 2.4, seed=611)
    road([(272, 74), (262, 64), (250, 56), (236, 50), (222, 46), (212, 44)], 2.4, seed=612)
    road([(212, 42), (228, 38), (246, 34), (262, 36), (276, 38)], 2.4, seed=613)
    # the south loop: refuge → basin → fen → crossroads
    road([(152, 190), (166, 204), (176, 208), (184, 210), (194, 214), (204, 220),
          (216, 224), (230, 214), (240, 200), (248, 184), (250, 166), (248, 152)], 2.2, seed=614)
    # the western loop: refuge → burial fields → crypt
    road([(58, 228), (44, 214), (36, 196), (40, 178), (56, 170), (74, 172), (86, 178)], 2.0, seed=615)
    # relay foot spur
    road([(248, 152), (262, 148), (276, 146), (288, 144)], 2.2, seed=616)
    # the alternate northern approach: ridge → around the east → divided reliquary
    road([(208, 84), (222, 92), (238, 92), (252, 86), (264, 78), (272, 74)], 2.0, seed=617)


def _regions():
    """region id -> (anchor, display label) for the first landmark naming it."""
    out = {}
    for lid, _level, _title, region, pos, _visual, _kind, _subtitle in LANDMARKS:
        out.setdefault(region, (pos, region.replace("_", " ").title()))
    return out


def prop_height_tiles(frame):
    """Sprite height in tiles, read from the generated prop index.

    Used to frame the capture stations and to keep the approach to a landmark
    proportionate to the building standing at the end of it.
    """
    meta = PROP_META.get(frame, {})
    return max(1, int(round(float(meta.get("h", 64)) / TILE)))


def paint_landmarks():
    for lid, level, title, region, (tx, ty), visual, kind, subtitle in LANDMARKS:
        plaza(tx, ty + 3, 13, seed=stable_seed(lid))
        # The building's base sits on the plaza's north edge and the paved
        # approach runs from the plaza up to the door. An earlier pass anchored
        # the sprite five tiles further north, which left an eight-tile empty
        # corridor between the player and the thing they came to see — at the
        # camera's 2x zoom the landmark was entirely off the top of the frame
        # while standing on its own threshold.
        approach([(tx, ty + 2), (tx, ty - 1)], 2.4)
        add_prop(visual, *tile_pos(tx, ty), lit=kind in ("fire", "ritual", "soul"))
        # each approach gets its own furniture so the silhouette has context
        if kind == "undead":
            for dx in (-9, 9):
                add_prop("sarcophagus", *tile_pos(tx + dx, ty + 1))
            for dx in (-6, 6):
                add_prop("brazier", *tile_pos(tx + dx, ty + 2), lit=True)
        elif kind == "bone":
            for dx in (-10, -8, 8, 10):
                add_prop("grave_cross" if dx % 4 == 0 else "gravestone", *tile_pos(tx + dx, ty + 2))
            add_prop("disc_bones", *tile_pos(tx - 5, ty + 4))
        elif kind == "knowledge":
            for dx in (-11, -9, 9, 11):
                add_prop("column_broken" if dx < 0 else "column", *tile_pos(tx + dx, ty + 2))
            add_prop("disc_lore", *tile_pos(tx + 7, ty + 5))
        elif kind == "sacred":
            for dx in (-12, 12):
                add_prop("column", *tile_pos(tx + dx, ty + 2))
            for dy in (2, 4):
                add_prop("statue", *tile_pos(tx - 8, ty + dy))
                add_prop("statue", *tile_pos(tx + 8, ty + dy))
        elif kind == "ritual":
            for dx in (-11, 11):
                add_prop("brazier", *tile_pos(tx + dx, ty + 3), lit=True)
            for dx in (-7, 7):
                add_prop("disc_sigils", *tile_pos(tx + dx, ty + 6))
        elif kind == "soul":
            for dx in (-13, 13):
                add_prop("lamp", *tile_pos(tx + dx, ty + 2), lit=True)
            add_prop("disc_shrine", *tile_pos(tx + 6, ty + 5))
        elif kind == "fire":
            for dx in (-8, 8):
                add_prop("brazier", *tile_pos(tx + dx, ty + 2), lit=True)
            add_prop("signpost", *tile_pos(tx - 6, ty + 5))
        elif kind == "schism":
            for dx in (-12, 12):
                add_prop("column", *tile_pos(tx + dx, ty + 2))
            add_prop("disc_lore", *tile_pos(tx - 6, ty + 5))
        elif kind == "military":
            for dx in (-14, 14):
                add_prop("brazier", *tile_pos(tx + dx, ty + 3), lit=True)
            for dx in (-9, 9):
                add_prop("wall_stub", *tile_pos(tx + dx, ty + 4))
        elif kind == "throne":
            for dx in (-15, 15):
                add_prop("statue", *tile_pos(tx + dx, ty + 3))
            for dx in (-10, 10):
                add_prop("brazier", *tile_pos(tx + dx, ty + 6), lit=True)


def paint_camps():
    for cid, name, (tx, ty), initial in CAMPS:
        for x, y in ellipse(tx, ty, 8, 5, wobble=0.4, seed=stable_seed(cid)):
            put(ground, x, y, "d")
            put(solid, x, y, ".")
        add_prop("camp_tent", *tile_pos(tx - 3, ty), z=1)
        add_prop("camp_fire", *tile_pos(tx, ty + 2), lit=True, z=1)
        add_prop("camp_bedroll", *tile_pos(tx + 3, ty + 1))
        add_prop("camp_banner", *tile_pos(tx + 5, ty - 1))
        add_prop("camp_crate", *tile_pos(tx - 5, ty + 2))
        add_prop("camp_trophies", *tile_pos(tx - 6, ty - 1))
        add_prop("barrel", *tile_pos(tx + 4, ty + 3))
        add_prop("fence", *tile_pos(tx - 8, ty + 3))


def paint_shortcuts():
    for sid, kind, (tx, ty), granted_by, (box_a, box_b), label in SHORTCUTS:
        # The prop is authored in two states; the runtime shows the one that
        # matches the save. The band below is the CLOSED state: solid at bake
        # time, cleared cell-for-cell by the runtime when the shortcut opens.
        x0, y0, x1, y1 = carve_rect(kind, tx, ty)
        if kind == "broken_bridge":
            add_prop("short_bridge", *tile_pos(tx, ty), flags=sid, z=1)
            for x in range(x0, x1 + 1):
                put(ground, x, ty, "-")
        elif kind == "powered_conduit":
            add_prop("short_conduit", *tile_pos(tx, ty), flags=sid, z=1)
            for x in range(x0, x1 + 1):
                put(ground, x, ty, "f")
        elif kind == "rubble_block":
            add_prop("short_rubble", *tile_pos(tx, ty), flags=sid, z=1)
            for x in range(x0, x1 + 1):
                for y in range(y0, y1 + 1):
                    put(ground, x, y, "g")
        elif kind == "gate_valve":
            add_prop("short_valve", *tile_pos(tx, ty), flags=sid, z=1)
            for x in range(tx - 4, tx + 5):
                for y in range(ty - 4, ty + 5):
                    put(solid, x, y, "W")
            for x in range(x0, x1 + 1):
                put(ground, x, ty, "f")
        block_rect(x0, y0, x1, y1)


def reinstate_shortcut_bands():
    """Re-block every shortcut band after the roads have been carved.

    `paint_roads()` runs after the shortcuts and clears solid cells to make the
    pilgrimage road continuous. A shortcut is defined by being the *break* in
    that road, so its band is reasserted here — the closed state is the authored
    band, never whatever the road pass happened to leave behind.
    """
    for sid, kind, (tx, ty), granted_by, (box_a, box_b), label in SHORTCUTS:
        block_rect(*carve_rect(kind, tx, ty))


def prop_body_cells(frame, x, y):
    """Cells the runtime body of this prop covers, in tile coordinates.

    Mirrors `OverworldWorld._add_prop_blocker` exactly: the body is the lower
    42% of the sprite (minimum 8 px) and 82% of its width, hung from the feet, and
    `_mark_body` marks every cell the rectangle touches. The bake has to use the
    same rule, or it will pass a world the player cannot walk.

    A frame that is not in the atlas, or that carries no collider, covers nothing.
    """
    if not frame.startswith(COLLIDER_PROP_PREFIXES):
        return set()
    meta = PROP_META.get(frame)
    if meta is None:
        return set()
    width = float(meta.get("w", 16))
    height = float(meta.get("h", 16))
    body_h = max(8.0, height * 0.42)
    body_w = max(8.0, width * 0.82)
    left = x - body_w * 0.5
    right = x + body_w * 0.5
    top = y - body_h
    bottom = y
    x0 = math.floor(left / TILE)
    x1 = math.floor(right / TILE)
    y0 = math.floor(top / TILE)
    y1 = math.floor(bottom / TILE)
    return {(cx, cy) for cx in range(x0, x1 + 1) for cy in range(y0, y1 + 1)}


def prop_body_occupancy():
    """Every cell covered by a prop collider, mapped to what covers it."""
    occupied = {}
    for entry in props:
        for cell in prop_body_cells(str(entry["frame"]),
                                    float(entry["x"]), float(entry["y"])):
            occupied.setdefault(cell, []).append(str(entry["frame"]))
    return occupied


## The cell the player spawns on: the plaza south of the refuge's campfire.
START = (56, 218)


def interaction_cells():
    """Cells a player must be able to stand on to interact with something.

    A blocking prop here is not a decoration, it is a missing reward: the pine
    that `validate()` caught standing on `d_ossuary_stash` would have held the
    player off the cell that claims it. The scatter keeps these clear.
    """
    cells = set()
    for lid, level, title, region, (tx, ty), visual, kind, subtitle in LANDMARKS:
        cells.add((tx, ty + 1))
    for cid, name, (tx, ty), initial in CAMPS:
        cells.add((tx, ty))
    for did, (tx, ty), kind, reward in DISCOVERIES:
        cells.add((tx, ty))
    cells.add(START)
    return cells


def paint_scatter():
    """Vegetation, grave furniture and ruins, kept off every walking lane."""
    # Reserved *exactly*: every interaction cell. The guard below is precise
    # instead of approximate — it asks whether the body this frame would build
    # covers a reserved cell, not whether its anchor tile is close to one. A dead
    # pine's trunk is 0.82 of its sprite wide and hangs two tiles up from its
    # feet, so "near enough to matter" is not a fixed halo: the tree that put
    # `d_crucible_cove` out of reach stood on the neighbouring tile, and the one
    # that did the same to `d_relay_shard` stood two tiles south.
    reserved = interaction_cells()

    def try_add(frame, x, y):
        """Add a prop only if its runtime body would not seal an interaction cell."""
        px, py = tile_pos(x, y)
        if prop_body_cells(frame, px, py) & reserved:
            return False
        add_prop(frame, px, py)
        return True
    lane = set()
    for x in range(W):
        for y in range(H):
            if get(detail, x, y) in ("=", "+", ":"):
                lane.add((x, y))
    corridor = set()
    for x, y in lane:
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                corridor.add((x + dx, y + dy))

    def free(x, y):
        return (get(solid, x, y) == "." and (x, y) not in corridor
                and (x, y) not in reserved
                and get(ground, x, y) not in ("f", "~", "-", "v", "y"))

    for y in range(H):
        for x in range(W):
            if not free(x, y):
                continue
            g = get(ground, x, y)
            r = h01(901, x, y)
            if g == ",":
                if r < 0.022:
                    try_add("tree_dead", x, y)
                elif r < 0.075:
                    try_add("bush", x, y)
                elif r < 0.095:
                    try_add("rock_a", x, y)
            elif g == ";":
                if r < 0.030:
                    try_add("tree_pine", x, y)
                elif r < 0.070:
                    try_add("bush", x, y)
                elif r < 0.085:
                    try_add("tree_dead", x, y)
            elif g == "d":
                if r < 0.030:
                    try_add("gravestone", x, y)
                elif r < 0.055:
                    try_add("grave_cross", x, y)
                elif r < 0.070:
                    try_add("rock_a", x, y)
                elif r < 0.078:
                    try_add("sarcophagus", x, y)
            elif g in ("g", "r"):
                if r < 0.028:
                    try_add("rock_b", x, y)
                elif r < 0.042:
                    try_add("rock_a", x, y)
                elif r < 0.050:
                    try_add("column_broken", x, y)
                elif r < 0.056:
                    try_add("wall_stub", x, y)
            elif g == "f":
                if r < 0.020:
                    try_add("column_broken", x, y)
                elif r < 0.028:
                    try_add("wall_stub", x, y)
                elif r < 0.034:
                    try_add("statue", x, y)
            elif g == "a":
                if r < 0.030:
                    try_add("rock_a", x, y)
                elif r < 0.045:
                    try_add("disc_bones", x, y)
            elif g == "b":
                if r < 0.050:
                    try_add("bush", x, y)
                elif r < 0.060:
                    try_add("tree_dead", x, y)
            elif g == "m":
                if r < 0.030:
                    try_add("tree_dead", x, y)

    # Fallen masonry on the plazas. The scatter above keeps a two-tile corridor
    # clear around every lane so nothing BLOCKING can pinch a road; that rule is
    # what left the wide flagstone plazas empty, because an approach lane runs
    # through the middle of each of them. This second pass fills that stone with
    # frames that carry no collider at all, so it can use a one-tile corridor and
    # still cannot narrow a road, block an approach or trap the player.
    # Only the lane cells themselves are excluded. Dilating this corridor by one
    # tile (as the collider-bearing pass above must) swallowed most of the plaza
    # stone, because an approach lane runs through the middle of every plaza -
    # the first attempt here added eight hundred props and still left the
    # crucible basin standing in an empty field. Debris on a road's edge is what
    # a ruined road looks like; debris in the walking line would be litter, so
    # the centre stays clean and nothing here can be walked into.
    tight = set(lane)
    # Density is clustered, not uniform: three-tile blocks that are "hot" carry a
    # debris field, the rest stay near-empty. An even 5% sprinkle of single rocks
    # reads as noise at the camera's 2x zoom; a cluster reads as something fell
    # here. None of these frames has a collider, so the tight corridor is enough.
    def hot(x, y, seed):
        return h01(seed, x // 3, y // 3) < 0.5

    for y in range(H):
        for x in range(W):
            if get(solid, x, y) != "." or (x, y) in tight or (x, y) in reserved:
                continue
            g = get(ground, x, y)
            r = h01(913, x, y)
            band = 0.085 if hot(x, y, 917) else 0.016
            if g in ("f", "g", "r", "a"):
                if r < band * 0.45:
                    try_add("rock_a", x, y)
                elif r < band * 0.85:
                    try_add("rock_b", x, y)
                elif g == "f" and r < band * 1.0:
                    try_add("barrel", x, y)
            elif g == "d":
                if r < band * 0.6:
                    try_add("grave_cross", x, y)
                elif r < band:
                    try_add("gravestone", x, y)
            elif g == "b":
                if r < band:
                    try_add("bush", x, y)

    # lamps along the principal road, at a readable interval
    main = [(58, 228), (64, 214), (72, 200), (82, 190), (88, 184), (80, 168), (72, 154),
            (66, 142), (64, 132), (78, 124), (94, 126), (108, 134), (120, 144), (130, 152),
            (146, 146), (162, 144), (178, 146), (194, 142), (202, 140), (220, 140),
            (240, 144), (258, 146), (274, 146), (288, 144)]
    for i in range(2, len(main), 3):
        ax, ay = main[i]
        side = 3 if i % 2 else -3
        add_prop("lamp", *tile_pos(ax + side, ay - 2), lit=True)

    # signposts at the two real forks
    add_prop("signpost", *tile_pos(146, 186))
    add_prop("signpost", *tile_pos(196, 144))
    add_prop("signpost", *tile_pos(210, 90))
    # a supply line at the refuge
    add_prop("cart", *tile_pos(50, 224))
    add_prop("barrel", *tile_pos(47, 222))
    add_prop("barrel", *tile_pos(48, 226))
    add_prop("fence", *tile_pos(66, 226))
    add_prop("fence", *tile_pos(70, 224))


def paint_discoveries():
    for did, (tx, ty), kind, reward in DISCOVERIES:
        frame = {"coin_cache": "disc_cache", "material_cache": "disc_cache",
                 "lore": "disc_lore", "shrine": "disc_shrine",
                 "sigil_cache": "disc_sigils"}.get(kind, "disc_cache")
        add_prop(frame, *tile_pos(tx, ty), flags=did,
                 lit=(kind in ("shrine", "sigil_cache")))
        for x, y in ellipse(tx, ty, 3, 2, seed=stable_seed(did)):
            if get(solid, x, y) == ".":
                put(ground, x, y, get(ground, x, y))


# ---------------------------------------------------------------------------
# validation
# ---------------------------------------------------------------------------
def walkable_grid(open_shortcuts):
    blocked = {"#", "W", "T", "!"}
    open_cells = set()
    if open_shortcuts:
        for sid, kind, (tx, ty), granted_by, (box_a, box_b), label in SHORTCUTS:
            x0, y0, x1, y1 = carve_rect(kind, tx, ty)
            for x in range(x0, x1 + 1):
                for y in range(y0, y1 + 1):
                    open_cells.add((x, y))

    def ok(x, y):
        if not inside(x, y):
            return False
        if (x, y) in open_cells:
            return True
        if get(solid, x, y) in blocked:
            return False
        if get(ground, x, y) == "~":
            return False
        return True
    return ok


def reachable(ok, start):
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n in seen or not ok(*n):
                continue
            seen.add(n)
            q.append(n)
    return seen


def validate():
    errors = []
    # One source of truth: the cell the world document tells the controller to
    # spawn on. This used to be a second hard-coded literal (56, 216) that had
    # already drifted from the document's (56, 218) — so the bake was checking a
    # cell nobody spawns on, and a prop body sat unnoticed on the real one.
    start = START
    for open_shortcuts in (False, True):
        ok = walkable_grid(open_shortcuts)
        seen = reachable(ok, start)
        tag = "shortcuts open" if open_shortcuts else "shortcuts closed"
        if start not in seen:
            errors.append("refuge start is not walkable")
        for lid, level, title, region, (tx, ty), visual, kind, subtitle in LANDMARKS:
            # the threshold is the cell the player stands on to interact
            th = (tx, ty + 1)
            if th not in seen:
                errors.append("%s threshold %s unreachable (%s)" % (title, th, tag))
        for cid, name, (tx, ty), initial in CAMPS:
            if (tx, ty) not in seen:
                errors.append("camp %s unreachable (%s)" % (name, tag))
        for did, (tx, ty), kind, reward in DISCOVERIES:
            if (tx, ty) not in seen:
                errors.append("discovery %s unreachable (%s)" % (did, tag))
        # no shortcut may be load-bearing for the critical path
        if not open_shortcuts and errors:
            break

    # A camp is safe ground by definition; a camp inside a hazard rect would make
    # the survival tick contradict the fiction it is standing on.
    for cid, name, (tx, ty), initial in CAMPS:
        for hazard in HAZARDS:
            hid, rect, label = hazard
            hx, hy, hw, hh = rect
            if hx <= tx < hx + hw and hy <= ty < hy + hh:
                errors.append("camp %s (%d,%d) sits inside hazard %s"
                              % (cid, tx, ty, hid))

    # Props: every frame must exist in the atlas, and nothing that carries a
    # collider may stand on the cell a player must occupy. The scatter keeps a
    # two-tile corridor clear and the plaza clutter uses non-collider frames only,
    # but both rules live in prose above; this is the assertion that they held.
    # COLLIDER_PROP_PREFIXES mirrors OverworldWorld.SOLID_PROP_PREFIXES.
    for entry in props:
        frame = str(entry["frame"])
        if frame in PROP_META:
            continue
        # Shortcuts are authored by their short id and resolved to a frame at
        # runtime (OverworldWorld.SHORTCUT_FRAME_ALIASES), so their base name is
        # expected to be absent from the atlas.
        if frame.startswith(tuple(SHORTCUT_ALIAS_KEYS)):
            continue
        errors.append("prop frame '%s' is not in the props atlas" % frame)
    must_be_free = {}
    for lid, level, title, region, (tx, ty), visual, kind, subtitle in LANDMARKS:
        must_be_free[(tx, ty + 1)] = "landmark %s threshold" % lid
    for cid, name, (tx, ty), initial in CAMPS:
        must_be_free[(tx, ty)] = "camp %s rest cell" % cid
    for did, (tx, ty), kind, reward in DISCOVERIES:
        must_be_free[(tx, ty)] = "discovery %s" % did
    must_be_free[start] = "refuge spawn"
    # Trees and camp furniture may not stand on a walking lane: they are pure
    # obstruction. Columns, statues and wall stubs are ruin *on* the paving and
    # are deliberately placed on it (they read as a fallen colonnade), and the
    # landmark, shortcut and tent frames are destinations, not clutter - so those
    # are checked only against interaction cells below.
    lane_cells = {(x, y) for x in range(W) for y in range(H)
                  if get(detail, x, y) in ("=", "+", ":")}
    LANE_BLOCKING = ("tree_dead", "tree_pine", "cart", "sarcophagus")
    for entry in props:
        frame = str(entry["frame"])
        tex = int((float(entry["x"]) - 8) // TILE)
        tey = int((float(entry["y"]) - 8) // TILE)
        if frame.startswith(LANE_BLOCKING) and (tex, tey) in lane_cells:
            errors.append("blocking prop '%s' at (%d,%d) stands in a walking lane"
                          % (frame, tex, tey))
        if not frame.startswith(COLLIDER_PROP_PREFIXES):
            continue
        if (tex, tey) in must_be_free:
            errors.append("blocking prop '%s' at (%d,%d) covers the %s"
                          % (frame, tex, tey, must_be_free[(tex, tey)]))

    # The same question, asked of the collider the runtime actually builds rather
    # than of the tile the prop is anchored on. A prop's body is 82% of its width
    # and hangs from its feet, so it routinely covers a neighbour: the assertion
    # above passed for years while a dead tree stood on a discovery cell.
    occupied = prop_body_occupancy()
    for cell, what in sorted(must_be_free.items()):
        for frame in occupied.get(cell, []):
            errors.append("prop body '%s' covers the %s at %s"
                          % (frame, what, cell))

    # Bodies are walls, so the flood has to walk around them too. This is the
    # authoring gate for the runtime traversability system: same 4-neighbour rule,
    # same result, but it runs at bake time, before anything ships.
    for open_shortcuts in (False, True):
        tag = "shortcuts open" if open_shortcuts else "shortcuts closed"
        terrain_ok = walkable_grid(open_shortcuts)
        body_ok = lambda x, y: terrain_ok(x, y) and (x, y) not in occupied
        seen = reachable(body_ok, start)
        for lid, level, title, region, (tx, ty), visual, kind, subtitle in LANDMARKS:
            if (tx, ty + 1) not in seen:
                errors.append("%s threshold %s is walled off by prop bodies (%s)"
                              % (title, (tx, ty + 1), tag))
        for cid, name, (tx, ty), initial in CAMPS:
            if (tx, ty) not in seen:
                errors.append("camp %s rest cell is walled off by prop bodies (%s)"
                              % (cid, tag))
        for did, (tx, ty), kind, reward in DISCOVERIES:
            if (tx, ty) not in seen:
                errors.append("discovery %s is walled off by prop bodies (%s)"
                              % (did, tag))

    # The band the runtime carves must be solid in the baked world, or the
    # "opened shortcut" would be a sprite swap over a wall that was never there.
    blocked = {"#", "W", "T", "!"}
    for sid, kind, (tx, ty), granted_by, (box_a, box_b), label in SHORTCUTS:
        x0, y0, x1, y1 = carve_rect(kind, tx, ty)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if get(solid, x, y) not in blocked:
                    errors.append("%s carve cell (%d,%d) is not solid while closed"
                                  % (sid, x, y))
    return errors


# ---------------------------------------------------------------------------
# masks + bake
# ---------------------------------------------------------------------------
MASKED_DETAIL = set("/|M=+:")


def neighbour_mask(layer, x, y, match):
    m = 0
    if match(get(layer, x, y - 1)):
        m |= 1
    if match(get(layer, x + 1, y)):
        m |= 2
    if match(get(layer, x, y + 1)):
        m |= 4
    if match(get(layer, x - 1, y)):
        m |= 8
    return m


def bake():
    gl = ["."] * (W * H)
    dl = ["."] * (W * H)
    sl = ["."] * (W * H)
    for y in range(H):
        for x in range(W):
            i = idx(x, y)
            g = ground[i]
            gl[i] = g
            d = detail[i]
            if d != "." and g != ".":
                if d in MASKED_DETAIL:
                    dl[i] = d + "%x" % neighbour_mask(detail, x, y, lambda c: c == d)
                else:
                    dl[i] = d
            if g in ("~", "-") and d == ".":
                land = 0
                if get(ground, x, y - 1) not in ("~", "-"):
                    land |= 1
                if get(ground, x + 1, y) not in ("~", "-"):
                    land |= 2
                if get(ground, x, y + 1) not in ("~", "-"):
                    land |= 4
                if get(ground, x - 1, y) not in ("~", "-"):
                    land |= 8
                if land:
                    dl[i] = "/%x" % land
            s = solid[i]
            if s != ".":
                sl[i] = s + "%x" % neighbour_mask(solid, x, y, lambda c: c != ".")
            elif g == "~":
                # deep water is impassable; its collider is a physics-only tile
                sl[i] = "!%x" % neighbour_mask(ground, x, y, lambda c: c == "~")
    return gl, dl, sl


def rle(cells):
    out = []
    prev = None
    count = 0
    for c in cells:
        if c == prev:
            count += 1
        else:
            if prev is not None:
                out.append([prev, count])
            prev = c
            count = 1
    if prev is not None:
        out.append([prev, count])
    return out


def write_json(document, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(document, f, indent=1, ensure_ascii=False)
        f.write("\n")


def world_document():
    return {
        "schema": "hollow_marches_overworld/v2",
        "world_id": "hollow_marches",
        "world_name": "The Hollow Marches",
        "world_name_vi": "Biên Vực Tàn Vong",
        "tile_size": TILE,
        "world_bounds": {"x": 0, "y": 0, "w": W, "h": H},
        "layers_path": "res://data/overworld/hollow_marches_layers.json",
        "props_path": "res://data/overworld/hollow_marches_props.json",
        "tiles_path": "res://data/overworld/overworld_tiles.json",
        "tiles_texture": "res://assets/environment/overworld/overworld_tiles.png",
        "props_texture": "res://assets/environment/overworld/overworld_props.png",
        "light_texture": "res://assets/environment/overworld/light_radial.png",
        "camera_default": {"zoom": 2.0},
        "default_tint": [0.88, 0.85, 0.93, 1.0],
        "refuge": {"id": "refuge_start", "label": "Ashen Refuge", "pos": [56, 218]},
        "start_position": [START[0], START[1]],
        # Region labels used by the HUD. The runtime assigns a position to the
        # nearest landmark and reads its region label from here, so the roster of
        # named places lives in exactly one file.
        "regions": [
            {
                "id": rid,
                "label": label,
                "anchor": list(anchor),
                "landmarks": [lid for lid, _l, _t, r, _p, _v, _k, _s in LANDMARKS if r == rid],
            }
            for rid, (anchor, label) in _regions().items()
        ],
        "landmarks": [
            {
                "id": lid,
                "campaign_level_id": level,
                "title": title,
                "subtitle": subtitle,
                "region": region,
                "visual": visual,
                "kind": kind,
                "pos": [tx, ty],
                "threshold": [tx, ty + 1],
                "facing": "up",
                # Framing for the capture stations: put the camera far enough
                # south that the whole silhouette fits under the frame's top
                # edge (the view is 11.25 tiles tall at zoom 2).
                "capture_offset": [0, 5 - prop_height_tiles(visual)],
            }
            for lid, level, title, region, (tx, ty), visual, kind, subtitle in LANDMARKS
        ],
        "camps": [
            {"id": cid, "name": name, "pos": [tx, ty], "initial": initial}
            for cid, name, (tx, ty), initial in CAMPS
        ],
        "discoveries": [
            {"id": did, "pos": [tx, ty], "kind": kind, "reward": reward}
            for did, (tx, ty), kind, reward in DISCOVERIES
        ],
        "shortcuts": [
            {"id": sid, "kind": kind, "pos": [tx, ty], "granted_by": level,
             "carve": list(carve_rect(kind, tx, ty)), "label": label}
            for sid, kind, (tx, ty), level, box, label in SHORTCUTS
        ],
        "survival": {
            "resource_id": "provisions",
            "resource_label": "Provisions",
            "max": 100,
            "start": 80,
            "drain_per_second_wild": 0.22,
            "drain_per_second_safe": 0.0,
            "drain_per_second_hazard": 0.75,
            "camp_restore": 60,
            "discovery_restore": 20,
        },
        "hazards": [
            {"id": hid, "rect": list(rect), "label": label}
            for hid, rect, label in HAZARDS
        ],
    }


def landmark_registry():
    return {
        "schema": "overworld_landmark_registry/v2",
        "landmarks": {
            level: {
                "world_id": lid,
                "title": title,
                "tier": i + 1,
                "region": region,
                "threshold": [tx, ty + 1],
            }
            for i, (lid, level, title, region, (tx, ty), visual, kind, subtitle) in enumerate(LANDMARKS)
        },
        "camp_levels_by_world_id": {lid: level for lid, level, *_ in LANDMARKS},
    }


def main():
    paint_base(*build_fields())
    paint_landforms()
    paint_water()
    paint_barriers()
    paint_forests()
    paint_landmarks()
    paint_camps()
    paint_shortcuts()
    paint_discoveries()
    paint_roads()
    paint_scatter()
    reinstate_shortcut_bands()

    errors = validate()
    if errors:
        for e in errors:
            print("UNREACHABLE:", e, file=sys.stderr)
        print("%d reachability errors — refusing to bake" % len(errors), file=sys.stderr)
        return 1

    gl, dl, sl = bake()
    os.makedirs(DATA_DIR, exist_ok=True)
    write_json({
        "schema": "hollow_marches_layers/v1",
        "tile_size": TILE,
        "width": W,
        "height": H,
        "layers": {
            "ground": {"rle": rle(gl)},
            "detail": {"rle": rle(dl)},
            "solid": {"rle": rle(sl)},
        },
    }, os.path.join(DATA_DIR, "hollow_marches_layers.json"))
    write_json({"schema": "hollow_marches_props/v1", "props": props},
               os.path.join(DATA_DIR, "hollow_marches_props.json"))
    write_json(world_document(), os.path.join(DATA_DIR, "hollow_marches.json"))
    write_json(landmark_registry(), os.path.join(DATA_DIR, "landmark_registry.json"))

    counts = {}
    for c in gl:
        counts[c] = counts.get(c, 0) + 1
    print("ground:", " ".join("%s=%d" % (k, v) for k, v in sorted(counts.items(), key=lambda kv: -kv[1])))
    print("solid cells %d, detail cells %d, props %d" %
          (sum(1 for c in sl if c != "."), sum(1 for c in dl if c != "."), len(props)))
    print("baked OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
