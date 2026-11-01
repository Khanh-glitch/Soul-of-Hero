"""Spatial report of C original and density adaptation vs native channel.

Inputs are C 384x216 RGBA32F and native A 416x234 RGB32F. Compare common
coordinates, not linear strides. Report all mismatches, MAE, max and IoU;
this comparison deliberately does not claim full fusion/world fidelity.
"""
import json
import pathlib
import sys
import numpy as np
p = pathlib.Path(sys.argv[1]); reports = []
for j in sorted(p.glob('r17_*.json')):
    nat = j.with_suffix('.native.rgb32f')
    if not nat.exists(): continue
    b = np.fromfile(nat, '<f4').reshape(234, 416, 3)[:216, :384]
    data = json.loads(j.read_text())
    for kind in ('c-original', 'c-adapted'):
        ref = j.with_suffix('.' + kind + '.rgba32f')
        if not ref.exists(): continue
        a = np.fromfile(ref, '<f4').reshape(216, 384, 4)[:, :, :3]
        # Strict nonzero support. No image brightness key, alpha threshold or
        # hidden cropping is used; common domain excludes A-only margins.
        am = np.any(a != 0, axis=2); bm = np.any(b != 0, axis=2)
        union = np.count_nonzero(am | bm); intersection = np.count_nonzero(am & bm)
        d = np.abs(a.astype('float64') - b.astype('float64'))
        report = {'source_tick': data['source_tick'], 'skill': data['skill'], 'reference':kind,
                  'fusion_branch_count':data['chosen_bolt']['branch_count'],
                  'reference_pixels': int(am.sum()), 'native_pixels': int(bm.sum()),
                  'intersection_pixels': int(intersection), 'union_pixels': int(union),
                  'support_iou': float(intersection / union) if union else None,
                  'rgb_mae_common_frame': float(d.mean()), 'rgb_max': float(d.max()),
                  'rgb_unequal_values': int(np.count_nonzero(d)),
                  'domain': 'common C 384x216 coordinates; A-only margins excluded',
                  'scope': 'one channel, original C palette and k=1, captured moving endpoints; not full fusion/world'}
        reports.append(report)
        print('::notice title=R17_C_CHANNEL_COMPARE::' + json.dumps(report, separators=(',', ':')))
if not reports: raise SystemExit('no captured comparisons')
(p / 'c09-channel-spatial-report.json').write_text(json.dumps(reports, indent=2) + '\n')
