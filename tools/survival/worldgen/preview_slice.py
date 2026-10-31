#!/usr/bin/env python3
"""Render a bounded inspection preview of the two-POI vertical slice.

This is a static contract diagram, not a native gameplay screenshot. It overlays
authored footprints, required navigation, obstacles, entrances and stand cells on
the existing chunk walk/hazard/road layers.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

import compile_slice
from validate_world import load, reconstruct

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "docs/survival/world/previews/vertical_slice_detail.png"
SCALE = 10
X0, Y0, X1, Y1 = 388, 192, 448, 248


def main() -> None:
    plan = load()
    walk = reconstruct(plan, "walk")
    hazard = reconstruct(plan, "hazard")
    road = reconstruct(plan, "road")
    w = plan["frame"]["w"]
    contracts = [
        json.loads((compile_slice.OUT / "poi_crown_waystation.slice.json").read_text()),
        json.loads((compile_slice.OUT / "poi_crown_relay_shed.slice.json").read_text()),
    ]
    img = Image.new("RGB", ((X1 - X0) * SCALE, (Y1 - Y0) * SCALE), (18, 18, 24))
    draw = ImageDraw.Draw(img)
    for y in range(Y0, Y1):
        for x in range(X0, X1):
            i = y * w + x
            color = (42, 42, 52)
            if walk[i]:
                color = (70, 78, 66)
            if road[i]:
                color = (120, 104, 78)
            if hazard[i]:
                color = (150, 60, 60)
            draw.rectangle([(x - X0) * SCALE, (y - Y0) * SCALE, (x - X0 + 1) * SCALE - 1, (y - Y0 + 1) * SCALE - 1], fill=color)

    def cell_rect(cell, color, outline=None, width=1):
        x, y = cell
        box = [(x - X0) * SCALE + 1, (y - Y0) * SCALE + 1, (x - X0 + 1) * SCALE - 2, (y - Y0 + 1) * SCALE - 2]
        draw.rectangle(box, fill=color, outline=outline, width=width)

    for c in contracts:
        geo = c["immutable_geography"]
        for cell in geo["required_nav_cells"]:
            cell_rect(cell, (90, 160, 220))
        for ent in geo["entrances"]:
            for cell in ent["clearance_cells"]:
                cell_rect(cell, (120, 220, 160))
            cell_rect(ent["cell"], (40, 200, 120), outline=(255, 255, 255))
        for ob in geo["static_obstacles"]:
            for cell in ob["cells"]:
                cell_rect(cell, (220, 90, 90), outline=(255, 200, 200))
        for node in c["interaction_nodes"]:
            for cell in node["stand_cells"]:
                cell_rect(cell, (240, 210, 90), outline=(255, 255, 255))
        cell_rect(geo["anchor_cell"], (255, 255, 255), outline=(0, 0, 0))
        fx, fy, fw, fh = geo["footprint_rect"]
        draw.rectangle([(fx - X0) * SCALE, (fy - Y0) * SCALE, (fx + fw - X0) * SCALE - 1, (fy + fh - Y0) * SCALE - 1], outline=(200, 200, 255), width=2)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print(json.dumps({"ok": True, "path": str(OUT.relative_to(ROOT)), "native_playable": False}))


if __name__ == "__main__":
    main()
