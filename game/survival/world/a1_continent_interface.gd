class_name A1ContinentInterface
extends Node2D
## R13 additive A0-facing façade over the accepted A1 reader and live stream.
##
## All coordinates are unscaled world pixels. Cell rectangles are half-open;
## the actor origin is the bottom-center foot sample (x*16+8, y*16+15).
## Source walk/build/region facts remain available while a render/physics chunk
## is drained. physics_sample_cell() is the explicit mounted-chunk query.
## A0 owns production mounting, camera, run/save identity, dynamic occupancy,
## final build permission and movement adoption. This node never mounts A8
## interiors, grants loot, writes saves or claims production playability.

const READER := preload("res://game/survival/world/a1_authored_world_reader.gd")
const STREAM := preload("res://game/survival/world/a1_authored_world_stream.gd")
const DEFAULT_WORLD_ROOT := "res://data/survival/world"
const DEFAULT_MANIFEST_PATH := "res://data/survival/world/a1_continent_interface.v1.json"
const INTERFACE_SCHEMA := "soh.world.a1_continent_interface.v1"
const TILE := 16

var reader: Variant = null
var stream: Variant = null
var manifest: Dictionary = {}
var last_error := ""
var _ready_flag := false
var _manifest_path := ""


func _json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed as Dictionary if parsed is Dictionary else {}


func _source_path(path: String) -> String:
	return path if path.begins_with("res://") or path.begins_with("user://") or path.begins_with("/") else "res://" + path


func _int_list(value: Variant) -> Array:
	# Godot JSON numbers are floats. Normalize only finite integral values so
	# identity comparisons remain exact without accepting strings/fractions.
	var result: Array = []
	if not value is Array:
		return result
	for item: Variant in value:
		var kind := typeof(item)
		if kind != TYPE_INT and kind != TYPE_FLOAT:
			return []
		var number := float(item)
		if not is_finite(number) or number != floor(number):
			return []
		result.append(int(number))
	return result


func _fail(reason: String) -> bool:
	last_error = reason
	return false


