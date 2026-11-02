"""Verify a non-shipping real-world #16 single-source-tick diagnostic trace.

This is a numeric continuity aid, not art approval or a device-performance
claim. Natural moving-camera footage must be reviewed separately.
"""
import json
import math
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
trace = json.loads(path.read_text())
frames = trace['ticks']
assert len(frames) >= 145 and trace['pieces_per_tick'] == 41
assert all(b['tick'] == a['tick'] + 1 for a, b in zip(frames, frames[1:]))
pieces = {}
for frame in frames:
    assert len(frame['pieces']) == 41
    for piece in frame['pieces']:
        assert len(piece) == 12 and all(math.isfinite(float(v)) for v in piece)
        pieces.setdefault((piece[0], piece[1]), []).append(piece)
assert len(pieces) == 41
maximum_step = 0.0
minimum_spin = math.inf
for key, motion in sorted(pieces.items()):
    assert len(motion) == len(frames)
    assert motion[0][2] == 0.0 and motion[-1][2] >= 2.0, key
    assert abs(motion[0][11]) < 1e-6 and abs(motion[-1][11]) < 1e-6, key
    assert max(p[11] for p in motion) > 0.99, key
    for a, b in zip(motion, motion[1:]):
        assert b[2] >= a[2]
        maximum_step = max(maximum_step, math.hypot(b[3]-a[3], b[4]-a[4]),
                           math.hypot(b[5]-a[5], b[6]-a[6]),
                           math.hypot(b[7]-a[7], b[8]-a[8]))
        if a[2] >= 1.0: assert b[11] <= a[11] + 1e-6, key
    # Signed rotation through the full flight; both endpoint vectors come
    # directly from the individual seeded source-surface ribbon pose.
    a, b = motion[0], motion[-1]
    angle0 = math.atan2(a[8]-a[6], a[7]-a[5])
    angle1 = math.atan2(b[8]-b[6], b[7]-b[5])
    spin = abs(math.atan2(math.sin(angle1-angle0), math.cos(angle1-angle0)))
    minimum_spin = min(minimum_spin, spin)
    assert spin > 1.0, (key, spin)
    # Downward acceleration in world coordinates: use an interior flight
    # region, where the source's deterministic drag and gravity both act.
    flight = [p for p in motion if 0.2 <= p[2] <= 1.8]
    assert len(flight) > 40
    for a, b, c in zip(flight, flight[1:], flight[2:]):
        assert c[10] - 2*b[10] + a[10] > -0.001, key
assert maximum_step < 2.0, maximum_step
print('F16_TIP_TRACE_PASS', json.dumps({'tips': len(pieces), 'tick_start': frames[0]['tick'],
      'tick_end': frames[-1]['tick'], 'max_source_px_step': maximum_step,
      'minimum_rotation_radians': minimum_spin, 'scope': trace['scope']}))
