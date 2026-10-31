#!/usr/bin/env python3
"""Report, not gate, RGB spatial deltas for D FX-only browser vs native.

The browser image suppresses floor/markers but includes WebGL bloom and post;
the native framebuffer has a different compositor and alpha semantics. RGB>0
is a diagnostic non-black mask only, never a runtime transparency key. These
measurements do NOT prove or certify parity and no tolerance is chosen to pass.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
refdir = ROOT / 'prototypes/arcana_fusion20/renderer/source_d/reference'
out = ROOT / 'prototypes/arcana_fusion20/renderer/evidence_out/review/skill_19'
files = sorted(out.glob('native_t*.png'))
if not files:
    raise SystemExit('No D native comparison captures found')
results = {}
for native in files:
    key = native.stem.removeprefix('native_')
    reference = refdir / f'fx-only_{key}.png'
    if not reference.exists():
        raise SystemExit(f'Missing reference {reference}')
    a = Image.open(reference).convert('RGB')
    b = Image.open(native).convert('RGB')
    if a.size != b.size or a.size != (480, 270):
        raise SystemExit(f'Dimension mismatch: {reference} {a.size}, {native} {b.size}')
    width, height = a.size
    pixels_a, pixels_b = a.load(), b.load()
    heat = Image.new('RGB', a.size)
    hp = heat.load()
    inter = union = total = maximum = 0
    regions = [[{'sum': 0, 'n': 0} for _ in range(4)] for _ in range(4)]
    for y in range(height):
        for x in range(width):
            ca, cb = pixels_a[x, y], pixels_b[x, y]
            has_a, has_b = any(ca), any(cb)
            inter += has_a and has_b
            union += has_a or has_b
            errors = [abs(ca[i] - cb[i]) for i in range(3)]
            err = max(errors)
            total += sum(errors)
            maximum = max(maximum, err)
            cell = regions[min(3, y * 4 // height)][min(3, x * 4 // width)]
            cell['sum'] += sum(errors)
            cell['n'] += 3
            hp[x, y] = (255, 0, 0) if has_b and not has_a else ((0, 0, 255) if has_a and not has_b else (err, err, err))
    heat.save(out / f'diff_{key}.png')
    result = {'rgb_mae': total / (width * height * 3), 'rgb_max_error': maximum,
              'nonblack_mask_iou': inter / union if union else 1.0,
              'region_mae_4x4': [[c['sum'] / c['n'] for c in row] for row in regions]}
    results[key] = result
    print(f"D_DIAGNOSTIC {key} RGB_MAE={result['rgb_mae']:.4f} max={maximum} nonblack_IoU={result['nonblack_mask_iou']:.4f}")
(out / 'd_comparison.json').write_text(json.dumps({'comparison': 'diagnostic only; post/alpha differences; NOT PARITY PASS', 'results': results}, indent=2))
