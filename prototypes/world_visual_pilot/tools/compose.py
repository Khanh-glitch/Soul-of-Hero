#!/usr/bin/env python3
"""Deterministic compositor for the world-visual pilot.

Reads, in order:
  1. art/overworld_tiles.png, art/overworld_props.png, art/light_radial.png
     (byte-identical copies of A1's shipped atlases, SHA-256 pinned)
  2. data/overworld_tiles.v1.json / overworld_props.v1.json  (A1 frame tables)
  3. data/corridor_cells.v1.json                             (pinned geography)
  4. data/placement.v1.json                                  (THIS pilot's layers)
  5. data/stations.v1.json                                   (camera stations)

and writes native 640x360 PNGs plus 1280x720 evaluation captures.

Rendering rules are re-implemented from A1's own runtime
(game/overworld/overworld_tiles.gd, overworld_world.gd) so a frame produced here
and a frame produced by the game agree:

  ground   frame = codes.ground[code][variant_index(x, y, n)]
           alternative-tile mirror = flip_id(x, y)        (per-tile, not per-block)
  detail   masked frames keep their baked neighbour mask ("=f" -> road_dirt#15);
           scattered overlays pick a per-cell variant (overlay_variant_index)
  solid    token used verbatim ("#f" -> cliff#15)
  props    sprite.centered = false, offset = (-w/2, -h)  => foot anchor at (x, y)
           flat frames draw at z = -1, everything else is y-sorted

No resampling except integer nearest-neighbour magnification. Every crop is a
1:1 pixel copy from a pinned PNG.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from dataclasses import dataclass, field

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILE = 16
NATIVE = (640, 360)          # project viewport, project.godot
EVAL = (1280, 720)           # window override, 2x integer
CAMERA_ZOOM = 2.0            # data/overworld camera_default.zoom

# --- A1 runtime constants, copied verbatim -------------------------------
VARIANT_BLOCK = 3
DETAIL_VARIANT_CODES = ("p", "w", "q", "u")
FLAT_PROPS = (
    "disc_cache", "disc_bones", "disc_lore", "camp_bedroll",
    "cliff_patch_a", "cliff_patch_b", "cliff_patch_c", "cliff_patch_d",
    "cliff_crack_a", "cliff_crack_b", "cliff_ledge_a", "cliff_ledge_b",
)
SOLID_PROP_PREFIXES = (
    "lm_", "short_bridge", "short_rubble", "short_conduit", "short_valve",
    "wall_stub", "tree_dead", "tree_pine", "column", "statue", "camp_tent",
    "cart", "sarcophagus", "camp_pavilion", "camp_wagon", "camp_rack",
    "camp_cookfire", "camp_table",
)


def absi(v: int) -> int:
    return v if v >= 0 else -v


def variant_index(x: int, y: int, count: int, block: int = VARIANT_BLOCK) -> int:
    """game/overworld/overworld_tiles.gd::variant_index, block size tunable."""
    if count <= 1:
        return 0
    bx = x // block
    by = y // block
    jitter = absi((x * 83492791) ^ (y * 2654435761)) % 6
    if jitter == 0:
        bx -= 1
    elif jitter == 1:
        by -= 1
    bx += 4096
    by += 4096
    return absi((bx * 73856093) ^ (by * 19349663)) % count


def overlay_variant_index(x: int, y: int, count: int) -> int:
    if count <= 1:
        return 0
    return absi((x * 92837111) ^ (y * 689287499) ^ 0x51ED270B) % count


def flip_id(x: int, y: int) -> int:
    """0 none, 1 flip-h, 2 flip-v, 3 both - Godot TRANSFORM_FLIP_* bits."""
    mixed = absi((x * 374761393) ^ (y * 668265263) ^ 0x9E3779B9)
    return mixed % 4


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()



def make_cookie(tex: Image.Image, light: dict, origin_px: tuple[int, int],
                size: tuple[int, int]) -> Image.Image | None:
    """Full-canvas RGB operand built from the shipped radial texture."""
    scale = float(light.get("scale", 1.0))
    radius = max(1, int(round(tex.width * scale)))
    cookie = tex.resize((radius, radius), Image.NEAREST)
    strength = float(light.get("strength", 1.0))
    alpha = cookie.split()[3].point(lambda v: int(v * strength))
    col = tuple(light["color"])
    x = int(round(light["x"] - origin_px[0] - radius / 2.0))
    y = int(round(light["y"] - origin_px[1] - radius / 2.0))
    if x >= size[0] or y >= size[1] or x + radius <= 0 or y + radius <= 0:
        return None
    alpha_full = Image.new("L", size, 0)
    alpha_full.paste(alpha, (x, y))
    if light["mode"] == "shade":
        # multiply operand: white where there is no cookie, darkened by colour
        op = Image.new("RGB", size, (255, 255, 255))
        dark = Image.new("RGB", size, col)
        return Image.composite(dark, op, alpha_full)
    op = Image.new("RGB", size, (0, 0, 0))
    add = Image.new("RGB", size, col)
    return Image.composite(add, op, alpha_full)


@dataclass
class Sprite:
    image: Image.Image
    x: float          # foot anchor, world px
    y: float
    z: int
    frame: str
    source: str
    order: int = 0
    flip: str | None = None

    @property
    def sort_key(self):
        return (self.z, self.y, self.order)


@dataclass
class Lighting:
    tint: tuple[int, int, int]
    ambient: float
    lights: list = field(default_factory=list)   # (x, y, radius_px, rgb, strength)


class Renderer:
    def __init__(self, placement: dict, slice_doc: dict, windows: list[str],
                 policy: str):
        self.placement = placement
        self.slice = slice_doc
        self.windows = windows
        self.policy = policy
        self.tracing = True
        self.drop_detail = set((placement.get("tuning") or {}).get("drop_detail_tokens", ""))
        self.art = {
            "overworld_tiles.png": Image.open(os.path.join(ROOT, "art/overworld_tiles.png")).convert("RGBA"),
            "overworld_props.png": Image.open(os.path.join(ROOT, "art/overworld_props.png")).convert("RGBA"),
            "light_radial.png": Image.open(os.path.join(ROOT, "art/light_radial.png")).convert("RGBA"),
            "knight_idle_sheet.png": Image.open(os.path.join(ROOT, "art/knight_idle_sheet.png")).convert("RGBA"),
        }
        self.tiles_meta = json.load(open(os.path.join(ROOT, "data/overworld_tiles.v1.json")))
        self.props_meta = json.load(open(os.path.join(ROOT, "data/overworld_props.v1.json")))
        self.frame_index()
        self.trace: list[dict] = []

    # ---- frame tables ---------------------------------------------------
    def frame_index(self) -> None:
        self.tile_index = self.tiles_meta["index"]
        self.prop_index = self.props_meta["frames"]
        self.ground_codes = self.tiles_meta["codes"]["ground"]
        self.detail_codes = self.tiles_meta["codes"]["detail"]
        self.solid_codes = self.tiles_meta["codes"]["solid"]

    def crop_tile(self, frame: str, mirror: int = 0) -> Image.Image | None:
        rect = self.tile_index.get(frame)
        if not rect:
            return None
        im = self.art["overworld_tiles.png"].crop(
            (rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]))
        if mirror == 1:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        elif mirror == 2:
            im = im.transpose(Image.FLIP_TOP_BOTTOM)
        elif mirror == 3:
            im = im.transpose(Image.ROTATE_180)
        return im

    def crop_prop(self, frame: str) -> tuple[Image.Image, dict] | tuple[None, None]:
        rect = self.prop_index.get(frame)
        if not rect:
            return None, None
        im = self.art["overworld_props.png"].crop(
            (rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"]))
        return im, rect

    # ---- token resolution ----------------------------------------------
    def resolve(self, token: str, layer: str, x: int, y: int) -> tuple[str, int]:
        """Address -> (frame name, mirror). Mirrors A1's cell_for + _paint_grid."""
        if not token or token == ".":
            return "", 0
        code, mask = token[:1], token[1:]
        if layer == "ground":
            names = self.ground_codes.get(code, [])
            if not names:
                return "", 0
            block = int(self.placement.get("tuning", {}).get("ground_variant_block", VARIANT_BLOCK))
            pick = variant_index(x, y, len(names), block)
            # Pilot tone policy: an optional restricted variant family per code.
            family = self.placement.get("tuning", {}).get("ground_variant_family", {}).get(code)
            if family and self.policy == "pilot":
                pick = family[pick % len(family)] % len(names)
            return names[pick], (flip_id(x, y) if self.placement.get("tuning", {}).get("ground_mirror", True) else 0)
        table = self.detail_codes if layer == "detail" else self.solid_codes
        entry = table.get(code, {})
        if not entry:
            return "", 0
        base = entry.get("frame", "")
        if entry.get("masked") and mask:
            variants = int(entry.get("variants", 16))
            m = int(mask, 16)
            if variants > 0 and m >= variants:
                m %= variants
            return f"{base}#{m}", 0
        if "variant_names" in entry:
            names = entry["variant_names"]
            if mask:
                return names[int(mask, 16) % len(names)], 0
            return (names[overlay_variant_index(x, y, len(names))]
                    if code in DETAIL_VARIANT_CODES else names[0]), 0
        return base, 0

    # ---- render ---------------------------------------------------------
    def contact_shadow(self, w: int, h: int, strength: int = 78) -> Image.Image:
        """Procedural contact shadow, integer pixels only.

        Not source art: a 1-3 px dark ellipse under each prop so a pasted sprite
        sits on the ground instead of floating over it. Nearest-neighbour safe
        because it is drawn at final pixel scale.
        """
        sw = max(6, int(round(w * 0.92)))
        sh = max(3, min(6, int(round(h * 0.16))))
        im = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
        px = im.load()
        cx, cy = (sw - 1) / 2.0, (sh - 1) / 2.0
        rx, ry = sw / 2.0, sh / 2.0
        for yy in range(sh):
            for xx in range(sw):
                d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
                if d <= 1.0:
                    px[xx, yy] = (12, 10, 14, int(strength * (1.0 - 0.55 * d)))
        return im

    def render_window(self, key: str, lighting_name: str) -> Image.Image:
        trace_start = len(self.trace)
        win = self.slice[key]
        ox, oy = win["origin_cell"]
        w, h = win["size_cells"]
        width, height = w * TILE, h * TILE
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 255))

        # 1. ground
        for gy in range(h):
            for gx in range(w):
                token = win["layers"]["ground"][gy][gx]
                frame, mirror = self.resolve(token, "ground", ox + gx, oy + gy)
                if not frame:
                    continue
                im = self.crop_tile(frame, mirror)
                if im is not None:
                    canvas.alpha_composite(im, (gx * TILE, gy * TILE))
                    self.trace.append({"layer": "ground", "cell": [ox + gx, oy + gy],
                                       "token": token, "frame": frame,
                                       "mirror": mirror,
                                       "crop": self.tile_index[frame],
                                       "source": "art/overworld_tiles.png"})
        # 2. detail
        for gy in range(h):
            for gx in range(w):
                token = win["layers"]["detail"][gy][gx]
                if self.policy == "pilot" and token in self.drop_detail:
                    # A1 renders cliff_shade as a full-tile opaque overlay, so on
                    # walkable ground it prints a hard 16x16 dark square. The
                    # pilot replaces it with a soft shade cookie (see lighting).
                    self.trace.append({"layer": "detail_dropped", "cell": [ox + gx, oy + gy],
                                       "token": token, "reason": "hard square overlay; "
                                       "replaced by soft shade cookie in placement.v1.json"})
                    continue
                frame, mirror = self.resolve(token, "detail", ox + gx, oy + gy)
                if not frame:
                    continue
                im = self.crop_tile(frame, mirror)
                if im is not None and im.getbbox():
                    canvas.alpha_composite(im, (gx * TILE, gy * TILE))
                    self.trace.append({"layer": "detail", "cell": [ox + gx, oy + gy],
                                       "token": token, "frame": frame,
                                       "mirror": mirror,
                                       "crop": self.tile_index[frame],
                                       "source": "art/overworld_tiles.png"})
        # 3. solid
        for gy in range(h):
            for gx in range(w):
                token = win["layers"]["solid"][gy][gx]
                frame, mirror = self.resolve(token, "solid", ox + gx, oy + gy)
                if not frame:
                    continue
                im = self.crop_tile(frame, mirror)
                if im is not None and im.getbbox():
                    canvas.alpha_composite(im, (gx * TILE, gy * TILE))
                    self.trace.append({"layer": "solid", "cell": [ox + gx, oy + gy],
                                       "token": token, "frame": frame,
                                       "mirror": mirror,
                                       "crop": self.tile_index[frame],
                                       "source": "art/overworld_tiles.png"})

        # 4. authored decal layer (pilot policy): source atlas frames used as
        # 16x16 ground decals, placed by rule on terrain that justifies them.
        if self.policy == "pilot":
            for dec in self.placement.get("decals", []):
                cx, cy = dec["cell"]
                im = self.crop_tile(dec["frame"])
                if im is None:
                    raise SystemExit(f"unknown decal frame: {dec['frame']}")
                dx, dy = (cx - ox) * TILE, (cy - oy) * TILE
                canvas.alpha_composite(im, (dx, dy))
                self.trace.append({"layer": "decal", "frame": dec["frame"],
                                   "cell": [cx, cy], "draw_px": [dx, dy],
                                   "crop": self.tile_index[dec["frame"]],
                                   "source": "art/overworld_tiles.png",
                                   "rule": dec.get("rule")})

        # 4b. contact shadows for everything that stands up
        shadows = []
        for sp in self.collect_sprites(key):
            if sp.image.height < 12:
                continue
            sh = self.contact_shadow(sp.image.width, sp.image.height,
                                     strength=95 if sp.frame.startswith(("camp", "disc", "tre")) else 60)
            sx = int(round(sp.x - ox * TILE - sh.width / 2.0))
            sy = int(round(sp.y - oy * TILE - sh.height / 2.0))
            shadows.append((sy, sx, sh, sp))
        for sy, sx, sh, sp in sorted(shadows, key=lambda t: (t[0], t[1])):
            canvas.alpha_composite(sh, (sx, sy))

        # 5. sprites (props + actors), y-sorted exactly like the runtime
        sprites = self.collect_sprites(key)
        for sp in sorted(sprites, key=lambda s: s.sort_key):
            px = int(round(sp.x - ox * TILE - sp.image.width / 2.0))
            py = int(round(sp.y - oy * TILE - sp.image.height))
            canvas.alpha_composite(sp.image, (px, py))
            self.trace.append({"layer": "prop_flat" if sp.z < 0 else "prop",
                               "frame": sp.frame, "source": sp.source,
                               "foot_px": [sp.x, sp.y], "z": sp.z,
                               "paste_px": [px + ox * TILE, py + oy * TILE],
                               "size": [sp.image.width, sp.image.height],
                               "flip": sp.flip,
                               "crop": self.prop_index.get(sp.frame)
                               or self.actors_crop(sp.frame)})

        # 6. lighting
        canvas = self.apply_lighting(canvas, key, lighting_name, (ox * TILE, oy * TILE))
        if not self.tracing:
            del self.trace[trace_start:]
        return canvas

    def collect_sprites(self, key: str) -> list[Sprite]:
        win = self.slice[key]
        out: list[Sprite] = []
        if self.policy == "authored":
            for p in win["source_props"]:
                im, rect = self.crop_prop(p["frame"])
                if im is None:
                    continue
                out.append(Sprite(im, p["x"], p["y"], -1 if p["frame"] in FLAT_PROPS else int(p["z"]),
                                  p["frame"], "corridor_cells.v1.json:source_props"))
            return out
        # pilot policy: placement layers only
        for entry in self.placement["props"]:
            im, rect = self.crop_prop(entry["frame"])
            if im is None:
                raise SystemExit(f"unknown prop frame in placement: {entry['frame']}")
            flip = entry.get("flip")
            if flip == "h":
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            elif flip == "v":
                im = im.transpose(Image.FLIP_TOP_BOTTOM)
            z = -1 if entry["frame"] in FLAT_PROPS else int(entry.get("z", 0))
            out.append(Sprite(im, float(entry["x"]), float(entry["y"]), z,
                              entry["frame"], "placement.v1.json:props",
                              flip=flip))
        for entry in self.placement.get("actors", []):
            if entry.get("station_policy") == "pilot" and self.policy != "pilot":
                continue
            im = self.knight_frame(entry)
            out.append(Sprite(im, float(entry["x"]), float(entry["y"]), 0,
                              entry["frame"], "art/knight_idle_sheet.png"))
        return out

    def actors_crop(self, frame: str):
        for a in self.placement.get("actors", []):
            if a["frame"] == frame:
                return a["crop"]
        return None

    def knight_frame(self, entry: dict) -> Image.Image:
        rect = entry["crop"]
        sheet = self.art["knight_idle_sheet.png"]
        return sheet.crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]))

    # ---- light ----------------------------------------------------------
    def lighting_for(self, name: str) -> Lighting:
        L = self.placement["lighting"][name]
        lights = []
        for light in L["lights"]:
            if light.get("layer", "all") != "all" and self.policy != "pilot":
                continue
            lights.append(light)
        return Lighting(tuple(L["tint"]), float(L["ambient"]), lights)

    def apply_lighting(self, canvas: Image.Image, key: str, name: str,
                       origin_px: tuple[int, int]) -> Image.Image:
        """Multiply-shade cookies first, then additive light cookies.

        The cookie is A1's shipped light_radial.png, magnified with NEAREST.
        No procedural gradient is invented: every lit pixel's falloff comes from
        that texture's alpha.
        """
        L = self.lighting_for(name)
        base = canvas.convert("RGB")
        r, g, b = L.tint
        chans = base.split()
        chans = [c.point([min(255, int(i * f)) for i in range(256)])
                 for c, f in zip(chans, (r, g, b))]
        base = Image.merge("RGB", chans)

        tex = self.art["light_radial.png"]
        for light in L.lights:
            op = make_cookie(tex, light, origin_px, base.size)
            if op is None:
                continue
            base = ImageChops.multiply(base, op) if light["mode"] == "shade" else ImageChops.add(base, op)
        return base.convert("RGBA")

    # ---- camera ---------------------------------------------------------
    def capture(self, world: Image.Image, station: dict, origin_cell: tuple[int, int]) -> Image.Image:
        """Crop the 320x180 world-px camera view, then 2x nearest to 640x360."""
        cx, cy = station["camera_center_cell"]
        zx = float(station.get("zoom", CAMERA_ZOOM))
        view_w = int(round(NATIVE[0] / zx))
        view_h = int(round(NATIVE[1] / zx))
        left = int(round(cx * TILE - view_w / 2.0)) - origin_cell[0] * TILE
        top = int(round(cy * TILE - view_h / 2.0)) - origin_cell[1] * TILE
        frame = Image.new("RGBA", (view_w, view_h), (12, 10, 18, 255))
        src = world.crop((left, top, left + view_w, top + view_h))
        frame.alpha_composite(src, (0, 0))
        return frame.resize(NATIVE, Image.NEAREST)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--policy", choices=["authored", "pilot"], default="pilot")
    ap.add_argument("--lighting", default="day")
    ap.add_argument("--out", default=os.path.join(ROOT, "evidence"))
    ap.add_argument("--only-window", default=None)
    ap.add_argument("--sequence", action="store_true",
                    help="render the verified walk path as a camera-following sequence")
    args = ap.parse_args()

    slice_doc = json.load(open(os.path.join(ROOT, "data/corridor_cells.v1.json")))
    placement = json.load(open(os.path.join(ROOT, "data/placement.v1.json")))
    stations = json.load(open(os.path.join(ROOT, "data/stations.v1.json")))
    os.makedirs(args.out, exist_ok=True)

    verified = []
    for art in ("overworld_tiles.png", "overworld_props.png", "light_radial.png",
                "knight_idle_sheet.png"):
        p = os.path.join(ROOT, "art", art)
        verified.append({"file": art, "sha256": sha256(p),
                         "size": Image.open(p).size,
                         "pinned": placement["art_pins"][art]})
        if sha256(p) != placement["art_pins"][art]:
            raise SystemExit(f"art pin mismatch: {art}")

    r = Renderer(placement, slice_doc, [args.only_window] if args.only_window else ["corridor", "water_test"],
                 args.policy)
    report = {"policy": args.policy, "lighting": args.lighting,
              "art": verified, "captures": []}
    for key in r.windows:
        if key == "corridor" and args.only_window != "water_test":
            world = r.render_window("corridor", args.lighting)
            origin = tuple(slice_doc["corridor"]["origin_cell"])
            world.save(os.path.join(args.out, f"world_{args.policy}_{args.lighting}.png"))
            for station in stations["stations"]:
                if station.get("window", "corridor") != "corridor":
                    continue
                native = r.capture(world, station, origin)
                name = f"{args.policy}_{args.lighting}_{station['id']}"
                path640 = os.path.join(args.out, f"{name}_640x360.png")
                path1280 = os.path.join(args.out, f"{name}_1280x720.png")
                native.save(path_640 := path640)
                native.resize(EVAL, Image.NEAREST).save(path1280)
                report["captures"].append({"station": station["id"], "policy": args.policy,
                                           "native": path_640, "eval": path1280,
                                           "sha256_native": sha256(path_640),
                                           "sha256_eval": sha256(path1280),
                                           "camera_center_cell": station["camera_center_cell"]})
        if key == "water_test" and args.only_window != "corridor":
            world = r.render_window("water_test", args.lighting)
            origin = tuple(slice_doc["water_test"]["origin_cell"])
            world.save(os.path.join(args.out, f"world_water_{args.policy}_{args.lighting}.png"))
            for station in stations["stations"]:
                if station.get("window") != "water_test":
                    continue
                native = r.capture(world, station, origin)
                name = f"{args.policy}_{args.lighting}_{station['id']}"
                path640 = os.path.join(args.out, f"{name}_640x360.png")
                path1280 = os.path.join(args.out, f"{name}_1280x720.png")
                native.save(path_640 := path640)
                native.resize(EVAL, Image.NEAREST).save(path1280)
                report["captures"].append({"station": station["id"], "policy": args.policy,
                                           "native": path_640, "eval": path1280,
                                           "sha256_native": sha256(path_640),
                                           "sha256_eval": sha256(path1280),
                                           "camera_center_cell": station["camera_center_cell"]})

    if args.sequence:
        r.tracing = False   # sequence re-renders the same window; keep one trace
        walk = json.load(open(os.path.join(ROOT, "data/walk_path.v1.json")))
        seq_dir = os.path.join(args.out, "sequence")
        os.makedirs(seq_dir, exist_ok=True)
        actor = r.placement["actors"][0]
        hold = (actor["x"], actor["y"])
        frames = []
        for i, cell in enumerate(walk["cells"]):
            actor["x"], actor["y"] = cell[0] * TILE + TILE / 2, cell[1] * TILE + TILE - 1
            world = r.render_window("corridor", args.lighting)
            native = r.capture(world, {"camera_center_cell": cell},
                               tuple(slice_doc["corridor"]["origin_cell"]))
            path = os.path.join(seq_dir, f"walk_{i:02d}_{cell[0]}_{cell[1]}.png")
            native.save(path)
            frames.append((path, cell))
        actor["x"], actor["y"] = hold
        r.tracing = True
        strip = Image.new("RGB", (NATIVE[0] // 2 * len(frames), NATIVE[1] // 2), (16, 16, 20))
        for i, (path, _) in enumerate(frames):
            im = Image.open(path).convert("RGB").resize((NATIVE[0] // 2, NATIVE[1] // 2), Image.NEAREST)
            strip.paste(im, (i * NATIVE[0] // 2, 0))
        strip.save(os.path.join(seq_dir, "walk_filmstrip.png"))
        gif = [Image.open(pth).convert("RGB") for pth, _ in frames]
        gif[0].save(os.path.join(seq_dir, "walk_loop.gif"), save_all=True,
                    append_images=gif[1:], duration=180, loop=0, optimize=False)
        report["sequence"] = {"frames": len(frames),
                              "cells": [c for _, c in frames],
                              "filmstrip": os.path.join(seq_dir, "walk_filmstrip.png"),
                              "gif": os.path.join(seq_dir, "walk_loop.gif")}
        print(f"  sequence {len(frames)} frames -> {seq_dir}")

    trace_path = os.path.join(ROOT, f"data/placement_trace.{args.policy}.{args.lighting}.json")
    with open(trace_path, "w", encoding="utf-8") as fh:
        json.dump({"policy": args.policy, "entries": r.trace}, fh, indent=0)
    report["trace"] = trace_path
    report["trace_entries"] = len(r.trace)
    os.makedirs(os.path.join(args.out, "reports"), exist_ok=True)
    with open(os.path.join(args.out, "reports", f"capture_{args.policy}_{args.lighting}.json"),
              "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    print(json.dumps({k: report[k] for k in ("policy", "lighting", "trace_entries")}, indent=2))
    for c in report["captures"]:
        print(f"  {c['station']:14s} {c['native']}  {c['sha256_native'][:12]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