func configure(world_root: String = DEFAULT_WORLD_ROOT, player_scene_override: String = "",
		manifest_path: String = DEFAULT_MANIFEST_PATH) -> bool:
	_ready_flag = false
	last_error = ""
	_manifest_path = manifest_path
	manifest = {}
	if stream != null and is_instance_valid(stream):
		stream.clear_stream()
		if stream.get_parent() == self:
			remove_child(stream)
		stream.queue_free()
	stream = null
	reader = null
	manifest = _json(manifest_path)
	if manifest.is_empty() or String(manifest.get("schema", "")) != INTERFACE_SCHEMA:
		return _fail("interface_manifest_schema")
	var world: Dictionary = manifest.get("world", {})
	if String(world.get("world_id", "")) != "world:soh_continent_v1" \
			or _int_list(world.get("cell_size_px", [])) != [16, 16] or _int_list(world.get("cell_origin_px", [])) != [0, 0] \
			or _int_list(world.get("world_size_cells", [])) != [1024, 768] or _int_list(world.get("chunk_cells", [])) != [64, 64] \
			or int(world.get("chunk_count", 0)) != 192:
		return _fail("interface_world_identity")
	var runtime: Dictionary = manifest.get("runtime", {})
	if String(runtime.get("mutable_runtime_policy", "")) != "SEMANTIC_INTERFACE_ONLY; no A0/A6/Knight byte pins":
		return _fail("interface_mutable_runtime_policy")
	var runtime_doc := _json(world_root.path_join("a1_round12_runtime_contract.v1.json"))
	var observed: Dictionary = ((runtime_doc.get("runtime_interfaces", {}) as Dictionary).get("observed_paths", {}) as Dictionary)
	var observed_paths: Array = observed.values()
	for key: String in (manifest.get("source_pins", {}) as Dictionary):
		var pin: Dictionary = (manifest.source_pins as Dictionary)[key]
		var relative := String(pin.get("path", ""))
		if relative.is_empty() or String(pin.get("sha256", "")).is_empty():
			return _fail("interface_source_pin:" + key)
		if observed_paths.has(relative):
			return _fail("interface_mutable_byte_pin:" + key)
		var path := _source_path(relative)
		if not FileAccess.file_exists(path):
			return _fail("interface_source_missing:" + key)
		if FileAccess.get_sha256(path) != String(pin.sha256):
			return _fail("interface_source_hash:" + key)
	reader = READER.new()
	if not bool(reader.configure(world_root, player_scene_override)):
		return _fail("reader:" + String(reader.last_error))
	if String(reader.plan.get("world_id", "")) != String(world.world_id) \
			or reader.world_frame() != Vector2i(1024, 768) or int(reader.chunk_count()) != 192:
		return _fail("interface_reader_identity")
	var spawn: Dictionary = manifest.get("spawn", {})
	if int(spawn.get("candidate_cells", 0)) != int(reader.spawn_index.get("candidate_cells", -1)) \
			or int(spawn.get("candidate_chunks", 0)) != int(reader.spawn_index.get("candidate_chunks", -1)):
		return _fail("interface_spawn_binding")
	for key: String in (manifest.get("sites", {}) as Dictionary):
		var descriptor: Dictionary = (manifest.sites as Dictionary)[key]
		var physical: Dictionary = reader.physical_site(key)
		if not bool(physical.get("ok", false)):
			return _fail("interface_site_unknown:" + key)
		var identity: Dictionary = descriptor.get("instance_identity", {})
		var approach: Dictionary = descriptor.get("physical_approach", {})
		var door: Dictionary = descriptor.get("door_target", {})
		var shell: Dictionary = descriptor.get("shell", {})
		if _int_list(descriptor.get("canonical_cell", [])) != _int_list(physical.get("canonical_cell", [])) \
				or _int_list(approach.get("cell", [])) != _int_list(physical.get("approach_cell", [])) \
				or _int_list(approach.get("actor_origin_px", [])) != _int_list(physical.get("approach_foot_world_px", [])) \
				or _int_list(door.get("world_px", [])) != _int_list(physical.get("entry_portal_world_px", [])) \
				or _int_list(shell.get("origin_world_px", [])) != _int_list(physical.get("shell_origin_world_px", [])) \
				or String(shell.get("scene", "")) != String(physical.get("shell_scene", "")) \
				or String(identity.get("poi_id", "")) != String(physical.get("poi_id", "")):
			return _fail("interface_site_transform:" + key)
	stream = STREAM.new()
	stream.name = "A1ProductionConsumableSourceStream"
	add_child(stream)
	if not bool(stream.configure(world_root, reader, false, player_scene_override)):
		return _fail("stream:" + String(stream.last_error))
	_ready_flag = true
	return true


func is_ready() -> bool:
	return _ready_flag and reader != null and stream != null and bool(reader.is_ready())


func interface_manifest() -> Dictionary:
	return manifest.duplicate(true)


func source_report() -> Dictionary:
	var report: Dictionary = reader.source_report() if reader != null else {"ok": false}
	report["interface_schema"] = INTERFACE_SCHEMA
	report["interface_ready"] = is_ready()
	report["interface_manifest_path"] = _manifest_path
	report["interface_manifest_sha256"] = FileAccess.get_sha256(_manifest_path) if FileAccess.file_exists(_manifest_path) else ""
	report["active_chunks"] = active_chunk_ids()
	report["scope"] = "R13_PRODUCTION_CONSUMABLE_SOURCE_SEAM_NOT_PRODUCTION_MOUNTED"
	return report


func world_rect() -> Rect2:
	return Rect2(Vector2.ZERO, Vector2(16384, 12288)) if reader == null else reader.world_pixels()


