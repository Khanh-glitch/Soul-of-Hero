extends RefCounted
## Semantic compatibility for mutable A0/A6 runtime sources.
##
## World plans, chunks, source documents and art remain byte-pinned by the A1
## runtime contract. This checker deliberately has no expected script/scene
## hashes: it validates only the interfaces consumed by the reader's native
## composition, and records current hashes as observations for evidence.

const INTERFACE_SCHEMA := "soh.world.a1_runtime_interfaces.v1"

var last_error := ""


static func source_path(path: String) -> String:
	if path.begins_with("res://") or path.begins_with("user://") or path.begins_with("/"):
		return path
	return "res://" + path


func _fail(code: String) -> Dictionary:
	last_error = "runtime_interface:" + code
	return {"ok": false, "error": last_error}


func _methods(script: Script) -> Dictionary:
	var out := {}
	for raw: Variant in script.get_script_method_list():
		var method := raw as Dictionary
		out[String(method.get("name", ""))] = true
	return out


func _validate_script(key: String, spec: Dictionary) -> Dictionary:
	var path := source_path(String(spec.get("path", "")))
	if path.is_empty() or not FileAccess.file_exists(path):
		return _fail(key + "_MISSING")
	var resource: Variant = load(path)
	if resource == null or not resource is Script:
		return _fail(key + "_LOAD")
	var script := resource as Script
	var expected_base := String(spec.get("base_type", ""))
	var actual_base := String(script.get_instance_base_type())
	if expected_base.is_empty() or (actual_base != expected_base and not ClassDB.is_parent_class(actual_base, expected_base)):
		return _fail(key + "_BASE_TYPE")
	var available := _methods(script)
	for raw: Variant in spec.get("required_methods", []):
		var method := String(raw)
		if not available.has(method):
			return _fail(key + "_METHOD_" + method.to_upper())
	return {
		"ok": true, "path": path, "base_type": actual_base,
		"required_methods": (spec.get("required_methods", []) as Array).duplicate(),
	}


func _validate_player(spec: Dictionary) -> Dictionary:
	var path := source_path(String(spec.get("scene", "")))
	if path.is_empty() or not FileAccess.file_exists(path):
		return _fail("PLAYER_SCENE_MISSING")
	var resource: Variant = load(path)
	if resource == null or not resource is PackedScene:
		return _fail("PLAYER_SCENE_LOAD")
	var scene := resource as PackedScene
	if not scene.can_instantiate():
		return _fail("PLAYER_SCENE_INSTANTIATE")
	var instance: Variant = scene.instantiate()
	if instance == null or not instance is CharacterBody2D:
		if instance is Node:
			(instance as Node).free()
		return _fail("PLAYER_BODY_TYPE")
	var hero := instance as CharacterBody2D
	var shape_name := String(spec.get("body_shape_node", "BodyShape"))
	var body := hero.get_node_or_null(shape_name) as CollisionShape2D
	if body == null:
		hero.free()
		return _fail("PLAYER_BODY_SHAPE")
	if body.disabled:
		hero.free()
		return _fail("PLAYER_BODY_SHAPE_DISABLED")
	var rectangle := body.shape as RectangleShape2D
	if rectangle == null:
		hero.free()
		return _fail("PLAYER_BODY_SHAPE_TYPE")
	var expected_size: Array = spec.get("body_shape_size_px", [12, 16])
	if expected_size.size() != 2 or not rectangle.size.is_equal_approx(Vector2(float(expected_size[0]), float(expected_size[1]))):
		hero.free()
		return _fail("PLAYER_BODY_SHAPE_SIZE")
	var expected_offset: Array = spec.get("body_shape_offset_px", [0, -8])
	if expected_offset.size() != 2 or not body.position.is_equal_approx(Vector2(float(expected_offset[0]), float(expected_offset[1]))):
		hero.free()
		return _fail("PLAYER_BODY_SHAPE_OFFSET")
	if hero.motion_mode != CharacterBody2D.MOTION_MODE_FLOATING:
		hero.free()
		return _fail("PLAYER_MOTION_MODE")
	var required_mask := int(spec.get("required_collision_mask", 5))
	if (hero.collision_mask & required_mask) != required_mask:
		hero.free()
		return _fail("PLAYER_COLLISION_MASK")
	var required_layer := int(spec.get("required_collision_layer", 2))
	if (hero.collision_layer & required_layer) != required_layer:
		hero.free()
		return _fail("PLAYER_COLLISION_LAYER")
	for raw: Variant in spec.get("numeric_properties", []):
		var property := String(raw)
		var value: Variant = hero.get(property)
		if typeof(value) != TYPE_INT and typeof(value) != TYPE_FLOAT:
			hero.free()
			return _fail("PLAYER_PROPERTY_" + property.to_upper())
	var camera_name := String(spec.get("camera_node", "Camera"))
	var camera := hero.get_node_or_null(camera_name) as Camera2D
	if camera == null:
		hero.free()
		return _fail("PLAYER_CAMERA")
	var expected_camera_offset: Array = spec.get("camera_offset_px", [0, -8])
	if expected_camera_offset.size() != 2 or not camera.position.is_equal_approx(Vector2(float(expected_camera_offset[0]), float(expected_camera_offset[1]))):
		hero.free()
		return _fail("PLAYER_CAMERA_OFFSET")
	if bool(spec.get("require_position_smoothing", true)) and not camera.position_smoothing_enabled:
		hero.free()
		return _fail("PLAYER_CAMERA_SMOOTHING")
	if camera.position_smoothing_speed < float(spec.get("minimum_position_smoothing_speed", 1.0)):
		hero.free()
		return _fail("PLAYER_CAMERA_SMOOTHING_SPEED")
	for raw: Variant in spec.get("required_input_actions", []):
		var action := StringName(String(raw))
		if not InputMap.has_action(action):
			hero.free()
			return _fail("PLAYER_INPUT_" + String(action).to_upper())
		if InputMap.action_get_events(action).is_empty():
			hero.free()
			return _fail("PLAYER_INPUT_" + String(action).to_upper() + "_UNBOUND")
	var report := {
		"ok": true, "scene": path, "scene_sha256": FileAccess.get_sha256(path),
		"identity_policy": "PHYSICAL_INTERFACE_ONLY_NO_VISUAL_OR_SCRIPT_IDENTITY",
		"body_type": "CharacterBody2D",
		"body_shape_size_px": [rectangle.size.x, rectangle.size.y],
		"body_shape_offset_px": [body.position.x, body.position.y],
		"collision_mask": hero.collision_mask, "required_collision_mask": required_mask,
		"collision_layer": hero.collision_layer, "required_collision_layer": required_layer,
		"motion_mode": "FLOATING", "camera": camera_name,
		"camera_offset_px": [camera.position.x, camera.position.y],
		"camera_position_smoothing": camera.position_smoothing_enabled,
		"camera_position_smoothing_speed": camera.position_smoothing_speed,
		"numeric_properties": (spec.get("numeric_properties", []) as Array).duplicate(),
		"required_input_actions": (spec.get("required_input_actions", []) as Array).duplicate(),
	}
	hero.free()
	return report


