"""Oracle tests: each verdict must be falsifiable from outside the owner's prose.

These are the round-5 additions. Every oracle answers a question whose answer
does not come from the file being judged:

* `engine_api` reads the engine's own static-method list, so an invented
  `Vector2.from_array` is caught even on a green import-only CI step;
* `save_fidelity` reads Godot's `JSON.stringify` contract, so "reload gives back
  exactly what I wrote" becomes a computed condition;
* `knowledge_gate` walks the real recipe/source graph;
* `authorization_claims` refuses a quantity that is only *called* authorized.

None of these run Godot, and none of them may claim S4.
"""
from __future__ import annotations

import json
import re
import unittest

import _support as support

from sohbalance import oracle, product


def _convert_from_array(text: str) -> str:
    """A8's smallest safe correction, applied with balanced parens.

    ``Vector2.from_array(X)`` becomes ``Vector2((X)[0], (X)[1])``. Real call sites
    pass nested calls and span lines, so a flat regex is not enough.
    """
    needle = "Vector2.from_array("
    out = []
    index = 0
    while True:
        start = text.find(needle, index)
        if start < 0:
            out.append(text[index:])
            break
        out.append(text[index:start])
        cursor = start + len(needle)
        depth = 1
        while cursor < len(text) and depth:
            if text[cursor] == "(":
                depth += 1
            elif text[cursor] == ")":
                depth -= 1
            cursor += 1
        arg = text[start + len(needle) : cursor - 1]
        out.append(f"Vector2(({arg})[0], ({arg})[1])")
        index = cursor
    return "".join(out)


def _texts():
    texts, manifest = product.load_snapshot(support.REPO_ROOT)
    return texts, manifest


class EngineApiToolsTests(unittest.TestCase):
    """The audit itself: what counts as a static call, and what does not."""

    def test_the_engine_table_is_small_and_pinned(self) -> None:
        api = oracle.engine_api()
        self.assertIn("Vector2", api["static_methods"])
        # Vector2 has exactly one static method; the list is the whole defence.
        self.assertEqual(sorted(api["static_methods"]["Vector2"]), ["from_angle"])
        provenance = api.get("provenance") or {}
        self.assertIn("Godot", str(provenance.get("source")))
        self.assertTrue(provenance.get("url_template"))

    def test_an_invented_static_call_is_flagged(self) -> None:
        audit = oracle.api_audit({"x.gd": "var p := Vector2.from_array(arr)\n"})
        self.assertEqual(audit["verdict"], "UNKNOWN_ENGINE_STATIC")
        self.assertEqual(audit["unknown_call_count"], 1)
        self.assertFalse(audit["unknown_calls"][0]["is_engine_static"])

    def test_a_real_static_call_and_a_constructor_are_not_flagged(self) -> None:
        audit = oracle.api_audit(
            {
                "x.gd": "var v := Vector2.from_angle(0.5)\nvar w := Vector2.new(1, 2)\nvar u := Vector2(3, 4)\n"
            }
        )
        self.assertEqual(audit["verdict"], "ENGINE_API_CONSISTENT")
        self.assertEqual(audit["unknown_call_count"], 0)

    def test_a_comment_does_not_count_as_a_call(self) -> None:
        audit = oracle.api_audit({"x.gd": "# Vector2.from_array(arr) is what we used to do\nvar a := 1\n"})
        self.assertEqual(audit["unknown_call_count"], 0)

    def test_only_gdscript_is_scanned(self) -> None:
        audit = oracle.api_audit({"x.md": "Vector2.from_array(arr)\n"})
        self.assertEqual(audit["static_call_count"], 0)


class EngineApiOracleTests(unittest.TestCase):
    """The A8 finding, and the test that turns it green."""

    def test_a8_call_sites_disappear_after_the_conversion(self) -> None:
        texts, _manifest = _texts()
        gd = {key: text for key, text in texts.items() if key.endswith(".gd")}
        before = oracle.api_audit(gd)
        self.assertEqual(before["verdict"], "UNKNOWN_ENGINE_STATIC")
        self.assertTrue(before["unknown_call_count"] > 0)
        # Every flagged call at this pin is the same invented static method.
        self.assertEqual(
            sorted({row["call"] for row in before["unknown_calls"]}),
            ["Vector2.from_array"],
        )

        # A8's smallest safe correction, applied mechanically: the array becomes a
        # two-element constructor. Nothing else about the scenes changes.
        converted = {key: _convert_from_array(text) for key, text in gd.items()}
        after = oracle.api_audit(converted)
        self.assertEqual(after["verdict"], "ENGINE_API_CONSISTENT")
        self.assertEqual(after["unknown_call_count"], 0)
        # The conversion removed only the flagged sites: the number of legitimate
        # static calls is unchanged.
        self.assertEqual(
            after["static_call_count"] - after["unknown_call_count"],
            before["static_call_count"] - before["unknown_call_count"],
        )

    def test_a_renamed_helper_does_not_hide_the_call(self) -> None:
        # Wrapping the invented call in a local function is still an invented call.
        audit = oracle.api_audit(
            {"x.gd": "func _pos(a):\n\treturn Vector2.from_array(a)\n\nfunc _use():\n\treturn _pos([1, 2])\n"}
        )
        self.assertEqual(audit["unknown_call_count"], 1)
        self.assertEqual(audit["unknown_calls"][0]["line"], 2)


