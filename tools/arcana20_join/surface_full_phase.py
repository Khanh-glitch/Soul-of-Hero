"""Surface full 1280x720 captured viewport at 1/2 scale for spatial context.

An honest whole-frame overview, not native-detail or source parity; the
lossless 1x video remains in the input artifact. Ticks are last observed.
"""
import base64
import io
import json
import pathlib
import subprocess
import sys
from PIL import Image

root, fraction, label = pathlib.Path(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
records, videos = list(root.rglob('timeline.json')), list(root.rglob('native-lossless.mkv'))
if len(records) != 1 or len(videos) != 1: raise SystemExit('expected one timeline and lossless video')
data = json.loads(records[0].read_text()); frames = data['frames']; target = data['last_tick'] * fraction
index = min(range(len(frames)), key=lambda i: abs(frames[i]['source_tick_last_observed'] - target))
output = pathlib.Path('/tmp') / f'full-{label}.png'
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(videos[0]), '-vf', f'select=eq(n\\,{index})', '-fps_mode', 'vfr', '-frames:v', '1', str(output)], check=True)
im = Image.open(output).convert('RGB')
if im.size != (1280, 720): raise SystemExit(f'unexpected viewport size {im.size}')
im = im.resize((640, 360), Image.Resampling.NEAREST)
print(f'R17_FULL_VIEWPORT skill={data["skill"]} index={index} observed_tick={frames[index]["source_tick_last_observed"]} 1280x720 shown at 50 percent', flush=True)
for quality in (60, 45, 30, 20):
    buffer = io.BytesIO(); im.save(buffer, 'JPEG', quality=quality, optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode()
    if len(encoded) <= 28000: break
else: raise SystemExit('full overview exceeds annotation capacity')
for i in range(0, len(encoded), 2800):
    print(f'::notice title=FULL_HALF_{label}_{i // 2800}::{encoded[i:i+2800]}')
