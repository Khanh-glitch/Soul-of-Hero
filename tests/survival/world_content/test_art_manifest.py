"""Validate A8's pinned, source-sized visual presentation contract."""
from __future__ import annotations

import hashlib
import json
import struct
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MANIFEST_PATH = ROOT / "data/survival/world_content/a8_art_manifest.v1.json"


class ArtManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        cls.terrain_frames = cls.manifest["terrain_frames"]
        cls.prop_frames = cls.manifest["props_frames"]

    def test_texture_hashes_and_png_dimensions_match_the_pinned_source(self) -> None:
        expected = {
            "terrain": ("59eb49569e6ac7d4493749318e3511564db695c3840a5dd7a32e53f96d280384", (512, 128)),
            "props": ("36505528776568e398b5770493407b5706b4a102bc03e1b50b436277d500d9d4", (1024, 178)),
        }
        for name, (digest, dimensions) in expected.items():
            record = self.manifest["textures"][name]
            path = ROOT / record["path"].removeprefix("res://")
            contents = path.read_bytes()
            self.assertEqual(hashlib.sha256(contents).hexdigest(), digest)
            self.assertEqual(record["sha256"], digest)
            self.assertEqual(struct.unpack(">II", contents[16:24]), dimensions)
            self.assertEqual(contents[:8], b"\x89PNG\r\n\x1a\n")

    def test_frames_are_positive_and_inside_the_copied_atlas(self) -> None:
        dimensions = {"terrain": (512, 128), "props": (1024, 178)}
        for name, frames, expected_size in (
            ("terrain", self.terrain_frames, 16),
            ("props", self.prop_frames, None),
        ):
            width, height = dimensions[name]
            self.assertTrue(frames)
            for frame_name, rect in frames.items():
                self.assertEqual(len(rect), 4, frame_name)
                x, y, frame_width, frame_height = rect
                self.assertGreater(frame_width, 0, frame_name)
                self.assertGreater(frame_height, 0, frame_name)
                self.assertGreaterEqual(x, 0, frame_name)
                self.assertGreaterEqual(y, 0, frame_name)
                self.assertLessEqual(x + frame_width, width, frame_name)
                self.assertLessEqual(y + frame_height, height, frame_name)
                if expected_size is not None:
                    self.assertEqual((frame_width, frame_height), (expected_size, expected_size))

    def test_site_layouts_use_only_manifest_frames_on_integer_tiles(self) -> None:
        sites = sorted((ROOT / "data/survival/world_content/sites").glob("south_*.json"))
        self.assertEqual(len(sites), 3)
        for path in sites:
            data = json.loads(path.read_text(encoding="utf-8"))
            width, height = data["world_bounds"]
            self.assertEqual((width % 16, height % 16), (0, 0), path.name)
            for wall in data.get("walls", []):
                self.assertEqual(len(wall), 4, path.name)
                self.assertTrue(all(isinstance(value, int) for value in wall), path.name)
                x, y, wall_width, wall_height = wall
                self.assertGreaterEqual(x, 0, path.name)
                self.assertGreaterEqual(y, 0, path.name)
                self.assertGreater(wall_width, 0, path.name)
                self.assertGreater(wall_height, 0, path.name)
                self.assertLessEqual(x + wall_width, width, path.name)
                self.assertLessEqual(y + wall_height, height, path.name)
            layout = data["visual_layout"]
            self.assertIn(layout["ground_family"], {name.rsplit("_", 1)[0] for name in self.terrain_frames})
            self.assertIn(layout["lighting_profile"], self.manifest["lighting_profiles"])
            for prop in layout.get("props", []):
                self.assertIn(prop["frame"], self.prop_frames, (path.name, prop))
                self._assert_cell_inside(prop["cell"], width // 16, height // 16, path.name)
                if prop["frame"] == "wall_stub":
                    self._assert_prop_overlaps_geometry(prop, self.prop_frames, data["walls"], path.name)
            for variant in layout.get("state_props", []):
                for prop in variant.get("props", []):
                    self.assertIn(prop["frame"], self.prop_frames, (path.name, prop))
                    self._assert_cell_inside(prop["cell"], width // 16, height // 16, path.name)
            for area in layout.get("ground_areas", []):
                self.assertTrue(self._has_family(area["family"]))
            for state_table in layout.get("state_paths", {}).values():
                for state_paths in state_table.values():
                    for path_data in state_paths:
                        self.assertTrue(self._has_family(path_data["family"]))
                        for cell in path_data["points"]:
                            self._assert_cell_inside(cell, width // 16, height // 16, path.name)
            for path_data in layout.get("paths", []):
                self.assertTrue(self._has_family(path_data["family"]))
                for cell in path_data["points"]:
                    self._assert_cell_inside(cell, width // 16, height // 16, path.name)
            shell = data["overworld_shell"]
            self.assertEqual(shell["bounds_px"], [128, 128], path.name)
            shell_layout = shell["visual_layout"]
            for obstacle in shell.get("obstacles_px", []):
                self.assertEqual(len(obstacle), 4, path.name)
                self.assertTrue(all(isinstance(value, int) for value in obstacle), path.name)
                x, y, obstacle_width, obstacle_height = obstacle
                self.assertGreaterEqual(x, 0, path.name)
                self.assertGreaterEqual(y, 0, path.name)
                self.assertGreater(obstacle_width, 0, path.name)
                self.assertGreater(obstacle_height, 0, path.name)
                self.assertLessEqual(x + obstacle_width, 128, path.name)
                self.assertLessEqual(y + obstacle_height, 128, path.name)
            self.assertIn(shell_layout["ground_family"], {name.rsplit("_", 1)[0] for name in self.terrain_frames})
            self.assertIn(shell_layout["lighting_profile"], self.manifest["lighting_profiles"])
            for prop in shell_layout.get("props", []):
                self.assertIn(prop["frame"], self.prop_frames, (path.name, prop))
                self._assert_cell_inside(prop["cell"], 8, 8, path.name)
                if prop["frame"] == "wall_stub":
                    self._assert_prop_overlaps_geometry(
                        prop, self.prop_frames, shell.get("obstacles_px", []), path.name
                    )
            for variant in shell_layout.get("state_props", []):
                for prop in variant.get("props", []):
                    self.assertIn(prop["frame"], self.prop_frames, (path.name, prop))
                    self._assert_cell_inside(prop["cell"], 8, 8, path.name)
            for area in shell_layout.get("ground_areas", []):
                self.assertTrue(self._has_family(area["family"]))
            for path_data in shell_layout.get("paths", []):
                self.assertTrue(self._has_family(path_data["family"]))
                for cell in path_data["points"]:
                    self._assert_cell_inside(cell, 8, 8, path.name)

    def test_site_renderer_has_no_procedural_or_unlicensed_art_fallback(self) -> None:
        for filename in ("native_poi_site.gd", "native_poi_shell.gd"):
            source = (ROOT / "game/survival/world_content/scripts" / filename).read_text(encoding="utf-8")
            self.assertNotIn("func _draw()", source)
            self.assertNotIn("draw_rect", source)
            self.assertNotIn("Cainos", source)
            self.assertNotIn("cainos_demo", source)

    def _has_family(self, family: str) -> bool:
        return any(name.startswith(family + "_") for name in self.terrain_frames)

    def _assert_prop_overlaps_geometry(
        self, prop: dict[str, object], frames: dict[str, list[int]], obstacles: list[list[int]], label: str
    ) -> None:
        frame_width, frame_height = frames[str(prop["frame"])][2:]
        cell_x, cell_y = prop["cell"]
        left = cell_x * 16 + 8 - frame_width // 2
        top = (cell_y + 1) * 16 - frame_height
        for x, y, width, height in obstacles:
            if left < x + width and left + frame_width > x and top < y + height and top + frame_height > y:
                return
        self.fail(f"{label}: visually blocking {prop['frame']} has no matching collision")

    def _assert_cell_inside(self, cell: list[int], columns: int, rows: int, label: str) -> None:
        self.assertEqual(len(cell), 2, label)
        self.assertIsInstance(cell[0], int, label)
        self.assertIsInstance(cell[1], int, label)
        self.assertGreaterEqual(cell[0], 0, label)
        self.assertGreaterEqual(cell[1], 0, label)
        self.assertLess(cell[0], columns, label)
        self.assertLess(cell[1], rows, label)


if __name__ == "__main__":
    unittest.main()
