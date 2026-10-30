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


def test_validator_and_all_region_presentations(art):
    result = vwa.validate()
    assert result["ok"], result["errors"]
    assert result["presentations"] == 11
    assert set(result["profiles"]) == {"ashen_crown", "amberwood", "frost_crown", "mirrormere", "glasswind_coast", "ember_steppe", "saffron_coast", "verdant_fold", "pearl_mangroves", "sunken_orchard", "ashwater_fen"}
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


def test_causal_landforms_and_road_overlays(art):
    for doc in art["docs"].values():
        assert doc["terrain_method"] == "AUTHORED_LANDFORMS_ON_SOURCE_SURFACES_NO_NOISE_BOUNDARIES"
        assert doc["landforms"] and all(lf["reason"] and lf["cells"] > 0 for lf in doc["landforms"])
        assert doc["counts"]["road_overlays"] == doc["counts"]["road_cells"]
        assert not any(frame.startswith("road_") for row in doc["ground"]["rows"] for frame in row)
        for overlay in doc["overlays"]:
            assert overlay["layer"] in {"road", "bank", "boardwalk", "bridge", "causeway"}
            assert overlay["frame"] in art["atlas"]["terrain"]
    compiler = (cwa.ROOT / "tools/survival/worldgen/compile_world_art.py").read_text()
    assert "h01(x // 6" not in compiler and "h01(x // 5" not in compiler


def test_runtime_hardening_and_gold_light_isolation(art):
    runtime = (cwa.ROOT / "game/world_art/world_art_presentation.gd").read_text()
    for token in ("func bind_focus", "func _process", "occlusion.step(delta)", 'set_meta("frame_name"',
                  "WORLD_LIGHT_MASK", "_count_collisions", "return _fail", "func clear"):
        assert token in runtime
    assert '"collision_bodies": 0' not in runtime
    fixture = (cwa.ROOT / "tests/survival/world/world_art_native_test.gd").read_text()
    for token in ("bind_focus", "logical_sha256", "world_sparkle", "inherited VFX keeps default light mask",
                  "rebuild is idempotent", "invalid presentation rejected atomically"):
        assert token in fixture
    corridor_fixture = (cwa.ROOT / "tests/survival/world/corridor_native_test.gd").read_text()
    assert "--world-art" in corridor_fixture and "world-art overlay adds zero collision bodies" in corridor_fixture


def test_a8_shell_visuals_are_compact_shared_and_doorway_clear(art):
    shells = cwa.load(cwa.ART / "a8_shell_visuals.v1.json")
    assert shells["atlas_sha256"] == hashlib.sha256((cwa.ART / "atlas.v1.json").read_bytes()).hexdigest()
    assert {s["poi_id"] for s in shells["sites"]} == {"poi_crown_south_quarry", "poi_crown_south_orchard", "poi_crown_south_mill"}
    for site in shells["sites"]:
        assert site["bounds_px"] == [128, 128] and site["tile_px"] == 16
        assert site["collision_change"] is False and site["new_poi_count"] == 0
        assert len(site["ground_rows"]) == 8 and all(len(r) == 8 for r in site["ground_rows"])
        door = site["doorway_clear_rect_px"]
        for prop in site["props"]:
            assert prop["frame"] in art["atlas"]["props"]
            x, y = prop["local_px"]
            assert not (door[0] <= x < door[0] + door[2] and door[1] <= y < door[1] + door[3])
    assert "A8-VIS-07" in {d["id"] for d in art["contract"]["observed_divergences"]}
    assert art["contract"]["source_review"]["head_sha"] == "5ccf7b3f"


def test_art_compile_does_not_touch_navigation_chunks_or_ten_entrances(art):
    plan_path = cwa.WORLD / "world_plan.v1.json"
    lock_path = cwa.WORLD / "baseline_lock.json"
    plan = cwa.load(plan_path)
    lock = cwa.load(lock_path)
    protected = [plan_path, lock_path] + [cwa.WORLD / m["path"] for m in plan["chunk_manifest"]]
    before = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
    cwa.compile_all()
    after = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
    assert before == after
    assert len(lock["landmarks"]) == 10
    assert all(lm["reachable_closed_shortcuts"] for lm in lock["landmarks"])
    corridor = cwa.load(cwa.WORLD / "corridor/crown_roadside.corridor.v1.json")
    assert corridor["route"]["required_nav_cells"]
    for doc in art["docs"].values():
        assert doc["collision_change"] is False and doc["stand_change"] is False and doc["new_poi_count"] == 0