func _valid_cell(cell: Vector2i) -> bool:
	return reader != null and cell.x >= 0 and cell.y >= 0 and cell.x < 1024 and cell.y < 768


func cell_to_world(cell: Vector2i, anchor: StringName = &"actor_foot") -> Dictionary:
	if not _valid_cell(cell):
		return {"ok": false, "error": "CELL_BOUNDS", "cell": cell}
	var point := Vector2.ZERO
	match anchor:
		&"actor_foot", &"actor_origin":
			point = Vector2(cell.x * TILE + 8, cell.y * TILE + 15)
		&"cell_center":
			point = Vector2(cell.x * TILE + 8, cell.y * TILE + 8)
		&"cell_top_left":
			point = Vector2(cell.x * TILE, cell.y * TILE)
		_:
			return {"ok": false, "error": "WORLD_ANCHOR_UNKNOWN", "cell": cell}
	return {
		"ok": true, "error": "", "world_id": String(manifest.world.world_id),
		"cell": cell, "cell_array": [cell.x, cell.y], "anchor": anchor,
		"world_px": point, "world_px_array": [point.x, point.y],
		"chunk_id": String(reader.chunk_id_at(cell)),
	}


func world_to_cell(point: Vector2) -> Dictionary:
	if reader == null or not is_finite(point.x) or not is_finite(point.y) or not world_rect().has_point(point):
		return {"ok": false, "error": "WORLD_BOUNDS", "world_px": point}
	var cell := Vector2i(floori(point.x / TILE), floori(point.y / TILE))
	return {
		"ok": true, "error": "", "world_id": String(manifest.world.world_id),
		"cell": cell, "cell_array": [cell.x, cell.y], "world_px": point,
		"chunk_id": String(reader.chunk_id_at(cell)),
	}


func chunk_for_cell(cell: Vector2i) -> Dictionary:
	if not _valid_cell(cell):
		return {"ok": false, "error": "CELL_BOUNDS", "cell": cell}
	var cid := String(reader.chunk_id_at(cell))
	if not (reader.manifest_by_id as Dictionary).has(cid):
		return {"ok": false, "error": "CHUNK_UNKNOWN", "cell": cell}
	var entry: Dictionary = (reader.manifest_by_id as Dictionary)[cid]
	var origin: Array = entry.origin
	var dims: Array = entry.size
	var loaded: Dictionary = (reader.cache as Dictionary).get(cid, {})
	return {
		"ok": true, "error": "", "world_id": String(manifest.world.world_id),
		"chunk_id": cid, "cell": cell, "origin_cell": Vector2i(int(origin[0]), int(origin[1])),
		"size_cells": Vector2i(int(dims[0]), int(dims[1])),
		"world_rect": Rect2(Vector2(int(origin[0]) * TILE, int(origin[1]) * TILE), Vector2(int(dims[0]) * TILE, int(dims[1]) * TILE)),
		"source_path": String(entry.path), "source_sha256": String(loaded.get("sha256", "")),
		"acquired": is_ready() and (stream.loaded_chunks as Dictionary).has(cid),
	}


func chunk_for_world(point: Vector2) -> Dictionary:
	var mapped := world_to_cell(point)
	if not bool(mapped.get("ok", false)):
		return mapped
	return chunk_for_cell(mapped.cell)


func active_chunk_ids() -> Array[String]:
	var out: Array[String] = []
	if stream == null or not is_instance_valid(stream):
		return out
	for cid: String in (stream.loaded_chunks as Dictionary):
		out.append(cid)
	out.sort()
	return out


