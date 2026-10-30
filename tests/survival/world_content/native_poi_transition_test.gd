extends SceneTree

# Test-only setup teleports are direct global_position assignments below; they
# model an owner-restored spawn or position an actor for an isolated collision
# check. They are not traversal evidence. Traversal assertions follow
# request_test_motion + physics_frame, including doorway and water-route checks.

const VECTOR_UTIL := preload("res://game/survival/world_content/scripts/native_poi_vectors.gd")

const FIXTURE_SCRIPT := preload(
	"res://game/survival/world_content/scripts/poi_authority_fixture.gd"
)
const ACTOR_SCRIPT := preload("res://tests/survival/world_content/test_actor.gd")
const SITE_SCENES := [
	"res://game/survival/world_content/scenes/south_quarry.tscn",
	"res://game/survival/world_content/scenes/south_orchard_ruin.tscn",
	"res://game/survival/world_content/scenes/south_crown_mill.tscn",
]
const SHELL_SCENES := [
	"res://game/survival/world_content/scenes/south_quarry_overworld.tscn",
	"res://game/survival/world_content/scenes/south_orchard_ruin_overworld.tscn",
	"res://game/survival/world_content/scenes/south_crown_mill_overworld.tscn",
]
const TRANSFORM_CELLS := [Vector2i(30, 280), Vector2i(140, 360), Vector2i(120, 300)]
const TRANSFORM_ROOTS := [Vector2(424, 4424), Vector2(2184, 5704), Vector2(1864, 4744)]
const ENTRANCE_X := [480.0, 480.0, 526.0]

var _failures: Array[String] = []
var _assertions := 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	await _physical_exterior_entry_exit_all_sites()
	await _physical_quarry_route_choices()
	await _physical_water_routes_and_weather_non_stranding()
	if _failures.is_empty():
		print("A8_NATIVE_POI_TRANSITION_PASS assertions=%d" % _assertions)
		quit(0)
	else:
		for failure: String in _failures:
			push_error(failure)
		print(
			(
				"A8_NATIVE_POI_TRANSITION_FAIL failures=%d assertions=%d"
				% [_failures.size(), _assertions]
			)
		)
		quit(1)


