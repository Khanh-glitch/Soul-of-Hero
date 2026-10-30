extends SceneTree

const ACTOR_SCRIPT := preload("res://tests/survival/world_content/test_actor.gd")
const PHASE_FIXTURE := preload(
	"res://tests/survival/world_content/a8_run_phase_projection_fixture.gd"
)
const OWNER_FIXTURE := preload("res://game/survival/world_content/scripts/poi_authority_fixture.gd")
const ENDPOINT_SCRIPT := preload(
	"res://game/survival/world_content/scripts/native_poi_physical_endpoint.gd"
)
const PHASE_CONTEXT_SCRIPT := preload(
	"res://game/survival/world_content/scripts/native_poi_phase_context.gd"
)
const QUARRY_SCENE := "res://game/survival/world_content/scenes/south_quarry.tscn"
const ORCHARD_SCENE := "res://game/survival/world_content/scenes/south_orchard_ruin.tscn"
const MILL_SCENE := "res://game/survival/world_content/scenes/south_crown_mill.tscn"
const PHASE_DATA := "res://data/survival/world_content/site_phase_transformations.v1.json"
const ENDPOINT_DATA := "res://data/survival/world_content/physical_ragnarok_endpoints.v1.json"
const WAYSTATION_DATA := "res://data/survival/world_content/ordinary_waystation_opportunity.v1.json"
const WORLD_ID := "world:soh_continent_v1"

var _failures: Array[String] = []
var _assertions := 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	_phase_boundaries_and_projection_validation()
	await _physical_quarry_phase_routes_and_retreat()
	await _site_specific_cues_preserve_unknown_environment()
	await _physical_endpoint_intents_and_owner_fail_closed()
	await _ordinary_waystation_physical_opportunity()
	if _failures.is_empty():
		print("A8_NATIVE_RAGNAROK_TEST_PASS assertions=%d" % _assertions)
		quit(0)
	else:
		for failure: String in _failures:
			push_error(failure)
		print(
			(
				"A8_NATIVE_RAGNAROK_TEST_FAIL failures=%d assertions=%d"
				% [_failures.size(), _assertions]
			)
		)
		quit(1)


