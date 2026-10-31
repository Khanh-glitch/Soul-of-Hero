extends SceneTree
## R13-A0-WORLD — the authored continent, played by the real player.
##
## Every earlier world gate proved a component. This one plays the product: a real
## body, chosen as one of the two Adventurers, boots the production overworld,
## spawns on A1's authored terrain, walks it with directional input, harvests a
## physical authored source, walks to A8's South Quarry shell at A1's canonical
## cell, enters it through the doorway, works at its socket, retreats, then takes a
## different route to the South Orchard, returns, saves — and a second OS process
## resumes the same run, world, spawn, position and inventory.
##
## Nothing is granted, teleported or queued behind the world's back:
##   * movement is `move_left/right/up/down`, pressed as a player presses them;
##   * harvesting and every site interaction is the `G` key (the key A8's own prompt
##     prints: "G · Enter"), sent as a real InputEventKey so a missing binding fails;
##   * the save is SaveService's own commit, the same one a quit makes.
##
## A0 keeps the negative cases too: cells outside the frame, water, a blocked
## neighbour, an unloaded chunk, a spawn stored for a foreign run, and a site reward
## request that must be refused because A3 has not authorized the source.
##
## Two processes, one run:
##   godot --headless --path . --script res://tests/survival_a0_authored_world_route_test.gd
##   godot --headless --path . --script res://tests/survival_a0_authored_world_route_test.gd -- --verify-route
## The second invocation is a different OS process reading only what the first one
## left in the save file; `--keep-route` leaves the save for that second run.

const OW_SCENE_PATH := "res://game/overworld/chapter1_overworld.tscn"
const BUILD_TIMEOUT_MS := 120_000
const QUARRY := "poi_crown_south_quarry"
const ORCHARD := "poi_crown_south_orchard"
const AUDIT := "user://tests/a0_authored_route_audit.json"
const SAVE := "user://tests/a0_authored_route.json"
const G := KEY_G

var failures: Array[String] = []
var checks := 0
var _host: Node = null
var _ow: Node = null
var _phase := "play"
var _keep := false
var _body_complete := false
var _notes: Array[String] = []


func _initialize() -> void:
	_console.call_deferred()


func _console() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg == "--verify-route":
			_phase = "verify"
		elif arg == "--keep-route":
			_keep = true
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	var save := root.get_node_or_null("SaveService")
	if save != null:
		save.call(&"configure_storage", SAVE, false)
		if _phase == "play":
			# A fresh profile with no run: the world is what opens the run, exactly as
			# it does for a player who has just chosen an Adventurer.
			save.call(&"reset_to_defaults", "RESET_SOUL_OF_HERO_SAVE")
			# The player picks a male Adventurer through the real identity API — the
			# same call A6's avatar screen makes. The gate then asserts the *product*
			# presents that identity and moves that body.
			var chosen := bool(save.call(&"set_player_avatar", "male", "r13_gate"))
			_expect(chosen, "the save accepts a Male Adventurer identity")
			save.call(&"save_now")
	await _boot()
	if _ow != null:
		if _phase == "verify":
			await _verify_body()
		else:
			await _play_body()
		_body_complete = true
	_teardown()
	await process_frame
	_finish()


# ---------------------------------------------------------------------------
# harness
# ---------------------------------------------------------------------------
func _normalize_headless_window() -> void:
	# A headless DisplayServer reports a 0x0 window, so the stretch transform
	# collapses and every screen->world conversion is wrong. Declaring the window the
	# gate represents gives the same 2x transform a 720p window uses. Harness only.
	if DisplayServer.get_name() != "headless":
		return
	if root.size == Vector2i(1280, 720):
		return
	root.size = Vector2i(1280, 720)


func _boot() -> void:
	_normalize_headless_window()
	var scene: PackedScene = load(OW_SCENE_PATH) as PackedScene
	if scene == null:
		_expect(false, "the production overworld scene loads")
		return
	_host = Node2D.new()
	_host.name = "AuthoredRouteHost"
	root.add_child(_host)
	_ow = scene.instantiate()
	_host.add_child(_ow)
	_ow.configure({})
	var deadline := Time.get_ticks_msec() + BUILD_TIMEOUT_MS
	while Time.get_ticks_msec() < deadline:
		await process_frame
		if _ow.has_method(&"is_world_ready") and bool(_ow.call(&"is_world_ready")):
			return
		var err := String(_ow.get(&"build_error"))
		if not err.is_empty():
			_expect(false, "the authored world built (%s)" % err)
			_ow = null
			return
	_expect(false, "the authored world built within %d ms" % BUILD_TIMEOUT_MS)
	_ow = null


