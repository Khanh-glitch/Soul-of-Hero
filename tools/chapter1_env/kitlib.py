#!/usr/bin/env python3
"""Shared engineering for the Chapter 1 authored environments (Levels 6-10).

This module is *engineering*, not art. It knows how to draw a bevelled block, how
to pack an atlas, how to read a level's collision layers and how to refuse a plan
that would put architecture where the gameplay map says there is none. It knows
nothing about any particular level: materials, silhouettes and composition live in
`tools/level<N>/build_<name>.py`, one per level, so no level's identity can leak
into another's.

The Level 5 pipeline (`tools/level5/`) stays frozen and is not imported from here;
this is the same proven approach re-implemented for the rest of the chapter, with
the anchored-crystal, pylon, seal and throne vocabulary the later levels need.
"""

from __future__ import annotations

import json
import math
import os
import subprocess

from PIL import Image, ImageDraw

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
T = 16

# Frame names the presentation layer (`crucible_art.gd`) always asks for. Every
# kit must provide all of them, in its own material, or a room falls back to
# whatever the level's stock tileset drew underneath.
BASE_TILES = [
    "bedrock_a", "bedrock_b",
    "floor_a", "floor_b", "floor_c", "floor_d", "floor_worn", "floor_broken",
    "shadow_edge",
    "wall_plinth", "wall_dado_a", "wall_field_a", "wall_field_b", "wall_pier",
    "wall_cornice", "wall_cap",
]


# ---------------------------------------------------------------------------
# pixel primitives
# ---------------------------------------------------------------------------
def new(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def px(img, x, y, colour) -> None:
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), colour if len(colour) == 4 else tuple(colour[:3]) + (255,))


def rect(img, x, y, w, h, colour) -> None:
    body = colour if len(colour) == 4 else tuple(colour[:3]) + (255,)
    for yy in range(int(y), int(y + h)):
        for xx in range(int(x), int(x + w)):
            px(img, xx, yy, body)


def hline(img, x, y, w, colour) -> None:
    for xx in range(int(x), int(x + w)):
        px(img, xx, int(y), colour)


def vline(img, x, y, h, colour) -> None:
    for yy in range(int(y), int(y + h)):
        px(img, int(x), yy, colour)


def frame_box(img, x, y, w, h, colour) -> None:
    hline(img, x, y, w, colour)
    hline(img, x, y + h - 1, w, colour)
    vline(img, x, y, h, colour)
    vline(img, x + w - 1, y, h, colour)


def shade(colour, amount: float):
    return tuple(max(0, min(255, int(c * amount))) for c in colour[:3])


def mix(a, b, t: float):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def _h01(*values: int) -> float:
    """Deterministic pseudo-random in [0,1): the same stone on every rebuild."""
    h = 2166136261
    for v in values:
        h = (h ^ (int(v) & 0xFFFFFFFF)) * 16777619 & 0xFFFFFFFF
    h ^= h >> 15
    h = (h * 2246822519) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 3266489917) & 0xFFFFFFFF
    h ^= h >> 16
    return (h & 0xFFFF) / 65536.0


def block(img, x, y, w, h, base, *, bevel: int = 1, top=None, left=None,
          right=None, bottom=None) -> None:
    """A bevelled block: lit top and left, dark right and base. The workhorse."""
    rect(img, x, y, w, h, base)
    if bevel <= 0:
        return
    hline(img, x, y, w, (top or shade(base, 1.30)))
    hline(img, x, y + 1, w, (left or shade(base, 1.14)))
    vline(img, x, y, h, (left or shade(base, 1.14)))
    vline(img, x + w - 1, y, h, (right or shade(base, 0.78)))
    hline(img, x, y + h - 1, w, (bottom or shade(base, 0.62)))
    if h > 4:
        hline(img, x, y + h - 2, w, shade(base, 0.86))


def courses(img, x, y, w, h, base, *, row_h: int = 8, seed: int = 1, mortar=None) -> None:
    """Coursed masonry with staggered joints, drawn deterministically."""
    mortar = mortar or shade(base, 0.45)
    rect(img, x, y, w, h, mortar)
    row = 0
    yy = y
    while yy < y + h:
        row_hh = min(row_h, y + h - yy)
        offset = int(_h01(seed, row) * 7)
        xx = x - offset
        while xx < x + w:
            bw = 6 + int(_h01(seed, row, xx) * 7)
            x0 = max(x, xx)
            x1 = min(x + w, xx + bw)
            if x1 - x0 > 1:
                tone = 0.92 + _h01(seed, row, xx, 7) * 0.22
                body = shade(base, tone)
                rect(img, x0, yy, x1 - x0, max(1, row_hh - 1), body)
                hline(img, x0, yy, x1 - x0, shade(body, 1.20))
                if x0 > x:
                    vline(img, x0, yy, max(1, row_hh - 1), shade(body, 0.82))
            xx += bw
        yy += row_h
        row += 1