func _phase_boundaries_and_projection_validation() -> void:
	var scene := load(QUARRY_SCENE) as PackedScene
	var site := scene.instantiate() as NativePoiSite
	root.add_child(site)
	await process_frame
	var context := PHASE_CONTEXT_SCRIPT.new() as NativePoiPhaseContext
	_check(context.configure(site.definition), "phase validator loads A8's versioned A0 boundary")
	var cases: Array[Dictionary] = [
		{"hours": 0.0, "phase": "ordinary"},
		{"hours": 263.999, "phase": "ordinary"},
		{"hours": 264.0, "phase": "ragnarok_day12"},
		{"hours": 287.999, "phase": "ragnarok_day12"},
		{"hours": 288.0, "phase": "ragnarok_day13"},
		{"hours": 311.999, "phase": "ragnarok_day13"},
		{"hours": 312.0, "phase": "ragnarok_day14"},
		{"hours": 335.999, "phase": "ragnarok_day14"},
		{"hours": 336.0, "phase": "run_expired"},
		{"hours": 1000.0, "phase": "run_expired"}
	]
	for case: Dictionary in cases:
		_check(
			context.phase_id_for_elapsed_hours(float(case.hours)) == str(case.phase),
			"A0 phase schedule boundary %.3f maps to %s" % [float(case.hours), str(case.phase)]
		)
	var ordinary := PHASE_FIXTURE.project(site.definition, "ordinary", 263.999, 8)
	_check(context.apply_projection(ordinary), "valid pre-Ragnarok A0 context is accepted")
	var day12 := PHASE_FIXTURE.project(site.definition, "ragnarok_day12", 264.0, 9)
	_check(context.apply_projection(day12), "day-12 transition is accepted at exactly hour 264")
	var stale := day12.duplicate(true)
	stale.projection_revision = 8
	stale.elapsed_real_hours = 263.999
	stale.phase_id = "ordinary"
	stale.active_effect_ids = []
	_check(
		not context.apply_projection(stale), "stale A0 phase projection cannot roll the site back"
	)
	var same_revision_conflict := day12.duplicate(true)
	same_revision_conflict.phase_id = "ragnarok_day13"
	same_revision_conflict.elapsed_real_hours = 288.0
	same_revision_conflict.active_effect_ids = ["a0.phase.ragnarok.day13"]
	_check(
		not context.apply_projection(same_revision_conflict),
		"same revision cannot authorize a conflicting phase"
	)
	var forged_authority := day12.duplicate(true)
	forged_authority.projection_authority = "A8.LocalClock"
	forged_authority.projection_revision = 10
	_check(
		not context.apply_projection(forged_authority), "A8 cannot claim to be the A0 clock owner"
	)
	var wrong_world := day12.duplicate(true)
	wrong_world.world_id = "world:forged"
	wrong_world.projection_revision = 10
	_check(
		not context.apply_projection(wrong_world), "foreign world phase projections are rejected"
	)
	var missing_instance := day12.duplicate(true)
	missing_instance.site_instance_id = "   "
	missing_instance.projection_revision = 10
	_check(
		not context.apply_projection(missing_instance),
		"missing physical site instance identity is rejected"
	)
	var wrong_phase := day12.duplicate(true)
	wrong_phase.phase_id = "ragnarok_day13"
	wrong_phase.projection_revision = 10
	_check(
		not context.apply_projection(wrong_phase),
		"phase/time mismatch is rejected without locally advancing time"
	)
	var expired := PHASE_FIXTURE.project(site.definition, "run_expired", 336.0, 10)
	_check(
		context.apply_projection(expired), "A0 expiry at exactly hour 336 is accepted as terminal"
	)
	_check(
		not context.permits_mutating_intents(), "terminal projection disables A8 mutating intents"
	)
	var fresh_run := PHASE_FIXTURE.project(site.definition, "ordinary", 0.0, 0, "fixture-run-2", 2)
	_check(
		context.apply_projection(fresh_run), "new A0 run epoch may restart its projection revision"
	)
	_check(
		context.get_phase_id() == "ordinary", "fresh run resets only from an A0 ordinary projection"
	)
	_check(
		context.get_run_context().run_id == "fixture-run-2",
		"new run keeps its owner-provided identity"
	)
	site.queue_free()
	await process_frame


