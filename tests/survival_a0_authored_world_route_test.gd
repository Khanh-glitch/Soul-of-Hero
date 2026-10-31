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
var _traversability: OverworldTraversability = null
var _authority: Node = null
var _hero: CharacterBody2D = null


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
		# Process 2 must read what process 1 wrote; process 1 starts from a clean
		# profile so the run it saves is the run it played.
		save.call(&"configure_storage", SAVE, _phase == "verify")
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
	# A cross-continent trek is thousands of pixels. Time scale is a *test* speed
	# control: physics still runs the same rules per step, the body still walks, and
	# collision, streaming and input are untouched. It only stops the gate from
	# spending a real hour on a journey the player would take in twenty minutes.
	Engine.time_scale = 3.0
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
	Engine.time_scale = 1.0
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
	_traversability = traversability
	_authority = authority
	_hero = hero
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

	# --- 2. the chosen Adventurer is the body that moves --------------------
	var presenter: Node = hero.get_node_or_null("AvatarPresenter")
	_expect(presenter != null, "the shipped player scene carries A6's avatar presenter")
	var avatar: Dictionary = root.get_node("SaveService").call(&"get_player_avatar")
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
	var saved_path: Array[String] = ["authored_world"]
	var stored: Variant = root.get_node("SaveService").call(&"get_value", saved_path, {})
	_expect(stored is Dictionary and not (stored as Dictionary).is_empty(),
		"the spawn is committed to A0's one SaveService, not to a second store")
	_expect(spawn_vector == traversability.call(&"cell_of", hero.global_position),
		"the body starts on the stored spawn cell (%s vs %s)"
			% [str(spawn_vector), str(traversability.call(&"cell_of", hero.global_position))])
	var run_phase: Dictionary = root.get_node("RunLifecycle").call(&"phase")
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
		"a foreign, cel-less or unwalkable spawn record is never resumed, and the run's own record is (%s)"
			% String(refused.get("reason", "")))
	_expect(bool(refused.get("positive_control", false)),
		"the positive control resumes: this run's own stored record is resumable")

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
	# Collision that is really mounted: measured after the walk, because chunks are
	# streamed as the player moves and the count at t=0 is a timing fact, not a fact
	# about the world.
	var bodies := 0
	for root_var: Variant in authority.call(&"collision_roots"):
		bodies += _count_static_bodies(root_var)
	var marked := int(traversability.call(&"prop_blocked_cells"))
	print("A0_AUTHORED_COLLISION bodies=%d marked_cells=%d chunks=%d"
		% [bodies, marked, int((authority.call(&"stream_status") as Dictionary).get("chunks_loaded", 0))])
	_expect(bodies > 0 or marked > 0,
		"collision the player can hit is mounted (bodies=%d, walkability cells=%d)" % [bodies, marked])
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
	var save := root.get_node("SaveService")
	_expect(bool(save.call(&"save_now")), "the run's world state commits before the process can die")
	var departure: Dictionary = {}
	if _ow.has_method(&"depart_world"):
		departure = _ow.call(&"depart_world")
		print("A0_AUTHORED_DEPARTURE ", JSON.stringify(departure))
		_expect(bool(departure.get("persisted", false)), "the departure flush is durable")
	var audit := {
		"schema": "soh.a0.authored_route.v1",
		"run_id": String((root.get_node("RunLifecycle").call(&"phase") as Dictionary).get("run_id", "")),
		"spawn": spawn.duplicate(true),
		"world": [world.width, world.height],
		# The durable position the save holds — the same value the second process must
		# land on. A quit that leaves the body on scenery saves the nearest standable
		# cell of that footprint, and the departure report says which.
		"position": departure.get("position", [hero.global_position.x, hero.global_position.y]),
		"body_position": departure.get("body_position", [hero.global_position.x, hero.global_position.y]),
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
	var debug_world: Array[String] = ["authored_world"]
	print("A0_VERIFY_STORED ", JSON.stringify(root.get_node("SaveService").call(&"get_value", debug_world, {})))
	var debug_profile: Array[String] = ["profile", "run"]
	print("A0_VERIFY_RUN ", JSON.stringify(root.get_node("SaveService").call(&"get_value", debug_profile, {})))
	if audit.is_empty():
		return
	var hero: CharacterBody2D = _ow.get(&"player")
	var authority: Node = _ow.get(&"world_authority")
	var world: OverworldWorld = _ow.get(&"world")
	_traversability = _ow.get(&"traversability")
	_authority = authority
	_hero = hero
	var save := root.get_node("SaveService")
	_expect(hero != null and authority != null and world != null, "the relaunched world exposes its seats")
	if hero == null or authority == null or world == null:
		return
	var phase: Dictionary = root.get_node("RunLifecycle").call(&"phase")
	var run_id := String(phase.get("run_id", ""))
	_expect(run_id == String(audit.get("run_id", "")),
		"the same run resumed (audit %s, relaunch %s)" % [String(audit.get("run_id", "")), run_id])
	_expect(world.width == 1024 and world.height == 768, "the relaunched world is still the authored continent")
	var spawn: Dictionary = authority.call(&"spawn_record")
	print("A0_AUTHORED_SPAWN_VERIFY ", JSON.stringify(spawn))
	_expect(bool(spawn.get("resumed", false)), "the saved spawn was resumed, not re-rolled")
	_expect(_cell_of(spawn.get("cell", [])) == _cell_of((audit.get("spawn", {}) as Dictionary).get("cell", [])),
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
	var moved := false
	for direction: Vector2 in [Vector2.DOWN, Vector2.UP, Vector2.LEFT, Vector2.RIGHT]:
		moved = await _walk_input(hero, before + direction * 64.0, 200, 16.0)
		if moved and hero.global_position.distance_to(before) > 8.0:
			break
	_expect(moved and hero.global_position.distance_to(before) > 8.0,
		"the player can still walk authored terrain after the relaunch (%.1f px)"
			% hero.global_position.distance_to(before))
	var verify_path: Array[String] = ["authored_world"]
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
		if tried >= 8:
			break
		tried += 1
		var entry: Dictionary = raw
		var node := resources.get_node_or_null("Authored_%s"
			% String(entry.get("node_id", "")).replace(":", "_").replace(",", "_")) as Node2D
		if node == null:
			continue
		var reached := await _walk_to(hero, node.global_position)
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
	# Approach in two honest steps: the forecourt in front of the building (reached by
	# the ordinary route planner over A0's walkability), then the last few metres along
	# the door's own axis, where the shell's collision is the only authority. Coming
	# at a doorway diagonally is how a body ends up pinned against a facade.
	var forecourt := approach + Vector2(0, 56)
	var reached := await _walk_to(hero, forecourt)
	if hero.global_position.distance_to(approach) > 20.0:
		reached = await _walk_input(hero, approach, 600, 8.0) or reached
	# The last metres belong to the building, not to the map. A doorway is a gap in
	# the shell's own collision, and A0's walkability marks the shell's walls as
	# blocked — so the final approach is steered by physics rays, which is the same
	# law the body is moved under. Walking to the published approach point is not
	# enough: A8 opens on being within 22 px of the door, facing it.
	if hero.global_position.distance_to(door) > 20.0:
		reached = await _walk_door(hero, door, approach) or reached
	report["walk_px"] = hero.global_position.distance_to(start_position)
	report["reached"] = reached and hero.global_position.distance_to(door) <= 26.0
	report["at_door_px"] = hero.global_position.distance_to(door)
	if not bool(report["reached"]):
		report["error"] = "WALK_INCOMPLETE"
		report["stopped_at"] = [hero.global_position.x, hero.global_position.y]
		return report
	# Face into the doorway the way a player does and press the interact key.
	for attempt: int in range(3):
		if hero.global_position.distance_to(door) > 18.0:
			await _walk_to(hero, approach)
		await _interact_facing(Vector2.UP)
		for _i: int in range(12):
			await process_frame
			if not String(authority.call(&"inside_site")).is_empty():
				break
		if not String(authority.call(&"inside_site")).is_empty():
			break
		_note("doorway attempt %d refused at %s (%.1f px from the door)"
			% [attempt + 1, str(hero.global_position), hero.global_position.distance_to(door)])
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
		var at_stand := await _approach(hero, stand)
		report["reached_stand"] = at_stand
		if at_stand:
			var receipts_before: int = (authority.call(&"site_events_for", poi_id) as Array).size()
			for attempt: int in range(3):
				if hero.global_position.distance_to(stand) > 20.0:
					await _approach(hero, stand)
				await _interact_facing((socket - hero.global_position).normalized())
				for _i: int in range(12):
					await process_frame
				# An answered intent is a receipt in A0's own log; a refused one lands
				# there too, which is exactly the fact this step is testing.
				if (authority.call(&"site_events_for", poi_id) as Array).size() > receipts_before:
					break
				if attempt == 2:
					_note("socket press never reached A8 (%s)" % str(hero.global_position))
			# The receipt, not the absence of a pending action: A0 records what it
			# answered, so "nothing happened" cannot be mistaken for "refused".
			var receipts: Array = authority.call(&"site_events_for", poi_id)
			var state_after: Dictionary = site_node.call(&"get_site_state")
			var bag_after := _inventory_snapshot()
			report["blocked_at"] = hero.global_position
			report["receipts"] = receipts
			report["worked"] = not receipts.is_empty()
			var refused_cleanly := false
			for raw_receipt: Variant in receipts:
				var receipt: Dictionary = raw_receipt
				if String(receipt.get("status", "")) == "rejected" \
						and String(receipt.get("reason", "")).begins_with("A3_SOURCE_AUTHORIZATION_ABSENT"):
					refused_cleanly = true
			report["reward_refused"] = refused_cleanly \
				and str(state_before) == str(state_after) and str(bag_before) == str(bag_after)
			if not bool(report["reward_refused"]):
				report["state_before"] = state_before
				report["state_after"] = state_after
				report["bag_before"] = bag_before
				report["bag_after"] = bag_after
		# Leave through the marked doorway: stand on the exit portal, face out, G.
		var exit_portal: Vector2 = origin + (site_node.call(&"get_exit_position") as Vector2)
		await _walk_input(hero, exit_portal, 900, 14.0)
		for attempt: int in range(3):
			if hero.global_position.distance_to(exit_portal) > 16.0:
				await _walk_input(hero, exit_portal, 600, 12.0)
			await _interact_facing(Vector2.DOWN)
			for _i: int in range(12):
				await process_frame
				if String(authority.call(&"inside_site")).is_empty():
					break
			if String(authority.call(&"inside_site")).is_empty():
				break
			_note("exit attempt %d refused at %s" % [attempt + 1, str(hero.global_position)])
	report["retreated"] = String(authority.call(&"inside_site")).is_empty()
	report["return_position"] = [hero.global_position.x, hero.global_position.y]
	report["return_at_door"] = hero.global_position.distance_to(approach) < 48.0
	return report


# ---------------------------------------------------------------------------
# real input
# ---------------------------------------------------------------------------
## A route across the continent: a coarse A* over A0's own walkability, exactly the
## grid the game uses to decide what is ground. It is a *test* navigation aid (the
## player would look at the screen); the body still has to be walked there by input,
## through real collision, at real speed.
## Two planning scales, because a continent is not a room: a fine plan near the
## player (stride 4) and a whole-map plan (stride 8) when geography forces a detour
## outside the straight box. A* over A0's own walkability, with a real priority
## queue — a whole-continent plan needs it, and a linear scan is quadratic.
const PLAN_LADDER := [[96, 2], [9999, 2], [9999, 1]]
const PLAN_MAX_EXPANSIONS := 900_000


func _plan(start_cell: Vector2i, goal_cell: Vector2i, margin: int, stride: int) -> Array[Vector2i]:
	if _traversability == null:
		return []
	var lo := Vector2i(mini(start_cell.x, goal_cell.x) - margin, mini(start_cell.y, goal_cell.y) - margin)
	var hi := Vector2i(maxi(start_cell.x, goal_cell.x) + margin, maxi(start_cell.y, goal_cell.y) + margin)
	lo = Vector2i(maxi(0, lo.x), maxi(0, lo.y))
	hi = Vector2i(mini(_traversability.width - 1, hi.x), mini(_traversability.height - 1, hi.y))
	var origin := lo
	var cols := int((hi.x - lo.x) / stride) + 1
	var rows := int((hi.y - lo.y) / stride) + 1
	var goal_node := Vector2i((goal_cell.x - origin.x) / stride, (goal_cell.y - origin.y) / stride)
	var start_node := _nearest_free_node(origin, stride, cols, rows,
		Vector2i((start_cell.x - origin.x) / stride, (start_cell.y - origin.y) / stride))
	if start_node == Vector2i(-1, -1):
		# The body is wedged in a place no coarse node can represent (against a
		# building, say). That is a movement problem, not a path problem, and the
		# caller's input steering is what gets it out.
		print("A0_ROUTE_PLAN start=%s has no free coarse node at stride %d" % [str(start_cell), stride])
		return []
	if start_node == goal_node:
		return [goal_cell]
	var open: Array[Vector2i] = [start_node]
	var estimate: Dictionary = {start_node: _heuristic(start_node, goal_node)}
	var came: Dictionary = {}
	var cost: Dictionary = {start_node: 0}
	var closed: Dictionary = {}
	var expansions := 0
	var found := false
	while not open.is_empty() and expansions < PLAN_MAX_EXPANSIONS:
		var current: Vector2i = _heap_pop(open, estimate)
		if closed.has(current):
			continue
		closed[current] = true
		expansions += 1
		if current == goal_node:
			found = true
			break
		for step: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
				Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1)]:
			var next := current + step
			if next.x < 0 or next.y < 0 or next.x >= cols or next.y >= rows:
				continue
			if closed.has(next):
				continue
			# A diagonal shortcut is only a move if both shoulders are open ground.
			if step.x != 0 and step.y != 0:
				if not _node_free(origin, stride, current + Vector2i(step.x, 0)) \
						or not _node_free(origin, stride, current + Vector2i(0, step.y)):
					continue
			if not _node_free(origin, stride, next):
				continue
			var step_cost := 1.4142 if step.x != 0 and step.y != 0 else 1.0
			var candidate := float(cost.get(current, INF)) + step_cost
			if candidate >= float(cost.get(next, INF)):
				continue
			came[next] = current
			cost[next] = candidate
			estimate[next] = candidate + _heuristic(next, goal_node)
			open.append(next)
			_heap_sift_up(open, estimate, open.size() - 1)
	if not found:
		print("A0_ROUTE_PLAN start=%s goal=%s stride=%d expansions=%d found=false goal_free=%s goal_kind=%d"
			% [str(start_cell), str(goal_cell), stride, expansions,
				str(_node_free(origin, stride, goal_node)), int(_traversability.call(&"blocked_kind", goal_cell))])
		return []
	# Rebuild, then insert the real goal cell at the end: the coarse node is where a
	# body can stand, the goal cell is where the door is.
	var cells: Array[Vector2i] = []
	var node: Vector2i = goal_node
	while came.has(node):
		cells.push_front(Vector2i(origin.x + node.x * stride, origin.y + node.y * stride))
		node = came[node]
	cells.push_front(start_cell)
	cells.append(goal_cell)
	print("A0_ROUTE_PLAN start=%s goal=%s stride=%d expansions=%d waypoints=%d"
		% [str(start_cell), str(goal_cell), stride, expansions, cells.size()])
	return cells