def dither(img, x, y, w, h, colour, density: float, seed: int = 0) -> None:
    for yy in range(int(y), int(y + h)):
        for xx in range(int(x), int(x + w)):
            if _h01(seed, xx, yy) < density:
                px(img, xx, yy, colour)


def glow(img, cx: float, cy: float, rx: float, ry: float, colour, alpha: int,
         steps: int = 5) -> None:
    """Add light to what is already there.

    A glow that *replaces* pixels with semi-transparent colour erases the object it
    is meant to be illuminating. This one only brightens opaque pixels and spills a
    soft halo into empty ones.
    """
    data = img.load()
    w, h = img.size
    for i in range(steps, 0, -1):
        t = i / steps
        a = int(alpha * (1.0 - t) ** 1.7)
        if a <= 0:
            continue
        for yy in range(int(cy - ry * t), int(cy + ry * t) + 1):
            for xx in range(int(cx - rx * t), int(cx + rx * t) + 1):
                if not (0 <= xx < w and 0 <= yy < h):
                    continue
                dx = (xx - cx) / max(0.001, rx * t)
                dy = (yy - cy) / max(0.001, ry * t)
                if dx * dx + dy * dy > 1.0:
                    continue
                existing = data[xx, yy]
                if existing[3] == 0:
                    data[xx, yy] = tuple(colour[:3]) + (a,)
                else:
                    weight = (a / 255.0) * 0.55
                    data[xx, yy] = tuple(
                        min(255, int(existing[c] + colour[c] * weight)) for c in range(3)
                    ) + (existing[3],)


def contact_shadow(img, *, alpha: int = 118) -> None:
    cx = img.width / 2
    rx = img.width * 0.34
    ry = max(3.0, img.height * 0.07)
    for i in range(int(ry), 0, -1):
        a = int(alpha * (1 - i / max(1.0, ry)) ** 1.4)
        if a <= 0:
            continue
        for xx in range(int(cx - rx * (i / ry)), int(cx + rx * (i / ry)) + 1):
            px(img, xx, int(img.height - 2 - (i - ry * 0.5)), (0, 0, 0, a))


def finish(img: Image.Image, outline_colour=(12, 12, 16), *, shadow: bool = True):
    """One dark outline plus a baked contact shadow, applied to every prop.

    Without these two a pale prop on pale stone reads as a decal rather than as an
    object standing in the room.
    """
    if shadow:
        contact_shadow(img)
    data = img.load()
    w, h = img.size
    edge = tuple(outline_colour) + (225,)
    edges = []
    for y in range(h):
        for x in range(w):
            if data[x, y][3] > 24:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and data[nx, ny][3] > 185:
                    edges.append((x, y))
                    break
    for x, y in edges:
        data[x, y] = edge
    return img


# ---------------------------------------------------------------------------
# generic tile shapes (materials come from the level)
# ---------------------------------------------------------------------------
def rock_tile(seed: int, dark, mid, light) -> Image.Image:
    img = new(T, T)
    rect(img, 0, 0, T, T, mid)
    for y in range(T):
        for x in range(T):
            r = _h01(seed, x, y)
            if r < 0.30:
                px(img, x, y, shade(mid, 0.88 + r * 0.3))
            elif r > 0.94:
                px(img, x, y, light)
    for _i in range(3):
        x0 = int(_h01(seed, 11, _i) * T)
        y0 = int(_h01(seed, 29, _i) * T)
        hline(img, x0, y0, 4 + int(_h01(seed, 5, _i) * 5), shade(mid, 0.76))
    # no hard edge on the tile border: a line on every cell turns a rock face into
    # corduroy, and a solid block of it into a barcode
    dither(img, 0, 0, T, T, shade(dark, 1.06), 0.12, seed=seed)
    return img


