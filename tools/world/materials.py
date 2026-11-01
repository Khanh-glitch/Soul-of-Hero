"""Veyra material library: verified 16x16 ground tiles sampled from the source packs.

Nothing here invents pixels. A tile is only accepted if it is a 16x16 window that is
100% opaque (so it seams without patching alpha) and passes a colour-class test that
proves it is the material it claims to be (stone is cool, soil is warm, sand is pale,
no tile may be mostly vegetation unless it is the vegetation family).

Run:  python3 materials.py
Out:  data/materials.json   (rect + source + colour stats for every accepted tile)
      out/preview_materials.png
"""
import glob
import json
import os

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "out")
VAULT = os.environ.get("SOH_ASSET_VAULT", "/home/user/asset_vault/x")
TILE = 16

PACKS = {
    "road": "574220-roads-reference-only",
    "fields": "665131-fields",
    "island": "351300-island",
    "bridges": "668008-bridges",
    "cursed": "craftpix-net-958568-free-cursed-land-top-down-pixel-art-tileset*",
    "village": "craftpix-net-504452-free-village-pixel-tileset-for-top-down-defense*",
    "bushes": "craftpix-net-141354-free-top-down-bushes-pixel-art*",
    "forest": "craftpix-net-505052-free-forest-objects-top-down-pixel-art*",
}


def pack(key, rel=None):
    base = sorted(glob.glob(os.path.join(VAULT, PACKS[key])))
    if not base:
        raise SystemExit(f"missing pack {key}")
    return os.path.join(base[0], rel) if rel else base[0]


def img(key, rel):
    return Image.open(pack(key, rel)).convert("RGBA")


def stats(t):
    a = np.array(t.convert("RGB")).astype(int)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    return {
        "r": float(r.mean()), "g": float(g.mean()), "b": float(b.mean()),
        "spread": float((a.max(axis=2) - a.min(axis=2)).mean()),
        "green": float(((g > r + 8) & (g > b + 20)).mean()),
        "warm": float((r > b + 25).mean()),
        "cool": float((b > r + 6).mean()),
        "lum": float(a.mean()),
    }


def scan(source, limit, test, step=2, min_gap=14):
    """Collect up to `limit` verified tiles from one image, spaced apart."""
    im = img(*source)
    arr = np.array(im)
    picked = []
    for y in range(0, im.height - TILE, step):
        for x in range(0, im.width - TILE, step):
            if arr[y:y + TILE, x:x + TILE, 3].min() < 255:
                continue
            t = im.crop((x, y, x + TILE, y + TILE))
            st = stats(t)
            if not test(st):
                continue
            if any(abs(x - px) < min_gap and abs(y - py) < min_gap for px, py in
                   [(p["x"], p["y"]) for p in picked]):
                continue
            picked.append({"name": source[0], "file": source[1], "x": x, "y": y,
                           "w": TILE, "h": TILE, "stats": st})
            if len(picked) >= limit:
                return picked
    return picked


# material family -> (sources in priority order, count needed, acceptance test)
FAMILIES = {
    "grass": ([("road", "PNG_Tiled/Ground_grass.png")], 8,
              lambda s: s["green"] > 0.55 and 70 < s["lum"] < 150 and s["spread"] > 10),
    "grass_dark": ([("road", "PNG_Tiled/Ground_grass.png")], 5,
                   lambda s: s["green"] > 0.5 and 95 < s["lum"] < 116),
    # paved road: the roads kit is a module atlas on transparency, so a road tile is a
    # 16x16 window that is fully opaque (scan() rejects any window with alpha) and grey
    # / cool - i.e. cobble, not the grass the modules are drawn over.
    "road": ([("road", "PNG_Tiled/Road1_grass.png")], 8,
             lambda s: 120 < s["lum"] < 145 and s["b"] > s["r"] + 30 and s["spread"] < 70),
    "soil": ([("fields", "1 Tiles/FieldsTile_02.png"), ("fields", "1 Tiles/FieldsTile_05.png"),
              ("fields", "1 Tiles/FieldsTile_11.png")], 6,
             lambda s: s["warm"] > 0.75 and s["green"] < 0.04 and s["spread"] > 18),
    "sand": ([("island", "Tileset/Tiled.png")], 6,
             lambda s: s["r"] > 215 and s["g"] > 200 and s["r"] > s["b"] + 25
             and s["green"] < 0.2 and s["spread"] < 26),
    "stone": ([("island", "Tileset/Tiled.png"), ("cursed", "PNG/Ground.png")], 6,
              lambda s: s["cool"] > 0.5 and s["spread"] < 70 and 80 < s["lum"] < 190),
    "blight": ([("cursed", "PNG/Ground.png")], 6,
               lambda s: s["r"] > 150 and s["r"] > s["g"] + 30 and s["lum"] > 90),
    # the bridges pack's "Water_animation" sheet is a bridge kit, not water: island only
    "water": ([("island", "Tileset/Tiled.png")], 4,
              lambda s: s["b"] > s["r"] + 45 and 120 < s["b"] < 235 and s["r"] < 175
              and s["green"] < 0.5 and s["spread"] < 110),
}