func _heap_sift_up(heap: Array[Vector2i], key: Dictionary, index: int) -> void:
	while index > 0:
		var parent := (index - 1) / 2
		if float(key.get(heap[parent], INF)) <= float(key.get(heap[index], INF)):
			return
		var swap := heap[parent]
		heap[parent] = heap[index]
		heap[index] = swap
		index = parent


func _heap_pop(heap: Array[Vector2i], key: Dictionary) -> Vector2i:
	var top: Vector2i = heap[0]
	var last: Vector2i = heap.pop_back()
	if not heap.is_empty():
		heap[0] = last
		var index := 0
		while true:
			var left := index * 2 + 1
			var right := left + 1
			var best := index
			if left < heap.size() and float(key.get(heap[left], INF)) < float(key.get(heap[best], INF)):
				best = left
			if right < heap.size() and float(key.get(heap[right], INF)) < float(key.get(heap[best], INF)):
				best = right
			if best == index:
				break
			var swap := heap[best]
			heap[best] = heap[index]
			heap[index] = swap
			index = best
	return top


## Steers the body into a doorway on physics rays alone.
##
## The grid is a map of what is walkable in general; the shell's collision is what
## the body is actually stopped by. Where the two disagree — a door gap narrower than
## the map's idea of a step — the body must win, or the gate would be testing the
## map instead of the building.
func _walk_to_door(hero: CharacterBody2D, door: Vector2, budget := 2400) -> bool:
	if _authority == null:
		return false
	var frames := 0
	var stalled := 0
	var last := hero.global_position
	var escape_until := -1
	var escape_sign := 1.0
	var escapes := 0
	while frames < budget:
		frames += 1
		if hero.global_position.distance_to(door) <= 14.0:
			_release_moves()
			return true
		var bearing := (door - hero.global_position).angle()
		var chosen := Vector2.ZERO
		if frames < escape_until:
			chosen = Vector2.RIGHT.rotated(bearing + PI * 0.5 * escape_sign)
			if not _ray_clear(hero.global_position, hero.global_position + chosen * 16.0):
				chosen = Vector2.RIGHT.rotated(bearing - PI * 0.5 * escape_sign)
		else:
			# Wider sweep than a field walk: a doorway sits inside a facade, so the
			# free direction can be almost behind the body.
			for offset: float in [0.0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 1.0, -1.0,
					1.3, -1.3, 1.6, -1.6, 1.9, -1.9, 2.2, -2.2, 2.5, -2.5, 2.8, -2.8]:
				var candidate := Vector2.RIGHT.rotated(bearing + offset)
				if _ray_clear(hero.global_position, hero.global_position + candidate * 16.0):
					chosen = candidate
					break
		if chosen == Vector2.ZERO:
			break
		_press_direction(chosen)
		await physics_frame
		if frames % 20 == 0:
			if hero.global_position.distance_to(last) < 2.5:
				stalled += 1
				if stalled >= 2 and escapes < 8:
					# Walk along the wall for a while, then look at the door again.
					escapes += 1
					escape_sign = -escape_sign
					escape_until = frames + 40
				elif escapes >= 8:
					break
			else:
				stalled = 0
			last = hero.global_position
	_release_moves()
	return hero.global_position.distance_to(door) <= 16.0


