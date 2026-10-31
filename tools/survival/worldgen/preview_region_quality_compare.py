#!/usr/bin/env python3
"""Before/after regional quality panels at the exact 640x360 player camera.

Before art is loaded from the pushed dabf7bf5 Git blob (atlas + compiled doc),
then rendered with the AFTER capture camera so the comparison is not a camera
move. After art is the current working tree. Pillow only; not native Godot.
"""
from __future__ import annotations

import io
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

from preview_world_art import render, load, ROOT, ART, VIEW_W, VIEW_H

BEFORE_REF = "dabf7bf516a80b112821b51d07e4dfe5fcb9a765"
OUT = ROOT / "docs/survival/world/evidence/quality_uplift"


def git_bytes(path: str) -> bytes:
    return subprocess.check_output(["git", "show", f"{BEFORE_REF}:{path}"], cwd=ROOT)


def git_json(path: str) -> dict:
    return json.loads(git_bytes(path))


def logical(im: Image.Image) -> Image.Image:
    return im.resize((VIEW_W, VIEW_H), Image.Resampling.NEAREST)


def crop5(im: Image.Image, center, proxy=None) -> Image.Image:
    cx, cy = center
    x = max(0, min(VIEW_W - 128, int(cx) - 64))
    y = max(0, min(VIEW_H - 72, int(cy) - 48))
    big = im.crop((x, y, x + 128, y + 72)).resize((640, 360), Image.Resampling.NEAREST)
    d = ImageDraw.Draw(big)
    if proxy:
        px, py = (proxy[0] - x) * 5, (proxy[1] - y) * 5
        if 0 <= px <= 640 and 0 <= py <= 360:
            d.rectangle((px - 30, py - 80, px + 30, py), outline=(255, 255, 255), width=2)
            d.text((max(2, px - 40), max(2, py - 96)), "12x16 PROXY", fill=(255, 255, 255))
    return big


def main() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    before_atlas = git_json("data/survival/world/art/atlas.v1.json")
    before_sheets = {k: Image.open(io.BytesIO(git_bytes(f"assets/environment/survival_world/{k}.png"))).convert("RGBA") for k in ("terrain", "props")}
    after_atlas = load(ART / "atlas.v1.json")
    after_sheets = {k: Image.open(ROOT / "assets/environment/survival_world" / f"{k}.png").convert("RGBA") for k in ("terrain", "props")}
    index = load(ART / "presentations.v1.json")
    saved = []
    for entry in index["presentations"]:
        doc = load(ROOT / entry["path"])
        if not doc["treatment_id"].endswith("_region_window"):
            continue
        before_doc = git_json(entry["path"])
        rid = doc["region_id"]
        lm = next((p for p in doc["props"] if p.get("poi_id")), None)
        rows1 = []
        rows5 = []
        for view in doc["capture_views"]:
            b = logical(render(before_doc, before_atlas, before_sheets["terrain"], before_sheets["props"], view))
            a = logical(render(doc, after_atlas, after_sheets["terrain"], after_sheets["props"], view))
            label = f"{rid} / {view['id']} / exact 640x360 player camera"
            rows1.append((label, b, a))
            cx, cy = view["center_cell"]
            ox, oy = cx * 16 - VIEW_W // 2, cy * 16 - VIEW_H // 2
            if lm:
                proxy = (lm["world_px"][0] - ox, lm["world_px"][1] - oy)
                center = proxy
            else:
                proxy = None
                center = (VIEW_W // 2, VIEW_H // 2)
            rows5.append((label + " / 5x nearest", crop5(b, center, proxy), crop5(a, center, proxy)))
        # 1x day/night before-after sheet
        sheet = Image.new("RGB",(1280, 390 * len(rows1)), "#191c24")
        d = ImageDraw.Draw(sheet)
        for i, (label, b, a) in enumerate(rows1):
            y = i * 390
            sheet.paste(b, (0, y + 30)); sheet.paste(a, (640, y + 30))
            d.text((8, y + 5), "BEFORE dabf7bf5 / " + label, fill="white")
            d.text((648, y + 5), "AFTER / " + label, fill="white")
            d.text((8, y + 18), "Pillow source review; native/Gold UNKNOWN", fill="#c8c2cc")
        p1 = OUT / f"{rid}_1x_before_after.png"; sheet.save(p1); saved.append(str(p1.relative_to(ROOT)))
        # 5x crop sheet
        sheet5 = Image.new("RGB",(1280, 390 * len(rows5)), "#191c24")
        d = ImageDraw.Draw(sheet5)
        for i, (label, b, a) in enumerate(rows5):
            y = i * 390
            sheet5.paste(b, (0, y + 30)); sheet5.paste(a, (640, y + 30))
            d.text((8, y + 5), "BEFORE dabf7bf5 / " + label, fill="white")
            d.text((648, y + 5), "AFTER / " + label, fill="white")
        p5 = OUT / f"{rid}_5x_before_after.png"; sheet5.save(p5); saved.append(str(p5.relative_to(ROOT)))
    return {"ok": True, "before_ref": BEFORE_REF, "panels": saved, "native": "NOT_TESTED"}


if __name__ == "__main__":
    print(json.dumps(main(), sort_keys=True))