func _teardown() -> void:
	_release_moves()
	if _host != null and is_instance_valid(_host):
		_host.queue_free()
	_host = null


func _expect(condition: bool, label: String) -> void:
	checks += 1
	if condition:
		print("  ok    %s" % label)
	else:
		failures.append(label)
		print("  FAIL  %s" % label)


func _note(text: String) -> void:
	_notes.append(text)
	print("  note  %s" % text)


func _finish() -> void:
	_release_moves()
	if _phase == "verify":
		print("A0_AUTHORED_ROUTE_VERIFY checks=%d failures=%d" % [checks, failures.size()])
	if not _keep and FileAccess.file_exists(SAVE):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE))
	if failures.is_empty():
		print("A0 AUTHORED WORLD ROUTE PASSED - %d checks (%s)" % [checks, _phase])
		quit(0)
		return
	print("A0 AUTHORED WORLD ROUTE FAILED - %d/%d (%s)" % [failures.size(), checks, _phase])
	for failure: String in failures:
		print("  - %s" % failure)
	quit(1)


# ---------------------------------------------------------------------------
# process 1 — New Game on the continent
# ---------------------------------------------------------------------------
func _play_body() -> void:
	var hero: CharacterBody2D = _ow.get(&"player")
	var camera: Camera2D = _ow.get(&"camera")
	var authority: Node = _ow.get(&"world_authority")
	var world: OverworldWorld = _ow.get(&"world")
	var traversability: OverworldTraversability = _ow.get(&"traversability")
	_expect(hero != null and camera != null and authority != null and world != null and traversability != null,
		"the authored world exposes its seats (body, camera, authority, view, walkability)")
	if hero == null or camera == null or authority == null or world == null or traversability == null:
		return

	# --- 1. one world, and it is A1's continent ------------------------------
	var report: Dictionary = authority.call(&"source_report")
	print("A0_AUTHORED_REPORT ", JSON.stringify(report))
	var mode := String(_ow.call(&"world_authority_report").get("mode", ""))
	_expect(mode == "authored", "the mounted world authority is the authored continent (%s)" % mode)
	_expect(String(_ow.get(&"authored_world_error")) == "",
		"the authored world mounted without a refusal (%s)" % String(_ow.get(&"authored_world_error")))
	_expect(world.width == 1024 and world.height == 768,
		"gameplay is the authored 1024x768 frame, not the legacy 384x256 inset (%dx%d)" % [world.width, world.height])
	var stream: Dictionary = report.get("stream", {})
	_expect(int(stream.get("chunks_loaded", 0)) > 0,
		"A1's streamer mounted authored chunks (%d live, max %d)"
			% [int(stream.get("chunks_loaded", 0)), int(stream.get("max_chunks", 0))])
	_expect(stream.get("error", "") == "" or stream.get("error") == null,
		"the authored stream reports no error (%s)" % str(stream.get("error", "")))
	_expect(camera.limit_right == 1024 * 16 and camera.limit_bottom == 768 * 16,
		"the camera is bounded by the continent, not the legacy inset (%d,%d)"
			% [camera.limit_right, camera.limit_bottom])
	var collision_root: Node = authority.call(&"collision_root")
	var bodies := 0
	if collision_root != null:
		for child: Node in collision_root.get_children():
			for body_node: Node in child.get_children():
				if body_node is StaticBody2D:
					bodies += 1
	_expect(bodies > 0, "A1's streamed collision bodies are mounted (%d StaticBody2D)" % bodies)

	# --- 2. the chosen Adventurer is the body that moves --------------------
	var presenter: Node = hero.get_node_or_null("AvatarPresenter")
	_expect(presenter != null, "the shipped player scene carries A6's avatar presenter")
	var avatar: Dictionary = root.get_node(&"SaveService").call(&"get_player_avatar")
	print("A0_AUTHORED_AVATAR ", JSON.stringify(avatar))
	_expect(String(avatar.get("gender", "")) == "male",
		"the saved identity is the Adventurer the player chose (%s)" % String(avatar.get("gender", "")))
	if presenter != null and presenter.has_method(&"get_presentation_state"):
		var presentation: Dictionary = presenter.call(&"get_presentation_state")
		print("A0_AUTHORED_PRESENTATION ", JSON.stringify(presentation))
		var status := String(presentation.get("status", ""))
		if status == "READY":
			_expect(String(presentation.get("gender", "")) == "male",
				"the presented avatar is the male Adventurer (%s)" % String(presentation.get("gender", "")))
			_expect(bool(presentation.get("ready", false)), "the avatar presentation is live")
		else:
			# Art is A6's to publish. A source-blocked presenter is named, not hidden,
			# and never counted as a pass for the avatar pixels.
			_note("avatar pixels NOT_TESTED: presenter status=%s reason=%s"
				% [status, String(presentation.get("reason", ""))])
			_expect(String(presentation.get("gender", "")) in ["", "male"],
				"the presenter never presents a different identity (%s)" % String(presentation.get("gender", "")))
	_expect(hero.has_method(&"get_facing_direction") and hero.get(&"move_input") != null,
		"the body is the real movement controller (move_input + facing), not a static stand-in")

	# --- 3. a safe, broadly distributed, persisted spawn --------------------
	var spawn: Dictionary = authority.call(&"spawn_record")
	print("A0_AUTHORED_SPAWN ", JSON.stringify(spawn))
	var spawn_cell: Array = spawn.get("cell", [])
	_expect(spawn_cell.size() == 2, "the run has a spawn cell (%s)" % str(spawn_cell))
	_expect(int(spawn.get("candidates", 0)) > 1000,
		"the spawn is drawn from A1's broad safe index (%d cells over %d chunks)"
			% [int(spawn.get("candidates", 0)), int(spawn.get("candidate_chunks", 0))])
	var spawn_vector := Vector2i(int(spawn_cell[0]), int(spawn_cell[1])) if spawn_cell.size() == 2 else Vector2i(-1, -1)
	_expect(bool(traversability.call(&"is_free", spawn_vector)),
		"the spawn cell is walkable in the running world (%s)" % str(spawn_vector))
	var saved_path: Array[String] = ["survival", "authored_world"]
	var stored: Variant = root.get_node(&"SaveService").call(&"get_value", saved_path, {})
	_expect(stored is Dictionary and not (stored as Dictionary).is_empty(),
		"the spawn is committed to A0's one SaveService, not to a second store")
	_expect(spawn_vector == traversability.call(&"cell_of", hero.global_position),
		"the body starts on the stored spawn cell (%s vs %s)"
			% [str(spawn_vector), str(traversability.call(&"cell_of", hero.global_position))])
	var run_phase: Dictionary = root.get_node(&"RunLifecycle").call(&"phase")
	_expect(String(run_phase.get("run_id", "")) == String(spawn.get("run_id", "")),
		"the spawn is bound to the run standing in it (%s)" % String(run_phase.get("run_id", "")))

	# --- 4. negative cases, measured before the happy path -----------------
	_expect(not bool(authority.call(&"cell_is_walkable", Vector2i(-1, 0)))
		and not bool(authority.call(&"cell_is_walkable", Vector2i(1024, 768))),
		"cells outside the authored frame are not walkable")
	_expect(not bool(authority.call(&"cell_is_walkable", Vector2i(100000, 100000))),
		"a cell in a chunk that was never streamed is not walkable")
	var water := _find_surface(hero.global_position, "water", 40)
	if water != Vector2i(-1, -1):
		_expect(not bool(authority.call(&"cell_is_walkable", water)),
			"an authored water cell is not walkable (%s, surface=%s)"
				% [str(water), String(authority.call(&"cell_surface", water))])
	else:
		_note("no water within 40 cells of this spawn; the water case is NOT_APPLICABLE here")
	var blocked := _find_blocked_neighbour(hero.global_position, traversability)
	if blocked != Vector2i(-1, -1):
		_expect(not bool(authority.call(&"cell_is_walkable", blocked)),
			"a blocked neighbour really blocks (%s, kind=%d)"
				% [str(blocked), int(traversability.call(&"blocked_kind", blocked))])
	else:
		_note("no blocked neighbour within 7 cells of this spawn; that case is NOT_APPLICABLE here")
	var refused := _stale_spawn_probe(authority)
	_expect(String(refused.get("reason", "")) == "refused",
		"a spawn stored for a foreign run is not resumed (%s at %s)"
			% [String(refused.get("reason", "")), str(refused.get("foreign_cell", []))])

	# --- 5. real movement, real collision, real camera ---------------------
	var start_position: Vector2 = hero.global_position
	var target := start_position + Vector2(0, 96)
	var walked := await _walk_input(hero, target, 300)
	_expect(walked, "ordinary directional input moves the body across authored terrain")
	_expect(hero.global_position.distance_to(start_position) > 24.0,
		"the body really travelled (%.1f px)" % hero.global_position.distance_to(start_position))
	_expect(bool(traversability.call(&"is_free", traversability.call(&"cell_of", hero.global_position))),
		"the body stands on walkable authored ground after the walk")
	_expect(camera.get_screen_center_position().distance_to(start_position) > 8.0,
		"the camera follows the body through the continent")
	# Collision is physical, not a rule: walk into a blocked cell and be stopped.
	var before_wall := hero.global_position
	if blocked != Vector2i(-1, -1):
		var wall := Vector2(blocked.x * 16.0 + 8.0, blocked.y * 16.0 + 8.0)
		await _walk_input(hero, wall, 240, 6.0)
		_expect(hero.global_position.distance_to(wall) > 4.0,
			"a blocked cell is not entered by walking into it (stopped %.1f px away)"
				% hero.global_position.distance_to(wall))
		_note("wall probe: from %s to %s, target %s" % [str(before_wall), str(hero.global_position), str(wall)])

	# --- 6. harvest a physical authored source ------------------------------
	var source := await _harvest_journey(hero)
	_expect(not source.is_empty(), "an authored source is harvested by walking to it and pressing G (%s)" % str(source))
	if not source.is_empty():
		_expect(int(source.get("after", 0)) > int(source.get("before", 0)),
			"the bag grew by the node's yield (%d -> %d %s)"
				% [int(source.get("before", 0)), int(source.get("after", 0)), String(source.get("item", ""))])

	# --- 7. South Quarry: walk, arrive, enter, work, retreat ----------------
	var quarry := await _site_journey(hero, authority, QUARRY)
	print("A0_AUTHORED_SITE_QUARRY ", JSON.stringify(quarry))
	_expect(bool(quarry.get("reached", false)),
		"the player walks to the Quarry shell at A1's canonical cell (%s)" % JSON.stringify(quarry.get("approach", [])))
	_expect(bool(quarry.get("entered", false)), "the player enters the Quarry through its physical doorway")
	_expect(bool(quarry.get("worked", false)), "the player works at the Quarry socket with the normal key")
	_expect(bool(quarry.get("reward_refused", false)), "the Quarry refuses to pay: A3 has not authorized the source")
	_expect(bool(quarry.get("retreated", false)), "the player retreats out of the Quarry to the exterior anchor")

	# --- 8. South Orchard by a different route ----------------------------
	var orchard := await _site_journey(hero, authority, ORCHARD)
	print("A0_AUTHORED_SITE_ORCHARD ", JSON.stringify(orchard))
	_expect(bool(orchard.get("reached", false)),
		"the player reaches the Orchard shell by a second route (%s)" % JSON.stringify(orchard.get("approach", [])))
	_expect(bool(orchard.get("entered", false)), "the player enters the Orchard through its physical doorway")
	_expect(bool(orchard.get("retreated", false)), "the player retreats out of the Orchard to the exterior anchor")
	_expect(float(orchard.get("walk_px", 0.0)) > 512.0,
		"the second site is a real journey away (%.0f px walked)" % float(orchard.get("walk_px", 0.0)))
	_expect(float(quarry.get("walk_px", 0.0)) > 512.0,
		"the first site is a real journey away (%.0f px walked)" % float(quarry.get("walk_px", 0.0)))

	# --- 9. return toward shelter and save --------------------------------
	var home := hero.global_position + Vector2(0, -96)
	var returned := await _walk_input(hero, home, 300)
	_expect(returned or hero.global_position.distance_to(home) < 120.0,
		"the player walks back toward shelter after the expedition")
	print("A0_AUTHORED_RETURN walked=%s at=%s" % [str(returned), str(hero.global_position)])
	var save := root.get_node(&"SaveService")
	_expect(bool(save.call(&"save_now")), "the run's world state commits before the process can die")
	if _ow.has_method(&"depart_world"):
		var departure: Dictionary = _ow.call(&"depart_world")
		print("A0_AUTHORED_DEPARTURE ", JSON.stringify(departure))
		_expect(bool(departure.get("persisted", false)), "the departure flush is durable")
	var audit := {
		"schema": "soh.a0.authored_route.v1",
		"run_id": String((root.get_node(&"RunLifecycle").call(&"phase") as Dictionary).get("run_id", "")),
		"spawn": spawn.duplicate(true),
		"world": [world.width, world.height],
		"position": [hero.global_position.x, hero.global_position.y],
		"inventory": _inventory_snapshot(),
		"avatar": avatar.duplicate(true),
		"sites": authority.call(&"site_summary"),
		"quarry": quarry,
		"orchard": orchard,
		"harvest": source,
	}
	var file := FileAccess.open(AUDIT, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(audit, "\t", true, true))
		file.close()
	_expect(FileAccess.file_exists(AUDIT), "the first process wrote its audit for the second process")
	_keep = true


