extends SceneTree

# Test-only setup teleports are direct global_position assignments below; they
# model an owner-restored spawn or position an actor for an isolated collision
# check. They are not traversal evidence. Traversal assertions follow
# request_test_motion + the actor completion signal, including doorway and water-route checks.

const VECTOR_UTIL := preload("res://game/survival/world_content/scripts/native_poi_vectors.gd")

const FIXTURE_SCRIPT := preload(
	"res://game/survival/world_content/scripts/poi_authority_fixture.gd"
)
const ACTOR_SCRIPT := preload("res://tests/survival/world_content/test_actor.gd")
const PHASE_FIXTURE := preload(
	"res://tests/survival/world_content/a8_run_phase_projection_fixture.gd"
)
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
const SITE_DEFINITIONS := [
	"res://data/survival/world_content/sites/south_quarry.json",
	"res://data/survival/world_content/sites/south_orchard_ruin.json",
	"res://data/survival/world_content/sites/south_crown_mill.json",
]
const TRANSFORM_CELLS := [Vector2i(30, 280), Vector2i(140, 360), Vector2i(120, 300)]
const TRANSFORM_ROOTS := [Vector2(424, 4424), Vector2(2184, 5704), Vector2(1864, 4744)]
const ENTRANCE_X := [480.0, 480.0, 526.0]

var _failures: Array[String] = []
var _assertions := 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	_shell_definition_parse_schema_and_resource_negatives()
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


func _shell_definition_parse_schema_and_resource_negatives() -> void:
	var invalid_json := JSON.new()
	_check(invalid_json.parse("{ broken") != OK, "invalid source JSON fails to parse")
	for index: int in range(SITE_DEFINITIONS.size()):
		var source_path: String = SITE_DEFINITIONS[index]
		var parser := JSON.new()
		_check(
			parser.parse(FileAccess.get_file_as_string(source_path)) == OK,
			"South-site JSON parses: %s" % source_path
		)
		var definition: Variant = parser.data
		_check(definition is Dictionary, "South-site JSON root is an object")
		if not definition is Dictionary:
			continue
		_check(
			NativePoiShell.validate_definition(definition).is_empty(),
			"source schema, shell bounds, socket and scene references validate: %s" % source_path
		)
		var shell: Dictionary = definition.get("overworld_shell", {})
		for field: String in ["bounds_px", "action_socket", "canonical_cell"]:
			var pair: Variant = (
				shell.get(field, [])
				if field != "canonical_cell"
				else definition.source.get(field, [])
			)
			_check(
				(
					pair is Array
					and pair.size() == 2
					and (typeof(pair[0]) == TYPE_INT or typeof(pair[0]) == TYPE_FLOAT)
					and (typeof(pair[1]) == TYPE_INT or typeof(pair[1]) == TYPE_FLOAT)
				),
				"%s accepts JSON integer-valued numeric pair %s" % [field, pair]
			)

		var bad_schema: Dictionary = definition.duplicate(true)
		bad_schema.schema_version = 2
		_check(
			NativePoiShell.validate_definition(bad_schema) == "unsupported_schema_version",
			"unsupported shell schema version is rejected"
		)
		var string_schema: Dictionary = definition.duplicate(true)
		string_schema.schema_version = "1"
		_check(
			NativePoiShell.validate_definition(string_schema) == "unsupported_schema_version",
			"string-valued schema version is rejected"
		)
		var string_bounds: Dictionary = definition.duplicate(true)
		string_bounds.overworld_shell.bounds_px = [128, "128"]
		_check(
			NativePoiShell.validate_definition(string_bounds) == "shell_bounds_invalid",
			"string-valued bounds component is rejected"
		)
		var fractional_bounds: Dictionary = definition.duplicate(true)
		fractional_bounds.overworld_shell.bounds_px = [128.5, 128]
		_check(
			NativePoiShell.validate_definition(fractional_bounds) == "shell_bounds_invalid",
			"fractional bounds component is rejected"
		)
		var wrong_bounds: Dictionary = definition.duplicate(true)
		wrong_bounds.overworld_shell.bounds_px = [960, 608]
		_check(
			NativePoiShell.validate_definition(wrong_bounds) == "shell_bounds_invalid",
			"interior-size bounds cannot masquerade as a 128-pixel shell"
		)
		var malformed_socket: Dictionary = definition.duplicate(true)
		malformed_socket.overworld_shell.action_socket = [64]
		_check(
			NativePoiShell.validate_definition(malformed_socket) == "action_socket_invalid",
			"malformed action socket is rejected"
		)
		var wrong_socket: Dictionary = definition.duplicate(true)
		wrong_socket.overworld_shell.action_socket = [63, 64]
		_check(
			NativePoiShell.validate_definition(wrong_socket) == "action_socket_invalid",
			"off-center action socket is rejected"
		)
		var mismatched_scene: Dictionary = definition.duplicate(true)
		mismatched_scene.local_transition.shell_scene = "res://missing_shell.tscn"
		_check(
			(
				NativePoiShell.validate_definition(mismatched_scene)
				== "shell_scene_reference_mismatch"
			),
			"split shell-scene references are rejected before scene loading"
		)
		var missing_worksite: Dictionary = definition.duplicate(true)
		missing_worksite.local_transition.worksite_scene = "res://missing_worksite.tscn"
		_check(
			(
				NativePoiShell.validate_definition(missing_worksite)
				== "worksite_scene_resource_missing"
			),
			"missing referenced worksite scene is rejected"
		)
		var packed_shell := load(SHELL_SCENES[index]) as PackedScene
		var packed_worksite := load(str(definition.local_transition.worksite_scene)) as PackedScene
		_check(packed_shell != null, "referenced shell resource loads as PackedScene")
		_check(packed_worksite != null, "referenced worksite resource loads as PackedScene")


