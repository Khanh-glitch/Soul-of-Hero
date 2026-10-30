#!/usr/bin/env python3
"""Render A1 corridor inspection previews from the inherited SOH atlas.

This is an authoring preview, not a native gameplay claim. Native player-scale
captures are produced separately by corridor_native_test.gd under Xvfb.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

from compile_corridor import OUT, ROOT, load
from compile_connector import annex_token_maps

TILE = 16


def frame_for_token(meta: dict, token: str, layer: str) -> str | None:
    if not token or token == ".":
        return None
    code, mask = token[:1], token[1:]
    codes = meta.get("codes", {})
    if layer == "ground":
        names = codes.get("ground", {}).get(code, [])
        if not names:
            return None
        return names[int(mask, 16) % len(names)] if mask else names[0]
    entry = codes.get(layer, {}).get(code)
    if not entry:
        return None
    base = entry.get("frame", "")
    if entry.get("masked") and mask:
        return f"{base}#{int(mask, 16) % int(entry.get('variants', 16))}"
    if entry.get("variant_names"):
        variants = entry["variant_names"]
        return variants[int(mask, 16) % len(variants)] if mask else variants[0]
    return base


def render(bbox: tuple[int, int, int, int], scale: int, out: Path, debug: bool = False) -> dict:
    corridor = load(OUT / "crown_roadside.corridor.v1.json")
    chunk = load(ROOT / "data/survival/world/chunks/06_03.json")
    tiles_meta = load(ROOT / "data/overworld/overworld_tiles.json")
    props_meta = load(ROOT / "data/overworld/overworld_props.json")["frames"]
    tiles = Image.open(ROOT / "assets/environment/overworld/overworld_tiles.png").convert("RGBA")
    props = Image.open(ROOT / "assets/environment/overworld/overworld_props.png").convert("RGBA")
    ground, detail, solid = annex_token_maps(chunk)
    overlay = {tuple(p["cell"]): p["token"] for p in corridor["detail_overlay"]}
    x0, y0, x1, y1 = bbox
    img = Image.new("RGBA", ((x1 - x0) * TILE, (y1 - y0) * TILE), (20, 18, 22, 255))

    def paste_token(token: str, layer: str, x: int, y: int) -> None:
        frame = frame_for_token(tiles_meta, token, layer)
        if not frame or frame not in tiles_meta["index"]:
            return
        rect = tiles_meta["index"][frame]
        tx, ty, tw, th = rect if len(rect) == 4 else (rect[0], rect[1], TILE, TILE)
        img.alpha_composite(tiles.crop((tx, ty, tx + tw, ty + th)), ((x - x0) * TILE, (y - y0) * TILE))

    for y in range(y0, y1):
        for x in range(x0, x1):
            paste_token(ground.get((x, y), "."), "ground", x, y)
            base_detail = detail.get((x, y), ".")
            paste_token(overlay.get((x, y), base_detail), "detail", x, y)
            paste_token(solid.get((x, y), "."), "solid", x, y)
    draw_props = []
    for d in corridor["decor"]:
        draw_props.append((d["y"], d["frame"], d["x"], d["y"]))
    for inst in corridor["instances"]:
        cx, cy = inst["cell"]
        draw_props.append((cy * TILE + TILE, inst["visual_frame"], cx * TILE + 8, cy * TILE + TILE))
    for _, frame, px, py in sorted(draw_props):
        meta = props_meta[frame]
        w, h = meta["w"], meta["h"]
        sx, sy = int(px - w / 2 - x0 * TILE), int(py - h - y0 * TILE)
        img.alpha_composite(props.crop((meta["x"], meta["y"], meta["x"] + w, meta["y"] + h)), (sx, sy))
    if debug:
        dr = ImageDraw.Draw(img)
        for c in corridor["route"]["required_nav_cells"]:
            x, y = c
            if x0 <= x < x1 and y0 <= y < y1:
                dr.rectangle(((x - x0) * TILE + 6, (y - y0) * TILE + 13, (x - x0) * TILE + 9, (y - y0) * TILE + 15), fill=(80, 220, 255, 160))
        for inst in corridor["instances"]:
            x, y = inst["stand_cell"]
            if x0 <= x < x1 and y0 <= y < y1:
                dr.rectangle(((x - x0) * TILE + 2, (y - y0) * TILE + 1, (x - x0) * TILE + 13, (y - y0) * TILE + 15), outline=(255, 210, 80, 255))
    img = img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out)
    return {"path": str(out), "bbox": list(bbox), "scale": scale, "size": list(img.size)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "docs/survival/world/evidence"))
    args = ap.parse_args()
    out = Path(args.out)
    results = [
        render((386, 194, 414, 228), 4, out / "corridor_overview.png"),
        render((388, 210, 408, 226), 2, out / "corridor_container_player_scale.png"),
        render((388, 210, 408, 226), 2, out / "corridor_container_debug.png", debug=True),
    ]
    print(json.dumps({"ok": True, "previews": results, "native_gameplay_claim": False}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
