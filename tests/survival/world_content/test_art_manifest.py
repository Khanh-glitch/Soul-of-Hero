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

    def test_complete_current_a1_atlas_counts_are_available_to_the_site_compositor(self) -> None:
        self.assertEqual(len(self.terrain_frames), 1759)
        self.assertEqual(len(self.prop_frames), 138)
        self.assertEqual(self.manifest["a1_head"], "e1e4e9a4d4a0f7f0d38360d638715a0c9f144208")

    def test_texture_hashes_and_png_dimensions_match_the_pinned_source(self) -> None:
        expected = {
            "terrain": ("6128d8f41abe6962fe705431db20e762e0cca613ffc3eca29065727422737d1c", (512, 880)),
            "props": ("8d4acf4028e0e065b901e78c59c65e5a68677fb75d46c04c7e5a029a76d27324", (1024, 572)),
            "surface": ("1c09dc358ea7724b97bfe15695d6fa4612b57cf2d78d7a5a9ea23164eb3b44e2", (80, 16)),
            "quarry_lamp_radial": ("351ed8009dae7be3ae61c80f5161bce6984a4444576c7c5b51500f6fcea8d69e", (256, 256)),
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
        dimensions = {"terrain": (512, 880), "props": (1024, 572)}
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
            if path.name == "south_quarry.json":
                east_gate = data["choice_blockers"]["brace_oak"][0]
                west_gate = data["choice_blockers"]["chock_stone"][0]
                self.assertGreater(east_gate[0], west_gate[0])
            layout = data["visual_layout"]
            self.assertIn(layout["ground_family"], {name.rsplit("_", 1)[0] for name in self.terrain_frames})
            self.assertIn(layout["lighting_profile"], self.manifest["lighting_profiles"])
            for prop in layout.get("props", []):
                self.assertIn(prop["frame"], self.prop_frames, (path.name, prop))
                self._assert_cell_inside(prop["cell"], width // 16, height // 16, path.name)
                if prop["frame"] == "wall_stub":
                    self._assert_prop_overlaps_geometry(prop, self.prop_frames, data["walls"], path.name)
            base_prop_ids = {prop.get("id") for prop in layout.get("props", [])}
            for variant in layout.get("state_props", []):
                hidden = variant.get("hide_ids", [])
                self.assertEqual(len(hidden), len(set(hidden)), (path.name, variant))
                self.assertTrue(set(hidden) <= base_prop_ids, (path.name, variant))
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
            for path_data in layout.get("track_paths", []):
                self.assertTrue(self._has_family(path_data["family"]))
                for cell in path_data["points"]:
                    self._assert_cell_inside(cell, width // 16, height // 16, path.name)
            for overlay in layout.get("overlays", []):
                self.assertIn(overlay["frame"], self.terrain_frames, (path.name, overlay))
                self._assert_cell_inside(overlay["cell"], width // 16, height // 16, path.name)
            for variant in layout.get("state_overlays", []):
                for overlay in variant.get("overlays", []):
                    self.assertIn(overlay["frame"], self.terrain_frames, (path.name, overlay))
                    self._assert_cell_inside(overlay["cell"], width // 16, height // 16, path.name)
            shell = data["overworld_shell"]
            self.assertEqual(shell["bounds_px"], [128, 128], path.name)
            self.assertEqual(shell["action_socket"], [64, 64], path.name)
            self.assertEqual(shell["entry_portal"], [64, 108], path.name)
            shell_layout = shell["visual_layout"]
            self.assertIn(shell_layout["lighting_profile"], self.manifest["lighting_profiles"])
            rows = shell_layout["ground_rows"]
            self.assertEqual(len(rows), 8, path.name)
            for row in rows:
                self.assertEqual(len(row), 8, path.name)
                for frame in row:
                    self.assertIn(frame, self.terrain_frames, (path.name, frame))
            for overlay in shell_layout.get("overlays", []):
                self.assertIn(overlay["frame"], self.terrain_frames, (path.name, overlay))
                self._assert_cell_inside(overlay["cell"], 8, 8, path.name)
            clear_rect = shell_layout["doorway_clear_rect_px"]
            self.assertEqual(clear_rect, [44, 92, 40, 36], path.name)
            clear_left, clear_top, clear_width, clear_height = clear_rect
            for prop in shell_layout.get("props", []):
                self.assertIn(prop["frame"], self.prop_frames, (path.name, prop))
                self.assertIn("local_px", prop, (path.name, prop))
                anchor_x, anchor_y = prop["local_px"]
                self.assertTrue(all(isinstance(value, int) for value in (anchor_x, anchor_y)), (path.name, prop))
                frame_x, frame_y, frame_width, frame_height = self.prop_frames[prop["frame"]]
                del frame_x, frame_y
                left = anchor_x - frame_width // 2
                top = anchor_y - frame_height
                self.assertGreaterEqual(left, 0, (path.name, prop))
                self.assertGreaterEqual(top, 0, (path.name, prop))
                self.assertLessEqual(left + frame_width, 128, (path.name, prop))
                self.assertLessEqual(top + frame_height, 128, (path.name, prop))
                self.assertFalse(
                    left < clear_left + clear_width
                    and left + frame_width > clear_left
                    and top < clear_top + clear_height
                    and top + frame_height > clear_top,
                    f"{path.name}: {prop['frame']} overlaps the clear doorway",
                )
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


    def test_shell_landmarks_and_worksite_loops_are_not_reskins_or_price_labels(self) -> None:
        expected = {
            "south_quarry.json": ("lm_quarry_workface", "quarry"),
            "south_orchard_ruin.json": ("lm_orchard_shed", "orchard"),
            "south_crown_mill.json": ("lm_mill_house", "mill"),
        }
        action_sets: list[set[str]] = []
        for filename, (landmark, profile) in expected.items():
            data = json.loads((ROOT / "data/survival/world_content/sites" / filename).read_text())
            shell = data["overworld_shell"]
            shell_props = {item["frame"] for item in shell["visual_layout"]["props"]}
            self.assertIn(landmark, shell_props, filename)
            self.assertEqual(shell["profile"], profile, filename)
            action_ids = {
                action["action_id"]
                for group in ("choices", "actions")
                for action in data.get(group, [])
            }
            self.assertTrue(action_ids, filename)
            action_sets.append(action_ids)
            for group in ("choices", "actions"):
                for action in data.get(group, []):
                    label = action.get("label", "")
                    self.assertNotRegex(
                        label,
                        r"\b\d+\s+(?:Oak Wood|Stone Chunk|Iron Scrap|Reed Fibre)\b",
                        (filename, label),
                    )
        self.assertTrue(action_sets[0].isdisjoint(action_sets[1]))
        self.assertTrue(action_sets[0].isdisjoint(action_sets[2]))
        self.assertTrue(action_sets[1].isdisjoint(action_sets[2]))

    def test_context_ground_and_owner_projected_site_states_are_authored_and_bounded(self) -> None:
        expected_context_families = {
            "south_quarry.json": ("ash", [1280, 736], [-160, -64]),
            "south_orchard_ruin.json": ("forest", [1280, 736], [-160, -64]),
            "south_crown_mill.json": ("ash", [1280, 736], [-160, -64]),
        }
        for filename, (family, size_px, origin_px) in expected_context_families.items():
            data = json.loads((ROOT / "data/survival/world_content/sites" / filename).read_text())
            context = data["visual_layout"]["context_ground"]
            self.assertEqual(context["ground_family"], family, filename)
            self.assertEqual(context["size_px"], size_px, filename)
            self.assertEqual(context["origin_px"], origin_px, filename)
            self.assertIn("decorative only", context["purpose"], filename)
            self.assertTrue(self._has_family(context["ground_family"]))

        quarry = json.loads(
            (ROOT / "data/survival/world_content/sites/south_quarry.json").read_text()
        )
        extraction = next(action for action in quarry["actions"] if action["action_id"] == "extract_outcrop")
        self.assertTrue(extraction["owner_ready_required"])
        self.assertIsNone(quarry["source"].get("physical_instance_id"))

        orchard = json.loads(
            (ROOT / "data/survival/world_content/sites/south_orchard_ruin.json").read_text()
        )
        orchard_layout = orchard["visual_layout"]
        base_water = [path for path in orchard_layout["paths"] if path["family"] == "water"]
        flow_water = orchard_layout["state_paths"]["orchard_channel"]["flowing"]
        self.assertEqual([path["width"] for path in base_water], [1])
        self.assertTrue(flow_water)
        self.assertTrue(all(path["family"] == "water" and path["width"] == 2 for path in flow_water))
        water_marks = next(action for action in orchard["actions"] if action["action_id"] == "read_water_marks")
        self.assertEqual(water_marks["requires_state_values"]["orchard_channel"], ["flowing"])

        mill = json.loads(
            (ROOT / "data/survival/world_content/sites/south_crown_mill.json").read_text()
        )
        mill_layout = mill["visual_layout"]
        mill_base_water = [path for path in mill_layout["paths"] if path["family"] == "water"]
        mill_flow_water = mill_layout["state_paths"]["mill_wheel"]["turning"]
        self.assertEqual([path["width"] for path in mill_base_water], [1])
        self.assertTrue(mill_flow_water)
        self.assertTrue(all(path["family"] == "water" and path["width"] == 2 for path in mill_flow_water))
        wheel = next(prop for prop in mill_layout["props"] if prop.get("id") == "race_wheel")
        self.assertEqual(wheel["rotation_animation"]["state_key"], "mill_wheel")
        self.assertEqual(wheel["rotation_animation"]["state_value"], "turning")
        seized = next(
            variant
            for variant in mill_layout["state_props"]
            if variant["key"] == "mill_wheel" and variant["equals"] == "seized"
        )
        self.assertTrue(any(prop["id"] == "seized_race_deadfall" for prop in seized["props"]))

    def test_quarry_and_orchard_compositions_use_distinct_source_backed_visual_grammar(self) -> None:
        quarry = json.loads((ROOT / "data/survival/world_content/sites/south_quarry.json").read_text())
        q_layout = quarry["visual_layout"]
        q_frames = {prop["frame"] for prop in q_layout["props"]}
        self.assertTrue(
            {"lm_quarry_workface", "lm_ashwater_pump", "mill_wheel", "pipe_run", "pump_tank", "ore_skarn"}
            <= q_frames
        )
        self.assertTrue(q_layout["track_paths"])
        self.assertTrue(any(path["family"] == "road_stone" for path in q_layout["paths"]))
        powered = next(
            variant
            for variant in q_layout["state_props"]
            if variant["key"] == "quarry_deep_gate" and variant["equals"] == "open"
        )
        live_lamp = next(prop for prop in powered["props"] if prop["frame"] == "lamp")
        self.assertIn("local_light", live_lamp)
        self.assertTrue(powered["hide_ids"])
        self.assertEqual(quarry["source"]["canonical_cell"], [30, 280])

        orchard = json.loads(
            (ROOT / "data/survival/world_content/sites/south_orchard_ruin.json").read_text()
        )
        o_layout = orchard["visual_layout"]
        o_frames = {prop["frame"] for prop in o_layout["props"]}
        self.assertTrue(
            {"tree_orchard", "canopy_tree", "tree_dead", "lm_orchard_shed", "sluice_gate", "boardwalk_post", "pump_tank"}
            <= o_frames
        )
        self.assertGreaterEqual(sum(bool(prop.get("occludes_actor")) for prop in o_layout["props"]), 5)
        self.assertTrue(any(overlay["frame"].startswith("detail_water_ripple_")
                            for state in o_layout["state_overlays"]
                            for overlay in state["overlays"]))
        self.assertFalse(any(prop["frame"] == "herb_moonleaf"
                             for variant in o_layout["state_props"]
                             for prop in variant.get("props", [])))
        self.assertEqual(orchard["source"]["canonical_cell"], [140, 360])
        self.assertEqual(o_layout["state_paths"]["orchard_channel"]["flowing"][0]["width"], 2)

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
