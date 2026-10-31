"""Compare original D bloom readbacks with native GPU bloom, driven by the
same original scene input. Isolates pass math, not D geometry, world or approval.
Metrics are reported rather than widened to force a pass."""
import json, pathlib, sys
import numpy as np
from PIL import Image
p = pathlib.Path(sys.argv[1])
results = []
for tick in (72, 192, 312, 489, 510):
    sizes = {'bloomSmall': (240, 135), 'bloom2': (120, 67), 'post': (480, 270)}
    sizes.update({f'stage{i}': ((120, 67) if i in (5, 7, 9) else (240, 135)) for i in range(10)})
    for name, (w, h) in sizes.items():
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

for tick in (72, 192, 312, 489, 510):
    print('D19_BLOOM_STAGE_SUMMARY', tick, json.dumps([{'pass': row['pass'], 'mae_255': round(row['mae_255'], 4), 'max_255': row['max_255']} for row in results if row['tick'] == tick], separators=(',', ':')), flush=True)

# Probe WebGL's actual 2:1 nearest sampling tie behavior on the original scene.
# Four candidates are evaluated independently; this is diagnostic, not a key.
for tick in (72, 192, 312, 489, 510):
    source = np.fromfile(p / f'original_{tick}.scene.rgba8', dtype=np.uint8).reshape(270, 480, 4)[::-1, :, :3]
    original = np.fromfile(p / f'original_{tick}.stage0.rgba8', dtype=np.uint8).reshape(135, 240, 4)[::-1, :, :3]
    native = np.fromfile(p / f'native_{tick}.stage0.rgba8', dtype=np.uint8).reshape(135, 240, 4)[:, :, :3]
    candidates = []
    for dy in (0, 1):
        for dx in (0, 1):
            c = source[dy::2, dx::2].astype(np.float32) / 255.0
            lum = c @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
            k = np.clip((lum - 0.42) / 0.5, 0, 1)
            k = k * k * (3 - 2 * k)
            expected = np.rint(c * k[:, :, None] * 255).astype(np.int16)
            od = np.abs(original.astype(np.int16) - expected)
            nd = np.abs(native.astype(np.int16) - expected)
            candidates.append({'dx': dx, 'dy': dy, 'original_mae_255': round(float(od.mean()), 4),
                               'native_mae_255': round(float(nd.mean()), 4),
                               'original_exact_rgb': int(np.count_nonzero(np.max(od, axis=2) == 0)),
                               'native_exact_rgb': int(np.count_nonzero(np.max(nd, axis=2) == 0))})
    print('D19_FIRST_SAMPLE_PROBE', tick, json.dumps(candidates, separators=(',', ':')), flush=True)

# Locate large extraction errors and report which of the four neighboring
# source texels best explains the original GPU for those exact pixels.
for tick in (72, 489, 510):
    source = np.fromfile(p / f'original_{tick}.scene.rgba8', dtype=np.uint8).reshape(270, 480, 4)[::-1, :, :3]
    original = np.fromfile(p / f'original_{tick}.stage0.rgba8', dtype=np.uint8).reshape(135, 240, 4)[::-1, :, :3].astype(np.int16)
    native = np.fromfile(p / f'native_{tick}.stage0.rgba8', dtype=np.uint8).reshape(135, 240, 4)[:, :, :3].astype(np.int16)
    error = np.max(np.abs(original - native), axis=2)
    where = np.argwhere(error > 8)
    labels = []
    for y, x in where:
        candidates = []
        for dy in (0, 1):
            for dx in (0, 1):
                c = source[2*y+dy, 2*x+dx].astype(np.float64) / 255.0
                lum = float(c @ np.array([0.2126, 0.7152, 0.0722]))
                k = min(1.0, max(0.0, (lum - 0.42) / 0.5))
                expected = np.rint(c * (k*k*(3-2*k)) * 255).astype(np.int16)
                candidates.append(int(np.abs(original[y, x] - expected).sum()))
        k = int(np.argmin(candidates))
        labels.append((int(x), int(y), k, int(error[y,x])))
    from collections import Counter
    counts = Counter(v[2] for v in labels)
    common_x = Counter(v[0] for v in labels if v[2] != 1).most_common(8)
    common_y = Counter(v[1] for v in labels if v[2] != 1).most_common(8)
    worst = sorted(labels, key=lambda v: -v[3])[:8]
    print('D19_SAMPLE_TIE_MAP', tick, json.dumps({'large_error_pixels':len(labels), 'neighbor_choice_counts_00_01_10_11':dict(counts), 'common_x':common_x, 'common_y':common_y, 'worst_xy_choice_error':worst}, separators=(',', ':')), flush=True)