func _physical_exterior_entry_exit_all_sites() -> void:
	for index: int in range(SHELL_SCENES.size()):
		var shell_scene: PackedScene = load(SHELL_SCENES[index]) as PackedScene
		_check(shell_scene != null, "compact overworld shell loads: %s" % SHELL_SCENES[index])
		if shell_scene == null:
			continue
		var shell := shell_scene.instantiate() as NativePoiShell
		root.add_child(shell)
		await process_frame
		var shell_data: Dictionary = shell.definition.get("overworld_shell", {})
		_assert_shell_art(shell)
		_check(
			shell_data.get("bounds_px", []) == [128, 128],
			"shell bounds stay inside four-tile footprint"
		)
		_check(
			shell_data.get("action_socket", []) == [64, 64],
			"A1 action socket remains shell-centered"
		)
		_check(
			shell.get_canonical_cell() == TRANSFORM_CELLS[index],
			"shell keeps the canonical A1 cell"
		)
		var shell_socket := shell.get_action_socket()
		_check(
			shell_socket == Vector2(64, 64), "shell exposes the authored A1 action socket marker"
		)
		_check(
			shell.get_node("AnchorActionSocket").position == shell_socket,
			"mount anchor is a real scene marker rather than an inferred spawn"
		)
		var expected_anchor := Vector2(
			float(TRANSFORM_CELLS[index].x * 16 + 8), float(TRANSFORM_CELLS[index].y * 16 + 8)
		)
		var exact_root := expected_anchor - shell_socket
		_check(
			exact_root == TRANSFORM_ROOTS[index] and exact_root + shell_socket == expected_anchor,
			"shell root uses the exact integer 1:1 A1 transform and accepted footprint bound"
		)
		var shell_walls := 0
		var shell_obstacles := 0
		for child: Node in shell.get_children():
			if not child is StaticBody2D:
				continue
			if str(child.name).begins_with("ShellWall"):
				shell_walls += 1
			elif str(child.name).begins_with("ShellPropObstacle_"):
				shell_obstacles += 1
		_check(shell_walls == 5, "shell keeps five collidable boundary segments and a real doorway")
		_check(
			shell_obstacles == shell_data.get("obstacles_px", []).size(),
			"visually substantial shell props have matching authored collision"
		)

		var shell_actor := ACTOR_SCRIPT.new() as WorldContentTestActor
		shell_actor.collision_layer = 2
		shell_actor.collision_mask = 1
		var shell_shape := CircleShape2D.new()
		shell_shape.radius = 10.0
		var shell_collision := CollisionShape2D.new()
		shell_collision.shape = shell_shape
		shell_actor.add_child(shell_collision)
		root.add_child(shell_actor)
		var entry_requests: Array[Dictionary] = []
		shell.transition_requested.connect(
			func(request: Dictionary): entry_requests.append(request)
		)
		shell_actor.global_position = Vector2(64, 148)
		shell_actor.set("facing", Vector2.UP)
		_check(
			not shell.try_enter(shell_actor), "shell cannot be entered from beyond physical reach"
		)
		shell_actor.request_test_motion(Vector2(0, -42))
		await physics_frame
		_check(
			shell_actor.motion_finished and shell_actor.last_collision == null,
			"exterior actor physically passes through the shell doorway: %s" % shell.get_source_id()
		)
		_check(
			shell.get_context_hint(shell_actor).contains("Enter"),
			"doorway presents a concise contextual entry affordance"
		)
		shell_actor.set("facing", Vector2.DOWN)
		_check(not shell.try_enter(shell_actor), "door entry requires facing into the worksite")
		shell_actor.set("facing", Vector2.UP)
		_check(
			shell.try_enter(shell_actor), "physically reached shell doorway emits an entry request"
		)
		_check(entry_requests.size() == 1, "one shell entry request is emitted")
		if not entry_requests.is_empty():
			var entry: Dictionary = entry_requests[0]
			_check(entry.direction == "enter", "shell request has explicit enter direction")
			_check(
				entry.poi_id == shell.get_source_id(),
				"shell transition identity matches its source data"
			)
			_check(entry.canonical_cell == TRANSFORM_CELLS[index], "shell sends A1 canonical cell")
			_check(
				entry.to_scene == shell.definition.local_transition.worksite_scene,
				"entry targets only the local worksite"
			)
			_check(
				entry.return_anchor.shell_local_position == [64, 108],
				"entry preserves the real exterior return doorway"
			)
		shell_actor.request_test_motion(Vector2(0, 50))
		await physics_frame
		_check(
			shell_actor.last_collision == null and shell_actor.global_position.y > 128,
			"shell doorway remains a physical egress path with side collision retained"
		)
		shell_actor.global_position = Vector2(48, 64)
		shell_actor.request_test_motion(Vector2(-40, 0))
		await physics_frame
		_check(
			shell_actor.last_collision != null and shell_actor.global_position.x >= 18,
			"shell west boundary still blocks ordinary traversal"
		)
		if index == 1:
			shell_actor.global_position = Vector2(24, 96)
			shell_actor.request_test_motion(Vector2(0, -40))
			await physics_frame
			_check(
				shell_actor.last_collision != null and shell_actor.global_position.y >= 88,
				"orchard shell tree trunk is a real obstacle beneath its visual canopy"
			)
		shell_actor.queue_free()
		shell.queue_free()
		await process_frame

		var pair := await _make_site(index)
		var site: NativePoiSite = pair.site
		var actor: WorldContentTestActor = pair.actor
		var authority: PoiAuthorityFixture = pair.authority
		var canonical_site_id := site.get_source_id()
		var entry_x: float = ENTRANCE_X[index]
		var local_requests: Array[Dictionary] = []
		var return_request: Dictionary = {}
		site.transition_requested.connect(func(request: Dictionary): local_requests.append(request))
		actor.global_position = Vector2(entry_x, 626)
		actor.request_test_motion(Vector2(0, -80))
		await physics_frame
		_check(
			actor.motion_finished and actor.last_collision == null,
			(
				"exterior actor physically enters local worksite with perimeter collision retained: %s"
				% site.get_source_id()
			)
		)
		_check(
			actor.global_position.distance_to(site.get_spawn_position()) <= 12.0,
			"entry returns to an interior-only local spawn, never an overworld spawn"
		)
		var boundary_count := 0
		for child: Node in site.get_children():
			if child is StaticBody2D and str(child.name) == "Wall":
				boundary_count += 1
		_check(
			boundary_count >= 5, "local worksite retains solid wall segments around an actual door"
		)

		var stand: Vector2
		if index < 2:
			stand = site.get_stand_position()
			actor.request_test_motion(Vector2(stand.x - actor.global_position.x, 0))
			await physics_frame
			actor.request_test_motion(Vector2(0, stand.y - actor.global_position.y))
			await physics_frame
		else:
			stand = Vector2(528, 536)
			actor.request_test_motion(stand - actor.global_position)
			await physics_frame
		_check(
			actor.global_position.distance_to(stand) <= 30.0,
			(
				"exterior entrance connects to the authored physical approach: %s"
				% site.get_source_id()
			)
		)
		actor.set("facing", Vector2.UP)
		var accepted := site.try_interact(actor, 0) if index == 2 else site.try_interact(actor)
		_check(
			accepted,
			"physical approach accepts its distinct worksite action: %s" % site.get_source_id()
		)
		if accepted:
			var intent: Dictionary = site._pending.duplicate(true)
			var result: Dictionary = authority.submit_intent(intent)
			_check(
				result.status == "committed", "owner fixture commits the approached worksite action"
			)
			site.receive_authoritative_result(
				intent.intent_id, result, authority.project_state(site.get_source_id())
			)
		if index == 0:
			_check(
				site.get_site_state().get("quarry_route", "") in ["east_braced", "west_chocked"],
				"Quarry route preparation changes its owner-projected route consequence"
			)
		elif index == 1:
			_check(
				site.get_site_state().get("orchard_channel", "") == "flowing",
				"Orchard choice visibly changes the accepted irrigation projection"
			)
		else:
			_check(
				site.get_site_state().get("mill_race_observed", false),
				"Mill exterior inspection commits before salvage access"
			)

		var spawn := site.get_spawn_position()
		actor.request_test_motion(Vector2(spawn.x - actor.global_position.x, 0))
		await physics_frame
		actor.request_test_motion(Vector2(0, spawn.y - actor.global_position.y))
		await physics_frame
		_check(
			actor.global_position.distance_to(spawn) <= 18.0,
			"the same site path supports safe retreat to its doorway"
		)
		actor.set("facing", Vector2.UP)
		_check(site.is_at_exit(actor), "local exterior exit is physically reachable")
		_check(
			not site.try_exit(actor), "local exit refuses an actor facing back into the worksite"
		)
		actor.set("facing", Vector2.DOWN)
		_check(site.try_exit(actor), "local doorway emits a typed return request")
		_check(local_requests.size() == 1, "one local exit request is emitted")
		if not local_requests.is_empty():
			var exit_request: Dictionary = local_requests[0]
			return_request = exit_request.duplicate(true)
			_check(exit_request.direction == "exit", "worksite request has explicit exit direction")
			_check(
				exit_request.poi_id == site.get_source_id(),
				"return request preserves canonical POI identity"
			)
			_check(
				exit_request.canonical_cell == TRANSFORM_CELLS[index],
				"return request preserves A1 cell"
			)
			_check(
				exit_request.to_scene == site.definition.local_transition.shell_scene,
				"exit targets the compact shell"
			)
			_check(
				exit_request.return_anchor.shell_local_position == [64, 108],
				"exit returns to the shell doorway, not local spawn"
			)
		actor.request_test_motion(Vector2(0, 78))
		await physics_frame
		_check(
			actor.last_collision == null and actor.global_position.y > 600,
			"worksite egress remains physically open after interaction"
		)
		actor.global_position = Vector2(48, 300)
		actor.request_test_motion(Vector2(-40, 0))
		await physics_frame
		_check(
			actor.last_collision != null and actor.global_position.x >= 32,
			"local worksite keeps its meaningful west perimeter collision"
		)
		if not return_request.is_empty():
			var shell_path := str(return_request.get("to_scene", ""))
			var returned_shell_scene := load(shell_path) as PackedScene
			_check(returned_shell_scene != null, "exit request resolves its compact return shell")
			if returned_shell_scene != null:
				site.queue_free()
				await process_frame
				var returned_shell := returned_shell_scene.instantiate() as NativePoiShell
				root.add_child(returned_shell)
				await process_frame
				var anchor: Dictionary = return_request.get("return_anchor", {})
				var doorway := VECTOR_UTIL.from_pair(anchor.get("shell_local_position", []))
				actor.global_position = doorway
				_check(
					actor.global_position.distance_to(returned_shell.get_entry_position()) <= 0.1,
					"owner return anchor lands at the actual compact-shell doorway"
				)
				actor.set("facing", Vector2.DOWN)
				actor.request_test_motion(Vector2(0, 50))
				await physics_frame
				_check(
					actor.last_collision == null and actor.global_position.y > 128,
					"returned actor can physically leave the same shell doorway"
				)
				actor.set("facing", Vector2.UP)
				actor.request_test_motion(Vector2(0, -50))
				await physics_frame
				var revisit_requests: Array[Dictionary] = []
				returned_shell.transition_requested.connect(
					func(request: Dictionary): revisit_requests.append(request)
				)
				_check(
					returned_shell.try_enter(actor),
					"the returned actor can physically revisit the same canonical site"
				)
				_check(
					revisit_requests.size() == 1,
					"revisit reuses the canonical shell identity without creating a new POI"
				)
				var revisit_site := (
					(load(str(return_request.to_scene)) as PackedScene).instantiate()
					as NativePoiSite
				)
				root.add_child(revisit_site)
				await process_frame
				var serialized_owner_snapshot := JSON.stringify(authority.snapshot())
				var restarted_snapshot: Variant = JSON.parse_string(serialized_owner_snapshot)
				var restarted_authority := FIXTURE_SCRIPT.new() as PoiAuthorityFixture
				restarted_authority.configure(
					restarted_snapshot if restarted_snapshot is Dictionary else {}
				)
				var restored_projection := restarted_authority.project_state(
					revisit_site.get_source_id()
				)
				_check(
					revisit_site.set_projection(restored_projection),
					"site revisit accepts its serialized owner projection after fixture restart"
				)
				_check(
					(
						restored_projection.source_id == canonical_site_id
						and (
							restored_projection.projection_revision
							== authority.snapshot().projection_revision
						)
					),
					"serialized restart projection retains POI identity and owner revision"
				)
				var revisit_state := revisit_site.get_site_state()
				_check(
					revisit_site.get_source_id() == canonical_site_id,
					"revisit retains the same source identity"
				)
				if index == 0:
					_check(
						revisit_state.has("quarry_route"),
						"Quarry revisit restores its route from the owner projection"
					)
					_check(
						(
							not revisit_site.has_node("ChoiceBlocker_brace_oak")
							and revisit_site.has_node("ChoiceBlocker_chock_stone")
						),
						"serialized Quarry projection reopens only the selected east route after restart"
					)
				elif index == 1:
					_check(
						revisit_state.get("orchard_channel", "") == "flowing",
						"Orchard revisit restores visible water state from the owner projection"
					)
				else:
					_check(
						revisit_state.get("mill_race_observed", false),
						"Mill revisit restores the inspection projection"
					)
				revisit_site.queue_free()
				returned_shell.queue_free()
		_cleanup(pair)


