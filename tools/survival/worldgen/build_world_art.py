#!/usr/bin/env python3
"""Build the A1 survival-world art atlas (original pixel art + pinned inherited frames).

This is an art bake, not a renderer. It writes a small curated atlas consumed by
`game/world_art/world_art_presentation.gd` and by authoring previews. It never
rewrites the legacy overworld atlas, collision, POI anchors, A3 economy or Gold.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "assets/environment/survival_world"
DATA = ROOT / "data/survival/world/art"
T = 16

# Shared material culture. Biomes change ground/ecology, not the masonry grammar.
P = {
    "ink": "#26212b", "ink_soft": "#3a3340",
    "stone_d": "#4d4856", "stone": "#716b7a", "stone_l": "#9c95a3", "stone_h": "#c2bac6",
    "wood_d": "#4a3326", "wood": "#7b5437", "wood_l": "#a97c4e", "wood_h": "#c99e68",
    "iron_d": "#3c434d", "iron": "#78838d", "iron_l": "#b9c3c8",
    "cloth_d": "#71352d", "cloth": "#a34f3c", "cloth_l": "#cf7a55",
    "canvas_d": "#8f7d58", "canvas": "#c3b184", "canvas_l": "#e2d2a4",
    "ash_d": "#4a4442", "ash": "#615a55", "ash_l": "#7b7268",
    "moor_d": "#45503f", "moor": "#5c6a4c", "moor_l": "#7d8a5e",
    "soil_d": "#54432f", "soil": "#6f5940", "soil_l": "#8f7552",
    "grass_d": "#405638", "grass": "#5b7544", "grass_l": "#7f9857", "grass_h": "#a7b873",
    "leaf_d": "#33492e", "leaf": "#4f6d3a", "leaf_l": "#71914b", "leaf_h": "#9db464",
    "fruit": "#c9783f", "fruit_l": "#e8a75c",
    "snow_d": "#7f93a0", "snow": "#a8bac4", "snow_l": "#d3e0e6", "snow_h": "#eef6f8",
    "ice_d": "#4b7d96", "ice": "#78a9bd", "ice_l": "#b6dde6",
    "basalt_d": "#3b3f4a", "basalt": "#565c69", "basalt_l": "#767e8c",
    "water_d": "#274557", "water": "#38657c", "water_l": "#5d93a8", "water_h": "#9ccbd4",
    "moss_d": "#3d5039", "moss": "#5f7a49", "moss_l": "#8aa35e",
    "soul_d": "#2c6b66", "soul": "#54c7b4", "soul_l": "#a5f2df",
    "fire_d": "#a85a2a", "fire": "#f0ad4e", "fire_l": "#ffe29a",
    "ore": "#b07a4e", "ore_l": "#e0b077",
    "herb": "#6fae8a", "herb_l": "#b7e3b0",
}


def rgba(key: str, a: int = 255) -> tuple:
    h = P[key].lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def C(key: str) -> tuple:
    return rgba(key)


def new(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def rect(im, x, y, w, h, c):
    ImageDraw.Draw(im).rectangle((x, y, x + w - 1, y + h - 1), fill=c)


def poly(im, pts, c):
    ImageDraw.Draw(im).polygon(pts, fill=c)


def line(im, pts, c, w=1):
    ImageDraw.Draw(im).line(pts, fill=c, width=w)


def ell(im, x, y, w, h, c):
    ImageDraw.Draw(im).ellipse((x, y, x + w - 1, y + h - 1), fill=c)


def px(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((int(x), int(y)), c)


def h01(*vals) -> float:
    h = 2166136261
    for v in vals:
        h ^= int(v) & 0xFFFFFFFF
        h = (h * 16777619) & 0xFFFFFFFF
    h ^= h >> 16; h = (h * 0x85EBCA6B) & 0xFFFFFFFF; h ^= h >> 13
    return (h & 0xFFFFFF) / 0xFFFFFF


def ground(style: str, variant: int) -> Image.Image:
    im = new(T, T)
    pal = {
        "ash": ("ash_d", "ash", "ash_l"), "moor": ("moor_d", "moor", "moor_l"),
        "soil": ("soil_d", "soil", "soil_l"), "grass": ("grass_d", "grass", "grass_l"),
        "forest": ("moor_d", "moor", "moor_l"), "snow": ("snow_d", "snow", "snow_l"),
        "tundra": ("basalt_d", "basalt", "snow_d"), "basalt": ("basalt_d", "basalt", "basalt_l"),
        "gravel": ("stone_d", "stone", "stone_l"), "water": ("water_d", "water", "water_l"),
        "ice": ("ice_d", "ice", "ice_l"),
    }
    dk, md, hi = pal[style]
    # Calm material fields: variant marks are low-contrast clusters, not static.
    def mix(a: str, b: str, t: float) -> tuple:
        ca, cb = C(a), C(b)
        return tuple(int(ca[i] + (cb[i] - ca[i]) * t) for i in range(3)) + (255,)
    if style in ("ash", "gravel", "basalt", "soil"):
        hi_c, dk_c = mix(md, hi, 0.30), mix(md, dk, 0.35)
    elif style == "snow":
        hi_c, dk_c = mix(md, hi, 0.45), mix(md, dk, 0.35)
    elif style in ("grass", "moor", "forest"):
        hi_c, dk_c = mix(md, hi, 0.55), mix(md, dk, 0.45)
    else:
        hi_c, dk_c = C(hi), C(dk)
    rect(im, 0, 0, T, T, C(md))
    marks = [(4, 5), (11, 4), (7, 11)]
    for i, (x, y) in enumerate(marks):
        x = (x + variant * 4) % 13
        y = (y + variant * 5) % 13
        if style == "forest":
            poly(im, [(x, y + 1), (x + 2, y), (x + 3, y + 2), (x + 1, y + 3)], hi_c)
            px(im, x + 1, y + 1, dk_c)
        elif style in ("grass", "moor"):
            line(im, [(x, y + 2), (x + 1, y)], hi_c)
            line(im, [(x + 2, y + 2), (x + 2, y + 1)], dk_c)
        elif style == "snow":
            line(im, [(x, y + 1), (x + 4, y)], hi_c)
            if i == 0:
                line(im, [(x + 1, y + 3), (x + 5, y + 2)], dk_c)
        elif style == "tundra":
            poly(im, [(x, y), (x + 3, y), (x + 4, y + 1), (x + 1, y + 2)], hi_c)
            px(im, x + 1, y + 1, dk_c)
        elif style == "water":
            if i % 2 == 0:
                line(im, [(x, y), (x + 4, y)], hi_c)
        elif style == "ice":
            line(im, [(x, y), (x + 3, y + 2), (x + 5, y + 1)], hi_c)
        elif style in ("basalt", "gravel"):
            poly(im, [(x, y), (x + 3, y), (x + 4, y + 2), (x + 1, y + 3)], hi_c if i % 2 else dk_c)
        else:
            rect(im, x, y, 3, 1, hi_c if i % 2 else dk_c)
    return im


def transition(a: Image.Image, b: Image.Image, mask: int) -> Image.Image:
    """Corner blend: 1=NW,2=NE,4=SE,8=SW. Stepped 2 px edge, no smooth gradient."""
    im = a.copy()
    quads = [(0, 0, 8, 8), (8, 0, 8, 8), (8, 8, 8, 8), (0, 8, 8, 8)]
    for i, (x, y, w, h) in enumerate(quads):
        if mask & (1 << i):
            im.paste(b.crop((x, y, x + w, y + h)), (x, y))
    # soften the cross seam with material pixels only
    if mask in (3, 12, 5, 10, 7, 11, 13, 14, 15):
        for k in range(0, 16, 3):
            if mask & 1 and k < 8: px(im, k, 8, b.getpixel((k, 7)))
            if mask & 4 and k >= 8: px(im, k, 7, b.getpixel((k, 8)))
    return im


def road(mask: int, stone: bool = False) -> Image.Image:
    im = new(T, T)
    base, hi, dk = (C("stone"), C("stone_l"), C("stone_d")) if stone else (C("soil"), C("soil_l"), C("soil_d"))
    # center plus connected arms; missing sides get a ragged fringe
    rect(im, 2, 2, 12, 12, base)
    if mask & 1: rect(im, 2, 0, 12, 3, base)
    if mask & 2: rect(im, 13, 2, 3, 12, base)
    if mask & 4: rect(im, 2, 13, 12, 3, base)
    if mask & 8: rect(im, 0, 2, 3, 12, base)
    for x, y in [(3, 4), (8, 3), (11, 8), (5, 11), (9, 12), (2, 8)]:
        px(im, x, y, hi); px(im, x + 1, y + 1, dk)
    if stone:
        line(im, [(2, 7), (13, 7)], dk); line(im, [(7, 2), (7, 6)], dk); line(im, [(10, 8), (10, 13)], dk)
    else:
        if mask & 5: line(im, [(6, 1), (6, 14)], dk); line(im, [(10, 1), (10, 14)], dk)
        if mask & 10: line(im, [(1, 6), (14, 6)], dk); line(im, [(1, 10), (14, 10)], dk)
    return im


def court(variant: int) -> Image.Image:
    im = ground("gravel", variant)
    for y in (1, 9):
        off = 0 if y == 1 else 5
        for x in range(-off, 16, 8):
            rect(im, x, y, 7, 6, C("stone"))
            line(im, [(x, y), (x + 6, y)], C("stone_l"))
            line(im, [(x, y + 5), (x + 6, y + 5)], C("stone_d"))
            px(im, x + 2, y + 2, C("stone_l"))
    return im


def bank(mask: int) -> Image.Image:
    im = new(T, T)
    # transparent shore overlay; bits mark land side
    if mask & 1: rect(im, 0, 0, 16, 3, C("soil_l")); line(im, [(0, 3), (15, 3)], C("water_h"))
    if mask & 4: rect(im, 0, 13, 16, 3, C("soil_l")); line(im, [(0, 12), (15, 12)], C("water_h"))
    if mask & 8: rect(im, 0, 0, 3, 16, C("soil_l")); line(im, [(3, 0), (3, 15)], C("water_h"))
    if mask & 2: rect(im, 13, 0, 3, 16, C("soil_l")); line(im, [(12, 0), (12, 15)], C("water_h"))
    return im



def shore(a: Image.Image, b: Image.Image, direction: int) -> Image.Image:
    """Feathered 3px band of material b on one cardinal edge of material a."""
    im = a.copy()
    if direction & 1:  # N
        for x in range(16):
            im.putpixel((x, 0), b.getpixel((x, 0)))
            im.putpixel((x, 1), b.getpixel((x, 1)))
            if (x // 2) % 2 == 0: im.putpixel((x, 2), b.getpixel((x, 2)))
    if direction & 4:  # S
        for x in range(16):
            im.putpixel((x, 15), b.getpixel((x, 15)))
            im.putpixel((x, 14), b.getpixel((x, 14)))
            if (x // 2) % 2 == 1: im.putpixel((x, 13), b.getpixel((x, 13)))
    if direction & 8:  # W
        for y in range(16):
            im.putpixel((0, y), b.getpixel((0, y)))
            im.putpixel((1, y), b.getpixel((1, y)))
            if (y // 2) % 2 == 0: im.putpixel((2, y), b.getpixel((2, y)))
    if direction & 2:  # E
        for y in range(16):
            im.putpixel((15, y), b.getpixel((15, y)))
            im.putpixel((14, y), b.getpixel((14, y)))
            if (y // 2) % 2 == 1: im.putpixel((13, y), b.getpixel((13, y)))
    return im

# ---- props ---------------------------------------------------------------

def shadow(im, w, h=None):
    h = h or max(4, im.height // 8)
    ell(im, im.width // 2 - w // 2, im.height - h - 1, w, h, (20, 16, 24, 90))


def tree_broad(kind: str) -> Image.Image:
    im = new(48, 64); shadow(im, 34, 8)
    rect(im, 21, 36, 6, 25, C("wood_d")); rect(im, 23, 36, 3, 24, C("wood"))
    line(im, [(24, 44), (15, 34)], C("wood_d"), 2); line(im, [(25, 40), (34, 30)], C("wood_d"), 2)
    dk, md, hi, hh = ("leaf_d", "leaf", "leaf_l", "leaf_h") if kind == "amber" else ("moor_d", "moor", "moor_l", "grass_h")
    blobs = [(8, 18, 20, 18), (22, 12, 20, 20), (14, 4, 22, 20), (4, 26, 18, 14), (28, 24, 16, 14)]
    for x, y, w, h in blobs:
        ell(im, x + 1, y + 2, w, h, C(dk)); ell(im, x, y, w, h, C(md))
    for x, y in [(14, 10), (26, 8), (34, 18), (10, 24), (22, 20), (30, 30)]:
        ell(im, x, y, 7, 5, C(hi)); px(im, x + 2, y + 1, C(hh))
    if kind == "orchard":
        for x, y in [(15, 22), (30, 16), (24, 30), (36, 28)]:
            ell(im, x, y, 3, 3, C("fruit")); px(im, x, y, C("fruit_l"))
        # graft tape is a deliberate human mark, not loot glow
        rect(im, 22, 42, 5, 2, C("canvas_l"))
    return im


def tree_frost(small=False) -> Image.Image:
    im = new(28 if small else 40, 44 if small else 64); shadow(im, im.width - 10, 7)
    cx = im.width // 2
    rect(im, cx - 2, im.height - 18, 4, 17, C("wood_d")); rect(im, cx - 1, im.height - 18, 2, 16, C("wood"))
    tiers = [(im.height - 16, im.width - 4), (im.height - 28, im.width - 10), (im.height - 40, im.width - 18)] if not small else [(im.height - 14, im.width - 4), (im.height - 26, im.width - 10), (im.height - 36, im.width - 18)]
    for y, w in tiers:
        poly(im, [(cx, y - 12), (cx - w // 2, y), (cx + w // 2, y)], C("leaf_d"))
        poly(im, [(cx, y - 10), (cx - w // 2 + 3, y - 2), (cx + w // 2 - 3, y - 2)], C("leaf"))
        poly(im, [(cx, y - 10), (cx - w // 2 + 4, y - 4), (cx + 2, y - 4)], C("snow"))
        line(im, [(cx - w // 2 + 4, y - 3), (cx + w // 2 - 4, y - 3)], C("snow_l"))
    return im


def fern() -> Image.Image:
    im = new(20, 14)
    for dx in (-6, -3, 0, 3, 6):
        line(im, [(10, 13), (10 + dx, 3 + abs(dx) // 2)], C("leaf"))
        line(im, [(10 + dx, 5 + abs(dx) // 2), (10 + dx - 2, 4 + abs(dx) // 2)], C("leaf_l"))
    return im


def reeds() -> Image.Image:
    im = new(22, 24)
    for x, h in [(4, 18), (8, 22), (12, 16), (16, 20), (19, 14)]:
        line(im, [(x, 23), (x - 1, 23 - h)], C("moor_l"))
        rect(im, x - 2, 22 - h, 2, 4, C("wood_l"))
    return im


def cache(state: str) -> Image.Image:
    im = new(26, 24); shadow(im, 22, 5)
    rect(im, 3, 9, 20, 12, C("wood_d")); rect(im, 4, 10, 18, 10, C("wood"))
    for x in (5, 11, 17): rect(im, x, 10, 2, 10, C("wood_l"))
    rect(im, 3, 13, 20, 2, C("iron_d")); rect(im, 4, 13, 18, 1, C("iron"))
    if state == "open":
        poly(im, [(3, 9), (6, 2), (23, 2), (23, 8)], C("wood_d")); poly(im, [(5, 8), (7, 3), (22, 3), (22, 7)], C("wood_l"))
        rect(im, 6, 10, 14, 3, C("ink")); rect(im, 8, 11, 4, 1, C("canvas"))
    else:
        rect(im, 3, 6, 20, 5, C("wood_d")); rect(im, 4, 6, 18, 4, C("wood_l"))
        rect(im, 11, 8, 4, 6, C("iron_d")); rect(im, 12, 9, 2, 3, C("iron_l"))
        if state == "spent":
            line(im, [(6, 7), (19, 10)], C("ink_soft"), 1)
    # supply seal: dried cloth + stamped iron, not a rarity beam
    rect(im, 17, 10, 4, 5, C("cloth")); px(im, 18, 11, C("canvas_l"))
    return im



def cache_notes(state: str) -> Image.Image:
    """Research-notes crate: pale paper stack + leather strap + wax seal.
    Deliberately no iron latch / no rarity glow so a newcomer reads 'notes',
    not 'loot chest'. Reward authority stays A3; this is pickup readability only."""
    im = new(26, 24); shadow(im, 22, 5)
    rect(im, 3, 10, 20, 11, C("wood_d")); rect(im, 4, 11, 18, 9, C("canvas_d"))
    # paper stack lifting out of the box
    for i, y in enumerate((6, 8, 10)):
        rect(im, 6 + i, y, 14 - i, 3, C("canvas_l") if i % 2 == 0 else C("canvas"))
        line(im, [(8 + i, y + 1), (17 - i, y + 1)], C("stone_l"))
    # leather strap + wax seal (not an iron latch)
    rect(im, 11, 6, 3, 15, C("cloth_d")); px(im, 12, 13, C("cloth"))
    ell(im, 10, 12, 5, 4, C("cloth")); px(im, 11, 13, C("cloth_l"))
    if state == "open":
        poly(im, [(3, 10), (6, 3), (23, 3), (23, 9)], C("canvas_d"))
        rect(im, 7, 11, 12, 3, C("ink_soft"))
    return im

def deadfall() -> Image.Image:
    im = new(34, 22); shadow(im, 30, 5)
    for x, y, l in [(2, 12, 22), (8, 8, 24), (4, 16, 18)]:
        rect(im, x, y, l, 4, C("wood_d")); rect(im, x + 1, y, l - 2, 3, C("wood"))
        ell(im, x + l - 4, y, 4, 4, C("wood_l")); px(im, x + l - 2, y + 2, C("wood_d"))
    line(im, [(12, 6), (18, 2)], C("wood_d"), 2)
    return im


def stump() -> Image.Image:
    im = new(20, 18); shadow(im, 16, 4)
    rect(im, 4, 8, 12, 8, C("wood_d")); ell(im, 4, 5, 12, 6, C("wood_l")); ell(im, 7, 6, 6, 3, C("wood"))
    line(im, [(10, 7), (15, 2)], C("iron_d"), 2); rect(im, 14, 1, 4, 3, C("iron_l"))
    return im


def handcart() -> Image.Image:
    im = new(46, 30); shadow(im, 40, 6)
    ell(im, 5, 18, 10, 10, C("ink")); ell(im, 7, 20, 6, 6, C("wood_l"))
    ell(im, 30, 18, 10, 10, C("ink")); ell(im, 32, 20, 6, 6, C("wood_l"))
    poly(im, [(4, 10), (36, 8), (40, 18), (8, 20)], C("wood_d")); poly(im, [(6, 10), (35, 9), (38, 16), (9, 18)], C("wood"))
    for x in (10, 18, 26, 34): line(im, [(x, 10), (x + 2, 17)], C("wood_l"))
    line(im, [(38, 12), (45, 6)], C("wood_d"), 2)
    rect(im, 12, 4, 12, 7, C("canvas_d")); rect(im, 13, 4, 10, 6, C("canvas"))
    return im


def tarp_shelter() -> Image.Image:
    im = new(64, 46); shadow(im, 56, 7)
    line(im, [(8, 44), (8, 16)], C("wood_d"), 2); line(im, [(56, 44), (56, 16)], C("wood_d"), 2)
    poly(im, [(4, 18), (32, 4), (60, 18), (56, 24), (8, 24)], C("canvas_d"))
    poly(im, [(6, 17), (32, 6), (58, 17), (54, 21), (10, 21)], C("canvas"))
    line(im, [(32, 6), (32, 21)], C("canvas_l"))
    rect(im, 18, 28, 26, 12, C("wood_d")); rect(im, 20, 28, 22, 10, C("wood"))
    rect(im, 24, 24, 10, 6, C("cloth")); rect(im, 36, 26, 6, 6, C("iron_d"))
    return im


def waystation() -> Image.Image:
    """Open-front salvage awning. Floor remains traversable; existing slice bodies are the only collision."""
    im = new(160, 104); shadow(im, 144, 10)
    # stone plinth / back counter
    rect(im, 12, 78, 136, 18, C("stone_d")); rect(im, 14, 78, 132, 14, C("stone"))
    for x in range(16, 144, 16): line(im, [(x, 79), (x, 91)], C("stone_d")); px(im, x + 3, 81, C("stone_l"))
    # timber posts aligned to existing counter/desk zone, open front
    for x in (20, 136):
        rect(im, x, 34, 6, 48, C("wood_d")); rect(im, x + 1, 34, 3, 47, C("wood"))
    # sloped canvas roof, front edge high enough to keep stands visible
    poly(im, [(8, 38), (30, 10), (130, 10), (152, 38), (146, 46), (14, 46)], C("ink"))
    poly(im, [(12, 37), (32, 13), (128, 13), (148, 37), (143, 42), (17, 42)], C("cloth_d"))
    poly(im, [(16, 36), (34, 16), (126, 16), (144, 36), (140, 39), (20, 39)], C("cloth"))
    for x in (44, 76, 108): line(im, [(x, 16), (x - 6, 39)], C("cloth_l"), 2)
    line(im, [(18, 40), (142, 40)], C("canvas_d"), 2)
    # hanging sign: hammer + seal, no text label
    rect(im, 68, 44, 24, 16, C("wood_d")); rect(im, 70, 45, 20, 13, C("wood_l"))
    line(im, [(76, 54), (84, 48)], C("iron_d"), 2); rect(im, 82, 46, 5, 4, C("iron_l"))
    ell(im, 74, 50, 5, 5, C("soul_d")); px(im, 75, 51, C("soul_l"))
    # work counter and tools under roof
    rect(im, 48, 66, 64, 12, C("wood_d")); rect(im, 50, 66, 60, 9, C("wood"))
    rect(im, 54, 62, 12, 5, C("iron_d")); rect(im, 56, 62, 8, 3, C("iron_l"))
    rect(im, 88, 60, 14, 8, C("canvas_d")); rect(im, 90, 61, 10, 6, C("canvas"))
    line(im, [(72, 64), (78, 58)], C("wood_l"), 2)
    # lamp on right post
    rect(im, 132, 48, 8, 10, C("iron_d")); rect(im, 134, 50, 4, 6, C("fire")); px(im, 135, 51, C("fire_l"))
    # chimney + thin smoke: a worked hearth, unmistakably a building not a crate
    rect(im, 112, 2, 10, 16, C("stone_d")); rect(im, 113, 2, 8, 3, C("stone_l"))
    for sx, sy, sa in [(116, 0, 90), (119, -0, 60)]:
        px(im, sx, sy, (200, 200, 205, sa))
    # roof ridge banner pole + pennant
    rect(im, 79, 2, 2, 12, C("wood_d"))
    poly(im, [(81, 3), (95, 6), (81, 9)], C("cloth")); px(im, 83, 6, C("canvas_l"))
    # warm service window on the back wall (shelter, not loot glow)
    rect(im, 26, 52, 14, 12, C("wood_d")); rect(im, 28, 54, 10, 8, C("fire_d"))
    rect(im, 29, 55, 8, 6, C("fire")); px(im, 31, 56, C("fire_l"))
    line(im, [(33, 54), (33, 62)], C("wood_d"))
    # stacked supply crates at left shoulder: supply hub silhouette
    rect(im, 2, 66, 16, 12, C("wood_d")); rect(im, 3, 67, 14, 10, C("wood"))
    rect(im, 4, 56, 12, 10, C("wood_d")); rect(im, 5, 57, 10, 8, C("wood_l"))
    line(im, [(4, 71), (17, 71)], C("iron_d"))
    return im


def banner() -> Image.Image:
    im = new(18, 42)
    rect(im, 8, 2, 2, 38, C("wood_d")); line(im, [(3, 4), (15, 4)], C("wood_d"), 2)
    poly(im, [(4, 6), (14, 6), (14, 26), (9, 22), (4, 26)], C("cloth_d"))
    poly(im, [(5, 7), (13, 7), (13, 23), (9, 20), (5, 23)], C("cloth"))
    ell(im, 7, 11, 4, 4, C("canvas_l"))
    return im


def lamp() -> Image.Image:
    im = new(16, 34)
    rect(im, 7, 12, 2, 20, C("iron_d")); rect(im, 4, 6, 8, 10, C("iron_d"))
    rect(im, 5, 7, 6, 7, C("fire")); rect(im, 6, 8, 3, 4, C("fire_l"))
    rect(im, 3, 5, 10, 2, C("iron")); rect(im, 5, 16, 6, 2, C("iron_d"))
    return im


def fence(horizontal=True) -> Image.Image:
    im = new(34, 20) if horizontal else new(20, 34)
    if horizontal:
        for x in (2, 30): rect(im, x, 4, 3, 15, C("wood_d"))
        rect(im, 2, 7, 31, 2, C("wood")); rect(im, 2, 13, 31, 2, C("wood"))
    else:
        for y in (2, 30): rect(im, 4, y, 15, 3, C("wood_d"))
        rect(im, 7, 2, 2, 31, C("wood")); rect(im, 13, 2, 2, 31, C("wood"))
    return im


def cairn(warning=False) -> Image.Image:
    im = new(24, 30); shadow(im, 20, 5)
    for x, y, w, h in [(3, 22, 18, 6), (5, 16, 14, 6), (7, 10, 10, 6), (9, 5, 6, 5)]:
        rect(im, x, y, w, h, C("stone_d")); rect(im, x + 1, y, w - 2, h - 2, C("stone")); px(im, x + 2, y + 1, C("stone_l"))
    if warning:
        rect(im, 10, 0, 4, 6, C("cloth")); line(im, [(6, 8), (18, 8)], C("wood_d"), 2)
    return im


def ore() -> Image.Image:
    im = new(32, 26); shadow(im, 28, 5)
    poly(im, [(2, 22), (6, 10), (16, 4), (28, 12), (30, 22)], C("basalt_d"))
    poly(im, [(5, 20), (8, 11), (16, 7), (26, 13), (27, 20)], C("basalt"))
    line(im, [(10, 18), (15, 11), (21, 16)], C("ore"), 2); px(im, 15, 10, C("ore_l")); px(im, 22, 15, C("ore_l"))
    return im


def herb() -> Image.Image:
    im = new(18, 16)
    for x, y in [(8, 12), (5, 9), (11, 8), (8, 5)]:
        line(im, [(8, 15), (x, y)], C("herb"))
        ell(im, x - 2, y - 2, 4, 3, C("herb_l"))
    return im


def log_pile() -> Image.Image:
    im = new(30, 20); shadow(im, 26, 4)
    for y in (12, 7):
        for x in (3, 12, 21):
            ell(im, x, y, 8, 6, C("wood_d")); ell(im, x + 1, y + 1, 6, 4, C("wood_l")); px(im, x + 3, y + 2, C("wood"))
    return im


def watchtower() -> Image.Image:
    im = new(64, 84); shadow(im, 54, 8)
    for x in (12, 46): rect(im, x, 34, 6, 46, C("wood_d")); rect(im, x + 1, 34, 3, 45, C("wood"))
    line(im, [(15, 70), (49, 40)], C("wood_d"), 2); line(im, [(49, 70), (15, 40)], C("wood_d"), 2)
    rect(im, 8, 28, 48, 12, C("wood_d")); rect(im, 10, 28, 44, 9, C("wood"))
    poly(im, [(4, 28), (32, 6), (60, 28)], C("ink")); poly(im, [(8, 26), (32, 10), (56, 26)], C("cloth_d"))
    poly(im, [(12, 24), (32, 12), (52, 24)], C("cloth"))
    rect(im, 26, 40, 12, 10, C("ink")); rect(im, 28, 42, 8, 6, C("canvas_d"))
    return im


def apothecary() -> Image.Image:
    im = new(80, 64); shadow(im, 70, 8)
    rect(im, 8, 30, 64, 30, C("stone_d")); rect(im, 10, 30, 60, 26, C("stone"))
    for x in range(12, 70, 12): line(im, [(x, 32), (x, 54)], C("stone_d"))
    poly(im, [(4, 32), (24, 8), (56, 8), (76, 32)], C("ink")); poly(im, [(8, 30), (26, 12), (54, 12), (72, 30)], C("wood_d"))
    poly(im, [(12, 28), (28, 14), (52, 14), (68, 28)], C("wood"))
    rect(im, 32, 40, 14, 20, C("wood_d")); rect(im, 34, 42, 10, 18, C("wood_l"))
    rect(im, 16, 38, 10, 8, C("ink")); rect(im, 18, 40, 6, 4, C("herb"))
    rect(im, 54, 38, 10, 8, C("ink")); rect(im, 56, 40, 6, 4, C("fire"))
    rect(im, 58, 10, 8, 14, C("stone_d")); rect(im, 60, 10, 4, 12, C("stone"))
    return im


def frost_shrine() -> Image.Image:
    im = new(56, 68); shadow(im, 48, 8)
    rect(im, 8, 54, 40, 10, C("basalt_d")); rect(im, 10, 54, 36, 7, C("basalt"))
    rect(im, 18, 20, 20, 36, C("stone_d")); rect(im, 20, 20, 16, 34, C("stone"))
    poly(im, [(14, 22), (28, 4), (42, 22)], C("stone_d")); poly(im, [(18, 20), (28, 8), (38, 20)], C("snow"))
    rect(im, 24, 30, 8, 16, C("ink")); rect(im, 26, 32, 4, 12, C("ice_d")); px(im, 27, 34, C("ice_l"))
    for x in (12, 40): rect(im, x, 40, 6, 16, C("stone_d")); rect(im, x + 1, 40, 4, 14, C("snow"))
    return im


def mill_wheel() -> Image.Image:
    im = new(56, 56)
    ell(im, 2, 2, 52, 52, C("wood_d")); ell(im, 6, 6, 44, 44, C("wood"))
    ell(im, 14, 14, 28, 28, C("ink_soft")); ell(im, 22, 22, 12, 12, C("wood_l"))
    for i in range(8):
        a = i * math.pi / 4
        x = 28 + int(22 * math.cos(a)); y = 28 + int(22 * math.sin(a))
        line(im, [(28, 28), (x, y)], C("wood_l"), 3)
        rect(im, x - 3, y - 3, 6, 6, C("wood_d"))
    return im


def whetstone() -> Image.Image:
    im = new(22, 18); shadow(im, 18, 4)
    rect(im, 4, 10, 14, 6, C("stone_d")); poly(im, [(4, 10), (8, 5), (18, 5), (18, 10)], C("stone"))
    line(im, [(8, 6), (16, 6)], C("stone_l")); rect(im, 9, 7, 5, 1, C("iron_l"))
    return im


def light_pool() -> Image.Image:
    im = new(64, 40)
    for r, a in [(30, 18), (24, 26), (17, 36), (10, 48)]:
        ell(im, 32 - r, 20 - r // 2, r * 2, r, (240, 174, 78, a))
    return im



def drying_rack() -> Image.Image:
    im = new(28, 30); shadow(im, 24, 5)
    for x in (4, 22): rect(im, x, 6, 3, 22, C("wood_d"))
    rect(im, 3, 7, 23, 3, C("wood")); rect(im, 3, 16, 23, 2, C("wood_d"))
    for x, y in [(7, 10), (13, 9), (19, 11), (9, 19), (17, 18)]:
        line(im, [(x, y), (x, y + 6)], C("herb"))
        ell(im, x - 2, y + 4, 4, 4, C("herb_l"))
    return im


def beehive() -> Image.Image:
    im = new(22, 24); shadow(im, 18, 5)
    rect(im, 5, 18, 12, 4, C("wood_d"))
    for y, w in [(6, 12), (10, 16), (14, 14)]:
        ell(im, 11 - w // 2, y, w, 6, C("canvas_d")); ell(im, 12 - w // 2, y, w - 2, 4, C("canvas"))
    rect(im, 9, 16, 4, 3, C("ink")); px(im, 10, 17, C("fire"))
    return im


def snow_drift() -> Image.Image:
    im = new(36, 16)
    poly(im, [(1, 14), (6, 8), (14, 5), (24, 7), (34, 13), (30, 15), (4, 15)], C("snow_d"))
    poly(im, [(3, 13), (8, 8), (15, 6), (24, 8), (31, 13)], C("snow"))
    line(im, [(8, 9), (16, 7), (24, 9)], C("snow_l"))
    return im


def split_rail() -> Image.Image:
    im = new(34, 18); shadow(im, 30, 4)
    for x in (3, 28): rect(im, x, 3, 3, 13, C("wood_d"))
    poly(im, [(2, 7), (32, 5), (32, 8), (2, 10)], C("wood"))
    poly(im, [(2, 12), (32, 10), (32, 13), (2, 15)], C("wood_l"))
    return im


def quarry_workface() -> Image.Image:
    im = new(88, 64); shadow(im, 78, 9)
    poly(im, [(4, 56), (8, 24), (24, 10), (58, 8), (80, 22), (84, 56)], C("basalt_d"))
    poly(im, [(10, 52), (14, 26), (28, 15), (56, 13), (74, 25), (78, 52)], C("stone_d"))
    poly(im, [(16, 48), (20, 28), (32, 19), (54, 18), (68, 28), (72, 48)], C("stone"))
    for x, y in [(24, 26), (40, 22), (56, 30), (32, 38), (50, 42)]:
        line(im, [(x, y), (x + 8, y + 3)], C("stone_l")); px(im, x + 2, y + 1, C("stone_h"))
    # timber brace and worked seam, not a loot glow
    rect(im, 18, 34, 5, 22, C("wood_d")); rect(im, 64, 32, 5, 24, C("wood_d"))
    rect(im, 18, 32, 51, 5, C("wood")); line(im, [(22, 36), (64, 36)], C("wood_l"))
    rect(im, 38, 44, 14, 8, C("ink_soft")); line(im, [(40, 48), (50, 46)], C("ore"), 2)
    return im


def orchard_shed() -> Image.Image:
    im = new(72, 60); shadow(im, 62, 8)
    rect(im, 10, 30, 52, 26, C("wood_d")); rect(im, 12, 30, 48, 22, C("wood"))
    for x in range(14, 60, 8): line(im, [(x, 31), (x, 51)], C("wood_d"))
    poly(im, [(4, 32), (22, 10), (50, 10), (68, 32)], C("ink")); poly(im, [(8, 30), (24, 14), (48, 14), (64, 30)], C("cloth_d"))
    poly(im, [(12, 28), (26, 16), (46, 16), (60, 28)], C("canvas"))
    rect(im, 28, 38, 16, 18, C("ink")); rect(im, 30, 40, 12, 16, C("wood_l"))
    rect(im, 14, 36, 10, 8, C("ink")); rect(im, 16, 38, 6, 4, C("herb"))
    rect(im, 48, 36, 10, 8, C("ink")); rect(im, 50, 38, 6, 4, C("fruit"))
    # graft rack: human tending, not a reward marker
    rect(im, 58, 20, 3, 34, C("wood_d")); line(im, [(58, 24), (68, 20)], C("wood_l"), 2)
    rect(im, 64, 18, 5, 3, C("canvas_l"))
    return im


def mill_house() -> Image.Image:
    im = new(88, 76); shadow(im, 78, 9)
    rect(im, 12, 34, 64, 38, C("stone_d")); rect(im, 14, 34, 60, 34, C("stone"))
    for x in range(16, 74, 12): line(im, [(x, 36), (x, 66)], C("stone_d"))
    poly(im, [(6, 36), (28, 10), (60, 10), (82, 36)], C("ink")); poly(im, [(10, 34), (30, 14), (58, 14), (78, 34)], C("wood_d"))
    poly(im, [(14, 32), (32, 17), (56, 17), (74, 32)], C("wood"))
    rect(im, 36, 48, 16, 24, C("wood_d")); rect(im, 38, 50, 12, 22, C("wood_l"))
    rect(im, 18, 42, 12, 10, C("ink")); rect(im, 20, 44, 8, 6, C("canvas_d"))
    rect(im, 58, 42, 12, 10, C("ink")); rect(im, 60, 44, 8, 6, C("fire"))
    # wheel axle and race stones; wheel itself is a separate unscaled frame
    rect(im, 74, 50, 10, 6, C("wood_d")); ell(im, 78, 48, 8, 8, C("iron_d"))
    for x in (8, 76): rect(im, x, 68, 8, 5, C("stone_d"))
    return im


def build(include_regions: bool = False) -> dict:
    OUT.mkdir(parents=True, exist_ok=True); DATA.mkdir(parents=True, exist_ok=True)
    terrain: dict[str, Image.Image] = {}
    for style in ("ash", "moor", "soil", "grass", "forest", "snow", "tundra", "basalt", "gravel", "water", "ice"):
        for v in range(4 if style not in ("water", "ice") else 3):
            terrain[f"{style}_{v}"] = ground(style, v)
    for a, b in [("grass", "soil"), ("moor", "ash"), ("snow", "basalt"), ("grass", "water"), ("soil", "gravel"),
                 ("grass", "forest"), ("snow", "tundra"), ("ash", "gravel"), ("forest", "soil")]:
        for m in range(16):
            terrain[f"blend_{a}_{b}_{m}"] = transition(terrain[f"{a}_0"], terrain[f"{b}_0"], m)
    for a, b in [("grass", "soil"), ("soil", "grass"), ("moor", "ash"), ("ash", "moor"),
                 ("snow", "basalt"), ("basalt", "snow"), ("grass", "forest"), ("forest", "grass"),
                 ("soil", "gravel"), ("gravel", "soil"), ("snow", "tundra"), ("tundra", "snow"),
                 ("ash", "gravel"), ("gravel", "ash"), ("forest", "soil"), ("soil", "forest"),
                 ("ash", "basalt"), ("basalt", "ash"), ("moor", "soil"), ("soil", "moor")]:
        for d in (1, 2, 4, 8):
            terrain[f"shore_{a}_{b}_{d}"] = shore(terrain[f"{a}_0"], terrain[f"{b}_0"], d)
    for m in range(16):
        terrain[f"road_dirt_{m}"] = road(m, False)
        terrain[f"road_stone_{m}"] = road(m, True)
        terrain[f"bank_{m}"] = bank(m)
    for v in range(4): terrain[f"court_{v}"] = court(v)

    props: dict[str, Image.Image] = {
        "tree_amber": tree_broad("amber"), "tree_orchard": tree_broad("orchard"),
        "tree_frost": tree_frost(), "tree_frost_small": tree_frost(True),
        "fern": fern(), "reeds": reeds(),
        "cache_closed": cache("closed"), "cache_open": cache("open"), "cache_spent": cache("spent"),
        "cache_notes": cache_notes("closed"), "cache_notes_open": cache_notes("open"),
        "deadfall": deadfall(), "stump": stump(), "handcart": handcart(), "tarp_shelter": tarp_shelter(),
        "lm_waystation": waystation(), "banner": banner(), "lamp": lamp(),
        "fence_h": fence(True), "fence_v": fence(False), "cairn": cairn(), "cairn_warning": cairn(True),
        "ore_skarn": ore(), "herb_moonleaf": herb(), "log_pile": log_pile(),
        "lm_amber_watch": watchtower(), "lm_amber_apothecary": apothecary(), "lm_frost_shrine": frost_shrine(),
        "mill_wheel": mill_wheel(), "whetstone": whetstone(), "light_pool": light_pool(),
        "drying_rack": drying_rack(), "beehive": beehive(), "snow_drift": snow_drift(), "split_rail": split_rail(),
        "lm_quarry_workface": quarry_workface(), "lm_orchard_shed": orchard_shed(), "lm_mill_house": mill_house(),
    }
    if include_regions:
        from build_region_art import region_frames
        rt, rp = region_frames()
        terrain.update(rt)
        props.update(rp)
    # Pinned inherited original frames, reused without perspective/scale changes.
    legacy = Image.open(ROOT / "assets/environment/overworld/overworld_props.png").convert("RGBA")
    lmeta = json.loads((ROOT / "data/overworld/overworld_props.json").read_text())["frames"]
    inherited = {}
    for name in ("tree_dead", "tree_pine", "bush", "rock_a", "rock_c", "rock_e", "signpost", "wall_stub", "column_broken"):
        m = lmeta[name]
        props[name] = legacy.crop((m["x"], m["y"], m["x"] + m["w"], m["y"] + m["h"]))
        inherited[name] = {"source": "assets/environment/overworld/overworld_props.png", "rect": [m["x"], m["y"], m["w"], m["h"]], "license": "original", "decision": "REUSE_UNSCALED"}

    def pack(frames: dict[str, Image.Image], width=1024) -> tuple[Image.Image, dict]:
        x = y = rowh = 2
        rects = {}
        for name, im in frames.items():
            if x + im.width + 2 > width:
                x = 2; y += rowh + 2; rowh = 0
            rects[name] = [x, y, im.width, im.height]
            x += im.width + 2; rowh = max(rowh, im.height)
        sheet = new(width, y + rowh + 2)
        for name, im in frames.items():
            r = rects[name]; sheet.alpha_composite(im, (r[0], r[1]))
        return sheet, rects

    # Terrain is grid-packed so Godot TileSetAtlasSource can address it directly.
    cols = 32
    trects = {}
    rows = (len(terrain) + cols - 1) // cols
    tsheet = new(cols * T, rows * T)
    for i, (name, im) in enumerate(terrain.items()):
        x = (i % cols) * T; y = (i // cols) * T
        trects[name] = [x, y, T, T]
        tsheet.alpha_composite(im, (x, y))
    psheet, prects = pack(props, 1024)
    tsheet.save(OUT / "terrain.png"); psheet.save(OUT / "props.png")
    manifest = {
        "schema": "soh.world.art_atlas.v1", "tile_px": T,
        "textures": {"terrain": "res://assets/environment/survival_world/terrain.png", "props": "res://assets/environment/survival_world/props.png"},
        "terrain": trects, "props": prects,
        "inherited_frames": inherited,
        "license": "original SOH art; inherited frames remain original project art",
        "perspective": "top-down three-quarter, feet anchor bottom-center, integer scale only",
        "sha256": {"terrain": hashlib.sha256(tsheet.tobytes()).hexdigest(), "props": hashlib.sha256(psheet.tobytes()).hexdigest()},
        "file_sha256": {"terrain": hashlib.sha256((OUT / "terrain.png").read_bytes()).hexdigest(), "props": hashlib.sha256((OUT / "props.png").read_bytes()).hexdigest()},
    }
    (DATA / "atlas.v1.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    # contact sheet for personal inspection, not runtime art
    cw = 1024; cols = 8; cellw = 128; cellh = 120
    contact = Image.new("RGB", (cw, ((len(props) + cols - 1) // cols) * cellh), "#2a2730")
    d = ImageDraw.Draw(contact)
    for i, (name, im) in enumerate(props.items()):
        x = (i % cols) * cellw; y = (i // cols) * cellh
        s = min(3, max(1, 96 // max(im.width, im.height)))
        big = im.resize((im.width * s, im.height * s), Image.Resampling.NEAREST)
        contact.paste(big, (x + (cellw - big.width) // 2, y + 22 + (88 - big.height)), big)
        d.text((x + 4, y + 4), name, fill="white")
    contact.save(DATA / "props_contact.png")
    return {"ok": True, "terrain_frames": len(terrain), "prop_frames": len(props), "inherited": len(inherited), "atlas": str(DATA / "atlas.v1.json")}


if __name__ == "__main__":
    print(json.dumps(build(), sort_keys=True))