func acquire_for_actor(actor_origin_px: Vector2, camera_world_rect: Rect2) -> Dictionary:
	if not is_ready():
		return {"ok": false, "error": "INTERFACE_NOT_READY"}
	var mapped := world_to_cell(actor_origin_px)
	if not bool(mapped.get("ok", false)):
		return mapped
	if not is_finite(camera_world_rect.position.x) or not is_finite(camera_world_rect.position.y) \
			or not is_finite(camera_world_rect.size.x) or not is_finite(camera_world_rect.size.y) \
			or camera_world_rect.size.x <= 0.0 or camera_world_rect.size.y <= 0.0 \
			or not camera_world_rect.has_point(actor_origin_px):
		return {"ok": false, "error": "CAMERA_WORLD_RECT_INVALID"}
	var result: Dictionary = stream.update_stream(actor_origin_px, camera_world_rect)
	if not bool(result.get("ok", false)):
		return result
	result["world_id"] = String(manifest.world.world_id)
	result["actor_cell"] = mapped.cell
	result["actor_chunk_id"] = String(mapped.chunk_id)
	result["active"] = active_chunk_ids()
	result["active_count"] = (result.active as Array).size()
	result["camera_world_rect"] = camera_world_rect
	return result


func release_chunks() -> Dictionary:
	if not is_ready():
		return {"ok": false, "error": "INTERFACE_NOT_READY"}
	var before := active_chunk_ids()
	stream.clear_stream()
	return {"ok": true, "error": "", "released": before, "active": active_chunk_ids(), "active_count": 0}


func _bank_masks(cell: Vector2i, surface: String) -> Dictionary:
	var land_mask := 0
	var water_mask := 0
	for item: Array in [[Vector2i(0, -1), 1], [Vector2i(1, 0), 2], [Vector2i(0, 1), 4], [Vector2i(-1, 0), 8]]:
		var neighbor_surface := String(reader.named_value(cell + (item[0] as Vector2i), "surface"))
		if neighbor_surface == "water":
			water_mask |= int(item[1])
		else:
			land_mask |= int(item[1])
	return {
		"water_neighbor_mask": water_mask,
		"land_neighbor_mask": land_mask,
		"bank_transition_mask": land_mask if surface == "water" else water_mask,
		"bank_transition": (surface == "water" and land_mask != 0) or (surface != "water" and water_mask != 0),
	}


func sample_cell(cell: Vector2i) -> Dictionary:
	if not is_ready():
		return {"ok": false, "error": "INTERFACE_NOT_READY"}
	var identity: Dictionary = reader.cell_identity(cell)
	if not bool(identity.get("ok", false)):
		return identity
	var traversal: Dictionary = reader.traversal_profile(cell)
	if not bool(traversal.get("ok", false)):
		return traversal
	var chunk := chunk_for_cell(cell)
	var values: Dictionary = identity.values
	var surface := String(identity.surface_id)
	var environment := _bank_masks(cell, surface)
	environment["surface_id"] = surface
	environment["biome_id"] = String(identity.biome_id)
	environment["is_water"] = surface == "water"
	environment["is_river"] = surface == "water" and String(identity.biome_id) == "riverine"
	environment["is_road"] = int(values.get("road", 0)) == 1
	environment["is_bridge"] = surface == "bridge" or (surface == "water" and int(values.get("road", 0)) == 1)
	environment["climate_channel"] = String(traversal.climate_channel)
	environment["hazard_channel"] = String(traversal.hazard_channel)
	return {
		"ok": true, "error": "", "world_id": String(identity.world_id),
		"geography_instance_id": String(manifest.world.geography_instance_id),
		"cell": cell, "cell_array": [cell.x, cell.y], "chunk_id": String(identity.chunk_id),
		"region_id": String(identity.region_id), "biome_id": String(identity.biome_id),
		"surface_id": surface, "hazard_id": String(identity.hazard_id),
		"source_walkable": int(values.get("walk", 0)) == 1,
		"walkable": int(values.get("walk", 0)) == 1,
		"walk_authority": "A1_SOURCE_TERRAIN;A0_DYNAMIC_OCCUPANCY_SEPARATE",
		"collision_authority": "A0_LEGACY_INSET" if int(values.get("preserved", 0)) == 1 else "A1_SOURCE_STREAM",
		"source_static_blocked": int(values.get("walk", 0)) == 0 and int(values.get("preserved", 0)) == 0,
		"legacy_inset": bool(identity.legacy_inset),
		"build_layer": int(values.get("build", 0)),
		"build_permission": int(values.get("build_permission", -1)),
		"road": int(values.get("road", 0)), "preserved": int(values.get("preserved", 0)),
		"movement": traversal, "environment": environment,
		"speed_multiplier_proposal": traversal.get("speed_multiplier_proposal"),
		"source_reference": {"path": String(chunk.source_path), "sha256": String(chunk.source_sha256)},
	}


