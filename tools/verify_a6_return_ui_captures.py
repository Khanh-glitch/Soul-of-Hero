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

Two further refusals, both aimed at "the file exists" being mistaken for "the
screen is right":

* the manifest must name a real display server (not `headless`) and the engine
  must report that each state rendered the card it is named after;
* inside one resolution the four frames must be byte-distinct, so a stuck
  framebuffer that saved the same image four times is rejected.

Usage:
    python3 tools/verify_a6_return_ui_captures.py .artifacts
"""

from __future__ import annotations

import hashlib
import json
import struct
import sys
import zlib
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


CHANNELS = {0: 1, 2: 3, 4: 2, 6: 4}


def png_integrity(path: pathlib.Path) -> str | None:
    """Reject a file that merely *starts* like a PNG.

    A 24-byte header is enough to satisfy a dimension check, so walk the chunk
    structure, verify every CRC, require IEND, and inflate the pixel data to the
    size the header promises. A truncated or half-written screenshot fails here
    instead of being counted as a frame.
    """
    blob = path.read_bytes()
    if blob[:8] != b"\x89PNG\r\n\x1a\n":
        return "not a PNG"
    offset = 8
    header = None
    idat = bytearray()
    while offset + 8 <= len(blob):
        length = struct.unpack(">I", blob[offset : offset + 4])[0]
        tag = blob[offset + 4 : offset + 8]
        body = blob[offset + 8 : offset + 8 + length]
        crc_bytes = blob[offset + 8 + length : offset + 12 + length]
        if len(body) != length or len(crc_bytes) != 4:
            return f"truncated {tag!r} chunk"
        if struct.unpack(">I", crc_bytes)[0] != zlib.crc32(tag + body) & 0xFFFFFFFF:
            return f"bad CRC in {tag!r} chunk"
        if tag == b"IHDR":
            header = struct.unpack(">IIBBBBB", body[:13])
        elif tag == b"IDAT":
            idat += body
        elif tag == b"IEND":
            break
        offset += 12 + length
    else:
        return "no IEND chunk"
    if header is None:
        return "no IHDR chunk"
    width, height, depth, color, _, _, interlace = header
    if depth != 8 or interlace != 0 or color not in CHANNELS:
        return f"unsupported PNG format (depth {depth}, colour {color}, interlace {interlace})"
    try:
        raw = zlib.decompress(bytes(idat))
    except zlib.error as error:
        return f"pixel data does not inflate ({error})"
    expected = height * (1 + width * CHANNELS[color])
    if len(raw) != expected:
        return f"pixel data is {len(raw)} bytes, header promises {expected}"
    return None


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
        renderer = str(manifest.get("renderer", ""))
        if not renderer or renderer == "headless":
            failures.append(f"{resolution}: no real display server (renderer={renderer!r})")
        for error in manifest.get("state_errors", []):
            failures.append(f"{resolution}: {error}")
        if int(manifest.get("saved_count", 0)) != len(STATES):
            failures.append(f"{resolution}: saved {manifest.get('saved_count')} of {len(STATES)} states")
        if manifest.get("overflows"):
            failures.append(f"{resolution}: text overflow reported: {manifest['overflows']}")
        frames = {frame.get("state"): frame for frame in manifest.get("frames", [])}
        digests: dict[str, str] = {}
        for state in STATES:
            png = folder / f"{TAG}_{state}_{width}x{height}.png"
            if not png.is_file():
                failures.append(f"{resolution}/{state}: missing {png.name}")
                continue
            size = png_size(png)
            if size != (width, height):
                failures.append(f"{resolution}/{state}: PNG is {size}, expected {(width, height)}")
                continue
            broken = png_integrity(png)
            if broken:
                failures.append(f"{resolution}/{state}: {broken}")
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
            if frame.get("state_ok") is not True:
                failures.append(f"{resolution}/{state}: engine did not confirm this card rendered")
                continue
            texts = frame.get("texts", [])
            if len(texts) < 3:
                failures.append(f"{resolution}/{state}: only {len(texts)} text boxes audited")
                continue
            if any(not entry.get("inside_screen", False) for entry in texts):
                failures.append(f"{resolution}/{state}: a text box left the viewport")
                continue
            if any(entry.get("overflow", True) for entry in texts):
                failures.append(f"{resolution}/{state}: a text string overflowed its own box")
                continue
            if any(
                float(entry.get("rect", [0, 0, 0, 0])[2]) <= 0 or float(entry.get("rect", [0, 0, 0, 0])[3]) <= 0
                for entry in texts
            ):
                failures.append(f"{resolution}/{state}: a text box has no area to draw into")
                continue
            digests[state] = hashlib.sha256(png.read_bytes()).hexdigest()
            verified += 1
        if len(set(digests.values())) != len(digests):
            failures.append(f"{resolution}: identical frames — a stuck framebuffer is not four states")
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
