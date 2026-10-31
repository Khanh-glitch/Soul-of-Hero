"""Part A - source-frame inspection sheet.

For every frame the pilot draws it prints the original PNG with the selected
rectangle marked, the extracted RGBA at 2x, the alpha bounds, the original canvas
size, the intended scale, the foot anchor, the purpose, and the verdict of the
checks in sources3.validate_rects(). It also renders the pilot-2 crops that were
rejected, next to the measured reason for rejecting them.
"""
import json
import os

from PIL import Image, ImageDraw

import sources3 as S

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "evidence3")
CELL_W, CELL_H = 420, 132


def font(d):
    return d


def rect_for(verdict, canvas_size):
    r = verdict["rect"]
    if r is None:
        return (0, 0) + tuple(canvas_size)
    return (r[0], r[1], r[0] + r[2], r[1] + r[3])


def draw_sprite_row(d, sheet, y, name, verdict, imgs):
    d.text((6, y + 2), f"{name}  [{verdict['anchor']}]  "
                       f"src {verdict['source_size'][0]}x{verdict['source_size'][1]}",
           fill=(235, 235, 235))
    ok = verdict["ok"]
    d.text((6, y + 16), f"crop {verdict['rect']}  obj {verdict['size'][0]}x{verdict['size'][1]}"
                        f"  scale 1.0  {'OK' if ok else 'REJECT: ' + ','.join(verdict['issues'])}",
           fill=(150, 220, 150) if ok else (240, 120, 120))
    d.text((6, y + 30), verdict["purpose"][:74], fill=(175, 175, 185))
    # source in context with the rectangle marked
    src = imgs[verdict["file"]].copy()
    x0, y0, x1, y1 = rect_for(verdict, src.size)
    sc = min(112 / src.width, 100 / src.height)
    thumb = src.resize((max(1, int(src.width * sc)), max(1, int(src.height * sc))), Image.NEAREST)
    sheet.paste(thumb, (6, y + 46), thumb)
    d.rectangle([6 + int(x0 * sc), y + 46 + int(y0 * sc),
                 6 + int(x1 * sc) - 1, y + 46 + int(y1 * sc) - 1], outline=(255, 0, 200))
    # extracted sprite at 2x, on a mid-grey card so alpha is visible
    key, rect, anchor, why = S.SPRITES[name]
    im = imgs[key]
    crop = im.crop(rect_for(verdict, im.size)) if rect else im.crop(im.getbbox())
    crop = crop.crop(crop.getbbox()) if crop.getbbox() else crop
    big = crop.resize((crop.width * 2, crop.height * 2), Image.NEAREST)
    card = Image.new("RGBA", (max(big.width, 20), max(big.height, 20)), (58, 58, 66, 255))
    card.alpha_composite(big, (0, 0))
    sheet.paste(card, (150, y + 46), card)
    d.text((150 + card.width + 8, y + 52),
           f"alpha bbox {crop.getbbox()}\nfoot anchor = bottom centre\n"
           f"drawn at native px, no resample", fill=(180, 180, 190))


