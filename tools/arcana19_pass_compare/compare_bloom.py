"""Compare original D bloom readbacks with native GPU bloom, driven by the
same original scene input. Isolates pass math, not D geometry, world or approval.
Metrics are reported rather than widened to force a pass."""
import json, pathlib, sys
import numpy as np
from PIL import Image
p = pathlib.Path(sys.argv[1])
results = []
for tick in (72, 192, 312, 489, 510):
    for name, (w, h) in {'bloomSmall': (240, 135), 'bloom2': (120, 67), 'post': (480, 270)}.items():
        a = np.fromfile(p / f'original_{tick}.{name}.rgba8', dtype=np.uint8).reshape(h, w, 4)[::-1]
        b = np.fromfile(p / f'native_{tick}.{name}.rgba8', dtype=np.uint8).reshape(h, w, 4)
        diff = np.abs(a.astype(np.int16) - b.astype(np.int16))
        rgb = diff[:, :, :3]
        Image.fromarray(a, 'RGBA').save(p / f'{tick}_{name}_original.png')
        Image.fromarray(b, 'RGBA').save(p / f'{tick}_{name}_native.png')
        Image.fromarray(np.minimum(rgb.max(axis=2) * 16, 255).astype(np.uint8), 'L').save(p / f'{tick}_{name}_error.png')
        regions = []
        for y in range(6):
            for x in range(8):
                r = rgb[y*h//6:(y+1)*h//6, x*w//8:(x+1)*w//8]
                regions.append({'x': x, 'y': y, 'mae_255': float(r.mean()), 'max_255': int(r.max())})
        row = {'tick': tick, 'pass': name, 'mae_255': float(rgb.mean()), 'max_255': int(rgb.max()),
               'different_rgb_channels': int(np.count_nonzero(rgb)), 'regions': regions,
               'scope': 'native GPU bloom/post given identical original neutral-base scene and actual GL uniforms; no native geometry, SOH world or approval'}
        print('D19_BLOOM_COMPARE', json.dumps({k: v for k, v in row.items() if k != 'regions'}), flush=True)
        results.append(row)
(p / 'bloom_comparison.json').write_text(json.dumps(results, indent=2))
