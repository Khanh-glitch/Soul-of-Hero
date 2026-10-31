extends "res://tests/survival/balance_native_r10/r10_harness.gd"
## A7 harness for round 11 (CT multidimensional gameplay gate).
##
## Round 10's composition is stale: every owner that matters moved. This family
## starts from the *current* bytes and never inherits a round-10 verdict. The
## helpers here exist so a round-11 probe can talk about the product the player
## runs rather than about a method that merely exists:
##
##   * `_mount_world_ready()` — the shipped overworld, brought to READY, with the
##     economy composition and run lifecycle it built reported separately;
##   * `_composition()` / `_lifecycle()` / `_a3()` / `_adapter()` — the four
##     authorities behind one run, each optional so a missing one is reported by
##     name instead of crashing the probe;
##   * `_tool_instance()` — a real A3 tool instance. This is A3's authoring API,
##     **not** the player's crafting path, and every probe that uses it says
##     `MUTATION_AUTHORED_TOOL` in the affected note;
##   * `_node_of_kind()` — a real mounted resource node, so a harvest claim is
##     about the world and not about a string;
##   * `_stacks()` / `_count_item()` — the bag as the game stores it;
##   * `_source_has()` / `_source_calls()` — a read-only census of who calls a
##     symbol in `game/`, because "the method exists" and "the player can reach it"
##     are different claims and only the second one is gameplay.
##
## Nothing in this file edits an owner file, invents a rate, or upgrades a missing
## feature to a pass.

const W_COMPOSITION := "res://game/survival/economy/a0_economy_composition.gd"
const W_LIFECYCLE := "res://game/survival/economy/a0_run_lifecycle.gd"
const W_OFFLINE := "res://game/survival/economy/a0_offline_host.gd"
const W_PROFILE_PORT := "res://game/survival/economy/a0_profile_port.gd"

var world_ready := false
var composition: Node = null
var lifecycle: Node = null


# ------------------------------------------------------------------- mounting
## Mount and report what the *product* built, without asserting anything.
func _mount_world_ready(force_waystation := false, viewport := Vector2i(1280, 720)) -> Node:
	var mounted := await _mount_production_world(force_waystation, viewport)
	if mounted == null:
		return null
	world_ready = true
	composition = mounted.get(&"economy_composition") as Node
	lifecycle = root.get_node_or_null("RunLifecycle")
	return mounted


func _a3() -> Node:
	if not is_instance_valid(mounted_world):
		return null
	return mounted_world.get(&"economy_session") as Node


func _adapter() -> RefCounted:
	var economy := _a3()
	if economy == null:
		return null
	return economy.get(&"_adapter") as RefCounted


func _a3_document() -> Dictionary:
	var adapter := _adapter()
	if adapter == null:
		return {}
	return adapter.call(&"document") as Dictionary


func _composition() -> Node:
	return composition if is_instance_valid(composition) else null


func _lifecycle() -> Node:
	return lifecycle if is_instance_valid(lifecycle) else null


func _active_run() -> Dictionary:
	var node := _lifecycle()
	if node == null or not node.has_method(&"run_record"):
		return {}
	return node.call(&"run_record") as Dictionary


func _run_phase() -> Dictionary:
	var node := _lifecycle()
	if node == null or not node.has_method(&"phase"):
		return {}
	return node.call(&"phase") as Dictionary


# ------------------------------------------------------------------- inventory
func _stacks() -> Dictionary:
	var save := _save()
	if save == null:
		return {}
	return save.call(&"get_snapshot").get("inventory", {}).get("item_stacks", {}) as Dictionary


## The bag as SaveService writes it: `item_stacks[stack_key] = {kind, quantity}`,
## where the stack key is the bare item id for the first stack and an overflow key
## for the next one. A reader that insists on a separate `item_id` field counts zero
## of everything, so the key is the fallback identity here.
func _count_item(item_id: String) -> int:
	var total := 0
	var stacks := _stacks()
	for key: Variant in stacks.keys():
		var record: Variant = stacks[key]
		if not record is Dictionary:
			continue
		var identity := String((record as Dictionary).get("item_id", key))
		if identity == item_id or String(key) == item_id or String(key).begins_with(item_id + "_stack"):
			total += int((record as Dictionary).get("quantity", 0))
	return total


func _stack_keys_with(item_id: String) -> Array[String]:
	var out: Array[String] = []
	var stacks := _stacks()
	for key: Variant in stacks.keys():
		var record: Variant = stacks[key]
		if not record is Dictionary:
			continue
		var identity := String((record as Dictionary).get("item_id", key))
		if identity == item_id or String(key) == item_id or String(key).begins_with(item_id + "_stack"):
			out.append(String(key))
	return out


