extends Node
## A0 SITE MOUNT AUTHORITY (Round 12, WP-A0.5).
##
## A8 publishes physical POI content and neutral action/transition *requests*.
## Nothing in an A8 package may place a site, move the player or grant an item.
## This node is the only A0 code that would ever mount one, and it refuses
## loudly with a named reason instead of "mounting whatever is nearby":
##
##   A8_SITE_UNKNOWN              the package does not declare that poi_id
##   A1_POI_AUTHORITY_ABSENT      A1's route graph has no such POI
##   A1_POI_CELL_MISMATCH         A8's canonical cell is not A1's authored cell
##   A1_RUNTIME_WORLD_EXTENT_ABSENT
##                                A1 authored the POI outside the only runtime
##                                world document A0 is allowed to load
##   A8_SHELL_SCENE_ABSENT        the declared shell scene is not in this tree
##
## A site can only mount when every one of those passes AND the caller opted in
## with `survival/a0_a8_site_mount`. Rewards are a separate authority: an action
## resolves to an A3 binding or it grants nothing (`A3_BINDING_ABSENT`).
##
## Round 12 status: the shipped A1 runtime world is 384x256 cells, so all three
## A8 south sites are refused with A1_RUNTIME_WORLD_EXTENT_ABSENT. That is the
## truthful state; no geography is authored here to make a demo pass.
const A8_PACKAGE := "res://data/survival/world_content/a8_a0_mount_transition_package.v2.json"
const A1_ROUTE_GRAPH := "res://data/survival/world/poi_route_graph.json"
const A3_BINDINGS := "res://data/survival/items/world_source_bindings.v3.json"
const SETTING := "survival/a0_a8_site_mount"
const ENTRY_RECEIPT := "soh.a0.site.enter.%s"
const RETURN_RECEIPT := "soh.a0.site.return.%s"

var last_error := ""
var mounted_poi := ""
var site_root := Vector2(-1, -1)


## Read-only feasibility of one A8 site against the live owner data. Used by the
## mount and by the test suite; it never mutates the world.
func probe(world: Node, poi_id: String) -> Dictionary:
	var package := _read(A8_PACKAGE)
	if package.is_empty():
		return {"ok": false, "reason": "A8_PACKAGE_ABSENT"}
	var site := _site(package, poi_id)
	if site.is_empty():
		return {"ok": false, "reason": "A8_SITE_UNKNOWN"}
	var graph := _read(A1_ROUTE_GRAPH)
	if graph.is_empty():
		return {"ok": false, "reason": "A1_ROUTE_GRAPH_ABSENT"}
	var a1 := _a1_poi(graph, poi_id)
	if a1.is_empty():
		return {"ok": false, "reason": "A1_POI_AUTHORITY_ABSENT"}
	var cell := _cell(site)
	if cell == Vector2i(-1, -1):
		return {"ok": false, "reason": "A8_SITE_CELL_ABSENT"}
	if cell != _cell(a1):
		return {"ok": false, "reason": "A1_POI_CELL_MISMATCH",
			"a8_cell": [cell.x, cell.y], "a1_cell": [int(a1["cell"][0]), int(a1["cell"][1])]}
	var report := {
		"ok": false, "poi_id": poi_id, "cell": [cell.x, cell.y],
		"scene": String(site.get("scene", site.get("shell_scene", ""))),
		"binding": _binding_for(poi_id, site),
	}
	var bounds := _world_bounds(world)
	if bounds.size == Vector2i.ZERO:
		report["reason"] = "A0_WORLD_ABSENT"
		return report
	report["world_bounds"] = [bounds.size.x, bounds.size.y]
	if cell.x < bounds.position.x or cell.y < bounds.position.y \
			or cell.x >= bounds.position.x + bounds.size.x or cell.y >= bounds.position.y + bounds.size.y:
		report["reason"] = "A1_RUNTIME_WORLD_EXTENT_ABSENT"
		return report
	var scene := String(report["scene"])
	if scene.is_empty() or not ResourceLoader.exists(scene):
		report["reason"] = "A8_SHELL_SCENE_ABSENT"
		return report
	report["ok"] = true
	report["reason"] = ""
	return report


