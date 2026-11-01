"""Lossy preview of an actual-world candidate event; full PNG stays in source run."""
import base64, io, pathlib, sys
from PIL import Image
root, skill, kind = pathlib.Path(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
found = sorted(root.rglob(f'phase_{skill:02d}_candidate_{kind}_*_tick*.png'))
if len(found) != 1:
    raise SystemExit(f'expected one event for {skill:02d} {kind}, found {found}')
im = Image.open(found[0]).convert('RGB'); im.thumbnail((384,216), Image.Resampling.LANCZOS)
for quality in (68,55,45,35):
    buf=io.BytesIO(); im.save(buf,'JPEG',quality=quality,optimize=True)
    encoded=base64.b64encode(buf.getvalue()).decode()
    if len(encoded)<=28000: break
else: raise SystemExit('preview exceeds annotation budget')
for i in range(0,len(encoded),2800):
    print(f'::notice title=CANDIDATE_{skill:02d}_{i//2800}::{encoded[i:i+2800]}')