func _physical_quarry_route_choices() -> void:
	for route_index: int in range(2):
		var authority := FIXTURE_SCRIPT.new() as PoiAuthorityFixture
		authority.configure()
		root.add_child(authority)
		var packed := load(SITE_SCENES[0]) as PackedScene
		var site := packed.instantiate() as NativePoiSite
		root.add_child(site)
		await process_frame
		site.set_projection(authority.project_state(site.get_source_id()))
		var actor := ACTOR_SCRIPT.new() as WorldContentTestActor
		actor.collision_layer = 2
		actor.collision_mask = 1
		var shape := CircleShape2D.new()
		shape.radius = 10.0
		var collision := CollisionShape2D.new()
		collision.shape = shape
		actor.add_child(collision)
		root.add_child(actor)
		var spawn := site.get_spawn_position()
		var stand := site.get_stand_position()
		actor.global_position = spawn
		actor.request_test_motion(Vector2(stand.x - spawn.x, 0.0))
		await physics_frame
		_check(
			actor.last_collision == null, "Quarry actor reaches the work area without a shortcut"
		)
		actor.request_test_motion(Vector2(0.0, stand.y - actor.global_position.y))
		await physics_frame
		_check(
			actor.last_collision == null and actor.global_position.distance_to(stand) <= 30.0,
			"Quarry actor physically reaches the ordinary interaction stand"
		)
		if route_index == 1:
			site.cycle_choice(1)
		actor.set("facing", Vector2.UP)
		_check(
			site.try_interact(actor), "both Quarry route preparations are available at the stand"
		)
		var intent: Dictionary = site._pending.duplicate(true)
		var result: Dictionary = authority.submit_intent(intent)
		_check(result.status == "committed", "fixture returns an owner result for the chosen route")
		site.receive_authoritative_result(
			intent.intent_id, result, authority.project_state(site.get_source_id())
		)
		var expected_route := "east_braced" if route_index == 0 else "west_chocked"
		_check(
			site.get_site_state().get("quarry_route", "") == expected_route,
			"distinct Quarry preparation is owner-projected: %s" % expected_route
		)
		var blocker_count := 0
		for child: Node in site.get_children():
			if str(child.name).begins_with("ChoiceBlocker_"):
				blocker_count += 1
		_check(blocker_count == 1, "chosen Quarry route removes only its matching blocker")

		var route_side_x := 600.0 if route_index == 0 else 360.0
		actor.request_test_motion(Vector2(route_side_x - actor.global_position.x, 0.0))
		await physics_frame
		_check(actor.last_collision == null, "route approach stays walkable below the shelf")
		actor.request_test_motion(Vector2(0.0, 280.0 - actor.global_position.y))
		await physics_frame
		_check(actor.last_collision == null, "route approach reaches the authored shelf height")
		var route_crossing_x := 506.0
		actor.request_test_motion(Vector2(route_crossing_x - actor.global_position.x, 0.0))
		await physics_frame
		_check(
			(
				actor.last_collision == null
				and is_equal_approx(actor.global_position.x, route_crossing_x)
			),
			"chosen east/west Quarry passage is physically traversable"
		)
		var blocked_target := 420.0 if route_index == 0 else 592.0
		actor.request_test_motion(Vector2(blocked_target - actor.global_position.x, 0.0))
		await physics_frame
		_check(
			actor.last_collision != null, "unchosen Quarry passage remains a real collision blocker"
		)
		_cleanup({"site": site, "actor": actor, "authority": authority})