# ---------------------------------------------------------------------------
# process 2 — the same run, in a different OS process
# ---------------------------------------------------------------------------
func _verify_body() -> void:
	var audit := _read_audit()
	_expect(not audit.is_empty(), "the second process reads the first process's audit")
	if audit.is_empty():
		return
	var hero: CharacterBody2D = _ow.get(&"player")
	var authority: Node = _ow.get(&"world_authority")
	var world: OverworldWorld = _ow.get(&"world")
	var save := root.get_node(&"SaveService")
	_expect(hero != null and authority != null and world != null, "the relaunched world exposes its seats")
	if hero == null or authority == null or world == null:
		return
	var phase: Dictionary = root.get_node(&"RunLifecycle").call(&"phase")
	var run_id := String(phase.get("run_id", ""))
	_expect(run_id == String(audit.get("run_id", "")),
		"the same run resumed (audit %s, relaunch %s)" % [String(audit.get("run_id", "")), run_id])
	_expect(world.width == 1024 and world.height == 768, "the relaunched world is still the authored continent")
	var spawn: Dictionary = authority.call(&"spawn_record")
	print("A0_AUTHORED_SPAWN_VERIFY ", JSON.stringify(spawn))
	_expect(bool(spawn.get("resumed", false)), "the saved spawn was resumed, not re-rolled")
	_expect(str(spawn.get("cell", [])) == str((audit.get("spawn", {}) as Dictionary).get("cell", [])),
		"the spawn cell is identical across processes (%s vs %s)"
			% [str(spawn.get("cell", [])), str((audit.get("spawn", {}) as Dictionary).get("cell", []))])
	var expected := _vector(audit.get("position", []))
	_expect(expected != Vector2.INF and hero.global_position.distance_to(expected) < 8.0,
		"the body resumes where the player left it (%s vs %s)" % [str(hero.global_position), str(expected)])
	var inventory_ok := true
	var inventory: Dictionary = audit.get("inventory", {})
	for item_id: String in inventory.keys():
		if _count(item_id) != int(inventory[item_id]):
			inventory_ok = false
			print("  inventory drift %s: %d vs %d" % [item_id, _count(item_id), int(inventory[item_id])])
	_expect(inventory_ok, "the gathered inventory survived the process change exactly (%d item kinds)" % inventory.size())
	var sites: Array = authority.call(&"site_summary")
	_expect(sites.size() >= 2, "both physical sites are mounted in the resumed world (%d)" % sites.size())
	for raw: Variant in sites:
		var site: Dictionary = raw
		_expect(bool(site.get("visible", false)),
			"site %s is a visible physical object in the resumed world" % String(site.get("poi_id", "")))
	var presenter: Node = hero.get_node_or_null("AvatarPresenter")
	if presenter != null and presenter.has_method(&"get_presentation_state"):
		var presentation: Dictionary = presenter.call(&"get_presentation_state")
		print("A0_AUTHORED_PRESENTATION_VERIFY ", JSON.stringify(presentation))
		_expect(String(presentation.get("gender", "")) in ["", "male"],
			"the same chosen Adventurer is presented after the relaunch (%s)" % String(presentation.get("gender", "")))
	var before := hero.global_position
	var moved := await _walk_input(hero, before + Vector2(0, 64), 240)
	_expect(moved and hero.global_position.distance_to(before) > 8.0,
		"the player can still walk authored terrain after the relaunch")
	var verify_path: Array[String] = ["survival", "authored_world"]
	_expect(save.call(&"get_value", verify_path, {}) is Dictionary,
		"the spawned world record is still in the one save")


