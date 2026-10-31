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
SURFACE_CONTRACT = ROOT / "data/survival/world_content/surface_affordances.v1.json"


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
        cls.surface_contract = json.loads(SURFACE_CONTRACT.read_text(encoding="utf-8"))

    def test_pinned_site_frames_match_current_a1_source_pixels(self) -> None:
        evidence = self.evidence
        current = evidence["a1_current"]
        self.assertEqual(current["head"], "9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf")
        self.assertEqual(current["atlas_sha256"], "83d69373ca6c1258e8727800d0aa0c288851c34d25539c69c21ec9f5fc9d769a")
        self.assertEqual(current["terrain_sha256"], "6128d8f41abe6962fe705431db20e762e0cca613ffc3eca29065727422737d1c")
        self.assertEqual(current["props_sha256"], "8d4acf4028e0e065b901e78c59c65e5a68677fb75d46c04c7e5a029a76d27324")
        self.assertEqual(current["texture_dimensions"], {"terrain": [512, 880], "props": [1024, 572]})
        self.assertEqual(current["frame_counts"], {"terrain": 1759, "props": 138})
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

    def test_existing_snow_frames_match_current_a1_without_claiming_weather_support(self) -> None:
        frames = self.evidence["existing_surface_frames"]["frames"]
        width, height, rows = decode_rgba_png(
            ROOT / self.a8_manifest["textures"]["terrain"]["path"].removeprefix("res://")
        )
        self.assertEqual([width, height], [512, 128])
        for name, frame in frames.items():
            self.assertEqual(self.a8_manifest["terrain_frames"][name], frame["a8_rect"])
            self.assertEqual(frame["a8_rect"], frame["a1_rect"])
            self.assertEqual(crop_rgba_digest(rows, frame["a8_rect"]), frame["rgba_crop_sha256"], name)

    def test_targeted_surface_derivative_matches_current_a1_source_pixels(self) -> None:
        evidence = self.evidence["adopted_surface_frames"]
        source = self.a8_manifest["surface_derivative_source"]
        current_a1 = self.evidence["a1_current"]
        self.assertEqual(source["a1_head"], current_a1["head"])
        self.assertEqual(source["atlas_sha256"], current_a1["atlas_sha256"])
        self.assertEqual(source["terrain_sha256"], current_a1["terrain_sha256"])
        self.assertEqual(source["a1_head"], evidence["source_a1_head"])
        self.assertEqual(source["terrain_sha256"], evidence["source_texture_sha256"])
        self.assertEqual(set(source["frames"]), set(evidence["frames"]))
        texture = self.a8_manifest["textures"]["surface"]
        path = ROOT / texture["path"].removeprefix("res://")
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), evidence["a8_surface_texture_sha256"])
        width, height, rows = decode_rgba_png(path)
        self.assertEqual([width, height], evidence["a8_surface_dimensions"])
        for name, frame in evidence["frames"].items():
            self.assertEqual(self.a8_manifest["surface_frames"][name], frame["a8_rect"])
            self.assertEqual(crop_rgba_digest(rows, frame["a8_rect"]), frame["rgba_crop_sha256"], name)

    def test_surface_contract_keeps_unprovided_environment_and_depth_unknown(self) -> None:
        self.assertEqual(self.surface_contract["schema"], "soh.a8.local_surface_affordance.v1")
        self.assertTrue(self.surface_contract["environment_projection"]["appearance_only"])
        self.assertTrue(self.surface_contract["environment_projection"]["may_change_collision_or_route_access"] is False)
        self.assertIn("UNKNOWN", self.surface_contract["environment_projection"]["current_a0_source_support"]["weather"])
        for site in self.surface_contract["site_surfaces"].values():
            self.assertTrue(site["authored_exposure_routes"])
            for zone in site["zones"]:
                if "water" in zone["surface_class"]:
                    self.assertIsNone(zone["depth_value"])
        self.assertIn("No A8 global footprints", self.surface_contract["non_features"][0])
        orchard = self.surface_contract["site_surfaces"]["poi_crown_south_orchard"]
        orchard_water = next(zone for zone in orchard["zones"] if zone["zone_id"] == "orchard_irrigation_channel")
        self.assertIsNone(orchard_water["depth_value"])
        self.assertEqual(
            [blocker["rect_px"] for blocker in orchard["physical_blockers"][:2]],
            [[224, 272, 256, 32], [512, 272, 240, 32]],
        )
        self.assertEqual(
            orchard["physical_blockers"][2]["when_site_state_not"],
            {"orchard_channel": ["flowing"]},
        )
        mill = self.surface_contract["site_surfaces"]["poi_crown_south_mill"]
        self.assertTrue(all(item["when"] == "always" for item in mill["physical_blockers"]))
        self.assertTrue(self.surface_contract["environment_projection"]["weather_must_not_close_an_authored_retreat_route"])

    def test_current_a1_prop_coordinates_are_reconciled_without_repinning_a8(self) -> None:
        moved_props = [
            frame
            for frame in self.evidence["matched_frames"]["props"].values()
            if frame["a8_rect"] != frame["a1_current_rect"]
        ]
        moved_terrain = [
            frame
            for frame in self.evidence["matched_frames"]["terrain"].values()
            if frame["a8_rect"] != frame["a1_current_rect"]
        ]
        self.assertEqual(len(moved_props), 23)
        self.assertEqual(moved_terrain, [])
        self.assertTrue(all(frame["rgba_crop_sha256"] for frame in moved_props))

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
