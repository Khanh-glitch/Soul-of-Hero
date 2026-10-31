"""Pilot 3 compositor.

Draws the authored A1 Waystation corridor from the pilot-3 source registry only.
Two candidate layouts share the same geography, the same three cameras and the same
lighting, so they can be compared under identical viewing conditions.

Rules enforced here (see sources3.py and the inspection sheet):
  * no resampling: every sprite is drawn at its native pixel size;
  * no synthesised alpha: material tiles are 100%-opaque interior samples;
  * pavement fringe bands are the road pack's own 6 px edge, native for N/S and
    rotated 90 degrees for E/W (a whole-band rotation, never a stretched crop);
  * one D051 character per gameplay frame, the other only in a labelled
    identical-condition validation capture.
"""
import argparse
import hashlib
import json
import os

from PIL import Image, ImageDraw

import sources3 as S

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WINDOW = (320, 180)          # world pixels visible at the 640x360 logical viewport
EVAL = (1280, 720)           # nearest-neighbour evidence size
CELL = 16
LOGICAL = (640, 360)


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for c in iter(lambda: fh.read(1 << 16), b""):
            h.update(c)
    return h.hexdigest()


class Art:
    def __init__(self):
        self.imgs = S.load_images()
        self.verdicts = S.validate_rects(self.imgs, S.SPRITES)
        self.materials = S.resolve_materials(self.imgs)
        self.prov = {}
        for key in sorted(S.FILES):
            p = S.path_of(key)
            pack = S.FILES[key][0]
            self.prov[key] = {"pack": S.PACK[pack][2], "pack_name": S.PACK[pack][1],
                              "file": os.path.relpath(p, S.pack_dir(pack)),
                              "sha256": S.sha256(p), "size": list(self.imgs[key].size)}
        self.grass_all = [self.imgs["ground"].crop(
            (m["rect"][0], m["rect"][1], m["rect"][0] + 16, m["rect"][1] + 16))
            for m in self.materials["grass"]]
        def tone(im):
            px = list(im.convert("RGB").getdata())
            n = len(px)
            return tuple(sum(q[i] for q in px) / n for i in range(3))
        tones = sorted(self.grass_all, key=lambda t: sum(tone(t)))
        base = tone(tones[len(tones) // 2])
        self.grass = [t for t in tones if max(abs(a - b) for a, b in zip(tone(t), base)) < 16] or [tones[len(tones) // 2]]
        self.grass_tone = [round(v, 1) for v in base]
        self.pave = [self.imgs[m["file"]].crop(
            (m["rect"][0], m["rect"][1], m["rect"][0] + 16, m["rect"][1] + 16))
            for m in self.materials["pave"]]
        self.track = [self.imgs[m["file"]].crop(
            (m["rect"][0], m["rect"][1], m["rect"][0] + 16, m["rect"][1] + 16))
            for m in self.materials["track"]]
        bx, by, bw, bh = S.BANDS["pave_top"][1]
        band = self.imgs["road1"].crop((bx, by, bx + 96, by + bh))
        self.band_top = band
        self.band_bot = self.imgs["road1"].crop((17, 399, 17 + 96, 405))
        self.rock_small = [self.imgs[k].crop(self.imgs[k].getbbox())
                           for k in ("rock_3", "rock_4", "rock_5", "rock_6",
                                     "rock_7", "rock_8")]
        self.rock_big = [self.imgs[k].crop(self.imgs[k].getbbox())
                         for k in ("rock_1", "rock_2")]

    def sprite(self, name):
        key, rect, anchor, why = S.SPRITES[name]
        im = self.imgs[key]
        if rect is None:
            im = im.crop(im.getbbox())
        else:
            im = im.crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]))
        return im, self.verdicts[name]


def h32(*vals):
    h = 2166136261
    for v in vals:
        h ^= int(v) & 0xFFFFFFFF
        h = (h * 16777619) & 0xFFFFFFFF
    return h


class Scene:
    def __init__(self, art, layout, lighting="day"):
        self.art = art
        self.layout = layout
        self.lighting = lighting
        self.trace = []
        doc = json.load(open(os.path.join(HERE, "data", "cells2.json")))
        c = doc["corridor"]
        self.ox, self.oy = c["origin_cell"]
        self.origin_cell = (self.ox, self.oy)
        self.w, self.h = c["size_cells"]
        self.g = c["layers"]["ground"]
        self.det = c["layers"]["detail"]
        self.solid = c["layers"]["solid"]
        self.route = {tuple(p) for p in c["route"]["outbound_cells"]} | \
                     {tuple(p) for p in c["route"]["return_cells"]} | \
                     {tuple(p) for p in c["poi"]["required_nav_cells"]}
        self.poi = c["poi"]
        self.pave_mask, self.pave_dropped = self._clean_paving()

    def _clean_paving(self, min_cells=12):
        """Authored 'd' is dotted with single-cell specks. Rendering keeps the paving
        that forms a place (>= min_cells connected) and lets the specks read as moor.
        The authored layer is untouched; the dropped count is reported."""
        from collections import deque
        cells = {(x, y) for j in range(self.h) for i in range(self.w)
                 for (x, y) in [(self.ox + i, self.oy + j)] if self.tok_at(x, y) == "d"}
        seen, keep, dropped = set(), set(), 0
        for c0 in cells:
            if c0 in seen:
                continue
            q = deque([c0]); comp = []
            seen.add(c0)
            while q:
                cx, cy = q.popleft(); comp.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    n = (cx + dx, cy + dy)
                    if n in cells and n not in seen:
                        seen.add(n); q.append(n)
            if len(comp) >= min_cells:
                keep.update(comp)
            else:
                dropped += len(comp)
        return keep, dropped

    def tok_at(self, x, y):
        return self.ground_at(x, y)[0]

    # ---- masks -----------------------------------------------------------
    def ground_at(self, x, y):
        if not (self.ox <= x < self.ox + self.w and self.oy <= y < self.oy + self.h):
            return ";", ".", "."
        i, j = x - self.ox, y - self.oy
        return self.g[j][i], self.det[j][i], self.solid[j][i]

    def paved(self, x, y):
        return (x, y) in self.pave_mask

    # ---- terrain ---------------------------------------------------------
    def terrain(self):
        W, H = self.w * CELL, self.h * CELL
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        for j in range(self.h):
            for i in range(self.w):
                x, y = self.ox + i, self.oy + j
                tok, det, sol = self.ground_at(x, y)
                if (x, y) in self.pave_mask:
                    variant = det[1] if len(det) > 1 else "0"
                    fill = self.art.pave[h32(ord(variant), 7) % len(self.art.pave)]
                    kind = "pavement"
                # NOTE: route cells deliberately share the yard's stone. The pack's earth
                # track tile is a brick course; one cell wide it read as a low wall and was
                # withdrawn (see PILOT3.md, self-critique item 3).
                else:
                    # authored detail token groups the moor into coherent patches
                    sub = h32(ord(det[0]) if det else 0, x // 6, y // 6)
                    fill = self.art.grass[sub % len(self.art.grass)]
                    if (sub >> 9) & 1:
                        fill = fill.transpose(Image.FLIP_LEFT_RIGHT)
                    if (sub >> 11) & 1:
                        fill = fill.transpose(Image.FLIP_TOP_BOTTOM)
                    kind = "moor"
                canvas.alpha_composite(fill, (i * CELL, j * CELL))
                self.trace.append({"layer": "terrain", "cell": [x, y], "surface": kind})
        self._pavement_edges(canvas)
        self._cliff(canvas)
        return canvas

    def _pavement_edges(self, canvas):
        top, bot = self.art.band_top, self.art.band_bot
        left = top.transpose(Image.ROTATE_90)
        right = bot.transpose(Image.ROTATE_90)
        n = 0
        for j in range(self.h):
            for i in range(self.w):
                x, y = self.ox + i, self.oy + j
                if not self.paved(x, y):
                    continue
                px, py = i * CELL, j * CELL
                if not self.paved(x, y - 1):
                    canvas.alpha_composite(top.crop((0, 0, CELL, 6)), (px, py))
                    n += 1
                if not self.paved(x, y + 1):
                    canvas.alpha_composite(bot.crop((0, 0, CELL, 6)), (px, py + 10))
                    n += 1
                if not self.paved(x - 1, y):
                    canvas.alpha_composite(left.crop((0, 0, 6, CELL)), (px, py))
                    n += 1
                if not self.paved(x + 1, y):
                    canvas.alpha_composite(right.crop((0, 0, 6, CELL)), (px + 10, py))
                    n += 1
        self.trace.append({"layer": "pavement_edges", "cells": n})

    def _cliff(self, canvas):
        """Solid '#' cells are drawn as a boulder mass, never as walkable ground."""
        placed = 0
        for j in range(self.h):
            for i in range(self.w):
                x, y = self.ox + i, self.oy + j
                if self.ground_at(x, y)[2][0] == ".":
                    continue
                # one boulder per 24 px sub-cell, jittered by hash
                sx, sy = (i * CELL) // 24, (j * CELL) // 24
                hh = h32(x // 2, y // 2, 13)
                if hh % 3 == 0:
                    continue
                pool = self.art.rock_big if hh % 11 == 0 else self.art.rock_small
                im = pool[hh % len(pool)]
                dx = i * CELL + (hh >> 3) % 20 - 2
                dy = j * CELL + (hh >> 6) % 20 - 2
                canvas.alpha_composite(im, (dx, dy))
                placed += 1
        self.trace.append({"layer": "cliff_rocks", "boulders": placed})

    # ---- props -----------------------------------------------------------
    def props(self):
        out = []
        for p in self.layout["props"]:
            im, verdict = self.art.sprite(p["crop"])
            if not verdict["ok"]:
                raise SystemExit(f"layout {self.layout['id']}: crop {p['crop']} failed "
                                 f"inspection: {verdict['issues']}")
            cx, cy = p["cell"]
            fx = cx * CELL + CELL // 2 + p.get("dx", 0)
            fy = cy * CELL + CELL + p.get("dy", 0)
            out.append({"name": p["crop"], "img": im, "foot": (fx, fy), "why": p["reason"],
                        "cluster": p.get("cluster", ""), "z": p.get("z", 0),
                        "cell": [cx, cy]})
        self._assert_placement(out)
        return out

    def _assert_placement(self, props):
        seen = {}
        for p in props:
            key = (p["name"], p["foot"])
            if key in seen:
                raise SystemExit(f"duplicate placement: {p['name']} at {p['foot']}")
            seen[key] = True
            x = int(p["foot"][0] // CELL)
            y = int((p["foot"][1] - 1) // CELL)
            if self.ground_at(x, y)[2][0] != ".":
                raise SystemExit(f"{p['name']} stands on a solid cell {x},{y}")
        for i, a in enumerate(props):
            for b in props[i + 1:]:
                if a["foot"] == b["foot"]:
                    raise SystemExit(f"co-located props {a['name']}/{b['name']}")

    def actor(self, who, cell, frame, direction):
        key = f"{who}_{frame}"
        sheet = self.art.imgs[key]
        row = {"down": 0, "left": 1, "right": 2, "up": 3}[direction]
        cellimg = sheet.crop((0, row * 64, 64, row * 64 + 64))
        body = cellimg.getbbox()
        fx = cell[0] * CELL + CELL // 2
        fy = cell[1] * CELL + CELL
        # anchor the visible foot (body bbox bottom) to the cell's foot line
        return {"img": cellimg, "foot": (fx, fy), "bbox": body, "who": who,
                "frame": frame, "dir": direction}

    # ---- composition -----------------------------------------------------
    def compose(self, actor_who, actor_cell, actor_frame, actor_dir):
        canvas = self.terrain()
        ox, oy = self.ox * CELL, self.oy * CELL
        draw = []
        for p in self.props():
            im = p["img"]
            draw.append({"z": p["z"], "foot": p["foot"], "img": im, "tag": "prop:" + p["name"],
                         "why": p["why"], "cluster": p["cluster"]})
        a = self.actor(actor_who, actor_cell, actor_frame, actor_dir)
        draw.append({"z": 2, "foot": a["foot"], "img": a["img"], "tag": "actor:" + a["who"],
                     "bbox": a["bbox"]})
        draw.sort(key=lambda d: (d["z"], d["foot"][1], d["foot"][0]))
        for d in draw:
            im = d["img"]
            if d["tag"].startswith("actor"):
                x0, y0, _, y1 = d["bbox"]
                dx = int(d["foot"][0] - (x0 + (d["bbox"][2] - x0) / 2) - ox)
                dy = int(d["foot"][1] - y1 - oy)
            else:
                dx = int(d["foot"][0] - im.width / 2 - ox)
                dy = int(d["foot"][1] - im.height - oy)
            canvas.alpha_composite(im, (dx, dy))
            self.trace.append({"op": d["tag"], "world": [dx + ox, dy + oy],
                               "size": [im.width, im.height], "z": d["z"],
                               "why": d.get("why", "")})
        return canvas


def radial(size, color, power=1.7):
    w, h = size
    img = Image.new("L", (w, h))
    px = img.load()
    cx, cy = (w - 1) / 2, (h - 1) / 2
    for y in range(h):
        for x in range(w):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / (w / 2)
            px[x, y] = max(0, min(255, int(255 * max(0.0, 1 - d) ** power)))
    tint = Image.new("RGBA", (w, h), tuple(color) + (0,))
    tint.putalpha(img)
    return tint


def apply_light(canvas, lighting, lights, origin):
    """Day is untouched. Night multiplies an ambient blue and screens the lamps."""
    if lighting == "day":
        return canvas
    from PIL import ImageChops
    amb = Image.new("RGBA", canvas.size, (46, 52, 84, 0))
    dark = canvas.convert("RGB").point(lambda v: int(v * 0.40))
    out = dark.convert("RGBA")
    out = ImageChops.add(out, amb)
    for L in lights:
        r = L.get("r", 62)
        halo = radial((r * 2, r * 2), L.get("color", (255, 176, 96)), 1.8)
        layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        layer.paste(halo, (int(L["x"] - origin[0] - r), int(L["y"] - origin[1] - r)), halo)
        out = ImageChops.screen(out, layer)
    out.putalpha(255)
    return out


def capture(world, centre, origin_cell):
    """Crop a 320x180 window around a world cell; returns the canvas-space offset."""
    cx = (centre[0] - origin_cell[0]) * CELL + CELL // 2 - WINDOW[0] // 2
    cy = (centre[1] - origin_cell[1]) * CELL + CELL // 2 - WINDOW[1] // 2
    x0 = max(0, min(world.width - WINDOW[0], cx))
    y0 = max(0, min(world.height - WINDOW[1], cy))
    return world.crop((x0, y0, x0 + WINDOW[0], y0 + WINDOW[1])), (x0, y0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "evidence3"))
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    art = Art()
    layouts = json.load(open(os.path.join(HERE, "data", "layouts3.json")))
    stations = json.load(open(os.path.join(HERE, "data", "stations3.json")))
    report = {"schema": "soh.world_visual_pilot3.evidence.v1",
              "a1_geometry": {"file": "data/cells2.json", "sha256": sha(
                  os.path.join(HERE, "data", "cells2.json"))},
              "viewport": {"native": [WINDOW[0] * 2, WINDOW[1] * 2], "world_window": list(WINDOW),
                           "zoom": 2, "cell_px": CELL},
              "sources": art.prov,
              "crops": art.verdicts,
              "materials": art.materials,
              "renderer": "tools3/compose3.py - Pillow compositor, NOT a Godot capture",
              "layouts": {}}

    for lid, layout in layouts.items():
        if args.only and lid != args.only:
            continue
        entry = {"title": layout["title"], "thesis": layout["thesis"],
                 "actor": layout["actor"], "props": len(layout["props"]), "lighting": {}}
        for lighting in ("day", "night"):
            sc = Scene(art, layout, lighting)
            who = layout["actor"]["who"]
            world = sc.compose(who, layout["actor"]["cell"],
                               layout["actor"].get("frame", "walk"),
                               layout["actor"].get("dir", "right"))
            other = "female" if who == "male" else "male"
            val_world = sc.compose(other, layout["actor"]["cell"],
                                   layout["actor"].get("frame", "walk"),
                                   layout["actor"].get("dir", "right"))
            shots = []
            for st in stations["stations"]:
                img, origin = capture(world, st["centre"], sc.origin_cell)
                lights = [{"x": (L["cell"][0] - sc.origin_cell[0]) * CELL + CELL // 2,
                           "y": (L["cell"][1] - sc.origin_cell[1]) * CELL - 6,
                           "r": L.get("r", 62), "color": L.get("color", (255, 176, 96))}
                          for L in layout.get("lights", []) if lighting == "night"]
                lit = apply_light(img, lighting, lights, origin)
                base = f"{lid}_{lighting}_{st['id']}"
                p640 = os.path.join(args.out, base + "_640x360.png")
                lit.convert("RGB").resize(LOGICAL, Image.NEAREST).save(p640)
                lit.convert("RGB").save(os.path.join(args.out, base + "_native320.png"))
                lit.convert("RGB").resize(EVAL, Image.NEAREST).save(
                    os.path.join(args.out, base + "_1280x720.png"))
                shots.append({"id": st["id"], "centre": st["centre"], "purpose": st["purpose"],
                              "origin": list(origin), "sha256": sha(p640)})
            # validation capture: other D051 body, same camera, same conditions
            val, vorigin = capture(val_world, stations["validation_centre"], sc.origin_cell)
            vlit = apply_light(val, lighting, [{"x": (L["cell"][0] - sc.origin_cell[0]) * CELL + CELL // 2,
                                                "y": (L["cell"][1] - sc.origin_cell[1]) * CELL - 6,
                                                "r": L.get("r", 62),
                                                "color": L.get("color", (255, 176, 96))}
                                               for L in layout.get("lights", [])
                                               if lighting == "night"], vorigin)
            vname = f"{lid}_{lighting}_validation_{other}_640x360.png"
            vlit.convert("RGB").resize(LOGICAL, Image.NEAREST).save(
                os.path.join(args.out, vname))
            entry["lighting"][lighting] = {
                "stations": shots, "validation": {"who": other, "file": vname,
                                                  "sha256": sha(os.path.join(args.out, vname))},
                "trace_ops": len([t for t in sc.trace if t.get("op")]),
                "trace_layer_cells": len([t for t in sc.trace if t.get("layer") == "terrain"])}
            json.dump({"entries": sc.trace}, open(
                os.path.join(args.out, f"trace3_{lid}_{lighting}.json"), "w"), indent=0)
            world.convert("RGB").save(os.path.join(args.out, f"world3_{lid}_{lighting}.png"))
        report["layouts"][lid] = entry
    json.dump(report, open(os.path.join(args.out, "report3.json"), "w"), indent=2)
    print(json.dumps({k: {"props": v["props"], "stations": len(v["lighting"]["day"]["stations"])}
                      for k, v in report["layouts"].items()}, indent=1))


if __name__ == "__main__":
    main()