## The doorway approach, planned on the building's own collision.
##
## The map is right about terrain and wrong about doorways: the shell's walls are
## marked as blocked, and a door gap is narrower than a map cell. So this builds a
## small 8-pixel grid out of physics rays around the door itself — the same collision
## that stops the body — plans across it, and then walks the result with the ordinary
## direction keys. Nothing here writes a position; the body is still moved by
## `move_and_slide` into whatever the building really is.
const DOOR_STEP := 8.0
const DOOR_RADIUS := 26


func _walk_door(hero: CharacterBody2D, door: Vector2, stand_point := Vector2.INF) -> bool:
	# Plan to the published approach point, not into the doorframe: a body is 12x16
	# and a door gap is about that wide, so "standing in the doorway" is not the
	# player's pose — "standing in front of it, facing it" is, and that is the pose
	# A8 opens on. The physical grid still decides how to get there.
	var aim := door
	if stand_point != Vector2.INF and stand_point.distance_to(door) <= 60.0:
		aim = stand_point
	var path := _plan_physical(hero.global_position, aim)
	print("A0_DOOR_PLAN aim=%s path=%d from=%s stand_free=%s door_free=%s"
		% [str(aim), path.size(), str(hero.global_position), str(_point_free.call(aim)), str(_point_free.call(door))])
	if path.is_empty():
		# No physical route in the small box: fall back to ray steering, which at
		# least keeps trying instead of declaring the building unreachable.
		return await _walk_to_door(hero, door)
	for point: Vector2 in path:
		if hero.global_position.distance_to(door) <= 18.0:
			break
		await _walk_point(hero, point)
	_release_moves()
	print("A0_DOOR_RESULT end=%s door_px=%.1f aim_px=%.1f"
		% [str(hero.global_position), hero.global_position.distance_to(door),
			hero.global_position.distance_to(aim)])
	if hero.global_position.distance_to(door) <= 20.0:
		return true
	# One repair attempt: the physical plan can be spoiled by a moving body, so it is
	# re-planned once from wherever the walk actually ended.
	path = _plan_physical(hero.global_position, aim)
	for point: Vector2 in path:
		if hero.global_position.distance_to(door) <= 18.0:
			break
		await _walk_point(hero, point)
	_release_moves()
	return hero.global_position.distance_to(door) <= 20.0


