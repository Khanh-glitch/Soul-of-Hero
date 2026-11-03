#!/usr/bin/env python3
"""Composited VEYRA GOLD review screenshot (native 2000x1400).

Draws every GOLD-derived object class over the terrain render using Pillow,
at native resolution, nearest-neighbor (pixel-art). Saved to
docs/survival/screenshots/veyra_gold_review.png
"""
import base64, json, math, os
from PIL import Image, ImageDraw

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(REPO, "data", "survival", "veyra_gold_map.source.json")
TERRAIN_PNG = os.path.join(REPO, "assets", "environment", "veyra", "veyra_terrain_render.png")
OUT = os.path.join(REPO, "docs", "survival", "screenshots", "veyra_gold_review.png")

COL = {
    "land": (184, 157, 107, 220), "lakes_fill": (45, 90, 138, 90), "lakes_line": (95, 168, 211, 235),
    "rivers": (99, 179, 237, 220), "roads": (199, 168, 128, 210), "bridges": (201, 195, 184, 235),
    "docks": (76, 195, 217, 235), "pois": (179, 136, 255, 200), "zones": (111, 207, 140, 170),
    "fish": (76, 195, 217, 210), "ore": (199, 199, 208, 210), "wood": (199, 168, 128, 210),
    "herb": (111, 207, 140, 210), "food": (255, 127, 80, 210), "spawns": (165, 214, 167, 235),
    "elders": (225, 190, 231, 200), "labels_txt": (255, 255, 255, 240),
}


def load_world():
    return json.load(open(SRC, encoding="utf-8"))["project"]


def poly_line(draw, ring, width, color, cap=True):
    pts = [tuple(p) for p in ring]
    if len(pts) < 2:
        return
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=color, width=width)
    # close rings
    if pts[0] != pts[-1]:
        draw.line([pts[-1], pts[0]], fill=color, width=width)


def main():
    w = load_world()
    base = Image.open(TERRAIN_PNG).convert("RGBA")
    canvas = Image.alpha_composite(base, Image.new("RGBA", base.size, (0, 0, 0, 0)))
    draw = ImageDraw.Draw(canvas)

    # Land rings
    for l in w["land"]:
        for ring in l["rings"]:
            poly_line(draw, ring, 2, COL["land"])

    # Lakes fill + outline
    for l in w["lakes"]:
        ring = [tuple(p) for p in l["ring"]]
        draw.polygon(ring, fill=COL["lakes_fill"])
        poly_line(draw, l["ring"], 2, COL["lakes_line"])

    # Rivers (width-scaled)
    for r in w["rivers"]:
        pts = [tuple(p) for p in r["points"]]
        width = max(1, int(float(r.get("width", 4))))
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i + 1]], fill=COL["rivers"], width=width)

    # Roads
    for r in w["roads"]:
        pts = [tuple(p) for p in r["points"]]
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i + 1]], fill=COL["roads"], width=5)

    # Bridges
    for b in w["bridges"]:
        ang = float(b.get("ang", 0.0)); L = 48 if b.get("load") == "cart" else 30
        dx = math.cos(ang) * L / 2; dy = math.sin(ang) * L / 2
        draw.line([(b["at"][0] - dx, b["at"][1] - dy), (b["at"][0] + dx, b["at"][1] + dy)],
                  fill=COL["bridges"], width=3)

    # Docks
    for d in w["docks"]:
        draw.line([(d["at"][0], d["at"][1] - 14), (d["at"][0], d["at"][1] + 14)], fill=COL["docks"], width=2)
        draw.line([(d["at"][0] - 10, d["at"][1]), (d["at"][0] + 10, d["at"][1])], fill=COL["docks"], width=2)

    # POIs footprint + mark
    for p in w["pois"]:
        foot = p.get("foot") or []
        if len(foot) >= 3:
            draw.polygon([tuple(q) for q in foot], outline=COL["pois"], width=1)
        draw.ellipse([p["at"][0] - 3, p["at"][1] - 3, p["at"][0] + 3, p["at"][1] + 3], fill=COL["pois"])

    # Zones
    for z in w["zones"]:
        poly_line(draw, z["ring"], 1, COL["zones"])

    # Resources sized by r (capped)
    rcol = {"fish": COL["fish"], "ore": COL["ore"], "wood": COL["wood"],
            "herb": COL["herb"], "food": COL["food"]}
    for r in w["resources"]:
        rad = min(float(r.get("r", 6)), 14)
        c = rcol.get(r.get("kind", "?"), COL["food"])
        steps = 8
        pts = []
        for i in range(steps):
            a = 2 * math.pi * i / steps
            pts.append((r["at"][0] + rad * math.cos(a), r["at"][1] + rad * math.sin(a)))
        draw.polygon(pts, outline=c, width=1)

    # Spawns
    for s in w["spawns"]:
        draw.line([(s["at"][0] - 10, s["at"][1]), (s["at"][0] + 10, s["at"][1])], fill=COL["spawns"], width=2)
        draw.line([(s["at"][0], s["at"][1] - 10), (s["at"][0], s["at"][1] + 10)], fill=COL["spawns"], width=2)

    # Elders outer ring
    for e in w["elders"]:
        poly_line(draw, e["outer"], 2, COL["elders"])

    # Labels text
    try:
        font = __import__("PIL.ImageFont", fromlist=["ImageFont"]).ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 14)
    except Exception:
        font = None
    for l in w["labels"]:
        txt = l.get("text", l.get("name", ""))
        if font:
            bbox = draw.textbbox((0, 0), txt, font=font)
            tw = bbox[2] - bbox[0]; th = bbox[3] - bbox[1]
            draw.text((l["at"][0] - tw / 2, l["at"][1] - th / 2), txt, font=font, fill=COL["labels_txt"])
        else:
            draw.text((l["at"][0], l["at"][1]), txt, fill=COL["labels_txt"])

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    canvas.save(OUT)
    print("wrote", OUT, canvas.size)


if __name__ == "__main__":
    main()