func sample_world(point: Vector2) -> Dictionary:
	var mapped := world_to_cell(point)
	if not bool(mapped.get("ok", false)):
		return mapped
	return sample_cell(mapped.cell)


func physics_sample_cell(cell: Vector2i) -> Dictionary:
	var sample := sample_cell(cell)
	if not bool(sample.get("ok", false)):
		return sample
	var cid := String(sample.chunk_id)
	if not (stream.loaded_chunks as Dictionary).has(cid):
		return {"ok": false, "error": "CHUNK_NOT_ACQUIRED", "cell": cell, "chunk_id": cid, "source": sample}
	var mounted: Dictionary = (stream.loaded_chunks as Dictionary)[cid]
	sample["mounted"] = true
	sample["stream_revision"] = int(mounted.get("revision", 0))
	sample["mounted_terrain_body_count"] = int(mounted.get("terrain_bodies", 0))
	sample["mounted_source_sha256"] = String(mounted.get("source_sha256", ""))
	return sample


func build_eligibility(cell: Vector2i, a0_delegate: Callable = Callable(), dynamic_child_blocked: bool = false) -> Dictionary:
	var sample := sample_cell(cell)
	if not bool(sample.get("ok", false)):
		return sample
	var decision: Dictionary = reader.resolve_build(int(sample.build_permission), a0_delegate, dynamic_child_blocked)
	return {
		"ok": bool(decision.get("ok", false)), "error": String(decision.get("reason", "")),
		"cell": cell, "chunk_id": String(sample.chunk_id), "world_id": String(sample.world_id),
		"decision": String(decision.get("decision", "error")), "reason": String(decision.get("reason", "")),
		"authority": String(decision.get("authority", "")), "build": decision,
		"build_layer": int(sample.build_layer), "build_permission": int(sample.build_permission),
		"dynamic_child_blocked": dynamic_child_blocked, "source": sample,
	}


func choose_safe_spawn(run_seed: int) -> Dictionary:
	if not is_ready():
		return {"ok": false, "error": "INTERFACE_NOT_READY"}
	var chosen: Dictionary = reader.choose_safe_spawn(run_seed)
	if not bool(chosen.get("ok", false)):
		return chosen
	var validated := validate_spawn_cell(chosen.cell)
	if not bool(validated.get("ok", false)):
		return validated
	var transform := cell_to_world(chosen.cell)
	chosen["actor_origin_px"] = transform.world_px
	chosen["actor_origin_px_array"] = transform.world_px_array
	chosen["world_id"] = String(manifest.world.world_id)
	chosen["geography_instance_id"] = String(manifest.world.geography_instance_id)
	chosen["spawn_identity"] = "spawn:%s:%d" % [String(manifest.world.world_id), run_seed]
	chosen["dynamic_occupancy_validation"] = "A0_REQUIRED_BEFORE_PLACEMENT"
	chosen["indexed_candidate"] = true
	chosen["spawn_evidence"] = validated.get("spawn_evidence", "")
	chosen["safe_basic_material_families_minimum"] = validated.get("safe_basic_material_families_minimum", 0)
	chosen["opportunity_radius_cells"] = validated.get("opportunity_radius_cells", 0)
	chosen["road_max_distance_cells"] = validated.get("road_max_distance_cells", 0)
	chosen["region_entry_capabilities"] = validated.get("region_entry_capabilities", [])
	chosen["production_spawn_approval"] = false
	return chosen


