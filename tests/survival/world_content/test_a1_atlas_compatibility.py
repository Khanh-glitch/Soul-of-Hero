"""Exact A1 provenance and pixel evidence for A8's composed worldsite art."""
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
    """Decode the project's 8-bit, noninterlaced RGBA PNGs with stdlib only."""
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


def frame_catalog_digest(frame_map: dict[str, list[int]]) -> str:
    canonical = json.dumps(frame_map, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(canonical).hexdigest()


class A1AtlasCompatibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
        cls.a8_manifest = json.loads(A8_MANIFEST.read_text(encoding="utf-8"))
        cls.surface_contract = json.loads(SURFACE_CONTRACT.read_text(encoding="utf-8"))

    def test_complete_current_a1_atlas_is_copied_byte_for_byte_and_reconciled(self) -> None:
        evidence = self.evidence
        a1 = evidence["a1_current"]
        a8 = evidence["a8_copy"]
        self.assertEqual(a1["pr"], 20)
        self.assertEqual(a1["head"], "e1e4e9a4d4a0f7f0d38360d638715a0c9f144208")
        self.assertEqual(a1["atlas_manifest_path"], "data/survival/world/art/atlas.v1.json")
        self.assertEqual(a1["atlas_sha256"], "83d69373ca6c1258e8727800d0aa0c288851c34d25539c69c21ec9f5fc9d769a")
        self.assertEqual(a1["frame_counts"], {"terrain": 1759, "props": 138})
        self.assertEqual(a8["frame_counts"], a1["frame_counts"])
        self.assertEqual(self.a8_manifest["a1_head"], a1["head"])
        self.assertEqual(self.a8_manifest["current_a1_compatibility"]["current_head"], a1["head"])

        for kind, manifest_key in (("terrain", "terrain_frames"), ("props", "props_frames")):
            source_hash = a1[f"{kind}_sha256"]
            copy_hash = a8[f"{kind}_sha256"]
            self.assertEqual(copy_hash, source_hash, kind)
            self.assertEqual(self.a8_manifest["textures"][kind]["sha256"], source_hash)
            self.assertEqual(self.a8_manifest["textures"][kind]["dimensions"], a1[f"{kind}_dimensions"])
            self.assertEqual(hashlib.sha256((ROOT / a8[f"{kind}_path"]).read_bytes()).hexdigest(), source_hash)
            width, height, rows = decode_rgba_png(ROOT / a8[f"{kind}_path"])
            self.assertEqual([width, height], a1[f"{kind}_dimensions"])
            frames = self.a8_manifest[manifest_key]
            self.assertEqual(len(frames), a1["frame_counts"][kind])
            self.assertEqual(
                frame_catalog_digest(frames),
                a1["frame_catalog_sha256"][kind],
                f"{kind} frame coordinates must match the pinned A1 atlas manifest",
            )
            used = evidence["site_frame_crops"][kind]
            self.assertTrue(used, kind)
            for name, frame in used.items():
                self.assertEqual(frames[name], frame["a1_rect"], (kind, name))
                self.assertEqual(frame["a8_rect"], frame["a1_rect"], (kind, name))
                self.assertEqual(
                    crop_rgba_digest(rows, frame["a8_rect"]),
                    frame["rgba_crop_sha256"],
                    (kind, name),
                )

    def test_surface_derivative_and_quarry_light_are_exact_a1_source_pixels(self) -> None:
        evidence = self.evidence
        surface = evidence["adopted_surface_frames"]
        texture_record = self.a8_manifest["textures"]["surface"]
        path = ROOT / texture_record["path"].removeprefix("res://")
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), surface["a8_surface_texture_sha256"])
        sw, sh, surface_rows = decode_rgba_png(path)
        self.assertEqual([sw, sh], surface["a8_surface_dimensions"])
        terrain_path = ROOT / self.a8_manifest["textures"]["terrain"]["path"].removeprefix("res://")
        tw, th, terrain_rows = decode_rgba_png(terrain_path)
        self.assertEqual([tw, th], [512, 880])
        for name, frame in surface["frames"].items():
            self.assertEqual(self.a8_manifest["terrain_frames"][name], frame["a1_rect"])
            self.assertEqual(
                crop_rgba_digest(terrain_rows, frame["a1_rect"]),
                frame["rgba_crop_sha256"],
                name,
            )
            self.assertEqual(
                crop_rgba_digest(surface_rows, frame["surface_rect"]),
                frame["rgba_crop_sha256"],
                name,
            )

        light = evidence["adopted_local_light"]
        self.assertEqual(light["source_a1_head"], evidence["a1_current"]["head"])
        self.assertEqual(light["source_path"], "assets/environment/chapter1/archive/light_radial.png")
        light_record = self.a8_manifest["textures"]["quarry_lamp_radial"]
        light_path = ROOT / light_record["path"].removeprefix("res://")
        self.assertEqual(hashlib.sha256(light_path.read_bytes()).hexdigest(), light["sha256"])
        lw, lh, _rows = decode_rgba_png(light_path)
        self.assertEqual([lw, lh], light["dimensions"])
        self.assertEqual(light_record["dimensions"], light["dimensions"])
        self.assertIn("no collision", light["use"])

    def test_candidate_asset_decisions_are_pixel_and_scene_semantic_based(self) -> None:
        decisions = self.evidence["candidate_source_decisions"]
        self.assertIn("byte-identical", decisions["current_a1_survival_world_atlas"])
        self.assertIn("warm radial light", decisions["chapter1_archive"])
        self.assertIn("crypt doors", decisions["chapter1_crypt_and_ruins"])
        self.assertIn("16px grass tiles", decisions["cainos_demo"])
        self.assertIn("dark teal", decisions["ocean_cainos"])
        self.assertIn("Water_coasts_animation", decisions["free_topdown_pixel_dungeon"])
        self.assertIn("rights are secured", self.evidence["creator_rights_confirmation"])
        self.assertEqual(
            self.evidence["native_visual_acceptance"],
            "HOLD; exact source/frame evidence is not native-render or human-play approval.",
        )

    def test_surface_contract_keeps_unknown_depth_and_unprovided_environment_non_authoritative(self) -> None:
        self.assertEqual(self.surface_contract["schema"], "soh.a8.local_surface_affordance.v1")
        self.assertTrue(self.surface_contract["environment_projection"]["appearance_only"])
        self.assertFalse(self.surface_contract["environment_projection"]["may_change_collision_or_route_access"])
        self.assertIn("UNKNOWN", self.surface_contract["environment_projection"]["current_a0_source_support"]["weather"])
        for site in self.surface_contract["site_surfaces"].values():
            self.assertTrue(site["authored_exposure_routes"])
            for zone in site["zones"]:
                if "water" in zone["surface_class"]:
                    self.assertIsNone(zone["depth_value"])
        self.assertIn("No A8 global footprints", self.surface_contract["non_features"][0])
        orchard = self.surface_contract["site_surfaces"]["poi_crown_south_orchard"]
        water = next(zone for zone in orchard["zones"] if zone["zone_id"] == "orchard_irrigation_channel")
        self.assertIsNone(water["depth_value"])
        self.assertEqual(
            [blocker["rect_px"] for blocker in orchard["physical_blockers"][:2]],
            [[224, 272, 256, 32], [512, 272, 240, 32]],
        )
        self.assertEqual(orchard["physical_blockers"][2]["when_site_state_not"], {"orchard_channel": ["flowing"]})
        mill = self.surface_contract["site_surfaces"]["poi_crown_south_mill"]
        self.assertTrue(all(item["when"] == "always" for item in mill["physical_blockers"]))
        self.assertTrue(self.surface_contract["environment_projection"]["weather_must_not_close_an_authored_retreat_route"])


if __name__ == "__main__":
    unittest.main()