def flag_quadrant(seed: int, quad: int, base, joint, *, tone: float = 1.0,
                  crack: bool = False) -> Image.Image:
    """One quadrant of a 32 px flagstone, so paving has a 32 px joint rhythm.

    quad 0 = north-west, 1 = north-east, 2 = south-west, 3 = south-east. The joint
    is drawn only on the two outer edges of the flag, never on the seam between
    quadrants: a joint on every cell edge turns the paving into a 16 px grid, which
    is the single most common way hand-painted floor tiles end up looking like
    bathroom ceramic.
    """
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(base, tone))
    for y in range(T):
        for x in range(T):
            r = _h01(seed, quad, x, y)
            if r < 0.22:
                px(img, x, y, shade(base, tone * (0.95 + r * 0.16)))
            elif r > 0.991:
                px(img, x, y, shade(base, tone * 1.08))
    # The joint goes on the flag's outer edges and nowhere else.
    #
    # This used to draw a vertical joint on the east edge of the north-east quadrant
    # and a horizontal one on the south edge of the south-west quadrant as well, so
    # every 32 px flag was cut down its middle on both axes: the paving came out as
    # a 16 px grid of light lines on a flat field, which is what makes a hall of
    # these tiles read as graph paper at gameplay scale. Measured on the L10 mosaic,
    # that grid was the single strongest structure in a room whose dominant material
    # should be the floor's slabs. Only the NW and SE quadrants carry a joint now,
    # and only on the two edges that belong to the outside of the flag.
    if quad == 0:
        vline(img, 0, 0, T, joint)
        vline(img, 1, 0, T, shade(base, tone * 0.90))
        hline(img, 0, 0, T, joint)
        hline(img, 0, 1, T, shade(base, tone * 0.90))
    elif quad == 3:
        vline(img, T - 1, 0, T, shade(base, tone * 0.87))
        hline(img, 0, T - 1, T, shade(base, tone * 0.87))
    else:
        # the inside of the flag: a soft arris where the slab was worked, no line
        if quad == 1:
            vline(img, T - 1, 0, T, shade(base, tone * 0.94))
        else:
            hline(img, 0, T - 1, T, shade(base, tone * 0.94))
    if crack:
        x = 3 + int(_h01(seed, quad, 3) * 8)
        for i in range(2, T - 2):
            px(img, x + int(math.sin(i / 2.4) * 2), i, joint)
    return img


def wall_plinth_tile(base, trim) -> Image.Image:
    img = new(T, T)
    block(img, 0, 0, T, T, shade(base, 1.02), bevel=1)
    hline(img, 0, 0, T, shade(trim, 1.22))
    hline(img, 0, 2, T, shade(base, 0.72))
    rect(img, 0, T - 3, T, 3, shade(base, 0.58))
    return img


def wall_field_tile(seed: int, base, mortar, pier: bool = False,
                    dado: bool = False) -> Image.Image:
    img = new(T, T)
    rect(img, 0, 0, T, T, base)
    courses(img, 0, 0, T, T, base, row_h=8, seed=seed, mortar=mortar)
    if dado:
        rect(img, 0, 4, T, 8, shade(base, 0.86))
        hline(img, 0, 4, T, shade(base, 1.24))
        hline(img, 0, 11, T, shade(base, 0.66))
    if pier:
        rect(img, 0, 0, 3, T, shade(base, 1.16))
        rect(img, T - 3, 0, 3, T, shade(base, 0.76))
        hline(img, 0, 0, T, shade(base, 1.26))
    return img


def wall_cornice_tile(trim, base) -> Image.Image:
    img = new(T, T)
    rect(img, 0, 0, 6, T, base)
    rect(img, 0, 4, T, 8, trim)
    hline(img, 0, 4, T, shade(trim, 1.25))
    hline(img, 0, 11, T, shade(trim, 0.68))
    vline(img, 1, 4, 8, shade(trim, 1.10))
    vline(img, T - 2, 4, 8, shade(trim, 0.80))
    return img


def wall_cap_tile(cap, base) -> Image.Image:
    img = new(T, T)
    rect(img, 0, 0, T, T, cap)
    for x in range(T):
        px(img, x, 0, shade(cap, 1.10))
    rect(img, 0, T - 4, T, 4, shade(cap, 0.72))
    dither(img, 0, 0, T, T - 4, shade(cap, 1.06), 0.10, seed=3)
    rect(img, 0, T - 5, T, 1, shade(base, 0.9))
    return img