func _physical_quarry_phase_routes_and_retreat() -> void:
	var packed := load(QUARRY_SCENE) as PackedScene
	var site := packed.instantiate() as NativePoiSite
	root.add_child(site)
	var owner := OWNER_FIXTURE.new() as PoiAuthorityFixture
	owner.configure()
	root.add_child(owner)
	await process_frame
	_check(
		site.set_projection(owner.project_state(site.get_source_id())),
		"Quarry owner fixture supplies baseline site state"
	)
	var ordinary := PHASE_FIXTURE.project(site.definition, "ordinary", 263.999, 1)
	_check(
		site.apply_run_phase_projection(ordinary),
		"A0 ordinary context restores the Quarry baseline"
	)
	_check(site.has_valid_run_phase_context(), "Quarry has a valid owner-issued run context")
	_check(_count_named(site, "RagnarokBlocker_") == 0, "ordinary Quarry has no phase blocker")
	_check(
		not site.has_node("A8OwnerProjectedPhaseLayer/RagnarokWarningCue_cairn_warning"),
		"ordinary Quarry has no late warning cue"
	)

	var actor := _new_actor()
	actor.global_position = site.get_spawn_position()
	var stand := site.get_stand_position()
	await _walk_to(actor, Vector2(stand.x, stand.y))
	_check(
		actor.last_collision == null and actor.global_position.distance_to(stand) <= 1.0,
		"actor physically walks from Quarry entrance to work stand"
	)
	actor.set("facing", Vector2.UP)
	site.cycle_choice(1)
	_check(
		site.try_interact(actor), "physically approached actor selects the west Quarry preparation"
	)
	var route_intent: Dictionary = site._pending.duplicate(true)
	var route_receipt: Dictionary = owner.submit_intent(route_intent)
	_check(
		route_receipt.get("status") == "committed",
		"test-only owner fixture resolves the route choice"
	)
	_check(
		site.receive_authoritative_result(
			route_intent.intent_id, route_receipt, owner.project_state(site.get_source_id())
		),
		"Quarry route becomes visible only after the owner fixture projection"
	)
	_check(
		site.get_site_state().get("quarry_route", "") == "west_chocked",
		"the chosen ordinary route remains owner-projected in later phases"
	)
	await _walk_to(actor, Vector2(360, 280))
	_check(
		actor.last_collision == null,
		"west route approach reaches authored Quarry shelf without teleport"
	)
	actor.request_test_motion(Vector2(146, 0))
	await actor.await_test_motion()
	_check(
		actor.last_collision == null and is_equal_approx(actor.global_position.x, 506.0),
		"ordinary west/east crossing remains a real walkable route"
	)

	var day12 := PHASE_FIXTURE.project(site.definition, "ragnarok_day12", 264.0, 2)
	_check(
		site.apply_run_phase_projection(day12),
		"A0 day-12 effect transforms the same Quarry instance"
	)
	await physics_frame
	_check(
		_count_named(site, "RagnarokBlocker_") == 1,
		"day 12 adds one authored east-lane collision blocker"
	)
	_check(
		site.has_node("A8OwnerProjectedPhaseLayer/RagnarokWarningCue_cairn_warning"),
		"day 12 adds a source-atlas warning cue"
	)
	_check(
		site.get_current_phase_id() == "ragnarok_day12",
		"site reports only the received phase, not a local clock"
	)
	actor.request_test_motion(Vector2(94, 0))
	await actor.await_test_motion()
	_check(
		actor.last_collision != null and actor.global_position.x < 600.0,
		"day-12 ash fall physically blocks the east lane"
	)
	await _walk_to(actor, Vector2(360, 378))
	_check(
		actor.last_collision == null, "actor can withdraw from the blocked lane by walking below it"
	)
	await _walk_to(actor, Vector2(506, 280))
	_check(
		actor.last_collision == null, "day-12 west alternate route remains physically traversable"
	)

	var day13 := PHASE_FIXTURE.project(site.definition, "ragnarok_day13", 288.0, 3)
	_check(
		site.apply_run_phase_projection(day13), "A0 day-13 projection reverses the safe local lane"
	)
	await physics_frame
	_check(
		_count_named(site, "RagnarokBlocker_") == 1,
		"day 13 replaces rather than accumulates phase blockers"
	)
	await _walk_to(actor, Vector2(600, 378))
	await _walk_to(actor, Vector2(600, 280))
	actor.request_test_motion(Vector2(-94, 0))
	await actor.await_test_motion()
	_check(
		actor.last_collision == null and actor.global_position.x <= 506.0,
		"day-13 east alternate route is physically traversable"
	)
	actor.request_test_motion(Vector2(-120, 0))
	await actor.await_test_motion()
	_check(actor.last_collision != null, "day-13 shelf shear physically blocks the west lane")

	var day14 := PHASE_FIXTURE.project(site.definition, "ragnarok_day14", 312.0, 4)
	_check(
		site.apply_run_phase_projection(day14),
		"A0 day-14 collapse keeps a marked safe retreat lane"
	)
	await physics_frame
	await _walk_to(actor, Vector2(600, 378))
	await _walk_to(actor, Vector2(360, 378))
	await _walk_to(actor, Vector2(360, 280))
	actor.request_test_motion(Vector2(146, 0))
	await actor.await_test_motion()
	_check(
		actor.last_collision == null and is_equal_approx(actor.global_position.x, 506.0),
		"day-14 west safe lane remains passable after another owner phase change"
	)
	actor.request_test_motion(Vector2(94, 0))
	await actor.await_test_motion()
	_check(actor.last_collision != null, "day-14 east lane remains an actual collision barrier")

	var expired := PHASE_FIXTURE.project(site.definition, "run_expired", 336.0, 5)
	_check(
		site.apply_run_phase_projection(expired),
		"A0 terminal phase removes temporary route geometry"
	)
	await physics_frame
	_check(
		_count_named(site, "RagnarokBlocker_") == 0,
		"expired run removes phase blockers without closing retreat"
	)
	await _walk_to(actor, Vector2(506, 378))
	actor.set("facing", Vector2.UP)
	_check(not site.try_interact(actor), "expired run cannot emit a new mutating site action")
	await _walk_to(actor, site.get_exit_position())
	actor.set("facing", Vector2.DOWN)
	_check(site.try_exit(actor), "expired run still allows physical retreat request to A0")
	var reset_snapshot: Dictionary = owner.snapshot()
	var reset_states: Dictionary = reset_snapshot.get("site_state", {}).duplicate(true)
	reset_states.erase(site.get_source_id())
	reset_snapshot["site_state"] = reset_states
	reset_snapshot["claim_generation"] = {}
	reset_snapshot["claims"] = []
	reset_snapshot["cooldown_until"] = {}
	reset_snapshot["unlock_at"] = {}
	reset_snapshot["inventory"] = {}
	reset_snapshot["capabilities"] = []
	reset_snapshot["clock_seconds"] = 0.0
	reset_snapshot["projection_revision"] = int(reset_snapshot.get("projection_revision", 0)) + 1
	var next_owner := OWNER_FIXTURE.new() as PoiAuthorityFixture
	next_owner.configure(reset_snapshot)
	root.add_child(next_owner)
	_check(
		site.set_projection(next_owner.project_state(site.get_source_id())),
		"only a newer owner site projection resets the prior run's local route state"
	)
	var next_run := PHASE_FIXTURE.project(site.definition, "ordinary", 0.0, 0, "fixture-run-2", 2)
	_check(
		site.apply_run_phase_projection(next_run), "same physical POI accepts the next A0 run epoch"
	)
	await physics_frame
	_check(
		site.get_source_id() == "poi_crown_south_quarry",
		"run reset preserves canonical Quarry identity"
	)
	_check(
		site.get_phase_intents_enabled(),
		"fresh owner-projected run re-enables neutral interactions"
	)
	_check(
		_count_named(site, "RagnarokBlocker_") == 0,
		"fresh run restores ordinary geometry rather than a phase residue"
	)
	_check(
		_count_named(site, "ChoiceBlocker_") == 2,
		"A0's fresh empty route projection restores both ordinary route blockers"
	)
	actor.queue_free()
	next_owner.queue_free()
	owner.queue_free()
	site.queue_free()
	await process_frame


