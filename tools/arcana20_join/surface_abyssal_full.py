"""Surface ONE entire locked 1280x720 viewport at native pixel dimensions.
JPEG is only a transport preview; the lossless unmodified PNG is in artifact.
"""
import base64
import io
import json
import pathlib
import sys
from PIL import Image
root = pathlib.Path(sys.argv[1])
index = int(sys.argv[2])
mode = sys.argv[3]
timelines = list(root.rglob('timeline.json'))
if len(timelines) != 1:
    raise SystemExit(f'expected one locked timeline, found {len(timelines)}')
root = timelines[0].parent
data = json.loads(timelines[0].read_text())
frames = [f for f in data['frames'] if 'ab_files' in f]
frame = frames[index]
image = Image.open(root / frame['ab_files'][0 if mode == 'a' else 1]).convert('RGB')
if image.size != (1280, 720):
    raise SystemExit('not an unscaled 1280x720 gameplay frame')
for quality in (62, 50, 40, 30, 20):
    out = io.BytesIO()
    image.save(out, 'JPEG', quality=quality, optimize=True)
    encoded = base64.b64encode(out.getvalue()).decode()
    if len(encoded) <= 100800:
        break
else:
    raise SystemExit(f'full-frame preview exceeds annotation budget: {len(encoded)}')
print(f'R20_FULL_FRAME native=1280x720 requested={frame["ab_requested_tick"]} actual={frame["ab_tick"]} variant={mode} jpeg_quality={quality}', flush=True)
chunks = pathlib.Path(sys.argv[4])
chunks.mkdir(parents=True, exist_ok=True)
for i in range(0, len(encoded), 2800):
    (chunks / str(i // 2800)).write_text(encoded[i:i+2800])
print(f'R20_FULL_CHUNKS count={len(list(chunks.iterdir()))}', flush=True)