def shadow_tile(alpha: int = 96) -> Image.Image:
    img = new(T, T)
    for y in range(T):
        a = int(alpha * (1.0 - y / T) ** 1.3)
        if a > 0:
            rect(img, 0, y, T, 1, (0, 0, 0, a))
    return img


def radial_light(size: int = 256, colour=(255, 236, 200)) -> Image.Image:
    img = new(size, size)
    cx = cy = size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot((x - cx) / cx, (y - cy) / cy) / 1.414
            a = int(255 * max(0.0, 1.0 - d) ** 2.1)
            if a > 0:
                img.putpixel((x, y), tuple(colour[:3]) + (a,))
    return img


# ---------------------------------------------------------------------------
# atlas packing
# ---------------------------------------------------------------------------
def pack(name: str, builders: dict) -> dict:
    """Build every frame, finish it, and lay it out on one atlas.

    `builders` maps frame name to a zero-argument callable returning an image.
    Returns (frames resolution dict, sheet image).
    """
    frames = {}
    placed = []
    cursor_x = cursor_y = row_h = 0
    widest = 0
    items = builders.items() if isinstance(builders, dict) else builders
    for frame_name, builder in items:
        image = builder()
        if image is None:
            continue
        if cursor_x + image.width > 1024:
            widest = max(widest, cursor_x)
            cursor_y += row_h + 1
            cursor_x, row_h = 0, 0
        frames[frame_name] = {"x": cursor_x, "y": cursor_y,
                              "w": image.width, "h": image.height}
        placed.append((cursor_x, cursor_y, image))
        cursor_x += image.width + 2
        row_h = max(row_h, image.height)
    # The sheet must cover every row it wrapped onto: a row that ends short must
    # not shrink the atlas under the rows above it, or the frames out at the right
    # edge are cropped out of their own sheet.
    width = max(16, widest, cursor_x)
    height = max(16, cursor_y + row_h)
    sheet = new(width, height)
    for x, y, image in placed:
        sheet.alpha_composite(image, (x, y))
    return frames, sheet


def pack_grid(builders: list, columns: int = 64) -> tuple:
    """Pack 16 px tiles on a strict 16 px grid.

    The renderer resolves a tile frame by dividing its atlas position by the tile
    size, so a two-pixel gap between tiles silently rounds every frame onto the
    wrong cell. Props may be packed loosely; tiles may not.
    """
    frames = {}
    images = [(name, builder()) for name, builder in builders]
    rows = (len(images) + columns - 1) // columns
    sheet = new(columns * T, max(1, rows) * T)
    for index, (name, image) in enumerate(images):
        column, row = index % columns, index // columns
        sheet.alpha_composite(image, (column * T, row * T))
        frames[name] = {"x": column * T, "y": row * T, "w": image.width, "h": image.height}
    return frames, sheet


def apply_exposure(image: Image.Image, gamma: float) -> Image.Image:
    """Lift the mid-tones of a finished frame, leaving black and white alone.

    Measured on the native mosaics, the chapter's rooms sat at a median luminance
    of 33-67 out of 255: at 640x360 the player was looking at near-black mush, and
    no amount of prop detail survives that. Multiplying would clip the ember and
    candle highlights, so the lift is a gamma curve instead - it raises the stone
    into a readable band and compresses the shoulder rather than blowing it.

    Gamma is per kit, because a pale marble room and a basalt room do not start at
    the same value. It is *not* a substitute for light: the authored lights, their
    ordering and their falloff are untouched, so the contrast between a lit pool
    and a dark corner survives the lift.
    """
    if not gamma or abs(gamma - 1.0) < 1e-6:
        return image
    table = [min(255, int(round(255.0 * ((v / 255.0) ** gamma)))) for v in range(256)]
    bands = image.split()
    if len(bands) == 4:
        r, g, b, a = bands
        return Image.merge("RGBA", (r.point(table), g.point(table), b.point(table), a))
    return image.point(table)