func _site_specific_cues_preserve_unknown_environment() -> void:
	for scene_path: String in [ORCHARD_SCENE, MILL_SCENE]:
		var site := (load(scene_path) as PackedScene).instantiate() as NativePoiSite
		root.add_child(site)
		await process_frame
		var owner := OWNER_FIXTURE.new() as PoiAuthorityFixture
		owner.configure()
		root.add_child(owner)
		_check(
			site.set_projection(owner.project_state(site.get_source_id())),
			"site owner projection loads for its existing A8 identity"
		)
		var before_surface_count := _count_named(site, "SurfaceBlocker_")
		var before_choice_count := _count_named(site, "ChoiceBlocker_")
		var late := PHASE_FIXTURE.project(site.definition, "ragnarok_day13", 288.0, 1)
		_check(
			site.apply_run_phase_projection(late),
			"A0 day-13 context applies site-specific cue profile"
		)
		await physics_frame
		_check(
			_count_named(site, "RagnarokBlocker_") == 0,
			"cue-only Orchard/Mill profile adds no stranding collision"
		)
		_check(
			_count_named(site, "SurfaceBlocker_") == before_surface_count,
			"unknown water remains physically blocking after phase cue"
		)
		var accepted_projection: Dictionary = site.get_node("A8OwnerProjectedPhaseLayer").call(
			"get_projection"
		)
		_check(
			(
				accepted_projection.get("environment", {}).get("tide") == "unknown"
				and accepted_projection.get("environment", {}).get("weather") == "unknown"
			),
			"phase renderer preserves unknown tide and weather rather than guessing"
		)
		_check(
			_count_named(site, "ChoiceBlocker_") == before_choice_count,
			"phase cue does not fabricate an owner site-state choice"
		)
		_check(
			site.get_run_phase_context().phase_id == "ragnarok_day13",
			"site retains the exact A0 phase projection"
		)
		owner.queue_free()
		site.queue_free()
		await process_frame


