#!/usr/bin/env python3
"""Verify the mandatory survival return UI capture set.

The A6 return UI is only visually accepted when four states — digest, guidance,
history and empty-owner-data — exist at 1280x720, 2560x1440 and 3840x2160. This
script checks each of those twelve files **individually**, against its own
manifest, including dimensions and a non-blank verdict computed by the engine.

It also refuses substitution: a frame only counts when its filename carries the
return-UI tag, so a directory full of avatar captures can never satisfy this gate.
CraftPix/avatar PNGs and preview fixtures are not evidence of real offline
production.

Usage:
    python3 tools/verify_a6_return_ui_captures.py .artifacts
"""

from __future__ import annotations

import json
import struct
import sys
import pathlib

RESOLUTIONS = {
    "1280x720": (1280, 720),
    "2560x1440": (2560, 1440),
    "3840x2160": (3840, 2160),
}
STATES = ["digest", "guidance", "history", "empty"]
TAG = "return_preview"
REQUIRED_FILES = len(RESOLUTIONS) * len(STATES)


def png_size(path: pathlib.Path) -> tuple[int, int] | None:
    head = path.read_bytes()[:24]
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    width, height = struct.unpack(">II", head[16:24])
    return width, height


def verify(root: pathlib.Path) -> list[str]:
    failures: list[str] = []
    verified = 0
    for resolution, (width, height) in RESOLUTIONS.items():
        folder = root / f"captures-{resolution}"
        manifest_path = folder / f"{TAG}_manifest_{width}x{height}.json"
        if not manifest_path.is_file():
            failures.append(f"{resolution}: missing manifest {manifest_path}")
            continue
        try:
            manifest = json.loads(manifest_path.read_text())
        except json.JSONDecodeError as error:
            failures.append(f"{resolution}: unreadable manifest ({error})")
            continue
        if manifest.get("resolution") != f"{width}x{height}":
            failures.append(f"{resolution}: manifest declares {manifest.get('resolution')}")
        if manifest.get("data") != "preview_fixture":
            failures.append(f"{resolution}: manifest does not declare preview fixtures")
        if manifest.get("backdrop") != "layer_only":
            failures.append(f"{resolution}: unexpected backdrop {manifest.get('backdrop')}")
        if int(manifest.get("saved_count", 0)) != len(STATES):
            failures.append(f"{resolution}: saved {manifest.get('saved_count')} of {len(STATES)} states")
        if manifest.get("overflows"):
            failures.append(f"{resolution}: text overflow reported: {manifest['overflows']}")
        frames = {frame.get("state"): frame for frame in manifest.get("frames", [])}
        for state in STATES:
            png = folder / f"{TAG}_{state}_{width}x{height}.png"
            if not png.is_file():
                failures.append(f"{resolution}/{state}: missing {png.name}")
                continue
            size = png_size(png)
            if size != (width, height):
                failures.append(f"{resolution}/{state}: PNG is {size}, expected {(width, height)}")
                continue
            frame = frames.get(state)
            if not frame:
                failures.append(f"{resolution}/{state}: no manifest entry")
                continue
            if TAG not in pathlib.Path(frame.get("file", "")).name:
                failures.append(f"{resolution}/{state}: manifest points at a non-return frame")
                continue
            if not frame.get("saved"):
                failures.append(f"{resolution}/{state}: engine reported the frame was not saved")
                continue
            if not frame.get("non_blank"):
                failures.append(f"{resolution}/{state}: frame is blank")
                continue
            texts = frame.get("texts", [])
            if len(texts) < 3:
                failures.append(f"{resolution}/{state}: only {len(texts)} text boxes audited")
                continue
            if any(not entry.get("inside_screen", False) for entry in texts):
                failures.append(f"{resolution}/{state}: a text box left the viewport")
                continue
            verified += 1
    if verified != REQUIRED_FILES:
        failures.append(f"verified {verified} of {REQUIRED_FILES} required frames")
    return failures


def main(argv: list[str]) -> int:
    root = pathlib.Path(argv[1] if len(argv) > 1 else ".artifacts")
    if not root.is_dir():
        print(f"FAIL: {root} is not a directory")
        return 1
    failures = verify(root)
    for failure in failures:
        print(f"FAIL {failure}")
    if failures:
        print(f"RETURN UI CAPTURES REJECTED ({len(failures)} problems)")
        return 1
    print(f"RETURN UI CAPTURES VERIFIED ({REQUIRED_FILES} frames, {len(RESOLUTIONS)} resolutions)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