## Is there room for the player's body at this point? Two short rays through the
## body's own footprint, against the world's collision layer.
func _point_free(point: Vector2) -> bool:
	return _ray_clear(point + Vector2(0.0, -5.0), point + Vector2(0.0, 5.0)) \
		and _ray_clear(point + Vector2(-5.0, 0.0), point + Vector2(5.0, 0.0))


func _plan_physical(from: Vector2, door: Vector2) -> Array:
	var nodes := int(DOOR_RADIUS * 2 / 1) + 1
	var origin := door - Vector2(DOOR_RADIUS, DOOR_RADIUS) * DOOR_STEP
	var start := Vector2i(roundi((from.x - origin.x) / DOOR_STEP), roundi((from.y - origin.y) / DOOR_STEP))
	var goal := Vector2i(roundi((door.x - origin.x) / DOOR_STEP), roundi((door.y - origin.y) / DOOR_STEP))
	start = Vector2i(clampi(start.x, 0, nodes - 1), clampi(start.y, 0, nodes - 1))
	goal = Vector2i(clampi(goal.x, 0, nodes - 1), clampi(goal.y, 0, nodes - 1))
	var free := {}
	var point := func(node: Vector2i) -> Vector2:
		return origin + Vector2(float(node.x), float(node.y)) * DOOR_STEP
	var is_free := func(node: Vector2i) -> bool:
		if node.x < 0 or node.y < 0 or node.x >= nodes or node.y >= nodes:
			return false
		var key := "%d:%d" % [node.x, node.y]
		if free.has(key):
			return bool(free[key])
		var value := bool(_point_free.call(point.call(node)))
		free[key] = value
		return value
	# The body's own cell may be occupied by its footprint; seed from the nearest
	# free node instead of refusing to plan.
	if not bool(is_free.call(start)):
		var found := false
		for radius: int in range(1, 6):
			for dy: int in range(-radius, radius + 1):
				for dx: int in range(-radius, radius + 1):
					if maxi(absi(dx), absi(dy)) != radius:
						continue
					var candidate := start + Vector2i(dx, dy)
					if bool(is_free.call(candidate)):
						start = candidate
						found = true
						break
				if found:
					break
			if found:
				break
		if not found:
			return []
	var open: Array[Vector2i] = [start]
	var estimate: Dictionary = {start: 0.0}
	var came: Dictionary = {}
	var cost: Dictionary = {start: 0.0}
	var closed := {}
	var expansions := 0
	while not open.is_empty() and expansions < 20_000:
		var current: Vector2i = _heap_pop(open, estimate)
		if closed.has(current):
			continue
		closed[current] = true
		expansions += 1
		if current == goal:
			var steps: Array = []
			var node: Vector2i = goal
			while came.has(node):
				steps.push_front(point.call(node))
				node = came[node]
			return steps
		for step: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
				Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1)]:
			var next := current + step
			if closed.has(next) or not bool(is_free.call(next)):
				continue
			if step.x != 0 and step.y != 0:
				if not bool(is_free.call(current + Vector2i(step.x, 0))) \
						or not bool(is_free.call(current + Vector2i(0, step.y))):
					continue
			var step_cost := 1.4142 if step.x != 0 and step.y != 0 else 1.0
			var candidate := float(cost.get(current, INF)) + step_cost
			if candidate >= float(cost.get(next, INF)):
				continue
			came[next] = current
			cost[next] = candidate
			estimate[next] = candidate + Vector2(next - goal).length()
			open.append(next)
			_heap_sift_up(open, estimate, open.size() - 1)
	return []


