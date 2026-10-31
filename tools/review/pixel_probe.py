#!/usr/bin/env python3
"""Read, composite and inspect PNG art without image libraries.

Everything here is used for *review*: decoding source pixels, measuring sheets,
building contact sheets so a human can look at them, and checking the transparency
a nine-slice or icon atlas needs. It never authors game art - it only reads it.

The project has no Pillow on the CI image and the review sandbox cannot install one
for the hosted runner, so the PNG reader is small and strict: 8-bit RGBA only, no
interlace, all five filter types.
"""

from __future__ import annotations

import pathlib
import struct
import zlib

SIG = b"\x89PNG\r\n\x1a\n"


def decode(path: str | pathlib.Path) -> tuple[int, int, bytearray]:
    """Decode an 8-bit RGBA PNG into a flat RGBA bytearray."""
    return decode_bytes(pathlib.Path(path).read_bytes(), str(path))


def decode_bytes(blob: bytes, label: str = "png") -> tuple[int, int, bytearray]:
    """Decode an 8-bit RGBA PNG already in memory (used for ZIP members)."""
    path = label
    if blob[:8] != SIG:
        raise ValueError(f"{path}: not a PNG")
    offset = 8
    idat = bytearray()
    width = height = 0
    while offset + 12 <= len(blob):
        length = struct.unpack(">I", blob[offset : offset + 4])[0]
        kind = blob[offset + 4 : offset + 8]
        body = blob[offset + 8 : offset + 8 + length]
        if len(body) != length:
            raise ValueError(f"{path}: truncated {kind!r} chunk")
        if kind == b"IHDR":
            width, height, depth, colour, _, _, interlace = struct.unpack(">IIBBBBB", body[:13])
            if (depth, colour, interlace) != (8, 6, 0):
                raise ValueError(f"{path}: expected RGBA8 non-interlaced, got depth={depth} colour={colour}")
        elif kind == b"IDAT":
            idat += body
        elif kind == b"IEND":
            break
        offset += 12 + length
    raw = zlib.decompress(bytes(idat))
    stride = width * 4
    out = bytearray(width * height * 4)
    previous = bytearray(stride)
    pos = 0
    for y in range(height):
        filter_type = raw[pos]
        pos += 1
        line = bytearray(raw[pos : pos + stride])
        pos += stride
        if filter_type == 1:
            for x in range(4, stride):
                line[x] = (line[x] + line[x - 4]) & 0xFF
        elif filter_type == 2:
            for x in range(stride):
                line[x] = (line[x] + previous[x]) & 0xFF
        elif filter_type == 3:
            for x in range(stride):
                a = line[x - 4] if x >= 4 else 0
                line[x] = (line[x] + ((a + previous[x]) >> 1)) & 0xFF
        elif filter_type == 4:
            for x in range(stride):
                a = line[x - 4] if x >= 4 else 0
                b = previous[x]
                c = previous[x - 4] if x >= 4 else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if (pa <= pb and pa <= pc) else (b if pb <= pc else c))) & 0xFF
        out[y * stride : (y + 1) * stride] = line
        previous = line
    return width, height, out


def encode(path: str | pathlib.Path, width: int, height: int, rgba: bytearray) -> None:
    """Write a flat RGBA bytearray as an 8-bit RGBA PNG."""
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw += rgba[y * stride : (y + 1) * stride]

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    payload = SIG + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    payload += chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    pathlib.Path(path).write_bytes(payload)


def opaque_bounds(rgba: bytearray, width: int, height: int, box: tuple[int, int, int, int] | None = None):
    """Tight bounding box of non-transparent pixels inside `box` (x, y, w, h)."""
    x0, y0, bw, bh = box or (0, 0, width, height)
    minx = miny = None
    maxx = maxy = -1
    for y in range(y0, y0 + bh):
        row = y * width * 4
        for x in range(x0, x0 + bw):
            if rgba[row + x * 4 + 3] > 8:
                minx = x if minx is None else min(minx, x)
                miny = y if miny is None else min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if minx is None:
        return None
    return (minx, miny, maxx - minx + 1, maxy - miny + 1)


def alpha_stats(rgba: bytearray, width: int, height: int) -> dict:
    total = width * height
    opaque = translucent = 0
    colours: set[int] = set()
    for i in range(0, len(rgba), 4):
        a = rgba[i + 3]
        if a == 255:
            opaque += 1
        elif a > 0:
            translucent += 1
        colours.add((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2])
    return {
        "pixels": total,
        "opaque": opaque,
        "translucent": translucent,
        "transparent": total - opaque - translucent,
        "distinct_rgb": len(colours),
        "has_alpha": (opaque + translucent) < total,
    }


def blit(dst: bytearray, dw: int, dh: int, src: bytearray, sw: int, sh: int, dx: int, dy: int, scale: int = 1) -> None:
    """Alpha-composite `src` onto `dst` at (dx, dy), optionally nearest-neighbour scaled."""
    for y in range(sh):
        for x in range(sw):
            si = (y * sw + x) * 4
            alpha = src[si + 3]
            if alpha == 0:
                continue
            r, g, b = src[si], src[si + 1], src[si + 2]
            for oy in range(scale):
                for ox in range(scale):
                    tx, ty = dx + x * scale + ox, dy + y * scale + oy
                    if not (0 <= tx < dw and 0 <= ty < dh):
                        continue
                    di = (ty * dw + tx) * 4
                    if alpha == 255:
                        dst[di : di + 4] = bytes((r, g, b, 255))
                    else:
                        f = alpha / 255.0
                        dst[di] = int(r * f + dst[di] * (1 - f))
                        dst[di + 1] = int(g * f + dst[di + 1] * (1 - f))
                        dst[di + 2] = int(b * f + dst[di + 2] * (1 - f))
                        dst[di + 3] = 255


def checker(width: int, height: int, a: int = 176, b: int = 208, size: int = 8) -> bytearray:
    canvas = bytearray(width * height * 4)
    for y in range(height):
        for x in range(width):
            value = a if ((x // size + y // size) % 2 == 0) else b
            i = (y * width + x) * 4
            canvas[i : i + 4] = bytes((value, value, value, 255))
    return canvas


def solid(width: int, height: int, rgb: tuple[int, int, int]) -> bytearray:
    canvas = bytearray(width * height * 4)
    for i in range(0, len(canvas), 4):
        canvas[i : i + 4] = bytes((rgb[0], rgb[1], rgb[2], 255))
    return canvas