## Grant through the real SaveService. This is a fixture: every caller says
## `FIXTURE_GRANT` in the check label, so a clause that only holds because the
## probe handed itself materials can never read as a player achievement.
func _grant(item_id: String, kind_id: String, quantity: int, key := "") -> bool:
	var save := _save()
	if save == null:
		return false
	var tx := key if not key.is_empty() else "a7_r11_grant_%s_%d_%d" % [item_id, quantity, Time.get_ticks_usec()]
	tx = tx.replace(".", "_")
	return bool(save.call(&"grant_inventory_item", item_id, kind_id, quantity, tx, {"source": "a7.r11.fixture"}))


## The catalogue's own definition for an item id, read through the mounted
## survival service. A fixture that hands the bag an item has to speak the
## catalogue's vocabulary, not an invented one.
func _catalog_item(item_id: String) -> Dictionary:
	var svc: Node = _survival()
	if svc == null or not svc.has_method(&"item_definition"):
		return {}
	var definition: Variant = svc.call(&"item_definition", item_id)
	return definition as Dictionary if definition is Dictionary else {}


## Put `quantity` of a catalogue item in the bag through the one inventory writer,
## using the kind mapping the economy service itself applies. Two product facts are
## encoded here rather than papered over:
##
## * `SaveService.INVENTORY_ITEM_KIND_IDS` is `[material, consumable, blueprint,
##   key_item]`, so the catalogue's `station_kit`, `equipment` and `skill_core`
##   kinds cannot be written as themselves;
## * A3 maps `station_kit` to `material` at its own reward and craft-output doors
##   (`economy_service._add_source_reward` / `_add_outputs`), which is the only
##   reason a furnace kit can be held at all.
##
## Returns false when the item cannot be written by that door, which is a product
## finding for the caller to record, not a harness workaround to hide.
func _grant_item(item_id: String, quantity: int, key := "") -> bool:
	var definition := _catalog_item(item_id)
	if definition.is_empty():
		_note("FIXTURE_REFUSED %s is not in the catalogue" % item_id)
		return false
	var kind := String(definition.get("kind", "material"))
	if kind == "station_kit":
		kind = "material"
	if not kind in ["material", "consumable", "blueprint", "key_item"]:
		_note("FIXTURE_REFUSED %s has catalogue kind %s, which the inventory writer rejects" % [item_id, kind])
		return false
	var tx := key if not key.is_empty() else "a7_r11_grant_%s_%d" % [item_id, Time.get_ticks_usec()]
	var ok := _grant(item_id, kind, quantity, tx)
	if not ok:
		_note("FIXTURE_REFUSED grant_inventory_item(%s, %s, %d) returned false" % [item_id, kind, quantity])
	return ok


## Put one `storage: instance` item in the bag the way the economy service does it:
## a real instance record in `state.instances` plus a `soh_i_<instance>` token stack.
## This is `economy_service.grant_instance`, the same door a core reward or a tool
## would use; it is not a raw save write.
func _grant_instance(item_id: String, key := "") -> String:
	# `grant_instance` is A3's service method; the A0 session in front of it only
	# forwards the commands a player can issue, and granting is not one of them.
	var economy: RefCounted = _adapter()
	if economy == null or not economy.has_method(&"grant_instance"):
		_note("FIXTURE_REFUSED no economy session to grant an instance of %s" % item_id)
		return ""
	var event_id := key if not key.is_empty() else "a7_r11_instance_%s_%d" % [item_id, Time.get_ticks_usec()]
	var granted: Variant = economy.call(&"grant_instance", item_id, event_id)
	if not granted is Dictionary:
		_note("FIXTURE_REFUSED grant_instance(%s) returned no dictionary" % item_id)
		return ""
	var result := granted as Dictionary
	if not bool(result.get("ok", false)):
		_note("FIXTURE_REFUSED grant_instance(%s) -> %s" % [item_id, String(result.get("reason", ""))])
		return ""
	return String(result.get("instance_id", ""))


# --------------------------------------------------------------- world objects
## First mounted resource node of a kind. `chapter1_overworld.survival_nodes` is a
## dictionary of real node objects, so this returns the product's own view rather
## than a guess from data.
func _node_of_kind(kind: String) -> String:
	var nodes := _nodes_of_kind(kind)
	if nodes.is_empty():
		return ""
	return String((nodes[0] as Node).get(&"node_id"))


