#!/usr/bin/env python3
"""Publish review thumbnails of the R13 authored-continent frames via annotations.

The untouched full-resolution PNGs stay in the CI artifact (and in
`artifacts/visual_authored_*.png`). This produces a deliberately downscaled, lossy
JPEG contact sheet so a reviewer whose sandbox cannot reach the artifact host can
still see *something* — and the thumbnails say which original each came from.

Detail acceptance still requires the original frames: a 640x360 thumbnail cannot
prove a readable HUD at 2160p.
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
NAMES = ("spawn", "walk", "terrain", "source", "source_after_g")
RESOLUTIONS = ("1280x720", "2560x1440", "3840x2160")

root = pathlib.Path("artifacts")
archive = root / "authored-visual-review-thumbnails.tar.gz"
group = int(sys.argv[1])
if group == 0:
    paths = [
        root / f"visual_authored_{name}_{resolution}.png"
        for resolution in RESOLUTIONS
        for name in NAMES
        if (root / f"visual_authored_{name}_{resolution}.png").exists()
    ]
    if not paths:
        raise SystemExit("no authored frames found; nothing to publish")
    for quality in (65, 50, 40, 30):
        with tarfile.open(archive, "w:gz") as tar:
            for path in paths:
                with Image.open(path) as image:
                    image.thumbnail((640, 360), Image.Resampling.NEAREST)
                    buf = io.BytesIO()
                    image.convert("RGB").save(buf, format="JPEG", quality=quality, optimize=True)
                data = buf.getvalue()
                # The file name already carries the resolution it was captured at.
                info = tarfile.TarInfo(f"{path.stem}_review.jpg")
                info.size = len(data)
                tar.addfile(info, io.BytesIO(data))
        if len(base64.b64encode(archive.read_bytes())) <= MAX_PARTS * CHUNK_SIZE:
            break
    else:
        raise SystemExit("review thumbnails exceed the bounded annotation budget")
data = archive.read_bytes()
encoded = base64.b64encode(data).decode("ascii")
parts = [encoded[i : i + CHUNK_SIZE] for i in range(0, len(encoded), CHUNK_SIZE)]
sha = hashlib.sha256(data).hexdigest()
for index in range(group * GROUP_SIZE, min((group + 1) * GROUP_SIZE, len(parts))):
    print(f"::notice::A0_AUTHORED_REVIEW_THUMBNAILS {index}/{len(parts)} {sha} {parts[index]}")
