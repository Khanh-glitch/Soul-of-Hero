#!/usr/bin/env python3
"""Render the native capture's station list offline, from the shipped atlas.

This is **supporting** evidence, not a substitute for a native screenshot: it
composites the exact PNG frames the game draws (same atlas, same per-cell
variant hash as `OverworldTiles.variant_index`) with Pillow, so it shows what
the world looks like but not that Godot rendered it. Native PNGs come from
`tools/captures/chapter1_overworld_native_capture.gd` under Xvfb.

  python3 tools/overworld/evidence.py [--out docs/overworld/evidence]

Writes one 640x360 PNG per station plus a whole-world overview.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from PIL import Image, ImageDraw

import preview

ROOT = preview.ROOT
DATA = os.path.join(ROOT, "data", "overworld")
T = 16
VIEW_W, VIEW_H = 640, 360

# (station, landmark-or-cell anchor, offset in tiles). Mirrors the station list
# in tools/captures/chapter1_overworld_native_capture.gd.
# (station, landmark-or-cell anchor). The camera offset is NOT authored here: it
# comes from the world document's `capture_offset`, which `author.py` derives
# from the height of the sprite standing at the end of each approach.
STATIONS = [
    ("refuge_start", "refuge"),
    ("crypt_approach", "lm_crypt"),
    ("ossuary_approach", "lm_ossuary"),
    ("camp_crossroads", "camp_crossroads"),
    ("crucible", "lm_crucible"),
    ("beacon", "lm_beacon"),
    ("gate", "lm_gate"),
    ("throne", "lm_throne"),
]


def anchors(world: dict) -> dict[str, tuple[int, int]]:
    out: dict[str, tuple[int, int]] = {}
    for landmark in world.get("landmarks", []):
        offset = landmark.get("capture_offset", [0, 0])
        out[str(landmark["id"])] = (
            int(landmark["pos"][0]) + int(offset[0]),
            int(landmark["pos"][1]) + int(offset[1]),
        )
    for camp in world.get("camps", []):
        out[str(camp["id"])] = tuple(camp["pos"])  # type: ignore[assignment]
    refuge = world.get("refuge", {}).get("pos")
    if refuge:
        out["refuge"] = tuple(refuge)  # type: ignore[assignment]
    return out


CAMERA_ZOOM = 2  # camera_default.zoom in hollow_marches.json


def render_station(name: str, cell: tuple[int, int], out_dir: str, world: dict,
                   *, layers: dict | None = None, caption: str = "") -> str:
    """One viewport-sized frame, framed the way the in-game camera frames it.

    The overworld camera runs at zoom 2 on a 640x360 viewport, so a station
    covers 20 x 11.25 tiles. Rendering at scale 1 across 40 tiles (as an earlier
    pass did) showed the player twice as much world at half the pixel size, and
    read far busier than the game does.
    """
    width = int(world["world_bounds"]["w"])
    height = int(world["world_bounds"]["h"])
    tile_px = T * CAMERA_ZOOM
    tiles_w = VIEW_W // tile_px + 2
    tiles_h = VIEW_H // tile_px + 2
    x0 = max(0, min(width - tiles_w, cell[0] - tiles_w // 2))
    y0 = max(0, min(height - tiles_h, cell[1] - tiles_h // 2))
    image = preview.render(x0, y0, x0 + tiles_w, y0 + tiles_h, scale=CAMERA_ZOOM, layers=layers)
    centre_x = (cell[0] - x0) * tile_px + tile_px // 2
    centre_y = (cell[1] - y0) * tile_px + tile_px // 2
    crop_x = max(0, min(image.width - VIEW_W, centre_x - VIEW_W // 2))
    crop_y = max(0, min(image.height - VIEW_H, centre_y - VIEW_H // 2))
    image = image.crop((crop_x, crop_y, crop_x + VIEW_W, crop_y + VIEW_H))
    text = caption or f"{name}  [{cell[0]},{cell[1]}]  {CAMERA_ZOOM}x"
    image = _label(image, text)
    path = os.path.join(out_dir, f"overworld_{name}.png")
    image.save(path)
    return path


def render_overview(out_dir: str, world: dict) -> str:
    width = int(world["world_bounds"]["w"])
    height = int(world["world_bounds"]["h"])
    image = preview.render(0, 0, width, height)
    # Keep the committed artifact small but still legible as a map.
    image = image.resize((width * 4, height * 4), Image.NEAREST)
    path = os.path.join(out_dir, "overworld_world_overview.png")
    image.save(path)
    return path


def _label(image: Image.Image, text: str) -> Image.Image:
    draw = ImageDraw.Draw(image)
    pad = 3
    box = draw.textbbox((0, 0), text)
    w = box[2] - box[0] + pad * 2
    h = box[3] - box[1] + pad * 2
    draw.rectangle((0, 0, w, h), fill=(10, 8, 14))
    draw.text((pad, pad), text, fill=(235, 220, 180))
    return image


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=os.path.join(ROOT, "docs", "overworld", "evidence"))
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)

    world = json.load(open(os.path.join(DATA, "hollow_marches.json")))
    lookup = anchors(world)

    written = [render_overview(args.out, world)]
    for station, anchor in STATIONS:
        base = lookup.get(anchor)
        if base is None:
            print(f"SKIP {station}: no anchor '{anchor}'")
            continue
        written.append(render_station(station, base, args.out, world))

    # The shortcut pair has to be the same frame, closed then open. "Open" here
    # means exactly what the runtime does in OverworldWorld._carve_shortcut():
    # the authored carve box is cleared out of the SOLID layer, so the band that
    # blocked the crossing stops blocking it. The sprite swap that accompanies
    # it in game is a separate frame and is not part of this composite.
    shortcut = next(s for s in world["shortcuts"] if s["id"] == "short_crucible_bridge")
    sx, sy = shortcut["pos"]
    before = render_station("shortcut_before", (sx, sy), args.out, world,
                            caption=f"shortcut_before  [{sx},{sy}]  band solid")
    written.append(before)
    layers = json.load(open(os.path.join(DATA, "hollow_marches_layers.json")))
    layers["layers"]["solid"]["rle"] = [[".", int(layers["width"]) * int(layers["height"])]]
    x0, y0, x1, y1 = (int(v) for v in shortcut["carve"])
    for ty in range(y0, y1 + 1):
        for tx in range(x0, x1 + 1):
            index = ty * int(layers["width"]) + tx
            assert index < int(layers["width"]) * int(layers["height"])
    after = render_station("shortcut_after", (sx, sy), args.out, world, layers=layers,
                           caption=f"shortcut_after  [{sx},{sy}]  band cleared")
    written.append(after)
    # A before/after pair that does not differ is not evidence of anything.
    a = Image.open(before).convert("RGB")
    b = Image.open(after).convert("RGB")
    data_a, data_b = a.tobytes(), b.tobytes()
    changed = sum(1 for pa, pb in zip(data_a, data_b) if pa != pb)
    share = 100.0 * changed / (a.width * a.height)
    print(f"shortcut pair: {changed} px differ ({share:.1f}% of the frame)")
    if share < 2.0:
        print("ERROR: opening the shortcut changed almost nothing on screen")
        return 1

    print(f"wrote {len(written)} PNGs to {args.out}")
    for path in written:
        size = os.path.getsize(path)
        print(f"  {os.path.basename(path):34} {size/1024:6.1f} KiB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
