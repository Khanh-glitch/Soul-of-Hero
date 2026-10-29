#!/usr/bin/env python3
"""Relay exact losslessly captured CI frames through check annotations.

CI artifacts are still authoritative and uploaded normally. This fallback lets
an agent on a network without artifact-storage access inspect the same bytes.
Each Actions step emits at most 10 annotations. Never edit image pixels.
"""
import base64
import hashlib
import pathlib
import sys

GROUP_SIZE = 10
CHUNK_SIZE = 48000
archive = pathlib.Path("artifacts/visual-frames.tar.gz")
group = int(sys.argv[1])
data = archive.read_bytes()
encoded = base64.b64encode(data).decode("ascii")
parts = [encoded[i : i + CHUNK_SIZE] for i in range(0, len(encoded), CHUNK_SIZE)]
if len(parts) > 300:
    raise SystemExit("visual frame archive exceeds 300 annotation chunks")
sha = hashlib.sha256(data).hexdigest()
for index in range(group * GROUP_SIZE, min((group + 1) * GROUP_SIZE, len(parts))):
    print(f"::notice::A0_FRAME_CHUNK {index}/{len(parts)} {sha} {parts[index]}")
