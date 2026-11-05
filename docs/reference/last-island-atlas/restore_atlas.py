#!/usr/bin/env python3
"""Restore the creator-supplied Atlas v1–v11 ZIP from Git-tracked Base64 parts.

No non-stdlib dependencies. Run from the repository root:
  python3 docs/reference/last-island-atlas/restore_atlas.py
  python3 docs/reference/last-island-atlas/restore_atlas.py --extract
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path
import zipfile

HERE = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extract", action="store_true", help="Extract top-level archive members after verification")
    args = parser.parse_args()
    meta = json.loads((HERE / "SOURCE_MANIFEST.json").read_text(encoding="utf-8"))
    part_dir = HERE / "source"
    encoded = "".join(
        (part_dir / part).read_text(encoding="ascii").strip()
        for part in meta["recovery_order"]
    )
    data = base64.b64decode(encoded, validate=True)
    digest = hashlib.sha256(data).hexdigest()
    assert len(data) == meta["archive_size_bytes"], "Atlas byte-length mismatch"
    assert digest == meta["archive_sha256"], "Atlas SHA-256 mismatch"
    target = HERE / meta["archive_name"]
    target.write_bytes(data)
    with zipfile.ZipFile(target) as z:
        first_bad = z.testzip()
        assert first_bad is None, f"Atlas ZIP CRC check failed: {first_bad}"
        names = z.namelist()
        print(f"Verified {target}: {len(data)} bytes / sha256 {digest} / {len(names)} members")
        if args.extract:
            out = HERE / "extracted_full"
            out.mkdir(exist_ok=True)
            for member in z.infolist():
                entry = Path(member.filename)
                assert not entry.is_absolute() and ".." not in entry.parts, "Unsafe ZIP member"
                assert not member.is_dir() or entry.name, "Malformed directory name"
                dest = (out / entry).resolve()
                assert dest.is_relative_to(out.resolve()), "Unsafe archive path"
                if member.is_dir():
                    dest.mkdir(parents=True, exist_ok=True)
                else:
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(z.read(member))
            print(f"Extracted {len(names)} top-level ZIP entries to {out}")
    print("Nested v10/v11 ZIPs and XLSX workbooks remain byte-identical inside the verified original archive.")


if __name__ == "__main__":
    main()
