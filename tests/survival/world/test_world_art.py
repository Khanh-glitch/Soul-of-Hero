from __future__ import annotations

import hashlib
import json

import pytest

import compile_world_art as cwa
import validate_world_art as vwa


@pytest.fixture(scope="module")
def art():
    cwa.compile_all()
    return {
        "atlas": cwa.load(cwa.ART / "atlas.v1.json"),
        "grammar": cwa.load(cwa.ART / "world_art_grammar.v1.json"),
        "index": cwa.load(cwa.ART / "presentations.v1.json"),
        "contract": cwa.load(cwa.ART / "a8_visual_contract.v1.json"),
        "docs": {e["treatment_id"]: cwa.load(cwa.ROOT / e["path"]) for e in cwa.load(cwa.ART / "presentations.v1.json")["presentations"]},
    }


def test_atlas_is_original_unscaled_and_grid_aligned(art):
    atlas = art["atlas"]
    assert atlas["tile_px"] == 16
    assert atlas["perspective"].startswith("top-down three-quarter")
    for sheet in ("terrain", "props"):
        p = cwa.ROOT / "assets/environment/survival_world" / f"{sheet}.png"
        assert hashlib.sha256(p.read_bytes()).hexdigest() == atlas["file_sha256"][sheet]
    for r in atlas["terrain"].values():
        assert r[2:] == [16, 16] and r[0] % 16 == 0 and r[1] % 16 == 0
    assert len(atlas["inherited_frames"]) == 9
    for meta in atlas["inherited_frames"].values():
        assert meta["license"] == "original" and meta["decision"] == "REUSE_UNSCALED"
    assert not any("cainos" in k.lower() for k in atlas["props"])


def test_grammar_separates_supply_harvestable_waystation_scenery_danger(art):
    roles = art["grammar"]["semantic_roles"]
    assert "cache_closed" in roles["supply_cache"]["frames"]
    assert "cache_closed" not in roles["ordinary_harvestable"]["frames"]
    assert "lm_waystation" in roles["major_waystation"]["frames"]
    assert "lm_waystation" not in roles["background_scenery"]["frames"]
    assert "cairn_warning" in roles["physical_danger"]["frames"]
    for spec in roles.values():
        for frame in spec["frames"]:
            assert frame in art["atlas"]["props"]


def test_validator_and_three_presentations(art):
    result = vwa.validate()
    assert result["ok"], result["errors"]
    assert result["presentations"] == 3
    assert set(result["profiles"]) == {"ashen_crown", "amberwood", "frost_crown"}
    for doc in art["docs"].values():
        assert doc["production_native_playable"] is False
        assert doc["collision_change"] is False and doc["stand_change"] is False and doc["economy_change"] is False
        assert doc["new_poi_count"] == 0


def test_corridor_visual_preserves_canonical_instances_and_route(art):
    doc = art["docs"]["crown_roadside_visual_treatment"]
    corridor = cwa.load(cwa.WORLD / "corridor/crown_roadside.corridor.v1.json")
    assert doc["pins"]["corridor_sha256"] == hashlib.sha256((cwa.WORLD / "corridor/crown_roadside.corridor.v1.json").read_bytes()).hexdigest()
    required = {tuple(c) for c in corridor["route"]["required_nav_cells"]}
    caches = [p for p in doc["props"] if p["role"] == "supply_cache"]
    assert len(caches) == 3
    inst = {i["instance_id"]: i["cell"] for i in corridor["instances"]}
    for p in caches:
        assert inst[p["instance_id"]] == p["cell"]
    for p in doc["props"]:
        if p["role"] != "supply_cache":
            assert tuple(p["cell"]) not in required
    replaced = {p["replaces"] for p in doc["props"] if p["source"] == "corridor_decor"}
    assert len(replaced) >= 1
    assert sum(1 for p in doc["props"] if p["source"] == "corridor_decor") == len(corridor["decor"])


def test_biome_studies_are_genuinely_contrasting_and_canonical(art):
    amber = art["docs"]["amberwood_apothecary_herb_margin"]
    frost = art["docs"]["frost_crown_shrine_skarn"]
    assert amber["biome_profile"] == "amberwood" and frost["biome_profile"] == "frost_crown"
    ag = {f for row in amber["ground"]["rows"] for f in row}
    fg = {f for row in frost["ground"]["rows"] for f in row}
    assert len(ag & fg) / len(ag | fg) < 0.35
    ap = {p["frame"] for p in amber["props"]}
    fp = {p["frame"] for p in frost["props"]}
    assert "tree_amber" in ap and "herb_moonleaf" in ap
    assert "tree_frost" in fp and "ore_skarn" in fp
    assert not (ap & fp)
    plan = cwa.load_plan()
    nodes = {n["node_id"]: n for n in plan["resource_nodes"]}
    for doc in (amber, frost):
        for p in doc["props"]:
            if "node_id" in p:
                assert nodes[p["node_id"]]["cell"] == p["cell"]


def test_a8_visual_contract_is_executable_and_records_divergences(art):
    contract = art["contract"]
    req = contract["requirements"]
    assert req["tile_px"] == art["atlas"]["tile_px"]
    assert req["prop_scale"] == 1.0 and req["integer_scale_only"] is True
    assert req["per_site_palette_swaps_allowed"] is False
    ids = {d["id"] for d in contract["observed_divergences"]}
    assert {"A8-VIS-01", "A8-VIS-02", "A8-VIS-03", "A8-VIS-05"} <= ids
    assert contract["authority_boundary"].startswith("A1 supplies visual/spatial conformance data only")


def test_lighting_and_capture_views(art):
    for doc in art["docs"].values():
        assert doc["ambient_day"] != doc["ambient_night"]
        for view in doc["capture_views"]:
            c = view["center_cell"]
            o = doc["window"]["origin_cell"]
            s = doc["window"]["size_cells"]
            assert o[0] <= c[0] < o[0] + s[0] and o[1] <= c[1] < o[1] + s[1]
    crown = art["docs"]["crown_roadside_visual_treatment"]
    assert crown["lights"] and any(v["id"] == "waystation_night" for v in crown["capture_views"])
    fixture = (cwa.ROOT / "tests/survival/world/world_art_native_test.gd").read_text()
    for token in ("1280", "2560", "3840", "OverworldOcclusion", "zero collision bodies"):
        assert token in fixture


def test_compile_is_deterministic(art):
    before = {e["treatment_id"]: e["sha256"] for e in art["index"]["presentations"]}
    cwa.compile_all()
    after = {e["treatment_id"]: e["sha256"] for e in cwa.load(cwa.ART / "presentations.v1.json")["presentations"]}
    assert before == after
