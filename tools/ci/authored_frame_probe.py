#!/usr/bin/env python3
"""Publish one 1:1 crop of a native frame through annotations.

The artifact host is not reachable from every reviewer's sandbox, and a thumbnail
cannot prove anything about pixels. This cuts a small window out of the untouched
1280x720 capture at the original pixel scale — no resampling — and prints it as
base64 chunks with its own SHA-256, so what is looked at is exactly what the engine
drew. The full-resolution PNGs remain the canonical artifact.
"""
import base64
import hashlib
import io
import pathlib
import sys

from PIL import Image

CHUNK = 2800
MAX_CHUNKS = 8
root = pathlib.Path("artifacts")
source = root / "visual_authored_spawn_1280x720.png"
if not source.exists():
    raise SystemExit("no 1280x720 spawn frame to probe")

with Image.open(source) as image:
    width, height = image.size
    # The window around the camera centre: where the player and the ground are.
    box = (width // 2 - 80, height // 2 - 45, width // 2 + 80, height // 2 + 45)
    crop = image.crop(box).convert("RGB")

buf = io.BytesIO()
crop.save(buf, format="PNG", optimize=True)
data = buf.getvalue()
digest = hashlib.sha256(data).hexdigest()
encoded = base64.b64encode(data).decode("ascii")
parts = [encoded[i : i + CHUNK] for i in range(0, len(encoded), CHUNK)]
print(f"A0_FRAME_PROBE box={box} size={crop.size} png_bytes={len(data)} sha256={digest} chunks={len(parts)}")
if len(parts) > MAX_CHUNKS:
    raise SystemExit(f"probe crop needs {len(parts)} chunks, budget is {MAX_CHUNKS}")
for index, part in enumerate(parts):
    print(f"::notice::A0_FRAME_PROBE_PNG {index}/{len(parts)} {digest} {part}")