# ---------------------------------------------------------------------------
# journeys
# ---------------------------------------------------------------------------
func _harvest_journey(hero: CharacterBody2D) -> Dictionary:
	var candidates: Array = (_ow.get(&"authored_sources") as Array).duplicate()
	if candidates.is_empty():
		return {}
	var resources := _ow.get_node_or_null("Resources")
	if resources == null:
		return {}
	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.get("distance_cells", 0)) < int(b.get("distance_cells", 0)))
	var tried := 0
	for raw: Variant in candidates:
		if tried >= 4:
			break
		tried += 1
		var entry: Dictionary = raw
		var node := resources.get_node_or_null("Authored_%s"
			% String(entry.get("node_id", "")).replace(":", "_").replace(",", "_")) as Node2D
		if node == null:
			continue
		var reached := await _walk_input(hero, node.global_position, 2400, 30.0)
		if not reached:
			_note("source %s at %s was not reached on foot in this run" % [String(entry.get("node_id", "")), str(node.global_position)])
			continue
		var item := _item_for_kind(String(entry.get("kind", "")))
		var before := _count(item)
		await _press_key(G)
		for _i: int in range(6):
			await process_frame
		var after := _count(item)
		if after > before:
			return {"node_id": String(entry.get("node_id", "")), "kind": String(entry.get("kind", "")),
				"item": item, "before": before, "after": after,
				"cell": entry.get("cell", []), "walked_to": [node.global_position.x, node.global_position.y]}
		_note("G at %s did not gather %s (before %d after %d)" % [String(entry.get("node_id", "")), item, before, after])
	return {}


