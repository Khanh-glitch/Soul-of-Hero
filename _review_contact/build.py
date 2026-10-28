#!/usr/bin/env python3
"""Build contact sheets of after_* gameplay frames per level (native 640x360 each)."""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = "/home/user/review/docs/chapter1-visual-overhaul"
OUT = "/home/user/Soul-of-Hero/_review_contact"
os.makedirs(OUT, exist_ok=True)

LEVELS = ["L01","L02","L03","L04","L05","L06","L07","L08","L09","L10"]
W, H = 640, 360
PAD = 4
LABEL_H = 18

try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 14)
except Exception:
    font = ImageFont.load_default()

for lv in LEVELS:
    img_dir = os.path.join(BASE, lv, "images")
    files = sorted(f for f in os.listdir(img_dir) if f.startswith("after_") and f.endswith(".png"))
    n = len(files)
    cols = 3 if n <= 6 else 4
    rows = (n + cols - 1) // cols
    sheet = Image.new("RGB",
                      (cols*(W+PAD) + PAD, rows*(H+LABEL_H+PAD) + PAD + 40),
                      (20,20,30))
    d = ImageDraw.Draw(sheet)
    d.text((PAD, 10), f"{lv}  native gameplay frames (640x360, after)", fill=(230,230,200), font=font)
    for i, fn in enumerate(files):
        r = i // cols; c = i % cols
        im = Image.open(os.path.join(img_dir, fn)).convert("RGB")
        if im.size != (W,H):
            im = im.resize((W,H), Image.NEAREST)
        x = PAD + c*(W+PAD)
        y = 40 + PAD + r*(H+LABEL_H+PAD)
        sheet.paste(im, (x, y))
        d.rectangle([x, y+H, x+W, y+H+LABEL_H], fill=(40,40,60))
        d.text((x+4, y+H+2), fn, fill=(220,220,180), font=font)
    outp = os.path.join(OUT, f"{lv}_contact.png")
    sheet.save(outp)
    print("wrote", outp, sheet.size)

# Combined mosaic sheet: 2 rows of 5
MW, MH = 500, 500  # size to shrink mosaics to
COLS = 5; ROWS = 2
big = Image.new("RGB", (COLS*(MW+PAD)+PAD, ROWS*(MH+LABEL_H+PAD)+PAD+40), (10,10,15))
d = ImageDraw.Draw(big)
d.text((PAD,10), "Full-map mosaics (all 10 levels, scaled)", fill=(230,230,200), font=font)
MOS = "/home/user/review/docs/chapter1-visual-recovery/after"
for i, lv in enumerate(LEVELS):
    p = os.path.join(MOS, f"{lv}_mosaic.png")
    im = Image.open(p).convert("RGB")
    im.thumbnail((MW,MH), Image.NEAREST)
    r = i // COLS; c = i % COLS
    x = PAD + c*(MW+PAD)
    y = 40 + PAD + r*(MH+LABEL_H+PAD)
    # center in slot
    cx = x + (MW - im.width)//2
    big.paste(im, (cx, y))
    d.rectangle([x, y+MH, x+MW, y+MH+LABEL_H], fill=(40,40,60))
    d.text((x+4, y+MH+2), lv, fill=(220,220,180), font=font)
big.save(os.path.join(OUT, "mosaics_all.png"))
print("mosaic sheet done")