func mount(world: Node, hero: Node2D, poi_id: String) -> Dictionary:
	last_error = ""
	if world == null or hero == null:
		last_error = "seats_absent"
		return {"ok": false, "reason": last_error}
	if not bool(ProjectSettings.get_setting(SETTING, false)):
		last_error = "mount_not_enabled"
		return {"ok": false, "reason": last_error}
	var report := probe(world, poi_id)
	if not bool(report.get("ok", false)):
		last_error = String(report.get("reason", "probe_refused"))
		return report
	var packed := load(String(report["scene"])) as PackedScene
	if packed == null:
		last_error = "A8_SHELL_SCENE_UNLOADABLE"
		return {"ok": false, "reason": last_error}
	var node := packed.instantiate() as Node2D
	if node == null:
		last_error = "A8_SHELL_NOT_NODE2D"
		return {"ok": false, "reason": last_error}
	var cell: Array = report["cell"]
	site_root = Vector2(int(cell[0]) * 16 + 8, int(cell[1]) * 16 + 8)
	node.name = "A8Site_" + poi_id
	node.position = site_root
	world.add_child(node)
	if node.has_signal(&"intent_requested"):
		node.connect(&"intent_requested", handle_intent)
	if node.has_signal(&"transition_requested"):
		node.connect(&"transition_requested", handle_transition)
	mounted_poi = poi_id
	return report


## A8 sends an identity-only intent. A0 decides; A3 authorizes the reward. With no
## approved binding this returns a refusal and commits nothing, which is what the
## three south sites do today.
func handle_intent(intent: Dictionary) -> Dictionary:
	var poi_id := String(intent.get("site_instance_id", intent.get("poi_id", "")))
	var action_id := String(intent.get("action_id", ""))
	var binding := _binding_for(poi_id, {"action_id": action_id})
	if binding.is_empty():
		return {"ok": false, "reason": "A3_BINDING_ABSENT", "poi_id": poi_id, "action_id": action_id}
	return {"ok": false, "reason": "A0_INTENT_HOST_PENDING", "binding_id": String(binding.get("binding_id", ""))}


## Captures the exact overworld position before a site transition and stores ONE
## durable receipt in the single SaveService. A repeated request for the same site
## and run returns the already-applied result instead of a second receipt.
func begin_transition(save: Node, site_instance_id: String, hero_position: Vector2) -> Dictionary:
	if save == null or site_instance_id.is_empty() or not is_finite(hero_position.x) or not is_finite(hero_position.y):
		return {"ok": false, "reason": "transition_seats_absent"}
	var run := _run_identity()
	if String(run.get("run_id", "")).is_empty():
		return {"ok": false, "reason": "A0_RUN_ABSENT"}
	var key := ENTRY_RECEIPT % site_instance_id
	var record := {"site_instance_id": site_instance_id, "position": [hero_position.x, hero_position.y],
		"run_id": String(run["run_id"]), "run_epoch": int(run.get("run_epoch", 0))}
	var applied := bool(save.call(&"transact_once", key,
		func(candidate: Dictionary) -> bool:
			var site: Dictionary = candidate.get("site_transition", {})
			if site.has(site_instance_id):
				return false
			site[site_instance_id] = record.duplicate(true)
			candidate["site_transition"] = site
			return true,
		{"kind": "a0_site_entry", "site_instance_id": site_instance_id}))
	if not applied:
		return {"ok": false, "reason": "A0_ENTRY_RECEIPT_ALREADY_PRESENT", "key": key}
	return {"ok": true, "key": key, "record": record}