func _ordinary_waystation_physical_opportunity() -> void:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(WAYSTATION_DATA))
	_check(
		data.get("schema") == "soh.a8.ordinary_waystation_opportunity.v1",
		"ordinary opportunity contract is versioned separately from Ragnarok endpoints"
	)
	_check(
		data.get("status") == "A1_A3_SOURCE_GROUNDED_A8_PHYSICAL_SHADOW_A0_MOUNT_PENDING",
		"Waystation reward path remains explicitly shadow-only pending A0 mount"
	)
	var source: Dictionary = data.get("canonical_source", {})
	var harness: Dictionary = data.get("owner_independent_physics_harness", {})
	var cache: Dictionary = data.get("cache_interaction", {})
	var spawn_cell: Array = source.get("hero_spawn_cell", [])
	var return_cell: Array = source.get("hero_return_cell", [])
	_check(
		(
			source.get("poi_id") == "poi_crown_waystation"
			and cache.get("endpoint_id") == "node_waystation_cache"
			and cache.get("action_id") == "cache_restock"
		),
		"ordinary opportunity preserves the A1 Waystation cache identity and action"
	)
	_check(
		(
			cache.get("a3_binding_id") == "a1_waystation_roadside_cache_v3"
			and cache.get("a3_instance_id") == "si:r_ashen_crown:waystation_cache:01"
		),
		"ordinary opportunity points to the exact A3 cache binding"
	)
	_check(
		cache.get("a0_production_receipt_or_save_grant") == "NOT_INTEGRATED",
		"ordinary opportunity makes no production reward or persistence claim"
	)
	var endpoint := ENDPOINT_SCRIPT.new() as NativePoiPhysicalEndpoint
	_check(
		endpoint.configure("node_waystation_cache", Vector2(-INF, -INF), WAYSTATION_DATA),
		"A8 configures the source-grounded ordinary Waystation physical endpoint"
	)
	root.add_child(endpoint)
	var obstacles := _add_a1_static_obstacles(harness)
	var actor := _new_a1_actor(harness)
	await process_frame
	actor.global_position = _a1_cell_to_local(harness, spawn_cell)
	await physics_frame
	var stand := endpoint.get_interaction_stand_position()
	await _walk_to(actor, stand)
	_check(
		actor.last_collision == null and actor.global_position.distance_to(stand) <= 1.0,
		"A1-sized actor walks from the authored spawn to the exact cache stand"
	)
	var intents: Array[Dictionary] = []
	endpoint.intent_requested.connect(func(intent: Dictionary): intents.append(intent))
	actor.set("facing", Vector2.DOWN)
	_check(
		not endpoint.try_interact(actor),
		"physically reached cache emits nothing while the A0 run projection is missing"
	)
	_check(intents.is_empty(), "unprojected ordinary cache has no request or reward side effect")
	var projection := PHASE_FIXTURE.project(
		{"source": {"poi_id": endpoint.get_source_id(), "world_id": WORLD_ID}},
		"ordinary",
		0.0,
		1,
		"fixture-waystation-run",
		1
	)
	_check(
		endpoint.apply_run_phase_projection(projection),
		"test-only A0 projection supplies the ordinary run identity for this A8 shadow fixture"
	)
	actor.set("facing", Vector2.UP)
	_check(not endpoint.try_interact(actor), "cache enforces A1 stand-side facing")
	actor.set("facing", Vector2.DOWN)
	_check(endpoint.try_interact(actor), "cache emits a neutral request after physical approach")
	_check(intents.size() == 1, "ordinary Waystation approach emits exactly one request")
	if not intents.is_empty():
		var intent: Dictionary = intents[0]
		_check(
			(
				intent.poi_id == "poi_crown_waystation"
				and intent.endpoint_id == "node_waystation_cache"
				and intent.action_id == "cache_restock"
			),
			"Waystation request retains A1 POI, node and A3 action identifiers"
		)
		_check(
			(
				intent.phase_id == "ordinary"
				and intent.site_instance_id == "poi_crown_waystation@fixture-waystation-run"
			),
			"request contains only the test fixture's owner-projected run/site context"
		)
		for forbidden: String in [
			"rewards",
			"item_delta",
			"cooldown_active_seconds",
			"transaction_key",
			"save_patch",
			"currency_delta"
		]:
			_check(
				not intent.has(forbidden),
				"Waystation request contains no A3/A0 result field %s" % forbidden
			)

	var retreat_cells: Array = source.get("primary_retreat_cells", [])
	_check(retreat_cells.size() == 29, "A1 retreat path is pinned as all 29 source cells")
	if retreat_cells.size() == 29:
		await _walk_to(actor, _a1_cell_to_local(harness, [408, 200]))
		var retreat_completed := actor.last_collision == null
		for cell_index: int in range(1, retreat_cells.size()):
			var retreat_cell: Array = retreat_cells[cell_index]
			await _walk_to(actor, _a1_cell_to_local(harness, retreat_cell))
			if actor.last_collision != null:
				retreat_completed = false
		_check(
			(
				retreat_completed
				and (
					actor.global_position.distance_to(_a1_cell_to_local(harness, return_cell))
					<= 1.0
				)
			),
			"actor physically walks the authored A1 retreat path back to the return cell"
		)
	await _walk_to(actor, stand)
	_check(
		actor.last_collision == null and actor.global_position.distance_to(stand) <= 1.0,
		"actor physically revisits the cache stand from the authored spawn route"
	)
	_check(
		not endpoint.try_interact(actor) and intents.size() == 1,
		"pending A0/A3 owner disposition prevents a duplicate request on revisit"
	)
	actor.queue_free()
	endpoint.queue_free()
	for obstacle: StaticBody2D in obstacles:
		obstacle.queue_free()
	await process_frame