func _has_byte_pin(value: Variant) -> bool:
	if value is Dictionary:
		for key: String in value:
			if key == "sha256" or key.ends_with("_sha256") or _has_byte_pin(value[key]):
				return true
	elif value is Array:
		for entry: Variant in value:
			if _has_byte_pin(entry):
				return true
	return false


func validate(contract: Dictionary, player_scene_override: String = "") -> Dictionary:
	last_error = ""
	if String(contract.get("schema", "")) != INTERFACE_SCHEMA:
		return _fail("CONTRACT_SCHEMA")
	if _has_byte_pin(contract):
		return _fail("MUTABLE_BYTE_PIN_FORBIDDEN")
	var observed := {}
	var interfaces := {}
	var player: Dictionary = (contract.get("player", {}) as Dictionary).duplicate(true)
	if not player_scene_override.is_empty():
		player["scene"] = player_scene_override
	var player_report := _validate_player(player)
	if not bool(player_report.get("ok", false)):
		return {"ok": false, "error": last_error, "observed_sha256": observed, "interfaces": interfaces}
	interfaces["player"] = player_report
	var scripts: Dictionary = contract.get("scripts", {})
	for key: String in scripts:
		var report := _validate_script(key, scripts[key] as Dictionary)
		if not bool(report.get("ok", false)):
			return {"ok": false, "error": last_error, "observed_sha256": observed, "interfaces": interfaces}
		interfaces[key] = report
	for key: String in contract.get("observed_paths", {}):
		var path := source_path(String((contract.observed_paths as Dictionary)[key]))
		if FileAccess.file_exists(path):
			observed[key] = {"path": path, "sha256": FileAccess.get_sha256(path)}
	if not player_scene_override.is_empty():
		var actual_scene := String(player_report.get("scene", ""))
		observed["player_scene"] = {"path": actual_scene, "sha256": String(player_report.get("scene_sha256", ""))}
	return {
		"ok": true, "schema": INTERFACE_SCHEMA,
		"policy": "SEMANTIC_INTERFACE_NOT_MUTABLE_BYTE_IDENTITY",
		"observed_sha256": observed, "interfaces": interfaces,
		"production_mount_acceptance": "A0_SEPARATE_GATE",
	}