func _physical_exterior_entry_exit_all_sites() -> void:
	for index: int in range(SHELL_SCENES.size()):
		var shell_scene: PackedScene = load(SHELL_SCENES[index]) as PackedScene
		_check(shell_scene != null, "compact overworld shell loads: %s" % SHELL_SCENES[index])
		if shell_scene == null:
			continue
		var shell := shell_scene.instantiate() as NativePoiShell
		root.add_child(shell)
		await process_frame
		_check(
			shell.definition_error.is_empty(), "shell loader accepts its exact authored definition"
		)
		_check(not shell.definition.is_empty(), "shell loaded the South-site source definition")
		var shell_data: Dictionary = shell.definition.get("overworld_shell", {})
		_assert_shell_art(shell)
		_check(
			(
				VECTOR_UTIL.from_int_pair(shell_data.get("bounds_px", []), Vector2i(-1, -1))
				== Vector2i(128, 128)
			),
			"shell bounds stay inside four-tile footprint"
		)
		_check(
			(
				VECTOR_UTIL.from_int_pair(shell_data.get("action_socket", []), Vector2i(-1, -1))
				== Vector2i(64, 64)
			),
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
			not shell.try_enter(shell_actor),
			"shell entry fails closed without an A0 run projection"
		)
		shell_actor.request_test_motion(Vector2(0, -42))
		await shell_actor.await_test_motion()
		_check(
			shell_actor.motion_finished and shell_actor.last_collision == null,
			"exterior actor physically passes through the shell doorway: %s" % shell.get_source_id()
		)
		_check(
			not shell.try_enter(shell_actor),
			"physically reached doorway still fails closed while A0 projection is missing"
		)
		_check(
			shell.apply_run_phase_projection(PHASE_FIXTURE.project(shell.definition)),
			"test-only owner phase projection enables the physically tested transition"
		)
		shell_actor.request_test_motion(Vector2(0, 50))
		await shell_actor.await_test_motion()
		_check(
			not shell.try_enter(shell_actor),
			"valid A0 context still enforces physical doorway reach"
		)
		shell_actor.request_test_motion(Vector2(0, -50))
		await shell_actor.await_test_motion()
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
				(
					entry.contract_id == "soh.native_poi.transition.v2"
					and entry.run_id == "fixture-run-1"
					and entry.phase_id == "ordinary"
					and entry.site_instance_id == "%s@fixture-run-1" % shell.get_source_id()
				),
				"transition carries A0-owned run, phase and site-instance identity"
			)
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
				(
					VECTOR_UTIL.from_pair(entry.return_anchor.shell_local_position, Vector2(-1, -1))
					== Vector2(64, 108)
				),
				"entry preserves the real exterior return doorway"
			)
		shell_actor.request_test_motion(Vector2(0, 50))
		await shell_actor.await_test_motion()
		_check(
			shell_actor.last_collision == null and shell_actor.global_position.y > 128,
			"shell doorway remains a physical egress path with side collision retained"
		)
		shell_actor.global_position = Vector2(48, 64)
		shell_actor.request_test_motion(Vector2(-40, 0))
		await shell_actor.await_test_motion()
		_check(
			shell_actor.last_collision != null and shell_actor.global_position.x >= 18,
			"shell west boundary still blocks ordinary traversal"
		)
		if index == 1:
			shell_actor.global_position = Vector2(24, 96)
			shell_actor.request_test_motion(Vector2(0, -40))
			await shell_actor.await_test_motion()
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
		await actor.await_test_motion()
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
			if child is StaticBody2D and str(child.name).begins_with("PerimeterWall_"):
				boundary_count += 1
		_check(
			boundary_count >= 5, "local worksite retains solid wall segments around an actual door"
		)

		var stand: Vector2
		if index < 2:
			stand = site.get_stand_position()
			actor.request_test_motion(Vector2(stand.x - actor.global_position.x, 0))
			await actor.await_test_motion()
			actor.request_test_motion(Vector2(0, stand.y - actor.global_position.y))
			await actor.await_test_motion()
		else:
			stand = Vector2(528, 536)
			actor.request_test_motion(stand - actor.global_position)
			await actor.await_test_motion()
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
		await actor.await_test_motion()
		actor.request_test_motion(Vector2(0, spawn.y - actor.global_position.y))
		await actor.await_test_motion()
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
				(
					VECTOR_UTIL.from_pair(
						exit_request.return_anchor.shell_local_position, Vector2(-1, -1)
					)
					== Vector2(64, 108)
				),
				"exit returns to the shell doorway, not local spawn"
			)
		actor.request_test_motion(Vector2(0, 78))
		await actor.await_test_motion()
		_check(
			actor.last_collision == null and actor.global_position.y > 600,
			"worksite egress remains physically open after interaction"
		)
		actor.global_position = Vector2(48, 300)
		actor.request_test_motion(Vector2(-40, 0))
		await actor.await_test_motion()
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
				_check(
					returned_shell.apply_run_phase_projection(
						PHASE_FIXTURE.project(returned_shell.definition)
					),
					"return shell receives owner run context before revisit"
				)
				var anchor: Dictionary = return_request.get("return_anchor", {})
				var doorway := VECTOR_UTIL.from_pair(anchor.get("shell_local_position", []))
				actor.global_position = doorway
				_check(
					actor.global_position.distance_to(returned_shell.get_entry_position()) <= 0.1,
					"owner return anchor lands at the actual compact-shell doorway"
				)
				actor.set("facing", Vector2.DOWN)
				actor.request_test_motion(Vector2(0, 50))
				await actor.await_test_motion()
				_check(
					actor.last_collision == null and actor.global_position.y > 128,
					"returned actor can physically leave the same shell doorway"
				)
				actor.set("facing", Vector2.UP)
				actor.request_test_motion(Vector2(0, -50))
				await actor.await_test_motion()
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
					(load(str(return_request.from_scene)) as PackedScene).instantiate()
					as NativePoiSite
				)
				root.add_child(revisit_site)
				await process_frame
				_check(
					revisit_site.apply_run_phase_projection(
						PHASE_FIXTURE.project(revisit_site.definition)
					),
					"revisited worksite receives the same owner run context"
				)
				var serialized_owner_snapshot := JSON.stringify(authority.snapshot())
				var restarted_snapshot: Variant = JSON.parse_string(serialized_owner_snapshot)
				var restarted_authority := FIXTURE_SCRIPT.new() as PoiAuthorityFixture
				restarted_authority.configure(
					restarted_snapshot if restarted_snapshot is Dictionary else {}
				)
				var restored_projection := restarted_authority.project_state(
					revisit_site.get_source_id()
				)
				restarted_authority.free()
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
		_check(
			site.apply_run_phase_projection(PHASE_FIXTURE.project(site.definition)),
			"Quarry route fixture requires an explicit owner-projected ordinary phase"
		)
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
		await actor.await_test_motion()
		_check(
			actor.last_collision == null, "Quarry actor reaches the work area without a shortcut"
		)
		actor.request_test_motion(Vector2(0.0, stand.y - actor.global_position.y))
		await actor.await_test_motion()
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
		await actor.await_test_motion()
		_check(actor.last_collision == null, "route approach stays walkable below the shelf")
		actor.request_test_motion(Vector2(0.0, 280.0 - actor.global_position.y))
		await actor.await_test_motion()
		_check(actor.last_collision == null, "route approach reaches the authored shelf height")
		var route_crossing_x := 506.0
		actor.request_test_motion(Vector2(route_crossing_x - actor.global_position.x, 0.0))
		await actor.await_test_motion()
		_check(
			(
				actor.last_collision == null
				and is_equal_approx(actor.global_position.x, route_crossing_x)
			),
			"chosen east/west Quarry passage is physically traversable"
		)
		var blocked_target := 420.0 if route_index == 0 else 592.0
		actor.request_test_motion(Vector2(blocked_target - actor.global_position.x, 0.0))
		await actor.await_test_motion()
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
	await orchard_actor.await_test_motion()
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
	await orchard_actor.await_test_motion()
	_check(
		orchard_actor.last_collision == null and orchard_actor.global_position.y < 240,
		"Orchard boardwalk physically crosses the channel after sluice clearance"
	)
	orchard_actor.request_test_motion(Vector2(0, 120))
	await orchard_actor.await_test_motion()
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
	await orchard_actor.await_test_motion()
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
	await mill_actor.await_test_motion()
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
	var repair_interaction_accepted := mill.try_interact(mill_actor)
	var pending_value: Variant = mill.get("_pending")
	var mill_intent: Dictionary = (
		pending_value.duplicate(true) if pending_value is Dictionary else {}
	)
	var mill_intent_has_v3_schema := (
		repair_interaction_accepted
		and str(mill_intent.get("contract_id", "")) == "soh.native_poi.intent.v3"
		and int(mill_intent.get("contract_version", 0)) == 3
		and mill_intent.has("intent_id")
		and not str(mill_intent.get("intent_id", "")).is_empty()
		and str(mill_intent.get("source_id", "")) == mill.get_source_id()
		and str(mill_intent.get("run_id", "")).length() > 0
		and int(mill_intent.get("run_epoch", -1)) >= 0
		and str(mill_intent.get("phase_id", "")).length() > 0
		and int(mill_intent.get("observed_phase_projection_revision", -1)) >= 0
	)
	_check(
		mill_intent_has_v3_schema,
		"Mill repair emits a fail-closed v3 intent with source/run/phase identity"
	)
	var mill_receipt: Dictionary = {}
	if mill_intent_has_v3_schema:
		mill_receipt = mill_authority.submit_intent(mill_intent)
	_check(
		mill_receipt.get("status") == "committed",
		"fixture owner commits the existing waterwheel repair choice"
	)
	if (
		mill_receipt.get("status") == "committed"
		and str(mill_receipt.get("intent_id", "")) == str(mill_intent.get("intent_id", ""))
	):
		mill.receive_authoritative_result(
			str(mill_intent.get("intent_id", "")),
			mill_receipt,
			mill_authority.project_state(mill.get_source_id())
		)
	await physics_frame
	_check(
		mill.get_site_state().get("mill_wheel") == "turning",
		"Mill power state remains owner-projected"
	)
	mill_actor.request_test_motion(Vector2(0, -140))
	await mill_actor.await_test_motion()
	_check(
		mill_actor.last_collision == null and mill_actor.global_position.y < 280,
		"powered Mill opens its existing maintenance gate and the fixed plank race crossing"
	)
	mill_actor.request_test_motion(Vector2(0, 140))
	await mill_actor.await_test_motion()
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
	site.apply_run_phase_projection(PHASE_FIXTURE.project(site.definition))
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
		var node: Variant = pair.get(key)
		if is_instance_valid(node) and node is Node:
			(node as Node).queue_free()
	await process_frame


func _check(condition: bool, message: String) -> void:
	_assertions += 1
	if not condition:
		_failures.append("Assertion failed: %s" % message)
