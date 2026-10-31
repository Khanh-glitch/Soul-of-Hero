extends RefCounted
## Explicit illustrative data, not a definition of A0/A1/A3 APIs.
static func snapshot() -> Dictionary:
	return {
		"revision": "fixture-1", "provenance": "FIXTURE_PROJECTION", "container_id": "fixture-chest", "transfer_enabled": true,
		"recipes": [
			{"id":"core_formula", "name":"Ember Core [fixture]", "revealed":true, "knowledge":"recipe", "formula_learned":false, "station":"Research table", "can_research":false, "blocked_reason":"Requires a specimen and research material.", "ingredients":[{"name":"Iron Scrap", "have":0, "need":2, "source":"Abandoned Supplies"}]},
			{"id":"bandage", "name":"Field Bandage [fixture]", "revealed":true, "knowledge":"starter", "formula_learned":true, "station":"Worktable", "can_craft":true, "ingredients":[{"name":"Reed Fibre", "have":4, "need":2}]},
			{"id":"secret", "name":"SECRET FORMULA", "revealed":false, "knowledge":"starter", "formula_learned":true, "can_craft":true},
		],
		"bag": [{"id":"oak_wood#1", "stack_key":"oak_wood#1", "item_id":"oak_wood", "name":"Oak Wood", "count":8}],
		"chest": [{"id":"iron_scrap", "name":"Iron Scrap", "count":2}],
		"places": [
			{"id":"poi_crown_waystation", "poi_id":"poi_crown_waystation", "name":"Ashen Waystation [fixture]", "revealed":true, "position":Vector2(408.0 / 1024.0, 200.0 / 768.0), "route":"Illustrative route status only", "hazard_id":"", "activity":"Teach salvage → spares → seal grammar", "region_id":"r_ashen_crown", "material_keys":["salvage", "iron"], "required_capabilities":[], "content_readiness":"INTERACTION_SPEC_AUTHORED_NOT_NATIVE", "status":"AUTHORED_PLAN_NOT_NATIVE_INTEGRATED"},
			{"id":"secret_place", "name":"SECRET PLACE", "revealed":false, "position":Vector2(0.8,0.2)},
		],
		"cores": [
			{"id":"soh_i_000000000011_a1c0ffee", "instance_id":"soh_i_000000000011_a1c0ffee", "item_id":"core_ember", "formula_id":"core_formula", "name":"Ember Core [fixture]", "uses":3, "max_uses":8, "condition":72, "max_condition":100, "location":"bag", "equipped":false, "formula_learned":false, "can_equip":true},
			{"id":"soh_i_000000000012_deadbeef", "instance_id":"soh_i_000000000012_deadbeef", "item_id":"core_frost", "formula_id":"core_formula", "name":"Spent Frost Core [fixture]", "uses":0, "max_uses":8, "condition":21, "max_condition":100, "location":"bag", "equipped":false, "formula_learned":false, "can_equip":true},
		],
		"hazards": [{"id":"hz_crown_heat", "hazard_id":"hz_crown_heat", "name":"Legacy crucible basin [fixture]", "revealed":true, "kind":"heat", "severity":2, "requires":"cap_filter", "region_id":"r_ashen_crown", "status":"AUTHORED_CONTRACT_NOT_NATIVE_INTEGRATED"}, {"name":"SECRET HAZARD", "revealed":false}],
		"capabilities": [{"id":"cap_filter", "kind":"equipment", "source_poi":"poi_amberwood_apothecary", "owned":false, "status_reason":"Capability ownership awaits the A0/A3 runtime projection."}],
		"recovery": {"anchor":"Home bed [fixture]", "bed_status":"Active", "bag_status":"Dropped near Old Road", "preserved":"Learned formulas", "dropped":"Carried materials"},
	}
