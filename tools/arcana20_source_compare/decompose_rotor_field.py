"""R17 diagnostic only: source-field contribution of #11 rotor vs connectors.

Inputs are the original recorded field and a disposable no-connectors rerender
of the same spell object at the same source tick. This does not alter the
captured world frame and is not a visual candidate or world-linear measurement.
"""
import json
import pathlib
import sys

import numpy as np

root = pathlib.Path(sys.argv[1])
for only_file in sorted(root.glob('r17_*.rotor_only32f')):
    stem = only_file.name.removesuffix('.rotor_only32f')
    data = json.loads((root / (stem + '.json')).read_text())
    full = np.fromfile(root / (stem + '.rgb32f'), dtype='<f4').reshape(-1, 3).astype(np.float64)
    only = np.fromfile(only_file, dtype='<f4').reshape(-1, 3).astype(np.float64)
    delta = full - only
    report = {
        'source_tick': data['source_tick'], 'connector_calls': data['trace_count'],
        'full_rgb_sum': full.sum(axis=0).tolist(), 'rotor_only_rgb_sum': only.sum(axis=0).tolist(),
        'connector_delta_rgb_sum': delta.sum(axis=0).tolist(),
        'negative_delta_pixels': int(np.count_nonzero(np.any(delta < -1e-4, axis=1))),
        'full_max': full.max(axis=0).tolist(), 'rotor_only_max': only.max(axis=0).tolist(),
        'full_nonzero': int(np.count_nonzero(np.any(full > 1e-6, axis=1))),
        'connector_delta_nonzero': int(np.count_nonzero(np.any(delta > 1e-6, axis=1))),
        'scope': 'same-state A source HDR field only; displayed world remains unchanged; excludes source/post/world color management',
    }
    (root / (stem + '.decomposition.json')).write_text(json.dumps(report, indent=2) + '\n')
    print('::notice title=R17_ROTOR_DECOMPOSITION::' + json.dumps(report, separators=(',', ':')))