func _physical_endpoint_intents_and_owner_fail_closed() -> void:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(ENDPOINT_DATA))
	_check(
		data.get("schema") == "soh.a8.physical_ragnarok_endpoints.v1",
		"versioned physical endpoint catalog loads"
	)
	var actor := _new_actor()
	actor.global_position = Vector2(64, 520)
	for endpoint_definition: Dictionary in data.get("endpoints", []):
		var endpoint := ENDPOINT_SCRIPT.new() as NativePoiPhysicalEndpoint
		_check(
			endpoint.configure(str(endpoint_definition.endpoint_id)),
			"physical endpoint config loads: %s" % str(endpoint_definition.endpoint_id)
		)
		root.add_child(endpoint)
		var phase_id := "ordinary"
		var elapsed := 0.0
		if (
			str(endpoint_definition.endpoint_id)
			in ["endpoint.ragnarok.deposit", "endpoint.ragnarok.evacuation"]
		):
			phase_id = "ragnarok_day12"
			elapsed = 264.0
		var source_definition := {
			"source": {"poi_id": endpoint.get_source_id(), "world_id": WORLD_ID}
		}
		var context := PHASE_FIXTURE.project(source_definition, phase_id, elapsed, 2)
		await _walk_to(actor, Vector2(endpoint.get_interaction_stand_position().x, 520))
		await _walk_to(actor, endpoint.get_interaction_stand_position())
		_check(
			(
				actor.last_collision == null
				and (
					actor.global_position.distance_to(endpoint.get_interaction_stand_position())
					<= 18.0
				)
			),
			"actor walks to the authored physical endpoint stand"
		)
		var intents: Array[Dictionary] = []
		endpoint.intent_requested.connect(func(intent: Dictionary): intents.append(intent))
		actor.set("facing", Vector2.UP)
		_check(
			not endpoint.try_interact(actor),
			"endpoint fails closed while the A0 run/phase projection is unavailable"
		)
		_check(intents.is_empty(), "missing owner authority emits no neutral endpoint intent")
		_check(
			endpoint.apply_run_phase_projection(context),
			"endpoint receives A0 run/phase projection before interaction"
		)
		actor.set("facing", Vector2.DOWN)
		_check(
			not endpoint.try_interact(actor),
			"endpoint enforces facing before emitting a neutral intent"
		)
		actor.set("facing", Vector2.UP)
		_check(
			endpoint.try_interact(actor),
			"physical endpoint emits only after actual approach and correct facing"
		)
		_check(
			not endpoint.try_interact(actor),
			"a pending request blocks duplicate physical submission"
		)
		_check(intents.size() == 1, "exactly one neutral endpoint request was emitted")
		if not intents.is_empty():
			var intent: Dictionary = intents[0]
			_check(
				intent.contract_id == "soh.a8.physical_intent.v1",
				"endpoint request carries the versioned neutral A8 contract"
			)
			_check(
				intent.run_id == context.run_id and intent.phase_id == phase_id,
				"endpoint request preserves owner run and phase identity"
			)
			_check(
				(
					intent.poi_id == endpoint.get_source_id()
					and intent.endpoint_id == endpoint.get_endpoint_id()
				),
				"endpoint request preserves source and physical socket identity"
			)
			_check(
				intent.actor_local_position is Vector2 and intent.actor_facing == Vector2.UP,
				"request includes the observed physical approach, not an outcome"
			)
			for forbidden: String in [
				"currency_delta",
				"item_delta",
				"price",
				"yield",
				"reward",
				"balance_after",
				"transaction_receipt",
				"save_patch",
				"run_finalized"
			]:
				_check(not intent.has(forbidden), "endpoint cannot send owner field %s" % forbidden)
			var request_id := str(intent.get("request_id", ""))
			_check(
				endpoint.resolve_owner_disposition(request_id, "rejected"),
				"A0 rejection clears only the pending neutral request"
			)
			_check(
				endpoint.try_interact(actor),
				"a retry after owner rejection can request the same action again"
			)
			_check(
				intents.size() == 2 and str(intents[1].get("request_id", "")) == request_id,
				"same observed owner revision emits an identical idempotency key for duplicate replay"
			)
			_check(
				not endpoint.resolve_owner_disposition(request_id, "committed"),
				"A8 cannot acknowledge or fabricate a committed transaction"
			)
		var machine_position := endpoint.get_fixture_position()
		actor.request_test_motion(Vector2(0, machine_position.y - 60.0 - actor.global_position.y))
		await actor.await_test_motion()
		_check(
			actor.last_collision != null,
			"machine body is a real collision, not a UI-only affordance"
		)
		await _walk_to(actor, Vector2(actor.global_position.x, 520))
		endpoint.queue_free()
		await process_frame
	actor.queue_free()
	await process_frame


