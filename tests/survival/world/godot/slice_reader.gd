extends RefCounted
## SURV-050A isolated vertical-slice reader. NOT production scene code.
## Reads the A1 native-ready two-POI contracts and checks manifest hashes,
## chunk-backed navigation clearance, obstacle/doorway safety and spawn policy.
## It never loads the production overworld controller, SaveService, A0 build
## system, A3 EconomyService or A6 UI. Native mounting remains an A0 gate.

const ChunkReaderScript = preload("res://chunk_reader.gd")

var world_root := ""
var manifest: Dictionary = {}
var handoff: Dictionary = {}
var vectors: Dictionary = {}
var contracts: Dictionary = {}
var chunk_reader
var last_error := ""


func _json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		last_error = "missing_file:" + path
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not parsed is Dictionary:
		last_error = "invalid_json:" + path
		return {}
	return parsed as Dictionary


func configure(root: String) -> bool:
	world_root = root
	last_error = ""
	manifest = _json(root.path_join("vertical_slice/manifest.json"))
	handoff = _json(root.path_join("vertical_slice/handoff_contracts.json"))
	vectors = _json(root.path_join("vertical_slice/test_vectors.json"))
	if manifest.is_empty() or handoff.is_empty() or vectors.is_empty():
		return false
	if bool(manifest.get("native_playable", true)):
		last_error = "slice_must_not_claim_native_playable"
		return false
	for poi_id: String in manifest.get("poi_ids", []):
		var contract := _json(root.path_join("vertical_slice/" + poi_id + ".slice.json"))
		if contract.is_empty():
			return false
		contracts[poi_id] = contract
	chunk_reader = ChunkReaderScript.new()
	if not chunk_reader.configure(root):
		last_error = "chunk_reader:" + chunk_reader.last_error
		return false
	return validate_manifest_hashes() and validate_all_geometry()


func validate_manifest_hashes() -> bool:
	for name: String in manifest.get("files", {}):
		var meta: Dictionary = manifest["files"][name]
		var path := world_root.path_join("vertical_slice/" + name)
		if not FileAccess.file_exists(path):
			last_error = "missing_slice_file:" + name
			return false
		if FileAccess.get_sha256(path) != String(meta.get("sha256", "")):
			last_error = "slice_hash_mismatch:" + name
			return false
	return true


func _cells_set(cells: Array) -> Dictionary:
	var out: Dictionary = {}
	for cell: Variant in cells:
		out[Vector2i(int(cell[0]), int(cell[1]))] = true
	return out


func validate_geometry(poi_id: String) -> Dictionary:
	if not contracts.has(poi_id):
		return {"ok": false, "reason": "unknown_poi"}
	var contract: Dictionary = contracts[poi_id]
	var geo: Dictionary = contract["immutable_geography"]
	var nav := _cells_set(geo["required_nav_cells"])
	var forbidden := _cells_set(geo["spawn_forbidden_cells"])
	var obstacles: Dictionary = {}
	for ob: Variant in geo["static_obstacles"]:
		for cell: Variant in ob["cells"]:
			var key := Vector2i(int(cell[0]), int(cell[1]))
			if nav.has(key):
				return {"ok": false, "reason": "obstacle_blocks_required_nav"}
			obstacles[key] = true
	if not (geo["dynamic_spawns"] as Array).is_empty():
		return {"ok": false, "reason": "dynamic_spawns_forbidden_in_slice_v1"}
	for key: Vector2i in nav:
		if not forbidden.has(key):
			return {"ok": false, "reason": "required_nav_not_spawn_forbidden"}
		var layers: Dictionary = chunk_reader.cell_layers(key)
		if not bool(layers.get("ok", false)):
			return {"ok": false, "reason": "chunk_cell_unresolved"}
		if int(layers["layers"].get("walk", 0)) != 1:
			return {"ok": false, "reason": "required_nav_not_walkable"}
		if int(layers["layers"].get("hazard", 0)) != 0:
			return {"ok": false, "reason": "required_nav_hazardous"}
	for ent: Variant in geo["entrances"]:
		var clear := _cells_set(ent["clearance_cells"])
		for key: Vector2i in clear:
			if obstacles.has(key):
				return {"ok": false, "reason": "obstacle_blocks_entrance"}
			if not nav.has(key) or not forbidden.has(key):
				return {"ok": false, "reason": "entrance_clearance_not_protected"}
	if not forbidden.has(Vector2i(int(geo["hero_spawn_cell"][0]), int(geo["hero_spawn_cell"][1]))):
		return {"ok": false, "reason": "hero_spawn_not_forbidden"}
	return {"ok": true, "reason": ""}


func validate_all_geometry() -> bool:
	for poi_id: String in contracts:
		var result := validate_geometry(poi_id)
		if not bool(result.get("ok", false)):
			last_error = poi_id + ":" + String(result.get("reason", "geometry_failed"))
			return false
	return true


func activation_plan(poi_id: String) -> Dictionary:
	if not contracts.has(poi_id):
		return {"ok": false, "reason": "unknown_poi"}
	var contract: Dictionary = contracts[poi_id]
	var geo: Dictionary = contract["immutable_geography"]
	var interactables: Array[String] = []
	for node: Variant in contract["interaction_nodes"]:
		interactables.append(String(node["node_id"]))
	return {
		"ok": true,
		"poi_id": poi_id,
		"static_obstacles": geo["static_obstacles"].size(),
		"dynamic_spawns": 0,
		"interactables": interactables,
		"hero_spawn_cell": geo["hero_spawn_cell"],
		"hero_return_cell": geo["hero_return_cell"],
		"spawn_forbidden_cells": geo["spawn_forbidden_cells"],
	}


func can_spawn_dynamic(poi_id: String, cell: Vector2i, hero_cell: Vector2i, occupied: Array = []) -> Dictionary:
	if not contracts.has(poi_id):
		return {"ok": false, "reason": "unknown_poi"}
	var geo: Dictionary = contracts[poi_id]["immutable_geography"]
	if cell == hero_cell:
		return {"ok": false, "reason": "SPAWN_ON_HERO"}
	for ent: Variant in geo["entrances"]:
		if _cells_set(ent["clearance_cells"]).has(cell):
			return {"ok": false, "reason": "SPAWN_BLOCKED_REQUIRED_DOORWAY"}
	if _cells_set(geo["required_nav_cells"]).has(cell):
		return {"ok": false, "reason": "SPAWN_BLOCKED_REQUIRED_NAV"}
	for occupied_cell: Variant in occupied:
		if cell == Vector2i(int(occupied_cell[0]), int(occupied_cell[1])):
			return {"ok": false, "reason": "SPAWN_BLOCKED_OCCUPIED"}
	return {"ok": false, "reason": "NO_DYNAMIC_SPAWNS_IN_SLICE_V1"}