## Restores the owner-recorded position only for the same site, the same run and
## the exact stored coordinate. A replayed or cross-site return fails closed.
func finish_transition(save: Node, site_instance_id: String) -> Dictionary:
	if save == null or site_instance_id.is_empty():
		return {"ok": false, "reason": "transition_seats_absent"}
	var document: Dictionary = save.call(&"get_snapshot")
	var record: Variant = (document.get("site_transition", {}) as Dictionary).get(site_instance_id, null)
	if not record is Dictionary:
		return {"ok": false, "reason": "A0_ENTRY_RECEIPT_ABSENT"}
	var run := _run_identity()
	if String(run.get("run_id", "")) != String((record as Dictionary).get("run_id", "")) \
			or int(run.get("run_epoch", -1)) != int((record as Dictionary).get("run_epoch", -2)):
		return {"ok": false, "reason": "A0_RUN_IDENTITY_MISMATCH"}
	var coords: Array = (record as Dictionary).get("position", [])
	if coords.size() != 2:
		return {"ok": false, "reason": "A0_ENTRY_POSITION_INVALID"}
	var applied := bool(save.call(&"transact_once", RETURN_RECEIPT % site_instance_id,
		func(candidate: Dictionary) -> bool:
			var site: Dictionary = candidate.get("site_transition", {})
			if not site.has(site_instance_id):
				return false
			site.erase(site_instance_id)
			candidate["site_transition"] = site
			return true,
		{"kind": "a0_site_return", "site_instance_id": site_instance_id}))
	if not applied:
		return {"ok": false, "reason": "A0_RETURN_REPLAYED"}
	return {"ok": true, "position": Vector2(float(coords[0]), float(coords[1]))}


func handle_transition(request: Dictionary) -> Dictionary:
	var site_instance_id := String(request.get("site_instance_id", ""))
	if site_instance_id.is_empty():
		return {"ok": false, "reason": "A0_TRANSITION_IDENTITY_ABSENT"}
	return {"ok": false, "reason": "A0_TRANSITION_HOST_PENDING", "site_instance_id": site_instance_id}


func _run_identity() -> Dictionary:
	var lifecycle := get_node_or_null("/root/RunLifecycle")
	if lifecycle == null or not lifecycle.has_method(&"phase"):
		return {}
	return lifecycle.call(&"phase")


func _read(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	return parsed if parsed is Dictionary else {}


func _site(package: Dictionary, poi_id: String) -> Dictionary:
	for raw: Variant in package.get("existing_a8_sites", []):
		if raw is Dictionary and String((raw as Dictionary).get("poi_id", "")) == poi_id:
			return raw
	return {}


func _a1_poi(graph: Dictionary, poi_id: String) -> Dictionary:
	for raw: Variant in graph.get("pois", []):
		if raw is Dictionary and String((raw as Dictionary).get("poi_id", "")) == poi_id:
			return raw
	return {}


func _cell(data: Dictionary) -> Vector2i:
	for key: String in ["canonical_cell", "anchor_cell", "cell"]:
		var value: Variant = data.get(key, [])
		if value is Array and (value as Array).size() == 2:
			return Vector2i(int((value as Array)[0]), int((value as Array)[1]))
	return Vector2i(-1, -1)


func _binding_for(poi_id: String, site: Dictionary) -> Dictionary:
	var data := _read(A3_BINDINGS)
	var action := String(site.get("action_id", ""))
	for raw: Variant in data.get("bindings", []):
		if not raw is Dictionary:
			continue
		if String((raw as Dictionary).get("poi_id", "")) != poi_id:
			continue
		if not action.is_empty() and String((raw as Dictionary).get("action_id", "")) != action:
			continue
		return raw
	return {}


func _world_bounds(world: Node) -> Rect2i:
	var physical := world.get(&"world") as OverworldWorld if world != null else null
	if physical == null:
		return Rect2i()
	return Rect2i(0, 0, physical.width, physical.height)