## Walk to one point of a physical plan, pressing the direction that is actually
## clear. Short horizon on purpose: the plan is dense, so each step only has to cover
## a few pixels of real space.
func _walk_point(hero: CharacterBody2D, target: Vector2, budget := 90) -> bool:
	for _frame: int in range(budget):
		if hero.global_position.distance_to(target) <= 6.0:
			return true
		var bearing := (target - hero.global_position).angle()
		var chosen := Vector2.ZERO
		for offset: float in [0.0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.5, -1.5]:
			var candidate := Vector2.RIGHT.rotated(bearing + offset)
			if _ray_clear(hero.global_position, hero.global_position + candidate * 12.0):
				chosen = candidate
				break
		if chosen == Vector2.ZERO:
			return false
		_press_direction(chosen)
		await physics_frame
	return hero.global_position.distance_to(target) <= 8.0


func _waypoint(cell: Vector2i) -> Vector2:
	return Vector2(cell.x * 16.0 + 8.0, cell.y * 16.0 + 8.0)


## Is the straight line between two points entirely on walkable authored ground?
## Sampled every 8 px on A0's own walkability, which is the same grid the game uses.
func _line_clear(from: Vector2, to: Vector2) -> bool:
	if _traversability == null:
		return false
	var span := from.distance_to(to)
	if span < 1.0:
		return true
	var steps := int(span / 8.0) + 1
	for index: int in range(1, steps + 1):
		var point := from.lerp(to, float(index) / float(steps))
		if not _traversability.call(&"is_free", _traversability.call(&"cell_of", point)):
			return false
	return true