def write_kit(art_dir: str, kit: str, tiles: list, props: list,
              light_colour=(255, 236, 200), gamma: float = 1.0) -> None:
    """Write `<kit>_tiles.png/.json`, `<kit>_props.png/.json` and the light."""
    os.makedirs(art_dir, exist_ok=True)
    tile_frames, tile_sheet = pack_grid(tiles)
    prop_frames, prop_sheet = pack(kit + "_props", props)
    if gamma and abs(gamma - 1.0) > 1e-6:
        tile_sheet = apply_exposure(tile_sheet, gamma)
        prop_sheet = apply_exposure(prop_sheet, gamma)
    tile_sheet.save(os.path.join(art_dir, kit + "_tiles.png"))
    prop_sheet.save(os.path.join(art_dir, kit + "_props.png"))
    radial_light(colour=light_colour).save(os.path.join(art_dir, "light_radial.png"))
    for suffix, frames in (("tiles", tile_frames), ("props", prop_frames)):
        path = os.path.join(art_dir, "%s_%s.json" % (kit, suffix))
        with open(path, "w", encoding="utf-8") as fh:
            json.dump({"tile_size": T, "frames": frames}, fh, indent=2)
            fh.write("\n")
    preview(art_dir, kit, tile_sheet, prop_sheet, tile_frames, prop_frames)
    print("%s: %d tiles, %d props -> %s" % (kit, len(tile_frames), len(prop_frames), art_dir))


