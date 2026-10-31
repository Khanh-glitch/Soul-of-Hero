#!/usr/bin/env python3
"""Publish 1:1 windows of a native frame through annotations.

The artifact host is not reachable from every reviewer's sandbox, and a thumbnail
cannot prove anything about pixels. This cuts small windows out of the untouched
1280x720 capture at the original pixel scale — no resampling — and prints each one
as base64 chunks with its own SHA-256, so what is looked at is exactly what the
engine drew. The full-resolution PNGs remain the canonical artifact.

Windows are emitted in priority order under a hard annotation budget: GitHub keeps
roughly ten notices per step and silently drops the tail, so an over-budget probe
would publish nothing at all. A window that cannot fit its own chunk cap is halved
once, then skipped with a printed note rather than failing the step.
"""
import base64
import hashlib
import io
import pathlib
import sys

from PIL import Image

CHUNK = 2800          # base64 characters per notice (GitHub caps notice length)
CROP_CAP = 4          # chunks a single window may use
BUDGET = 8            # chunks across all windows
NOTICE_CAP = 5        # notices this step may spend

root = pathlib.Path("artifacts")
source = root / "visual_authored_spawn_1280x720.png"
if not source.exists():
    print("A0_FRAME_PROBE absent: no 1280x720 spawn frame to probe")
    raise SystemExit(0)

spent_chunks = 0
spent_notices = 0

with Image.open(source) as image:
    width, height = image.size
    print(f"A0_FRAME_PROBE_SOURCE {source} size={width}x{height} mode={image.mode}")
    windows = [
        # Where the player stands: ground plus whatever represents the avatar.
        ("centre", (width // 2 - 160, height // 2 - 90, width // 2 + 160, height // 2 + 90)),
        # The HUD band along the bottom of the real game screen. Kept narrow so the
        # text-heavy band still fits its chunk cap at 1:1.
        ("hud", (0, height - 100, 480, height)),
        # Authored scenery away from the centre, so terrain is not the only witness.
        ("north_east", (width - 400, height // 4, width - 80, height // 4 + 180)),
    ]
    for name, box in windows:
        if spent_chunks >= BUDGET or spent_notices >= NOTICE_CAP:
            print(f"::notice::A0_FRAME_PROBE_SKIPPED {name} budget_exhausted chunks={spent_chunks} notices={spent_notices}")
            continue
        crop = image.crop(box).convert("RGB")
        data = b""
        for attempt in range(2):
            buf = io.BytesIO()
            crop.save(buf, format="PNG", optimize=True)
            data = buf.getvalue()
            parts = (len(base64.b64encode(data)) + CHUNK - 1) // CHUNK
            if parts <= CROP_CAP:
                break
            # Narrow the window rather than resample it: pixels stay 1:1.
            crop = crop.crop((0, 0, max(96, crop.size[0] * 3 // 4), crop.size[1]))
            print(f"::notice::A0_FRAME_PROBE_SHRANK {name} attempt={attempt + 1} to={crop.size} chunks={parts}")
        if parts > CROP_CAP:
            print(f"::notice::A0_FRAME_PROBE_SKIPPED {name} chunks={parts} cap={CROP_CAP}")
            continue
        if spent_chunks + parts > BUDGET:
            print(f"::notice::A0_FRAME_PROBE_SKIPPED {name} chunks={parts} budget={BUDGET}")
            continue
        digest = hashlib.sha256(data).hexdigest()
        encoded = base64.b64encode(data).decode("ascii")
        print(
            f"A0_FRAME_PROBE window={name} box={box} size={crop.size} "
            f"png_bytes={len(data)} sha256={digest} chunks={parts}"
        )
        for index in range(parts):
            print(f"::notice::A0_FRAME_PROBE_PNG {name} {index}/{parts} {digest} {encoded[index * CHUNK:(index + 1) * CHUNK]}")
        spent_chunks += parts
        spent_notices += parts