## The first A3 instance the player owns, or "" when the bag holds none. Used by
## cases that need an already-owned tool rather than a fresh grant.
func _first_owned_instance(item_id := "") -> String:
	var adapter := _adapter()
	if adapter == null or not adapter.has_method(&"owned_instances"):
		return ""
	var owned: Variant = adapter.call(&"owned_instances", item_id)
	if not owned is Array or (owned as Array).is_empty():
		return ""
	var first: Variant = (owned as Array)[0]
	if first is Dictionary:
		return String((first as Dictionary).get("instance_id", ""))
	return ""


## Walk to the nearest of up to three nodes of a kind that the product will let the
## Hero interact with. Returns the node, or null when no candidate can be reached on
## foot — which is a fact about the world, not about the walker.
func _reach_any(kind: String) -> Node:
	var candidates := _nearest_nodes(kind, 3)
	for raw: Variant in candidates:
		var node: Node = raw
		var distance := hero.global_position.distance_to(node.global_position)
		var node_cell := Vector2i(int(floor(node.global_position.x / 16.0)), int(floor(node.global_position.y / 16.0)))
		var stand := _stand_cell_near(node_cell)
		if stand == Vector2i(-1, -1):
			_note("approach %s %s: no free reachable stand cell next to it" % [kind, String(node.get(&"node_id"))])
			continue
		var target := Vector2(stand.x * 16.0 + 8.0, stand.y * 16.0 + 8.0)
		var walked: Dictionary = await _walk_toward_point(target)
		var after := hero.global_position.distance_to(node.global_position)
		var in_reach := false
		if node.has_method(&"can_interact"):
			in_reach = bool(node.call(&"can_interact", hero))
		_note("approach %s %s: %.0f px -> %.0f px, walked=%s, can_interact=%s" % [
			kind, String(node.get(&"node_id")), distance, after, str(walked.get("ok", false)), str(in_reach),
		])
		if in_reach:
			return node
	return null


## The single nearest mounted node of a kind, or null.
func _nearest_node(kind: String) -> Node:
	var nodes := _nearest_nodes(kind, 1)
	return (nodes[0] as Node) if not nodes.is_empty() else null


## Walk into reach of a node and take one swing through the product's own door
## (`SurvivalResourceNode.interact`), reporting the tool's condition on both sides.
## Returns the observation, not a verdict: the caller decides what it means.
func _walk_and_interact(node: Node, kind: String, tool_instance_id := "") -> Dictionary:
	var observation := {
		"node_id": String(node.get(&"node_id")),
		"kind": kind,
		"interacted": false,
		"condition_before": -1,
		"condition_after": -1,
		"revision_before": -1,
		"revision_after": -1,
	}
	if not tool_instance_id.is_empty():
		observation["condition_before"] = int(_tool_record(tool_instance_id).get("condition", -1))
		observation["revision_before"] = int(_tool_record(tool_instance_id).get("revision", -1))
	await _walk_toward_point(node.global_position + Vector2(0, 22))
	for i in 12:
		await physics_frame
	observation["interacted"] = bool(node.call(&"interact", hero))
	await process_frame
	if not tool_instance_id.is_empty():
		observation["condition_after"] = int(_tool_record(tool_instance_id).get("condition", -1))
		observation["revision_after"] = int(_tool_record(tool_instance_id).get("revision", -1))
	return observation


## The mounted nodes of a kind, nearest first. A probe that walks has to walk to
## the closest real node, not to whichever one happened to be created first.
func _nearest_nodes(kind: String, limit := 3) -> Array:
	var nodes := _nodes_of_kind(kind)
	if nodes.is_empty() or not is_instance_valid(hero):
		return nodes
	var sorted := nodes.duplicate()
	sorted.sort_custom(func(a: Node, b: Node) -> bool:
		return hero.global_position.distance_to(a.global_position) < hero.global_position.distance_to(b.global_position))
	return sorted.slice(0, mini(limit, sorted.size()))


func _nodes_of_kind(kind: String) -> Array:
	var out: Array = []
	if not is_instance_valid(mounted_world):
		return out
	var nodes: Variant = mounted_world.get(&"survival_nodes")
	if nodes is Dictionary:
		for key: Variant in (nodes as Dictionary).keys():
			var node: Variant = (nodes as Dictionary)[key]
			if is_instance_valid(node) and String((node as Node).get(&"resource_kind")) == kind:
				out.append(node)
	return out