class SaveFidelityOracleTests(unittest.TestCase):
    """The precision contract, both directions."""

    def test_whole_document_reload_is_impossible_to_prove_without_full_precision(self) -> None:
        lossy = oracle.save_fidelity(
            {
                "save.gd": '\tfile.store_string(JSON.stringify(snapshot, "\\t"))\n',
            }
        )
        self.assertEqual(lossy["verdict"], "FLOAT_ROUND_TRIP_NOT_GUARANTEED")
        self.assertEqual(lossy["authoritative_writer_count"], 1)
        self.assertEqual([row["file"] for row in lossy["lossy_writers"]], ["save.gd"])

        # The owner's own one-line fix, which A0 has already written on 51f2cce8.
        exact = oracle.save_fidelity(
            {
                "save.gd": '\tfile.store_string(JSON.stringify(snapshot, "\\t", false, true))\n',
            }
        )
        self.assertEqual(exact["verdict"], "ROUND_TRIP_EXACT")
        self.assertEqual(exact["lossy_writer_count"], 0)

    def test_a_telemetry_writer_is_recorded_but_not_graded(self) -> None:
        audit = oracle.save_fidelity(
            {
                "save.gd": '\tfile.store_string(JSON.stringify(snapshot, "\\t", false, true))\n',
                "telemetry.gd": '\tprint(JSON.stringify(event, "", true))\n',
            }
        )
        self.assertEqual(audit["verdict"], "ROUND_TRIP_EXACT")
        self.assertEqual(len(audit["writers"]), 2)
        self.assertEqual(audit["authoritative_writer_count"], 1)

    def test_the_pinned_writer_is_the_one_being_graded(self) -> None:
        texts, _manifest = _texts()
        audit = oracle.save_fidelity(texts)
        self.assertEqual(audit["authoritative_writer_count"], 1)
        self.assertEqual(audit["verdict"], "ROUND_TRIP_EXACT")
        graded = [row for row in audit["writers"] if row["authoritative"]]
        self.assertEqual(len(graded), 1)
        self.assertEqual(graded[0]["file"], "a0.save_service.gd")
        self.assertTrue(graded[0]["full_precision"])
        # The non-authoritative writers are recorded but can never decide the
        # verdict - including the signature writer in the same file.
        self.assertGreater(len(audit["writers"]), 1)
        ungraded = [row for row in audit["writers"] if not row["authoritative"]]
        self.assertTrue(any(row["file"] == "a0.save_service.gd" for row in ungraded))
        self.assertTrue(all(row["line"] != 2459 for row in ungraded))


class KnowledgeGateOracleTests(unittest.TestCase):
    """The first-hour ladder, computed from the graph."""

    def test_the_first_station_has_exactly_one_non_circular_seed(self) -> None:
        audit = support.oracle_payload()["knowledge_gate"]
        self.assertEqual(audit["verdict"], "SEEDED_ONLY_BY_LOOT")
        self.assertEqual(audit["non_circular_spare_recipes"], [])
        self.assertEqual(sorted(audit["circular_spare_recipes"]), [
            "make_spares",
            "study_axe_insignia",
            "study_predator_jaw",
        ])
        self.assertEqual(sorted(audit["spare_loot_sources"]), ["road_supplies"])

    def test_the_only_seed_is_behind_the_mount_that_does_not_exist(self) -> None:
        texts, _manifest = _texts()
        audit = support.oracle_payload()["knowledge_gate"]
        self.assertEqual(audit["spare_loot_sources"]["road_supplies"]["yield_per_claim"], 2)
        self.assertEqual(audit["kit_spares_required"], 3)
        self.assertEqual(audit["claims_needed_for_first_station"], 2)
        self.assertGreater(audit["spare_loot_sources"]["road_supplies"]["cooldown_seconds"], 0)
        self.assertTrue(any("waystation" in key for key in texts))

    def test_a_hand_recipe_for_spares_would_break_the_cycle(self) -> None:
        # Falsifiability: if a non-station recipe produced spares, the verdict moves.
        class _Model:
            recipes = {
                "research_kit": {"station": "workbench", "inputs": {"knowledge_spares": 3}, "outputs": {}},
                "make_spares": {"station": "hand", "inputs": {"oak_wood": 2}, "outputs": {"knowledge_spares": 1}},
            }
            sources = {"road_supplies": {"item_id": "knowledge_spares", "yield_per_claim": 2}}

        audit = oracle.knowledge_gate(_Model(), {"resources": {}, "pieces": {}})
        self.assertEqual(audit["verdict"], "SEEDED_BY_LOOT_AND_RECIPE")
        self.assertEqual(audit["non_circular_spare_recipes"], ["make_spares"])


class AuthorizationOracleTests(unittest.TestCase):
    """A quantity is not authorized because a file says so."""

    def test_a_claim_with_no_a3_row_is_rejected(self) -> None:
        a3 = {"sources": {"road_supplies": {"yield_per_claim": 2}}}
        texts = {
            "a8.candidate.json": json.dumps(
                {"actions": [{"source_id": "road_supplies", "yield": 5, "authorization": "AUTHORIZED_BY_A3"}]}
            )
        }
        audit = oracle.authorization_claims(texts, {"a3.sources.json": json.dumps(a3)})
        self.assertEqual(audit["verdict"], "UNBACKED_AUTHORIZATION")
        self.assertTrue(audit["rejected"])

    def test_the_pinned_tree_has_no_unbacked_claim(self) -> None:
        audit = support.oracle_payload()["authorization"]
        self.assertEqual(audit["verdict"], "NO_UNBACKED_AUTHORIZATION")
        self.assertEqual(audit["rejected"], [])


if __name__ == "__main__":
    unittest.main()
