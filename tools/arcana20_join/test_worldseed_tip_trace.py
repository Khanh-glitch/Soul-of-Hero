"""Synthetic unit tests for the *diagnostic validator*, not game/art evidence."""
import copy
import json
import math
import pathlib
import random
import subprocess
import tempfile
import unittest

VALIDATOR = pathlib.Path(__file__).with_name('inspect_worldseed_tip_trace.py')


def synthetic_trace():
    rng = random.Random(3)
    specs = []
    for layer, count in enumerate((5, 8, 12, 16)):
        for petal in range(count):
            specs.append((layer, petal, rng.uniform(-3, 3),
                          rng.uniform(-100, 100), rng.uniform(-100, 100),
                          rng.uniform(-3, 3), rng.uniform(3, 25), rng.uniform(0, 33)))
    frames = []
    for tick in range(386, 546):
        parts = []
        for layer, petal, direction, x0, y0, angle, length, velocity in specs:
            age = max(0.0, tick/60 - (6.8 + 0.025*((petal+layer*3) % 9)))
            travel = (1-math.exp(-1.3*age))/1.3
            x = x0 + math.cos(direction)*velocity*travel
            y = y0 + math.sin(direction)*velocity*travel + 9*age*age
            spin = (-1 if (petal+layer) % 2 == 0 else 1)*age*(0.35+(petal % 4)*0.12)
            theta = angle + spin
            def smooth(lo, hi, value):
                t = max(0.0, min(1.0, (value-lo)/(hi-lo)))
                return t*t*(3-2*t)
            alpha = smooth(0, 0.16, age)*(1-smooth(1, 2, age))
            dx, dy = math.cos(theta)*length/2, math.sin(theta)*length/2
            parts.append([layer, petal, age, x, y, x-dx, y-dy, x+dx, y+dy, x, y, alpha])
        frames.append({'tick': tick, 'pieces': parts})
    return {'ticks': frames, 'pieces_per_tick': 41, 'source_to_world_scale': 1.0,
            'scope': 'synthetic validator test only'}


class ValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.trace = synthetic_trace()

    def validate(self, trace):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)/'trace.json'
            path.write_text(json.dumps(trace))
            return subprocess.run(['python3', str(VALIDATOR), str(path)], capture_output=True)

    def test_authored_motion_passes(self):
        result = self.validate(self.trace)
        self.assertEqual(result.returncode, 0, result.stderr.decode())

    def test_jump_rejected(self):
        trace = copy.deepcopy(self.trace)
        trace['ticks'][90]['pieces'][0][3] += 10
        self.assertNotEqual(self.validate(trace).returncode, 0)

    def test_wrong_gravity_rejected(self):
        trace = copy.deepcopy(self.trace)
        for frame in trace['ticks']:
            for part in frame['pieces']:
                part[10] -= 18*part[2]**2
        self.assertNotEqual(self.validate(trace).returncode, 0)

    def test_missing_spin_rejected(self):
        trace = copy.deepcopy(self.trace)
        for frame in trace['ticks']:
            for part in frame['pieces']:
                part[7], part[8] = part[5]+1, part[6]
        self.assertNotEqual(self.validate(trace).returncode, 0)


if __name__ == '__main__':
    unittest.main()
