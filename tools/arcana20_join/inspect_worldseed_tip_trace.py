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
minimum_gravity = math.inf
scale = float(trace['source_to_world_scale'])
assert scale > 0.0
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
    spin = math.atan2(math.sin(angle1-angle0), math.cos(angle1-angle0))
    minimum_spin = min(minimum_spin, abs(spin))
    expected_spin = (-1.0 if (key[0] + key[1]) % 2 == 0 else 1.0) * b[2] * (0.35 + (key[1] % 4) * 0.12)
    spin_error = math.atan2(math.sin(spin-expected_spin), math.cos(spin-expected_spin))
    assert abs(spin_error) < 0.001, (key, spin, expected_spin)
    # Net acceleration can point UP while drag opposes an initially downward
    # velocity. Fit the authored exponential drag and quadratic gravity over
    # widely separated samples instead of incorrectly demanding a positive
    # second difference at every tick. Gravity must be world-down and equal
    # to the source's 9*age² transformed by the real source-to-world scale.
    flight = [p for p in motion if 0.2 <= p[2] <= 1.8]
    assert len(flight) > 40
    a, b, c = flight[0], flight[len(flight)//2], flight[-1]
    travel = lambda t: (1.0-math.exp(-1.3*t))/1.3
    q1 = travel(b[2])-travel(a[2])
    q2 = travel(c[2])-travel(b[2])
    ratio = q2/q1
    denominator = (c[2]**2-b[2]**2)-ratio*(b[2]**2-a[2]**2)
    gravity = ((c[10]-b[10])-ratio*(b[10]-a[10]))/denominator
    minimum_gravity = min(minimum_gravity, gravity)
    assert abs(gravity-9.0*scale) < 0.02, (key, gravity, scale)
assert maximum_step < 2.0, maximum_step
print('F16_TIP_TRACE_PASS', json.dumps({'tips': len(pieces), 'tick_start': frames[0]['tick'],
      'tick_end': frames[-1]['tick'], 'max_source_px_step': maximum_step,
      'minimum_rotation_radians': minimum_spin, 'minimum_world_gravity_coefficient': minimum_gravity, 'scope': trace['scope']}))