func _site_journey(hero: CharacterBody2D, authority: Node, poi_id: String) -> Dictionary:
	var approach: Vector2 = authority.call(&"site_approach_world", poi_id)
	var door: Vector2 = authority.call(&"site_door_world", poi_id)
	var report := {"poi_id": poi_id, "approach": [approach.x, approach.y], "door": [door.x, door.y],
		"start": [hero.global_position.x, hero.global_position.y], "reached": false, "entered": false,
		"worked": false, "reward_refused": false, "retreated": false, "walk_px": 0.0}
	if approach.x < 0.0:
		report["error"] = "SITE_NOT_MOUNTED"
		return report
	var start_position := hero.global_position
	var reached := await _walk_input(hero, approach, 6000, 26.0)
	report["walk_px"] = hero.global_position.distance_to(start_position)
	report["reached"] = reached and hero.global_position.distance_to(door) <= 40.0
	report["at_door_px"] = hero.global_position.distance_to(door)
	if not bool(report["reached"]):
		report["error"] = "WALK_INCOMPLETE"
		report["stopped_at"] = [hero.global_position.x, hero.global_position.y]
		return report
	# Face into the doorway the way a player does, then press the interact key.
	await _face(hero, Vector2.UP)
	await _press_key(G)
	for _i: int in range(20):
		await process_frame
		if not String(authority.call(&"inside_site")).is_empty():
			break
	report["entered"] = String(authority.call(&"inside_site")) == poi_id
	report["interior_spawn"] = [hero.global_position.x, hero.global_position.y]
	if not bool(report["entered"]):
		report["error"] = "DOOR_REFUSED"
		return report

	# Inside: the worksite is a physical room. Walk to the work stand, face the
	# socket, press the key — A8 accepts the action and A0 must refuse to pay it.
	var site_node: Node = authority.get(&"interior_site")
	if site_node != null:
		var origin: Vector2 = (site_node as Node2D).global_position
		var stand: Vector2 = origin + (site_node.call(&"get_stand_position") as Vector2)
		var socket: Vector2 = origin + (site_node.call(&"get_action_socket") as Vector2)
		var state_before: Dictionary = site_node.call(&"get_site_state")
		var bag_before := _inventory_snapshot()
		var at_stand := await _walk_input(hero, stand, 900, 18.0)
		report["reached_stand"] = at_stand
		if at_stand:
			await _face(hero, (socket - stand).normalized())
			await _press_key(G)
			for _i: int in range(20):
				await process_frame
			report["worked"] = not bool(site_node.call(&"has_pending_intent"))
			var state_after: Dictionary = site_node.call(&"get_site_state")
			var bag_after := _inventory_snapshot()
			report["reward_refused"] = str(state_before) == str(state_after) and str(bag_before) == str(bag_after)
			if not bool(report["reward_refused"]):
				report["state_before"] = state_before
				report["state_after"] = state_after
				report["bag_before"] = bag_before
				report["bag_after"] = bag_after
		# Leave through the marked doorway: stand on the exit portal, face out, G.
		var exit_portal: Vector2 = origin + (site_node.call(&"get_exit_position") as Vector2)
		await _walk_input(hero, exit_portal, 900, 14.0)
		await _face(hero, Vector2.DOWN)
		await _press_key(G)
		for _i: int in range(20):
			await process_frame
			if String(authority.call(&"inside_site")).is_empty():
				break
	report["retreated"] = String(authority.call(&"inside_site")).is_empty()
	report["return_position"] = [hero.global_position.x, hero.global_position.y]
	report["return_at_door"] = hero.global_position.distance_to(door + Vector2(0, 18)) < 48.0
	return report