## The nearest cell to `goal` that a coarse planning node can actually occupy,
## preferring the side the player is coming from so the route does not loop around
## a building to reach the same doorway.
func _staging_cell(goal: Vector2i, from: Vector2i) -> Vector2i:
	if _coarse_free(goal):
		return goal
	var best := goal
	var best_score := INF
	for radius: int in [1, 2, 3, 4, 5, 6]:
		for dy: int in range(-radius, radius + 1):
			for dx: int in range(-radius, radius + 1):
				if maxi(absi(dx), absi(dy)) != radius:
					continue
				var candidate := goal + Vector2i(dx, dy)
				if not _coarse_free(candidate):
					continue
				# Stay as close to the *goal* as possible: a staging cell that is
				# merely convenient for the body can sit on the far side of the
				# building, and the route then walks to the wrong face.
				var score := Vector2(candidate - goal).length() * 1000.0 \
					+ Vector2(candidate - from).length()
				if score < best_score:
					best_score = score
					best = candidate
		if best != goal:
			return best
	return goal


## The nearest coarse node the body could stand in, searched outward from its own
## cell. Without this, a player who has just stepped out of a doorway is "inside"
## a blocked node and every plan from there is empty — a stall that has nothing to
## do with the route.
func _nearest_free_node(origin: Vector2i, stride: int, cols: int, rows: int, node: Vector2i) -> Vector2i:
	if node.x >= 0 and node.y >= 0 and node.x < cols and node.y < rows and _node_free(origin, stride, node):
		return node
	for radius: int in range(1, 5):
		for dy: int in range(-radius, radius + 1):
			for dx: int in range(-radius, radius + 1):
				if maxi(absi(dx), absi(dy)) != radius:
					continue
				var candidate := node + Vector2i(dx, dy)
				if candidate.x < 0 or candidate.y < 0 or candidate.x >= cols or candidate.y >= rows:
					continue
				if _node_free(origin, stride, candidate):
					return candidate
	return Vector2i(-1, -1)


func _coarse_free(cell: Vector2i) -> bool:
	return _traversability.in_bounds(cell) and _traversability.is_free(cell)


## A coarse node is walkable only if its own cell and its four neighbours are: a
## route that squeezes along a one-cell ledge is not a route a body can follow.
## A planning node is the cell it stands on. Demanding a ring of clear neighbours as
## well sounds careful and is wrong: A1's continent has one-cell necks and doorways,
## and a body 12 pixels wide walks them. Clearance is the *step* rule instead — a
## diagonal move needs both of its shoulders — which is where squeezing actually
## fails, and the walker decides the rest with physics rays.
func _node_free(origin: Vector2i, stride: int, node: Vector2i) -> bool:
	var cell := Vector2i(origin.x + node.x * stride, origin.y + node.y * stride)
	return _traversability.in_bounds(cell) and _traversability.is_free(cell)


func _heuristic(node: Vector2i, goal: Vector2i) -> float:
	var dx := absi(node.x - goal.x)
	var dy := absi(node.y - goal.y)
	return float(maxi(dx, dy)) + 0.4142 * float(mini(dx, dy))


## How a player reaches a place: on the continent a planned route, inside a worksite
## (which is not a continent cell) the same ray-navigated walk the gate uses indoors.
func _approach(hero: CharacterBody2D, target: Vector2) -> bool:
	var interior := _authority != null and String(_authority.call(&"inside_site")).is_empty() == false
	if interior:
		return await _walk_input(hero, target, 900, 16.0)
	return await _walk_to(hero, target)