func validate_spawn_cell(cell: Vector2i) -> Dictionary:
	if not is_ready():
		return {"ok": false, "error": "INTERFACE_NOT_READY"}
	var identity: Dictionary = reader.cell_identity(cell)
	if not bool(identity.get("ok", false)):
		return {"ok": false, "error": "SPAWN_CELL_UNSAFE", "reason": "CELL_BOUNDS", "cell": cell}
	var cid := String(identity.chunk_id)
	var candidates: Dictionary = reader.spawn_candidates(cid)
	if not bool(candidates.get("ok", false)) or not (candidates.cells as Array).has(cell):
		return {
			"ok": false, "error": "SPAWN_CELL_UNSAFE", "reason": "NOT_IN_VERIFIED_BROAD_CANDIDATE_INDEX",
			"cell": cell, "chunk_id": cid, "region_id": String(identity.region_id),
		}
	var transform := cell_to_world(cell)
	var traversal: Dictionary = reader.traversal_profile(cell)
	var spawn_contract: Dictionary = manifest.get("spawn", {})
	var criteria: Dictionary = spawn_contract.get("criteria", {})
	return {
		"ok": true, "error": "", "cell": cell, "cell_array": [cell.x, cell.y], "chunk_id": cid,
		"region_id": String(identity.region_id), "actor_origin_px": transform.world_px,
		"actor_origin_px_array": transform.world_px_array, "indexed_candidate": true,
		"spawn_evidence": "HASH_VERIFIED_COMPILER_INDEX_MEMBERSHIP",
		"safe_basic_material_families_minimum": int(criteria.get("minimum_material_families", 0)),
		"opportunity_radius_cells": int(criteria.get("opportunity_radius_cells", 0)),
		"road_max_distance_cells": int(criteria.get("road_max_distance_cells", 0)),
		"opportunity_distance_metric": String(spawn_contract.get("opportunity_distance_metric", "")),
		"region_entry_capabilities": (traversal.get("region_entry_capabilities", []) as Array).duplicate(),
		"dynamic_occupancy_validation": "A0_REQUIRED_BEFORE_PLACEMENT", "source": identity,
		"production_spawn_approval": false,
	}


func site(site_key_or_poi: String) -> Dictionary:
	if not is_ready():
		return {"ok": false, "error": "INTERFACE_NOT_READY"}
	for key: String in (manifest.get("sites", {}) as Dictionary):
		var descriptor: Dictionary = (manifest.sites as Dictionary)[key]
		var identity: Dictionary = descriptor.get("instance_identity", {})
		if site_key_or_poi == key or site_key_or_poi == String(identity.get("poi_id", "")) \
				or site_key_or_poi == String(identity.get("site_instance_id", "")):
			var result := descriptor.duplicate(true)
			result["ok"] = true
			result["error"] = ""
			return result
	return {"ok": false, "error": "PHYSICAL_SITE_UNKNOWN", "site_key": site_key_or_poi}


func set_time_of_day(time_of_day: float, region_id: String = "") -> Dictionary:
	if not is_ready():
		return {"ok": false, "error": "INTERFACE_NOT_READY"}
	if not is_finite(time_of_day):
		return {"ok": false, "error": "INVALID_WORLD_TIME"}
	stream.set_time_of_day(time_of_day, region_id)
	return {"ok": true, "error": "", "time_of_day": time_of_day, "region_id": region_id, "authority": "A1_PRESENTATION_ONLY_A0_WORLD_TIME"}


func temporal_context(world_time_seconds: float, run_elapsed_seconds: float) -> Dictionary:
	if not is_ready():
		return {"ok": false, "error": "INTERFACE_NOT_READY"}
	return reader.temporal_context(world_time_seconds, run_elapsed_seconds)
