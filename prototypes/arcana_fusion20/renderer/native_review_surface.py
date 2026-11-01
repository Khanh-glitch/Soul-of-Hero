"""Expose an unscaled 384x216 native-pixel region of a full viewport frame.

The full 1280x720 frame/video remains in the run artifact. This crop is for
pixel-detail inspection, not a substitute for reviewing full-frame composition.
"""
import base64
import io
import pathlib
import sys
from PIL import Image

im = Image.open(pathlib.Path(sys.argv[1])).convert('RGB')
if im.size != (1280, 720):
    raise SystemExit(f'unexpected full viewport dimensions {im.size}')
im = im.crop((480, 252, 864, 468))
for quality in (68, 55, 45, 35):
    buffer = io.BytesIO()
    im.save(buffer, 'JPEG', quality=quality, optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode()
    if len(encoded) <= 28000:
        break
else:
    raise SystemExit(f'crop too large for annotations: {len(encoded)}')
for i in range(0, len(encoded), 2800):
    print(f'::notice title=NATIVE_1X_{sys.argv[2]}_{i // 2800}::{encoded[i:i+2800]}')