def test_notes_crate_distinct_from_scrap_cache(art):
    assert "cache_notes" in art["atlas"]["props"]
    assert "cache_notes" in art["grammar"]["semantic_roles"]["supply_cache"]["frames"]
    doc = art["docs"]["crown_roadside_visual_treatment"]
    by_inst = {p["instance_id"]: p["frame"] for p in doc["props"] if "instance_id" in p}
    assert by_inst["si:r_ashen_crown:roadside_supply:01"] == "cache_notes"
    assert by_inst["si:r_ashen_crown:roadside_supply:02"] == "cache_closed"
    assert by_inst["si:r_ashen_crown:roadside_supply:03"] == "cache_closed"
    assert cwa.FRAME_ROLE["cache_notes"] == "supply_cache"


def test_cardinal_shore_transitions_present(art):
    assert any(k.startswith("shore_") for k in art["atlas"]["terrain"])
    used = set()
    for doc in art["docs"].values():
        for row in doc["ground"]["rows"]:
            used.update(f for f in row if f.startswith("shore_"))
    assert used, "no cardinal shore transition used in any treatment"


def test_bind_focus_excludes_focus_subtree(art):
    runtime = (cwa.ROOT / "game/world_art/world_art_presentation.gd").read_text()
    assert "props_root.remove_child(focus)" in runtime
    assert "props_root.add_child(focus)" in runtime


def test_first_hour_route_walkability_proof(art):
    route = cwa.load(cwa.WORLD / "corridor/first_hour_route.v1.json")
    p = route["proof"]
    assert p["base_path_exists"] and p["outbound_contiguous"] and p["all_route_cells_walkable"]
    assert p["no_one_tile_trap"] and p["single_cell_cut_vertices"] == []
    assert p["ten_thresholds_preserved"] and p["body_clearance_margin_px"] >= 2
    assert route["notes_crate_instance"] == "si:r_ashen_crown:roadside_supply:01"
    assert route["waystation_cache_interaction_alias"] == "node_waystation_cache"
    assert {s["id"] for s in route["camera_landmark_states"]} == {"home_first", "explore_first", "return"}


def test_mount_bundle_consumer_validation(art):
    import validate_mount_bundle as vmb
    result = vmb.validate()
    assert result["ok"], result["errors"]
    assert result["treatments"] == 11


def test_avfx_lighting_contract_and_contrast_floor(art):
    contract = cwa.load(cwa.ART / "avfx_lighting_contract.v1.json")
    assert contract["world_light_cull_mask"] == 2 and contract["inherited_vfx_light_mask"] == 1
    assert contract["worst_case"]["contrast_ratio"] >= 1.6
    assert contract["measurements"] and any("Gold" in p or "gold" in p for p in contract["pending"])


def test_region_windows_are_distinct_canonical_and_water_safe(art):
    plan = cwa.load_plan()
    regions = {r["region_id"] for r in plan["regions"]}
    docs = [d for d in art["docs"].values() if d["treatment_id"].endswith("_region_window")]
    assert len(docs) == 8
    assert {d["region_id"] for d in docs} <= regions
    nodes = {n["node_id"]: n for n in plan["resource_nodes"]}
    pois = {p["poi_id"]: p for p in plan["pois"]}
    frame_sets = []
    for d in docs:
        assert d["kind"] == "biome_study"
        assert d["ground_rules"] if "ground_rules" in d else True
        for p in d["props"]:
            if "node_id" in p:
                assert nodes[p["node_id"]]["cell"] == p["cell"]
                assert nodes[p["node_id"]]["region_id"] == d["region_id"]
            if "poi_id" in p:
                assert pois[p["poi_id"]]["cell"] == p["cell"]
        # day and night views exist
        times = [v.get("time_of_day", 0.35) for v in d["capture_views"]]
        assert min(times) < 0.5 and max(times) > 0.7
        frame_sets.append({p["frame"] for p in d["props"]})
    # no two regional windows share the exact prop vocabulary
    for i in range(len(frame_sets)):
        for j in range(i + 1, len(frame_sets)):
            assert frame_sets[i] != frame_sets[j]


def test_legacy_first_hour_pixel_payload_preserved(art):
    import subprocess
    for tid in ("crown_roadside_visual_treatment", "amberwood_apothecary_herb_margin", "frost_crown_shrine_skarn"):
        path = f"data/survival/world/art/compiled/{tid}.presentation.v1.json"
        old = json.loads(subprocess.check_output(["git", "show", f"ad39bde6:{path}"]))
        new = art["docs"][tid]
        for key in ("ground", "overlays", "props", "lights", "capture_views", "ambient_day", "ambient_night"):
            assert old[key] == new[key], f"{tid} pixel payload drifted: {key}"
