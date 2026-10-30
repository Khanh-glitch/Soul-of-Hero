extends RefCounted
## Read-only fixture assembly from pinned owner source inputs in the temporary CI composition.
## Counts, discovery, bed activation and inventory are scenario fixtures, never runtime outcomes.

const A1_ROOT := "res://.a6-contract-inputs/a1/world/"
const A3_ROOT := "res://.a6-contract-inputs/a3/"


static func snapshot() -> Dictionary:
	var a0 := _json("res://data/survival/survival_catalog.json")
	var a1_route := _json(A1_ROOT + "poi_route_graph.json")
	var a1_hazards := _json(A1_ROOT + "hazard_capability_contracts.json")
	var a1_materials := _json(A1_ROOT + "material_source_contracts.json")
	var a3_items := _json(A3_ROOT + "items/items.json")
	var a3_recipes := _json(A3_ROOT + "recipes/recipes.json")
	var a3_research := _json(A3_ROOT + "recipes/research.json")
	var a3_stations := _json(A3_ROOT + "recipes/stations.json")
	if a0.is_empty() or a1_route.is_empty() or a1_hazards.is_empty() or a1_materials.is_empty():
		return {}
	if (
		a3_items.is_empty()
		or a3_recipes.is_empty()
		or a3_research.is_empty()
		or a3_stations.is_empty()
	):
		return {}

	var resources: Dictionary = a0.get("resources", {})
	var items: Dictionary = a0.get("items", {})
	var pieces: Dictionary = a0.get("pieces", {})
	var pois: Array = a1_route.get("pois", [])
	var waystation := _by_id(pois, "poi_crown_waystation")
	var relay := _by_id(pois, "poi_crown_relay_shed")
	var edges: Array = a1_route.get("route_graph", {}).get("edges", [])
	var safe_route := _by_id(edges, "rt_crown_safe_approach", "route_id")
	var shortcut := _by_id(edges, "rt_east_seam", "route_id")
	var core_item: Dictionary = a3_items.get("items", {}).get("core_ember", {})
	var recipe_catalog: Dictionary = a3_recipes.get("recipes", {})
	var research_catalog: Dictionary = a3_research.get("technologies", {})
	var station_catalog: Dictionary = a3_stations.get("stations", {})
	var source_refs := _source_refs()
	if source_refs.is_empty():
		return {}
	if waystation.is_empty() or relay.is_empty() or safe_route.is_empty() or shortcut.is_empty():
		return {}
	if core_item.is_empty() or not recipe_catalog.has("craft_core_ember"):
		return {}

	var hazard_records: Array = a1_hazards.get("hazards", [])
	var material_records: Array = a1_materials.get("nodes", [])
	var salvage_material := _material_by_key(material_records, "salvage")
	var core_instance := {
		"instance_id": "soh_i_000000000011_a1c0ffee",
		"item_id": "core_ember",
		"location": "satchel",
		"condition": 61,
		"max_condition": int(core_item.get("max_condition", 100)),
		"uses": 5,
		"max_uses": int(core_item.get("max_uses", 8)),
		"revision": 3,
		"origin": "fixture: specimen_ember",
	}

	return {
		"schema": "soh.ui.journey.fixture.v1",
		"fixture_label": "A6 READ-ONLY SCENARIO FIXTURE — NOT LIVE GAMEPLAY",
		"source_refs": {"a0": source_refs.get("A0", ""), "a1": source_refs.get("A1", ""), "a3": source_refs.get("A3", "")},
		"a0":
		{
			"catalog_status": String(a0.get("status", "Unknown")),
			"scrap_source": resources.get("scrap_pile", {}).duplicate(true),
			"wood_source": resources.get("oak_tree", {}).duplicate(true),
			"scrap_item": items.get("iron_scrap", {}).duplicate(true),
			"wood_item": items.get("oak_wood", {}).duplicate(true),
			"bed_piece": pieces.get("bed_wood", {}).duplicate(true),
			"fixture_inventory": {"oak_wood": 3, "iron_scrap": 0},
			"fixture_bed":
			{
				"entity_id": "fixture_bed_wood_01",
				"piece": "bed_wood",
				"status": "FIXTURE_VALIDATED_ONLY",
				"room_id": "fixture_room_01",
				"safe_wake_cell": true,
				"activation_receipt": "fixture-only; A0 transaction not executed by A6",
			},
			"fixture_death":
			{
				"pending_death": "death_7",
				"spawn_anchor": "fixture_bed_wood_01",
				"bag":
				{
					"entity_id": "death_7",
					"region": "hollow_marches",
					"stacks":
					{
						"oak_stack_1": {"item_id": "oak_wood", "quantity": 2},
						"scrap_stack_1": {"item_id": "iron_scrap", "quantity": 1}
					}
				},
				"respawn_status": "HOST RESPONSE REQUIRED — no respawn invoked",
				"recovery_status":
				"After respawn only; full inventory rejects all-or-none recovery and leaves the bag",
			},
		},
		"a1":
		{
			"waystation": waystation.duplicate(true),
			"relay": relay.duplicate(true),
			"safe_route": safe_route.duplicate(true),
			"shortcut": shortcut.duplicate(true),
			"salvage_material_contract": salvage_material,
			"hazard_contract_count": hazard_records.size(),
			"discovery_fixture": {"waystation": true, "relay": true, "known_hazard_ids": []},
		},
		"a3":
		{
			"core_item": core_item.duplicate(true),
			"core_instance": core_instance,
			"research_recipe": recipe_catalog.get("craft_core_ember", {}).duplicate(true),
			"craft_recipe": recipe_catalog.get("craft_core_ember", {}).duplicate(true),
			"reconstruction_recipe": recipe_catalog.get("rebuild_core_ember", {}).duplicate(true),
			"technology": research_catalog.get("tech_core_binding", {}).duplicate(true),
			"research_station": station_catalog.get("research", {}).duplicate(true),
			"stations_status": String(a3_stations.get("status", "Unknown")),
			"workbench_tier_2": station_catalog.get("advanced_workbench", {}).duplicate(true),
			"fixture_formula_learned": false,
			"fixture_queue": [],
			"readiness": String(core_item.get("skill_readiness", "Unknown")),
		},
	}


static func hidden_relay_snapshot(source: Dictionary) -> Dictionary:
	var result := source.duplicate(true)
	if result.is_empty():
		return result
	var a1: Dictionary = result.get("a1", {})
	var discovery: Dictionary = a1.get("discovery_fixture", {})
	discovery["relay"] = false
	a1["discovery_fixture"] = discovery
	result["a1"] = a1
	return result


static func _source_refs() -> Dictionary:
	var pins: Dictionary = {}
	for line in FileAccess.get_file_as_string("res://.a6-contract-inputs/source-pins.txt").split("\n"):
		var separator := line.find("=")
		if separator > 0:
			pins[line.substr(0, separator)] = line.substr(separator + 1).strip_edges()
	for owner in ["A0", "A1", "A3"]:
		if String(pins.get(owner, "")).is_empty():
			return {}
	return pins


static func _json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed if parsed is Dictionary else {}


static func _by_id(records: Array, id: String, key := "poi_id") -> Dictionary:
	for raw: Variant in records:
		if raw is Dictionary and String(raw.get(key, "")) == id:
			return raw
	return {}


static func _material_by_key(records: Array, key: String) -> Dictionary:
	for raw: Variant in records:
		if raw is Dictionary and String(raw.get("material_key", "")) == key:
			return raw.duplicate(true)
	return {}
