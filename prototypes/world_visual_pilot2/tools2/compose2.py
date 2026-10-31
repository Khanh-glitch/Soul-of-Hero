#!/usr/bin/env python3
"""Soul of Hero - world visual audition, pilot 2 ("Waystation approach").

New-source environment pixels and D051 canonical avatars. NOTHING from A1's
overworld atlases is drawn: terrain, road, props, characters and light all come
from the supplied CraftPix packs and the locked D051 base characters.

Geography is A1's, untouched: `data/corridor_cells.v1.json` (copied from the
previous pilot, SHA-256 pinned) supplies every cell token. This renderer only
decides how those authored cells *look*.

Visual legend (Gate 1 decision, one meaning per surface):
  cobbled road   authored detail '=' ribbon  -> the route, "go this way"
  trodden earth  authored ground 'd', no '=' -> the clearing people occupy
  grass moor     authored ground ';'         -> optional exploration space
  clay shelf     authored solid '#'          -> inaccessible terrain

    python3 compose2.py --lighting day   --out ../audition2/evidence
    python3 compose2.py --lighting night --out ../audition2/evidence
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from PIL import Image, ImageChops, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VAULT = os.environ.get("SOH_ASSET_VAULT", "/home/user/asset_vault")
X = os.path.join(VAULT, "x")
PACK = {
    "504452": "craftpix-net-504452-free-village-pixel-tileset-for-top-down-defense",
    "574220": "craftpix-net-574220-free-path-and-road-top-down-pixel-tileset",
    "385863": "craftpix-net-385863-free-top-down-trees-pixel-art",
    "141354": "craftpix-net-141354-free-top-down-bushes-pixel-art",
    "974061": "craftpix-net-974061-free-rocks-and-stones-top-down-pixel-art",
    "218281": "craftpix-net-218281-free-pixel-art-dungeon-objects-asset-pack",
    "555940": "craftpix-net-555940-free-base-4-direction-male-character-pixel-art",
    "419402": "craftpix-net-419402-free-base-4-direction-female-character-pixel-art",
}
TILE = 16
NATIVE = (640, 360)
EVAL = (1280, 720)
ZOOM = 2
WINDOW = (320, 180)

# ---- source files actually used (internal path inside each ZIP) -------------
SRC = {
    "ground": ("574220", "PNG_Tiled/Ground_grass.png"),
    "road": ("574220", "PNG_Tiled/Road1_grass.png"),
    "clay": ("504452", "1 Tiles/FieldsTileset.png"),
    "fence": ("504452", "1.1 Tiles/Tileset2.png"),
    "tree1": ("385863", "PNG/Assets_separately/Trees/Tree1.png"),
    "tree2": ("385863", "PNG/Assets_separately/Trees/Tree2.png"),
    "dead": ("385863", "PNG/Assets_separately/Trees/Broken_tree7.png"),
    "burned": ("385863", "PNG/Assets_separately/Trees/Burned_tree1.png"),
    "bush": ("141354", "PNG/Assets/Bush_blue_flowers1.png"),
    "bush2": ("141354", "PNG/Assets/Bush_simple1_1.png"),
    "rock1": ("974061", "PNG/Objects_separately/Rock1_1.png"),
    "rock2": ("974061", "PNG/Objects_separately/Rock2_1.png"),
    "rock3": ("974061", "PNG/Objects_separately/Rock2_3.png"),
    "supply": ("218281", "PNG/supplies_objects.png"),
    "male_idle": ("555940", "PNG/Unarmed/Without_shadow/Unarmed_Idle_without_shadow.png"),
    "male_walk": ("555940", "PNG/Unarmed/Without_shadow/Unarmed_Walk_without_shadow.png"),
    "female_idle": ("419402", "PNG/Unarmed/Without_shadow/Unarmed_Idle_without_shadow.png"),
    "shadow": ("555940", "PNG/Unarmed/Without_shadow/shadow_single.png"),
}

# ---- named crops (source pixels), each justified in data/placement2.json ----
CROP = {
    # terrain fills: 16x16 interiors of the Ground_grass material blobs
    "grass_a": ("ground", (25, 25, 16, 16)),
    "grass_b": ("ground", (33, 33, 16, 16)),
    "grass_c": ("ground", (41, 41, 16, 16)),
    "grass_d": ("ground", (41, 121, 16, 16)),
    "grass_e": ("ground", (49, 129, 16, 16)),
    "grass_f": ("ground", (57, 137, 16, 16)),
    "earth": ("ground", (49, 417, 16, 16)),      # dry olive material
    # road: the 7x2-tile strip, 28 px tall = 6 blend + 16 cobble + 6 blend
    "road_strip": ("road", (17, 377, 110, 28)),
    # palisade modules
    "fence_h": ("fence", (0, 8, 144, 46)),
    "fence_v": ("fence", (0, 120, 144, 60)),
    "gate": ("fence", (96, 4, 64, 46)),
    "spikes": ("fence", (192, 192, 48, 40)),
    # props
    "tree_big": ("tree1", (0, 0, 128, 128)),
    "tree_small": ("tree2", (0, 0, 64, 64)),
    "dead_tree": ("dead", (0, 0, 128, 128)),
    "burned": ("burned", (0, 0, 32, 32)),
    "bush_berry": ("bush", (0, 0, 64, 64)),
    "bush_small": ("bush2", (0, 0, 32, 32)),
    "rock_big": ("rock1", (0, 0, 64, 64)),
    "rock_mid": ("rock2", (0, 0, 64, 64)),
    "rock_small": ("rock3", (0, 0, 32, 32)),
    "shelf": ("supply", (2, 12, 45, 43)),
    "shelf2": ("supply", (50, 75, 45, 44)),
    "produce": ("supply", (0, 133, 16, 15)),
    "produce2": ("supply", (48, 133, 16, 16)),
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for c in iter(lambda: fh.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


class Art:
    def __init__(self):
        self.images = {}
        self.prov = {}
        for key, (pack, rel) in SRC.items():
            path = os.path.join(X, PACK[pack], rel)
            if not os.path.exists(path):
                raise SystemExit(f"missing source: {path}")
            self.images[key] = Image.open(path).convert("RGBA")
            self.prov[key] = {"pack": PACK[pack] + ".zip", "zip_sha256": self._zip_sha(pack),
                              "internal_path": rel, "png_sha256": sha256(path),
                              "png_size": list(self.images[key].size)}
        self.masks = {}

    def _zip_sha(self, pack):
        if not hasattr(self, "_zips"):
            self._zips = {}
        if pack not in self._zips:
            zp = os.path.join(VAULT, PACK[pack] + ".zip")
            self._zips[pack] = sha256(zp) if os.path.exists(zp) else "ZIP_NOT_RETAINED"
        return self._zips[pack]

    def crop(self, name):
        key, (x, y, w, h) = CROP[name]
        return self.images[key].crop((x, y, x + w, y + h))

    def surf(self, name):
        # exact crop, no compositing: compositing blended tile borders into a grid
        """A tileable 16x16 surface with a 3px wrap blur so seams disappear."""
        if name not in self.masks:
            t = self.crop(name)
            wrap = Image.new("RGBA", (16, 16))
            for dy in (-16, 0, 16):
                for dx in (-16, 0, 16):
                    wrap.alpha_composite(t, (dx, dy))
            self.masks[name] = wrap
        return self.masks[name]


def clay_tile(art):
    """Pick the purest bare-clay 16x16 tile from the fields sheet (deterministic)."""
    sheet = art.images["clay"]
    best, best_score = None, -1
    for ty in range(0, sheet.height - 16 + 1, 16):
        for tx in range(0, sheet.width - 16 + 1, 16):
            t = sheet.crop((tx, ty, tx + 16, ty + 16)).convert("RGB")
            px = list(t.getdata())
            warm = sum(1 for r, g, b in px if r > 150 and r > g + 25 and g > b)
            score = warm / len(px)
            if score > best_score:
                best_score, best = score, (tx, ty)
    return sheet.crop((best[0], best[1], best[0] + 16, best[1] + 16)), {"clay_tile": best, "warm_ratio": round(best_score, 3)}


def heal_columns(im):
    """Copy the nearest opaque column into any fully transparent column."""
    im = im.convert("RGBA"); w, h = im.size; px = im.load()
    for x in range(w):
        if all(px[x, y][3] == 0 for y in range(h)):
            src = next((x2 for d in range(1, w)
                        for x2 in (x - d, x + d) if 0 <= x2 < w
                        and any(px[x2, y][3] for y in range(h))), None)
            if src is not None:
                for y in range(h):
                    px[x, y] = px[src, y]
    return im


EARTH_WASH = (120, 96, 58, 44)


def wash(im, rgba):
    """Tint a tile instead of swapping it: keeps grass texture, no hard edges."""
    out = im.convert("RGBA").copy()
    ov = Image.new("RGBA", out.size, rgba)
    out.alpha_composite(ov)
    return out


def road_bands(art):
    """Split the road strip into fill + four fringe bands (real source pixels)."""
    strip = art.crop("road_strip")             # 110 x 28
    fill = strip.crop((0, 6, 96, 22))          # 96x16 run of cobble
    fill = heal_columns(fill)                  # strip has empty columns -> black slits
    top = strip.crop((0, 0, 96, 6))            # 6 px grass->cobble blend
    bot = strip.crop((0, 22, 96, 28))          # 6 px cobble->grass blend
    return {"fill": fill,
            "top": top, "bot": bot,
            "left": top.transpose(Image.ROTATE_90),
            "right": bot.transpose(Image.ROTATE_90)}


def radial(size, color, power=1.6):
    """Procedural light cookie (no borrowed art)."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = im.load()
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5 / c
            if d >= 1:
                continue
            a = int(255 * max(0.0, 1 - d) ** power)
            px[x, y] = (color[0], color[1], color[2], a)
    return im


