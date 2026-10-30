#!/usr/bin/env python3
"""Pillow/atlas preview of A1 visual skins for A8 compact overworld shells.

This is NOT native Godot acceptance and NOT a mount. A8 keeps collision/entry;
A0 alone mounts production. The preview only proves the shared-atlas composition.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "data/survival/world/art"
OUT = ROOT / "docs/survival/world/evidence"


def load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def render(site: dict, atlas: dict, terrain: Image.Image, props: Image.Image) -> Image.Image:
    im = Image.new("RGBA", (128, 128), (24, 21, 28, 255))
    for y, row in enumerate(site["ground_rows"]):
        for x, frame in enumerate(row):
            r = atlas["terrain"][frame]
            im.alpha_composite(terrain.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])), (x * 16, y * 16))
    for o in site.get("overlays", []):
        r = atlas["terrain"][o["frame"]]
        im.alpha_composite(terrain.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])), (o["cell"][0] * 16, o["cell"][1] * 16))
    for p in sorted(site["props"], key=lambda q: q["local_px"][1]):
        r = atlas["props"][p["frame"]]
        spr = props.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
        im.alpha_composite(spr, (int(p["local_px"][0] - r[2] / 2), int(p["local_px"][1] - r[3])))
    return im.resize((384, 384), Image.Resampling.NEAREST)


def main() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    doc = load(ART / "a8_shell_visuals.v1.json")
    atlas = load(ART / "atlas.v1.json")
    terrain = Image.open(ROOT / "assets/environment/survival_world/terrain.png").convert("RGBA")
    props = Image.open(ROOT / "assets/environment/survival_world/props.png").convert("RGBA")
    saved = []
    sheet = Image.new("RGB", (3 * 400, 430), "#1d1a22")
    d = ImageDraw.Draw(sheet)
    for i, site in enumerate(doc["sites"]):
        im = render(site, atlas, terrain, props)
        name = f"a8_shell_{site['profile']}_pillow.png"
        im.save(OUT / name)
        saved.append(str((OUT / name).relative_to(ROOT)))
        x = i * 400 + 8
        sheet.paste(im, (x, 38))
        d.text((x, 8), f"{site['poi_id']} [Pillow, not native]", fill="white")
        d.text((x, 424 - 12), "doorway clear; A8 owns entry/collision", fill="#cfc8d8")
    sheet.save(OUT / "a8_shells_contact.png")
    return {"ok": True, "previews": len(saved), "contact": "docs/survival/world/evidence/a8_shells_contact.png", "files": saved}


if __name__ == "__main__":
    print(json.dumps(main(), sort_keys=True))