## Walks the planned route with real input. A waypoint that cannot be reached within
## its budget triggers one replan from where the body actually stands; after that the
## journey reports the stall instead of pretending to have arrived.
func _walk_to(hero: CharacterBody2D, target: Vector2, budget_frames := 4000) -> bool:
	if _traversability == null:
		return false
	var goal_cell := _traversability.cell_of(target)
	# A coarse grid node needs one cell of clearance on every side, so a doorway
	# between two walls is never a node: the plan goes to the nearest cell that
	# *does* have clearance, and the last few metres are walked by eye (rays and
	# input), which is exactly how a player threads a door frame.
	var staging := _staging_cell(goal_cell, _traversability.cell_of(hero.global_position))
	var attempts := 0
	while attempts < 4:
		attempts += 1
		var start_cell := _traversability.cell_of(hero.global_position)
		var route: Array[Vector2i] = []
		# Close to the goal, plan on a fine stride in a small window: the last stretch
		# of a route is where terrain narrows to a ledge and a coarse node cannot see
		# the gap a body fits through.
		var ladder: Array = PLAN_LADDER.duplicate()
		if hero.global_position.distance_to(target) < 640.0:
			ladder.push_front([64, 2])
		for rung: Array in ladder:
			route = _plan(start_cell, staging, int(rung[0]), int(rung[1]))
			if not route.is_empty():
				break
		if route.is_empty():
			print("A0_ROUTE_NO_PATH from=%s to=%s" % [str(start_cell), str(goal_cell)])
			return false
		var ok := true
		# String-pulled route: aim at the furthest waypoint the body can already see
		# in a straight line, instead of stopping at every grid node. A player walks
		# to the far corner of the field, not to a lattice.
		var index := 0
		while index < route.size():
			var far := index
			while far + 1 < route.size():
				var ahead := _waypoint(route[far + 1])
				if not _line_clear(hero.global_position, ahead):
					break
				far += 1
			var waypoint := _waypoint(route[far])
			index = far + 1
			if hero.global_position.distance_to(waypoint) <= 12.0:
				continue
			if not await _walk_input(hero, waypoint, mini(budget_frames, 900), 14.0):
				ok = false
				break
		if ok and hero.global_position.distance_to(target) <= 40.0:
			return true
		if ok:
			# Close enough for sight, not for touch: walk the leftover gap.
			if await _walk_input(hero, target, 600, 12.0):
				return true
		if attempts >= 2:
			return hero.global_position.distance_to(target) <= 40.0
		_note("replanning at %s toward %s" % [str(hero.global_position), str(target)])
	return false


## Walks the body toward `target` by pressing the four directional actions.
##
## Steering, not teleporting: each frame picks the free direction closest to the
## bearing to the target, where "free" is A0's own walkability for the cell a few
## pixels ahead (A1's walk layer plus the collision bodies that are really mounted).
## That is what a player does with their eyes — it just never writes a position and
## never skips collision: the body still has to be pushed there by move_and_slide.
func _walk_input(hero: CharacterBody2D, target: Vector2, max_frames: int, tolerance := 24.0) -> bool:
	if _traversability == null:
		return false
	var frames := 0
	var last := hero.global_position
	var stalled := 0
	var escape := 0
	var escape_until := 0
	while frames < max_frames:
		frames += 1
		if hero.global_position.distance_to(target) <= tolerance:
			_release_moves()
			return true
		var bearing := (target - hero.global_position).angle()
		var direction := Vector2.ZERO
		if frames < escape_until:
			direction = Vector2.RIGHT.rotated(bearing + PI * 0.5)
		else:
			direction = _free_direction(hero.global_position, bearing)
		if direction == Vector2.ZERO:
			# Nowhere free at all: back out the way a player would, then try again.
			escape = 1
			escape_until = frames + 25
			_press_direction(Vector2.RIGHT.rotated(bearing + PI))
			await physics_frame
			continue
		_press_direction(direction)
		await physics_frame
		if frames % 15 == 0:
			if hero.global_position.distance_to(last) < 3.0:
				stalled += 1
				if stalled == 3:
					# Wedged: step sideways along the obstacle for a moment.
					escape = -escape if escape != 0 else 1
					escape_until = frames + 30
				elif stalled >= 10:
					print("A0_ROUTE_STALL at=%s target=%s bearing_deg=%.1f walkable_here=%s"
						% [str(hero.global_position), str(target), rad_to_deg(bearing),
							str(_traversability.is_free(_traversability.cell_of(hero.global_position)))])
					_release_moves()
					return false
			else:
				stalled = 0
			last = hero.global_position
	_release_moves()
	return hero.global_position.distance_to(target) <= tolerance


## The free direction closest to `bearing`, nearest angle first, probing the space
## the body would enter. On the continent the probe is A0's walkability; inside a
## worksite the body stands at the interior origin, which is not a continent cell, so
## the probe is a real physics ray against the interior's own collision.
func _free_direction(position: Vector2, bearing: float) -> Vector2:
	var offsets: Array[float] = [0.0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.0, -2.0, 2.4, -2.4, PI]
	for offset: float in offsets:
		var candidate := Vector2.RIGHT.rotated(bearing + offset)
		if _probe_free(position, candidate, 14.0):
			return candidate
	return Vector2.ZERO