# ---------------------------------------------------------------------------
# real input
# ---------------------------------------------------------------------------
## Walks the body toward `target` by pressing the four directional actions, one
## physics frame at a time. Godot's move_and_slide turns a pressed direction into a
## slide along real collision, so a wall is met by physics, not by a rule. If the
## body stops making progress (a concave corner), it tries a perpendicular nudge for
## a few frames and then resumes — the same thing a player does.
func _walk_input(hero: CharacterBody2D, target: Vector2, max_frames: int, tolerance := 24.0) -> bool:
	var frames := 0
	var last := hero.global_position
	var stalled := 0
	var nudge := 0
	while frames < max_frames:
		frames += 1
		if hero.global_position.distance_to(target) <= tolerance:
			_release_moves()
			return true
		var to_target := target - hero.global_position
		var direction := to_target.normalized()
		if nudge != 0:
			direction = direction.rotated(deg_to_rad(80.0 * float(nudge)))
		_press_direction(direction)
		await physics_frame
		if frames % 15 == 0:
			if hero.global_position.distance_to(last) < 2.0:
				stalled += 1
				nudge = -nudge if nudge != 0 else 1
				if stalled >= 8:
					_release_moves()
					return false
			else:
				stalled = 0
				nudge = 0
			last = hero.global_position
	_release_moves()
	return hero.global_position.distance_to(target) <= tolerance


