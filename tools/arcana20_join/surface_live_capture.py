"""Surface a real gameplay capture, never a generated frame or altered crop.

Full uses a downscaled entire viewport for context; detail is an unscaled 1x
center region and must not be mistaken for the full composition.
"""
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(sys.argv[1])
fraction = float(sys.argv[2])
mode = sys.argv[3]
data = json.loads((root / 'timeline.json').read_text())
frames = data['frames']
target = data['last_tick'] * fraction
frame = min(frames, key=lambda x: abs(x['source_tick_last_observed'] - target))
print(f"LIVE_FRAME skill={data['skill']} mode={mode} "
      f"requested_fraction={fraction} actual_tick={frame['source_tick_last_observed']} "
      f"wall_s={frame['wall_s']} filename={frame['file']}")
if mode == 'full':
    command = ['python3', 'prototypes/arcana_fusion20/renderer/c10_review_surface.py',
               str(root), pathlib.Path(frame['file']).stem]
elif mode == 'detail':
    command = ['python3', 'prototypes/arcana_fusion20/renderer/native_review_surface.py',
               str(root / frame['file']), 'live']
else:
    raise SystemExit('mode must be full or detail')
subprocess.run(command, check=True)
