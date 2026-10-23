#!/usr/bin/env python3
"""Build honest native Godot evidence only; no simulated game frames."""
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
E=ROOT/"docs/gate1/evidence"
STATIONS=("spawn","entry","destination","combat_space")
for station in STATIONS:
    files=[E/("before_"+station+".png"),E/("after_"+station+".png")]
    if any(not x.exists() for x in files):
        raise SystemExit("Missing native comparison frames: "+station)
    with Image.open(files[0]) as a, Image.open(files[1]) as b:
        if a.size!=(1280,720) or b.size!=(1280,720):
            raise SystemExit("Invalid native resolution at "+station)
        sheet=Image.new("RGB",(2568,720),(16,14,19))
        sheet.paste(a.convert("RGB"),(0,0))
        sheet.paste(b.convert("RGB"),(1288,0))
        sheet.save(E/("comparison_"+station+".png"))
src=E/"after_sanctuary.png"
if not src.exists():raise SystemExit("Native after_sanctuary missing")
with Image.open(src) as img:
    if img.size!=(1280,720):raise SystemExit("Invalid after_sanctuary dimensions")
    for label,box in (
        ("armarium",(440,280,860,610)),
        ("west_threshold",(320,310,690,620)),
    ):
        crop=img.convert("RGB").crop(box)
        crop=crop.resize((crop.width*4,crop.height*4),Image.Resampling.NEAREST)
        crop.save(E/("closeup_"+label+"_4x.png"))
print("GATE1 EVIDENCE: 4 native before/after pairs and 2 sanctuary 4x crops")