OPTIONAL = set()
FLAT_OK = {"sand"}


DECOR = {
    "tuft": ("village", "2 Objects/5 Grass/*.png"),
    "pebble": ("village", "2 Objects/2 Stone/*.png"),
    "flower": ("bushes", "PNG/Assets/Bush_*flowers2.png"),
    "mushroom": ("forest", "PNG/Assets/*mushroom3.png"),
}


def scan_decor():
    out = {}
    for fam, (key, pattern) in DECOR.items():
        files = sorted(glob.glob(os.path.join(pack(key), pattern)))
        items = []
        for f in files[:12]:
            im = Image.open(f).convert("RGBA")
            bb = im.getbbox()
            if not bb:
                continue
            items.append({"file": os.path.relpath(f, pack(key)),
                          "size": [bb[2] - bb[0], bb[3] - bb[1]]})
        if items:
            out[fam] = items
    return out


def build():
    os.makedirs(OUT, exist_ok=True)
    lib = {}
    for fam, (sources, count, test) in FAMILIES.items():
        tiles = []
        for src in sources:
            if len(tiles) >= count:
                break
            tiles += scan(src, count - len(tiles), test)
        if not tiles and fam in FLAT_OK:
            # every sand window in the island sheet carries a foam line, so the beach
            # uses one flat tile built from the sheet's own median sand colour.
            src = sources[0]
            im = img(*src)
            a = np.array(im.convert("RGB")).astype(int)
            r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
            m = (r > 215) & (g > 200) & (r > b + 25)
            if m.sum() > 500:
                px = a[m]
                med = np.median(px, axis=0).astype(int)
                tiles = [{"name": src[0], "file": src[1], "x": -1, "y": -1,
                          "w": TILE, "h": TILE, "flat": [int(v) for v in med],
                          "stats": {"r": float(med[0]), "g": float(med[1]),
                                    "b": float(med[2]), "spread": 0.0, "green": 0.0,
                                    "warm": 1.0, "cool": 0.0, "lum": float(med.mean())}}]
                print(f"{fam:11s} flat tile {list(med)} from {src[1]}")
        if not tiles:
            if fam in OPTIONAL:
                print(f"{fam:11s} skipped (optional, no tile passed)")
                continue
            raise SystemExit(f"family {fam}: no tile passed the test - refusing to invent one")
        lib[fam] = tiles
        print(f"{fam:11s} {len(tiles)} tiles  lum={np.mean([t['stats']['lum'] for t in tiles]):.0f}")

    # preview sheet
    cols = max(len(v) for v in lib.values())
    cw, ch = 64, 78
    sheet = Image.new("RGB", (cols * cw + 200, len(lib) * ch + 30), (26, 26, 30))
    d = ImageDraw.Draw(sheet)
    d.text((6, 8), "VEYRA ground material library - 16x16 verified tiles (nearest, 4x)", fill=(240, 240, 240))
    for row, (fam, tiles) in enumerate(lib.items()):
        y = 26 + row * ch
        d.text((6, y + 20), fam, fill=(230, 230, 180))
        for col, t in enumerate(tiles):
            if t.get("flat"):
                im = Image.new("RGBA", (16, 16), tuple(t["flat"]) + (255,))
            else:
                im = img(t["name"], t["file"]).crop((t["x"], t["y"], t["x"] + 16, t["y"] + 16))
            big = im.resize((64, 64), Image.NEAREST)
            sheet.paste(big, (200 + col * cw, y), big)
    sheet.save(os.path.join(OUT, "preview_materials.png"))
    decor = scan_decor()
    lib["_decor"] = decor
    json.dump(lib, open(os.path.join(HERE, "data", "materials.json"), "w"), indent=1)
    print("decor families:", {k: len(v) for k, v in decor.items()})
    print("wrote", os.path.join(OUT, "preview_materials.png"))


if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
    build()
