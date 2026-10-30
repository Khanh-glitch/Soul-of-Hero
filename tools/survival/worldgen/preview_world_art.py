#!/usr/bin/env python3
"""Pillow/atlas composition preview for A1 world art treatments.

This is NOT native Godot evidence. It composites the same atlas + compiled data
so the author can inspect silhouette, palette, blending and semantic readability
before the native fixture runs in CI.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "data/survival/world/art"
OUT = ROOT / "docs/survival/world/evidence"
VIEW_W, VIEW_H = 640, 360


def load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def smoothstep(a: float, b: float, x: float) -> float:
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def render(doc: dict, atlas: dict, terrain: Image.Image, props: Image.Image, view: dict) -> Image.Image:
    cx, cy = view["center_cell"]
    ox = cx * 16 - VIEW_W // 2
    oy = cy * 16 - VIEW_H // 2
    im = Image.new("RGBA", (VIEW_W, VIEW_H), (24, 21, 28, 255))
    g = doc["ground"]
    gx, gy = g["origin_cell"]
    for y, row in enumerate(g["rows"]):
        for x, frame in enumerate(row):
            r = atlas["terrain"][frame]
            tile = terrain.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
            im.alpha_composite(tile, ((gx + x) * 16 - ox, (gy + y) * 16 - oy))
    for o in doc.get("overlays", []):
        r = atlas["terrain"][o["frame"]]
        tile = terrain.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
        im.alpha_composite(tile, (o["cell"][0] * 16 - ox, o["cell"][1] * 16 - oy))
    ordered = sorted(doc["props"], key=lambda p: p["world_px"][1])
    for p in ordered:
        r = atlas["props"][p["frame"]]
        spr = props.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
        im.alpha_composite(spr, (int(p["world_px"][0] - r[2] / 2) - ox, int(p["world_px"][1] - r[3]) - oy))
    t = float(view.get("time_of_day", 0.35))
    night = max(smoothstep(0.62, 0.86, t), 1.0 - smoothstep(0.12, 0.30, t))
    day = doc["ambient_day"]
    dark = doc["ambient_night"]
    amb = tuple(day[i] + (dark[i] - day[i]) * night for i in range(3))
    px = im.load()
    for y in range(VIEW_H):
        for x in range(VIEW_W):
            r, gg, b, a = px[x, y]
            px[x, y] = (int(r * amb[0]), int(gg * amb[1]), int(b * amb[2]), a)
    if night > 0.05 and "light_pool" in atlas["props"]:
        r = atlas["props"]["light_pool"]
        pool = props.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
        alpha = pool.getchannel("A").point(lambda v: int(v * (0.25 + 0.75 * night)))
        pool.putalpha(alpha)
        for l in doc.get("lights", []):
            im.alpha_composite(pool, (int(l["world_px"][0] - r[2] / 2) - ox, int(l["world_px"][1] - r[3] / 2) - oy))
    return im.resize((VIEW_W * 2, VIEW_H * 2), Image.Resampling.NEAREST)


def main() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    atlas = load(ART / "atlas.v1.json")
    terrain = Image.open(ROOT / "assets/environment/survival_world/terrain.png").convert("RGBA")
    props = Image.open(ROOT / "assets/environment/survival_world/props.png").convert("RGBA")
    index = load(ART / "presentations.v1.json")
    saved = []
    thumbs = []
    for entry in index["presentations"]:
        doc = load(ROOT / entry["path"])
        for view in doc["capture_views"]:
            im = render(doc, atlas, terrain, props, view)
            name = f"world_art_{doc['treatment_id']}_{view['id']}.png"
            im.save(OUT / name)
            saved.append(str((OUT / name).relative_to(ROOT)))
            thumbs.append((f"{doc['biome_profile']} / {view['id']}", im.resize((640, 360), Image.Resampling.NEAREST)))
    cols = 2
    cw, ch = 640, 390
    sheet = Image.new("RGB", (cols * cw, ((len(thumbs) + cols - 1) // cols) * ch), "#1d1a22")
    d = ImageDraw.Draw(sheet)
    for i, (label, im) in enumerate(thumbs):
        x = (i % cols) * cw; y = (i // cols) * ch
        sheet.paste(im, (x, y + 30))
        d.text((x + 8, y + 8), label + "  [Pillow/atlas preview, not native]", fill="white")
    sheet.save(OUT / "world_art_views_contact.png")
    return {"ok": True, "previews": len(saved), "contact": "docs/survival/world/evidence/world_art_views_contact.png", "files": saved}


if __name__ == "__main__":
    print(json.dumps(main(), sort_keys=True))
