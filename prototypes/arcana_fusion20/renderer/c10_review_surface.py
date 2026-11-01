"""Small review preview from native PNG; the uploaded artifact remains full-resolution.
No masks or image processing are used to alter the gameplay frame.
"""
import base64, io, pathlib, sys
from PIL import Image
root = pathlib.Path(sys.argv[1])
name = sys.argv[2]
path = next(root.rglob(name + '.png'))
im = Image.open(path).convert('RGB')
im.thumbnail((384, 216), Image.Resampling.LANCZOS)
buf = io.BytesIO()
im.save(buf, 'JPEG', quality=68, optimize=True)
encoded = base64.b64encode(buf.getvalue()).decode()
if len(encoded) > 28000:
    raise SystemExit(f'preview too large for 10 annotations: {len(encoded)}')
for i in range(0, len(encoded), 2800):
    print(f'::notice title=C10_REVIEW_{name}_{i//2800}::{encoded[i:i+2800]}')
