"""Compare full original A #11 to real-capture fusion fields, same source tick.

The A reference is not the selected A+C fusion. These linear source-buffer
numbers deliberately exclude C's original post, the world pass and display.
"""
import json
import pathlib
import sys
import numpy as np

p = pathlib.Path(sys.argv[1])
for ref in sorted(p.glob('a11_original_*.rgb32f')):
    tick = int(ref.stem.rsplit('_', 1)[-1])
    data = json.loads((p / f'r17_{tick:03d}.json').read_text())
    def load(q): return np.fromfile(q, dtype='<f4').reshape(-1, 3).astype(np.float64)
    original = load(ref)
    native = load(p / f'r17_{tick:03d}.rgb32f')
    rotor = load(p / f'r17_{tick:03d}.rotor_only32f')
    source_bolts = original - rotor
    native_bolts = native - rotor
    report = {'tick': tick, 'connector_calls': data['trace_count'],
              'original_a_rgb_sum': original.sum(axis=0).tolist(),
              'native_fusion_rgb_sum': native.sum(axis=0).tolist(),
              'rotor_only_rgb_sum': rotor.sum(axis=0).tolist(),
              'original_a_bolt_delta_rgb_sum': source_bolts.sum(axis=0).tolist(),
              'native_c_bolt_delta_rgb_sum': native_bolts.sum(axis=0).tolist(),
              'original_a_max': original.max(axis=0).tolist(),
              'native_fusion_max': native.max(axis=0).tolist(),
              'scope': 'actual full A source vs captured A+C candidate source field at same tick, not Gold fusion or world'}
    (p / f'a11_full_compare_{tick}.json').write_text(json.dumps(report, indent=2) + '\n')
    print('::notice title=R17_FULL_A_VS_FUSION_FIELD::' + json.dumps(report, separators=(',', ':')))
