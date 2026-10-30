"""Pixel-compatibility evidence for the deliberately maintained A1 atlas pin."""
from __future__ import annotations

import hashlib
import json
import struct
import unittest
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "data/survival/world_content/a1_atlas_compatibility.v1.json"
A8_MANIFEST = ROOT / "data/survival/world_content/a8_art_manifest.v1.json"


def decode_rgba_png(path: Path) -> tuple[int, int, list[bytes]]:
    """Decode the project’s 8-bit, noninterlaced RGBA PNGs with stdlib only."""
    contents = path.read_bytes()
    if contents[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    cursor = 8
    width = height = bit_depth = color_type = interlace = -1
    compressed = bytearray()
    while cursor < len(contents):
        length = struct.unpack(">I", contents[cursor : cursor + 4])[0]
        kind = contents[cursor + 4 : cursor + 8]
        data = contents[cursor + 8 : cursor + 8 + length]
        cursor += 12 + length
        if kind == b"IHDR":
            width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(
                ">IIBBBBB", data
            )
            if compression != 0 or filtering != 0:
                raise ValueError("unsupported PNG compression/filter method")
        elif kind == b"IDAT":
            compressed.extend(data)
        elif kind == b"IEND":
            break
    if bit_depth != 8 or color_type != 6 or interlace != 0:
        raise ValueError("compatibility fixture requires noninterlaced 8-bit RGBA")
    raw = zlib.decompress(compressed)
    stride = width * 4
    rows: list[bytes] = []
    previous = bytearray(stride)
    source_cursor = 0
    for _ in range(height):
        filter_type = raw[source_cursor]
        source_cursor += 1
        scanline = bytearray(raw[source_cursor : source_cursor + stride])
        source_cursor += stride
        for index in range(stride):
            left = scanline[index - 4] if index >= 4 else 0
            up = previous[index]
            upper_left = previous[index - 4] if index >= 4 else 0
            if filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = up
            elif filter_type == 3:
                predictor = (left + up) // 2
            elif filter_type == 4:
                base = left + up - upper_left
                distances = (abs(base - left), abs(base - up), abs(base - upper_left))
                predictor = (left, up, upper_left)[distances.index(min(distances))]
            elif filter_type == 0:
                predictor = 0
            else:
                raise ValueError(f"unsupported PNG filter {filter_type}")
            scanline[index] = (scanline[index] + predictor) & 0xFF
        rows.append(bytes(scanline))
        previous = scanline
    if source_cursor != len(raw):
        raise ValueError("unexpected decoded PNG payload length")
    return width, height, rows


def crop_rgba_digest(rows: list[bytes], rect: list[int]) -> str:
    x, y, width, height = rect
    pixels = bytearray()
    for row in rows[y : y + height]:
        pixels.extend(row[x * 4 : (x + width) * 4])
    return hashlib.sha256(pixels).hexdigest()


class A1AtlasCompatibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
        cls.a8_manifest = json.loads(A8_MANIFEST.read_text(encoding="utf-8"))

    def test_pinned_site_frames_match_current_a1_source_pixels(self) -> None:
        evidence = self.evidence
        current = evidence["a1_current"]
        self.assertEqual(current["head"], "ad39bde6780c92169032246898c145c568f36e6e")
        self.assertEqual(current["frame_counts"], {"terrain": 318, "props": 47})
        for kind, file_name in (("terrain", "terrain.png"), ("props", "props.png")):
            a8_record = self.a8_manifest["textures"][kind]
            a8_path = ROOT / a8_record["path"].removeprefix("res://")
            width, height, rows = decode_rgba_png(a8_path)
            self.assertEqual([width, height], evidence["a8_pin"]["texture_dimensions"][kind])
            actual_a8_frames = (
                self.a8_manifest["terrain_frames"]
                if kind == "terrain"
                else self.a8_manifest["props_frames"]
            )
            records = evidence["matched_frames"][kind]
            self.assertTrue(records, kind)
            for name, frame in records.items():
                self.assertEqual(actual_a8_frames[name], frame["a8_rect"], (kind, name))
                self.assertEqual(
                    crop_rgba_digest(rows, frame["a8_rect"]),
                    frame["rgba_crop_sha256"],
                    (kind, name),
                )

    def test_compatibility_set_is_the_nonvacuous_union_used_by_all_three_sites(self) -> None:
        used_props: set[str] = set()
        used_terrain_families: set[str] = set()
        for path in sorted((ROOT / "data/survival/world_content/sites").glob("south_*.json")):
            site = json.loads(path.read_text(encoding="utf-8"))
            visual = site["visual_layout"]
            shell = site["overworld_shell"]["visual_layout"]
            used_props.update(prop["frame"] for prop in visual.get("props", []))
            used_props.update(
                prop["frame"]
                for group in visual.get("state_props", [])
                for prop in group.get("props", [])
            )
            used_props.update(prop["frame"] for prop in shell.get("props", []))
            used_terrain_families.add(visual["ground_family"])
            used_terrain_families.update(area["family"] for area in visual.get("ground_areas", []))
            used_terrain_families.update(path_data["family"] for path_data in visual.get("paths", []))
            used_terrain_families.update(
                path_data["family"]
                for table in visual.get("state_paths", {}).values()
                for paths in table.values()
                for path_data in paths
            )
        terrain_frames = self.a8_manifest["terrain_frames"]
        used_terrain = {
            name
            for family in used_terrain_families
            for name in terrain_frames
            if name.startswith(family + "_")
        }
        self.assertEqual(set(self.evidence["matched_frames"]["terrain"]), used_terrain)
        self.assertEqual(set(self.evidence["matched_frames"]["props"]), used_props)
        self.assertEqual((len(used_terrain), len(used_props)), (23, 25))

    def test_new_context_is_pinned_but_not_claimed_as_adopted_or_native_reviewed(self) -> None:
        evidence = self.evidence
        candidates = evidence["potential_new_transition_frames"]
        expected_prefixes = {
            "south_quarry.json": ("shore_ash_gravel_", "shore_gravel_ash_", "shore_ash_moor_", "shore_moor_ash_", "shore_gravel_soil_", "shore_soil_gravel_", "shore_moor_soil_", "shore_soil_moor_"),
            "south_orchard_ruin.json": ("shore_forest_soil_", "shore_soil_forest_", "shore_moor_soil_", "shore_soil_moor_", "shore_gravel_soil_", "shore_soil_gravel_"),
            "south_crown_mill.json": ("shore_ash_gravel_", "shore_gravel_ash_", "shore_ash_moor_", "shore_moor_ash_", "shore_gravel_soil_", "shore_soil_gravel_", "shore_moor_soil_", "shore_soil_moor_"),
        }
        self.assertEqual(set(candidates), set(expected_prefixes))
        self.assertEqual({key: len(value) for key, value in candidates.items()}, {
            "south_quarry.json": 32,
            "south_orchard_ruin.json": 24,
            "south_crown_mill.json": 32,
        })
        for filename, prefixes in expected_prefixes.items():
            names = candidates[filename]
            self.assertTrue(all(name.startswith(prefixes) for name in names), filename)
            self.assertTrue(all(len(rect) == 4 and rect[2:] == [16, 16] for rect in names.values()))
        self.assertEqual(evidence["potential_new_props"], {
            "cache_notes": [304, 2, 26, 24],
            "cache_notes_open": [332, 2, 26, 24],
        })
        self.assertEqual(evidence["native_visual_acceptance"], "HOLD; this is a source-pixel compatibility check, not native render acceptance.")


if __name__ == "__main__":
    unittest.main()