func _add_a1_static_obstacles(harness: Dictionary) -> Array[StaticBody2D]:
	var obstacles: Array[StaticBody2D] = []
	for obstacle_value: Variant in harness.get("source_static_obstacles", []):
		if not obstacle_value is Dictionary:
			continue
		var obstacle: Dictionary = obstacle_value
		if str(obstacle.get("obstacle_id", "")) == "obs_waystation_cache_crate":
			continue
		var cells: Array = obstacle.get("cells", [])
		if cells.is_empty():
			continue
		var first_cell: Array = cells[0]
		var body := StaticBody2D.new()
		body.name = str(obstacle.get("obstacle_id", "A1StaticObstacle"))
		body.collision_layer = 1
		body.collision_mask = 2
		body.position = _a1_cell_to_local(harness, first_cell)
		var offset: Array = obstacle.get("collision_offset_px", [0, 0])
		if offset.size() == 2:
			body.position += Vector2(float(offset[0]), float(offset[1]))
		var size: Array = obstacle.get("collision_size_px", [16, 16])
		if size.size() != 2:
			size = [16, 16]
		var shape := RectangleShape2D.new()
		shape.size = Vector2(float(size[0]), float(size[1]))
		var collision := CollisionShape2D.new()
		collision.shape = shape
		body.add_child(collision)
		root.add_child(body)
		obstacles.append(body)
	return obstacles


