extends SceneTree
## SURV-050A isolated vertical-slice contract tests. Run with:
## godot --headless --path tests/survival/world/godot --script res://slice_test.gd -- --world-root=<repo>/data/survival/world
## This fixture executes authored adversarial vectors against an in-memory
## contract reducer. It does NOT claim Hero movement, combat, damage, production
## SaveService persistence, A3 EconomyService integration or A6 UI mounting.

const ReaderScript = preload("res://slice_reader.gd")
const StateScript = preload("res://slice_state_machine.gd")

var checks := 0
var failures: Array[String] = []


func _world_root() -> String:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--world-root="):
			return arg.trim_prefix("--world-root=")
	var env := OS.get_environment("A1_WORLD_ROOT")
	if not env.is_empty():
		return env
	return ProjectSettings.globalize_path("res://../../../../data/survival/world")


func _expect(condition: bool, message: String) -> void:
	checks += 1
	if condition:
		print("  ok ", message)
	else:
		failures.append(message)
		print("  FAIL ", message)


func _initialize() -> void:
	print("[a1-slice] configure isolated reader")
	var root := _world_root()
	var reader := ReaderScript.new()
	_expect(reader.configure(root), "slice reader configure: " + reader.last_error)
	_expect(reader.contracts.size() == 2, "exactly two slice POI contracts")
	_expect(not bool(reader.manifest.get("native_playable", true)), "manifest does not claim native playable")
	_expect(reader.validate_manifest_hashes(), "manifest file hashes match")
	_expect(reader.validate_all_geometry(), "chunk-backed nav/obstacle/doorway geometry valid")

	print("[a1-slice] activation and spawn policy")
	for poi_id: String in reader.contracts:
		var plan := reader.activation_plan(poi_id)
		_expect(bool(plan.get("ok", false)), "activation plan " + poi_id)
		_expect(int(plan.get("dynamic_spawns", -1)) == 0, "no dynamic spawns " + poi_id)
		var geo: Dictionary = reader.contracts[poi_id]["immutable_geography"]
		var hero := Vector2i(int(geo["hero_spawn_cell"][0]), int(geo["hero_spawn_cell"][1]))
		_expect(not bool(reader.can_spawn_dynamic(poi_id, hero, hero).get("ok", true)), "spawn on Hero rejected " + poi_id)
		for ent: Variant in geo["entrances"]:
			var door := Vector2i(int(ent["cell"][0]), int(ent["cell"][1]))
			var blocked := reader.can_spawn_dynamic(poi_id, door, hero)
			_expect(not bool(blocked.get("ok", true)) and String(blocked["reason"]) == "SPAWN_BLOCKED_REQUIRED_DOORWAY", "doorway spawn rejected " + poi_id)

	print("[a1-slice] adversarial vectors")
	var machine := StateScript.new()
	var vector_count := 0
	var required_count := 0
	for vector: Variant in reader.vectors.get("vectors", []):
		var v: Dictionary = vector as Dictionary
		vector_count += 1
		if bool(v.get("required", false)):
			required_count += 1
		machine.configure(reader.contracts, reader.handoff)
		var vector_ok := true
		for step: Variant in v["steps"]:
			var event: Dictionary = step as Dictionary
			var result := machine.apply(event)
			if event.has("expect"):
				var expected := String(event["expect"])
				var actual := String(result.get("result", ""))
				var ok := actual == expected
				if event.has("reason"):
					ok = ok and String(result.get("reason", "")) == String(event["reason"])
				_expect(ok, "%s %s -> %s" % [v["vector_id"], event.get("event", "?"), actual])
				vector_ok = vector_ok and ok
			elif event.has("expect_visibility"):
				var actual_visibility := String(result.get("visibility", ""))
				var ok := actual_visibility == String(event["expect_visibility"])
				_expect(ok, "%s project_a6 -> %s" % [v["vector_id"], actual_visibility])
				vector_ok = vector_ok and ok
				if actual_visibility == "HIDDEN":
					_expect((result.get("clues", []) as Array).is_empty(), "hidden projection leaks no clues")
					_expect((result.get("missing_prerequisite_reasons", []) as Array).is_empty(), "hidden projection leaks no prerequisites")
		_expect(vector_ok, "vector complete " + String(v["vector_id"]))
		for assertion: Variant in v["assertions"]:
			_expect(not String(assertion).is_empty(), "assertion declared " + String(v["vector_id"]) + ":" + String(assertion))
	_expect(vector_count >= 10, "at least ten executable vectors")
	_expect(required_count >= 7, "all seven required adversarial vectors present")

	print("[a1-slice] research firewall")
	var firewall: Dictionary = reader.handoff.get("research_firewall", {})
	_expect(String(firewall.get("prototype_p1_core_world_interactions", "")) == "RESEARCH_ONLY_NOT_IMPLEMENTED", "P1 research-only")
	_expect(String(firewall.get("prototype_p2_dynamic_weather", "")) == "RESEARCH_ONLY_NOT_IMPLEMENTED", "P2 research-only")
	_expect(String(firewall.get("prototype_p3_physical_cart", "")) == "RESEARCH_ONLY_NOT_IMPLEMENTED", "P3 research-only")
	_expect(not bool(firewall.get("typescript_imported", true)), "no TypeScript import")
	_expect(not bool(firewall.get("world_regenerated", true)), "no world regeneration")

	if failures.is_empty() and checks >= 120:
		print("SURVIVAL SLICE CONTRACT PASSED checks=", checks)
		quit(0)
	else:
		print("SURVIVAL SLICE CONTRACT FAILED checks=", checks, " failures=", failures.size())
		for failure: String in failures:
			print("  - ", failure)
		quit(1)
