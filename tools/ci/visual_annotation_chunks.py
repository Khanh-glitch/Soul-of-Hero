#!/usr/bin/env python3
"""Publish clearly-labelled review thumbnails from native captures via annotations.

The original, unaltered full-resolution PNGs remain the canonical CI artifacts.
Network-restricted reviewers can reconstruct a deliberately downscaled/JPEG
contact of individual named files (not synthesized imagery); detail acceptance
still requires original frames. Limit to 45 notices per check run.
"""
import base64
import hashlib
import io
import pathlib
import sys
import tarfile

from PIL import Image

GROUP_SIZE = 9
CHUNK_SIZE = 3500
MAX_PARTS = 45
root = pathlib.Path("artifacts")
archive = root / "visual-review-thumbnails.tar.gz"
group = int(sys.argv[1])
if group == 0:
    paths = [root / ("visual_" + name + ".png") for name in
             ("fresh_world", "economy", "build", "roof_outside", "roof_inside", "roof_adjacent")]
    if not all(path.exists() for path in paths):
        raise SystemExit("native frames missing; cannot assemble review thumbnails")
    for quality in (65, 50, 40, 30):
        with tarfile.open(archive, "w:gz") as tar:
            for path in paths:
                with Image.open(path) as image:
                    image.thumbnail((640, 360), Image.Resampling.NEAREST)
                    buf = io.BytesIO()
                    image.convert("RGB").save(buf, format="JPEG", quality=quality, optimize=True)
                data = buf.getvalue()
                info = tarfile.TarInfo(path.stem + "_review.jpg")
                info.size = len(data)
                tar.addfile(info, io.BytesIO(data))
        if len(base64.b64encode(archive.read_bytes())) <= MAX_PARTS * CHUNK_SIZE:
            break
    else:
        raise SystemExit("review thumbnails exceed bounded annotation budget")
data = archive.read_bytes()
encoded = base64.b64encode(data).decode("ascii")
parts = [encoded[i : i + CHUNK_SIZE] for i in range(0, len(encoded), CHUNK_SIZE)]
sha = hashlib.sha256(data).hexdigest()
for index in range(group * GROUP_SIZE, min((group + 1) * GROUP_SIZE, len(parts))):
    print(f"::notice::A0_REVIEW_THUMBNAILS {index}/{len(parts)} {sha} {parts[index]}")