func _new_a1_actor(harness: Dictionary) -> WorldContentTestActor:
	var actor := ACTOR_SCRIPT.new() as WorldContentTestActor
	actor.collision_layer = 2
	actor.collision_mask = 1
	var shape := RectangleShape2D.new()
	var body_size: Array = harness.get("a1_hero_body_px", [12, 16])
	shape.size = Vector2(float(body_size[0]), float(body_size[1]))
	var collision := CollisionShape2D.new()
	collision.shape = shape
	var body_offset: Array = harness.get("a1_hero_offset_px", [0, -8])
	collision.position = Vector2(float(body_offset[0]), float(body_offset[1]))
	actor.add_child(collision)
	root.add_child(actor)
	return actor


func _a1_cell_to_local(harness: Dictionary, cell: Array) -> Vector2:
	var origin: Array = harness.get("coordinate_origin_cell", [392, 192])
	var tile_size := float(harness.get("tile_size_px", 16))
	var half_tile := tile_size / 2.0
	return Vector2(
		(float(cell[0]) - float(origin[0])) * tile_size + half_tile,
		(float(cell[1]) - float(origin[1])) * tile_size + half_tile
	)


func _new_actor() -> WorldContentTestActor:
	var actor := ACTOR_SCRIPT.new() as WorldContentTestActor
	actor.collision_layer = 2
	actor.collision_mask = 1
	var shape := CircleShape2D.new()
	shape.radius = 10.0
	var collision := CollisionShape2D.new()
	collision.shape = shape
	actor.add_child(collision)
	root.add_child(actor)
	return actor


func _walk_to(actor: WorldContentTestActor, destination: Vector2) -> void:
	var horizontal := destination.x - actor.global_position.x
	if absf(horizontal) > 0.1:
		actor.request_test_motion(Vector2(horizontal, 0.0))
		await actor.await_test_motion()
	var vertical := destination.y - actor.global_position.y
	if absf(vertical) > 0.1:
		actor.request_test_motion(Vector2(0.0, vertical))
		await actor.await_test_motion()


func _count_named(node: Node, prefix: String) -> int:
	var count := 0
	for child: Node in node.get_children():
		if str(child.name).begins_with(prefix):
			count += 1
		count += _count_named(child, prefix)
	return count


func _check(condition: bool, message: String) -> void:
	_assertions += 1
	if not condition:
		_failures.append("Assertion failed: %s" % message)