## A3's own authoring API for a unique tool instance. Not the player's crafting
## path; probes that use it label the claim `MUTATION_AUTHORED_TOOL`.
func _tool_instance(item_id := "stone_pick") -> Dictionary:
	var adapter := _adapter()
	if adapter == null or not adapter.has_method(&"grant_instance"):
		return {}
	return adapter.call(&"grant_instance", item_id, "a7.r11.probe", -1, -1) as Dictionary


func _tool_record(instance_id: String) -> Dictionary:
	var instances: Variant = _a3_document().get("instances", {})
	if instances is Dictionary:
		return (instances as Dictionary).get(instance_id, {}) as Dictionary
	return {}


# ------------------------------------------------------------------ source reads
func _source(path: String) -> String:
	if not FileAccess.file_exists(path):
		return ""
	return FileAccess.get_file_as_string(path)


## How many call sites outside the defining file name `symbol`. A census, not an
## assertion: the probe decides what the number means.
func _source_calls(root_dir: String, symbol: String, exempt: String) -> int:
	var count := 0
	var stack: Array[String] = [root_dir]
	while not stack.is_empty():
		var dir_path: String = stack.pop_back()
		var dir := DirAccess.open(dir_path)
		if dir == null:
			continue
		dir.list_dir_begin()
		var name := dir.get_next()
		while not name.is_empty():
			var full := dir_path.path_join(name)
			if dir.current_is_dir():
				if not name.begins_with("."):
					stack.append(full)
			elif name.ends_with(".gd"):
				if not full.ends_with(exempt):
					var text := FileAccess.get_file_as_string(full)
					var at := text.find(symbol)
					while at >= 0:
						count += 1
						at = text.find(symbol, at + symbol.length())
			name = dir.get_next()
		dir.list_dir_end()
	return count


# --------------------------------------------------------------- wall clock
## Let the product's own world clock run. Used for a recipe duration, never to fake
## elapsed real time: the frames are real and the session advances them itself.
func _wait_seconds(seconds: float) -> void:
	var deadline := Time.get_ticks_msec() + int(seconds * 1000.0)
	while Time.get_ticks_msec() < deadline:
		await physics_frame


# --------------------------------------------------------------------- walking
## A stand cell next to a world object that the product's own grid says is free and
## reachable from where the Hero is. Returns (-1,-1) when there is none, which is a
## fact about the world rather than about the walker.
func _stand_cell_near(cell: Vector2i, radius := 3) -> Vector2i:
	if traversability == null:
		return cell
	var origin := _hero_cell()
	for r in range(1, radius + 1):
		for offset: Vector2i in [Vector2i(0, r), Vector2i(0, -r), Vector2i(r, 0), Vector2i(-r, 0),
				Vector2i(r, r), Vector2i(-r, r), Vector2i(r, -r), Vector2i(-r, -r)]:
			var candidate: Vector2i = cell + offset
			if not bool(traversability.call(&"is_free", candidate)):
				continue
			if traversability.has_method(&"is_reachable") and not bool(traversability.call(&"is_reachable", origin, candidate)):
				continue
			return candidate
	return Vector2i(-1, -1)


## Walk toward a world point with real keys, re-deciding the direction every few
## frames and sidestepping when the primary axis stops making progress. A straight
## `move_up` into a rock is not evidence that a place is unreachable, and a walker
## that gives up at the first obstacle would report the wrong thing about the world.
func _walk_toward_point(target: Vector2, budget := 1600, stop_within := 18.0) -> Dictionary:
	var travelled := 0.0
	var sidestep := 0
	var stall := 0
	var last := hero.global_position
	for i in budget:
		var delta := target - hero.global_position
		if delta.length() <= stop_within:
			return {"ok": true, "frames": i, "moved": travelled}
		var action := ""
		var vertical := absf(delta.y) > absf(delta.x)
		if sidestep > 0:
			# Move along the axis we were not using, to get around whatever is in the way.
			sidestep -= 1
			if vertical:
				action = "move_right" if delta.x >= 0.0 else "move_left"
			else:
				action = "move_down" if delta.y >= 0.0 else "move_up"
		elif vertical:
			action = "move_down" if delta.y > 0.0 else "move_up"
		else:
			action = "move_right" if delta.x > 0.0 else "move_left"
		Input.action_press(action)
		await physics_frame
		Input.action_release(action)
		var step := last.distance_to(hero.global_position)
		travelled += step
		last = hero.global_position
		if step < 0.4:
			stall += 1
			if stall >= 6:
				sidestep = 14
				stall = 0
		else:
			stall = 0
	return {"ok": false, "frames": budget, "moved": travelled,
		"remaining": hero.global_position.distance_to(target)}


