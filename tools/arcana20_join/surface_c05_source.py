"""Preview independent C05 ink + light fields over a neutral black source.
No source floor, viewport post, SOH world, or camera is present. Original
and native fields come from the existing same-seed/same-tick comparison.
"""
import math
import pathlib
import struct
import sys
from PIL import Image

root, out = map(pathlib.Path, sys.argv[1:3])
out.mkdir(parents=True, exist_ok=True)
w, h = 384, 216
bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
for tick in (336, 348, 372, 420):
    for who in ('original', 'native'):
        def field(kind):
            files = list(root.rglob(f'{who}_{tick}.{kind}32f'))
            if len(files) != 1:
                raise SystemExit(f'expected one {who} {tick} {kind} field; found {len(files)}')
            data = files[0].read_bytes()
            return struct.unpack(f'<{w*h*4}f', data)
        ink, light = field('ink'), field('light')
        pixels = bytearray(w*h*3)
        for y in range(h):
            for x in range(w):
                i = (y*w+x)*4
                th = (bayer[(y & 3)*4+(x & 3)] + 0.5) / 16.0 - 0.5
                col = [ink[i+c] + math.floor(light[i+c]*8.0 + th + 0.5)/8.0 for c in range(3)]
                over = sum(max(v-1.0, 0.0) for v in col)*0.45
                for c in range(3):
                    pixels[(y*w+x)*3+c] = int(min(1.0, max(0.0, col[c]+over))*255.0)
        Image.frombytes('RGB', (w, h), bytes(pixels)).save(out/f'c_{who}_{tick}.png')
print('C05 ink+light source-only previews: no ground, displacement, flash, bloom, camera or live world')
