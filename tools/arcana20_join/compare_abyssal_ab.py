"""Verify six real-world frozen A/B captures, keeping full 1280x720 PNGs.
A-restored must be bit-exact; A/B difference is measured, never thresholded
or retouched. Natural-motion video is separately retained by the harness.
"""
import json
import pathlib
import sys
from PIL import Image, ImageChops

root = pathlib.Path(sys.argv[1])
record = json.loads((root / 'timeline.json').read_text())
frames = [row for row in record['frames'] if 'ab_files' in row]
if len(frames) != 6:
    raise SystemExit(f'expected six locked A/B moments, got {len(frames)}')
rows = []
for frame in frames:
    images = [Image.open(root / name).convert('RGB') for name in frame['ab_files']]
    if any(im.size != (1280, 720) for im in images):
        raise SystemExit('A/B comparison is not native 1280x720')
    restore = ImageChops.difference(images[0], images[2])
    diff = ImageChops.difference(images[0], images[1])
    def changed_pixels(image):
        r, g, b = image.split()
        mask = ImageChops.lighter(ImageChops.lighter(r, g), b)
        return sum(mask.histogram()[1:])
    drift = changed_pixels(restore)
    changed = changed_pixels(diff)
    if drift:
        raise SystemExit(f'locked A restoration drifted at tick {frame["ab_tick"]}: {drift} pixels')
    rows.append({'requested_tick': frame['ab_requested_tick'], 'actual_tick': frame['ab_tick'],
                 'A_vs_restored_changed_pixels': drift, 'A_vs_B_changed_pixels': changed,
                 'files': frame['ab_files']})
if not any(row['A_vs_B_changed_pixels'] > 100 for row in rows):
    raise SystemExit('B did not visibly differ in any locked gameplay frame')
(root / 'ab-comparison.json').write_text(json.dumps({'scope': 'Frozen actual world, same A/C source clock, target, actors and camera; B changes the separate water presentation and relative C/A order, both under actors. Full native PNGs retained.', 'frames': rows}, indent=2))
for row in rows:
    print('::notice title=R20_AB_LOCK::' + json.dumps(row), flush=True)
