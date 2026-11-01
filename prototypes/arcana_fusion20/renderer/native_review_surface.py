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
# Optional native-pixel center targets an effect away from the player. The
# fixed default remains unchanged for existing comparisons. Always disclose
# the region; it is not a substitute for the full-frame video.
if len(sys.argv) == 5:
    cx, cy = int(sys.argv[3]), int(sys.argv[4])
else:
    cx, cy = 672, 360
left, top = cx - 192, cy - 108
if left < 0 or top < 0 or left + 384 > im.width or top + 216 > im.height:
    raise SystemExit(f'crop center out of bounds: {cx}, {cy}')
print(f'NATIVE_CROP full={im.size} bounds=({left},{top},{left + 384},{top + 216})')
im = im.crop((left, top, left + 384, top + 216))
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
