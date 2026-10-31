#!/usr/bin/env python3
"""Connected-component inventory of a source sheet, with a labelled contact sheet.

Pieces are reported as (index, bbox) in source pixels so a placement file can
name exact crops instead of guessing at a grid.
"""
from __future__ import annotations

import json
import sys

import numpy as np
from PIL import Image, ImageDraw


def components(path, min_px=24):
    im = Image.open(path).convert("RGBA")
    a = np.array(im)[:, :, 3] > 8
    h, w = a.shape
    seen = np.zeros_like(a)
    out = []
    for y in range(h):
        for x in range(w):
            if not a[y, x] or seen[y, x]:
                continue
            stack = [(y, x)]
            seen[y, x] = True
            minx = maxx = x
            miny = maxy = y
            n = 0
            while stack:
                cy, cx = stack.pop()
                n += 1
                minx = min(minx, cx)
                maxx = max(maxx, cx)
                miny = min(miny, cy)
                maxy = max(maxy, cy)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and a[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if n >= min_px:
                out.append([minx, miny, maxx - minx + 1, maxy - miny + 1, n])
    out.sort(key=lambda b: (b[1] // 8, b[0]))
    return im, out


def main():
    path, out_png, out_json = sys.argv[1], sys.argv[2], sys.argv[3]
    im, comps = components(path)
    Z = 3
    cols = 8
    cw = max(c[2] for c in comps) * Z + 46
    ch = max(c[3] for c in comps) * Z + 14
    rows = (len(comps) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, rows * ch), (24, 24, 30))
    d = ImageDraw.Draw(sheet)
    for i, (x, y, w, h, n) in enumerate(comps):
        piece = im.crop((x, y, x + w, y + h)).resize((w * Z, h * Z), Image.NEAREST)
        cx, cy = (i % cols) * cw, (i // cols) * ch
        sheet.paste(piece, (cx + 44, cy + 10), piece)
        d.text((cx + 2, cy + 2), f"#{i}", fill=(255, 230, 140))
        d.text((cx + 2, cy + 11), f"{w}x{h}", fill=(180, 230, 255))
    sheet.save(out_png)
    json.dump({"sheet": path, "size": list(im.size),
               "pieces": [{"i": i, "rect": c[:4], "px": c[4]} for i, c in enumerate(comps)]},
              open(out_json, "w"), indent=1)
    print(f"{path}: {len(comps)} pieces -> {out_png}")


if __name__ == "__main__":
    main()
