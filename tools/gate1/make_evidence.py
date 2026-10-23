#!/usr/bin/env python3
"""Native Godot-before/after evidence, not a substitute image renderer."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
FRAMES=ROOT/"docs/gate1/evidence"
CAPTURES=("spawn","entry","destination","combat_space")
for name in CAPTURES:
    p=FRAMES/("before_"+name+".png")
    q=FRAMES/("after_"+name+".png")
    assert p.exists() and q.exists(),f"Missing native Godot frame {name}"
    with Image.open(p) as left, Image.open(q) as right:
        assert left.size==right.size==(1280,720)
        out=Image.new("RGB",(2560,749),(14,13,19))
        out.paste(left.convert("RGB"),(0,29))
        out.paste(right.convert("RGB"),(1280,29))
    d=ImageDraw.Draw(out)
    d.text((12,7),"BEFORE — pinned Level 3 + Gate 0 props",fill=(240,240,240))
    suffix=" (different reachable viewpoints)" if name=="destination" else " (matching world station)"
    d.text((1292,7),"AFTER — Gate 1 room redesign"+suffix,fill=(240,240,240))
    out.save(FRAMES/("comparison_"+name+".png"),optimize=True)
    print("GATE1 SHEET "+name+" "+str(out.size))