## Presses a direction for a moment so the controller's facing follows it, which is
## what A8's doorway and socket rules read. No position is written.
func _face(_hero: CharacterBody2D, direction: Vector2) -> void:
	_press_direction(direction)
	for _i: int in range(8):
		await physics_frame
	_release_moves()
	await physics_frame


func _press_direction(direction: Vector2) -> void:
	_action(&"move_left", direction.x < -0.35)
	_action(&"move_right", direction.x > 0.35)
	_action(&"move_up", direction.y < -0.35)
	_action(&"move_down", direction.y > 0.35)


func _action(action: StringName, pressed: bool) -> void:
	if not InputMap.has_action(action):
		return
	if pressed:
		if not Input.is_action_pressed(action):
			Input.action_press(action)
	elif Input.is_action_pressed(action):
		Input.action_release(action)


func _release_moves() -> void:
	for action: StringName in [&"move_left", &"move_right", &"move_up", &"move_down"]:
		if InputMap.has_action(action) and Input.is_action_pressed(action):
			Input.action_release(action)


## A real key press: the InputEventKey goes through the same InputMap the player's
## keyboard uses, so a missing binding is a failed interaction, not a silent pass.
func _press_key(keycode: Key) -> void:
	var down := InputEventKey.new()
	down.physical_keycode = keycode
	down.keycode = keycode
	down.pressed = true
	Input.parse_input_event(down)
	await process_frame
	await process_frame
	var up := InputEventKey.new()
	up.physical_keycode = keycode
	up.keycode = keycode
	up.pressed = false
	Input.parse_input_event(up)
	await process_frame
	await process_frame


# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------
func _count(item_id: String) -> int:
	if item_id.is_empty():
		return 0
	var survival := root.get_node_or_null("SurvivalService")
	return int(survival.call(&"inventory_count", item_id)) if survival != null else 0


func _item_for_kind(kind: String) -> String:
	var survival := root.get_node_or_null("SurvivalService")
	if survival == null:
		return ""
	var definition: Dictionary = survival.call(&"resource_definition", kind)
	return String(definition.get("item", ""))


func _inventory_snapshot() -> Dictionary:
	var out: Dictionary = {}
	var survival := root.get_node_or_null("SurvivalService")
	if survival == null:
		return out
	for item_id: String in ["oak_wood", "stone_chunk", "iron_scrap", "reed_fibre", "binding_cloth",
			"charcoal", "iron_ingot", "machine_parts"]:
		var held := _count(item_id)
		if held > 0:
			out[item_id] = held
	return out


## The first cell of a given surface within a bounded square. Bounded on purpose:
## a radius sweep that walks the whole continent would be a slow test, not a better
## one.
func _find_surface(origin: Vector2, surface: String, radius_cells: int) -> Vector2i:
	var authority: Node = _ow.get(&"world_authority")
	if authority == null:
		return Vector2i(-1, -1)
	var base := Vector2i(floori(origin.x / 16.0), floori(origin.y / 16.0))
	for dy: int in range(-radius_cells, radius_cells + 1):
		for dx: int in range(-radius_cells, radius_cells + 1):
			var cell := base + Vector2i(dx, dy)
			if String(authority.call(&"cell_surface", cell)) == surface:
				return cell
	return Vector2i(-1, -1)


func _find_blocked_neighbour(origin: Vector2, traversability: OverworldTraversability) -> Vector2i:
	var base := traversability.cell_of(origin)
	for dy: int in range(-7, 8):
		for dx: int in range(-7, 8):
			var cell := base + Vector2i(dx, dy)
			if traversability.in_bounds(cell) and not traversability.is_free(cell):
				return cell
	return Vector2i(-1, -1)


## Writes a spawn record that names a *different* run, re-runs the real resume path,
## and restores the true record. It never leaves the save in a state a later step
## could misread — and it fails closed if the authority resumed it anyway.
func _stale_spawn_probe(authority: Node) -> Dictionary:
	var save := root.get_node(&"SaveService")
	var path: Array[String] = ["survival", "authored_world"]
	var original: Variant = save.call(&"get_value", path, {})
	var forged := {"schema": "soh.a0.authored_world.v1", "world_id": "world:not_this_one",
		"spawn": {"schema": "soh.a0.authored_spawn.v1", "world_id": "world:not_this_one",
			"run_id": "run-foreign-probe", "run_epoch": 0, "seed": 1, "cell": [1, 1], "resumed": false}}
	save.call(&"patch_state_path", path, forged)
	var result: Dictionary = authority.call(&"ensure_spawn")
	var probe: Dictionary = result.get("spawn", {})
	print("A0_AUTHORED_STALE_SPAWN ", JSON.stringify({"result": result, "resumed": probe.get("resumed", false)}))
	save.call(&"patch_state_path", path, original if original is Dictionary else {})
	# Put the in-memory spawn back to the true record, so the run continues in the
	# world it started in.
	authority.call(&"ensure_spawn")
	var outcome := {"reason": "resumed" if bool(probe.get("resumed", false)) else String(result.get("reason", "refused")),
		"foreign_cell": probe.get("cell", []), "foreign_run": probe.get("run_id", "")}
	if not bool(probe.get("resumed", false)):
		outcome["reason"] = "refused"
	return outcome


func _read_audit() -> Dictionary:
	if not FileAccess.file_exists(AUDIT):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(AUDIT))
	return parsed as Dictionary if parsed is Dictionary else {}


func _vector(raw: Variant) -> Vector2:
	if raw is Array and (raw as Array).size() == 2:
		return Vector2(float((raw as Array)[0]), float((raw as Array)[1]))
	return Vector2.INF