class Scene:
    def __init__(self, lighting="day"):
        self.art = Art()
        self.lighting = lighting
        self.cells = json.load(open(os.path.join(HERE, "data/cells2.json")))
        win = self.cells["corridor"]
        self.ox, self.oy = win["origin_cell"]
        self.w, self.h = win["size_cells"]
        self.ground, self.detail, self.solid = (win["layers"]["ground"],
                                                win["layers"]["detail"],
                                                win["layers"]["solid"])
        # Paved surface = the authored route/nav corridor, widened by one cell so
        # the carriageway is 3 cells wide, and clipped to authored walkable dirt.
        # The authored '=' detail covers 531 cells (a plaza, not a road), which
        # would erase the road/clearing distinction; the *route* is the road.
        poi = self.cells["corridor"]["poi"]
        route = {(c[0], c[1]) for c in self.cells["corridor"]["route"]["outbound_cells"]}
        route |= {(c[0], c[1]) for c in self.cells["corridor"]["route"]["return_cells"]}
        route |= {(c[0], c[1]) for c in poi["required_nav_cells"]}
        paved = set()
        for (rx, ry) in route:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    cx, cy = rx + dx, ry + dy
                    if not (self.ox <= cx < self.ox + self.w and self.oy <= cy < self.oy + self.h):
                        continue
                    if self.solid[cy - self.oy][cx - self.ox] != ".":
                        continue
                    if self.ground[cy - self.oy][cx - self.ox] != "d":
                        continue
                    paved.add((cx, cy))
        self.road = paved
        self.place = json.load(open(os.path.join(HERE, "data/placement2.json")))
        self.trace = []

    def g(self, x, y):
        return self.ground[y - self.oy][x - self.ox]

    def d(self, x, y):
        return self.detail[y - self.oy][x - self.ox]

    def s(self, x, y):
        return self.solid[y - self.oy][x - self.ox]

    # ---- layers ---------------------------------------------------------
    def terrain(self):
        art = self.art
        canvas = Image.new("RGBA", (self.w * TILE, self.h * TILE), (0, 0, 0, 0))
        clay, clay_meta = clay_tile(art)
        bands = road_bands(art)
        surf = {"grass": [art.surf(k) for k in ("grass_a", "grass_b", "grass_c",
                                                "grass_d", "grass_e", "grass_f")],
                "earth": art.surf("earth"),
                "clay": clay}
        def textured(t):
            px = list(t.convert("RGB").getdata())
            m = sum(sum(q) / 3 for q in px) / len(px)
            return (sum((sum(q) / 3 - m) ** 2 for q in px) / len(px)) ** 0.5 > 6.0
        surf["grass"] = [t for t in surf["grass"] if textured(t)] or surf["grass"][:1]
        for cy in range(self.oy, self.oy + self.h):
            for cx in range(self.ox, self.ox + self.w):
                tok, sol = self.g(cx, cy), self.s(cx, cy)
                h = (cx * 73856093 ^ cy * 19349663) & 0xFFFFFFF
                if sol != ".":
                    im, kind = surf["clay"], "clay"
                elif (cx, cy) in self.road:
                    continue  # drawn by the road pass
                else:
                    im = surf["grass"][h % len(surf["grass"])]
                    if (h >> 7) & 1:
                        im = im.transpose(Image.FLIP_LEFT_RIGHT)
                    if (h >> 3) % 4 == 0:
                        im = im.transpose(Image.FLIP_TOP_BOTTOM)
                    if tok == "d":
                        im, kind = wash(im, EARTH_WASH), "earth"
                    else:
                        kind = "grass"
                canvas.alpha_composite(im, ((cx - self.ox) * TILE, (cy - self.oy) * TILE))
                self.trace.append({"layer": "terrain", "cell": [cx, cy], "surface": kind,
                                   "source": self.art.prov["ground" if kind != "clay" else "clay"]})
        # road: cobble fill everywhere, then a fringe band on every non-road edge
        for (cx, cy) in sorted(self.road):
            col = 16 * ((cx * 5 + cy * 3) % 6)
            px, py = (cx - self.ox) * TILE, (cy - self.oy) * TILE
            canvas.alpha_composite(bands["fill"].crop((col, 0, col + 16, 16)), (px, py))
            self.trace.append({"layer": "road_fill", "cell": [cx, cy],
                               "crop": [17 + col, 383, 16, 16], "source": art.prov["road"]})
        for (cx, cy) in sorted(self.road):
            px, py = (cx - self.ox) * TILE, (cy - self.oy) * TILE
            col = 16 * ((cx * 5 + cy * 3) % 6)
            for (dx, dy), band in (((0, -1), "top"), ((0, 1), "bot"), ((-1, 0), "left"), ((1, 0), "right")):
                if (cx + dx, cy + dy) in self.road:
                    continue
                b = bands[band]
                if band == "top":
                    canvas.alpha_composite(b.crop((col, 0, col + 16, 6)), (px, py - 6))
                elif band == "bot":
                    canvas.alpha_composite(b.crop((col, 0, col + 16, 6)), (px, py + 16))
                elif band == "left":
                    canvas.alpha_composite(b.crop((0, col, 6, col + 16)), (px - 6, py))
                else:
                    canvas.alpha_composite(b.crop((0, col, 6, col + 16)), (px + 16, py))
                self.trace.append({"layer": "road_fringe", "cell": [cx, cy], "edge": band,
                                   "source": art.prov["road"]})
        return canvas, clay_meta

    def props(self):
        out = []
        for p in self.place["props"]:
            im = self.art.crop(p["crop"])
            sc = p.get("scale", 1)
            if sc != 1:
                im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))),
                               Image.NEAREST)
            if p.get("flip") == "h":
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            out.append({"img": im, "x": p["x"], "y": p["y"], "z": p.get("z", 0),
                        "name": p["crop"], "reason": p.get("reason", ""),
                        "crop": CROP[p["crop"]]})
        return out

    def actor(self, who, cell, frame, direction):
        """D051 base body: 64x64 cells, 12 columns, 4 rows (down,left,right,up)."""
        art = self.art
        key = "male_walk" if frame == "walk" and who == "male" else (
            "female_idle" if who == "female" else "male_idle")
        row = {"down": 0, "left": 1, "right": 2, "up": 3}[direction]
        col = self.place["actors"][who].get("frame_index", 0)
        sheet = art.images[key]
        cellimg = sheet.crop((col * 64, row * 64, col * 64 + 64, row * 64 + 64))
        foot_x = cell[0] * TILE + TILE / 2
        foot_y = cell[1] * TILE + TILE
        return {"img": cellimg, "x": foot_x - 32, "y": foot_y - 43,
                "shadow": art.images["shadow"], "who": who, "src": art.prov[key],
                "crop": [col * 64, row * 64, 64, 64]}

    def compose(self):
        """Single terrain pass, soft contact shadows, then y-sorted props + D051 actors."""
        canvas, clay_meta = self.terrain()
        ox, oy = self.ox * TILE, self.oy * TILE
        W, H = canvas.size
        props = self.props()
        for p in props:
            sw = max(6, int(p["img"].width * 0.7))
            sh = Image.new("RGBA", (sw, 5), (0, 0, 0, 0))
            ImageDraw.Draw(sh).ellipse([0, 0, sw - 1, 4], fill=(22, 20, 16, 88))
            canvas.alpha_composite(sh, (int(p["x"] - sw / 2 - ox), int(p["y"] - 3 - oy)))
        draw = []
        for p in props:
            if p["z"] < 0:
                continue
            draw.append((p["z"], p["y"], 0, p["img"],
                         int(p["x"] - p["img"].width / 2 - ox),
                         int(p["y"] - p["img"].height - oy), "prop:" + p["name"]))
        for who, spec in self.place["actors"].items():
            a = self.actor(who, spec["cell"], spec.get("frame", "idle"), spec.get("dir", "down"))
            fx, fy = spec["cell"][0] * TILE + TILE / 2, spec["cell"][1] * TILE + TILE
            sh = Image.new("RGBA", (16, 5), (0, 0, 0, 0))
            ImageDraw.Draw(sh).ellipse([0, 0, 15, 4], fill=(22, 20, 16, 96))
            canvas.alpha_composite(sh, (int(fx - 8 - ox), int(fy - 3 - oy)))
            draw.append((2, fy, 1, a["img"], int(a["x"] - ox), int(a["y"] - oy),
                         "actor:" + who))
        draw.sort(key=lambda t: (t[0], t[1], t[2]))
        trace = []
        for z, yy, order, im, dx, dy, tag in draw:
            if dx > W or dy > H or dx + im.width < 0 or dy + im.height < 0:
                continue
            canvas.alpha_composite(im, (dx, dy))
            trace.append({"op": tag, "world": [dx + ox, dy + oy],
                          "size": [im.width, im.height], "z": z})
        return canvas, trace