func _physical_water_routes_and_weather_non_stranding() -> void:
	var orchard_pair := await _make_site(1)
	var orchard: NativePoiSite = orchard_pair.site
	var orchard_actor: WorldContentTestActor = orchard_pair.actor
	var orchard_authority: PoiAuthorityFixture = orchard_pair.authority

	# Setup-only placement on the safe west bank; the next move is real physics.
	orchard_actor.global_position = Vector2(200, 288)
	orchard_actor.request_test_motion(Vector2(100, 0))
	await physics_frame
	_check(
		orchard_actor.last_collision != null and orchard_actor.global_position.x < 214,
		"Orchard's visible unknown-depth water blocks traversal away from its boardwalk"
	)

	# Setup-only placement at the authored approach. Commit the existing neutral
	# sluice choice through the test-only authority fixture, not scene-local state.
	orchard_actor.global_position = orchard.get_stand_position()
	orchard_actor.set("facing", Vector2.UP)
	_check(
		orchard.try_interact(orchard_actor),
		"Orchard sluice choice is reachable from the south bank"
	)
	var orchard_intent: Dictionary = orchard._pending.duplicate(true)
	var orchard_receipt: Dictionary = orchard_authority.submit_intent(orchard_intent)
	_check(
		orchard_receipt.get("status") == "committed",
		"fixture owner commits Orchard's existing sluice choice"
	)
	orchard.receive_authoritative_result(
		orchard_intent.intent_id,
		orchard_receipt,
		orchard_authority.project_state(orchard.get_source_id())
	)
	await physics_frame
	_check(
		orchard.get_site_state().get("orchard_channel") == "flowing",
		"Orchard deadfall opens only after the owner-projected channel state"
	)
	orchard_actor.global_position = Vector2(496, 350)
	orchard_actor.request_test_motion(Vector2(0, -120))
	await physics_frame
	_check(
		orchard_actor.last_collision == null and orchard_actor.global_position.y < 240,
		"Orchard boardwalk physically crosses the channel after sluice clearance"
	)
	orchard_actor.request_test_motion(Vector2(0, 120))
	await physics_frame
	_check(
		orchard_actor.last_collision == null and orchard_actor.global_position.y > 349,
		"Orchard boardwalk remains a physical retreat to the south bank"
	)

	var unknown_context := {
		"contract_id": "soh.a8.environment_presentation_input.v1",
		"site_id": orchard.get_source_id(),
		"projection_revision": 1,
		"world_time": null,
		"weather": null,
		"tide": null,
	}
	_check(
		orchard.apply_environment_projection(unknown_context),
		"A0-shaped unknown environment is accepted for presentation"
	)
	var presented: Dictionary = orchard.get_environment_presentation()
	_check(
		(
			presented.world_time == "UNKNOWN"
			and presented.weather == "UNKNOWN"
			and presented.tide == "UNKNOWN"
		),
		"missing owner time/weather/tide remain UNKNOWN"
	)
	orchard_actor.request_test_motion(Vector2(0, -120))
	await physics_frame
	_check(
		orchard_actor.last_collision == null,
		"unknown weather cannot strand the player or close the authored Orchard retreat"
	)
	_cleanup(orchard_pair)

	var mill_pair := await _make_site(2)
	var mill: NativePoiSite = mill_pair.site
	var mill_actor: WorldContentTestActor = mill_pair.actor
	var mill_authority: PoiAuthorityFixture = mill_pair.authority
	mill_actor.global_position = Vector2(260, 304)
	mill_actor.request_test_motion(Vector2(100, 0))
	await physics_frame
	_check(
		mill_actor.last_collision != null and mill_actor.global_position.x < 278,
		"Mill's visible wheel-race water blocks ordinary cross-channel walking"
	)
	_check(
		(
			mill
			. apply_environment_projection(
				{
					"contract_id": "soh.a8.environment_presentation_input.v1",
					"site_id": mill.get_source_id(),
					"projection_revision": 1,
					"world_time": null,
					"weather": null,
					"tide": null,
				}
			)
		),
		"Mill accepts only site-scoped owner environment presentation"
	)
	mill_authority.set_capabilities(["cap_salvage"])
	_check(
		mill.set_projection(mill_authority.project_state(mill.get_source_id())),
		"Mill accepts current owner capability projection"
	)
	mill_actor.global_position = mill.get_stand_position()
	mill_actor.set("facing", Vector2.UP)
	_check(
		mill.try_interact(mill_actor), "Mill repair choice is physically available at its approach"
	)
	var mill_intent: Dictionary = mill._pending.duplicate(true)
	var mill_receipt: Dictionary = mill_authority.submit_intent(mill_intent)
	_check(
		mill_receipt.get("status") == "committed",
		"fixture owner commits the existing waterwheel repair choice"
	)
	mill.receive_authoritative_result(
		mill_intent.intent_id, mill_receipt, mill_authority.project_state(mill.get_source_id())
	)
	await physics_frame
	_check(
		mill.get_site_state().get("mill_wheel") == "turning",
		"Mill power state remains owner-projected"
	)
	mill_actor.request_test_motion(Vector2(0, -140))
	await physics_frame
	_check(
		mill_actor.last_collision == null and mill_actor.global_position.y < 280,
		"powered Mill opens its existing maintenance gate and the fixed plank race crossing"
	)
	mill_actor.request_test_motion(Vector2(0, 140))
	await physics_frame
	_check(
		mill_actor.last_collision == null and mill_actor.global_position.y > 409,
		"Mill's authored plank/entry route supports a physical retreat after repair"
	)
	_cleanup(mill_pair)


