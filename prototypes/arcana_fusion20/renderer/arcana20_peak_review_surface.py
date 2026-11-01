"""Review thumbnail of one actual native peak. Full PNG stays in source run."""
import base64, io, pathlib, sys
from PIL import Image
root = pathlib.Path(sys.argv[1]); number = int(sys.argv[2])
found = sorted(root.rglob(f'phase_{number:02d}_catalog_climax_tick*.png'))
if len(found) != 1:
    raise SystemExit(f'expected one native peak for {number:02d}, found {found}')
im = Image.open(found[0]).convert('RGB'); im.thumbnail((384,216), Image.Resampling.LANCZOS)
for quality in (68, 55, 45, 35):
    buf=io.BytesIO(); im.save(buf, 'JPEG', quality=quality, optimize=True)
    encoded=base64.b64encode(buf.getvalue()).decode()
    if len(encoded)<=28000: break
else: raise SystemExit('preview exceeds annotation budget')
for i in range(0,len(encoded),2800):
    print(f'::notice title=PEAK_{number:02d}_{i//2800}::{encoded[i:i+2800]}')
