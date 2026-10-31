#!/usr/bin/env python3
"""Expose small review thumbnails through Actions annotations as well as artifacts.

Useful in constrained environments where the artifact download redirect is
unreachable. These are low-color thumbnails for triage, never parity inputs.
"""
import base64
import io
from pathlib import Path
import sys
from PIL import Image

mode = sys.argv[1]
root = Path('prototypes/arcana_fusion20/renderer/evidence_out')
if mode == 'source':
    paths = sorted((root / 'review').glob('skill_*_sheet.png'))
elif mode == 'scene':
    paths = sorted((root / 'real-scene').glob('skill_*_1.png'))
else:
    raise SystemExit('expected source or scene')
if len(sys.argv) == 4:
    start, end = int(sys.argv[2]), int(sys.argv[3])
    paths = paths[start:end]
for path in paths:
    with Image.open(path) as image:
        image.thumbnail((432, 243), Image.Resampling.NEAREST)
        image = image.convert('RGB').quantize(colors=32, method=Image.Quantize.MEDIANCUT)
        buf = io.BytesIO()
        image.save(buf, format='PNG', optimize=True)
        data = base64.b64encode(buf.getvalue()).decode('ascii')
        if len(data) > 48000:
            raise SystemExit(f'{path}: annotation too large: {len(data)}')
        print(f'::notice title=REVIEW_{mode.upper()}_{path.stem}::{data}', flush=True)
print(f'Emitted {len(paths)} {mode} diagnostic thumbnails')