def main():
    os.makedirs(OUT, exist_ok=True)
    imgs = S.load_images()
    verdicts = S.validate_rects(imgs, S.SPRITES)
    mats = S.resolve_materials(imgs)

    names = sorted(verdicts)
    rows = (len(names) + 1) // 2
    sheet = Image.new("RGB", (CELL_W * 2 + 12, rows * CELL_H + 40), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    d.text((6, 8), "PILOT 3 - every source frame used, with its source, rectangle, alpha bounds, "
                   "scale, anchor and purpose", fill=(245, 245, 245))
    d.text((6, 24), "magenta = selected rectangle inside the original PNG; card = extracted RGBA "
                    "at 2x. Sources are private CraftPix archives, never committed.",
           fill=(160, 160, 170))
    for i, n in enumerate(names):
        col, row = i % 2, i // 2
        draw_sprite_row(d, sheet, 40 + row * CELL_H, n, verdicts[n], imgs)
        if col == 1:
            d.line([0, 40 + (row + 1) * CELL_H - 2, sheet.width, 40 + (row + 1) * CELL_H - 2],
                   fill=(48, 48, 56))
    sheet.save(os.path.join(OUT, "inspect_sprites_1280.png"))

    # ---- rejected pilot-2 crops -------------------------------------------
    bad = Image.new("RGB", (1280, 132 * len(S.REJECTED) + 44), (30, 22, 22))
    d = ImageDraw.Draw(bad)
    d.text((6, 8), "REJECTED IN PILOT 2 - shown with the measured reason", fill=(255, 200, 200))
    d.text((6, 24), "rectangles marked on the same private sources; nothing here is used by any "
                    "pilot-3 layout", fill=(200, 160, 160))
    for i, r in enumerate(S.REJECTED):
        y = 44 + i * 132
        d.text((6, y + 2), f"{r['name']}  <- {r['pack']}:{r['file']}", fill=(245, 245, 245))
        d.text((6, y + 18), f"rect {r['rect']}   {r['why'][:96]}", fill=(240, 150, 120))
        if len(r["why"]) > 96:
            d.text((6, y + 32), r["why"][96:190], fill=(240, 150, 120))
        try:
            pack, rel = S.FILES[next(k for k, v in S.FILES.items() if v[1] == r["file"])]
        except StopIteration:
            pack, rel = r["pack"], r["file"]
        path = os.path.join(S.pack_dir(pack), rel)
        if os.path.exists(path):
            src = Image.open(path).convert("RGBA")
            sc = min(260 / src.width, 84 / src.height)
            th = src.resize((max(1, int(src.width * sc)), max(1, int(src.height * sc))), Image.NEAREST)
            bad.paste(th, (6, y + 44), th)
            if r["rect"]:
                x, yy, w, h = r["rect"]
                d.rectangle([6 + int(x * sc), y + 44 + int(yy * sc),
                             6 + int((x + w) * sc) - 1, y + 44 + int((yy + h) * sc) - 1],
                            outline=(255, 0, 0))
                crop = src.crop((x, yy, x + w, yy + h))
                big = crop.resize((crop.width * 2, crop.height * 2), Image.NEAREST)
                card = Image.new("RGBA", (max(big.width, 12), max(big.height, 12)), (60, 40, 40, 255))
                card.alpha_composite(big, (0, 0))
                bad.paste(card, (300, y + 44), card)
    bad.save(os.path.join(OUT, "inspect_rejected_1280.png"))

    # ---- materials ---------------------------------------------------------
    tops = [("moor grass", mats["grass"]), ("stone pavement", mats["pave"])]
    if mats.get("track"):
        tops.append(("earth track (withdrawn from use)", mats["track"]))
    mh = 40 + sum(70 for _ in tops) + 20
    mt = Image.new("RGB", (1280, mh), (24, 24, 28))
    d = ImageDraw.Draw(mt)
    d.text((6, 8), "MATERIAL SAMPLES - 16x16, 100% opaque, taken from uniform interiors",
           fill=(240, 240, 240))
    y = 34
    for label, samples in tops:
        d.text((6, y), f"{label}: {len(samples)} samples", fill=(200, 200, 210))
        x = 220
        for m in samples[:16]:
            src = imgs[m["file"]]
            sx, sy = m["rect"][0], m["rect"][1]
            tile = src.crop((sx, sy, sx + 16, sy + 16))
            mt.paste(tile.resize((48, 48), Image.NEAREST), (x, y - 8), tile.resize((48, 48), Image.NEAREST))
            d.text((x, y + 42), f"{m['file'][:6]} {sx},{sy}", fill=(150, 150, 160))
            x += 70
        y += 70
    mt.save(os.path.join(OUT, "inspect_materials_1280.png"))

    json.dump({"crops": verdicts, "materials": mats, "rejected": S.REJECTED,
               "policy": {"scale": "native only, no resampling",
                          "sprite_source": "whole file bbox or exact connected component",
                          "materials": "100% opaque interior samples",
                          "pavement_edges": "road pack 6px band, native N/S, rotated for E/W"}},
              open(os.path.join(OUT, "inspect_sources.json"), "w"), indent=2)
    print(json.dumps({"sprites": len(verdicts),
                      "invalid": [k for k, v in verdicts.items() if not v["ok"]],
                      "rejected": len(S.REJECTED),
                      "materials": {k: len(v) for k, v in mats.items()}}, indent=1))


if __name__ == "__main__":
    main()