def preview(art_dir: str, kit: str, tile_sheet, prop_sheet, tile_frames, prop_frames) -> None:
    scale = 3
    cols = 7
    cell = 210
    names = list(prop_frames.items())
    rows = (len(names) + cols - 1) // cols
    tile_h = max(f["y"] + f["h"] for f in tile_frames.values())
    canvas = new(cols * cell + 16, tile_h * scale + rows * cell + 40)
    canvas.alpha_composite(
        tile_sheet.resize((tile_sheet.width * scale, tile_sheet.height * scale), Image.NEAREST),
        (8, 8))
    draw = ImageDraw.Draw(canvas)
    for name, f in tile_frames.items():
        draw.text((8 + f["x"] * scale + 1, 8 + f["y"] * scale + 1), name[:16],
                  fill=(255, 244, 190, 255))
    base_y = tile_h * scale + 20
    for i, (name, f) in enumerate(names):
        cx = 8 + (i % cols) * cell
        cy = base_y + (i // cols) * cell
        sprite = prop_sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
        draw.rectangle([cx, cy, cx + cell - 8, cy + cell - 8], fill=(24, 22, 26, 255))
        fitted = sprite
        if sprite.width * scale > cell - 16:
            fitted = sprite.resize((max(1, (cell - 16) // 2), max(1, int(sprite.height * (cell - 16) / 2 / sprite.width))), Image.NEAREST)
            canvas.alpha_composite(fitted, (cx + 4, cy + 18))
        else:
            canvas.alpha_composite(
                fitted.resize((fitted.width * scale, fitted.height * scale), Image.NEAREST),
                (cx + 4, cy + 18))
        draw.text((cx + 4, cy + 4), "%s %dx%d" % (name, f["w"], f["h"]),
                  fill=(255, 244, 190, 255))
    flat = Image.new("RGB", canvas.size, (24, 30, 32))
    flat.paste(canvas, (0, 0), canvas)
    flat.save(os.path.join(art_dir, "sheet_preview.png"))


# ---------------------------------------------------------------------------
# level data + plan
# ---------------------------------------------------------------------------
def load_level(number: int) -> dict:
    path = os.path.join(ROOT, "data", "levels", "chapter_1_level_%d.json" % number)
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def cells(doc: dict, layer: str) -> set:
    out = set()
    for tile in doc.get("layers", {}).get(layer, []):
        out.add((int(tile["x"]), int(tile["y"])))
    return out


def entities(doc: dict, *kinds: str) -> list:
    out = []
    for entity in doc.get("entities", []):
        if kinds and String_ok(entity.get("type")) not in kinds:
            continue
        position = entity.get("position", [0, 0])
        out.append({
            "id": entity.get("id", ""),
            "type": entity.get("type", ""),
            "cell": (int(position[0]) // T, int(position[1]) // T),
            "raw": entity,
        })
    return out


def String_ok(value) -> str:
    return value if isinstance(value, str) else ""


def protected(doc: dict) -> set:
    """Cells a prop may never stand on: anything the gameplay map puts there.

    Doors, seals, sigils, checkpoints, chests and the spawn are interactables the
    player must be able to walk onto; a prop is a sprite, and a sprite standing on
    one of those cells hides the thing the player has to click.
    """
    guard = set()
    for entity in doc.get("entities", []):
        position = entity.get("position", [0, 0])
        cell = (int(position[0]) // T, int(position[1]) // T)
        guard.add(cell)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                guard.add((cell[0] + dx, cell[1] + dy))
    return guard


class Plan:
    def __init__(self) -> None:
        self.floor = []
        self.wall = []
        self.props = []
        self.lights = []
        self._floor_seen = set()
        self._wall_seen = set()

    def floor_tile(self, cell, frame_name: str) -> None:
        if cell in self._floor_seen:
            for entry in self.floor:
                if tuple(entry["cell"]) == tuple(cell):
                    entry["frame"] = frame_name
                    return
        self._floor_seen.add(tuple(cell))
        self.floor.append({"cell": [cell[0], cell[1]], "frame": frame_name})

    def wall_tile(self, cell, frame_name: str) -> None:
        if cell in self._wall_seen:
            return
        self._wall_seen.add(tuple(cell))
        self.wall.append({"cell": [cell[0], cell[1]], "frame": frame_name})

    def prop(self, frame_name: str, cell, *, low: bool = False, z: int = 1,
             light: dict | None = None, hang: bool = False, flip: bool = False,
             note: str = "") -> None:
        entry = {"frame": frame_name, "cell": [cell[0], cell[1]], "z": z,
                 "y_sort": not hang, "low": low, "anchor": "base"}
        if flip:
            entry["flip"] = True
        if note:
            entry["note"] = note
        if light:
            entry["light"] = light
            self.lights.append(light)
        self.props.append(entry)

    def hang(self, frame_name: str, geom: set, x: int, y: int, *, note: str = "") -> None:
        """Hang a prop on the nearest solid cell at or above (x, y)."""
        top = y
        for step in range(0, 8):
            if (x, y - step) in geom:
                top = y - step
                break
        else:
            return
        self.prop(frame_name, (x, top), hang=True, note=note)


def wall_faces(floor: set, geom: set) -> dict:
    """Map each solid cell with walkable ground below it to that face."""
    faces = {}
    for cell in geom:
        below = (cell[0], cell[1] + 1)
        if below in floor and below not in geom:
            faces.setdefault(cell[0], []).append(cell)
    return faces


def room_around(floor: set, geom: set, cell, limit: int = 26) -> tuple:
    """Flood the walkable cells around `cell` and return (cells, bbox)."""
    if cell not in floor:
        return set(), (0, 0, 0, 0)
    seen = {cell}
    stack = [cell]
    while stack:
        current = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nxt = (current[0] + dx, current[1] + dy)
            if nxt in seen or nxt not in floor or nxt in geom:
                continue
            if len(seen) > limit * limit:
                continue
            seen.add(nxt)
            stack.append(nxt)
    xs = [c[0] for c in seen]
    ys = [c[1] for c in seen]
    return seen, (min(xs), min(ys), max(xs), max(ys))


def validate(document: dict, level: dict, *, tall: set | None = None) -> list:
    """Refuse any placement the gameplay map does not support."""
    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    guard = protected(level)
    problems = []
    tall = tall or set()
    for entry in document["layers"]["floor"]:
        cell = tuple(entry["cell"])
        if cell not in floor:
            problems.append("floor detail outside the floor layer: %s %s" % (entry["frame"], cell))
        elif cell in geom:
            problems.append("floor detail under solid geometry: %s %s" % (entry["frame"], cell))
    for entry in document["layers"]["wall"]:
        cell = tuple(entry["cell"])
        if cell not in geom:
            problems.append("wall dressing outside solid geometry: %s %s" % (entry["frame"], cell))
    for entry in document["props"]:
        cell = tuple(entry["cell"])
        frame_name = entry["frame"]
        if cell in guard:
            problems.append("prop on a protected gameplay cell: %s %s" % (frame_name, cell))
        if cell not in geom and cell not in floor:
            problems.append("prop over void: %s %s" % (frame_name, cell))
            continue
        if frame_name in tall and cell not in geom:
            problems.append("tall architecture off the wall mass: %s %s" % (frame_name, cell))
    return problems


# ---------------------------------------------------------------------------
# light discipline
# ---------------------------------------------------------------------------
# A PointLight2D's radius is the 256 px light texture times texture_scale, so the
# authored scales were describing radii from 180 px to 768 px: a "torch" with less
# than a third of the reach of another level's torch, and a brazier whose pool was
# bigger than the room it stood in. A pool that covers the whole frame does not light
# the room, it flattens it - the floor, the walls and the props all end up at the same
# value, which is the single biggest reason the later levels read as evenly lit fog
# rather than as places.
#
# The rule is deliberately narrow: a pool may be 140-400 px across, and its core may
# not exceed 1.15 energy, at which point the bright centre starts clipping to white
# and detail inside it disappears. This normalises the *range*, not the value - each
# placement keeps its own colour, its own energy and its own intent, and a candle is
# still dimmer than a brazier.
LIGHT_TEXTURE_PX = 256.0
LIGHT_RADIUS_MIN = 140.0
LIGHT_RADIUS_MAX = 400.0
LIGHT_RADIUS_CURVE = 0.6      # compress, do not clip: see below
LIGHT_KNEE = 0.85             # below this energy the author's value is kept as is
LIGHT_ENERGY_MAX = 1.15


def clamp_light(light: dict) -> tuple[bool, bool]:
    """Pull one light into the art direction's range. Returns (resized, dimmed).

    The radius is *compressed*, not clipped. A hard cap put twenty-nine of the
    Crucible's twenty-nine lights on the same 400 px radius, which is exactly the
    uniformity the pass exists to remove: every pool the same size reads as a
    lighting rig, not as a room with a fire in it. Raising the normalised radius to
    the power 0.6 halves the spread without flattening it - a 184 px pool stays
    visibly smaller than a 491 px one - and only the extremes touch the bounds.

    Energy uses a soft knee for the same reason. A light's core above 1.15 starts to
    clip whatever it is lighting to white, so it cannot be allowed to stay there; but
    a hard cut put twenty-one of them on exactly 1.15. Above the knee the value is
    rolled off towards 1.15 instead, so the order the author wrote survives.
    """
    resized = dimmed = False
    if "scale" in light:
        radius = LIGHT_TEXTURE_PX * float(light["scale"])
        target = LIGHT_TEXTURE_PX * pow(radius / LIGHT_TEXTURE_PX, LIGHT_RADIUS_CURVE)
        target = min(max(target, LIGHT_RADIUS_MIN), LIGHT_RADIUS_MAX)
        if abs(target - radius) > 1.0:
            light["scale"] = round(target / LIGHT_TEXTURE_PX, 2)
            resized = True
    if "energy" in light:
        energy = float(light["energy"])
        if energy > LIGHT_KNEE:
            rolled = LIGHT_KNEE + (LIGHT_ENERGY_MAX - LIGHT_KNEE) * (
                1.0 - math.exp(-(energy - LIGHT_KNEE) / (LIGHT_ENERGY_MAX - LIGHT_KNEE)))
            if abs(rolled - energy) > 0.005:
                light["energy"] = round(rolled, 2)
                dimmed = True
    return resized, dimmed


def normalise_lights(document: dict) -> dict:
    """Apply clamp_light to every light in a document, twice over.

    The document carries lights in two places: the flat `lights` list the renderer
    reads, and a copy inside each prop's `light` field, which the props carry so a
    tool can find what a prop is lit by. Both are normalised, or the two disagree.
    """
    resized = dimmed = 0
    for light in document.get("lights") or []:
        if isinstance(light, dict):
            a, b = clamp_light(light)
            resized += int(a)
            dimmed += int(b)
    for entry in document.get("props") or []:
        light = entry.get("light") if isinstance(entry, dict) else None
        if isinstance(light, dict):
            clamp_light(light)
    stats = document.setdefault("stats", {})
    stats["lights_resized"] = resized
    stats["lights_dimmed"] = dimmed
    return stats


def write_document(path: str, document: dict) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(document, fh, indent=2)
        fh.write("\n")


def ascii_map(level: dict, x0: int, x1: int, y0: int, y1: int) -> str:
    floor = cells(level, "Backdrop")
    geom = cells(level, "Geometry")
    lines = []
    for y in range(y0, y1 + 1):
        row = "".join("#" if (x, y) in geom else ("." if (x, y) in floor else " ")
                      for x in range(x0, x1 + 1))
        lines.append("%3d %s" % (y, row))
    lines.append("    " + "".join(str(x % 10) for x in range(x0, x1 + 1)))
    return "\n".join(lines)


def head() -> str:
    try:
        return subprocess.check_output(["git", "-C", ROOT, "rev-parse", "--short", "HEAD"],
                                       text=True).strip()
    except Exception:
        return "unknown"