# -------------------------------------------------------------- placement doors
## A cell the product itself accepts for a structure, searched outward from a
## point. A refused cell is a real refusal (`on_route`, `protected_place`), so the
## search is part of the measurement rather than a convenience.
func _free_cell_near(origin: Vector2i, build: Node, radius_max := 8) -> Vector2i:
	for radius in range(1, radius_max + 1):
		for offset: Vector2i in [Vector2i(radius, 0), Vector2i(-radius, 0), Vector2i(0, radius),
				Vector2i(0, -radius), Vector2i(radius, radius), Vector2i(-radius, -radius)]:
			var cell: Vector2i = origin + offset
			if String(build.call(&"validate_cell", cell)) == "":
				return cell
	return Vector2i(-1, -1)


## The product's own placement door: the HUD selects a piece, then commits a cell.
## Nothing is bypassed, so a cost, a clearance rule or a route refusal shows up in
## the result instead of being skipped by the probe.
func _place(build: Node, piece_id: String, cell: Vector2i) -> Dictionary:
	if build == null or not build.has_method(&"try_place"):
		return {"ok": false, "reason": "no_placement_door"}
	if build.has_method(&"select_piece") and not bool(build.call(&"select_piece", piece_id)):
		return {"ok": false, "reason": "piece_not_selectable"}
	return build.call(&"try_place", cell) as Dictionary


# ------------------------------------------------------------------ run clock
## Move the run's own durable clock. This is the one mutation a real playthrough
## cannot produce inside a probe (eleven days of wall time), and every probe that
## uses it says `MUTATION_RUN_CLOCK` in the note and never claims a player can jump
## the clock. Everything downstream of the record is the product's own code.
func _forge_run_clock(seconds_ago: int) -> bool:
	var save := _save()
	if save == null:
		return false
	var target := int(Time.get_unix_time_from_system()) - seconds_ago
	var max_seconds := 1209600
	save.call(&"transact_once", "a7.r11.forge.%d.%d" % [seconds_ago, Time.get_ticks_usec()],
		func(candidate: Dictionary) -> bool:
			var root: Variant = candidate.get("profile", {})
			if not root is Dictionary:
				return false
			var run: Variant = (root as Dictionary).get("run", {})
			if not run is Dictionary or (run as Dictionary).is_empty():
				return false
			(run as Dictionary)["run_started_at_unix"] = target
			(run as Dictionary)["run_expires_at_unix"] = target + max_seconds
			(run as Dictionary)["run_max_seconds"] = max_seconds
			(root as Dictionary)["run"] = run
			candidate["profile"] = root
			return true,
		{"kind": "a7_r11_forge_run_clock"})
	var phase := _run_phase()
	_note("MUTATION_RUN_CLOCK forged run_started_at_unix=%d (%d s ago); state=%s phase=%s" % [
		target, seconds_ago, String(phase.get("state", "")), String(phase.get("phase", "")),
	])
	return int(phase.get("run_started_at_unix", 0)) == target


func _endpoint_stand_cell(endpoint_id: String) -> Vector2i:
	var policy := _policy()
	for field: String in ["deposit_endpoints", "vending_machines", "recycler_machines"]:
		for entry: Variant in (policy.get(field, []) as Array):
			if not entry is Dictionary:
				continue
			var id := String((entry as Dictionary).get("endpoint_id", (entry as Dictionary).get("machine_id", "")))
			if id != endpoint_id:
				continue
			var cells: Array = (entry as Dictionary).get("stand_cells", [])
			if not cells.is_empty() and cells[0] is Array and (cells[0] as Array).size() == 2:
				return Vector2i(int(cells[0][0]), int(cells[0][1]))
	return Vector2i(-1, -1)


# ------------------------------------------------------------ endpoint authority
func _endpoint_report() -> Dictionary:
	var node := _composition()
	if node == null or not node.has_method(&"endpoint_report"):
		return {}
	return node.call(&"endpoint_report") as Dictionary


func _balance() -> int:
	var port: RefCounted = _composition().get(&"_port") if _composition() != null else null
	if port == null:
		return -1
	return int(port.call(&"balance"))


## The profile the *mounted* composition bound. Named apart from the round-10
## `_profile()` helper, which builds its own port: this one must be the product's.
func _bound_profile() -> Dictionary:
	var port: RefCounted = _composition().get(&"_port") if _composition() != null else null
	if port == null:
		return {}
	return port.call(&"read_profile", _save().call(&"get_snapshot")) as Dictionary
