"""Expose a native 1x target-centered detail from one locked A/B frame.
Full unscaled 1280x720 PNG remains in the same artifact; this is not a crop
used for parity or a replacement for full-world motion review.
"""
import json
import pathlib
import subprocess
import sys
root = pathlib.Path(sys.argv[1])
index, mode = int(sys.argv[2]), sys.argv[3]
data = json.loads((root / 'timeline.json').read_text())
frames = [f for f in data['frames'] if 'ab_files' in f]
frame = frames[index]
name = frame['ab_files'][0 if mode == 'a' else 1]
target, camera = data['frames'][0]['enemy'], frame['camera']
cx = max(192, min(1088, round(640 + 2 * (target[0] - camera[0]))))
cy = max(108, min(612, round(360 + 2 * (target[1] - camera[1]))))
print(f'R20_AB_DETAIL requested={frame["ab_requested_tick"]} actual={frame["ab_tick"]} variant={mode} center={cx},{cy}', flush=True)
subprocess.run(['python3', 'prototypes/arcana_fusion20/renderer/native_review_surface.py', str(root/name), f'ab_{index}_{mode}', str(cx), str(cy)], check=True)