func _assert_shell_art(shell: NativePoiShell) -> void:
	var ground := shell.get_node_or_null("CanonicalFootprintArt/A8_16px_Ground") as TileMapLayer
	_check(ground != null, "compact shell has a real 16 px atlas-backed ground layer")
	if ground != null:
		_check(
			ground.tile_set.tile_size == Vector2i(16, 16), "shell terrain uses the A1 16 px grid"
		)
		_check(
			ground.get_used_cells().size() == 64,
			"shell terrain stays within its eight-by-eight footprint"
		)
	var props := shell.get_node_or_null("CanonicalFootprintArt/A8_SourceSized_Props")
	_check(
		props != null and props.get_child_count() > 0,
		"shell draws source-backed native-size POI props"
	)
	if props != null:
		for child: Node in props.get_children():
			if child is Sprite2D:
				_check(child.scale == Vector2.ONE, "shell prop remains at native one-to-one scale")
				_check(
					child.texture_filter == CanvasItem.TEXTURE_FILTER_NEAREST,
					"shell prop uses nearest filtering"
				)
				_check(
					(
						is_equal_approx(child.position.x, roundf(child.position.x))
						and is_equal_approx(child.position.y, roundf(child.position.y))
					),
					"shell prop anchor remains on integer pixels"
				)


func _make_site(index: int) -> Dictionary:
	var fixture := FIXTURE_SCRIPT.new() as PoiAuthorityFixture
	fixture.configure()
	root.add_child(fixture)
	var packed := load(SITE_SCENES[index]) as PackedScene
	var site := packed.instantiate() as NativePoiSite
	root.add_child(site)
	await process_frame
	site.set_projection(fixture.project_state(site.get_source_id()))
	var actor := ACTOR_SCRIPT.new() as WorldContentTestActor
	actor.collision_layer = 2
	actor.collision_mask = 1
	var shape := CircleShape2D.new()
	shape.radius = 10.0
	var collision := CollisionShape2D.new()
	collision.shape = shape
	actor.add_child(collision)
	root.add_child(actor)
	actor.global_position = site.get_spawn_position()
	await physics_frame
	return {"site": site, "actor": actor, "authority": fixture}


func _cleanup(pair: Dictionary) -> void:
	for key: String in ["site", "actor", "authority"]:
		var node: Node = pair.get(key)
		if is_instance_valid(node):
			node.queue_free()
	await process_frame


func _check(condition: bool, message: String) -> void:
	_assertions += 1
	if not condition:
		_failures.append("Assertion failed: %s" % message)
