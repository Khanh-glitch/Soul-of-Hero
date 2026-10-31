"""A1/A3 material reconciliation decisions are explicit and provenance-preserving."""
from __future__ import annotations

import json

import jsonschema

import authoring as A
from validate_world import OUT


def _contract():
    return json.loads((OUT / "a1_a3_material_decisions.json").read_text())


def test_eight_alias_decisions_and_twelve_missing_items():
    c = _contract()
    assert c["schema"] == "soh.world.a1_a3_material_decisions.v1"
    assert c["a3_code_changed_by_a1"] is False
    assert c["counts"] == {"alias_decisions": 8, "missing_items": 12}
    assert {d["material_key"] for d in c["alias_decisions"]} == {
        "bog_iron", "glacial_iron", "fibre", "hardwood", "frost_resin", "peat", "rare_herb", "venom_sac"
    }
    assert {m["material_key"] for m in c["missing_items"]} == {
        "abyssal_pearl", "aether_crystal", "basalt", "copper", "honey", "limestone",
        "obsidian", "pearl", "rubber_sap", "salt", "silica_sand", "storm_glass"
    }
    for d in c["alias_decisions"]:
        assert d["decision"] in {"APPROVE", "REJECT", "SPLIT", "DEFER"}
        assert d["priority"] in {"P0", "P1", "P2", "P3"}
        assert d["reason"] and d["a3_action"]
    for m in c["missing_items"]:
        assert m["first_hour_blocking"] is False
        assert m["dependency"]


def test_alias_decisions_preserve_a1_provenance_renewal_and_sinks():
    c = _contract()
    for d in c["alias_decisions"]:
        mat = A.MATERIALS[d["material_key"]]
        assert d["preserved_provenance"] == mat[1]
        assert d["preserved_renewal"] == mat[4]
        assert d["preserved_sinks"] == mat[3]
    by_key = {d["material_key"]: d for d in c["alias_decisions"]}
    assert by_key["hardwood"]["decision"] == "REJECT"
    assert by_key["frost_resin"]["decision"] == "SPLIT"
    assert by_key["venom_sac"]["decision"] == "SPLIT"
    assert by_key["peat"]["decision"] == "SPLIT"
    assert by_key["fibre"]["decision"] == "SPLIT"
    assert by_key["rare_herb"]["decision"] == "SPLIT"


def test_material_decision_schema_and_negative_mutation():
    c = _contract()
    schema = json.loads((OUT / "schemas" / "material_decisions.schema.json").read_text())
    jsonschema.validate(c, schema)
    bad = json.loads(json.dumps(c))
    bad["missing_items"] = bad["missing_items"][:11]
    try:
        jsonschema.validate(bad, schema)
        raised = False
    except jsonschema.ValidationError:
        raised = True
    assert raised, "dropping a missing item must fail the decision schema"