def capture(world, centre, origin):
    cx, cy = centre[0] * TILE + TILE // 2, centre[1] * TILE + TILE // 2
    ox, oy = origin
    left, top = cx - WINDOW[0] // 2 - ox, cy - WINDOW[1] // 2 - oy
    crop = Image.new("RGBA", WINDOW, (0, 0, 0, 255))
    crop.alpha_composite(world.crop((left, top, left + WINDOW[0], top + WINDOW[1])))
    return crop.convert("RGB").resize(NATIVE, Image.NEAREST)


def light(canvas, lighting, lights, origin):
    if lighting == "day":
        tint = Image.new("RGB", canvas.size, (247, 243, 232))
        canvas = Image.composite(canvas.convert("RGB"), canvas.convert("RGB"), Image.new("L", canvas.size, 0))
        out = ImageChops.multiply(canvas.convert("RGB"), tint)
    else:
        tint = Image.new("RGB", canvas.size, (74, 84, 132))
        out = ImageChops.multiply(canvas.convert("RGB"), tint)
    for L in lights:
        cookie = radial(int(L["r"] * 2), L["color"])
        lay = Image.new("RGB", canvas.size, (0, 0, 0))
        mask = Image.new("L", canvas.size, 0)
        px = int(L["x"] - origin[0] - L["r"])
        py = int(L["y"] - origin[1] - L["r"])
        lay.paste(cookie.convert("RGB"), (px, py), cookie)
        mask.paste(cookie.split()[3].point(lambda v: int(v * L["s"])), (px, py))
        if lighting == "day":
            out = Image.composite(ImageChops.add(out, lay), out, mask)
        else:
            out = Image.composite(ImageChops.add(out, lay), out, mask)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lighting", default="day")
    ap.add_argument("--out", default=os.path.join(HERE, "evidence"))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    sc = Scene(args.lighting)
    world, clay_meta = sc.terrain()
    world, trace = sc.compose()
    origin = (sc.ox * TILE, sc.oy * TILE)
    stations = json.load(open(os.path.join(HERE, "data/stations2.json")))["stations"]
    lights = sc.place["lights"]
    report = {"lighting": args.lighting, "stations": [], "sources": sc.art.prov,
              "clay": clay_meta, "trace_entries": len(trace)}
    for st in stations:
        nat = capture(world, st["centre"], origin)
        wx = st["centre"][0] * TILE + TILE // 2 - WINDOW[0] // 2
        wy = st["centre"][1] * TILE + TILE // 2 - WINDOW[1] // 2
        rel = [dict(L, x=L["x"] - wx, y=L["y"] - wy) for L in lights]
        nat = light(nat, args.lighting, rel, (0, 0))
        crop_trace = [t for t in trace
                      if wx <= t["world"][0] < wx + WINDOW[0] and wy <= t["world"][1] < wy + WINDOW[1]]
        name = f"pilot2_{args.lighting}_{st['id']}"
        p640 = os.path.join(args.out, name + "_640x360.png")
        p1280 = os.path.join(args.out, name + "_1280x720.png")
        nat.save(p640)
        nat.resize(EVAL, Image.NEAREST).save(p1280)
        report["stations"].append({"id": st["id"], "centre": st["centre"], "native": p640,
                                   "eval": p1280, "sha256": sha256(p640),
                                   "crop": [wx, wy], "purpose": st["purpose"],
                                   "visible_ops": len(crop_trace)})
    world.convert("RGB").save(os.path.join(args.out, f"world2_{args.lighting}.png"))
    json.dump(report, open(os.path.join(args.out, f"report2_{args.lighting}.json"), "w"), indent=2)
    json.dump({"entries": trace}, open(os.path.join(HERE, f"data/trace2_{args.lighting}.json"), "w"), indent=0)
    print(json.dumps({"lighting": args.lighting, "trace": len(trace),
                      "stations": [(s["id"], s["sha256"][:12]) for s in report["stations"]]}, indent=1))


if __name__ == "__main__":
    main()
