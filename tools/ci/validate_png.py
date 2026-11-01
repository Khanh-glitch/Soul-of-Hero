#!/usr/bin/env python3
"""Validate a native capture PNG: right format, big enough, not a flat frame.

Used by the overworld visual-evidence job. Exit 0 = usable evidence,
exit 2 = the file is missing, truncated, undersized or visually empty.

The "not a flat frame" check matters: a camera pointed at the void, or a
renderer that silently produced a background colour, still writes a valid
PNG. Compressed size is a cheap, deterministic proxy for content — a
640x360 flat-colour PNG is a few hundred bytes, while a painted world is
tens of kilobytes.
"""

from __future__ import annotations

import struct
import sys

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MIN_WIDTH = 320
MIN_HEIGHT = 180
MIN_BYTES = 6000


def main(argv: list[str]) -> int:
    # --expect WxH: a "native 2160p" claim is only native if the PNG is 3840x2160.
    # A window clamped to a smaller virtual screen produces a valid, non-flat PNG at
    # the wrong size, which is exactly the evidence that must not be accepted.
    expect: tuple[int, int] | None = None
    rest: list[str] = []
    index = 1
    while index < len(argv):
        if argv[index] == "--expect":
            if index + 1 >= len(argv) or "x" not in argv[index + 1]:
                print("usage: validate_png.py [--expect WxH] <file.png> [min_bytes]")
                return 2
            width_text, height_text = argv[index + 1].split("x", 1)
            expect = (int(width_text), int(height_text))
            index += 2
            continue
        rest.append(argv[index])
        index += 1
    if not rest:
        print("usage: validate_png.py [--expect WxH] <file.png> [min_bytes]")
        return 2
    path = rest[0]
    min_bytes = int(rest[1]) if len(rest) > 1 else MIN_BYTES
    try:
        with open(path, "rb") as handle:
            data = handle.read()
    except OSError as error:
        print(f"MISSING {path}: {error}")
        return 2
    if data[:8] != PNG_SIGNATURE:
        print(f"INVALID PNG signature: {path}")
        return 2
    if len(data) < 33:
        print(f"TRUNCATED PNG ({len(data)} bytes): {path}")
        return 2
    width = struct.unpack(">I", data[16:20])[0]
    height = struct.unpack(">I", data[20:24])[0]
    if width < MIN_WIDTH or height < MIN_HEIGHT:
        print(f"PNG too small {width}x{height}: {path}")
        return 2
    if expect is not None and (width, height) != expect:
        print(f"WRONG RESOLUTION {width}x{height} (expected {expect[0]}x{expect[1]}): {path}")
        return 2
    if len(data) < min_bytes:
        print(f"PNG looks flat ({len(data)} bytes < {min_bytes}): {path}")
        return 2
    print(f"OK {path} ({width}x{height}, {len(data)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
