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
    if len(argv) < 2:
        print("usage: validate_png.py <file.png> [min_bytes]")
        return 2
    path = argv[1]
    min_bytes = int(argv[2]) if len(argv) > 2 else MIN_BYTES
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
    if len(data) < min_bytes:
        print(f"PNG looks flat ({len(data)} bytes < {min_bytes}): {path}")
        return 2
    print(f"OK {path} ({width}x{height}, {len(data)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
