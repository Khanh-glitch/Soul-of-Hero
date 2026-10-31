#!/usr/bin/env python3
"""Stage only the approved, selected A6 base-avatar sheets outside Git.

The input ZIPs must stay outside the repository. The output is ignored private
workspace art for a local Godot preview/build; never commit or re-export these
files as standalone assets. This tool does not download art or call AI services.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import sys
import zipfile
import xml.etree.ElementTree as ET
import zlib

EXPECTED = {
    "male": {
        "craftpix_id": "555940",
        "sha256": "b5579a3cc6006ef8c9d55c9ca0388575d75c987382b6cb504e2c7519e6c1e795",
        "archive": "craftpix-net-555940-free-base-4-direction-male-character-pixel-art.zip",
        "drive_id": "1CuSQ3pr75U1l1Ep8FIDexQlMr8fO3qGb",
    },
    "female": {
        "craftpix_id": "419402",
        "sha256": "f704e7852273d5f0111435ae86975fa981354d699dff1f594934f6a32d9821ad",
        "archive": "craftpix-net-419402-free-base-4-direction-female-character-pixel-art.zip",
        "drive_id": "1o5hRVbPZjZxcPGwP5coPDHZARbAej75o",
    },
}
DIRECTIONS = {"front": 0, "side_left": 1, "side_right": 2, "back": 3}
# Only the approved grade-zero identities and source animation sets are staged.
SHEETS = {
    "idle": ("PNG/Unarmed/Without_shadow/Unarmed_Idle_without_shadow.png", 12, True),
    "walk": ("PNG/Unarmed/Without_shadow/Unarmed_Walk_without_shadow.png", 6, True),
    "run": ("PNG/Unarmed/Without_shadow/Unarmed_Run_without_shadow.png", 8, True),
    "hurt": ("PNG/Unarmed/Without_shadow/Unarmed_Hurt_without_shadow.png", 5, False),
    "death": ("PNG/Unarmed/Without_shadow/Unarmed_Death_without_shadow.png", 7, False),
    "attack": ("PNG/Sword/Without_shadow/Sword_attack_without_shadow.png", 8, False),
    "walk_attack": ("PNG/Sword/Without_shadow/Sword_Walk_Attack_without_shadow.png", 6, False),
    "run_attack": ("PNG/Sword/Without_shadow/Sword_Run_Attack_without_shadow.png", 8, False),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def png_dimensions(data: bytes, label: str) -> tuple[int, int]:
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError(f"{label}: source member is not a valid PNG")
    return struct.unpack(">II", data[16:24])


def decode_rgba_png(data: bytes, label: str) -> tuple[int, int, list[list[int]]]:
    """Decode the source RGBA8 alpha channel without image libraries."""
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{label}: invalid PNG signature")
    width = height = bit_depth = color_type = None
    compressed = bytearray()
    offset = 8
    while offset + 12 <= len(data):
        length = int.from_bytes(data[offset:offset + 4], "big")
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        if len(payload) != length:
            raise ValueError(f"{label}: truncated PNG chunk")
        if kind == b"IHDR":
            width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(">IIBBBBB", payload)
            if bit_depth != 8 or color_type != 6 or compression != 0 or filtering != 0 or interlace != 0:
                raise ValueError(f"{label}: expected non-interlaced RGBA8 PNG, got depth={bit_depth} color={color_type}")
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            break
        offset += 12 + length
    if not width or not height:
        raise ValueError(f"{label}: missing PNG dimensions")
    raw = zlib.decompress(compressed)
    stride = width * 4
    if len(raw) != height * (stride + 1):
        raise ValueError(f"{label}: decoded PNG scanline length is inconsistent")
    alpha_rows: list[list[int]] = []
    previous = bytearray(stride)
    cursor = 0
    for _ in range(height):
        filter_type = raw[cursor]
        cursor += 1
        source = raw[cursor:cursor + stride]
        cursor += stride
        reconstructed = bytearray(stride)
        for index, value in enumerate(source):
            left = reconstructed[index - 4] if index >= 4 else 0
            up = previous[index]
            upper_left = previous[index - 4] if index >= 4 else 0
            if filter_type == 0:
                predictor = 0
            elif filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = up
            elif filter_type == 3:
                predictor = (left + up) // 2
            elif filter_type == 4:
                base = left + up - upper_left
                da, db, dc = abs(base - left), abs(base - up), abs(base - upper_left)
                predictor = left if da <= db and da <= dc else up if db <= dc else upper_left
            else:
                raise ValueError(f"{label}: unsupported PNG filter {filter_type}")
            reconstructed[index] = (value + predictor) & 255
        alpha_rows.append([reconstructed[x * 4 + 3] for x in range(width)])
        previous = reconstructed
    return width, height, alpha_rows


def frame_grid_evidence(data: bytes, label: str, columns: int, expected_rows: list[int]) -> dict:
    width, height, alpha = decode_rgba_png(data, label)
    if width != columns * 64 or height != 4 * 64:
        raise ValueError(f"{label}: expected {columns} columns x 4 rows of 64px frames")
    evidence = []
    for row in range(4):
        occupied = []
        feet = []
        for column in range(columns):
            ys = [
                y - row * 64
                for y in range(row * 64, (row + 1) * 64)
                if any(alpha[y][column * 64:(column + 1) * 64])
            ]
            if ys:
                occupied.append(column)
                feet.append(max(ys))
        evidence.append({"row": row, "occupied_columns": occupied, "feet_y_range": [min(feet), max(feet)] if feet else []})
        if len(occupied) != expected_rows[row]:
            raise ValueError(f"{label}: row {row} has {len(occupied)} opaque frames; expected {expected_rows[row]}")
    return {"directions": evidence, "feet_anchor_px": [32, 43]}


def tiled_timing_evidence(archive: zipfile.ZipFile, gender: str) -> dict:
    tmx_name = "Tiled_files/Base_boy.tmx" if gender == "male" else "Tiled_files/Base_girl.tmx"
    root = ET.fromstring(archive.read(tmx_name))
    names = {
        "idle": "Unarmed_Idle", "walk": "Unarmed_Walk", "run": "Unarmed_Run",
        "hurt": "Unarmed_Hurt", "death": "Unarmed_Death", "attack": "Sword_attack",
        "walk_attack": "Sword_Walk_Attack", "run_attack": "Sword_Run_Attack",
    }
    evidence = {}
    for action, tiled_name in names.items():
        durations = []
        animation_lengths = []
        for tileset in root.findall("tileset"):
            if tileset.get("name") != tiled_name:
                continue
            for tile in tileset.findall("tile"):
                animation = tile.find("animation")
                if animation is None:
                    continue
                frames = animation.findall("frame")
                animation_lengths.append(len(frames))
                durations.extend(int(frame.get("duration", "0")) for frame in frames)
        if not durations or any(duration <= 0 for duration in durations):
            raise ValueError(f"{gender}/{action}: Tiled animation timing evidence is missing")
        expected_durations = {150, 300} if action == "death" else {150}
        if set(durations) != expected_durations:
            raise ValueError(f"{gender}/{action}: unexpected Tiled frame durations {sorted(set(durations))}")
        expected_count = SHEETS[action][1]
        if expected_count not in animation_lengths:
            raise ValueError(f"{gender}/{action}: Tiled frame count does not match PNG grid")
        evidence[action] = {"durations_ms": sorted(set(durations)), "png_frames_per_row": expected_count}
    return evidence


def ensure_outside_repo(path: Path, repo_root: Path) -> None:
    try:
        path.resolve().relative_to(repo_root.resolve())
    except ValueError:
        return
    raise ValueError(f"Source archive must remain outside the repository: {path}")


def stage_one(gender: str, archive_path: Path, out_root: Path) -> dict:
    identity = EXPECTED[gender]
    if not archive_path.is_file():
        raise ValueError(f"{gender}: archive is missing: {archive_path}")
    actual_sha = sha256(archive_path)
    if actual_sha != identity["sha256"]:
        raise ValueError(f"{gender}: SHA-256 mismatch ({actual_sha})")

    character_dir = out_root / gender
    character_dir.mkdir(parents=True, exist_ok=True)
    staged: dict[str, dict] = {}
    with zipfile.ZipFile(archive_path) as archive:
        timing = tiled_timing_evidence(archive, gender)
        for action, (member, frame_count, loops) in SHEETS.items():
            try:
                data = archive.read(member)
            except KeyError as error:
                raise ValueError(f"{gender}: required source member missing: {member}") from error
            width, height = png_dimensions(data, member)
            if height != 256 or width != frame_count * 64:
                raise ValueError(
                    f"{gender}/{action}: unexpected sheet {width}x{height}; "
                    f"expected {frame_count * 64}x256 (64px frames, four directional rows)"
                )
            expected_by_row = [frame_count, frame_count, frame_count, 4 if action == "idle" else frame_count]
            frame_evidence = frame_grid_evidence(data, f"{gender}/{action}", frame_count, expected_by_row)
            target = character_dir / f"{action}.png"
            target.write_bytes(data)
            direction_specs = {
                name: {"row": row, "frames": 4 if action == "idle" and name == "back" else frame_count}
                for name, row in DIRECTIONS.items()
            }
            sheet_record = {
                "texture_path": f"res://private_art/a6_avatar/{gender}/{action}.png",
                "frame_size": [64, 64],
                "fps": round(1000.0 / 150.0, 6),
                "loop": loops,
                "directions": direction_specs,
                "source_member": member,
                "sha256": hashlib.sha256(data).hexdigest(),
                "frame_grid_evidence": frame_evidence,
                "timing_evidence": timing[action],
            }
            if action == "death":
                # The source Tiled animation holds the last pose for 300 ms;
                # repeating its final 150 ms frame preserves that hold in Godot.
                for direction in direction_specs.values():
                    direction["repeat_last_frame"] = True
            staged[action] = sheet_record

    return {
        "craftpix_id": identity["craftpix_id"],
        "drive_file_id": identity["drive_id"],
        "source_pack": identity["archive"],
        "archive_sha256": actual_sha,
        "armor_grades": {
            "0": {
                "source_pack": identity["archive"],
                "runtime_status": "PRIVATE_STAGED_NOT_IN_REPOSITORY",
                "idle_sheet": f"res://private_art/a6_avatar/{gender}/idle.png",
                "frame_size": [64, 64],
                "directions": DIRECTIONS,
                "runtime_action_sheets": staged,
            },
            "1": None,
            "2": None,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--male-zip", required=True, type=Path)
    parser.add_argument("--female-zip", required=True, type=Path)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    repo_root = args.repo_root.resolve()
    output = (args.output or repo_root / "private_art" / "a6_avatar").resolve()
    if output != repo_root / "private_art" / "a6_avatar":
        # Custom private output is allowed only outside the repository.
        ensure_outside_repo(output, repo_root)
    ensure_outside_repo(args.male_zip, repo_root)
    ensure_outside_repo(args.female_zip, repo_root)

    try:
        characters = {
            "male": stage_one("male", args.male_zip, output),
            "female": stage_one("female", args.female_zip, output),
        }
        private_manifest = {
            "schema": "soh.a6.private_avatar_runtime.v1",
            "status": "LOCAL_PRIVATE_PREVIEW_ONLY",
            "license_review": {
                "status": "VERIFIED_GAME_USE",
                "reviewed_on": "2026-10-30",
                "license_url": "https://craftpix.net/file-licenses/",
                "product_urls": [
                    "https://craftpix.net/freebies/free-base-4-direction-male-character-pixel-art/",
                    "https://craftpix.net/freebies/free-base-4-direction-female-character-pixel-art/",
                ],
                "distribution_boundary": "GAME_USE_SUPPORTED; PUBLIC_RAW_SOURCE_REDISTRIBUTION_NOT_APPROVED",
            },
            "characters": characters,
            "runtime_presentation_pipeline": {
                "schema": "soh.a6.avatar_sprite_pipeline.v1",
                "status": "PRIVATE_LOCAL_SOURCE_STAGING",
                "directions": list(DIRECTIONS),
            },
            "notice": "Do not commit source PNGs, pack ZIPs, or expose art as exportable standalone content. Use only embedded in-game; this local preview is not production approval.",
        }
        output.mkdir(parents=True, exist_ok=True)
        manifest_path = output / "avatar_art_private_runtime.json"
        manifest_path.write_text(json.dumps(private_manifest, indent=2) + "\n", encoding="utf-8")
        print(f"Private A6 base sheets staged (no ZIPs copied): {output}")
        print(f"Runtime metadata: {manifest_path}")
        for gender in ("male", "female"):
            actions = private_manifest["characters"][gender]["armor_grades"]["0"]["runtime_action_sheets"]
            print(f"{gender}: {len(actions)} actions; {len(actions)} selected PNG sheets; 64x64 cells; 4 rows")
        print("Git staging is prohibited; private_art/ is ignored. Grade 1/2 remain source-blocked.")
        return 0
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
