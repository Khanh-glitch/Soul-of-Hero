#!/usr/bin/env python3
"""Player-scale regional review panels: 1x logical camera + 5x nearest crop.

Pillow self-inspection evidence, NOT native Godot acceptance. Draws a clearly
marked 12x16 Knight-proxy footprint and HUD-safe margin for readability review;
the proxy is never the final D051 male/female avatar.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

from preview_world_art import render, load, ROOT, ART, OUT, VIEW_W, VIEW_H


def main() -> dict:
    atlas = load(ART / "atlas.v1.json")
    terrain = Image.open(ROOT / "assets/environment/survival_world/terrain.png").convert("RGBA")
    props = Image.open(ROOT / "assets/environment/survival_world/props.png").convert("RGBA")
    index = load(ART / "presentations.v1.json")
    rows = []
    for entry in index["presentations"]:
        doc = load(ROOT / entry["path"])
        if not doc["treatment_id"].endswith("_region_window"):
            continue
        view = next(v for v in doc["capture_views"] if v.get("time_of_day", 0.35) < 0.5)
        im2 = render(doc, atlas, terrain, props, view)
        im1 = im2.resize((VIEW_W, VIEW_H), Image.Resampling.NEAREST)
        # HUD-safe margin (A6 owns final HUD; this is a review guide only).
        d = ImageDraw.Draw(im1)
        d.rectangle((24, 24, VIEW_W - 25, VIEW_H - 25), outline=(255, 255, 255, 90))
        lm = next((p for p in doc["props"] if p.get("poi_id")), None)
        cx, cy = view["center_cell"]
        ox, oy = cx * 16 - VIEW_W // 2, cy * 16 - VIEW_H // 2
        if lm:
            lx, ly = lm["world_px"][0] - ox, lm["world_px"][1] - oy
        else:
            lx, ly = VIEW_W // 2, VIEW_H // 2
        crop = im1.crop((max(0, min(VIEW_W - 128, lx - 64)), max(0, min(VIEW_H - 72, ly - 48)),
                         max(0, min(VIEW_W - 128, lx - 64)) + 128, max(0, min(VIEW_H - 72, ly - 48)) + 72))
        big = crop.resize((640, 360), Image.Resampling.NEAREST)
        bd = ImageDraw.Draw(big)
        # 12x16 proxy footprint at 5x, clearly marked.
        px, py = (lx - max(0, min(VIEW_W - 128, lx - 64))) * 5, (ly - max(0, min(VIEW_H - 72, ly - 48))) * 5
        bd.rectangle((px - 30, py - 80, px + 30, py), outline=(255, 255, 255))
        bd.text((px - 28, py - 94), "12x16 PROXY", fill=(255, 255, 255))
        rows.append((doc["biome_profile"], im1, big))
    cw, ch = 640, 390
    sheet = Image.new("RGB", (cw * 2, ch * len(rows)), "#1d1a22")
    d = ImageDraw.Draw(sheet)
    for i, (label, im1, big) in enumerate(rows):
        y = i * ch
        sheet.paste(im1, (0, y + 30)); sheet.paste(big, (cw, y + 30))
        d.text((8, y + 8), f"{label} 1x logical 640x360 [Pillow, not native]", fill="white")
        d.text((cw + 8, y + 8), f"{label} 5x nearest crop + proxy footprint", fill="white")
    path = OUT / "region_art_review_1x_5x.png"
    sheet.save(path)
    return {"ok": True, "regions": len(rows), "panel": str(path.relative_to(ROOT))}


if __name__ == "__main__":
    print(json.dumps(main(), sort_keys=True))
