#!/usr/bin/env python3
"""Render the baked overworld layers to a PNG so the region can be reviewed
before it is opened in Godot. Uses the shipped tile atlas directly, so the
preview is the same pixels the game draws.

  python3 tools/overworld/preview.py [--full] [--scale N] [--at x,y,w,h]

Writes data/overworld/hollow_marches_preview.png (or the crop given by --at).
"""

from __future__ import annotations

import argparse
import json
import math
import os

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DATA = os.path.join(ROOT, "data", "overworld")
ART = os.path.join(ROOT, "assets", "environment", "overworld")
T = 16


def load_atlas():
    sheet = Image.open(os.path.join(ART, "overworld_tiles.png")).convert("RGBA")
    meta = json.load(open(os.path.join(DATA, "overworld_tiles.json")))
    props_sheet = Image.open(os.path.join(ART, "overworld_props.png")).convert("RGBA")
    props_meta = json.load(open(os.path.join(DATA, "overworld_props.json")))["frames"]
    return sheet, meta, props_sheet, props_meta


def decode(layers, name):
    rle = layers["layers"][name]["rle"]
    out = []
    for token, count in rle:
        out.extend([token] * count)
    return out


VARIANT_BLOCK = 3  # tiles per coarse cell; must match OverworldTiles.VARIANT_BLOCK


def flip_id(x, y):
    """Same hash as OverworldTiles.flip_id: 0 none, 1 mirror-x, 2 mirror-y, 3 both."""
    mixed = abs(((x * 374761393) ^ (y * 668265263) ^ 0x9E3779B9))
    return mixed % 4


TRANSPOSE = {0: None, 1: Image.FLIP_LEFT_RIGHT, 2: Image.FLIP_TOP_BOTTOM,
             3: Image.FLIP_LEFT_RIGHT}


def apply_flip(crop, flip):
    """Mirror a tile exactly the way the TileSet's flipped alternatives do."""
    if flip == 0:
        return crop
    out = crop.transpose(Image.FLIP_LEFT_RIGHT) if flip & 1 else crop
    if flip & 2:
        out = out.transpose(Image.FLIP_TOP_BOTTOM)
    return out


def variant_index(x, y, count):
    """Same hash as OverworldTiles.variant_index so preview == game.

    The variant is picked per BLOCK x BLOCK cluster, not per tile: a per-tile
    choice made the atlas's four stone tones a checkerboard at 2x zoom.
    """
    if count <= 1:
        return 0
    bx = math.floor(x / VARIANT_BLOCK)
    by = math.floor(y / VARIANT_BLOCK)
    jitter = abs((x * 83492791) ^ (y * 2654435761)) % 6
    if jitter == 0:
        bx -= 1
    elif jitter == 1:
        by -= 1
    bx += 4096
    by += 4096
    return abs((bx * 73856093) ^ (by * 19349663)) % count


def frame_for(meta, code_token, layer, x=0, y=0):
    code = code_token[0]
    mask = code_token[1] if len(code_token) > 1 else None
    codes = meta["codes"]
    if layer == "ground":
        names = codes["ground"].get(code)
        if not names:
            return None
        if mask:
            return names[int(mask, 16) % len(names)]
        # stable per-cell variant choice happens in preview; game does the same
        return names
    if layer == "detail":
        entry = codes["detail"].get(code)
        if not entry:
            return None
        if entry["masked"] and mask:
            return "%s#%d" % (entry["frame"], int(mask, 16))
        variants = entry.get("variant_names")
        if variants:
            # per-TILE pick, not the 3x3 ground lattice: an overlay is a feature,
            # so a per-block pick would draw it nine times in a row.
            mixed = abs((x * 92837111) ^ (y * 689287499) ^ 0x51ED270B)
            return variants[mixed % len(variants)]
        return entry["frame"]
    entry = codes["solid"].get(code)
    if not entry:
        return None
    if entry["masked"] and mask:
        m = int(mask, 16)
        variants = entry.get("variants", 16)
        return "%s#%d" % (entry["frame"], m if m < variants else m % variants)
    return entry["frame"]


def render(x0, y0, x1, y1, *, scale=1, draw_props=True, layers=None):
    sheet, meta, props_sheet, props_meta = load_atlas()
    if layers is None:
        layers = json.load(open(os.path.join(DATA, "hollow_marches_layers.json")))
    ground = decode(layers, "ground")
    detail = decode(layers, "detail")
    solid = decode(layers, "solid")
    W = layers["width"]
    index = meta["index"]

    img = Image.new("RGBA", ((x1 - x0) * T, (y1 - y0) * T), (18, 15, 24, 255))

    def blit(sheet_img, frame, px, py, flip=0):
        rect = index.get(frame) if sheet_img is sheet else None
        if rect is None:
            return
        crop = sheet_img.crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]))
        if flip:
            crop = apply_flip(crop, flip)
        img.alpha_composite(crop, (px, py))

    for y in range(y0, y1):
        for x in range(x0, x1):
            i = y * W + x
            g = ground[i]
            names = frame_for(meta, g, "ground", x, y)
            if names is None:
                continue
            if isinstance(names, list):
                pick = names[variant_index(x, y, len(names))]
            else:
                pick = names
            blit(sheet, pick, (x - x0) * T, (y - y0) * T, flip=flip_id(x, y))
            d = detail[i]
            if d != ".":
                f = frame_for(meta, d, "detail", x, y)
                if f:
                    blit(sheet, f, (x - x0) * T, (y - y0) * T)
            s = solid[i]
            if s != ".":
                f = frame_for(meta, s, "solid", x, y)
                if f:
                    blit(sheet, f, (x - x0) * T, (y - y0) * T)

    if draw_props:
        path = os.path.join(DATA, "hollow_marches_props.json")
        if os.path.exists(path):
            entries = json.load(open(path))["props"]
            for p in sorted(entries, key=lambda e: (e.get("z", 0), e["y"])):
                fr = props_meta.get(p["frame"])
                if not fr:
                    continue
                px = int(p["x"]) - (x0 * T + fr["w"] // 2)
                py = int(p["y"]) - (y0 * T + fr["h"]) + 4
                crop = props_sheet.crop((fr["x"], fr["y"], fr["x"] + fr["w"], fr["y"] + fr["h"]))
                img.alpha_composite(crop, (px, py))

    if scale != 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--at", default="", help="x,y,w,h in tiles")
    ap.add_argument("--scale", type=int, default=1)
    ap.add_argument("--out", default=os.path.join(DATA, "hollow_marches_preview.png"))
    args = ap.parse_args()
    layers = json.load(open(os.path.join(DATA, "hollow_marches_layers.json")))
    W, H = layers["width"], layers["height"]
    if args.at:
        x, y, w, h = (int(v) for v in args.at.split(","))
        x0, y0, x1, y1 = x, y, min(W, x + w), min(H, y + h)
    else:
        x0, y0, x1, y1 = 0, 0, W, H
    img = render(x0, y0, x1, y1, scale=args.scale)
    img.save(args.out)
    print("%s  %dx%d" % (args.out, img.width, img.height))


if __name__ == "__main__":
    main()
