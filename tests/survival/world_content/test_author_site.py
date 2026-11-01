"""Adversarial source-path checks independent of the wrapper generator output."""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

TOOL_PATH = Path(__file__).resolve().parents[3] / "tools/survival/world_content/author_site.py"
SPEC = importlib.util.spec_from_file_location("author_site", TOOL_PATH)
assert SPEC is not None and SPEC.loader is not None
AUTHOR_SITE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUTHOR_SITE)


class WrapperReferenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.data_dir = self.root / "data/survival/world_content/sites"
        self.scene_dir = self.root / "game/survival/world_content/scenes"
        self.data_dir.mkdir(parents=True)
        self.scene_dir.mkdir(parents=True)
        self.expected_source = self.data_dir / "south_quarry.json"
        self.site = {
            "site_id": "crown_south_quarry",
            "source": {"poi_id": "poi_crown_south_quarry"},
        }
        self.expected_source.write_text(json.dumps(self.site), encoding="utf-8")
        self.scene = self.scene_dir / "south_quarry.tscn"

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _write_reference(self, filename: str) -> None:
        self.scene.write_text(
            '[node name="POI" type="Node2D"]\n'
            f'definition_path = "res://data/survival/world_content/sites/{filename}"\n',
            encoding="utf-8",
        )

    def test_generator_uses_source_filename_not_identity_slug(self) -> None:
        generated = AUTHOR_SITE.wrapper_text(self.site, self.expected_source.name)
        self.assertIn("/sites/south_quarry.json", generated)
        self.assertNotIn("/sites/crown_south_quarry.json", generated)

    def test_missing_referenced_json_is_rejected_even_if_generation_would_match(self) -> None:
        # This reproduces the old wrapper bug; audit_wrapper reads the scene's actual path.
        self._write_reference("crown_south_quarry.json")
        errors = AUTHOR_SITE.audit_wrapper(self.scene, self.expected_source, self.site, self.root)
        self.assertTrue(any("referenced JSON does not exist" in error for error in errors), errors)

    def test_existing_but_wrong_poi_identity_is_rejected(self) -> None:
        wrong_path = self.data_dir / "crown_south_quarry.json"
        wrong_path.write_text(
            json.dumps({"site_id": "other", "source": {"poi_id": "poi_other"}}),
            encoding="utf-8",
        )
        self._write_reference(wrong_path.name)
        errors = AUTHOR_SITE.audit_wrapper(self.scene, self.expected_source, self.site, self.root)
        self.assertTrue(any("POI identity" in error for error in errors), errors)

    def test_correct_non_identity_filename_and_source_identity_are_accepted(self) -> None:
        self._write_reference(self.expected_source.name)
        errors = AUTHOR_SITE.audit_wrapper(self.scene, self.expected_source, self.site, self.root)
        self.assertEqual(errors, [])

    def test_resource_path_cannot_escape_project_root(self) -> None:
        self._write_reference("../../../../outside.json")
        errors = AUTHOR_SITE.audit_wrapper(self.scene, self.expected_source, self.site, self.root)
        self.assertTrue(any("escapes" in error for error in errors), errors)


if __name__ == "__main__":
    unittest.main()