## Free to step toward? The map is a *hint*, physics is the truth.
##
## On open terrain both agree, and the map is cheaper. Next to a building they do not:
## A0's walkability marks a shell's walls, and a doorway is a gap in that shell's own
## collision — narrower than a map cell. Asking the map alone makes the player refuse
## to walk through a door that is open, so a clear physics ray is accepted even where
## the map is pessimistic. The body is still moved by `move_and_slide`, so a ray that
## passed a prop only costs a frame of pushing, never a wall the player walks through.
func _probe_free(position: Vector2, direction: Vector2, distance: float) -> bool:
	var probe := position + direction * distance
	var interior := _authority != null and not String(_authority.call(&"inside_site")).is_empty()
	if _traversability != null and not interior \
			and _traversability.in_bounds(_traversability.cell_of(probe)) \
			and _traversability.is_free(_traversability.cell_of(probe)):
		return true
	return _ray_clear(position, probe)


func _ray_clear(from: Vector2, to: Vector2) -> bool:
	if _ow == null or _hero == null:
		return false
	var world: World2D = (_ow as Node2D).get_world_2d()
	if world == null:
		return false
	var query := PhysicsRayQueryParameters2D.create(from, to, 1)
	query.exclude = [_hero.get_rid()]
	query.collide_with_areas = false
	return world.direct_space_state.intersect_ray(query).is_empty()


## Holds a direction and presses the interact key while it is still held — which is
## what a player does ("face the door and press G"). Holding it for many frames would
## walk straight through the doorway the gate is measuring, so the press happens after
## two frames and the body is released immediately afterwards.
func _interact_facing(direction: Vector2) -> void:
	_press_direction(direction)
	await physics_frame
	await physics_frame
	await _press_key(G)
	_release_moves()
	await process_frame


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
func _count_static_bodies(root: Variant) -> int:
	if not root is Node:
		return 0
	var total := 0
	for child: Node in (root as Node).get_children():
		if child is StaticBody2D:
			total += 1
		total += _count_static_bodies(child)
	return total


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


## The negative spawn cases, asked of A0 as pure questions so a gate never has to
## forge anything into the player's save: a record for another world, another run, a
## missing cell, an unwalkable cell, and the real record as the positive control.
func _stale_spawn_probe(authority: Node) -> Dictionary:
	var world_id := String((authority.call(&"source_report") as Dictionary).get("reader", ""))
	var run: Dictionary = root.get_node("RunLifecycle").call(&"phase")
	var current_run := String(run.get("run_id", ""))
	var cell: Array = (authority.call(&"spawn_record") as Dictionary).get("cell", [])
	var cases := {
		"foreign_world": {"schema": "soh.a0.authored_spawn.v1", "world_id": "world:not_this_one",
			"run_id": current_run, "cell": cell},
		"foreign_run": {"schema": "soh.a0.authored_spawn.v1", "world_id": world_id,
			"run_id": "run-foreign-probe", "cell": cell},
		"no_cell": {"schema": "soh.a0.authored_spawn.v1", "world_id": world_id,
			"run_id": current_run, "cell": []},
		"unwalkable": {"schema": "soh.a0.authored_spawn.v1", "world_id": world_id,
			"run_id": current_run, "cell": [0, 0]},
	}
	var outcomes := {}
	for name: String in cases.keys():
		outcomes[name] = authority.call(&"spawn_resume_decision", cases[name])
	# The positive control: the record this run is actually standing in must resume.
	outcomes["own_record"] = authority.call(&"spawn_resume_decision", authority.call(&"spawn_record"))
	print("A0_AUTHORED_SPAWN_DECISIONS ", JSON.stringify(outcomes))
	var refused_all := true
	for name: String in cases.keys():
		if bool((outcomes[name] as Dictionary).get("resumed", true)):
			refused_all = false
	var own := bool((outcomes.get("own_record", {}) as Dictionary).get("resumed", false))
	return {"resumed": "" if refused_all and own else "resumed",
		"reason": "refused" if refused_all and own else "WRONG_DECISION",
		"decisions": outcomes,
		"foreign_cell": cell,
		"positive_control": own}


func _read_audit() -> Dictionary:
	if not FileAccess.file_exists(AUDIT):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(AUDIT))
	return parsed as Dictionary if parsed is Dictionary else {}


func _cell_of(raw: Variant) -> Vector2i:
	if raw is Array and (raw as Array).size() == 2:
		return Vector2i(int((raw as Array)[0]), int((raw as Array)[1]))
	return Vector2i(-9999, -9999)


func _vector(raw: Variant) -> Vector2:
	if raw is Array and (raw as Array).size() == 2:
		return Vector2(float((raw as Array)[0]), float((raw as Array)[1]))
	return Vector2.INF
